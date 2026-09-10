import type { FastifyInstance } from "fastify";
import { setTimeout as delay } from "node:timers/promises";
import { PasswordResetService } from "../password-reset/service";
import { forgotPasswordSchema, resetPasswordSchema } from "../schemas/password-reset";
import { createPasswordResetRateLimit } from "../middlewares/password-reset-rate-limit";

export const forgotPasswordMessage =
  "Se existir uma conta com este e-mail, enviaremos as instruções para redefinir sua senha.";
const invalidToken = {
  code: "RESET_TOKEN_INVALID_OR_EXPIRED",
  message: "Link inválido ou expirado. Solicite novas instruções.",
};

export async function passwordResetRoutes(
  app: FastifyInstance,
  options: { service?: PasswordResetService },
) {
  const service = options.service ?? new PasswordResetService();
  // No body/query logging, including on unexpected database/provider errors.
  const common = { bodyLimit: 8192, logLevel: "silent" as const };
  app.post(
    "/auth/forgot-password",
    { ...common, onRequest: createPasswordResetRateLimit() },
    async (request, reply) => {
      const started = Date.now();
      const parsed = forgotPasswordSchema.safeParse(request.body);
      try {
        if (parsed.success) await service.request(parsed.data.email);
      } catch {
        request.log.warn({ event: "password_reset_request_failed" });
      }
      // A common minimum duration reduces the obvious missing-user timing shortcut.
      await delay(Math.max(0, 300 - (Date.now() - started)));
      return reply
        .header("Cache-Control", "no-store")
        .send({ message: forgotPasswordMessage });
    },
  );
  app.post(
    "/auth/reset-password",
    { ...common, onRequest: createPasswordResetRateLimit() },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        const invalid = parsed.error.issues.some((issue) => issue.path[0] === "token");
        return reply
          .status(400)
          .send(
            invalid
              ? invalidToken
              : {
                  code: "RESET_PASSWORD_INVALID",
                  message:
                    "Informe uma senha com pelo menos 6 caracteres e confirmação idêntica.",
                },
          );
      }
      try {
        if (!(await service.reset(parsed.data.token, parsed.data.password)))
          return reply.status(400).send(invalidToken);
        return reply.send({ message: "Senha redefinida com sucesso." });
      } catch {
        return reply
          .status(503)
          .send({
            code: "PASSWORD_RESET_UNAVAILABLE",
            message:
              "Não foi possível redefinir a senha agora. Tente novamente mais tarde.",
          });
      }
    },
  );
}
