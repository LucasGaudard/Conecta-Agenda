import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { resolveBusinessAccess } from "../domain/business-access";

export const businessAccessSelect = {
  isManuallyBlocked: true,
  accessOverrideUntil: true,
  user: {
    select: {
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
        },
      },
    },
  },
} as const;

export async function requireBusinessAccess(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.user.role === "SUPER_ADMIN") return;
  const business = request.user.businessId
    ? await prisma.business.findUnique({
        where: { id: request.user.businessId },
        select: businessAccessSelect,
      })
    : null;
  if (!business)
    return reply
      .status(403)
      .send({ message: "Negócio não encontrado.", code: "BUSINESS_ACCESS_BLOCKED" });
  const access = resolveBusinessAccess({
    ...business,
    subscription: business.user.subscription,
  });
  if (!access.canAccess)
    return reply.status(access.isManuallyBlocked ? 403 : 402).send({
      message: access.reason,
      code: "BUSINESS_ACCESS_BLOCKED",
      access,
    });
}
