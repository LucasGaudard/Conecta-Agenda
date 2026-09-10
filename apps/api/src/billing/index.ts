import { getBillingConfig } from "./config";
import { MercadoPagoBillingProvider } from "./mercado-pago-provider";
import { UnconfiguredBillingProvider } from "./unconfigured-provider";
import type { BillingProvider } from "./provider";

export function getBillingProvider(config = getBillingConfig()): BillingProvider {
  return config.providerConfigured
    ? new MercadoPagoBillingProvider(config)
    : new UnconfiguredBillingProvider();
}
export function getBillingCapabilities() {
  return {
    provider: "MERCADO_PAGO" as const,
    providerConfigured: getBillingConfig().providerConfigured,
    checkoutAvailable: false,
    cancellationAvailable: false,
  };
}
