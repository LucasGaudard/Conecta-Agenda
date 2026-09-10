import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import { requireBusinessAccess } from "../middlewares/business-access";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import { updateBusinessProfileSchema } from "../schemas/business";

type BusinessSettingsDTO = {
  timezone: string;
  currency: string;
  bookingIntervalMinutes: number;
  allowCancellation: boolean;
  allowReschedule: boolean;
};

type BusinessProfileResponse = {
  business: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    whatsapp: string | null;
    city: string | null;
    address: string | null;
    instagram: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
  };
  settings: BusinessSettingsDTO;
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

function mapSettings(settings: BusinessSettingsDTO | null): BusinessSettingsDTO {
  return {
    timezone: settings?.timezone ?? "America/Sao_Paulo",
    currency: settings?.currency ?? "BRL",
    bookingIntervalMinutes: settings?.bookingIntervalMinutes ?? 30,
    allowCancellation: settings?.allowCancellation ?? true,
    allowReschedule: settings?.allowReschedule ?? true,
  };
}

async function ensureSlugIsAvailable(slug: string, businessId: string) {
  const existingBusiness = await prisma.business.findUnique({
    where: { slug },
    select: { id: true },
  });

  return !existingBusiness || existingBusiness.id === businessId;
}

export async function getBusinessProfile(
  businessId: string,
): Promise<BusinessProfileResponse | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      whatsapp: true,
      city: true,
      address: true,
      instagram: true,
      logoUrl: true,
      primaryColor: true,
      settings: {
        select: {
          timezone: true,
          currency: true,
          bookingIntervalMinutes: true,
          allowCancellation: true,
          allowReschedule: true,
        },
      },
    },
  });

  if (!business) {
    return null;
  }

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      description: business.description,
      whatsapp: business.whatsapp,
      city: business.city,
      address: business.address,
      instagram: business.instagram,
      logoUrl: business.logoUrl,
      primaryColor: business.primaryColor,
    },
    settings: mapSettings(business.settings),
  };
}

async function updateBusinessAndSettings(
  businessId: string,
  data: UpdateBusinessProfileRequest,
) {
  return prisma.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: businessId },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
        whatsapp: data.whatsapp,
        city: data.city,
        address: data.address,
        instagram: data.instagram,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
      },
    });

    await tx.businessSettings.upsert({
      where: { businessId },
      update: {
        timezone: data.timezone,
        currency: data.currency,
        bookingIntervalMinutes: data.bookingIntervalMinutes,
        allowCancellation: data.allowCancellation,
        allowReschedule: data.allowReschedule,
      },
      create: {
        businessId,
        timezone: data.timezone,
        currency: data.currency,
        bookingIntervalMinutes: data.bookingIntervalMinutes,
        allowCancellation: data.allowCancellation,
        allowReschedule: data.allowReschedule,
      },
    });
  });
}

export async function businessRoutes(app: FastifyInstance) {
  app.get("/business/me", { preHandler: authenticate }, async (request, reply) => {
    const profile = await getBusinessProfile(request.user.businessId);

    if (!profile) {
      return reply.status(404).send({ message: "Negocio nao encontrado." });
    }

    return reply.send(profile);
  });

  app.put(
    "/business/me",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsed = updateBusinessProfileSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          message: parsed.error.issues[0]?.message ?? "Dados do negocio invalidos.",
        });
      }

      const isSlugAvailable = await ensureSlugIsAvailable(
        parsed.data.slug,
        request.user.businessId,
      );

      if (!isSlugAvailable) {
        return reply.status(409).send({ message: "Este slug ja esta em uso." });
      }

      try {
        await updateBusinessAndSettings(request.user.businessId, parsed.data);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.status(409).send({ message: "Este slug ja esta em uso." });
        }

        request.log.error(error);
        return reply
          .status(500)
          .send({ message: "Nao foi possivel atualizar o negocio." });
      }

      const profile = await getBusinessProfile(request.user.businessId);
      return reply.send(profile);
    },
  );
}

export { ensureSlugIsAvailable, updateBusinessAndSettings };
