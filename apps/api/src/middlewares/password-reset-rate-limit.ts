import type { FastifyReply, FastifyRequest } from "fastify";

// Local, bounded and temporary. Multi-instance deployments need a shared limiter.
export function createPasswordResetRateLimit() {
  const entries = new Map<string, { count: number; expiresAt: number }>();
  const windowMs = 15 * 60 * 1000;
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key);
    const key = request.ip;
    const entry = entries.get(key);
    if ((!entry && entries.size >= 10000) || (entry && entry.count >= 10)) {
      return reply
        .header(
          "Retry-After",
          String(Math.ceil(((entry?.expiresAt ?? now + windowMs) - now) / 1000)),
        )
        .status(429)
        .send({
          code: "PASSWORD_RESET_RATE_LIMITED",
          message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        });
    }
    entries.set(key, {
      count: (entry?.count ?? 0) + 1,
      expiresAt: entry?.expiresAt ?? now + windowMs,
    });
  };
}
