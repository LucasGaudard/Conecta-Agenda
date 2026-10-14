/* eslint @typescript-eslint/no-require-imports: "off" -- Native CommonJS diagnostic, no transpiler or server. */
const net = require("node:net");
const tls = require("node:tls");
const { resolveDevelopmentProfile } = require("./development-profile.cjs");

const canonicalHost = (host) => host.toLowerCase().replace(/-pooler(?=\.)/, "");
function refused(code) {
  throw new Error(code);
}

function validateDestination(content, inherited = {}, productionUrl) {
  const config = resolveDevelopmentProfile(content, inherited);
  if (productionUrl) {
    let production;
    try {
      production = new URL(productionUrl);
    } catch {
      refused("DEV_PRODUCTION_REFERENCE_INVALID");
    }
    if (
      canonicalHost(new URL(config.DATABASE_URL).hostname) ===
      canonicalHost(production.hostname)
    )
      refused("DEV_PRODUCTION_DATABASE_REFUSED");
  }
  return config;
}

function probePostgresTls(hostname, port = 5432) {
  // PostgreSQL SSLRequest only: no username, password, StartupMessage or SQL.
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port });
    let secure;
    let settled = false;
    const timer = setTimeout(() => fail("DEV_TLS_TIMEOUT"), 10000);
    function finish(error, evidence) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      secure?.destroy();
      socket.destroy();
      if (error) reject(error);
      else resolve(evidence);
    }
    function fail(code) {
      finish(new Error(code));
    }
    socket.once("error", () => fail("DEV_TLS_CONNECTION_FAILED"));
    socket.once("close", () => {
      if (!settled) fail("DEV_TLS_CONNECTION_CLOSED");
    });
    socket.once("connect", () => {
      const request = Buffer.alloc(8);
      request.writeInt32BE(8, 0);
      request.writeInt32BE(80877103, 4);
      socket.write(request);
    });
    socket.once("data", (response) => {
      // Refuse extra bytes (PostgreSQL SSL negotiation buffer-stuffing protection).
      if (response.length !== 1) return fail("DEV_TLS_NEGOTIATION_INVALID");
      if (response[0] !== 83) return fail("DEV_TLS_NOT_SUPPORTED");
      secure = tls.connect({
        socket,
        servername: hostname,
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        checkServerIdentity: tls.checkServerIdentity,
      });
      secure.once("error", () => fail("DEV_TLS_HANDSHAKE_FAILED"));
      secure.once("secureConnect", () => {
        if (!secure.authorized || !secure.encrypted)
          return fail("DEV_TLS_CERTIFICATE_REFUSED");
        finish(null, {
          hostname,
          authorized: true,
          encrypted: true,
          protocol: secure.getProtocol(),
        });
      });
    });
  });
}

function evaluateConnectionIdentity(config, rows, evidence) {
  const url = new URL(config.DATABASE_URL);
  if (
    !evidence ||
    evidence.hostname !== url.hostname ||
    evidence.authorized !== true ||
    evidence.encrypted !== true ||
    !["TLSv1.2", "TLSv1.3"].includes(evidence.protocol)
  )
    refused("DEV_CLIENT_TLS_NOT_VERIFIED");
  if (!Array.isArray(rows) || rows.length !== 1) refused("DEV_CONNECTION_ROWS_INVALID");
  if (rows[0].database !== config.DEV_DATABASE_NAME)
    refused("DEV_CONNECTED_DATABASE_MISMATCH");
  if (rows[0].schema !== "public") refused("DEV_CONNECTED_SCHEMA_MISMATCH");
  // pg_stat_ssl describes the PostgreSQL backend hop, not client -> Neon proxy/pooler.
  // It is diagnostic only; verified edge TLS + mandatory sslmode + authenticated query are required.
  return {
    valid: true,
    host: url.hostname,
    database: rows[0].database,
    schema: rows[0].schema,
    pooled: url.hostname.split(".")[0].endsWith("-pooler"),
    clientTlsVerified: true,
    tlsProtocol: evidence.protocol,
    backendSsl:
      rows[0].backend_ssl === true ? true : rows[0].backend_ssl === false ? false : null,
    sslmodeRequired: true,
    checkoutMode: config.BILLING_CHECKOUT_MODE,
    projectDisplayName: "not_available_from_postgresql_identity_query",
  };
}

async function validateDevelopmentConnection(options, dependencies = {}) {
  // All destination/production checks happen before a socket or Prisma client exists.
  const config = validateDestination(
    options.content,
    options.inherited,
    options.productionUrl,
  );
  const url = new URL(config.DATABASE_URL);
  const evidence = await (dependencies.probeTls ?? probePostgresTls)(
    url.hostname,
    Number(url.port || 5432),
  );
  // Check evidence before attempting database authentication.
  evaluateConnectionIdentity(
    config,
    [{ database: config.DEV_DATABASE_NAME, schema: "public" }],
    evidence,
  );
  const createClient =
    dependencies.createClient ??
    ((datasourceUrl) => {
      const { PrismaClient } = require("@prisma/client");
      return new PrismaClient({ datasourceUrl, log: [] });
    });
  const client = createClient(config.DATABASE_URL);
  try {
    const rows = await client.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return tx.$queryRawUnsafe(
          "SELECT current_database() AS database, current_schema() AS schema, (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS backend_ssl",
        );
      },
      { maxWait: 10000, timeout: 15000 },
    );
    return evaluateConnectionIdentity(config, rows, evidence);
  } finally {
    await client.$disconnect();
  }
}

module.exports = {
  validateDestination,
  evaluateConnectionIdentity,
  validateDevelopmentConnection,
};
