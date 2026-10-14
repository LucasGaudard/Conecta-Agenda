/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS read-only diagnostic. */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const {
  validateDevelopmentConnection,
} = require("../apps/api/development-connection.cjs");

async function main() {
  const root = path.join(__dirname, "..");
  const content = readFileSync(
    path.join(root, "apps/api/.env.development.local"),
    "utf8",
  );
  const productionUrl = parseEnv(
    readFileSync(path.join(root, ".env"), "utf8"),
  ).DATABASE_URL;
  if (!productionUrl) throw new Error("DEV_PRODUCTION_REFERENCE_REQUIRED");
  const result = await validateDevelopmentConnection({
    content,
    inherited: process.env,
    productionUrl,
  });
  // Only allowlisted technical metadata; never print config, errors or connection strings.
  console.log(JSON.stringify(result));
}
void main().catch((error) => {
  const code = /^DEV_[A-Z_]+$/.test(error?.message)
    ? error.message
    : /^P\d{4}$/.test(error?.code)
      ? error.code
      : "DEV_CONNECTION_VALIDATION_FAILED";
  console.error(code);
  process.exitCode = 1;
});
