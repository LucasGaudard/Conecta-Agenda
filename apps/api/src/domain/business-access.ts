import { SubscriptionStatus } from "@prisma/client";

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
  if (isManuallyBlocked) {
    return {
      status: "MANUALLY_BLOCKED",
      canAccess: false,
      reason: "Acesso bloqueado manualmente.",
      requiresPaymentAttention: false,
    };
  }

  if (isFuture(accessOverrideUntil, now)) {
    return {
      status: "OVERRIDE_ACTIVE",
      canAccess: true,
      reason: "Acesso liberado por cortesia manual.",
      requiresPaymentAttention: false,
    };
  }

  if (!subscription) {
    return {
      status: "EXPIRED",
      canAccess: false,
      reason: "Assinatura nao encontrada.",
      requiresPaymentAttention: true,
    };
  }

  if (
    subscription.status === SubscriptionStatus.ACTIVE &&
    (!subscription.currentPeriodEnd || isFuture(subscription.currentPeriodEnd, now))
  ) {
    return {
      status: "ACTIVE",
      canAccess: true,
      reason: "Assinatura ativa.",
      requiresPaymentAttention: false,
    };
  }

  if (
    subscription.status === SubscriptionStatus.TRIALING &&
    isFuture(subscription.trialEndsAt, now)
  ) {
    return {
      status: "TRIAL",
      canAccess: true,
      reason: "Periodo de teste ativo.",
      requiresPaymentAttention: false,
    };
  }

  if (subscription.status === SubscriptionStatus.PAST_DUE) {
    return {
      status: "PAYMENT_ATTENTION",
      canAccess: true,
      reason: "Pagamento requer atencao.",
      requiresPaymentAttention: true,
    };
  }

  return {
    status: "EXPIRED",
    canAccess: false,
    reason: "Assinatura expirada ou cancelada.",
    requiresPaymentAttention: true,
  };
}
