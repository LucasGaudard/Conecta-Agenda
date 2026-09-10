import { z } from "zod";
import { registerSchema } from "./auth";

export const forgotPasswordSchema = z
  .object({ email: registerSchema.shape.email })
  .strict();
export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: registerSchema.shape.password,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas devem ser iguais.",
  });
