import { z } from "zod";

import { optionalNullableTextSchema } from "./helpers";

const dateSchema = z.string().date("Data invalida.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario deve estar em HH:mm.");

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const publicSlugParamsSchema = z.object({
  slug: z.string().trim().min(1, "Slug obrigatorio."),
});

export const availableTimesQuerySchema = z
  .object({
    serviceId: z.string().trim().min(1, "Servico obrigatorio."),
    date: dateSchema,
  })
  .refine((data) => data.date >= getToday(), {
    message: "Nao e possivel agendar em uma data passada.",
    path: ["date"],
  });

export const createPublicAppointmentSchema = z
  .object({
    serviceId: z.string().trim().min(1, "Servico obrigatorio."),
    date: dateSchema,
    startTime: timeSchema,
    customerName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
    customerWhatsapp: z.string().trim().min(8, "WhatsApp deve ser informado."),
    notes: optionalNullableTextSchema,
  })
  .refine((data) => data.date >= getToday(), {
    message: "Nao e possivel agendar em uma data passada.",
    path: ["date"],
  });
