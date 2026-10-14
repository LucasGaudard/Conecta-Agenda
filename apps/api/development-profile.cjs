/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS keeps launchers independent of transpilers/watchers. */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

const PROFILE_FILE = path.join(__dirname, ".env.development.local");
const PRODUCTION_ENDPOINT = "ep-rough-pine-ai569xud";
const FRONTEND_URL = "http://localhost:3001";
const fields = [
  "DATABASE_URL",
  "DEV_DATABASE_HOST",
  "DEV_DATABASE_NAME",
  "JWT_SECRET",
  "NODE_ENV",
  "FRONTEND_URL",
  "HOST",
  "API_PORT",
  "BILLING_CHECKOUT_MODE",
  "PAYMENT_GRACE_PERIOD_DAYS",
  "PASSWORD_RESET_TOKEN_TTL_MINUTES",
];

function refused(code) {
  // Never include connection strings, secrets or original parser errors.
  throw new Error(code);
}
function endpoint(host) {
  return host
    .toLowerCase()
    .split(".")[0]
    .replace(/-pooler$/, "");
}
function canonicalHost(host) {
  return host.toLowerCase().replace(/-pooler(?=\.)/, "");
}

function resolveDevelopmentProfile(content, inherited = {}) {
  let parsed;
  try {
    parsed = parseEnv(content);
  } catch {
    refused("DEV_PROFILE_INVALID");
  }
  const config = Object.fromEntries(fields.map((key) => [key, parsed[key]?.trim()]));
  config.NODE_ENV ??= "development";
  config.FRONTEND_URL ??= FRONTEND_URL;
  config.HOST ??= "127.0.0.1";
  config.API_PORT ??= "3333";
  config.BILLING_CHECKOUT_MODE ??= "OFF";
  config.PAYMENT_GRACE_PERIOD_DAYS ??= "3";
  config.PASSWORD_RESET_TOKEN_TTL_MINUTES ??= "30";

  if (config.NODE_ENV !== "development") refused("DEV_ENVIRONMENT_REQUIRED");
  if (config.BILLING_CHECKOUT_MODE !== "OFF") refused("DEV_CHECKOUT_MUST_BE_OFF");
  if (
    config.FRONTEND_URL !== FRONTEND_URL ||
    config.HOST !== "127.0.0.1" ||
    config.API_PORT !== "3333"
  )
    refused("DEV_LOCAL_URLS_INVALID");

  for (const source of [parsed, inherited]) {
    if (
      Object.entries(source).some(
        ([key, value]) => key.startsWith("MERCADO_PAGO_") && value?.trim(),
      )
    )
      refused("DEV_PAYMENT_CONFIGURATION_REFUSED");
  }
  for (const key of fields) {
    if (inherited[key] !== undefined && inherited[key] !== config[key])
      refused("DEV_INHERITED_CONFIGURATION_CONFLICT");
  }
  if (
    !config.JWT_SECRET ||
    config.JWT_SECRET.length < 32 ||
    /\s/.test(config.JWT_SECRET) ||
    config.JWT_SECRET.startsWith("change-me")
  )
    refused("DEV_JWT_SECRET_REQUIRED");
  if (
    !config.DEV_DATABASE_HOST ||
    !/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/i.test(config.DEV_DATABASE_HOST)
  )
    refused("DEV_NEON_HOST_REQUIRED");
  if (endpoint(config.DEV_DATABASE_HOST) === PRODUCTION_ENDPOINT)
    refused("DEV_PRODUCTION_DATABASE_REFUSED");
  if (
    !config.DEV_DATABASE_NAME ||
    !/^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$/.test(config.DEV_DATABASE_NAME)
  )
    refused("DEV_DATABASE_NAME_REQUIRED");

  let url;
  try {
    url = new URL(config.DATABASE_URL);
  } catch {
    refused("DEV_DATABASE_URL_REQUIRED");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    refused("DEV_DATABASE_URL_INVALID");
  if (endpoint(url.hostname) === PRODUCTION_ENDPOINT)
    refused("DEV_PRODUCTION_DATABASE_REFUSED");
  if (canonicalHost(url.hostname) !== canonicalHost(config.DEV_DATABASE_HOST))
    refused("DEV_DATABASE_HOST_MISMATCH");
  if (!url.username || !url.password || url.hash || (url.port && url.port !== "5432"))
    refused("DEV_DATABASE_URL_INVALID");
  let database;
  try {
    database = decodeURIComponent(url.pathname);
  } catch {
    refused("DEV_DATABASE_URL_INVALID");
  }
  if (database !== `/${config.DEV_DATABASE_NAME}`) refused("DEV_DATABASE_NAME_MISMATCH");
  if (url.searchParams.get("sslmode") !== "require") refused("DEV_DATABASE_SSL_REQUIRED");
  const allowedParameters = new Set([
    "sslmode",
    "schema",
    "connect_timeout",
    "pool_timeout",
    "connection_limit",
    "pgbouncer",
    "channel_binding",
  ]);
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (!allowedParameters.has(key) || seen.has(key))
      refused("DEV_DATABASE_PARAMETERS_REFUSED");
    seen.add(key);
    if (key === "schema" && value !== "public")
      refused("DEV_DATABASE_PARAMETERS_REFUSED");
    if (
      ["connect_timeout", "pool_timeout", "connection_limit"].includes(key) &&
      !/^[1-9]\d*$/.test(value)
    )
      refused("DEV_DATABASE_PARAMETERS_REFUSED");
    if (key === "pgbouncer" && !["true", "false"].includes(value))
      refused("DEV_DATABASE_PARAMETERS_REFUSED");
    if (key === "channel_binding" && value !== "require")
      refused("DEV_DATABASE_PARAMETERS_REFUSED");
  }
  return config;
}

function loadIsolatedDevelopmentEnvironment(
  target = process.env,
  read = (file) => readFileSync(file, "utf8"),
) {
  let content;
  try {
    content = read(PROFILE_FILE);
  } catch {
    refused("DEV_PROFILE_MISSING");
  }
  const config = resolveDevelopmentProfile(content, target);
  Object.assign(target, config);
}

module.exports = { resolveDevelopmentProfile, loadIsolatedDevelopmentEnvironment };
