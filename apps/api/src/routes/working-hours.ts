import type { FastifyInstance } from "fastify";
import { DayOfWeek } from "@prisma/client";

import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import { updateWorkingHoursSchema } from "../schemas/working-hours";

type DefaultWorkingHour = {
  dayOfWeek: DayOfWeek;
  isActive: boolean;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
};

const defaultWorkingHours: DefaultWorkingHour[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
].map((dayOfWeek) => ({
  dayOfWeek,
  isActive: true,
  startTime: "09:00",
  endTime: "18:00",
  breakStart: "12:00",
  breakEnd: "13:00",
}));

defaultWorkingHours.push({
  dayOfWeek: DayOfWeek.SATURDAY,
  isActive: true,
  startTime: "09:00",
  endTime: "13:00",
  breakStart: null,
  breakEnd: null,
});

defaultWorkingHours.push({
  dayOfWeek: DayOfWeek.SUNDAY,
  isActive: false,
  startTime: "09:00",
  endTime: "18:00",
  breakStart: null,
  breakEnd: null,
});

function mapWorkingHour(hour: {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: hour.id,
    dayOfWeek: hour.dayOfWeek,
    startTime: hour.startTime ?? "09:00",
    endTime: hour.endTime ?? "18:00",
    breakStart: hour.breakStart,
    breakEnd: hour.breakEnd,
    isActive: hour.isActive,
    createdAt: hour.createdAt.toISOString(),
    updatedAt: hour.updatedAt.toISOString(),
  };
}

async function ensureDefaultWorkingHours(businessId: string) {
  const count = await prisma.workingHour.count({ where: { businessId } });

  if (count > 0) {
    return;
  }

  await prisma.workingHour.createMany({
    data: defaultWorkingHours.map((hour) => ({
      businessId,
      ...hour,
    })),
    skipDuplicates: true,
  });
}

async function listWorkingHours(businessId: string) {
  await ensureDefaultWorkingHours(businessId);

  const workingHours = await prisma.workingHour.findMany({
    where: { businessId },
    orderBy: { dayOfWeek: "asc" },
  });

  const order = Object.values(DayOfWeek);
  return workingHours
    .map(mapWorkingHour)
    .sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek));
}

export async function workingHoursRoutes(app: FastifyInstance) {
  app.get("/working-hours", { preHandler: authenticate }, async (request, reply) => {
    const workingHours = await listWorkingHours(request.user.businessId);
    return reply.send({ workingHours });
  });

  app.put("/working-hours", { preHandler: authenticate }, async (request, reply) => {
    const parsed = updateWorkingHoursSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ message: parsed.error.issues[0]?.message ?? "Horarios invalidos." });
    }

    await prisma.$transaction(
      parsed.data.workingHours.map((hour) =>
        prisma.workingHour.upsert({
          where: {
            businessId_dayOfWeek: {
              businessId: request.user.businessId,
              dayOfWeek: hour.dayOfWeek,
            },
          },
          update: {
            isActive: hour.isActive,
            startTime: hour.startTime,
            endTime: hour.endTime,
            breakStart: hour.breakStart || null,
            breakEnd: hour.breakEnd || null,
          },
          create: {
            businessId: request.user.businessId,
            dayOfWeek: hour.dayOfWeek,
            isActive: hour.isActive,
            startTime: hour.startTime,
            endTime: hour.endTime,
            breakStart: hour.breakStart || null,
            breakEnd: hour.breakEnd || null,
          },
        }),
      ),
    );

    const workingHours = await listWorkingHours(request.user.businessId);
    return reply.send({ workingHours });
  });
}
