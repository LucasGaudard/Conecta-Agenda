import { z } from "zod";

export const serviceStatusQuerySchema = z
  .object({
    status: z.enum(["active", "inactive", "all"]).default("all"),
    search: z.string().trim().optional(),
  })
  .default({
    status: "all",
  });

export const serviceParamsSchema = z.object({
  id: z.string().min(1, "Servico nao informado."),
});

export const serviceBodySchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
  description: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
  priceInCents: z.coerce.number().int().min(0, "Preco deve ser maior ou igual a zero."),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "Duracao minima de 5 minutos.")
    .max(480, "Duracao maxima de 480 minutos."),
  isActive: z.boolean().default(true),
});

export const serviceStatusBodySchema = z.object({
  isActive: z.boolean(),
});

export type ServiceBodyInput = z.infer<typeof serviceBodySchema>;
