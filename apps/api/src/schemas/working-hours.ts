import { DayOfWeek } from "@prisma/client";
import { z } from "zod";

import { isAfterTime, isTimeWithinRange, isValidTime } from "../utils/time";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario deve estar em HH:mm.");

export const workingHourSchema = z
  .object({
    dayOfWeek: z.nativeEnum(DayOfWeek),
    isActive: z.boolean(),
    startTime: timeSchema,
    endTime: timeSchema,
    breakStart: z.string().nullable().optional(),
    breakEnd: z.string().nullable().optional(),
  })
  .superRefine((value, context) => {
    const breakStart = value.breakStart || null;
    const breakEnd = value.breakEnd || null;

    if (value.isActive && !isAfterTime(value.endTime, value.startTime)) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Fim deve ser maior que inicio.",
      });
    }

    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      context.addIssue({
        code: "custom",
        path: ["breakStart"],
        message: "Inicio e fim do intervalo devem ser informados juntos.",
      });
    }

    if (breakStart && !isValidTime(breakStart)) {
      context.addIssue({ code: "custom", path: ["breakStart"], message: "Intervalo invalido." });
    }

    if (breakEnd && !isValidTime(breakEnd)) {
      context.addIssue({ code: "custom", path: ["breakEnd"], message: "Intervalo invalido." });
    }

    if (breakStart && breakEnd) {
      if (!isAfterTime(breakEnd, breakStart)) {
        context.addIssue({
          code: "custom",
          path: ["breakEnd"],
          message: "Fim do intervalo deve ser maior que inicio.",
        });
      }

      if (
        !isTimeWithinRange(breakStart, value.startTime, value.endTime) ||
        !isTimeWithinRange(breakEnd, value.startTime, value.endTime)
      ) {
        context.addIssue({
          code: "custom",
          path: ["breakStart"],
          message: "Intervalo deve estar dentro do expediente.",
        });
      }
    }
  });

export const updateWorkingHoursSchema = z
  .object({
    workingHours: z.array(workingHourSchema).length(7, "Informe exatamente 7 dias."),
  })
  .superRefine((value, context) => {
    const uniqueDays = new Set(value.workingHours.map((item) => item.dayOfWeek));

    if (uniqueDays.size !== 7) {
      context.addIssue({
        code: "custom",
        path: ["workingHours"],
        message: "Cada dia da semana deve aparecer uma unica vez.",
      });
    }
  });
