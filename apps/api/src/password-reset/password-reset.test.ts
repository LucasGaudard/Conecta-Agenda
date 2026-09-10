import assert from "node:assert/strict";
import { test, mock } from "node:test";
import Fastify from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { comparePassword } from "../utils/password";
import { passwordResetRoutes, forgotPasswordMessage } from "../routes/password-reset";
import { PasswordResetService } from "./service";
import { passwordResetRepository } from "./repository";
import { generateResetToken, hashResetToken } from "./token";
import {
  UnconfiguredEmailProvider,
  type PasswordResetEmail,
} from "../notifications/email-provider";

test("tokens use 256 bits from crypto and SHA-256; default provider has no side effects", async () => {
  const tokens = Array.from({ length: 1000 }, generateResetToken);
  assert.equal(new Set(tokens.map((value) => value.token)).size, 1000);
  for (const value of tokens) {
    assert.match(value.token, /^[a-f0-9]{64}$/);
    assert.equal(Buffer.from(value.token, "hex").length, 32);
    assert.equal(value.tokenHash, hashResetToken(value.token));
    assert.notEqual(value.tokenHash, value.token);
  }
  const network = mock.method(globalThis, "fetch", async () => {
    throw new Error("No network allowed");
  });
  try {
    await new UnconfiguredEmailProvider().sendPasswordResetEmail();
    assert.equal(network.mock.callCount(), 0);
  } finally {
    network.mock.restore();
  }
});

test("recovery HTTP flow and real repository with isolated transactional Prisma mock", async () => {
  type Row = { userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };
  const users = [
    {
      id: "u",
      name: "Professional",
      email: "pro@example.com",
      passwordHash: "old",
      role: "PROFESSIONAL",
    },
    {
      id: "a",
      name: "Admin",
      email: "admin@example.com",
      passwordHash: "old",
      role: "SUPER_ADMIN",
    },
  ];
  let rows: Row[] = [];
  let locks = 0;
  let failPasswordWrite = false;
  let rejectEmail = false;
  const messages: PasswordResetEmail[] = [];
  const logs: string[] = [];
  const originalTransaction = prisma.$transaction;
  const originalFind = prisma.user.findUnique;
  const originalEnv = env.NODE_ENV;
  env.NODE_ENV = "production";
  prisma.user.findUnique = mock.fn(
    async (args: { where: { email: string } }) =>
      users.find((user) => user.email === args.where.email) ?? null,
  ) as unknown as typeof prisma.user.findUnique;
  const tx = {
    $queryRaw: async (_sql: TemplateStringsArray, userId: string) => {
      locks++;
      return users.filter((user) => user.id === userId).map((user) => ({ id: user.id }));
    },
    passwordResetToken: {
      findUnique: async (args: { where: { tokenHash: string } }) =>
        rows.find((row) => row.tokenHash === args.where.tokenHash) ?? null,
      create: async (args: { data: Omit<Row, "usedAt"> }) => {
        rows.push({ ...args.data, usedAt: null });
      },
      updateMany: async (args: {
        where: {
          userId?: string;
          tokenHash?: string;
          usedAt: null;
          expiresAt?: { gt: Date };
        };
        data: { usedAt: Date };
      }) => {
        let count = 0;
        for (const row of rows) {
          if (
            (args.where.userId === undefined || row.userId === args.where.userId) &&
            (args.where.tokenHash === undefined ||
              row.tokenHash === args.where.tokenHash) &&
            row.usedAt === null &&
            (!args.where.expiresAt || row.expiresAt > args.where.expiresAt.gt)
          ) {
            row.usedAt = args.data.usedAt;
            count++;
          }
        }
        return { count };
      },
    },
    user: {
      update: async (args: { where: { id: string }; data: { passwordHash: string } }) => {
        if (failPasswordWrite) throw new Error("Simulated database failure");
        const user = users.find((user) => user.id === args.where.id);
        if (!user) throw new Error("Missing user");
        user.passwordHash = args.data.passwordHash;
      },
    },
  };
  // The mock models serialized transactions and rollback; no database is contacted.
  let queue = Promise.resolve();
  prisma.$transaction = (async (
    callback: (client: Prisma.TransactionClient) => Promise<unknown>,
  ) => {
    const prior = queue;
    let unlock = () => {};
    queue = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    await prior;
    const snapshot = rows.map((row) => ({ ...row }));
    const passwords = users.map((user) => user.passwordHash);
    try {
      return await callback(tx as unknown as Prisma.TransactionClient);
    } catch (error) {
      rows = snapshot;
      users.forEach((user, index) => {
        user.passwordHash = passwords[index]!;
      });
      throw error;
    } finally {
      unlock();
    }
  }) as typeof prisma.$transaction;
  const service = new PasswordResetService(passwordResetRepository, {
    async sendPasswordResetEmail(message) {
      if (rejectEmail) throw new Error(message.resetUrl);
      messages.push(message);
    },
  });
  const app = Fastify({
    logger: {
      stream: {
        write(message: string) {
          logs.push(message);
        },
      },
    },
  });
  app.register(passwordResetRoutes, { service });
  let ip = 0;
  const request = (url: string, payload: object, address = `10.0.0.${++ip}`) =>
    app.inject({ method: "POST", url, payload, remoteAddress: address });
  const forgot = (email: string) => request("/auth/forgot-password", { email });
  const lastToken = () => new URL(messages.at(-1)!.resetUrl).searchParams.get("token")!;
  const reset = (token: string, password = "new-password", confirmPassword = password) =>
    request("/auth/reset-password", { token, password, confirmPassword });
  try {
    const known = await forgot("  PRO@example.com ");
    const unknown = await forgot("missing@example.com");
    const admin = await forgot("admin@example.com");
    assert.equal(known.statusCode, 200);
    assert.equal(known.body, unknown.body);
    assert.equal(known.body, admin.body);
    assert.deepEqual(known.json(), { message: forgotPasswordMessage });
    assert.equal(known.headers["cache-control"], "no-store");
    assert.ok(!/token|resetUrl|role|SUPER_ADMIN|passwordHash/.test(known.body));
    assert.equal(messages.length, 2);
    const first = new URL(messages[0]!.resetUrl).searchParams.get("token")!;
    assert.equal(rows[0]!.tokenHash, hashResetToken(first));
    assert.ok(!JSON.stringify(rows).includes(first));
    assert.ok(
      Math.abs(
        rows[0]!.expiresAt.getTime() -
          Date.now() -
          env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60000,
      ) < 5000,
    );
    const adminReset = await reset(lastToken());
    assert.equal(adminReset.statusCode, 200);
    assert.ok(await comparePassword("new-password", users[1]!.passwordHash));
    await forgot("pro@example.com");
    assert.equal((await reset(first)).json().code, "RESET_TOKEN_INVALID_OR_EXPIRED");
    const token = lastToken();
    assert.equal((await reset(token, "abc", "abc")).statusCode, 400);
    assert.equal((await reset(token, "abcdef", "different")).statusCode, 400);
    const concurrent = await Promise.all([reset(token), reset(token)]);
    assert.deepEqual(
      concurrent.map((response) => response.statusCode).sort(),
      [200, 400],
    );
    assert.ok(await comparePassword("new-password", users[0]!.passwordHash));
    assert.ok(rows.filter((row) => row.userId === "u").every((row) => row.usedAt));
    assert.equal((await reset(token)).json().code, "RESET_TOKEN_INVALID_OR_EXPIRED");
    assert.equal(
      (await reset("f".repeat(64))).json().code,
      "RESET_TOKEN_INVALID_OR_EXPIRED",
    );
    assert.equal(
      (await reset("bad-token")).json().code,
      "RESET_TOKEN_INVALID_OR_EXPIRED",
    );
    await forgot("pro@example.com");
    rows.at(-1)!.expiresAt = new Date(Date.now() - 1);
    assert.equal(
      (await reset(lastToken())).json().code,
      "RESET_TOKEN_INVALID_OR_EXPIRED",
    );
    await forgot("pro@example.com");
    const rollbackToken = lastToken();
    failPasswordWrite = true;
    assert.equal((await reset(rollbackToken)).statusCode, 503);
    assert.equal(rows.at(-1)!.usedAt, null);
    failPasswordWrite = false;
    assert.equal((await reset(rollbackToken)).statusCode, 200);
    rejectEmail = true;
    assert.equal((await forgot("pro@example.com")).body, known.body);
    rejectEmail = false;
    await Promise.all([forgot("pro@example.com"), forgot("pro@example.com")]);
    assert.equal(rows.filter((row) => row.userId === "u" && !row.usedAt).length, 1);
    for (let attempt = 0; attempt < 10; attempt++)
      assert.equal(
        (await request("/auth/reset-password", { token: "bad" }, "192.0.2.1")).statusCode,
        400,
      );
    const limited = await request("/auth/reset-password", { token: "bad" }, "192.0.2.1");
    assert.equal(limited.statusCode, 429);
    assert.ok(Number(limited.headers["retry-after"]) > 0);
    assert.ok(locks > 0);
    const output = logs.join("");
    for (const message of messages)
      assert.ok(!output.includes(new URL(message.resetUrl).searchParams.get("token")!));
    assert.ok(!output.includes("new-password"));
  } finally {
    await app.close();
    prisma.$transaction = originalTransaction;
    prisma.user.findUnique = originalFind;
    env.NODE_ENV = originalEnv;
  }
});
