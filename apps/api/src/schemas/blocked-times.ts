import { z } from "zod";

import { optionalNullableTextSchema } from "./helpers";
import { isAfterTime } from "../utils/time";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario deve estar em HH:mm.");

export const blockedTimesQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const blockedTimeParamsSchema = z.object({
  id: z.string().min(1, "Bloqueio nao informado."),
});

export const createBlockedTimeSchema = z
  .object({
    date: z.string().date("Data invalida."),
    startTime: timeSchema,
    endTime: timeSchema,
    reason: optionalNullableTextSchema,
  })
  .refine((value) => isAfterTime(value.endTime, value.startTime), {
    path: ["endTime"],
    message: "Fim deve ser maior que inicio.",
  });
