/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS keeps launchers independent of transpilers/watchers. */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");

function resolveWebDevelopmentProfile(content, inherited = {}) {
  if (inherited.NODE_ENV !== undefined && inherited.NODE_ENV !== "development")
    throw new Error("DEV_WEB_ENVIRONMENT_REQUIRED");
  let parsed;
  try {
    parsed = parseEnv(content);
  } catch {
    throw new Error("DEV_WEB_PROFILE_INVALID");
  }
  const config = {
    NEXT_PUBLIC_API_URL: "http://localhost:3333",
    NEXT_PUBLIC_APP_URL: "http://localhost:3001",
  };
  for (const [key, expected] of Object.entries(config)) {
    if (
      parsed[key]?.trim().replace(/\/+$/, "") !== expected ||
      (inherited[key] !== undefined &&
        inherited[key].trim().replace(/\/+$/, "") !== expected)
    )
      throw new Error("DEV_WEB_URLS_INVALID");
  }
  return { ...config, NODE_ENV: "development" };
}

function getNextDevelopmentArgs(light = false) {
  return [
    "dev",
    ...(light ? ["--webpack"] : []),
    "--port",
    "3001",
    "--hostname",
    "127.0.0.1",
  ];
}

module.exports = { resolveWebDevelopmentProfile, getNextDevelopmentArgs };

if (require.main === module) {
  try {
    const content = readFileSync(
      path.join(__dirname, "../.env.development.local"),
      "utf8",
    );
    Object.assign(process.env, resolveWebDevelopmentProfile(content, process.env));
    const light = process.argv.includes("--light");
    // Keep this private switch scoped to this validated development launcher.
    process.env.CONECTA_WEB_DEV_LIGHT = light ? "1" : "0";
    const next = require.resolve("next/dist/bin/next");
    process.argv = [process.execPath, next, ...getNextDevelopmentArgs(light)];
    require(next);
  } catch (error) {
    const code =
      error instanceof Error && /^DEV_WEB_[A-Z_]+$/.test(error.message)
        ? error.message
        : "DEV_WEB_START_FAILED";
    console.error(
      `Inicialização recusada (${code}). Confira apps/web/.env.development.local.`,
    );
    process.exitCode = 1;
  }
}
