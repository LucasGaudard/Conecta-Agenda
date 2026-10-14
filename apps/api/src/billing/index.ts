import { getBillingConfig } from "./config";
import { MercadoPagoBillingProvider } from "./mercado-pago-provider";
import { UnconfiguredBillingProvider } from "./unconfigured-provider";
import type { BillingProvider } from "./provider";

export function getBillingProvider(config = getBillingConfig()): BillingProvider {
  return config.providerConfigured
    ? new MercadoPagoBillingProvider(config)
    : new UnconfiguredBillingProvider();
}
export function getBillingCapabilities(simulatedCheckout = false) {
  return {
    provider: "MERCADO_PAGO" as const,
    providerConfigured: simulatedCheckout || getBillingConfig().providerConfigured,
    checkoutAvailable: simulatedCheckout,
    cancellationAvailable: false,
    ...(simulatedCheckout ? { checkoutMode: "SIMULATED" as const } : {}),
  };
}
