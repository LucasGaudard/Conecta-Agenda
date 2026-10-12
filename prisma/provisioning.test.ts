import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { provisionAdmin, validateAdminEnvironment } from "./admin-provisioning";
import { assertDemoSeedAllowed } from "./seed-policy";

const source = {
  SUPER_ADMIN_NAME: "Admin",
  SUPER_ADMIN_EMAIL: " Admin@Example.test ",
  SUPER_ADMIN_PASSWORD: "FixtureOnly!9842",
};

test("demo seed refuses production, missing opt-in and unspecified environment before writes", () => {
  for (const env of [
    {},
    { NODE_ENV: "production", ALLOW_DEMO_SEED: "true" },
    { NODE_ENV: "development" },
    { NODE_ENV: "test", ALLOW_DEMO_SEED: "true" },
  ]) {
    assert.throws(() => assertDemoSeedAllowed(env));
  }
  assert.doesNotThrow(() =>
    assertDemoSeedAllowed({ NODE_ENV: "development", ALLOW_DEMO_SEED: "true" }),
  );
  const seed = readFileSync("prisma/seed.ts", "utf8");
  assert.ok(
    seed.indexOf("assertDemoSeedAllowed(process.env)") < seed.indexOf("new PrismaClient"),
  );
  assert.ok(!seed.includes("SUPER_ADMIN"));
});

test("admin validates before any database access", async () => {
  const store = {
    findExisting: async () => {
      assert.fail("database access");
    },
    create: async () => {
      assert.fail("write");
    },
  };
  for (const bad of [
    {},
    { ...source, SUPER_ADMIN_EMAIL: "invalid" },
    { ...source, SUPER_ADMIN_PASSWORD: "short" },
    { ...source, SUPER_ADMIN_PASSWORD: "A1!" + "é".repeat(40) },
  ]) {
    await assert.rejects(provisionAdmin(bad, store, async () => "hash"));
  }
  assert.equal(validateAdminEnvironment(source).email, "admin@example.test");
});

test("admin create only: repeat or professional collision refuses without hashing or writes", async () => {
  let exists = false,
    writes = 0,
    hashes = 0;
  const store = {
    findExisting: async () => exists,
    create: async (data: { role: string; passwordHash: string }) => {
      assert.equal(data.role, "SUPER_ADMIN");
      assert.equal(data.passwordHash, "hash");
      exists = true;
      writes++;
    },
  };
  const hash = async () => {
    hashes++;
    return "hash";
  };
  await provisionAdmin(source, store, hash);
  await assert.rejects(provisionAdmin(source, store, hash), /já cadastrado/);
  assert.equal(writes, 1);
  assert.equal(hashes, 1);
});

test("concurrent duplicate create fails without fallback update", async () => {
  await assert.rejects(
    provisionAdmin(
      source,
      {
        findExisting: async () => false,
        create: async () => {
          throw new Error("unique collision");
        },
      },
      async () => "hash",
    ),
  );
});
