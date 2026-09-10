import type { FastifyInstance } from "fastify";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { requireBusinessAccess } from "../middlewares/business-access";
import { authenticate } from "../middlewares/auth";
import {
  appointmentAvailableTimesQuerySchema,
  appointmentParamsSchema,
  appointmentsQuerySchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  updateAppointmentStatusSchema,
} from "../schemas/appointments";
import { calculateAvailableTimes, parseDateOnly } from "../utils/availability";
import { addMinutesToTime } from "../utils/time";

type AppointmentWithRelations = {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  serviceName: string;
  priceInCents: number;
  durationMinutes: number;
  notes: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  customer: {
    id: string;
    name: string;
    whatsapp: string | null;
  };
  service: {
    id: string;
    name: string;
  } | null;
};

const finalAppointmentStatuses = new Set<AppointmentStatus>([
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELED,
]);

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function mapAppointment(appointment: AppointmentWithRelations) {
  return {
    id: appointment.id,
    date: appointment.date.toISOString().slice(0, 10),
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    serviceName: appointment.serviceName,
    priceInCents: appointment.priceInCents,
    durationMinutes: appointment.durationMinutes,
    notes: appointment.notes,
    customer: appointment.customer,
    service: appointment.service,
    ...(appointment.createdAt ? { createdAt: appointment.createdAt.toISOString() } : {}),
    ...(appointment.updatedAt ? { updatedAt: appointment.updatedAt.toISOString() } : {}),
  };
}

async function findOwnedAppointment(id: string, businessId: string) {
  return prisma.appointment.findFirst({
    where: {
      id,
      businessId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          whatsapp: true,
        },
      },
      service: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function appointmentsRoutes(app: FastifyInstance) {
  app.get(
    "/appointments",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedQuery = appointmentsQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send({
            message: parsedQuery.error.issues[0]?.message ?? "Filtros invalidos.",
          });
      }

      const where: Prisma.AppointmentWhereInput = {
        businessId: request.user.businessId,
      };

      if (parsedQuery.data.date) {
        const date = parseDateOnly(parsedQuery.data.date);
        where.date = {
          gte: date,
          lt: addDays(date, 1),
        };
      } else if (parsedQuery.data.from || parsedQuery.data.to) {
        where.date = {
          ...(parsedQuery.data.from ? { gte: parseDateOnly(parsedQuery.data.from) } : {}),
          ...(parsedQuery.data.to
            ? { lt: addDays(parseDateOnly(parsedQuery.data.to), 1) }
            : {}),
        };
      }

      if (parsedQuery.data.status) {
        where.status = parsedQuery.data.status;
      }

      const appointments = await prisma.appointment.findMany({
        where,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({ appointments: appointments.map(mapAppointment) });
    },
  );

  app.get(
    "/appointments/available-times",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedQuery = appointmentAvailableTimesQuerySchema.safeParse(request.query);

      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send({
            message: parsedQuery.error.issues[0]?.message ?? "Parametros invalidos.",
          });
      }

      if (parsedQuery.data.ignoreAppointmentId) {
        const appointment = await prisma.appointment.findFirst({
          where: {
            id: parsedQuery.data.ignoreAppointmentId,
            businessId: request.user.businessId,
          },
          select: {
            id: true,
          },
        });

        if (!appointment) {
          return reply.status(404).send({ message: "Agendamento nao encontrado." });
        }
      }

      const result = await calculateAvailableTimes({
        businessId: request.user.businessId,
        serviceId: parsedQuery.data.serviceId,
        date: parsedQuery.data.date,
        ignoreAppointmentId: parsedQuery.data.ignoreAppointmentId,
      });

      if (!result.service) {
        return reply.status(404).send({ message: "Servico nao encontrado." });
      }

      return reply.send({
        date: parsedQuery.data.date,
        service: result.service,
        availableTimes: result.availableTimes,
      });
    },
  );

  app.get(
    "/appointments/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = appointmentParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Agendamento invalido." });
      }

      const appointment = await findOwnedAppointment(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!appointment) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      return reply.send({ appointment: mapAppointment(appointment) });
    },
  );

  app.post(
    "/appointments",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedBody = createAppointmentSchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ message: parsedBody.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const availability = await calculateAvailableTimes({
        businessId: request.user.businessId,
        serviceId: parsedBody.data.serviceId,
        date: parsedBody.data.date,
      });

      if (!availability.service) {
        return reply.status(404).send({ message: "Servico nao encontrado." });
      }

      const service = availability.service;

      if (!availability.availableTimes.includes(parsedBody.data.startTime)) {
        return reply
          .status(409)
          .send({ message: "Este horario nao esta mais disponivel." });
      }

      let appointment;

      try {
        appointment = await prisma.$transaction(async (tx) => {
          let customerId = parsedBody.data.customerId;

          if (customerId) {
            const existingCustomer = await tx.customer.findFirst({
              where: {
                id: customerId,
                businessId: request.user.businessId,
              },
              select: {
                id: true,
              },
            });

            if (!existingCustomer) {
              throw new Error("CUSTOMER_NOT_FOUND");
            }
          } else {
            const customerWhatsapp = parsedBody.data.customerWhatsapp ?? "";
            const customerName = parsedBody.data.customerName ?? "";
            const existingCustomer = await tx.customer.findFirst({
              where: {
                businessId: request.user.businessId,
                whatsapp: customerWhatsapp,
              },
              select: {
                id: true,
              },
            });

            if (existingCustomer) {
              customerId = existingCustomer.id;
            } else {
              const customer = await tx.customer.create({
                data: {
                  businessId: request.user.businessId,
                  name: customerName,
                  whatsapp: customerWhatsapp,
                },
                select: {
                  id: true,
                },
              });

              customerId = customer.id;
            }
          }

          return tx.appointment.create({
            data: {
              businessId: request.user.businessId,
              customerId,
              serviceId: service.id,
              serviceName: service.name,
              priceInCents: service.priceInCents,
              durationMinutes: service.durationMinutes,
              date: parseDateOnly(parsedBody.data.date),
              startTime: parsedBody.data.startTime,
              endTime: addMinutesToTime(
                parsedBody.data.startTime,
                service.durationMinutes,
              ),
              status: AppointmentStatus.SCHEDULED,
              notes: parsedBody.data.notes,
            },
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  whatsapp: true,
                },
              },
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });
        });
      } catch (error) {
        if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") {
          return reply.status(404).send({ message: "Cliente nao encontrado." });
        }

        request.log.error(error);
        return reply
          .status(500)
          .send({ message: "Nao foi possivel criar o agendamento." });
      }

      return reply.status(201).send({ appointment: mapAppointment(appointment) });
    },
  );

  app.put(
    "/appointments/:id/status",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = appointmentParamsSchema.safeParse(request.params);
      const parsedBody = updateAppointmentStatusSchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Agendamento invalido." });
      }

      if (!parsedBody.success) {
        return reply.status(400).send({ message: "Status invalido." });
      }

      const existingAppointment = await findOwnedAppointment(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingAppointment) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      if (finalAppointmentStatuses.has(existingAppointment.status)) {
        return reply
          .status(400)
          .send({ message: "Este agendamento possui um status final." });
      }

      if (existingAppointment.status === parsedBody.data.status) {
        return reply
          .status(400)
          .send({ message: "O agendamento ja possui este status." });
      }

      const appointment = await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          status: parsedBody.data.status,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({ appointment: mapAppointment(appointment) });
    },
  );

  app.put(
    "/appointments/:id/reschedule",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = appointmentParamsSchema.safeParse(request.params);
      const parsedBody = rescheduleAppointmentSchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Agendamento invalido." });
      }

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ message: parsedBody.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const existingAppointment = await findOwnedAppointment(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingAppointment) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      if (
        existingAppointment.status === AppointmentStatus.COMPLETED ||
        existingAppointment.status === AppointmentStatus.CANCELED
      ) {
        return reply
          .status(400)
          .send({ message: "Este agendamento nao pode ser remarcado." });
      }

      if (!existingAppointment.serviceId) {
        return reply
          .status(400)
          .send({ message: "Servico do agendamento nao esta mais disponivel." });
      }

      const availability = await calculateAvailableTimes({
        businessId: request.user.businessId,
        serviceId: existingAppointment.serviceId,
        date: parsedBody.data.date,
        ignoreAppointmentId: existingAppointment.id,
      });

      const endTime = addMinutesToTime(
        parsedBody.data.startTime,
        existingAppointment.durationMinutes,
      );

      if (!availability.availableTimes.includes(parsedBody.data.startTime)) {
        return reply
          .status(409)
          .send({ message: "Este horario nao esta mais disponivel." });
      }

      const appointment = await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          date: parseDateOnly(parsedBody.data.date),
          startTime: parsedBody.data.startTime,
          endTime,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({ appointment: mapAppointment(appointment) });
    },
  );

  app.delete(
    "/appointments/:id",
    { preHandler: [authenticate, requireBusinessAccess] },
    async (request, reply) => {
      const parsedParams = appointmentParamsSchema.safeParse(request.params);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Agendamento invalido." });
      }

      const existingAppointment = await findOwnedAppointment(
        parsedParams.data.id,
        request.user.businessId,
      );

      if (!existingAppointment) {
        return reply.status(404).send({ message: "Agendamento nao encontrado." });
      }

      if (existingAppointment.status === AppointmentStatus.COMPLETED) {
        return reply
          .status(400)
          .send({ message: "Um agendamento concluido nao pode ser cancelado." });
      }

      if (existingAppointment.status === AppointmentStatus.CANCELED) {
        return reply.send({ appointment: mapAppointment(existingAppointment) });
      }

      const appointment = await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          status: AppointmentStatus.CANCELED,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              whatsapp: true,
            },
          },
          service: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return reply.send({ appointment: mapAppointment(appointment) });
    },
  );
}
