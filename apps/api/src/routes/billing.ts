import type { FastifyInstance } from "fastify";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import { resolveBusinessAccess } from "../domain/business-access";
import { z } from "zod";
import { getBillingCapabilities, getBillingProvider } from "../billing";
import { BillingProviderError } from "../billing/provider";
import { CheckoutError } from "../billing/checkout-repository";
import type { SimulatedCheckoutService } from "../billing/checkout-service";
import { createDefaultSimulatedCheckout } from "../billing/simulated-checkout";

export type BillingRoutesOptions = { checkoutService?: SimulatedCheckoutService };

export async function billingRoutes(
  app: FastifyInstance,
  options: BillingRoutesOptions = {},
) {
  const checkoutService = options.checkoutService ?? createDefaultSimulatedCheckout();
  for (const operation of ["checkout", "cancel"] as const) {
    app.post(
      `/billing/${operation}`,
      { preHandler: authenticate },
      async (request, reply) => {
        if (request.user.role !== "PROFESSIONAL" || !request.user.businessId)
          return reply
            .status(403)
            .send({ message: "Acesso exclusivo do profissional com negócio." });
        if (
          !z
            .object({})
            .strict()
            .safeParse(request.body ?? {}).success ||
          !z.object({}).strict().safeParse(request.query).success
        )
          return reply.status(400).send({
            code: "BILLING_INVALID_REQUEST",
            message: "Esta operação não aceita parâmetros externos.",
          });
        const business = await prisma.business.findUnique({
          where: { id: request.user.businessId },
          select: {
            id: true,
            user: {
              select: {
                id: true,
                subscription: {
                  select: {
                    id: true,
                    plan: { select: { id: true, priceInCents: true } },
                  },
                },
              },
            },
          },
        });
        if (!business)
          return reply.status(403).send({ message: "Negócio não encontrado." });
        if (operation === "checkout" && checkoutService) {
          try {
            return reply.send(
              await checkoutService.checkout({
                userId: request.user.id,
                businessId: request.user.businessId,
              }),
            );
          } catch (error) {
            if (error instanceof CheckoutError)
              return reply
                .status(error.statusCode)
                .send({ code: error.code, message: error.message });
            return reply
              .status(503)
              .send({
                code: "BILLING_CHECKOUT_UNAVAILABLE",
                message: "Checkout de teste temporariamente indisponível.",
              });
          }
        }
        const capabilities = getBillingCapabilities();
        try {
          if (!capabilities.providerConfigured)
            throw new BillingProviderError("BILLING_PROVIDER_NOT_CONFIGURED");
          // No persisted provider reference or cancellation implementation exists yet.
          if (operation === "cancel")
            throw new BillingProviderError("BILLING_PROVIDER_NOT_IMPLEMENTED");
          const subscription = business.user.subscription;
          if (!subscription)
            return reply.status(409).send({
              code: "BILLING_SUBSCRIPTION_NOT_FOUND",
              message: "Entre em contato com o suporte para definir seu plano.",
            });
          return reply.send(
            await getBillingProvider().createSubscriptionCheckout({
              businessId: business.id,
              userId: business.user.id,
              subscriptionId: subscription.id,
              plan: subscription.plan,
            }),
          );
        } catch (error) {
          if (error instanceof BillingProviderError)
            return reply
              .status(error.statusCode)
              .send({ code: error.code, message: error.message });
          throw error;
        }
      },
    );
  }
  app.get("/billing/status", { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== "PROFESSIONAL" || !request.user.businessId)
      return reply
        .status(403)
        .send({ message: "Acesso exclusivo do profissional com negócio." });
    const business = await prisma.business.findUnique({
      where: { id: request.user.businessId },
      select: {
        isManuallyBlocked: true,
        accessOverrideUntil: true,
        user: {
          select: {
            subscription: {
              select: {
                status: true,
                trialEndsAt: true,
                currentPeriodStart: true,
                currentPeriodEnd: true,
                plan: { select: { name: true, slug: true, priceInCents: true } },
              },
            },
          },
        },
      },
    });
    if (!business) return reply.status(403).send({ message: "Negócio não encontrado." });
    const subscription = business.user.subscription;
    return reply.send({
      ...getBillingCapabilities(Boolean(checkoutService)),
      nextPaymentAt: null,
      ...resolveBusinessAccess({ ...business, subscription }),
      plan: subscription?.plan ?? null,
      priceInCents: subscription?.plan.priceInCents ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      currentPeriodStart: subscription?.currentPeriodStart ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      blockReason: business.isManuallyBlocked
        ? "Entre em contato com o suporte para verificar sua conta."
        : null,
    });
  });
}
