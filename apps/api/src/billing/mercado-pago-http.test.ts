import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { getMercadoPagoTestConfig, type MercadoPagoTestConfig } from "./config";
import {
  MercadoPagoTestHttpClient,
  type SimulatedHttpTransport,
  type PlanSubscriptionRequest,
} from "./mercado-pago-http";

const source = {
  MERCADO_PAGO_ENVIRONMENT: "TEST",
  MERCADO_PAGO_TEST_ACCESS_TOKEN: "fixture-token-only",
  MERCADO_PAGO_TEST_APPLICATION_ID: "123",
  MERCADO_PAGO_TEST_COLLECTOR_ID: "456",
  MERCADO_PAGO_TEST_BACK_URL: "https://example.invalid/settings/billing",
  MERCADO_PAGO_TEST_TIMEOUT_MS: "1000",
};
const config = getMercadoPagoTestConfig(source)!;
const request: PlanSubscriptionRequest = {
  preapproval_plan_id: "mapped-plan",
  external_reference: "attempt-reference",
  payer_email: "buyer@example.invalid",
  card_token_id: "test-card-token",
  back_url: config.backUrl,
  status: "authorized",
};
const key = "fixture-idempotency-key";
const reference = {
  id: "provider-subscription",
  planId: "mapped-plan",
  externalReference: "attempt-reference",
};
const subscription = (status = "authorized") => ({
  id: reference.id,
  preapproval_plan_id: reference.planId,
  external_reference: reference.externalReference,
  application_id: 123,
  collector_id: 456,
  status,
  init_point:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=provider-subscription",
  next_payment_date: "2026-10-19T15:00:00Z",
});
const response = (body: unknown, status = 200) => ({ status, json: async () => body });
const make = (send: SimulatedHttpTransport["send"], settings = config) =>
  new MercadoPagoTestHttpClient(settings, { mode: "SIMULATED", send });

test("test credentials are selected as one scope, never from generic or production settings", () => {
  const mixed = {
    ...source,
    MERCADO_PAGO_ACCESS_TOKEN: "legacy-fixture",
    MERCADO_PAGO_PRODUCTION_ACCESS_TOKEN: "production-fixture",
    MERCADO_PAGO_PRODUCTION_COLLECTOR_ID: "999",
  };
  assert.equal(
    getMercadoPagoTestConfig(mixed)?.accessToken,
    source.MERCADO_PAGO_TEST_ACCESS_TOKEN,
  );
  assert.equal(getMercadoPagoTestConfig(mixed)?.collectorId, "456");
  assert.equal(
    getMercadoPagoTestConfig({ ...mixed, MERCADO_PAGO_TEST_ACCESS_TOKEN: "" }),
    null,
  );
  assert.equal(
    getMercadoPagoTestConfig({ ...source, MERCADO_PAGO_ENVIRONMENT: "PRODUCTION" }),
    null,
  );
  assert.equal(
    getMercadoPagoTestConfig({ ...source, MERCADO_PAGO_TEST_COLLECTOR_ID: "" }),
    null,
  );
  assert.equal(
    getMercadoPagoTestConfig({
      ...source,
      MERCADO_PAGO_TEST_BACK_URL: "http://localhost/return",
    }),
    null,
  );
  assert.equal(
    getMercadoPagoTestConfig({ ...source, MERCADO_PAGO_TEST_TIMEOUT_MS: "NaN" }),
    null,
  );
  // A prefix cannot establish the account's environment; some test products use APP_USR.
  assert.ok(
    getMercadoPagoTestConfig({
      ...source,
      MERCADO_PAGO_TEST_ACCESS_TOKEN: "APP_USR-fixture-only",
    }),
  );
});

test("client refuses production/default transports and never falls back to global fetch", async () => {
  const network = mock.method(globalThis, "fetch", async () => {
    throw new Error("Network forbidden");
  });
  try {
    assert.throws(
      () =>
        new MercadoPagoTestHttpClient(
          { ...config, environment: "PRODUCTION" } as unknown as MercadoPagoTestConfig,
          { mode: "SIMULATED", send: async () => response(subscription()) },
        ),
      { code: "MP_TEST_CONFIGURATION_INVALID" },
    );
    assert.throws(
      () =>
        new MercadoPagoTestHttpClient(
          config,
          undefined as unknown as SimulatedHttpTransport,
        ),
      { code: "MP_TEST_CONFIGURATION_INVALID" },
    );
    const client = make(async () => response(subscription()));
    await client.getSubscription(reference);
    assert.deepEqual(JSON.parse(JSON.stringify(client)), {
      environment: "TEST",
      transport: "SIMULATED",
    });
    assert.equal(network.mock.callCount(), 0);
  } finally {
    network.mock.restore();
  }
});

test("typed creation uses a mapped plan, validates identity and never returns paid access", async () => {
  const send = mock.fn<SimulatedHttpTransport["send"]>(async (url, init) => {
    assert.equal(url, "https://api.mercadopago.com/preapproval");
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, `Bearer ${config.accessToken}`);
    assert.deepEqual(JSON.parse(init.body!), request);
    return response(
      {
        ...subscription(),
        accessToken: "must-be-stripped",
        currentPeriodEnd: "must-be-stripped",
      },
      201,
    );
  });
  const result = await make(send).createSubscription(request, key);
  assert.equal(result.status, "authorized");
  assert.ok(!("currentPeriodEnd" in result));
  assert.ok(!("accessToken" in result));
  assert.equal(send.mock.callCount(), 1);
});

test("concurrent and subsequent duplicates issue one POST; changed input cannot reuse its key", async () => {
  const send = mock.fn<SimulatedHttpTransport["send"]>(async () =>
    response(subscription(), 201),
  );
  const client = make(send);
  const [a, b] = await Promise.all([
    client.createSubscription(request, key),
    client.createSubscription({ ...request }, key),
  ]);
  assert.deepEqual(a, b);
  a.status = "paused";
  assert.equal((await client.createSubscription(request, key)).status, "authorized");
  await assert.rejects(
    client.createSubscription({ ...request, external_reference: "other-attempt" }, key),
    { code: "MP_IDEMPOTENCY_CONFLICT" },
  );
  assert.equal(send.mock.callCount(), 1);
});

test("unknown fields, callback changes and path injection are refused before HTTP", async () => {
  const send = mock.fn<SimulatedHttpTransport["send"]>(async () =>
    response(subscription()),
  );
  const client = make(send);
  await assert.rejects(
    client.createSubscription({ ...request, price: 1 } as PlanSubscriptionRequest, key),
    { code: "MP_INVALID_INPUT" },
  );
  await assert.rejects(
    client.createSubscription({ ...request, back_url: "https://other.invalid" }, key),
    { code: "MP_INVALID_INPUT" },
  );
  await assert.rejects(client.getPlan("../payments"), { code: "MP_INVALID_INPUT" });
  assert.equal(send.mock.callCount(), 0);
});

for (const [status, code] of [
  [400, "MP_REQUEST_REJECTED"],
  [401, "MP_AUTH_ERROR"],
  [403, "MP_AUTH_ERROR"],
  [409, "MP_CONFLICT_REQUIRES_RECONCILIATION"],
  [429, "MP_RATE_LIMITED"],
  [500, "MP_UPSTREAM_UNAVAILABLE"],
] as const) {
  test(`HTTP ${status}: safe error, no automatic retry and no raw response leak`, async () => {
    const json = mock.fn(async () => {
      throw new Error(`secret ${config.accessToken}`);
    });
    const send = mock.fn<SimulatedHttpTransport["send"]>(async () => ({ status, json }));
    const client = make(send);
    await assert.rejects(client.createSubscription(request, key), {
      code,
      httpStatus: status,
    });
    await assert.rejects(client.createSubscription(request, key), (error) => {
      assert.ok(!String(error).includes(config.accessToken));
      return true;
    });
    assert.equal(send.mock.callCount(), 1);
    assert.equal(json.mock.callCount(), 0);
  });
}

test("deadline aborts a stalled transport; ambiguous creation is never repeated", async () => {
  let signal: AbortSignal | undefined;
  const send = mock.fn<SimulatedHttpTransport["send"]>(async (_url, init) => {
    signal = init.signal;
    return new Promise(() => {});
  });
  const client = make(send, { ...config, timeoutMs: 10 });
  await assert.rejects(client.createSubscription(request, key), { code: "MP_TIMEOUT" });
  assert.equal(signal?.aborted, true);
  await assert.rejects(client.createSubscription(request, key), { code: "MP_TIMEOUT" });
  assert.equal(send.mock.callCount(), 1);
});

test("deadline also covers the response body; transport exceptions are redacted", async () => {
  await assert.rejects(
    make(async () => ({ status: 200, json: async () => new Promise(() => {}) }), {
      ...config,
      timeoutMs: 10,
    }).getSubscription(reference),
    { code: "MP_TIMEOUT" },
  );
  await assert.rejects(
    make(async () => {
      throw new Error(`private ${config.accessToken} buyer@example.invalid`);
    }).getSubscription(reference),
    (error) => {
      assert.equal(String(error), "MercadoPagoHttpError: MP_NETWORK_ERROR");
      return true;
    },
  );
});

test("invalid JSON, response shape, account, subscription and checkout URL fail closed", async () => {
  await assert.rejects(
    make(async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError();
      },
    })).getSubscription(reference),
    { code: "MP_INVALID_RESPONSE" },
  );
  for (const [body, code] of [
    [{ status: "authorized" }, "MP_INVALID_RESPONSE"],
    [{ ...subscription(), collector_id: 999 }, "MP_ACCOUNT_SCOPE_MISMATCH"],
    [{ ...subscription(), application_id: 999 }, "MP_ACCOUNT_SCOPE_MISMATCH"],
    [
      { ...subscription(), external_reference: "other-tenant" },
      "MP_SUBSCRIPTION_SCOPE_MISMATCH",
    ],
    [{ ...subscription(), id: "other-subscription" }, "MP_SUBSCRIPTION_SCOPE_MISMATCH"],
    [
      {
        ...subscription(),
        init_point:
          "https://www.mercadopago.com.br.attacker.invalid/subscriptions/checkout",
      },
      "MP_INVALID_RESPONSE",
    ],
  ] as const)
    await assert.rejects(make(async () => response(body)).getSubscription(reference), {
      code,
    });
});

test("plan lookup accepts decimal strings and enforces account and resource identity", async () => {
  const plan = {
    id: "mapped-plan",
    application_id: 123,
    collector_id: 456,
    status: "active",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: "49.90",
      currency_id: "BRL",
    },
  };
  assert.equal(
    (await make(async () => response(plan)).getPlan("mapped-plan")).auto_recurring
      .transaction_amount,
    49.9,
  );
  await assert.rejects(
    make(async () => response({ ...plan, id: "other-plan" })).getPlan("mapped-plan"),
    { code: "MP_PLAN_SCOPE_MISMATCH" },
  );
  await assert.rejects(
    make(async () =>
      response({
        ...plan,
        auto_recurring: { ...plan.auto_recurring, transaction_amount: "49.999" },
      }),
    ).getPlan("mapped-plan"),
    { code: "MP_INVALID_RESPONSE" },
  );
});

test("cancellation checks the persisted reference first and is idempotent once cancelled", async () => {
  let cancelled = false;
  const send = mock.fn<SimulatedHttpTransport["send"]>(async (url, init) => {
    assert.equal(url, "https://api.mercadopago.com/preapproval/provider-subscription");
    if (init.method === "PUT") {
      assert.deepEqual(JSON.parse(init.body!), { status: "cancelled" });
      cancelled = true;
    }
    return response(subscription(cancelled ? "cancelled" : "authorized"));
  });
  const client = make(send);
  assert.equal((await client.cancelSubscription(reference)).status, "cancelled");
  await client.cancelSubscription(reference);
  assert.deepEqual(
    send.mock.calls.map((c) => c.arguments[1].method),
    ["GET", "PUT", "GET"],
  );
  const mismatch = mock.fn<SimulatedHttpTransport["send"]>(async () =>
    response({ ...subscription(), external_reference: "other-tenant" }),
  );
  await assert.rejects(make(mismatch).cancelSubscription(reference), {
    code: "MP_SUBSCRIPTION_SCOPE_MISMATCH",
  });
  assert.equal(mismatch.mock.callCount(), 1);
});
