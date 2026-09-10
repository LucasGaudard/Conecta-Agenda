type BillingEnvironment = Partial<
  Record<
    | "MERCADO_PAGO_ACCESS_TOKEN"
    | "MERCADO_PAGO_WEBHOOK_SECRET"
    | "MERCADO_PAGO_PLAN_ID"
    | "MERCADO_PAGO_SUCCESS_URL"
    | "MERCADO_PAGO_FAILURE_URL"
    | "MERCADO_PAGO_PENDING_URL",
    string
  >
>;

export function getBillingConfig(source: BillingEnvironment = process.env) {
  const url = (value?: string) => {
    try {
      const parsed = new URL(value?.trim() ?? "");
      return ["https:", "http:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password
        ? parsed.href
        : null;
    } catch {
      return null;
    }
  };
  const config = {
    accessToken: source.MERCADO_PAGO_ACCESS_TOKEN?.trim() || null,
    webhookSecret: source.MERCADO_PAGO_WEBHOOK_SECRET?.trim() || null,
    planId: source.MERCADO_PAGO_PLAN_ID?.trim() || null,
    successUrl: url(source.MERCADO_PAGO_SUCCESS_URL),
    failureUrl: url(source.MERCADO_PAGO_FAILURE_URL),
    pendingUrl: url(source.MERCADO_PAGO_PENDING_URL),
  };
  return { ...config, providerConfigured: Object.values(config).every(Boolean) };
}
