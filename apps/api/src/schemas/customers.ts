import { z } from "zod";

export const customersQuerySchema = z.object({
  search: z.string().trim().optional(),
});

export const customerParamsSchema = z.object({
  id: z.string().min(1, "Cliente nao informado."),
});

export const customerBodySchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres."),
  whatsapp: z.string().trim().min(8, "WhatsApp deve ser informado."),
  notes: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
});
