import { z } from "zod";

import { optionalNullableTextSchema } from "./helpers";

export const reservedBusinessSlugs = new Set([
  "admin",
  "login",
  "register",
  "dashboard",
  "api",
  "www",
  "home",
  "agenda",
  "services",
  "customers",
  "working-hours",
  "profile",
  "settings",
  "auth",
  "public",
]);

const slugSchema = z
  .string()
  .trim()
  .min(3, "Slug deve ter pelo menos 3 caracteres.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug deve conter apenas letras, numeros e hifens.",
  )
  .refine((slug) => !reservedBusinessSlugs.has(slug), {
    message: "Este slug e reservado. Escolha outro link publico.",
  });

const primaryColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Cor principal deve ser hexadecimal, como #111827.");

export const updateBusinessProfileSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
  slug: slugSchema,
  description: optionalNullableTextSchema,
  whatsapp: optionalNullableTextSchema,
  city: optionalNullableTextSchema,
  address: optionalNullableTextSchema,
  instagram: optionalNullableTextSchema,
  logoUrl: optionalNullableTextSchema,
  primaryColor: primaryColorSchema.default("#111827"),
  timezone: z.string().trim().default("America/Sao_Paulo"),
  currency: z.string().trim().default("BRL"),
  bookingIntervalMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
  ]),
  allowCancellation: z.boolean(),
  allowReschedule: z.boolean(),
});

export const completeOnboardingSchema = updateBusinessProfileSchema
  .pick({
    name: true,
    slug: true,
    whatsapp: true,
    city: true,
    address: true,
    description: true,
    instagram: true,
    primaryColor: true,
    timezone: true,
    bookingIntervalMinutes: true,
  })
  .extend({
    whatsapp: z.string().trim().min(8, "WhatsApp deve ser informado."),
    city: z.string().trim().min(2, "Cidade deve ser informada."),
    primaryColor: primaryColorSchema.default("#111827"),
    timezone: z.string().trim().default("America/Sao_Paulo"),
    bookingIntervalMinutes: z
      .union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)])
      .default(30),
  });

export type UpdateBusinessProfileInput = z.infer<typeof updateBusinessProfileSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
