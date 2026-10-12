import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadLocalEnv } from "./load-env";

test("local env: shell > API > root; missing files tolerated; production/test isolated", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "conecta-env-test-"));
  try {
    const api = path.join(dir, "api.env"),
      root = path.join(dir, "root.env");
    writeFileSync(api, 'API_PORT=4444\nJWT_SECRET="fixture-only"\n');
    writeFileSync(root, 'API_PORT=3333\nFRONTEND_URL="http://localhost:3000"\n');
    const target: NodeJS.ProcessEnv = { API_PORT: "5555", NODE_ENV: "development" };
    loadLocalEnv(target, [api, root, path.join(dir, "missing")]);
    assert.equal(target.API_PORT, "5555");
    assert.equal(target.JWT_SECRET, "fixture-only");
    assert.equal(target.FRONTEND_URL, "http://localhost:3000");
    const local: NodeJS.ProcessEnv = {};
    loadLocalEnv(local, [api, root]);
    assert.equal(local.API_PORT, "4444");
    for (const NODE_ENV of ["production", "test"]) {
      const isolated = { NODE_ENV };
      loadLocalEnv(isolated, [api, root]);
      assert.deepEqual(isolated, { NODE_ENV });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
