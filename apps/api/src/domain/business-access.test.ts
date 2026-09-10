import assert from "node:assert/strict";
import { test } from "node:test";
import { SubscriptionStatus } from "@prisma/client";
import { resolveBusinessAccess } from "./business-access";
import { env } from "../env";

const now = new Date("2026-09-10T12:00:00Z");
const future = new Date("2026-09-20T12:00:00Z");
const past = new Date("2026-09-01T12:00:00Z");
const cases = [
  ["ACTIVE", future, null, "ACTIVE", true],
  ["ACTIVE", null, null, "EXPIRED", false],
  ["TRIALING", null, future, "TRIAL", true],
  ["TRIALING", null, past, "EXPIRED", false],
  ["CANCELED", future, null, "ACTIVE", true],
  ["CANCELED", past, null, "EXPIRED", false],
  ["EXPIRED", future, null, "ACTIVE", true],
  ["EXPIRED", past, null, "EXPIRED", false],
  ["PAST_DUE", past, null, "EXPIRED", false],
  ["PAST_DUE", null, null, "EXPIRED", false],
] as const;
for (const [status, currentPeriodEnd, trialEndsAt, expected, allowed] of cases) {
  test(`${status} / ${currentPeriodEnd} / ${trialEndsAt}`, () => {
    const access = resolveBusinessAccess({
      isManuallyBlocked: false,
      accessOverrideUntil: null,
      subscription: { status, currentPeriodEnd, trialEndsAt },
      now,
    });
    assert.equal(access.status, expected);
    assert.equal(access.canAccess, allowed);
  });
}
test("grace ends at the exact deadline and does not mutate subscription", () => {
  const subscription = {
    status: SubscriptionStatus.PAST_DUE,
    currentPeriodEnd: now,
    trialEndsAt: null,
  };
  const deadline = new Date(now.getTime() + env.PAYMENT_GRACE_PERIOD_DAYS * 86400000);
  const input = { isManuallyBlocked: false, accessOverrideUntil: null, subscription };
  const before = resolveBusinessAccess({
    ...input,
    now: new Date(deadline.getTime() - 1),
  });
  assert.equal(before.status, "PAYMENT_ATTENTION");
  assert.equal(before.requiresPaymentAttention, true);
  assert.equal(before.canAccess, true);
  assert.equal(before.gracePeriodEndsAt, deadline.toISOString());
  assert.equal(resolveBusinessAccess({ ...input, now: deadline }).canAccess, false);
  assert.equal(subscription.status, "PAST_DUE");
});
test("manual block beats courtesy and active subscription; removal re-evaluates", () => {
  const input = {
    isManuallyBlocked: true,
    accessOverrideUntil: future,
    subscription: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: future,
      trialEndsAt: null,
    },
    now,
  };
  assert.equal(resolveBusinessAccess(input).status, "MANUALLY_BLOCKED");
  assert.equal(resolveBusinessAccess(input).canAccess, false);
  assert.equal(
    resolveBusinessAccess({ ...input, isManuallyBlocked: false }).status,
    "OVERRIDE_ACTIVE",
  );
  assert.equal(
    resolveBusinessAccess({
      ...input,
      isManuallyBlocked: false,
      accessOverrideUntil: now,
    }).status,
    "ACTIVE",
  );
  assert.equal(
    resolveBusinessAccess({ ...input, isManuallyBlocked: false, subscription: null })
      .canAccess,
    true,
  );
  assert.equal(
    resolveBusinessAccess({
      ...input,
      isManuallyBlocked: false,
      subscription: null,
      accessOverrideUntil: now,
    }).canAccess,
    false,
  );
});
