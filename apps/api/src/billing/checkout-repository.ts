import { randomUUID } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
  type BillingCheckoutAttempt,
  type BillingEvent,
} from "@prisma/client";
import type { AuthenticatedBillingActor } from "./subscription-preparation";

const TOPIC = "internal_checkout_simulated";
const eventKey = (id: string) => `MERCADO_PAGO:TEST:checkout:${id}`;

export class CheckoutError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode = 409,
  ) {
    super("Checkout de teste indisponível ou aguardando revisão.");
    this.name = "CheckoutError";
  }
}

export type CheckoutTerms = {
  planId: string;
  providerPlanId: string;
  priceInCents: number;
  trialEndsAt: string | null;
};
export type ReservedCheckout = {
  subscriptionId: string;
  attempt: BillingCheckoutAttempt;
  event: BillingEvent | null;
};

// All writers in this workflow lock the SAME existing Subscription row. No HTTP within transactions.
export class PrismaCheckoutRepository {
  constructor(readonly database: PrismaClient) {}

  private async lock(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedBillingActor,
    enforceBlock = true,
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT s."id" FROM "Subscription" s
      JOIN "Business" b ON b."userId" = s."userId"
      WHERE s."userId" = ${actor.userId} AND b."id" = ${actor.businessId}
      FOR UPDATE OF s`);
    if (locked.length !== 1) throw new CheckoutError("BILLING_TENANT_MISMATCH", 403);
    const sub = await tx.subscription.findFirst({
      where: {
        id: locked[0]!.id,
        userId: actor.userId,
        user: { business: { id: actor.businessId } },
      },
      select: {
        id: true,
        planId: true,
        providerEnvironment: true,
        providerSubscriptionId: true,
        externalReference: true,
        trialEndsAt: true,
        plan: { select: { priceInCents: true, isActive: true } },
        user: { select: { business: { select: { id: true, isManuallyBlocked: true } } } },
      },
    });
    if (!sub || sub.user.business?.id !== actor.businessId)
      throw new CheckoutError("BILLING_TENANT_MISMATCH", 403);
    if (enforceBlock && sub.user.business.isManuallyBlocked)
      throw new CheckoutError("BUSINESS_ACCESS_BLOCKED", 403);
    if (sub.providerEnvironment && sub.providerEnvironment !== "TEST")
      throw new CheckoutError("BILLING_ENVIRONMENT_MISMATCH", 403);
    return sub;
  }

  private async attempt(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    id: string,
  ) {
    const attempt = await tx.billingCheckoutAttempt.findFirst({
      where: { id, subscriptionId, provider: "MERCADO_PAGO", environment: "TEST" },
    });
    if (!attempt) throw new CheckoutError("BILLING_CHECKOUT_ATTEMPT_MISMATCH", 403);
    return attempt;
  }

  async reserve(actor: AuthenticatedBillingActor): Promise<ReservedCheckout> {
    return this.database.$transaction(
      async (tx) => {
        const sub = await this.lock(tx, actor);
        let attempt = await tx.billingCheckoutAttempt.findFirst({
          where: {
            subscriptionId: sub.id,
            provider: "MERCADO_PAGO",
            environment: "TEST",
          },
          orderBy: { createdAt: "desc" },
        });
        if (!attempt) {
          if (sub.providerSubscriptionId)
            throw new CheckoutError("BILLING_EXISTING_SUBSCRIPTION_REQUIRES_REVIEW");
          attempt = await tx.billingCheckoutAttempt.create({
            data: {
              id: randomUUID(),
              subscriptionId: sub.id,
              provider: "MERCADO_PAGO",
              environment: "TEST",
              externalReference: randomUUID(),
              idempotencyKey: randomUUID(),
              status: "CREATED",
            },
          });
        }
        if (
          sub.providerSubscriptionId &&
          (sub.providerSubscriptionId !== attempt.providerSubscriptionId ||
            sub.externalReference !== attempt.externalReference)
        )
          throw new CheckoutError("BILLING_SUBSCRIPTION_REFERENCE_MISMATCH");
        const event = await tx.billingEvent.findUnique({
          where: { deduplicationKey: eventKey(attempt.id) },
        });
        if (
          event &&
          (event.subscriptionId !== sub.id ||
            event.provider !== "MERCADO_PAGO" ||
            event.environment !== "TEST" ||
            event.topic !== TOPIC ||
            event.providerEventId !== attempt.id)
        )
          throw new CheckoutError("BILLING_CHECKOUT_CLAIM_MISMATCH");
        return { subscriptionId: sub.id, attempt, event };
      },
      { timeout: 10000 },
    );
  }

  async claim(
    actor: AuthenticatedBillingActor,
    id: string,
    terms: CheckoutTerms,
    fingerprint: string,
  ): Promise<boolean> {
    return this.database.$transaction(
      async (tx) => {
        const sub = await this.lock(tx, actor);
        const attempt = await this.attempt(tx, sub.id, id);
        const mapping = await tx.providerPlan.findUnique({
          where: {
            planId_provider_environment: {
              planId: sub.planId,
              provider: "MERCADO_PAGO",
              environment: "TEST",
            },
          },
        });
        if (
          !sub.plan.isActive ||
          !mapping?.isActive ||
          sub.planId !== terms.planId ||
          mapping.providerPlanId !== terms.providerPlanId ||
          sub.plan.priceInCents !== terms.priceInCents ||
          (sub.trialEndsAt?.toISOString() ?? null) !== terms.trialEndsAt
        )
          throw new CheckoutError("BILLING_CHECKOUT_TERMS_CHANGED");
        if (attempt.status !== "CREATED" || sub.providerSubscriptionId) return false;
        const previous = await tx.billingEvent.findUnique({
          where: { deduplicationKey: eventKey(id) },
        });
        if (previous) {
          if (
            previous.payloadHash !== fingerprint ||
            previous.resourceId !== terms.providerPlanId
          )
            throw new CheckoutError("BILLING_CHECKOUT_SNAPSHOT_MISMATCH");
          return false; // A committed marker ALWAYS fences a second POST, including after a crash.
        }
        await tx.billingEvent.create({
          data: {
            id: randomUUID(),
            subscriptionId: sub.id,
            provider: "MERCADO_PAGO",
            environment: "TEST",
            deduplicationKey: eventKey(id),
            providerEventId: id,
            topic: TOPIC,
            action: "CREATE_SUBSCRIPTION",
            resourceId: terms.providerPlanId,
            payloadHash: fingerprint,
            status: "PROCESSING",
            attempts: 1,
          },
        });
        return true;
      },
      { timeout: 10000 },
    );
  }

  async complete(actor: AuthenticatedBillingActor, id: string, providerId: string) {
    await this.database.$transaction(
      async (tx) => {
        // Persist a verified response even if the admin blocked the business while POST was in flight.
        // This only saves references; the access resolver still enforces the block.
        const sub = await this.lock(tx, actor, false);
        const attempt = await this.attempt(tx, sub.id, id);
        const event = await tx.billingEvent.findUnique({
          where: { deduplicationKey: eventKey(id) },
        });
        if (
          !event ||
          event.subscriptionId !== sub.id ||
          event.topic !== TOPIC ||
          event.environment !== "TEST"
        )
          throw new CheckoutError("BILLING_CHECKOUT_CLAIM_MISSING");
        if (
          (attempt.providerSubscriptionId &&
            attempt.providerSubscriptionId !== providerId) ||
          (sub.providerSubscriptionId && sub.providerSubscriptionId !== providerId)
        )
          throw new CheckoutError("BILLING_SUBSCRIPTION_REFERENCE_MISMATCH");
        await tx.billingCheckoutAttempt.update({
          where: { id },
          data: { status: "PROVIDER_CREATED", providerSubscriptionId: providerId },
        });
        await tx.billingEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED", processedAt: new Date(), errorCode: null },
        });
        // NEVER write status, trialEndsAt, currentPeriodStart or currentPeriodEnd here.
        await tx.subscription.update({
          where: { id: sub.id },
          data: {
            provider: "MERCADO_PAGO",
            providerEnvironment: "TEST",
            providerSubscriptionId: providerId,
            externalReference: attempt.externalReference,
          },
        });
      },
      { timeout: 10000 },
    );
  }

  async markAmbiguous(actor: AuthenticatedBillingActor, id: string) {
    await this.database.$transaction(
      async (tx) => {
        const sub = await this.lock(tx, actor, false);
        await this.attempt(tx, sub.id, id);
        const event = await tx.billingEvent.findUnique({
          where: { deduplicationKey: eventKey(id) },
        });
        if (event && event.status === "PROCESSING")
          await tx.billingEvent.update({
            where: { id: event.id },
            data: { status: "FAILED", errorCode: "CHECKOUT_RECONCILIATION_REQUIRED" },
          });
      },
      { timeout: 10000 },
    );
  }
}
