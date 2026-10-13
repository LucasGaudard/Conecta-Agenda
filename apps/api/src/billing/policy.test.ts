import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SubscriptionStatus } from "@prisma/client";

import {
  billingEventDeduplicationKey,
  BUSINESS_TRIAL_DAYS,
  createInitialTrial,
  resolveVerifiedBillingMutation,
} from "./policy";

const now = new Date("2026-10-12T15:00:00.000Z");
const scope = {
  subscriptionId: "subscription-a",
  provider: "MERCADO_PAGO" as const,
  environment: "TEST" as const,
};

test("new businesses receive one bounded seven-day trial", () => {
  const trial = createInitialTrial(now);
  assert.equal(BUSINESS_TRIAL_DAYS, 7);
  assert.equal(trial.status, SubscriptionStatus.TRIALING);
  assert.equal(trial.trialEndsAt.toISOString(), "2026-10-19T15:00:00.000Z");
  assert.equal(trial.currentPeriodStart, null);
  assert.equal(trial.currentPeriodEnd, null);
  for (const route of ["apps/api/src/routes/auth.ts", "apps/api/src/routes/admin.ts"]) {
    assert.match(
      readFileSync(route, "utf8"),
      /createInitialTrial\(business\.createdAt\)/,
    );
  }
});

test("unverified checkout returns and webhooks can never activate a subscription", () => {
  for (const kind of ["UNVERIFIED_CHECKOUT_RETURN", "UNVERIFIED_WEBHOOK"] as const) {
    assert.equal(
      resolveVerifiedBillingMutation(scope, {
        kind,
        verified: false,
        subscriptionId: scope.subscriptionId,
      }),
      null,
    );
  }
});

test("only a verified payment grants a finite paid period", () => {
  const periodEnd = new Date("2026-11-12T15:00:00.000Z");
  const mutation = resolveVerifiedBillingMutation(scope, {
    kind: "PAYMENT_CONFIRMED",
    verified: true,
    subscriptionId: scope.subscriptionId,
    provider: "MERCADO_PAGO",
    environment: "TEST",
    periodStart: now,
    periodEnd,
    providerStatus: "approved",
    nextPaymentAt: periodEnd,
    synchronizedAt: now,
  });
  assert.equal(mutation?.status, SubscriptionStatus.ACTIVE);
  assert.equal(mutation?.currentPeriodEnd, periodEnd);
  assert.throws(
    () =>
      resolveVerifiedBillingMutation(scope, {
        kind: "PAYMENT_CONFIRMED",
        verified: true,
        subscriptionId: scope.subscriptionId,
        provider: "MERCADO_PAGO",
        environment: "TEST",
        periodStart: periodEnd,
        periodEnd: now,
        providerStatus: "approved",
        nextPaymentAt: null,
        synchronizedAt: now,
      }),
    /BILLING_INVALID_PAID_PERIOD/,
  );
});

test("past due and cancellation do not invent or extend paid dates", () => {
  const pastDue = resolveVerifiedBillingMutation(scope, {
    kind: "PAYMENT_PAST_DUE",
    verified: true,
    subscriptionId: scope.subscriptionId,
    provider: "MERCADO_PAGO",
    environment: "TEST",
    providerStatus: "paused",
    synchronizedAt: now,
  });
  assert.deepEqual(Object.keys(pastDue ?? {}).sort(), [
    "lastProviderSyncAt",
    "provider",
    "providerEnvironment",
    "providerStatus",
    "status",
  ]);
  assert.equal(pastDue?.status, SubscriptionStatus.PAST_DUE);

  const canceled = resolveVerifiedBillingMutation(scope, {
    kind: "SUBSCRIPTION_CANCELED",
    verified: true,
    subscriptionId: scope.subscriptionId,
    provider: "MERCADO_PAGO",
    environment: "TEST",
    providerStatus: "cancelled",
    canceledAt: now,
    synchronizedAt: now,
  });
  assert.equal(canceled?.status, SubscriptionStatus.CANCELED);
  assert.ok(!("currentPeriodEnd" in (canceled ?? {})));
});

test("provider environment and subscription scope enforce tenant isolation", () => {
  const base = {
    kind: "PAYMENT_PAST_DUE" as const,
    verified: true as const,
    provider: "MERCADO_PAGO" as const,
    environment: "TEST" as const,
    providerStatus: "paused",
    synchronizedAt: now,
  };
  assert.throws(
    () =>
      resolveVerifiedBillingMutation(scope, {
        ...base,
        subscriptionId: "subscription-b",
      }),
    /BILLING_TENANT_MISMATCH/,
  );
  assert.throws(
    () =>
      resolveVerifiedBillingMutation(
        { ...scope, environment: "PRODUCTION" },
        { ...base, subscriptionId: scope.subscriptionId },
      ),
    /BILLING_PROVIDER_SCOPE_MISMATCH/,
  );
});

test("event deduplication separates environments and normalizes surrounding whitespace", () => {
  const input = {
    provider: "MERCADO_PAGO" as const,
    environment: "TEST" as const,
    topic: " payment ",
    providerEventId: " event-1 ",
  };
  const key = billingEventDeduplicationKey(input);
  assert.equal(key, billingEventDeduplicationKey(input));
  assert.equal(key, "MERCADO_PAGO:TEST:payment:event-1");
  assert.notEqual(
    key,
    billingEventDeduplicationKey({ ...input, environment: "PRODUCTION" }),
  );
});

test("billing migration is additive and contains required uniqueness boundaries", () => {
  const sql = readFileSync(
    "prisma/migrations/20261012190000_billing_foundation/migration.sql",
    "utf8",
  );
  assert.doesNotMatch(sql, /^\s*(?:DROP\b|DELETE\s+FROM\b|TRUNCATE\b|UPDATE\s)/im);
  for (const expected of [
    "BillingCheckoutAttempt_idempotencyKey_key",
    "BillingEvent_deduplicationKey_key",
    "BillingEvent_provider_environment_topic_providerEventId_key",
    "BillingPayment_provider_environment_providerPaymentId_key",
    "ProviderPlan_planId_provider_environment_key",
  ]) {
    assert.match(sql, new RegExp(expected));
  }
});
