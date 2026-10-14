/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS keeps launchers independent of transpilers/watchers. */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { loadIsolatedDevelopmentEnvironment } = require("../development-profile.cjs");

try {
  // Validate before compiling or importing Prisma/application modules.
  loadIsolatedDevelopmentEnvironment();
  execFileSync(
    process.execPath,
    [
      require.resolve("typescript/bin/tsc"),
      "-p",
      path.join(__dirname, "../tsconfig.json"),
    ],
    {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit",
    },
  );
  // One API instance, no watcher, fresh compiled code on each explicit start.
  require("../dist/server.js");
} catch (error) {
  const code =
    error instanceof Error && /^DEV_[A-Z_]+$/.test(error.message)
      ? error.message
      : "DEV_START_FAILED";
  console.error(
    `Inicialização recusada (${code}). Confira apps/api/.env.development.local; nenhuma credencial é exibida.`,
  );
  process.exitCode = 1;
}
