import { SubscriptionStatus } from "@prisma/client";

export const BUSINESS_TRIAL_DAYS = 7;

const DAY_IN_MS = 86_400_000;

export function createInitialTrial(now = new Date()) {
  return {
    status: SubscriptionStatus.TRIALING,
    trialEndsAt: new Date(now.getTime() + BUSINESS_TRIAL_DAYS * DAY_IN_MS),
    currentPeriodStart: null,
    currentPeriodEnd: null,
  } as const;
}

type CurrentBillingScope = {
  subscriptionId: string;
  provider: "MERCADO_PAGO" | null;
  environment: "TEST" | "PRODUCTION" | null;
};

type BillingSignal =
  | {
      kind: "UNVERIFIED_CHECKOUT_RETURN" | "UNVERIFIED_WEBHOOK";
      verified: false;
      subscriptionId: string;
    }
  | {
      kind: "PAYMENT_CONFIRMED";
      verified: true;
      subscriptionId: string;
      provider: "MERCADO_PAGO";
      environment: "TEST" | "PRODUCTION";
      periodStart: Date;
      periodEnd: Date;
      providerStatus: string;
      nextPaymentAt: Date | null;
      synchronizedAt: Date;
    }
  | {
      kind: "PAYMENT_PAST_DUE";
      verified: true;
      subscriptionId: string;
      provider: "MERCADO_PAGO";
      environment: "TEST" | "PRODUCTION";
      providerStatus: string;
      synchronizedAt: Date;
    }
  | {
      kind: "SUBSCRIPTION_CANCELED";
      verified: true;
      subscriptionId: string;
      provider: "MERCADO_PAGO";
      environment: "TEST" | "PRODUCTION";
      providerStatus: string;
      canceledAt: Date;
      synchronizedAt: Date;
    };

export function resolveVerifiedBillingMutation(
  current: CurrentBillingScope,
  signal: BillingSignal,
) {
  if (!signal.verified) return null;
  if (signal.subscriptionId !== current.subscriptionId) {
    throw new Error("BILLING_TENANT_MISMATCH");
  }
  if (
    (current.provider && current.provider !== signal.provider) ||
    (current.environment && current.environment !== signal.environment)
  ) {
    throw new Error("BILLING_PROVIDER_SCOPE_MISMATCH");
  }
  const common = {
    provider: signal.provider,
    providerEnvironment: signal.environment,
    providerStatus: signal.providerStatus,
    lastProviderSyncAt: signal.synchronizedAt,
  };
  if (signal.kind === "PAYMENT_CONFIRMED") {
    if (
      !Number.isFinite(signal.periodStart.getTime()) ||
      !Number.isFinite(signal.periodEnd.getTime()) ||
      signal.periodEnd.getTime() <= signal.periodStart.getTime()
    ) {
      throw new Error("BILLING_INVALID_PAID_PERIOD");
    }
    return {
      ...common,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: signal.periodStart,
      currentPeriodEnd: signal.periodEnd,
      nextPaymentAt: signal.nextPaymentAt,
    };
  }
  if (signal.kind === "PAYMENT_PAST_DUE") {
    return { ...common, status: SubscriptionStatus.PAST_DUE };
  }
  return {
    ...common,
    status: SubscriptionStatus.CANCELED,
    cancelRequestedAt: signal.canceledAt,
    canceledAt: signal.canceledAt,
  };
}

export function billingEventDeduplicationKey(input: {
  provider: "MERCADO_PAGO";
  environment: "TEST" | "PRODUCTION";
  topic: string;
  providerEventId: string;
}) {
  return [
    input.provider,
    input.environment,
    input.topic.trim(),
    input.providerEventId.trim(),
  ].join(":");
}
