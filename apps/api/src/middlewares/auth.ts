import type { FastifyReply, FastifyRequest } from "fastify";

import { prisma } from "../lib/prisma";
import { verifyAuthToken } from "../utils/jwt";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.status(401).send({ message: "Token ausente ou invalido." });
  }

  try {
    const token = authorization.replace("Bearer ", "").trim();
    const payload = verifyAuthToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        business: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user?.business || user.business.id !== payload.businessId) {
      return reply.status(401).send({ message: "Token ausente ou invalido." });
    }

    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.business.id,
    };
  } catch {
    return reply.status(401).send({ message: "Token ausente ou invalido." });
  }
}
