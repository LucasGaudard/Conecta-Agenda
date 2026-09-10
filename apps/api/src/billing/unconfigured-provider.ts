import { BillingProviderError, type BillingProvider } from "./provider";

export class UnconfiguredBillingProvider implements BillingProvider {
  protected error(): BillingProviderError {
    return new BillingProviderError("BILLING_PROVIDER_NOT_CONFIGURED");
  }
  createSubscriptionCheckout(): ReturnType<
    BillingProvider["createSubscriptionCheckout"]
  > {
    return Promise.reject(this.error());
  }
  getSubscription(): ReturnType<BillingProvider["getSubscription"]> {
    return Promise.reject(this.error());
  }
  cancelSubscription(): Promise<void> {
    return Promise.reject(this.error());
  }
  reactivateSubscription(): Promise<void> {
    return Promise.reject(this.error());
  }
}
