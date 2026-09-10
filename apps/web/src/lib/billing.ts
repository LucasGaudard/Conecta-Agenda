import type {
  BillingCheckoutResponse,
  BillingStatusResponse,
} from "@conecta-agenda/types";
import { apiFetch } from "./api";

export function getBillingStatus(token: string) {
  return apiFetch<BillingStatusResponse>("/billing/status", { token, cache: "no-store" });
}
export function createBillingCheckout(token: string) {
  return apiFetch<BillingCheckoutResponse>("/billing/checkout", {
    token,
    method: "POST",
  });
}
export function cancelBillingSubscription(token: string) {
  return apiFetch<{ message: string }>("/billing/cancel", { token, method: "POST" });
}
