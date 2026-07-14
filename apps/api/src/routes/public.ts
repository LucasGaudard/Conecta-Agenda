import type { FastifyInstance } from "fastify";
import { AppointmentStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import {
  availableTimesQuerySchema,
  createPublicAppointmentSchema,
  publicSlugParamsSchema,
} from "../schemas/public";
import { addMinutesToTime } from "../utils/time";
import { calculateAvailableTimes, parseDateOnly } from "../utils/availability";

function mapPublicBusiness(business: {
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
  settings: {
    bookingIntervalMinutes: number;
    allowCancellation: boolean;
    allowReschedule: boolean;
  } | null;
}) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    description: business.description,
    whatsapp: business.whatsapp,
    city: business.city,
    address: business.address,
    instagram: business.instagram,
    logoUrl: business.logoUrl,
    primaryColor: business.primaryColor ?? "#111827",
    settings: {
      bookingIntervalMinutes: business.settings?.bookingIntervalMinutes ?? 30,
      allowCancellation: business.settings?.allowCancellation ?? true,
      allowReschedule: business.settings?.allowReschedule ?? true,
    },
  };
}

function mapPublicService(service: {
  id: string;
  name: string;
  description: string | null;
  priceInCents: number;
  durationMinutes: number;
}) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    priceInCents: service.priceInCents,
    durationMinutes: service.durationMinutes,
  };
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/public/:slug", async (request, reply) => {
    const parsedParams = publicSlugParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({ message: "Slug invalido." });
    }

    const { slug } = parsedParams.data;

    const business = await prisma.business.findUnique({
      where: { slug },
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
            bookingIntervalMinutes: true,
            allowCancellation: true,
            allowReschedule: true,
          },
        },
      },
    });

    if (!business) {
      return reply.status(404).send({ message: "Profissional nao encontrado." });
    }

    return reply.send({ business: mapPublicBusiness(business) });
  });

  app.get("/public/:slug/services", async (request, reply) => {
    const parsedParams = publicSlugParamsSchema.safeParse(request.params);

    if (!parsedParams.success) {
      return reply.status(400).send({ message: "Slug invalido." });
    }

    const { slug } = parsedParams.data;

    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
      },
    });

    if (!business) {
      return reply.status(404).send({ message: "Profissional nao encontrado." });
    }

    const services = await prisma.service.findMany({
      where: {
        businessId: business.id,
        isActive: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        priceInCents: true,
        durationMinutes: true,
      },
    });

    return reply.send({ services: services.map(mapPublicService) });
  });

  app.get("/public/:slug/available-times", async (request, reply) => {
    const parsedParams = publicSlugParamsSchema.safeParse(request.params);
    const parsedQuery = availableTimesQuerySchema.safeParse(request.query);

    if (!parsedParams.success) {
      return reply.status(400).send({ message: "Slug invalido." });
    }

    if (!parsedQuery.success) {
      return reply
        .status(400)
        .send({ message: parsedQuery.error.issues[0]?.message ?? "Parametros invalidos." });
    }

    const business = await prisma.business.findUnique({
      where: { slug: parsedParams.data.slug },
      select: { id: true },
    });

    if (!business) {
      return reply.status(404).send({ message: "Profissional nao encontrado." });
    }

    const result = await calculateAvailableTimes({
      businessId: business.id,
      serviceId: parsedQuery.data.serviceId,
      date: parsedQuery.data.date,
    });

    if (!result.service) {
      return reply.status(404).send({ message: "Servico nao encontrado." });
    }

    return reply.send({
      date: parsedQuery.data.date,
      service: result.service,
      availableTimes: result.availableTimes,
    });
  });

  app.post("/public/:slug/appointments", async (request, reply) => {
    const parsedParams = publicSlugParamsSchema.safeParse(request.params);
    const parsedBody = createPublicAppointmentSchema.safeParse(request.body);

    if (!parsedParams.success) {
      return reply.status(400).send({ message: "Slug invalido." });
    }

    if (!parsedBody.success) {
      return reply
        .status(400)
        .send({ message: parsedBody.error.issues[0]?.message ?? "Dados invalidos." });
    }

    const business = await prisma.business.findUnique({
      where: { slug: parsedParams.data.slug },
      select: {
        id: true,
        name: true,
        whatsapp: true,
      },
    });

    if (!business) {
      return reply.status(404).send({ message: "Profissional nao encontrado." });
    }

    const result = await calculateAvailableTimes({
      businessId: business.id,
      serviceId: parsedBody.data.serviceId,
      date: parsedBody.data.date,
    });

    if (!result.service) {
      return reply.status(404).send({ message: "Servico nao encontrado." });
    }

    const service = result.service;

    if (!result.availableTimes.includes(parsedBody.data.startTime)) {
      return reply.status(409).send({ message: "Este horario nao esta mais disponivel." });
    }

    const endTime = addMinutesToTime(parsedBody.data.startTime, service.durationMinutes);

    const appointment = await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findFirst({
        where: {
          businessId: business.id,
          whatsapp: parsedBody.data.customerWhatsapp,
        },
        select: {
          id: true,
          name: true,
          whatsapp: true,
        },
      });

      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              name: parsedBody.data.customerName,
            },
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          })
        : await tx.customer.create({
            data: {
              businessId: business.id,
              name: parsedBody.data.customerName,
              whatsapp: parsedBody.data.customerWhatsapp,
            },
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          });

      const createdAppointment = await tx.appointment.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          serviceId: service.id,
          serviceName: service.name,
          priceInCents: service.priceInCents,
          durationMinutes: service.durationMinutes,
          date: parseDateOnly(parsedBody.data.date),
          startTime: parsedBody.data.startTime,
          endTime,
          status: AppointmentStatus.SCHEDULED,
          notes: parsedBody.data.notes,
        },
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          serviceName: true,
          priceInCents: true,
          durationMinutes: true,
        },
      });

      return {
        ...createdAppointment,
        customer,
      };
    });

    return reply.status(201).send({
      appointment: {
        id: appointment.id,
        date: appointment.date.toISOString().slice(0, 10),
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        serviceName: appointment.serviceName,
        priceInCents: appointment.priceInCents,
        durationMinutes: appointment.durationMinutes,
        customer: {
          name: appointment.customer.name,
          whatsapp: appointment.customer.whatsapp,
        },
      },
      business: {
        name: business.name,
        whatsapp: business.whatsapp,
      },
    });
  });
}
