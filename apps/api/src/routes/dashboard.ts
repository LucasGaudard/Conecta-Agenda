import type { FastifyInstance } from "fastify";
import { AppointmentStatus } from "@prisma/client";

import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";

type DashboardResponse = {
  business: {
    id: string;
    name: string;
    slug: string;
  };
  summary: {
    totalServices: number;
    totalCustomers: number;
    totalAppointmentsToday: number;
    totalAppointmentsTomorrow: number;
    estimatedTodayInCents: number;
    estimatedMonthInCents: number;
  };
  nextAppointment: {
    id: string;
    customerName: string;
    serviceName: string;
    priceInCents: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
  tomorrowAppointments: Array<{
    id: string;
    customerName: string;
    customerWhatsapp: string | null;
    serviceName: string;
    priceInCents: number;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  }>;
  publicLinkPath: string;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard", { preHandler: authenticate }, async (request, reply) => {
    const businessId = request.user.businessId;
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    const afterTomorrow = addDays(today, 2);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = startOfNextMonth(today);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!business) {
      return reply.status(404).send({ message: "Negocio nao encontrado." });
    }

    const [
      totalServices,
      totalCustomers,
      totalAppointmentsToday,
      totalAppointmentsTomorrow,
      todayAggregate,
      monthAggregate,
      nextAppointment,
      tomorrowAppointments,
    ] = await Promise.all([
      prisma.service.count({
        where: {
          businessId,
          isActive: true,
        },
      }),
      prisma.customer.count({
        where: { businessId },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      prisma.appointment.count({
        where: {
          businessId,
          date: {
            gte: tomorrow,
            lt: afterTomorrow,
          },
        },
      }),
      prisma.appointment.aggregate({
        where: {
          businessId,
          date: {
            gte: today,
            lt: tomorrow,
          },
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
          },
        },
        _sum: {
          priceInCents: true,
        },
      }),
      prisma.appointment.aggregate({
        where: {
          businessId,
          date: {
            gte: monthStart,
            lt: nextMonthStart,
          },
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.COMPLETED,
            ],
          },
        },
        _sum: {
          priceInCents: true,
        },
      }),
      prisma.appointment.findFirst({
        where: {
          businessId,
          date: {
            gte: today,
          },
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          serviceName: true,
          priceInCents: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.appointment.findMany({
        where: {
          businessId,
          date: { gte: tomorrow, lt: afterTomorrow },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
        },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          serviceName: true,
          priceInCents: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          customer: { select: { name: true, whatsapp: true } },
        },
      }),
    ]);

    const response: DashboardResponse = {
      business,
      summary: {
        totalServices,
        totalCustomers,
        totalAppointmentsToday,
        totalAppointmentsTomorrow,
        estimatedTodayInCents: todayAggregate._sum.priceInCents ?? 0,
        estimatedMonthInCents: monthAggregate._sum.priceInCents ?? 0,
      },
      nextAppointment: nextAppointment
        ? {
            id: nextAppointment.id,
            customerName: nextAppointment.customer.name,
            serviceName: nextAppointment.serviceName,
            priceInCents: nextAppointment.priceInCents,
            date: nextAppointment.date.toISOString(),
            startTime: nextAppointment.startTime,
            endTime: nextAppointment.endTime,
            status: nextAppointment.status,
          }
        : null,
      tomorrowAppointments: tomorrowAppointments.map((appointment) => ({
        id: appointment.id,
        customerName: appointment.customer.name,
        customerWhatsapp: appointment.customer.whatsapp,
        serviceName: appointment.serviceName,
        priceInCents: appointment.priceInCents,
        date: appointment.date.toISOString(),
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
      })),
      publicLinkPath: `/${business.slug}`,
    };

    return reply.send(response);
  });
}
