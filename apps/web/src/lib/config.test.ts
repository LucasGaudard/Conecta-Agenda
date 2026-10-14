import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDevelopmentWebUrl } from "./config";
import { resolveWebDevelopmentProfile } from "../../scripts/dev.cjs";

test("URLs de desenvolvimento permitem somente API 3333 e frontend 3001", () => {
  for (const expected of ["http://localhost:3001", "http://localhost:3333"]) {
    assert.doesNotThrow(() => validateDevelopmentWebUrl(expected, expected, "FIXTURE"));
    assert.doesNotThrow(() =>
      validateDevelopmentWebUrl(expected + "/", expected, "FIXTURE"),
    );
    for (const value of [
      "https://production.invalid",
      "http://localhost:3000",
      expected + "/redirect",
      expected + "?token=secret",
      expected.replace("localhost", "user:secret@localhost"),
      expected.replace("localhost", "localhost.attacker.invalid"),
    ]) {
      assert.throws(
        () => validateDevelopmentWebUrl(value, expected, "FIXTURE"),
        /FIXTURE/,
      );
    }
  }
});

const profile =
  "NEXT_PUBLIC_API_URL=http://localhost:3333\nNEXT_PUBLIC_APP_URL=http://localhost:3001\n";
test("launcher web fixa URLs antes de Next ler outros arquivos", () => {
  assert.deepEqual(resolveWebDevelopmentProfile(profile), {
    NEXT_PUBLIC_API_URL: "http://localhost:3333",
    NEXT_PUBLIC_APP_URL: "http://localhost:3001",
    NODE_ENV: "development",
  });
});
test("launcher web recusa perfil incompleto e configurações herdadas de produção", () => {
  assert.throws(() => resolveWebDevelopmentProfile(""), /DEV_WEB_URLS_INVALID/);
  const inheritedConfigurations: Array<Partial<NodeJS.ProcessEnv>> = [
    { NODE_ENV: "production" },
    { NEXT_PUBLIC_API_URL: "https://production.invalid" },
    { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
  ];
  for (const inherited of inheritedConfigurations)
    assert.throws(() => resolveWebDevelopmentProfile(profile, inherited), /DEV_WEB_/);
  assert.throws(
    () =>
      resolveWebDevelopmentProfile(
        profile.replace("http://localhost:3333", "https://production.invalid"),
      ),
    /DEV_WEB_URLS_INVALID/,
  );
});
