import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";

import { requireBusinessAccess } from "../middlewares/business-access";
import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import {
  customerBodySchema,
  customerParamsSchema,
  customersQuerySchema,
} from "../schemas/customers";

type CustomerWithStats = {
  id: string;
  name: string;
  whatsapp: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  appointments: Array<{
    date: Date;
    startTime: string;
  }>;
  _count: {
    appointments: number;
  };
};

function mapCustomer(customer: CustomerWithStats) {
  const lastAppointment = customer.appointments[0];

  return {
    id: customer.id,
    name: customer.name,
    whatsapp: customer.whatsapp,
    notes: customer.notes,
    lastAppointment: lastAppointment
      ? {
          date: lastAppointment.date.toISOString(),
          startTime: lastAppointment.startTime,
        }
      : null,
    appointmentsCount: customer._count.appointments,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

async function findOwnedCustomer(customerId: string, businessId: string) {
  return prisma.customer.findFirst({
    where: {
      id: customerId,
      businessId,
    },
    include: {
      appointments: {
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        take: 1,
        select: {
          date: true,
          startTime: true,
        },
      },
      _count: {
        select: {
          appointments: true,
        },
      },
    },
  });
}

async function isWhatsappAvailable(
  whatsapp: string,
  businessId: string,
  customerId?: string,
) {
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      businessId,
      whatsapp,
      ...(customerId ? { id: { not: customerId } } : {}),
    },
    select: {
      id: true,
    },
  });

  return !existingCustomer;
}

function handleCustomerError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return {
      statusCode: 409,
      message: "Ja existe um cliente com este WhatsApp.",
    };
  }

  return {
    statusCode: 500,
    message: "Nao foi possivel processar o cliente.",
  };
}

export async function customersRoutes(app: FastifyInstance) {
  app.get(
    "/customers",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedQuery = customersQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply.status(400).send({ message: "Filtros invalidos." });
      }

      const search = parsedQuery.data.search;
      const where: Prisma.CustomerWhereInput = {
        businessId: request.user.businessId,
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
                  whatsapp: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      };

      const customers = await prisma.customer.findMany({
        where,
        orderBy: {
          name: "asc",
        },
        include: {
          appointments: {
            orderBy: [{ date: "desc" }, { startTime: "desc" }],
            take: 1,
            select: {
              date: true,
              startTime: true,
            },
          },
          _count: {
            select: {
              appointments: true,
            },
          },
        },
      });

      return reply.send({
        customers: customers.map(mapCustomer),
      });
    },
  );

  app.get(
    "/customers/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = customerParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Cliente invalido." });
      }

      const customer = await findOwnedCustomer(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!customer) {
        return reply.status(404).send({ message: "Cliente nao encontrado." });
      }

      return reply.send({ customer: mapCustomer(customer) });
    },
  );

  app.post(
    "/customers",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedBody = customerBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({
            message: parsedBody.error.issues[0]?.message ?? "Dados do cliente invalidos.",
          });
      }

      const whatsappAvailable = await isWhatsappAvailable(
        parsedBody.data.whatsapp,
        request.user.businessId,
      );

      if (!whatsappAvailable) {
        return reply
          .status(409)
          .send({ message: "Ja existe um cliente com este WhatsApp." });
      }

      try {
        const customer = await prisma.customer.create({
          data: {
            businessId: request.user.businessId,
            ...parsedBody.data,
          },
        });
        const customerWithStats = await findOwnedCustomer(
          customer.id,
          request.user.businessId,
        );

        if (!customerWithStats) {
          return reply.status(404).send({ message: "Cliente nao encontrado." });
        }

        return reply.status(201).send({ customer: mapCustomer(customerWithStats) });
      } catch (error) {
        const handledError = handleCustomerError(error);
        request.log.error(error);
        return reply
          .status(handledError.statusCode)
          .send({ message: handledError.message });
      }
    },
  );

  app.put(
    "/customers/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = customerParamsSchema.safeParse(request.params);
      const parsedBody = customerBodySchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Cliente invalido." });
      }

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({
            message: parsedBody.error.issues[0]?.message ?? "Dados do cliente invalidos.",
          });
      }

      const existingCustomer = await findOwnedCustomer(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingCustomer) {
        return reply.status(404).send({ message: "Cliente nao encontrado." });
      }

      const whatsappAvailable = await isWhatsappAvailable(
        parsedBody.data.whatsapp,
        request.user.businessId,
        existingCustomer.id,
      );

      if (!whatsappAvailable) {
        return reply
          .status(409)
          .send({ message: "Ja existe um cliente com este WhatsApp." });
      }

      try {
        await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: parsedBody.data,
        });

        const customer = await findOwnedCustomer(
          existingCustomer.id,
          request.user.businessId,
        );

        if (!customer) {
          return reply.status(404).send({ message: "Cliente nao encontrado." });
        }

        return reply.send({ customer: mapCustomer(customer) });
      } catch (error) {
        const handledError = handleCustomerError(error);
        request.log.error(error);
        return reply
          .status(handledError.statusCode)
          .send({ message: handledError.message });
      }
    },
  );
}
