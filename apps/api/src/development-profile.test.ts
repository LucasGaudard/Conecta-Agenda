import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadIsolatedDevelopmentEnvironment,
  resolveDevelopmentProfile,
} from "../development-profile.cjs";

const host = "ep-fixture-dev-123.us-east-2.aws.neon.tech";
const database = "neondb";
const url = `postgresql://fixture:fixture@${host}/${database}?sslmode=require`;
const jwt = "fixture-only-development-key-never-used-in-a-server";
function profile(overrides: Record<string, string> = {}) {
  return Object.entries({
    DATABASE_URL: url,
    DEV_DATABASE_HOST: host,
    DEV_DATABASE_NAME: database,
    JWT_SECRET: jwt,
    ...overrides,
  })
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");
}

test("perfil dev aceita somente destino confirmado e define URLs locais/checkout OFF", () => {
  const config = resolveDevelopmentProfile(profile());
  assert.equal(config.DATABASE_URL, url);
  assert.equal(config.NODE_ENV, "development");
  assert.equal(config.FRONTEND_URL, "http://localhost:3001");
  assert.equal(config.API_PORT, "3333");
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.BILLING_CHECKOUT_MODE, "OFF");
});
test("endpoint dev direto e pooled identificam o mesmo destino permitido", () => {
  const pooled = host.replace("ep-fixture-dev-123.", "ep-fixture-dev-123-pooler.");
  assert.equal(
    resolveDevelopmentProfile(profile({ DATABASE_URL: url.replace(host, pooled) }))
      .DEV_DATABASE_HOST,
    host,
  );
  assert.equal(
    resolveDevelopmentProfile(profile({ DEV_DATABASE_HOST: pooled })).DATABASE_URL,
    url,
  );
});
test("produção é recusada tanto direta como pooled, mesmo declarada como host dev", () => {
  for (const production of ["ep-rough-pine-ai569xud", "ep-rough-pine-ai569xud-pooler"]) {
    const productionHost = `${production}.us-east-2.aws.neon.tech`;
    const productionUrl = url.replace(host, productionHost);
    assert.throws(
      () => resolveDevelopmentProfile(profile({ DATABASE_URL: productionUrl })),
      /DEV_PRODUCTION_DATABASE_REFUSED/,
    );
    assert.throws(
      () =>
        resolveDevelopmentProfile(
          profile({ DATABASE_URL: productionUrl, DEV_DATABASE_HOST: productionHost }),
        ),
      /DEV_PRODUCTION_DATABASE_REFUSED/,
    );
  }
});
test("host, database, protocolo e SSL divergentes são recusados", () => {
  const refused: Array<Record<string, string>> = [
    { DATABASE_URL: url.replace(host, "ep-other-123.us-east-2.aws.neon.tech") },
    { DATABASE_URL: url.replace("/neondb?", "/production?") },
    { DATABASE_URL: url.replace("postgresql:", "https:") },
    { DATABASE_URL: url.replace("sslmode=require", "sslmode=disable") },
    { DATABASE_URL: "" },
    { DEV_DATABASE_HOST: "" },
    { DEV_DATABASE_NAME: "" },
    { DEV_DATABASE_HOST: "neon.tech.attacker.invalid" },
  ];
  for (const changes of refused)
    assert.throws(() => resolveDevelopmentProfile(profile(changes)), /DEV_/);
});
test("parâmetros não podem mudar host, database, schema ou desativar SSL", () => {
  for (const suffix of [
    "&host=production",
    "&dbname=production",
    "&sslmode=disable",
    "&sslaccept=accept_invalid_certs",
    "&schema=other",
    "#secret",
  ]) {
    assert.throws(
      () => resolveDevelopmentProfile(profile({ DATABASE_URL: url + suffix })),
      /DEV_/,
    );
  }
  assert.doesNotThrow(() =>
    resolveDevelopmentProfile(
      profile({ DATABASE_URL: url + "&connection_limit=3&channel_binding=require" }),
    ),
  );
});
test("configuração herdada de outro ambiente nunca substitui nem completa o perfil", () => {
  for (const inherited of [
    { DATABASE_URL: "postgresql://production:secret@production.invalid/neondb" },
    { JWT_SECRET: "inherited-production-secret" },
    { FRONTEND_URL: "https://production.invalid" },
    { NODE_ENV: "production" },
  ]) {
    assert.throws(
      () => resolveDevelopmentProfile(profile(), inherited),
      /DEV_INHERITED_CONFIGURATION_CONFLICT/,
    );
  }
  assert.throws(
    () => resolveDevelopmentProfile(profile({ DATABASE_URL: "" }), { DATABASE_URL: url }),
    /DEV_/,
  );
  assert.doesNotThrow(() =>
    resolveDevelopmentProfile(profile(), { NODE_ENV: "development" }),
  );
});
test("credenciais MP, modo simulado e URLs diferentes são recusados no perfil", () => {
  const refusedConfigurations: Array<Record<string, string>> = [
    { BILLING_CHECKOUT_MODE: "SIMULATED" },
    { MERCADO_PAGO_TEST_ACCESS_TOKEN: "fixture" },
    { FRONTEND_URL: "http://localhost:3000" },
    { HOST: "0.0.0.0" },
    { API_PORT: "4444" },
    { JWT_SECRET: "short" },
  ];
  for (const changes of refusedConfigurations) {
    assert.throws(() => resolveDevelopmentProfile(profile(changes)), /DEV_/);
  }
  assert.throws(
    () => resolveDevelopmentProfile(profile(), { MERCADO_PAGO_ACCESS_TOKEN: "fixture" }),
    /DEV_PAYMENT_CONFIGURATION_REFUSED/,
  );
});
test("carregamento lê somente o arquivo dev e falha fechado sem fallback", () => {
  const reads: string[] = [];
  const target: NodeJS.ProcessEnv = {};
  loadIsolatedDevelopmentEnvironment(target, (file) => {
    reads.push(file);
    return profile();
  });
  assert.equal(reads.length, 1);
  assert.ok(reads[0]?.endsWith(".env.development.local"));
  assert.equal(target.DATABASE_URL, url);
  const missing: NodeJS.ProcessEnv = {};
  assert.throws(
    () =>
      loadIsolatedDevelopmentEnvironment(missing, () => {
        throw new Error("SECRET ORIGINAL ERROR");
      }),
    /^Error: DEV_PROFILE_MISSING$/,
  );
  assert.deepEqual(missing, {});
  const invalid: NodeJS.ProcessEnv = {};
  assert.throws(
    () =>
      loadIsolatedDevelopmentEnvironment(invalid, () =>
        profile({ DATABASE_URL: "invalid-with-secret" }),
      ),
    /DEV_DATABASE_URL_REQUIRED/,
  );
  assert.deepEqual(invalid, {});
});
