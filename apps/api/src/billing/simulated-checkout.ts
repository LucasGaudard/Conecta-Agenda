import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import {
  MercadoPagoTestHttpClient,
  type SimulatedHttpTransport,
} from "./mercado-pago-http";
import { PrismaCheckoutRepository } from "./checkout-repository";
import { SimulatedCheckoutService, simulatedCheckoutEnabled } from "./checkout-service";
import type { MercadoPagoTestConfig } from "./config";

const config: MercadoPagoTestConfig = {
  environment: "TEST",
  accessToken: "simulation-only-token",
  applicationId: "1001",
  collectorId: "2001",
  backUrl: "https://example.invalid/simulated-return",
  timeoutMs: 5000,
};

export function createDefaultSimulatedCheckout(
  source: Record<string, string | undefined> = process.env,
) {
  if (!simulatedCheckoutEnabled(source)) return undefined;
  const resources = new Map<string, object>();
  const transport: SimulatedHttpTransport = {
    mode: "SIMULATED",
    async send(rawUrl, init) {
      const url = new URL(rawUrl);
      if (url.origin !== "https://api.mercadopago.com")
        throw new Error("Simulation origin refused");
      if (init.method === "GET" && url.pathname.startsWith("/preapproval_plan/")) {
        const mapping = await prisma.providerPlan.findFirst({
          where: {
            provider: "MERCADO_PAGO",
            environment: "TEST",
            providerPlanId: decodeURIComponent(
              url.pathname.slice("/preapproval_plan/".length),
            ),
            isActive: true,
          },
          include: { plan: true },
        });
        if (!mapping) return { status: 404, json: async () => ({}) };
        return {
          status: 200,
          json: async () => ({
            id: mapping.providerPlanId,
            application_id: config.applicationId,
            collector_id: config.collectorId,
            status: "active",
            auto_recurring: {
              frequency: 1,
              frequency_type: "months",
              currency_id: "BRL",
              transaction_amount: mapping.plan.priceInCents / 100,
            },
          }),
        };
      }
      if (init.method === "POST" && url.pathname === "/preapproval") {
        const body = JSON.parse(init.body ?? "{}");
        const id = `sim_${randomUUID()}`;
        const result = {
          id,
          application_id: config.applicationId,
          collector_id: config.collectorId,
          preapproval_plan_id: body.preapproval_plan_id,
          external_reference: body.external_reference,
          status: "authorized",
          init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`,
        };
        resources.set(id, result);
        return { status: 201, json: async () => result };
      }
      if (init.method === "GET" && url.pathname.startsWith("/preapproval/")) {
        const result = resources.get(
          decodeURIComponent(url.pathname.slice("/preapproval/".length)),
        );
        return { status: result ? 200 : 404, json: async () => result ?? {} };
      }
      return { status: 400, json: async () => ({}) };
    },
  };
  // Describes HTTP in-process, never fetches a URL or reads actual Mercado Pago credentials.
  return new SimulatedCheckoutService(
    new PrismaCheckoutRepository(prisma),
    new MercadoPagoTestHttpClient(config, transport),
    config,
    source,
  );
}
