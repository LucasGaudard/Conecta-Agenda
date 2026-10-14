/* eslint @typescript-eslint/no-require-imports: "off" -- Native tooling safety tests without a database. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeHistory, assertUnchanged, history } = require("./dev-database.cjs");
const { isPendingStatus } = require("./dev-database.cjs");
const local = [
  { name: "001", checksum: "a" },
  { name: "002", checksum: "b" },
];
const applied = {
  migration_name: "001",
  checksum: "a",
  finished_at: new Date(),
  rolled_back_at: null,
};
test("Prisma pending exit 1 recognizes actual plural output without accepting failures", () => {
  for (const heading of [
    "Following migrations have not yet been applied:",
    "Following migration(s) have not yet been applied:",
  ])
    assert.equal(
      isPendingStatus({ status: 1, stdout: `${heading}\n001\n`, stderr: "" }),
      true,
    );
  for (const result of [
    { status: 1, stdout: "", stderr: "Error: Connection refused" },
    {
      status: 1,
      stdout: "Following migrations have not yet been applied:\n",
      stderr: "P3009",
    },
    {
      status: 2,
      stdout: "Following migrations have not yet been applied:\n",
      stderr: "",
    },
  ])
    assert.equal(isPendingStatus(result), false);
});
test("empty dev history and a consistent prefix expose only pending migrations", () => {
  assert.deepEqual(analyzeHistory(local, []).pending, ["001", "002"]);
  assert.deepEqual(analyzeHistory(local, [applied]), {
    applied: ["001"],
    pending: ["002"],
    failed: 0,
  });
});
test("failed, changed, unknown, duplicate and out-of-order migrations refuse writes", () => {
  for (const rows of [
    [{ ...applied, finished_at: null }],
    [{ ...applied, checksum: "changed" }],
    [{ ...applied, migration_name: "unknown" }],
    [applied, applied],
    [{ ...applied, migration_name: "002", checksum: "b" }],
  ])
    assert.throws(() => analyzeHistory(local, rows), /DEV_/);
});
test("profile or production-reference changes after validation refuse operations", () => {
  const context = { content: "dev", productionUrl: "excluded" };
  assert.doesNotThrow(() => assertUnchanged(context, { ...context }));
  assert.throws(
    () => assertUnchanged(context, { ...context, content: "different" }),
    /DEV_PROFILE_CHANGED/,
  );
  assert.throws(
    () => assertUnchanged(context, { ...context, productionUrl: "different" }),
    /DEV_PROFILE_CHANGED/,
  );
});
test("a populated schema without Prisma history refuses migration baselining", async () => {
  const statements = [];
  const client = {
    $transaction: async (fn) =>
      fn({
        $executeRawUnsafe: async (sql) => {
          statements.push(sql);
        },
        $queryRawUnsafe: async () => [{ tablename: "User" }],
      }),
  };
  await assert.rejects(history(client, local), /DEV_UNBASELINED/);
  assert.deepEqual(statements, ["SET TRANSACTION READ ONLY"]);
});
test("Prisma construction preserves an installed dev profile, without connecting", async () => {
  const { resolveDevelopmentProfile } = require("../apps/api/development-profile.cjs");
  const config = resolveDevelopmentProfile(
    [
      "DATABASE_URL=postgresql://fixture:fixture@ep-fixture-dev.us-east-2.aws.neon.tech/neondb?sslmode=require",
      "DEV_DATABASE_HOST=ep-fixture-dev.us-east-2.aws.neon.tech",
      "DEV_DATABASE_NAME=neondb",
      "JWT_SECRET=fixture-dev-unit-test-secret-with-more-than-32-characters",
    ].join("\n"),
  );
  const previous = { ...process.env };
  let client;
  try {
    Object.assign(process.env, config);
    const { PrismaClient } = require("@prisma/client");
    client = new PrismaClient({ datasourceUrl: config.DATABASE_URL, log: [] });
    for (const [key, value] of Object.entries(config))
      assert.equal(process.env[key], value);
  } finally {
    if (client) await client.$disconnect();
    for (const key of Object.keys(process.env))
      if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
