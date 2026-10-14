import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { BillingCheckoutAttempt, BillingEvent, PrismaClient } from "@prisma/client";
import { buildApp } from "../app";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../utils/jwt";
import { PrismaCheckoutRepository } from "./checkout-repository";
import { SimulatedCheckoutService, simulatedCheckoutEnabled } from "./checkout-service";
import {
  MercadoPagoTestHttpClient,
  type PlanSubscriptionRequest,
  type SimulatedHttpTransport,
} from "./mercado-pago-http";
import type { MercadoPagoTestConfig } from "./config";

const actor = { userId: "owner", businessId: "business" };
const source = {
  NODE_ENV: "test",
  BILLING_CHECKOUT_MODE: "SIMULATED",
  MERCADO_PAGO_ENVIRONMENT: "TEST",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/conecta_agenda_billing_test",
};
const config: MercadoPagoTestConfig = {
  environment: "TEST",
  accessToken: "simulation-fixture",
  applicationId: "123",
  collectorId: "456",
  backUrl: "https://example.invalid/return",
  timeoutMs: 1000,
};
type Args = {
  where?: {
    id?: string;
    userId?: string;
    subscriptionId?: string;
    provider?: string;
    environment?: string;
    deduplicationKey?: string;
    user?: { business?: { id?: string } };
    planId_provider_environment?: {
      planId: string;
      provider: string;
      environment: string;
    };
  };
  data?: Record<string, unknown>;
};
function initialState() {
  return {
    subscription: {
      id: "subscription",
      userId: "owner",
      planId: "internal-plan",
      status: "TRIALING",
      trialEndsAt: new Date("2026-10-19T15:00:00Z"),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      provider: null as string | null,
      providerEnvironment: null as string | null,
      providerSubscriptionId: null as string | null,
      externalReference: null as string | null,
      plan: { id: "internal-plan", priceInCents: 4990, isActive: true },
      user: {
        email: "buyer@example.invalid",
        business: {
          id: "business",
          isManuallyBlocked: false,
          createdAt: new Date("2026-10-12T15:00:00Z"),
        },
      },
    },
    mapping: {
      id: "mapping",
      planId: "internal-plan",
      provider: "MERCADO_PAGO",
      environment: "TEST",
      providerPlanId: "mapped-plan",
      isActive: true,
    },
    attempts: [] as BillingCheckoutAttempt[],
    events: [] as BillingEvent[],
  };
}
type State = ReturnType<typeof initialState>;

// Atomic transaction/row-lock model. No real Prisma engine, socket or database is used.
class DatabaseFixture {
  state = initialState();
  locks = 0;
  failFinalization = false;
  private tail = Promise.resolve();
  readonly database: PrismaClient;
  constructor() {
    this.database = {
      ...this.view(() => this.state, false),
      $transaction: this.transaction.bind(this),
    } as unknown as PrismaClient;
  }
  private async transaction<T>(callback: (tx: unknown) => Promise<T>) {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const draft = structuredClone(this.state);
    try {
      const result = await callback(this.view(() => draft, true));
      this.state = draft;
      return result;
    } finally {
      release();
    }
  }
  private view(state: () => State, writable: boolean) {
    const writes = () =>
      assert.equal(writable, true, "all writes must use the transaction");
    const findAttempt = (args: Args) =>
      state().attempts.find(
        (a) =>
          (!args.where?.id || a.id === args.where.id) &&
          a.subscriptionId === args.where?.subscriptionId &&
          a.provider === args.where?.provider &&
          a.environment === args.where?.environment,
      ) ?? null;
    return {
      $queryRaw: async (query: { strings: string[]; values: unknown[] }) => {
        writes();
        this.locks++;
        assert.match(query.strings.join(" "), /FOR UPDATE OF s/);
        assert.match(query.strings.join(" "), /JOIN "Business"/);
        return query.values[0] === state().subscription.userId &&
          query.values[1] === state().subscription.user.business.id
          ? [{ id: state().subscription.id }]
          : [];
      },
      subscription: {
        findFirst: async (args: Args) => {
          const sub = state().subscription;
          if (
            args.where?.id !== sub.id ||
            args.where?.userId !== sub.userId ||
            args.where?.user?.business?.id !== sub.user.business.id
          )
            return null;
          return structuredClone(sub);
        },
        update: async (args: Args) => {
          writes();
          assert.equal(args.where?.id, state().subscription.id);
          assert.ok(
            Object.keys(args.data ?? {}).every((k) =>
              [
                "provider",
                "providerEnvironment",
                "providerSubscriptionId",
                "externalReference",
              ].includes(k),
            ),
            "checkout may only save provider references",
          );
          Object.assign(state().subscription, args.data);
          return structuredClone(state().subscription);
        },
      },
      providerPlan: {
        findUnique: async (args: Args) => {
          const key = args.where?.planId_provider_environment;
          const mapping = state().mapping;
          return key?.planId === mapping.planId &&
            key.provider === mapping.provider &&
            key.environment === mapping.environment
            ? structuredClone(mapping)
            : null;
        },
      },
      billingCheckoutAttempt: {
        findFirst: async (args: Args) => structuredClone(findAttempt(args)),
        create: async (args: Args) => {
          writes();
          assert.equal(
            state().attempts.length,
            0,
            "one persistent attempt per subscription workflow",
          );
          const row = {
            providerSubscriptionId: null,
            expiresAt: null,
            completedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          } as BillingCheckoutAttempt;
          state().attempts.push(row);
          return structuredClone(row);
        },
        update: async (args: Args) => {
          writes();
          const row = state().attempts.find((a) => a.id === args.where?.id)!;
          Object.assign(row, args.data);
          return structuredClone(row);
        },
      },
      billingEvent: {
        findUnique: async (args: Args) =>
          structuredClone(
            state().events.find(
              (e) => e.deduplicationKey === args.where?.deduplicationKey,
            ) ?? null,
          ),
        create: async (args: Args) => {
          writes();
          assert.ok(
            !state().events.some(
              (e) => e.deduplicationKey === args.data?.deduplicationKey,
            ),
          );
          const row = {
            requestId: null,
            errorCode: null,
            processedAt: null,
            receivedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...args.data,
          } as BillingEvent;
          state().events.push(row);
          return structuredClone(row);
        },
        update: async (args: Args) => {
          writes();
          if (this.failFinalization && args.data?.status === "PROCESSED") {
            this.failFinalization = false;
            throw new Error("simulated database interruption");
          }
          const row = state().events.find((e) => e.id === args.where?.id)!;
          Object.assign(row, args.data);
          return structuredClone(row);
        },
      },
    };
  }
}

class ServerFixture {
  posts = 0;
  reads = 0;
  preflightFailure = false;
  postFailure = false;
  timeout = false;
  invalidUrl = false;
  afterPlan?: () => void;
  resources = new Map<
    string,
    {
      id: string;
      application_id: number;
      collector_id: number;
      preapproval_plan_id: string;
      external_reference: string;
      status: string;
      init_point: string;
    }
  >();
  constructor(readonly db: DatabaseFixture) {}
  transport(): SimulatedHttpTransport {
    return {
      mode: "SIMULATED",
      send: async (url, init) => {
        assert.equal(new URL(url).origin, "https://api.mercadopago.com");
        assert.equal(
          this.db.state.attempts.length,
          1,
          "attempt must already be committed before HTTP",
        );
        if (init.method === "GET" && url.includes("/preapproval_plan/")) {
          this.reads++;
          if (this.preflightFailure) {
            this.preflightFailure = false;
            return { status: 500, json: async () => ({}) };
          }
          const body = {
            id: "mapped-plan",
            application_id: 123,
            collector_id: 456,
            status: "active",
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              transaction_amount: 49.9,
              currency_id: "BRL",
            },
          };
          this.afterPlan?.();
          return { status: 200, json: async () => body };
        }
        if (init.method === "POST") {
          assert.equal(
            this.db.state.events[0]?.status,
            "PROCESSING",
            "claim must be committed BEFORE POST",
          );
          this.posts++;
          if (this.postFailure) return { status: 400, json: async () => ({}) };
          const body = JSON.parse(init.body!) as PlanSubscriptionRequest;
          const id = `sim_subscription_${this.posts}`;
          const result = {
            id,
            application_id: 123,
            collector_id: 456,
            preapproval_plan_id: body.preapproval_plan_id,
            external_reference: body.external_reference,
            status: "authorized",
            init_point: this.invalidUrl
              ? "https://attacker.invalid/checkout"
              : `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`,
          };
          this.resources.set(id, result);
          return {
            status: 201,
            json: async () => (this.timeout ? new Promise(() => {}) : result),
          };
        }
        const id = url.split("/").at(-1)!;
        return {
          status: this.resources.has(id) ? 200 : 404,
          json: async () => this.resources.get(id) ?? {},
        };
      },
    };
  }
}
function service(db: DatabaseFixture, server: ServerFixture, timeoutMs = 1000) {
  const settings = { ...config, timeoutMs };
  return new SimulatedCheckoutService(
    new PrismaCheckoutRepository(db.database),
    new MercadoPagoTestHttpClient(settings, server.transport()),
    settings,
    { ...source },
  );
}
function entitlement(db: DatabaseFixture) {
  const s = db.state.subscription;
  return {
    status: s.status,
    trialEndsAt: s.trialEndsAt,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    businessCreatedAt: s.user.business.createdAt,
  };
}

test("simulation gate rejects production, Neon, the wrong local database and unknown modes", () => {
  assert.equal(simulatedCheckoutEnabled(source), true);
  for (const change of [
    { NODE_ENV: "production" },
    { BILLING_CHECKOUT_MODE: "LIVE" },
    { BILLING_CHECKOUT_MODE: "OFF" },
    { MERCADO_PAGO_ENVIRONMENT: "PRODUCTION" },
    { DATABASE_URL: "postgresql://fixture:fixture@example.neon.tech/neondb" },
    { DATABASE_URL: "postgresql://fixture:fixture@localhost/production" },
  ])
    assert.equal(simulatedCheckoutEnabled({ ...source, ...change }), false);
});

test("successful checkout persists UUID attempt/claim/references but preserves all access and trial fields", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  const before = entitlement(db);
  const result = await service(db, server).checkout(actor);
  assert.equal(result.mode, "SIMULATED");
  assert.equal(server.posts, 1);
  assert.equal(db.state.events[0]?.status, "PROCESSED");
  const a = db.state.attempts[0]!;
  for (const value of [a.id, a.idempotencyKey, a.externalReference])
    assert.match(
      value,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  assert.equal(a.status, "PROVIDER_CREATED");
  assert.equal(db.state.subscription.providerSubscriptionId, a.providerSubscriptionId);
  assert.deepEqual(entitlement(db), before);
  assert.ok(db.locks >= 3);
  assert.ok(!JSON.stringify(db.state.events).includes("buyer@example.invalid"));
});

test("separate instances and concurrent requests share one durable attempt and send at most one POST", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  const a = service(db, server),
    b = service(db, server);
  const results = await Promise.allSettled([
    a.checkout(actor),
    b.checkout(actor),
    a.checkout(actor),
    b.checkout(actor),
  ]);
  assert.ok(results.some((r) => r.status === "fulfilled"));
  assert.equal(server.posts, 1);
  assert.equal(db.state.attempts.length, 1);
  assert.equal(db.state.events.length, 1);
  const freshServer = new ServerFixture(db);
  const replay = await service(db, freshServer).checkout(actor);
  assert.equal(replay.mode, "SIMULATED");
  assert.equal(freshServer.posts, 0);
  assert.equal(freshServer.reads, 0);
});

test("failure before claim is retryable with the same UUID and idempotency key", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  server.preflightFailure = true;
  await assert.rejects(service(db, server).checkout(actor), {
    code: "BILLING_CHECKOUT_PREPARATION_FAILED",
  });
  const attempt = structuredClone(db.state.attempts[0]!);
  assert.equal(db.state.events.length, 0);
  assert.equal(server.posts, 0);
  await service(db, server).checkout(actor);
  assert.equal(db.state.attempts[0]?.id, attempt.id);
  assert.equal(db.state.attempts[0]?.idempotencyKey, attempt.idempotencyKey);
  assert.equal(server.posts, 1);
});

test("timeout is fenced across restart; verified internal reconciliation recovers without another POST", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  server.timeout = true;
  const before = entitlement(db);
  await assert.rejects(service(db, server, 10).checkout(actor), {
    code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
  });
  assert.equal(db.state.events[0]?.status, "FAILED");
  const restarted = service(db, server);
  await assert.rejects(restarted.checkout(actor), {
    code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
  });
  await assert.rejects(
    restarted.reconcile(
      { ...actor, businessId: "wrong" },
      db.state.attempts[0]!.id,
      "sim_subscription_1",
    ),
    { code: "BILLING_TENANT_MISMATCH" },
  );
  server.timeout = false;
  await restarted.reconcile(actor, db.state.attempts[0]!.id, "sim_subscription_1");
  assert.equal(server.posts, 1);
  assert.equal(db.state.events[0]?.status, "PROCESSED");
  assert.deepEqual(entitlement(db), before);
});

test("response persistence interruption rolls back references; reconciliation safely finishes the existing contract", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  db.failFinalization = true;
  await assert.rejects(service(db, server).checkout(actor), {
    code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
  });
  assert.equal(db.state.subscription.providerSubscriptionId, null);
  assert.equal(db.state.attempts[0]?.providerSubscriptionId, null);
  await service(db, server).reconcile(
    actor,
    db.state.attempts[0]!.id,
    "sim_subscription_1",
  );
  assert.equal(server.posts, 1);
  assert.equal(db.state.attempts[0]?.status, "PROVIDER_CREATED");
});

test("a worker interrupted after claim and before POST remains fenced; absence is not permission to resend", async () => {
  const db = new DatabaseFixture();
  const repository = new PrismaCheckoutRepository(db.database);
  const reservation = await repository.reserve(actor);
  await repository.claim(
    actor,
    reservation.attempt.id,
    {
      planId: "internal-plan",
      providerPlanId: "mapped-plan",
      priceInCents: 4990,
      trialEndsAt: db.state.subscription.trialEndsAt.toISOString(),
    },
    "a".repeat(64),
  );
  const server = new ServerFixture(db);
  await assert.rejects(service(db, server).checkout(actor), {
    code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
  });
  assert.equal(server.posts, 0);
  assert.equal(server.reads, 0);
});

test("post rejection or invalid URL never grants access, starts a fresh attempt or repeats POST", async () => {
  for (const failure of ["postFailure", "invalidUrl"] as const) {
    const db = new DatabaseFixture();
    const server = new ServerFixture(db);
    server[failure] = true;
    const before = entitlement(db);
    await assert.rejects(service(db, server).checkout(actor), {
      code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
    });
    await assert.rejects(service(db, server).checkout(actor), {
      code: "BILLING_CHECKOUT_REVIEW_REQUIRED",
    });
    assert.equal(server.posts, 1);
    assert.equal(db.state.attempts.length, 1);
    assert.deepEqual(entitlement(db), before);
  }
});

test("tenant mismatch, production scope, manual block and changed terms prevent creation", async () => {
  const wrong = new DatabaseFixture();
  const s = new ServerFixture(wrong);
  await assert.rejects(
    service(wrong, s).checkout({ userId: "other", businessId: "business" }),
    { code: "BILLING_TENANT_MISMATCH" },
  );
  assert.equal(wrong.state.attempts.length, 0);
  for (const mode of ["block", "production"] as const) {
    const db = new DatabaseFixture();
    const server = new ServerFixture(db);
    if (mode === "block") db.state.subscription.user.business.isManuallyBlocked = true;
    else db.state.subscription.providerEnvironment = "PRODUCTION";
    await assert.rejects(service(db, server).checkout(actor), { statusCode: 403 });
    assert.equal(db.state.attempts.length, 0);
  }
  const changed = new DatabaseFixture();
  const server = new ServerFixture(changed);
  server.afterPlan = () => {
    changed.state.subscription.plan.priceInCents = 1;
  };
  await assert.rejects(service(changed, server).checkout(actor), {
    code: "BILLING_CHECKOUT_TERMS_CHANGED",
  });
  assert.equal(server.posts, 0);
});

test("the HTTP route uses session ownership, rejects all external authority and keeps cancellation disabled", async () => {
  const db = new DatabaseFixture();
  const server = new ServerFixture(db);
  const checkoutService = service(db, server);
  const originals = {
    user: prisma.user.findUnique,
    business: prisma.business.findUnique,
  };
  prisma.user.findUnique = mock.fn(async () => ({
    id: "owner",
    role: "PROFESSIONAL",
    business: { id: "business" },
  })) as unknown as typeof prisma.user.findUnique;
  prisma.business.findUnique = mock.fn(async () => ({
    id: "business",
    isManuallyBlocked: false,
    accessOverrideUntil: null,
    user: {
      id: "owner",
      subscription: {
        ...db.state.subscription,
        plan: { ...db.state.subscription.plan, name: "Starter", slug: "starter" },
      },
    },
  })) as unknown as typeof prisma.business.findUnique;
  const network = mock.method(globalThis, "fetch", async () => {
    throw new Error("Network forbidden");
  });
  const app = buildApp({ checkoutService });
  const headers = {
    authorization: `Bearer ${signAuthToken({ userId: "owner", businessId: "business" })}`,
  };
  try {
    assert.equal(
      (await app.inject({ method: "POST", url: "/billing/checkout" })).statusCode,
      401,
    );
    for (const payload of [
      { priceInCents: 1 },
      { businessId: "other" },
      { status: "ACTIVE" },
      { providerPlanId: "other" },
      { providerSubscriptionId: "other" },
      { cardTokenId: "real-card" },
    ])
      assert.equal(
        (await app.inject({ method: "POST", url: "/billing/checkout", headers, payload }))
          .statusCode,
        400,
      );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/billing/checkout?businessId=other",
          headers,
        })
      ).statusCode,
      400,
    );
    assert.equal(db.state.attempts.length, 0);
    const first = await app.inject({ method: "POST", url: "/billing/checkout", headers });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().mode, "SIMULATED");
    assert.equal(
      (await app.inject({ method: "POST", url: "/billing/checkout", headers }))
        .statusCode,
      200,
    );
    const status = (await app.inject({ url: "/billing/status", headers })).json();
    assert.equal(status.checkoutMode, "SIMULATED");
    assert.equal(status.checkoutAvailable, true);
    assert.equal(status.cancellationAvailable, false);
    assert.equal(server.posts, 1);
    assert.equal(network.mock.callCount(), 0);
    assert.equal(db.state.subscription.status, "TRIALING");
  } finally {
    await app.close();
    prisma.user.findUnique = originals.user;
    prisma.business.findUnique = originals.business;
    network.mock.restore();
  }
});
