import { z } from "zod";

export const financeSummaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes deve estar no formato YYYY-MM.")
    .optional(),
});
