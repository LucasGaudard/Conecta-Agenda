import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { MercadoPagoTestConfig } from "./config";
import {
  MercadoPagoHttpError,
  type MercadoPagoTestHttpClient,
  type PlanSubscriptionRequest,
  type PersistedSubscriptionReference,
} from "./mercado-pago-http";

// Injected repository only: this module never instantiates Prisma or writes subscription state.
export type BillingPreparationRepository = Pick<
  PrismaClient,
  "subscription" | "providerPlan" | "billingCheckoutAttempt"
>;
export type AuthenticatedBillingActor = { userId: string; businessId: string };
type PlanReader = Pick<MercadoPagoTestHttpClient, "getPlan">;

async function loadScope(
  repository: BillingPreparationRepository,
  actor: AuthenticatedBillingActor,
  subscriptionId: string,
  requireActivePlan = true,
) {
  const subscription = await repository.subscription.findFirst({
    where: {
      id: subscriptionId,
      userId: actor.userId,
      user: { business: { id: actor.businessId } },
    },
    select: {
      id: true,
      userId: true,
      planId: true,
      trialEndsAt: true,
      provider: true,
      providerEnvironment: true,
      providerSubscriptionId: true,
      externalReference: true,
      plan: { select: { id: true, priceInCents: true, isActive: true } },
      user: { select: { email: true, business: { select: { id: true } } } },
    },
  });
  if (
    !subscription ||
    subscription.userId !== actor.userId ||
    subscription.user.business?.id !== actor.businessId
  )
    throw new MercadoPagoHttpError("MP_TENANT_SCOPE_MISMATCH");
  if (
    (subscription.provider && subscription.provider !== "MERCADO_PAGO") ||
    (subscription.providerEnvironment && subscription.providerEnvironment !== "TEST")
  )
    throw new MercadoPagoHttpError("MP_ENVIRONMENT_SCOPE_MISMATCH");
  if (requireActivePlan && !subscription.plan.isActive)
    throw new MercadoPagoHttpError("MP_PLAN_INACTIVE");
  const mapping = await repository.providerPlan.findUnique({
    where: {
      planId_provider_environment: {
        planId: subscription.planId,
        provider: "MERCADO_PAGO",
        environment: "TEST",
      },
    },
  });
  if (
    !mapping ||
    (requireActivePlan && !mapping.isActive) ||
    mapping.planId !== subscription.planId ||
    mapping.environment !== "TEST" ||
    mapping.provider !== "MERCADO_PAGO"
  )
    throw new MercadoPagoHttpError("MP_PLAN_MAPPING_UNAVAILABLE");
  return { subscription, mapping };
}

export async function prepareTestSubscriptionCreation(
  repository: BillingPreparationRepository,
  client: PlanReader,
  config: MercadoPagoTestConfig,
  actor: AuthenticatedBillingActor,
  input: { subscriptionId: string; checkoutAttemptId: string; testCardTokenId: string },
  now = new Date(),
) {
  if (config.environment !== "TEST")
    throw new MercadoPagoHttpError("MP_ENVIRONMENT_SCOPE_MISMATCH");
  if (!testSubscriptionPreparationInput.safeParse(input).success)
    throw new MercadoPagoHttpError("MP_INVALID_INPUT");
  const { subscription, mapping } = await loadScope(
    repository,
    actor,
    input.subscriptionId,
  );
  if (subscription.providerSubscriptionId)
    throw new MercadoPagoHttpError("MP_RECONCILIATION_REQUIRED");
  const attempt = await repository.billingCheckoutAttempt.findFirst({
    where: {
      id: input.checkoutAttemptId,
      subscriptionId: subscription.id,
      provider: "MERCADO_PAGO",
      environment: "TEST",
    },
  });
  if (
    !attempt ||
    attempt.subscriptionId !== subscription.id ||
    attempt.provider !== "MERCADO_PAGO" ||
    attempt.environment !== "TEST" ||
    attempt.status !== "CREATED" ||
    attempt.providerSubscriptionId ||
    (attempt.expiresAt && attempt.expiresAt.getTime() <= now.getTime())
  )
    throw new MercadoPagoHttpError("MP_CHECKOUT_ATTEMPT_INVALID");
  const plan = await client.getPlan(mapping.providerPlanId);
  if (
    plan.id !== mapping.providerPlanId ||
    plan.application_id !== config.applicationId ||
    plan.collector_id !== config.collectorId ||
    plan.status !== "active" ||
    plan.auto_recurring.frequency !== 1 ||
    plan.auto_recurring.frequency_type !== "months" ||
    plan.auto_recurring.currency_id !== "BRL" ||
    Math.round(plan.auto_recurring.transaction_amount * 100) !==
      subscription.plan.priceInCents
  )
    throw new MercadoPagoHttpError("MP_PLAN_TERMS_MISMATCH");
  const request: PlanSubscriptionRequest = {
    preapproval_plan_id: mapping.providerPlanId,
    external_reference: attempt.externalReference,
    payer_email: subscription.user.email,
    card_token_id: input.testCardTokenId,
    back_url: config.backUrl,
    status: "authorized",
  };
  const end = subscription.trialEndsAt;
  if (end && !Number.isFinite(end.getTime()))
    throw new MercadoPagoHttpError("MP_TRIAL_REVIEW_REQUIRED");
  return {
    request,
    idempotencyKey: attempt.idempotencyKey,
    terms: {
      planId: subscription.planId,
      providerPlanId: mapping.providerPlanId,
      priceInCents: subscription.plan.priceInCents,
      trialEndsAt: end?.toISOString() ?? null,
    },
    trial: {
      internalTrialEndsAt: end?.toISOString() ?? null,
      remainingMilliseconds: end ? Math.max(0, end.getTime() - now.getTime()) : null,
      providerFreeTrial: plan.auto_recurring.free_trial ?? null,
      requiresSandboxValidation: true as const,
    },
  };
}

export async function loadTestSubscriptionReference(
  repository: BillingPreparationRepository,
  actor: AuthenticatedBillingActor,
  subscriptionId: string,
): Promise<PersistedSubscriptionReference> {
  const { subscription, mapping } = await loadScope(
    repository,
    actor,
    subscriptionId,
    false,
  );
  if (
    subscription.provider !== "MERCADO_PAGO" ||
    subscription.providerEnvironment !== "TEST" ||
    !subscription.providerSubscriptionId ||
    !subscription.externalReference
  )
    throw new MercadoPagoHttpError("MP_SUBSCRIPTION_REFERENCE_UNAVAILABLE");
  return {
    id: subscription.providerSubscriptionId,
    planId: mapping.providerPlanId,
    externalReference: subscription.externalReference,
  };
}

// Backend session comes separately; reject caller-supplied price/business/provider IDs.
export const testSubscriptionPreparationInput = z
  .object({
    subscriptionId: z.string().min(1),
    checkoutAttemptId: z.string().min(1),
    testCardTokenId: z.string().min(1),
  })
  .strict();
