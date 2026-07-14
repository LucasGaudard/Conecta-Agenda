import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

const dateSchema = z.string().date("Data invalida.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario deve estar em HH:mm.");

export const appointmentParamsSchema = z.object({
  id: z.string().trim().min(1, "Agendamento nao informado."),
});

export const appointmentsQuerySchema = z
  .object({
    date: dateSchema.optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
  })
  .refine((data) => !(data.date && (data.from || data.to)), {
    message: "Use date ou intervalo from/to, nao ambos.",
  });

export const appointmentAvailableTimesQuerySchema = z.object({
  serviceId: z.string().trim().min(1, "Servico obrigatorio."),
  date: dateSchema,
  ignoreAppointmentId: z.string().trim().min(1).optional(),
});

export const createAppointmentSchema = z
  .object({
    serviceId: z.string().trim().min(1, "Servico obrigatorio."),
    date: dateSchema,
    startTime: timeSchema,
    customerId: z.string().trim().min(1).optional(),
    customerName: z.string().trim().optional(),
    customerWhatsapp: z.string().trim().optional(),
    notes: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((data) => data.customerId || (data.customerName && data.customerName.length >= 2), {
    message: "Informe um cliente existente ou o nome do cliente.",
    path: ["customerName"],
  })
  .refine((data) => data.customerId || (data.customerWhatsapp && data.customerWhatsapp.length >= 8), {
    message: "Informe o WhatsApp do cliente.",
    path: ["customerWhatsapp"],
  });

export const updateAppointmentStatusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

export const rescheduleAppointmentSchema = z.object({
  date: dateSchema,
  startTime: timeSchema,
});
