import type { BillingCheckoutResponse } from "@conecta-agenda/types";

export function getCheckoutRedirectUrl(response: BillingCheckoutResponse): string | null {
  const url = new URL(response.checkoutUrl);
  const id = url.searchParams.get("preapproval_id");
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.mercadopago.com.br" ||
    url.pathname !== "/subscriptions/checkout" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.searchParams.size !== 1 ||
    !id ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(id)
  )
    throw new Error("Endereço de pagamento inválido.");
  if (response.mode === "SIMULATED") return null;
  if (response.mode !== undefined) throw new Error("Modo de checkout inválido.");
  return url.href;
}
