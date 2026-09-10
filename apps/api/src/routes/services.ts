import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import { requireBusinessAccess } from "../middlewares/business-access";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import {
  serviceBodySchema,
  serviceParamsSchema,
  serviceStatusBodySchema,
  serviceStatusQuerySchema,
} from "../schemas/services";

type ServiceDTO = {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapService(service: {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ServiceDTO {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    priceInCents: service.priceInCents,
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

async function findOwnedService(serviceId: string, businessId: string) {
  return prisma.service.findFirst({
    where: {
      id: serviceId,
      businessId,
    },
  });
}

function handleServiceError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      statusCode: 409,
      message: "Ja existe um servico com este nome.",
    };
  }

  return {
    statusCode: 500,
    message: "Nao foi possivel processar o servico.",
  };
}

export async function servicesRoutes(app: FastifyInstance) {
  app.get(
    "/services",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedQuery = serviceStatusQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({ message: "Filtros invalidos." });
      }

      const { search, status } = parsedQuery.data;
      const where: Prisma.ServiceWhereInput = {
        businessId: request.user.businessId,
        ...(status === "active" ? { isActive: true } : {}),
        ...(status === "inactive" ? { isActive: false } : {}),
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      };

      const services = await prisma.service.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
      });

      return reply.send({
        services: services.map(mapService),
      });
    },
  );

  app.post(
    "/services",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedBody = serviceBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({
            message: parsedBody.error.issues[0]?.message ?? "Dados do servico invalidos.",
          });
      }

      try {
        const service = await prisma.service.create({
          data: {
            businessId: request.user.businessId,
            ...parsedBody.data,
          },
        });

        return reply.status(201).send({ service: mapService(service) });
      } catch (error) {
        const handledError = handleServiceError(error);
        request.log.error(error);
        return reply
          .status(handledError.statusCode)
          .send({ message: handledError.message });
      }
    },
  );

  app.put(
    "/services/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = serviceParamsSchema.safeParse(request.params);
      const parsedBody = serviceBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Servico invalido." });
      }

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({
            message: parsedBody.error.issues[0]?.message ?? "Dados do servico invalidos.",
          });
      }

      const existingService = await findOwnedService(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingService) {
        return reply.status(404).send({ message: "Servico nao encontrado." });
      }

      try {
        const service = await prisma.service.update({
          where: {
            id: existingService.id,
          },
          data: parsedBody.data,
        });

        return reply.send({ service: mapService(service) });
      } catch (error) {
        const handledError = handleServiceError(error);
        request.log.error(error);
        return reply
          .status(handledError.statusCode)
          .send({ message: handledError.message });
      }
    },
  );

  app.patch(
    "/services/:id/status",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = serviceParamsSchema.safeParse(request.params);
      const parsedBody = serviceStatusBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Servico invalido." });
      }

      if (!parsedBody.success) {
        return reply.status(400).send({ message: "Status invalido." });
      }

      const existingService = await findOwnedService(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingService) {
        return reply.status(404).send({ message: "Servico nao encontrado." });
      }

      const service = await prisma.service.update({
        where: {
          id: existingService.id,
        },
        data: {
          isActive: parsedBody.data.isActive,
        },
      });

      return reply.send({ service: mapService(service) });
    },
  );

  app.delete(
    "/services/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = serviceParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Servico invalido." });
      }

      const existingService = await findOwnedService(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingService) {
        return reply.status(404).send({ message: "Servico nao encontrado." });
      }

      await prisma.service.update({
        where: {
          id: existingService.id,
        },
        data: {
          isActive: false,
        },
      });

      return reply.send({ message: "Servico inativado com sucesso." });
    },
  );
}
