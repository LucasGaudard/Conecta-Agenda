import { createHash } from "node:crypto";
import { z } from "zod";
import type { MercadoPagoTestConfig } from "./config";

const API_ORIGIN = "https://api.mercadopago.com";
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const accountId = z
  .union([z.number().int().nonnegative().safe(), z.string().regex(/^\d+$/)])
  .transform(String);
const amount = z
  .union([z.number().finite().positive(), z.string().regex(/^\d+(?:\.\d{1,2})?$/)])
  .transform(Number)
  .refine(
    (value) =>
      value > 0 &&
      Number.isSafeInteger(Math.round(value * 100)) &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
  );
const recurrence = z.object({
  frequency: z.number().int().positive(),
  frequency_type: z.enum(["days", "months"]),
  transaction_amount: amount,
  currency_id: z.string(),
  free_trial: z
    .object({
      frequency: z.number().int().positive(),
      frequency_type: z.enum(["days", "months"]),
    })
    .nullish(),
});
const planSchema = z.object({
  id: identifier,
  application_id: accountId,
  collector_id: accountId,
  status: z.enum(["active", "inactive", "cancelled"]),
  auto_recurring: recurrence,
});
const checkoutUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "www.mercadopago.com.br" &&
      url.pathname === "/subscriptions/checkout" &&
      !url.username &&
      !url.password &&
      !url.port
    );
  });

export function validateMercadoPagoCheckoutUrl(
  value: unknown,
  providerId: string,
): string {
  const parsed = checkoutUrl.safeParse(value);
  if (!parsed.success) throw new MercadoPagoHttpError("MP_CHECKOUT_URL_INVALID");
  const url = new URL(parsed.data);
  if (
    url.hash ||
    url.searchParams.size !== 1 ||
    url.searchParams.get("preapproval_id") !== providerId
  )
    throw new MercadoPagoHttpError("MP_CHECKOUT_URL_INVALID");
  return url.href;
}
const subscriptionSchema = z.object({
  id: identifier,
  application_id: accountId,
  collector_id: accountId,
  preapproval_plan_id: identifier,
  external_reference: identifier,
  status: z.enum(["pending", "authorized", "paused", "cancelled"]),
  init_point: checkoutUrl.nullish(),
  next_payment_date: z.string().datetime({ offset: true }).nullish(),
});
const creationSchema = z
  .object({
    preapproval_plan_id: identifier,
    external_reference: identifier,
    payer_email: z.string().email(),
    card_token_id: identifier,
    back_url: z.string().url(),
    status: z.literal("authorized"),
  })
  .strict();
const referenceSchema = z
  .object({ id: identifier, planId: identifier, externalReference: identifier })
  .strict();

export type MercadoPagoPlan = z.output<typeof planSchema>;
export type MercadoPagoSubscription = z.output<typeof subscriptionSchema>;
export type PlanSubscriptionRequest = z.input<typeof creationSchema>;
export type PersistedSubscriptionReference = z.input<typeof referenceSchema>;

export type SimulatedHttpTransport = {
  mode: "SIMULATED";
  send(
    url: string,
    init: {
      method: "GET" | "POST" | "PUT";
      headers: Record<string, string>;
      body?: string;
      signal: AbortSignal;
      redirect: "error";
    },
  ): Promise<{ status: number; json(): Promise<unknown> }>;
};

export class MercadoPagoHttpError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus?: number,
  ) {
    super(code);
    this.name = "MercadoPagoHttpError";
  }
}

// No fetch adapter or default transport: application routes cannot enable network by configuration.
export class MercadoPagoTestHttpClient {
  private readonly creations = new Map<
    string,
    { fingerprint: string; promise: Promise<MercadoPagoSubscription> }
  >();
  private readonly config: MercadoPagoTestConfig;
  constructor(
    config: MercadoPagoTestConfig,
    private readonly transport: SimulatedHttpTransport,
  ) {
    if (
      config.environment !== "TEST" ||
      transport?.mode !== "SIMULATED" ||
      !config.accessToken ||
      !/^[\x21-\x7e]+$/.test(config.accessToken) ||
      !/^\d+$/.test(config.applicationId) ||
      !/^\d+$/.test(config.collectorId) ||
      !Number.isInteger(config.timeoutMs) ||
      config.timeoutMs < 1 ||
      config.timeoutMs > 30000
    ) {
      throw new MercadoPagoHttpError("MP_TEST_CONFIGURATION_INVALID");
    }
    try {
      const back = new URL(config.backUrl);
      if (back.protocol !== "https:" || back.username || back.password) throw new Error();
      this.config = { ...config, backUrl: back.href };
    } catch {
      throw new MercadoPagoHttpError("MP_TEST_CONFIGURATION_INVALID");
    }
  }

  toJSON() {
    return { environment: "TEST", transport: "SIMULATED" };
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new MercadoPagoHttpError("MP_TIMEOUT"));
      }, this.config.timeoutMs);
    });
    try {
      const work = async () => {
        const response = await this.transport.send(API_ORIGIN + path, {
          method,
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
          redirect: "error",
        });
        if (
          !Number.isInteger(response.status) ||
          response.status < 100 ||
          response.status > 599
        )
          throw new MercadoPagoHttpError("MP_INVALID_RESPONSE");
        if (response.status < 200 || response.status >= 300) {
          const code =
            response.status === 401 || response.status === 403
              ? "MP_AUTH_ERROR"
              : response.status === 409
                ? "MP_CONFLICT_REQUIRES_RECONCILIATION"
                : response.status === 429
                  ? "MP_RATE_LIMITED"
                  : response.status >= 500
                    ? "MP_UPSTREAM_UNAVAILABLE"
                    : "MP_REQUEST_REJECTED";
          throw new MercadoPagoHttpError(code, response.status);
        }
        let raw: unknown;
        try {
          raw = await response.json();
        } catch {
          throw new MercadoPagoHttpError("MP_INVALID_RESPONSE");
        }
        const result = schema.safeParse(raw);
        if (!result.success) throw new MercadoPagoHttpError("MP_INVALID_RESPONSE");
        return result.data;
      };
      return await Promise.race([work(), deadline]);
    } catch (error) {
      if (controller.signal.aborted) throw new MercadoPagoHttpError("MP_TIMEOUT");
      if (error instanceof MercadoPagoHttpError) throw error;
      throw new MercadoPagoHttpError("MP_NETWORK_ERROR");
    } finally {
      clearTimeout(timer);
    }
  }

  private assertIdentity(value: { application_id: string; collector_id: string }) {
    if (
      value.application_id !== this.config.applicationId ||
      value.collector_id !== this.config.collectorId
    )
      throw new MercadoPagoHttpError("MP_ACCOUNT_SCOPE_MISMATCH");
  }

  async getPlan(id: string): Promise<MercadoPagoPlan> {
    if (!identifier.safeParse(id).success)
      throw new MercadoPagoHttpError("MP_INVALID_INPUT");
    const plan = await this.request(
      "GET",
      `/preapproval_plan/${encodeURIComponent(id)}`,
      planSchema,
    );
    this.assertIdentity(plan);
    if (plan.id !== id) throw new MercadoPagoHttpError("MP_PLAN_SCOPE_MISMATCH");
    return plan;
  }

  private assertSubscription(
    value: MercadoPagoSubscription,
    reference: PersistedSubscriptionReference,
  ) {
    this.assertIdentity(value);
    if (
      value.id !== reference.id ||
      value.preapproval_plan_id !== reference.planId ||
      value.external_reference !== reference.externalReference
    )
      throw new MercadoPagoHttpError("MP_SUBSCRIPTION_SCOPE_MISMATCH");
  }

  async getSubscription(
    reference: PersistedSubscriptionReference,
  ): Promise<MercadoPagoSubscription> {
    const parsed = referenceSchema.safeParse(reference);
    if (!parsed.success) throw new MercadoPagoHttpError("MP_INVALID_INPUT");
    const value = await this.request(
      "GET",
      `/preapproval/${encodeURIComponent(parsed.data.id)}`,
      subscriptionSchema,
    );
    this.assertSubscription(value, parsed.data);
    return value;
  }

  async createSubscription(
    input: PlanSubscriptionRequest,
    idempotencyKey: string,
  ): Promise<MercadoPagoSubscription> {
    const parsed = creationSchema.safeParse(input);
    if (
      !parsed.success ||
      !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey) ||
      input.back_url !== this.config.backUrl
    )
      throw new MercadoPagoHttpError("MP_INVALID_INPUT");
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(parsed.data))
      .digest("hex");
    const existing = this.creations.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new MercadoPagoHttpError("MP_IDEMPOTENCY_CONFLICT");
      return structuredClone(await existing.promise);
    }
    if (this.creations.size >= 256)
      throw new MercadoPagoHttpError("MP_RECONCILIATION_REQUIRED");
    const promise = this.request(
      "POST",
      "/preapproval",
      subscriptionSchema,
      parsed.data,
    ).then((value) => {
      this.assertIdentity(value);
      if (
        value.preapproval_plan_id !== parsed.data.preapproval_plan_id ||
        value.external_reference !== parsed.data.external_reference
      )
        throw new MercadoPagoHttpError("MP_SUBSCRIPTION_SCOPE_MISMATCH");
      return value;
    });
    // Keep failed/ambiguous creations too. Never blindly retry a POST after a timeout/409.
    // This process-local guard is NOT durable provider idempotency; persistence is a future step.
    this.creations.set(idempotencyKey, { fingerprint, promise });
    return structuredClone(await promise);
  }

  async cancelSubscription(
    reference: PersistedSubscriptionReference,
  ): Promise<MercadoPagoSubscription> {
    const current = await this.getSubscription(reference);
    if (current.status === "cancelled") return current;
    const value = await this.request(
      "PUT",
      `/preapproval/${encodeURIComponent(reference.id)}`,
      subscriptionSchema,
      { status: "cancelled" },
    );
    this.assertSubscription(value, reference);
    if (value.status !== "cancelled")
      throw new MercadoPagoHttpError("MP_CANCELLATION_UNCONFIRMED");
    return value;
  }
}
