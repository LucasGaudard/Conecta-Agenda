/* eslint @typescript-eslint/no-require-imports: "off" -- Test the native launcher without starting Next. */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getNextDevelopmentArgs, resolveWebDevelopmentProfile } = require("./dev.cjs");

test("light launcher selects Webpack and preserves the isolated development address", () => {
  const args = getNextDevelopmentArgs(true);
  assert.equal(args[0], "dev");
  assert.ok(args.includes("--webpack"));
  assert.equal(args[args.indexOf("--port") + 1], "3001");
  assert.equal(args[args.indexOf("--hostname") + 1], "127.0.0.1");
  assert.ok(!args.some((arg) => arg.includes("max-old-space-size")));
  assert.ok(!getNextDevelopmentArgs().includes("--webpack"));
});

test("light launcher retains production URL and environment safeguards", () => {
  const content =
    "NEXT_PUBLIC_API_URL=http://localhost:3333\nNEXT_PUBLIC_APP_URL=http://localhost:3001\n";
  assert.equal(resolveWebDevelopmentProfile(content).NODE_ENV, "development");
  assert.throws(
    () => resolveWebDevelopmentProfile(content, { NODE_ENV: "production" }),
    /DEV_WEB_ENVIRONMENT_REQUIRED/,
  );
  assert.throws(
    () =>
      resolveWebDevelopmentProfile(content, {
        NEXT_PUBLIC_API_URL: "https://production.invalid",
      }),
    /DEV_WEB_URLS_INVALID/,
  );
});
