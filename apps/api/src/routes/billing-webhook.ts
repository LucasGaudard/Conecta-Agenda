import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getBillingConfig } from "../billing/config";

const notification = z.object({
  type: z.string().trim().min(1).max(100),
  data: z.object({
    id: z.union([z.string().trim().min(1).max(200), z.number().int().nonnegative()]),
  }),
});

export async function billingWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/mercado-pago", { bodyLimit: 16384 }, async (request, reply) => {
    if (!notification.safeParse(request.body).success)
      return reply
        .status(400)
        .send({ code: "BILLING_WEBHOOK_INVALID", message: "Notificação inválida." });
    if (!getBillingConfig().webhookSecret)
      return reply
        .status(503)
        .send({
          code: "BILLING_PROVIDER_NOT_CONFIGURED",
          message: "Pagamento online ainda não está configurado.",
        });
    // TODO: official signature verification, replay protection and authoritative provider lookup.
    // Never acknowledge processing or mutate subscriptions based on this unverified body.
    return reply
      .status(503)
      .send({
        code: "BILLING_WEBHOOK_NOT_IMPLEMENTED",
        message: "Processamento de notificações ainda indisponível.",
        processed: false,
      });
  });
}
