import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { MercadoPagoTestConfig } from "./config";
import type { MercadoPagoPlan } from "./mercado-pago-http";
import {
  prepareTestSubscriptionCreation,
  loadTestSubscriptionReference,
  type BillingPreparationRepository,
} from "./subscription-preparation";

const config: MercadoPagoTestConfig = {
  environment: "TEST",
  accessToken: "fixture-token",
  applicationId: "123",
  collectorId: "456",
  backUrl: "https://example.invalid/return",
  timeoutMs: 1000,
};
const actor = { userId: "owner", businessId: "business" };
const input = {
  subscriptionId: "subscription",
  checkoutAttemptId: "attempt",
  testCardTokenId: "card-fixture",
};
const now = new Date("2026-10-15T15:00:00Z");
function fixture() {
  const subscription = {
    id: "subscription",
    userId: "owner",
    planId: "internal-plan",
    trialEndsAt: new Date("2026-10-19T15:00:00Z"),
    provider: "MERCADO_PAGO",
    providerEnvironment: "TEST",
    providerSubscriptionId: null as string | null,
    externalReference: null as string | null,
    plan: { id: "internal-plan", isActive: true, priceInCents: 4990 },
    user: { email: "buyer@example.invalid", business: { id: "business" } },
  };
  const mapping = {
    planId: "internal-plan",
    isActive: true,
    provider: "MERCADO_PAGO",
    environment: "TEST",
    providerPlanId: "mapped-plan",
  };
  const attempt = {
    subscriptionId: "subscription",
    status: "CREATED",
    provider: "MERCADO_PAGO",
    environment: "TEST",
    providerSubscriptionId: null,
    expiresAt: new Date("2026-10-16T15:00:00Z"),
    externalReference: "attempt-reference",
    idempotencyKey: "fixture-idempotency-key",
  };
  const calls = {
    subscription: mock.fn(async () => subscription),
    mapping: mock.fn(async () => mapping),
    attempt: mock.fn(async () => attempt),
  };
  const repository = {
    subscription: { findFirst: calls.subscription },
    providerPlan: { findUnique: calls.mapping },
    billingCheckoutAttempt: { findFirst: calls.attempt },
  } as unknown as BillingPreparationRepository;
  const remote: MercadoPagoPlan = {
    id: "mapped-plan",
    application_id: "123",
    collector_id: "456",
    status: "active",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 49.9,
      currency_id: "BRL",
      free_trial: { frequency: 7, frequency_type: "days" },
    },
  };
  const client = { getPlan: mock.fn(async () => remote) };
  return { subscription, mapping, attempt, calls, repository, remote, client };
}

test("preparation derives owner, amount, references and environment exclusively from persisted records", async () => {
  const f = fixture();
  const before = structuredClone(f.subscription);
  const result = await prepareTestSubscriptionCreation(
    f.repository,
    f.client,
    config,
    actor,
    input,
    now,
  );
  assert.deepEqual(result.request, {
    preapproval_plan_id: "mapped-plan",
    external_reference: "attempt-reference",
    payer_email: "buyer@example.invalid",
    card_token_id: "card-fixture",
    back_url: config.backUrl,
    status: "authorized",
  });
  assert.equal(result.idempotencyKey, f.attempt.idempotencyKey);
  assert.deepEqual(f.subscription, before);
  assert.equal(result.trial.internalTrialEndsAt, "2026-10-19T15:00:00.000Z");
  assert.equal(result.trial.remainingMilliseconds, 4 * 86400000);
  assert.equal(result.trial.requiresSandboxValidation, true);
  assert.ok(!("auto_recurring" in result.request));
  const subscriptionArgs = f.calls.subscription.mock.calls[0]?.arguments as unknown as [
    { where: unknown; select: { user: { select: object } } },
  ];
  assert.deepEqual(subscriptionArgs[0].where, {
    id: "subscription",
    userId: "owner",
    user: { business: { id: "business" } },
  });
  assert.ok(!("passwordHash" in subscriptionArgs[0].select.user.select));
  const mappingArgs = f.calls.mapping.mock.calls[0]?.arguments as unknown as [
    { where: unknown },
  ];
  assert.deepEqual(mappingArgs[0].where, {
    planId_provider_environment: {
      planId: "internal-plan",
      provider: "MERCADO_PAGO",
      environment: "TEST",
    },
  });
});

test("frontend price, business and external IDs are refused before repository access", async () => {
  for (const extra of [
    { priceInCents: 1 },
    { businessId: "other" },
    { providerPlanId: "other" },
    { externalReference: "other" },
  ]) {
    const f = fixture();
    await assert.rejects(
      prepareTestSubscriptionCreation(
        f.repository,
        f.client,
        config,
        actor,
        { ...input, ...extra },
        now,
      ),
      { code: "MP_INVALID_INPUT" },
    );
    assert.equal(f.calls.subscription.mock.callCount(), 0);
  }
});

test("cross-tenant subscription, production scope and inactive/mismatched mappings fail closed", async () => {
  const other = fixture();
  other.subscription.userId = "other-owner";
  await assert.rejects(
    prepareTestSubscriptionCreation(
      other.repository,
      other.client,
      config,
      actor,
      input,
      now,
    ),
    { code: "MP_TENANT_SCOPE_MISMATCH" },
  );
  assert.equal(other.calls.mapping.mock.callCount(), 0);
  const production = fixture();
  production.subscription.providerEnvironment = "PRODUCTION";
  await assert.rejects(
    prepareTestSubscriptionCreation(
      production.repository,
      production.client,
      config,
      actor,
      input,
      now,
    ),
    { code: "MP_ENVIRONMENT_SCOPE_MISMATCH" },
  );
  for (const changes of [
    { environment: "PRODUCTION" },
    { isActive: false },
    { planId: "other-plan" },
  ]) {
    const f = fixture();
    Object.assign(f.mapping, changes);
    await assert.rejects(
      prepareTestSubscriptionCreation(f.repository, f.client, config, actor, input, now),
      { code: "MP_PLAN_MAPPING_UNAVAILABLE" },
    );
    assert.equal(f.client.getPlan.mock.callCount(), 0);
  }
});

test("checkout attempts cannot be reused across subscriptions/environments or after expiry", async () => {
  for (const changes of [
    { subscriptionId: "other" },
    { environment: "PRODUCTION" },
    { status: "PROVIDER_CREATED" },
    { expiresAt: now },
  ]) {
    const f = fixture();
    Object.assign(f.attempt, changes);
    await assert.rejects(
      prepareTestSubscriptionCreation(f.repository, f.client, config, actor, input, now),
      { code: "MP_CHECKOUT_ATTEMPT_INVALID" },
    );
    assert.equal(f.client.getPlan.mock.callCount(), 0);
  }
});

test("mapped remote plan must match the account, monthly cadence, currency and internal price", async () => {
  for (const change of [
    { transaction_amount: 1 },
    { frequency: 7 },
    { frequency_type: "days" },
    { currency_id: "ARS" },
  ]) {
    const f = fixture();
    Object.assign(f.remote.auto_recurring, change);
    await assert.rejects(
      prepareTestSubscriptionCreation(f.repository, f.client, config, actor, input, now),
      { code: "MP_PLAN_TERMS_MISMATCH" },
    );
  }
  const f = fixture();
  f.remote.collector_id = "999";
  await assert.rejects(
    prepareTestSubscriptionCreation(f.repository, f.client, config, actor, input, now),
    { code: "MP_PLAN_TERMS_MISMATCH" },
  );
});

test("query/cancel references come from the owning subscription, even after its plan is disabled", async () => {
  const f = fixture();
  await assert.rejects(
    loadTestSubscriptionReference(f.repository, actor, input.subscriptionId),
    { code: "MP_SUBSCRIPTION_REFERENCE_UNAVAILABLE" },
  );
  f.subscription.providerSubscriptionId = "persisted-provider-id";
  f.subscription.externalReference = "persisted-reference";
  f.mapping.isActive = false;
  f.subscription.plan.isActive = false;
  assert.deepEqual(
    await loadTestSubscriptionReference(f.repository, actor, input.subscriptionId),
    {
      id: "persisted-provider-id",
      planId: "mapped-plan",
      externalReference: "persisted-reference",
    },
  );
});
