import { AppointmentStatus, DayOfWeek } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { addMinutesToTime, minutesToTime, overlaps, timeToMinutes } from "./time";

const dayOfWeekByIndex: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

export function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayOfWeekFromDate(date: Date) {
  return dayOfWeekByIndex[date.getUTCDay()] ?? DayOfWeek.SUNDAY;
}

type AvailableTimesService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceInCents: number;
};

export async function calculateAvailableTimes(input: {
  businessId: string;
  serviceId: string;
  date: string;
  ignoreAppointmentId?: string;
}): Promise<{ service: AvailableTimesService | null; availableTimes: string[] }> {
  const date = parseDateOnly(input.date);
  const nextDate = addDays(date, 1);
  const dayOfWeek = getDayOfWeekFromDate(date);

  const [service, settings, workingHour, appointments, blockedTimes] = await Promise.all([
    prisma.service.findFirst({
      where: {
        id: input.serviceId,
        businessId: input.businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        priceInCents: true,
      },
    }),
    prisma.businessSettings.findUnique({
      where: { businessId: input.businessId },
      select: { bookingIntervalMinutes: true },
    }),
    prisma.workingHour.findUnique({
      where: {
        businessId_dayOfWeek: {
          businessId: input.businessId,
          dayOfWeek,
        },
      },
      select: {
        isActive: true,
        startTime: true,
        endTime: true,
        breakStart: true,
        breakEnd: true,
      },
    }),
    prisma.appointment.findMany({
      where: {
        businessId: input.businessId,
        ...(input.ignoreAppointmentId ? { id: { not: input.ignoreAppointmentId } } : {}),
        date: {
          gte: date,
          lt: nextDate,
        },
        status: {
          in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    }),
    prisma.blockedTime.findMany({
      where: {
        businessId: input.businessId,
        date: {
          gte: date,
          lt: nextDate,
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  if (!service) {
    return { service: null, availableTimes: [] };
  }

  if (!workingHour?.isActive || !workingHour.startTime || !workingHour.endTime) {
    return { service, availableTimes: [] };
  }

  const interval = settings?.bookingIntervalMinutes ?? 30;
  const availableTimes: string[] = [];
  const startMinutes = timeToMinutes(workingHour.startTime);
  const endMinutes = timeToMinutes(workingHour.endTime);
  const latestStart = endMinutes - service.durationMinutes;
  const now = new Date();
  const today = getLocalDateString(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (let slotStart = startMinutes; slotStart <= latestStart; slotStart += interval) {
    const startTime = minutesToTime(slotStart);
    const endTime = addMinutesToTime(startTime, service.durationMinutes);

    if (input.date === today && slotStart <= currentMinutes) {
      continue;
    }

    if (
      workingHour.breakStart &&
      workingHour.breakEnd &&
      overlaps(startTime, endTime, workingHour.breakStart, workingHour.breakEnd)
    ) {
      continue;
    }

    const overlapsAppointment = appointments.some((appointment) =>
      overlaps(startTime, endTime, appointment.startTime, appointment.endTime),
    );

    if (overlapsAppointment) {
      continue;
    }

    const overlapsBlockedTime = blockedTimes.some((blockedTime) =>
      overlaps(startTime, endTime, blockedTime.startTime, blockedTime.endTime),
    );

    if (overlapsBlockedTime) {
      continue;
    }

    availableTimes.push(startTime);
  }

  return {
    service,
    availableTimes,
  };
}
