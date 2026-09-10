import { z } from "zod";

const rawEnv = {
  ...process.env,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
};

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PAYMENT_GRACE_PERIOD_DAYS: z.coerce.number().int().min(0).max(365).default(3),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(30),
    API_PORT: z.coerce.number().int().positive().default(3333),
    HOST: z.string().default("0.0.0.0"),
    DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().default("change-me"),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;
    if (!value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL e obrigatoria em producao.",
      });
    }
    if (value.JWT_SECRET === "change-me" || value.JWT_SECRET.length < 32) {
      context.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET deve ser segura em producao.",
      });
    }
  });

export const env = envSchema.parse(rawEnv);
