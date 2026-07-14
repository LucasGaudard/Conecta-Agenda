import type { FastifyInstance } from "fastify";
import { AppointmentStatus } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { financeSummaryQuerySchema } from "../schemas/finance";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getMonthRange(month?: string) {
  if (month) {
    const [year, monthNumber] = month.split("-").map(Number);
    return {
      start: new Date(year!, monthNumber! - 1, 1),
      end: new Date(year!, monthNumber!, 1),
    };
  }

  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

export async function financeRoutes(app: FastifyInstance) {
  app.get("/finance/summary", { preHandler: authenticate }, async (request, reply) => {
    const parsedQuery = financeSummaryQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        message: parsedQuery.error.issues[0]?.message ?? "Filtro de mes invalido.",
      });
    }

    const businessId = request.user.businessId;
    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);
    const monthRange = getMonthRange(parsedQuery.data.month);

    const [todayAppointments, monthAppointments] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: todayStart, lt: tomorrowStart },
        },
        select: { status: true, priceInCents: true },
      }),
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: monthRange.start, lt: monthRange.end },
        },
        select: { status: true, priceInCents: true },
      }),
    ]);

    const todayExpectedStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
    ]);
    const monthExpectedStatuses = new Set<AppointmentStatus>([
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
    ]);

    return reply.send({
      today: {
        expectedInCents: todayAppointments
          .filter((appointment) => todayExpectedStatuses.has(appointment.status))
          .reduce((total, appointment) => total + appointment.priceInCents, 0),
        completedInCents: todayAppointments
          .filter((appointment) => appointment.status === AppointmentStatus.COMPLETED)
          .reduce((total, appointment) => total + appointment.priceInCents, 0),
        appointmentsCount: todayAppointments.length,
      },
      month: {
        expectedInCents: monthAppointments
          .filter((appointment) => monthExpectedStatuses.has(appointment.status))
          .reduce((total, appointment) => total + appointment.priceInCents, 0),
        completedInCents: monthAppointments
          .filter((appointment) => appointment.status === AppointmentStatus.COMPLETED)
          .reduce((total, appointment) => total + appointment.priceInCents, 0),
        appointmentsCount: monthAppointments.length,
        completedCount: monthAppointments.filter(
          (appointment) => appointment.status === AppointmentStatus.COMPLETED,
        ).length,
        canceledCount: monthAppointments.filter(
          (appointment) => appointment.status === AppointmentStatus.CANCELED,
        ).length,
        noShowCount: monthAppointments.filter(
          (appointment) => appointment.status === AppointmentStatus.NO_SHOW,
        ).length,
      },
    });
  });
}
