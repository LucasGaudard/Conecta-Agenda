import { getBillingConfig } from "./config";
import { BillingProviderError } from "./provider";
import { UnconfiguredBillingProvider } from "./unconfigured-provider";

export class MercadoPagoBillingProvider extends UnconfiguredBillingProvider {
  constructor(private readonly config: ReturnType<typeof getBillingConfig>) {
    super();
  }
  protected override error(): BillingProviderError {
    if (!this.config.providerConfigured)
      return new BillingProviderError("BILLING_PROVIDER_NOT_CONFIGURED");
    // TODO: implement official provider operations, idempotency and persisted references.
    // Configuration alone must never enable a simulated or unverified financial operation.
    return new BillingProviderError("BILLING_PROVIDER_NOT_IMPLEMENTED");
  }
}
