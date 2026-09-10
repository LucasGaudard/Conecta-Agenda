export type CheckoutInput = {
  subscriptionId: string;
  userId: string;
  businessId: string;
  plan: { id: string; priceInCents: number };
};
export type CheckoutResult = {
  checkoutUrl: string;
  provider: "MERCADO_PAGO";
  subscriptionId: string;
};
export type ProviderSubscription = { providerSubscriptionId: string; status: string };

export interface BillingProvider {
  createSubscriptionCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  getSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  reactivateSubscription(providerSubscriptionId: string): Promise<void>;
}

export class BillingProviderError extends Error {
  readonly statusCode = 503;
  constructor(
    public readonly code:
      "BILLING_PROVIDER_NOT_CONFIGURED" | "BILLING_PROVIDER_NOT_IMPLEMENTED",
  ) {
    super(
      code === "BILLING_PROVIDER_NOT_CONFIGURED"
        ? "Pagamento online ainda não está configurado."
        : "Pagamento online ainda não está disponível. Entre em contato com o suporte.",
    );
  }
}
