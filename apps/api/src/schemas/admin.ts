import { SubscriptionStatus } from "@prisma/client";
import { z } from "zod";

import { optionalNullableTextSchema } from "./helpers";

const futureDateSchema = z
  .preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (typeof value === "string") {
      return new Date(value);
    }

    return value;
  }, z.date().nullable())
  .refine((value) => !value || value.getTime() > Date.now(), {
    message: "A data de cortesia deve ser futura.",
  });

export const adminBusinessParamsSchema = z.object({
  id: z.string().trim().min(1, "Negocio nao informado."),
});

export const adminBusinessesQuerySchema = z.object({
  search: z.string().trim().optional(),
  accessStatus: z
    .enum([
      "ACTIVE",
      "TRIAL",
      "OVERRIDE_ACTIVE",
      "PAYMENT_ATTENTION",
      "MANUALLY_BLOCKED",
      "EXPIRED",
    ])
    .optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateBusinessAccessSchema = z
  .object({
    isManuallyBlocked: z.boolean(),
    blockReason: optionalNullableTextSchema,
    accessOverrideUntil: futureDateSchema,
  })
  .superRefine((value, context) => {
    if (value.isManuallyBlocked && !value.blockReason) {
      context.addIssue({
        code: "custom",
        path: ["blockReason"],
        message: "Informe o motivo do bloqueio.",
      });
    }
  });

export const createAdminBusinessSchema = z.object({
  ownerName: z.string().trim().min(2, "Nome do proprietario deve ter pelo menos 2 caracteres."),
  ownerEmail: z.string().trim().email("E-mail invalido.").toLowerCase(),
  temporaryPassword: z.string().min(6, "Senha temporaria deve ter pelo menos 6 caracteres."),
  businessName: z.string().trim().min(2, "Nome do negocio deve ter pelo menos 2 caracteres."),
  whatsapp: optionalNullableTextSchema,
  city: optionalNullableTextSchema,
  planSlug: z.string().trim().min(1).default("starter"),
  accessOverrideUntil: futureDateSchema,
});
