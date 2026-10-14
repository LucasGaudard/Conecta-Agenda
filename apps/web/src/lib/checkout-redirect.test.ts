import assert from "node:assert/strict";
import { test } from "node:test";
import { getCheckoutRedirectUrl } from "./checkout-redirect";

const response = {
  checkoutUrl:
    "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=sim_fixture",
  provider: "MERCADO_PAGO" as const,
  subscriptionId: "internal",
  mode: "SIMULATED" as const,
};
test("simulated checkout never returns a navigation target", () => {
  assert.equal(getCheckoutRedirectUrl(response), null);
  assert.equal(
    getCheckoutRedirectUrl({ ...response, mode: undefined }),
    response.checkoutUrl,
  );
});
test("checkout URL rejects HTTP, lookalike hosts, credentials, other paths and injected query/fragment", () => {
  for (const checkoutUrl of [
    "http://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=x",
    "https://www.mercadopago.com.br.attacker.invalid/subscriptions/checkout?preapproval_id=x",
    "https://user:password@www.mercadopago.com.br/subscriptions/checkout?preapproval_id=x",
    "https://www.mercadopago.com.br/other?preapproval_id=x",
    response.checkoutUrl + "&redirect=https://attacker.invalid",
    response.checkoutUrl + "#fragment",
    response.checkoutUrl + "&preapproval_id=other",
  ])
    assert.throws(() => getCheckoutRedirectUrl({ ...response, checkoutUrl }));
});
