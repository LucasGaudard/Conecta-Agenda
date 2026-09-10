import { SubscriptionStatus } from "@prisma/client";

import { env } from "../env";
export type BusinessAccessStatus =
  | "ACTIVE"
  | "TRIAL"
  | "OVERRIDE_ACTIVE"
  | "PAYMENT_ATTENTION"
  | "MANUALLY_BLOCKED"
  | "EXPIRED";
export type BusinessAccessState = {
  status: BusinessAccessStatus;
  canAccess: boolean;
  reason: string;
  requiresPaymentAttention: boolean;
  isManuallyBlocked: boolean;
  accessOverrideUntil: string | null;
  subscriptionStatus: string | null;
  gracePeriodEndsAt: string | null;
};

type ResolveBusinessAccessInput = {
  isManuallyBlocked: boolean;
  accessOverrideUntil: Date | string | null;
  subscription: {
    status: SubscriptionStatus;
    trialEndsAt: Date | string | null;
    currentPeriodEnd: Date | string | null;
  } | null;
  now?: Date;
};

function toDate(value: Date | string | null) {
  return value ? new Date(value) : null;
}

function isFuture(value: Date | string | null, now: Date) {
  const date = toDate(value);
  return Boolean(date && date.getTime() > now.getTime());
}

export function resolveBusinessAccess({
  accessOverrideUntil,
  isManuallyBlocked,
  now = new Date(),
  subscription,
}: ResolveBusinessAccessInput): BusinessAccessState {
  // Tolerância contada do vencimento; sem data não há liberação indefinida.
  const grace =
    subscription?.status === SubscriptionStatus.PAST_DUE && subscription.currentPeriodEnd
      ? new Date(
          new Date(subscription.currentPeriodEnd).getTime() +
            env.PAYMENT_GRACE_PERIOD_DAYS * 86400000,
        )
      : null;
  const base = {
    isManuallyBlocked,
    accessOverrideUntil: accessOverrideUntil
      ? new Date(accessOverrideUntil).toISOString()
      : null,
    subscriptionStatus: subscription?.status ?? null,
    gracePeriodEndsAt: grace?.toISOString() ?? null,
  };
  if (isManuallyBlocked) {
    return {
      ...base,
      status: "MANUALLY_BLOCKED",
      canAccess: false,
      reason: "Acesso bloqueado manualmente.",
      requiresPaymentAttention: false,
    };
  }

  if (isFuture(accessOverrideUntil, now)) {
    return {
      ...base,
      status: "OVERRIDE_ACTIVE",
      canAccess: true,
      reason: "Acesso liberado por cortesia manual.",
      requiresPaymentAttention: false,
    };
  }

  if (!subscription) {
    return {
      ...base,
      status: "EXPIRED",
      canAccess: false,
      reason: "Assinatura nao encontrada.",
      requiresPaymentAttention: true,
    };
  }

  if (
    [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.CANCELED,
      SubscriptionStatus.EXPIRED,
    ].some((status) => status === subscription.status) &&
    isFuture(subscription.currentPeriodEnd, now)
  ) {
    return {
      ...base,
      status: "ACTIVE",
      canAccess: true,
      reason: "Acesso permitido até o fim do período pago.",
      requiresPaymentAttention: false,
    };
  }

  if (
    subscription.status === SubscriptionStatus.TRIALING &&
    isFuture(subscription.trialEndsAt, now)
  ) {
    return {
      ...base,
      status: "TRIAL",
      canAccess: true,
      reason: "Periodo de teste ativo.",
      requiresPaymentAttention: false,
    };
  }

  if (
    subscription.status === SubscriptionStatus.PAST_DUE &&
    grace &&
    isFuture(grace, now)
  ) {
    return {
      ...base,
      status: "PAYMENT_ATTENTION",
      canAccess: true,
      reason: "Pagamento requer atencao.",
      requiresPaymentAttention: true,
    };
  }

  return {
    ...base,
    status: "EXPIRED",
    canAccess: false,
    reason: "Assinatura expirada ou cancelada.",
    requiresPaymentAttention: true,
  };
}
