/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS security tests with mocks only. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  validateDestination,
  evaluateConnectionIdentity,
  validateDevelopmentConnection,
} = require("../development-connection.cjs");

const host = "ep-fixture-dev-123-pooler.us-east-2.aws.neon.tech";
const url = `postgresql://fixture:fixture@${host}/neondb?sslmode=require`;
const profile = (overrides = {}) =>
  Object.entries({
    DATABASE_URL: url,
    DEV_DATABASE_HOST: host,
    DEV_DATABASE_NAME: "neondb",
    JWT_SECRET: "fixture-only-development-key-never-used-in-server",
    ...overrides,
  })
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");
const config = validateDestination(profile());
const evidence = {
  hostname: host,
  authorized: true,
  encrypted: true,
  protocol: "TLSv1.3",
};
const rows = [{ database: "neondb", schema: "public", backend_ssl: false }];

test("backend SSL false/null does not misclassify verified client TLS", () => {
  for (const backend_ssl of [false, null, true]) {
    const result = evaluateConnectionIdentity(
      config,
      [{ ...rows[0], backend_ssl }],
      evidence,
    );
    assert.equal(result.valid, true);
    assert.equal(result.clientTlsVerified, true);
    assert.equal(result.backendSsl, backend_ssl);
  }
});
test("backend SSL true cannot compensate for missing/invalid client certificate, hostname or encryption", () => {
  for (const invalid of [
    null,
    {},
    { ...evidence, authorized: false },
    { ...evidence, encrypted: false },
    { ...evidence, hostname: "other.invalid" },
    { ...evidence, protocol: "TLSv1" },
  ])
    assert.throws(
      () =>
        evaluateConnectionIdentity(config, [{ ...rows[0], backend_ssl: true }], invalid),
      /DEV_CLIENT_TLS_NOT_VERIFIED/,
    );
});
test("database, schema and row count have distinct failure codes", () => {
  assert.throws(
    () => evaluateConnectionIdentity(config, [], evidence),
    /DEV_CONNECTION_ROWS_INVALID/,
  );
  assert.throws(
    () => evaluateConnectionIdentity(config, [rows[0], rows[0]], evidence),
    /DEV_CONNECTION_ROWS_INVALID/,
  );
  assert.throws(
    () =>
      evaluateConnectionIdentity(config, [{ ...rows[0], database: "other" }], evidence),
    /DEV_CONNECTED_DATABASE_MISMATCH/,
  );
  assert.throws(
    () => evaluateConnectionIdentity(config, [{ ...rows[0], schema: "other" }], evidence),
    /DEV_CONNECTED_SCHEMA_MISMATCH/,
  );
});
test("production direct/pooled and root production reference refuse before network/Prisma", async () => {
  const forbidden = () => {
    assert.fail("network/database must not be reached");
  };
  for (const productionHost of [
    "ep-rough-pine-ai569xud.us-east-2.aws.neon.tech",
    "ep-rough-pine-ai569xud-pooler.us-east-2.aws.neon.tech",
  ]) {
    await assert.rejects(
      validateDevelopmentConnection(
        {
          content: profile({
            DATABASE_URL: url.replace(host, productionHost),
            DEV_DATABASE_HOST: productionHost,
          }),
        },
        { probeTls: forbidden, createClient: forbidden },
      ),
      /DEV_PRODUCTION_DATABASE_REFUSED/,
    );
  }
  await assert.rejects(
    validateDevelopmentConnection(
      { content: profile(), productionUrl: url.replace("-pooler.", ".") },
      { probeTls: forbidden, createClient: forbidden },
    ),
    /DEV_PRODUCTION_DATABASE_REFUSED/,
  );
});
test("plaintext URL, redirected parameters and MP configuration refuse before network", async () => {
  const forbidden = () => assert.fail("network must not be reached");
  for (const overrides of [
    { DATABASE_URL: url.replace("require", "disable") },
    { DATABASE_URL: url + "&host=production" },
    { BILLING_CHECKOUT_MODE: "SIMULATED" },
    { MERCADO_PAGO_ACCESS_TOKEN: "fixture" },
  ])
    await assert.rejects(
      validateDevelopmentConnection(
        { content: profile(overrides) },
        { probeTls: forbidden, createClient: forbidden },
      ),
      /DEV_/,
    );
});
test("TLS failure prevents any Prisma authentication/query", async () => {
  await assert.rejects(
    validateDevelopmentConnection(
      { content: profile() },
      {
        probeTls: async () => {
          throw new Error("DEV_TLS_HANDSHAKE_FAILED");
        },
        createClient: () => assert.fail("Prisma must not be instantiated"),
      },
    ),
    /DEV_TLS_HANDSHAKE_FAILED/,
  );
  await assert.rejects(
    validateDevelopmentConnection(
      { content: profile() },
      {
        probeTls: async () => ({ ...evidence, authorized: false }),
        createClient: () => assert.fail("Prisma must not be instantiated"),
      },
    ),
    /DEV_CLIENT_TLS_NOT_VERIFIED/,
  );
});
test("authenticated diagnosis is transaction read-only, uses explicit dev URL and always disconnects", async () => {
  let disconnected = 0;
  const queries = [];
  const client = {
    $transaction: async (run) =>
      run({
        $executeRawUnsafe: async (sql) => {
          queries.push(sql);
        },
        $queryRawUnsafe: async (sql) => {
          queries.push(sql);
          return rows;
        },
      }),
    $disconnect: async () => {
      disconnected++;
    },
  };
  const result = await validateDevelopmentConnection(
    { content: profile() },
    {
      probeTls: async (hostname, port) => {
        assert.equal(hostname, host);
        assert.equal(port, 5432);
        return evidence;
      },
      createClient: (datasourceUrl) => {
        assert.equal(datasourceUrl, url);
        return client;
      },
    },
  );
  assert.equal(result.valid, true);
  assert.equal(result.backendSsl, false);
  assert.equal(result.checkoutMode, "OFF");
  assert.equal(queries[0], "SET TRANSACTION READ ONLY");
  assert.ok(queries[1].startsWith("SELECT current_database()"));
  assert.equal(queries.length, 2);
  assert.equal(disconnected, 1);
  assert.ok(!JSON.stringify(result).includes("fixture:fixture"));
  await assert.rejects(
    validateDevelopmentConnection(
      { content: profile() },
      {
        probeTls: async () => evidence,
        createClient: () => ({
          ...client,
          $transaction: async () => {
            throw new Error("fixture failure");
          },
        }),
      },
    ),
  );
  assert.equal(disconnected, 2);
});
