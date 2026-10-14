/* eslint @typescript-eslint/no-require-imports: "off" -- Guarded native development database tooling. */
const { readFileSync, readdirSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { parseEnv, stripVTControlCharacters } = require("node:util");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  validateDestination,
  validateDevelopmentConnection,
} = require("../apps/api/development-connection.cjs");

const root = path.join(__dirname, "..");
function readContext(inherited = process.env) {
  const content = readFileSync(
    path.join(root, "apps/api/.env.development.local"),
    "utf8",
  );
  // Production is only an exclusion reference, never a Prisma datasource.
  const productionUrl = parseEnv(
    readFileSync(path.join(root, ".env"), "utf8"),
  ).DATABASE_URL;
  if (!productionUrl) throw new Error("DEV_PRODUCTION_REFERENCE_REQUIRED");
  const config = validateDestination(content, inherited, productionUrl);
  return { content, productionUrl, config };
}
function assertUnchanged(previous, current) {
  if (
    previous.content !== current.content ||
    previous.productionUrl !== current.productionUrl
  )
    throw new Error("DEV_PROFILE_CHANGED_OPERATION_REFUSED");
}
async function revalidate(context) {
  const current = readContext();
  assertUnchanged(context, current);
  // Install only the already-validated profile BEFORE Prisma construction.
  // Prisma may load root .env for absent process variables even with datasourceUrl.
  // Existing conflicting terminal variables have already been refused by readContext.
  Object.assign(process.env, current.config);
  const result = await validateDevelopmentConnection({
    ...current,
    inherited: process.env,
  });
  // The validator is awaited immediately before the caller starts its write operation.
  assertUnchanged(context, readContext());
  return result;
}
function migrations() {
  const directory = path.join(root, "prisma/migrations");
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      checksum: createHash("sha256")
        .update(readFileSync(path.join(directory, entry.name, "migration.sql")))
        .digest("hex"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function analyzeHistory(local, rows) {
  const applied = new Set();
  for (const row of rows) {
    const migration = local.find((item) => item.name === row.migration_name);
    if (!migration || migration.checksum !== row.checksum)
      throw new Error("DEV_MIGRATION_DIVERGENCE_REFUSED");
    if (!row.finished_at && !row.rolled_back_at)
      throw new Error("DEV_FAILED_MIGRATION_REFUSED");
    if (row.finished_at && !row.rolled_back_at) {
      if (applied.has(row.migration_name))
        throw new Error("DEV_MIGRATION_DIVERGENCE_REFUSED");
      applied.add(row.migration_name);
    }
  }
  let pendingSeen = false;
  for (const migration of local) {
    if (!applied.has(migration.name)) pendingSeen = true;
    else if (pendingSeen) throw new Error("DEV_MIGRATION_ORDER_REFUSED");
  }
  return {
    applied: local.filter((item) => applied.has(item.name)).map((item) => item.name),
    pending: local.filter((item) => !applied.has(item.name)).map((item) => item.name),
    failed: 0,
  };
}
async function history(client, local) {
  const rows = await client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const tables = await tx.$queryRawUnsafe(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
      );
      if (!tables.some((table) => table.tablename === "_prisma_migrations")) {
        if (tables.length) throw new Error("DEV_UNBASELINED_DATABASE_REFUSED");
        return [];
      }
      return tx.$queryRawUnsafe(
        'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at',
      );
    },
    { maxWait: 10000, timeout: 15000 },
  );
  return analyzeHistory(local, rows);
}
function isPendingStatus(result) {
  const output = stripVTControlCharacters(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  return (
    result.status === 1 &&
    /^Following migration(?:s|\(s\)) have not yet been applied:\s*$/im.test(output) &&
    !/\bP\d{4}\b|^Error:/im.test(output)
  );
}
function runPrisma(context, operation) {
  if (!["status", "deploy"].includes(operation)) throw new Error("DEV_COMMAND_REFUSED");
  assertUnchanged(context, readContext());
  const cli = path.join(
    path.dirname(require.resolve("prisma/package.json")),
    "build/index.js",
  );
  const result = spawnSync(
    process.execPath,
    [cli, "migrate", operation, "--schema", "prisma/schema.prisma"],
    {
      cwd: root,
      env: { ...process.env, ...context.config },
      encoding: "utf8",
      timeout: 180000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  // Never forward raw CLI output: it can contain connection details or server errors.
  if (result.error) throw new Error("DEV_PRISMA_COMMAND_FAILED");
  if (operation === "deploy" && result.status !== 0)
    throw new Error("DEV_MIGRATE_DEPLOY_FAILED_NO_RETRY");
  if (operation === "status" && result.status !== 0 && !isPendingStatus(result))
    throw new Error("DEV_MIGRATE_STATUS_FAILED");
  return { operation, exitCode: result.status };
}
function safeError(error) {
  return /^DEV_[A-Z_]+$/.test(error?.message)
    ? error.message
    : /^P\d{4}$/.test(error?.code)
      ? error.code
      : "DEV_OPERATION_FAILED";
}
async function main() {
  const context = readContext();
  console.log(JSON.stringify({ validation: await revalidate(context) }));
  Object.assign(process.env, context.config);
  const { PrismaClient } = require("@prisma/client");
  const client = new PrismaClient({
    datasourceUrl: context.config.DATABASE_URL,
    log: [],
  });
  try {
    const local = migrations();
    const before = await history(client, local);
    console.log(JSON.stringify({ before, status: runPrisma(context, "status") }));
    if (process.argv[2] === "--apply" && before.pending.length) {
      await client.$disconnect();
      console.log(
        JSON.stringify({ beforeMigrationValidation: await revalidate(context) }),
      );
      console.log(JSON.stringify({ deploy: runPrisma(context, "deploy") }));
      const after = await history(client, local);
      if (after.pending.length) throw new Error("DEV_MIGRATIONS_STILL_PENDING");
      console.log(JSON.stringify({ after, status: runPrisma(context, "status") }));
    } else if (process.argv[2] && process.argv[2] !== "--apply") {
      throw new Error("DEV_COMMAND_REFUSED");
    }
  } finally {
    await client.$disconnect();
  }
}
module.exports = {
  readContext,
  assertUnchanged,
  revalidate,
  migrations,
  analyzeHistory,
  history,
  safeError,
  isPendingStatus,
};
if (require.main === module)
  void main().catch((error) => {
    console.error(safeError(error));
    process.exitCode = 1;
  });
