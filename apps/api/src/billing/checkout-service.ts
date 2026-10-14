import { createHash } from "node:crypto";
import type { MercadoPagoTestConfig } from "./config";
import {
  MercadoPagoTestHttpClient,
  validateMercadoPagoCheckoutUrl,
} from "./mercado-pago-http";
import {
  prepareTestSubscriptionCreation,
  type AuthenticatedBillingActor,
} from "./subscription-preparation";
import {
  CheckoutError,
  PrismaCheckoutRepository,
  type ReservedCheckout,
} from "./checkout-repository";

export function simulatedCheckoutEnabled(
  source: Record<string, string | undefined> = process.env,
): boolean {
  if (
    !["test", "development"].includes(source.NODE_ENV ?? "") ||
    source.BILLING_CHECKOUT_MODE !== "SIMULATED" ||
    source.MERCADO_PAGO_ENVIRONMENT !== "TEST"
  )
    return false;
  try {
    const url = new URL(source.DATABASE_URL ?? "");
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      decodeURIComponent(url.pathname) === "/conecta_agenda_billing_test"
    );
  } catch {
    return false;
  }
}

export class SimulatedCheckoutService {
  readonly mode = "SIMULATED" as const;
  constructor(
    private readonly repository: PrismaCheckoutRepository,
    private readonly client: MercadoPagoTestHttpClient,
    private readonly config: MercadoPagoTestConfig,
    private readonly source: Record<string, string | undefined>,
  ) {
    if (!simulatedCheckoutEnabled(source) || config.environment !== "TEST")
      throw new CheckoutError("BILLING_SIMULATION_DISABLED", 503);
  }

  private guard() {
    if (!simulatedCheckoutEnabled(this.source))
      throw new CheckoutError("BILLING_SIMULATION_DISABLED", 503);
  }

  private replay(record: ReservedCheckout) {
    const id = record.attempt.providerSubscriptionId;
    if (
      !id ||
      record.attempt.status !== "PROVIDER_CREATED" ||
      record.event?.status !== "PROCESSED"
    )
      throw new CheckoutError("BILLING_CHECKOUT_REVIEW_REQUIRED");
    const checkoutUrl = validateMercadoPagoCheckoutUrl(
      `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${encodeURIComponent(id)}`,
      id,
    );
    return {
      checkoutUrl,
      provider: "MERCADO_PAGO" as const,
      subscriptionId: record.subscriptionId,
      mode: this.mode,
    };
  }

  async checkout(actor: AuthenticatedBillingActor) {
    this.guard();
    const reserved = await this.repository.reserve(actor); // committed BEFORE even a simulated GET
    if (reserved.attempt.providerSubscriptionId) return this.replay(reserved);
    if (reserved.event) throw new CheckoutError("BILLING_CHECKOUT_REVIEW_REQUIRED");
    let prepared;
    try {
      prepared = await prepareTestSubscriptionCreation(
        this.repository.database,
        this.client,
        this.config,
        actor,
        {
          subscriptionId: reserved.subscriptionId,
          checkoutAttemptId: reserved.attempt.id,
          testCardTokenId: `simulation_${reserved.attempt.id}`, // NOT card data or a frontend token
        },
      );
    } catch {
      throw new CheckoutError("BILLING_CHECKOUT_PREPARATION_FAILED", 503);
    }
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          request: prepared.request,
          terms: prepared.terms,
          applicationId: this.config.applicationId,
          collectorId: this.config.collectorId,
        }),
      )
      .digest("hex");
    if (
      !(await this.repository.claim(
        actor,
        reserved.attempt.id,
        prepared.terms,
        fingerprint,
      ))
    )
      return this.replay(await this.repository.reserve(actor));
    this.guard();
    try {
      const result = await this.client.createSubscription(
        prepared.request,
        prepared.idempotencyKey,
      );
      const checkoutUrl = validateMercadoPagoCheckoutUrl(result.init_point, result.id);
      await this.repository.complete(actor, reserved.attempt.id, result.id);
      return {
        checkoutUrl,
        provider: "MERCADO_PAGO" as const,
        subscriptionId: reserved.subscriptionId,
        mode: this.mode,
      };
    } catch {
      try {
        await this.repository.markAmbiguous(actor, reserved.attempt.id);
      } catch {
        /* committed claim remains a permanent fence */
      }
      throw new CheckoutError("BILLING_CHECKOUT_REVIEW_REQUIRED");
    }
  }

  // Internal recovery only; there is deliberately NO frontend endpoint accepting provider IDs.
  async reconcile(
    actor: AuthenticatedBillingActor,
    attemptId: string,
    candidateProviderId: string,
  ) {
    this.guard();
    const reserved = await this.repository.reserve(actor);
    if (reserved.attempt.id !== attemptId || !reserved.event)
      throw new CheckoutError("BILLING_CHECKOUT_CLAIM_MISSING");
    if (reserved.attempt.providerSubscriptionId) return this.replay(reserved);
    const result = await this.client.getSubscription({
      id: candidateProviderId,
      planId: reserved.event.resourceId,
      externalReference: reserved.attempt.externalReference,
    });
    const checkoutUrl = validateMercadoPagoCheckoutUrl(result.init_point, result.id);
    await this.repository.complete(actor, attemptId, result.id);
    return {
      checkoutUrl,
      provider: "MERCADO_PAGO" as const,
      subscriptionId: reserved.subscriptionId,
      mode: this.mode,
    };
  }
}
