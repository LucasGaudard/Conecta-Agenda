import type { FastifyReply, FastifyRequest } from "fastify";
import { UserRole } from "@prisma/client";

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
        role: true,
        business: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return reply.status(401).send({ message: "Token ausente ou invalido." });
    }

    if (
      user.role === UserRole.PROFESSIONAL &&
      (!user.business || user.business.id !== payload.businessId)
    ) {
      return reply.status(401).send({ message: "Token ausente ou invalido." });
    }

    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.business?.id ?? "",
    };
  } catch {
    return reply.status(401).send({ message: "Token ausente ou invalido." });
  }
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);

  if (reply.sent) {
    return;
  }

  if (request.user.role !== UserRole.SUPER_ADMIN) {
    return reply.status(403).send({ message: "Acesso nao autorizado." });
  }
}
