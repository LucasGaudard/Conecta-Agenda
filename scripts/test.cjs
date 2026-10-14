/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS launcher without a runtime transpiler. */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

// Test workers never inherit production billing or database credentials.
const environment = { ...process.env };
for (const key of Object.keys(environment)) {
  if (key.startsWith("MERCADO_PAGO_") || key.startsWith("SUPER_ADMIN_"))
    delete environment[key];
}
Object.assign(environment, {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  JWT_SECRET: "fixture-unit-tests-only-not-an-application-secret",
  FRONTEND_URL: "http://localhost:3001",
  PAYMENT_GRACE_PERIOD_DAYS: "3",
  BILLING_CHECKOUT_MODE: "OFF",
});
const cli = path.join(path.dirname(require.resolve("tsx/package.json")), "dist/cli.mjs");
const result = spawnSync(process.execPath, [cli, "--test", ...process.argv.slice(2)], {
  env: environment,
  stdio: "inherit",
});
if (result.error) console.error("UNIT_TEST_START_FAILED");
process.exitCode = result.status ?? 1;
