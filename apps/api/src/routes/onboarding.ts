import type { FastifyInstance } from "fastify";

import { requireBusinessAccess } from "../middlewares/business-access";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import { completeOnboardingSchema } from "../schemas/business";
import {
  ensureSlugIsAvailable,
  getBusinessProfile,
  updateBusinessAndSettings,
} from "./business";

type OnboardingStatusResponse = {
  completed: boolean;
  missingFields: string[];
};

type UpdateBusinessProfileRequest = {
  name: string;
  slug: string;
  description?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  address?: string | null;
  instagram?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  timezone: string;
  currency: string;
  bookingIntervalMinutes: 15 | 30 | 45 | 60;
  allowCancellation: boolean;
  allowReschedule: boolean;
};

function getMissingFields(business: {
  name: string | null;
  slug: string | null;
  whatsapp: string | null;
  city: string | null;
}) {
  return (["name", "slug", "whatsapp", "city"] as const).filter((field) => {
    const value = business[field];
    return !value || value.trim().length === 0;
  });
}

export async function getOnboardingStatusByBusinessId(
  businessId: string,
): Promise<OnboardingStatusResponse | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      slug: true,
      whatsapp: true,
      city: true,
    },
  });

  if (!business) {
    return null;
  }

  const missingFields = getMissingFields(business);

  return {
    completed: missingFields.length === 0,
    missingFields,
  };
}

export async function onboardingRoutes(app: FastifyInstance) {
  app.get("/onboarding/status", { preHandler: authenticate }, async (request, reply) => {
    const status = await getOnboardingStatusByBusinessId(request.user.businessId);

    if (!status) {
      return reply.status(404).send({ message: "Negocio nao encontrado." });
    }

    return reply.send(status);
  });

  app.post(
    "/onboarding/complete",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsed = completeOnboardingSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: parsed.error.issues[0]?.message ?? "Dados de onboarding invalidos.",
        });
      }

      const isSlugAvailable = await ensureSlugIsAvailable(
        parsed.data.slug,
        request.user.businessId,
      );

      if (!isSlugAvailable) {
        return reply.status(409).send({ message: "Este slug ja esta em uso." });
      }

      const updatePayload: UpdateBusinessProfileRequest = {
        name: parsed.data.name,
        slug: parsed.data.slug,
        whatsapp: parsed.data.whatsapp,
        city: parsed.data.city,
        address: parsed.data.address,
        description: parsed.data.description,
        instagram: parsed.data.instagram,
        logoUrl: null,
        primaryColor: parsed.data.primaryColor,
        timezone: parsed.data.timezone,
        currency: "BRL",
        bookingIntervalMinutes: parsed.data.bookingIntervalMinutes,
        allowCancellation: true,
        allowReschedule: true,
      };

      try {
        await updateBusinessAndSettings(request.user.businessId, updatePayload);
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ message: "Nao foi possivel concluir o onboarding." });
      }

      const profile = await getBusinessProfile(request.user.businessId);
      return reply.send(profile);
    },
  );
}
