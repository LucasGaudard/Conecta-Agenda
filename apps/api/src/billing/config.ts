type BillingEnvironment = Partial<
  Record<
    | "MERCADO_PAGO_ACCESS_TOKEN"
    | "MERCADO_PAGO_WEBHOOK_SECRET"
    | "MERCADO_PAGO_ENVIRONMENT"
    | "MERCADO_PAGO_APPLICATION_ID"
    | "MERCADO_PAGO_COLLECTOR_ID"
    | "MERCADO_PAGO_BACK_URL",
    string
  >
>;

export function getBillingConfig(source: BillingEnvironment = process.env) {
  const rawEnvironment = source.MERCADO_PAGO_ENVIRONMENT?.trim().toUpperCase();
  const environment =
    rawEnvironment === "TEST" || rawEnvironment === "PRODUCTION" ? rawEnvironment : null;
  const url = (value?: string) => {
    try {
      const parsed = new URL(value?.trim() ?? "");
      return ["https:", "http:"].includes(parsed.protocol) &&
        !parsed.username &&
        !parsed.password &&
        (environment !== "PRODUCTION" || parsed.protocol === "https:")
        ? parsed.href
        : null;
    } catch {
      return null;
    }
  };
  const config = {
    accessToken: source.MERCADO_PAGO_ACCESS_TOKEN?.trim() || null,
    webhookSecret: source.MERCADO_PAGO_WEBHOOK_SECRET?.trim() || null,
    environment,
    applicationId: source.MERCADO_PAGO_APPLICATION_ID?.trim() || null,
    collectorId: source.MERCADO_PAGO_COLLECTOR_ID?.trim() || null,
    backUrl: url(source.MERCADO_PAGO_BACK_URL),
  };
  return { ...config, providerConfigured: Object.values(config).every(Boolean) };
}

export type MercadoPagoTestConfig = {
  environment: "TEST";
  accessToken: string;
  applicationId: string;
  collectorId: string;
  backUrl: string;
  timeoutMs: number;
};

// Separate from the legacy, disabled provider. Never fall back to generic/production keys.
export function getMercadoPagoTestConfig(
  source: Record<string, string | undefined> = process.env,
): MercadoPagoTestConfig | null {
  if (source.MERCADO_PAGO_ENVIRONMENT?.trim().toUpperCase() !== "TEST") return null;
  const accessToken = source.MERCADO_PAGO_TEST_ACCESS_TOKEN?.trim();
  const applicationId = source.MERCADO_PAGO_TEST_APPLICATION_ID?.trim();
  const collectorId = source.MERCADO_PAGO_TEST_COLLECTOR_ID?.trim();
  const timeoutMs = Number(source.MERCADO_PAGO_TEST_TIMEOUT_MS ?? 5000);
  if (
    !accessToken ||
    !/^[\x21-\x7e]+$/.test(accessToken) ||
    !applicationId ||
    !/^\d+$/.test(applicationId) ||
    !collectorId ||
    !/^\d+$/.test(collectorId) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000
  )
    return null;
  try {
    const url = new URL(source.MERCADO_PAGO_TEST_BACK_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return {
      environment: "TEST",
      accessToken,
      applicationId,
      collectorId,
      backUrl: url.href,
      timeoutMs,
    };
  } catch {
    return null;
  }
}
