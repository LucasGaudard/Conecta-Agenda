import type { FastifyInstance } from "fastify";

import { authenticate } from "../middlewares/auth";
import { prisma } from "../lib/prisma";
import {
  blockedTimeParamsSchema,
  blockedTimesQuerySchema,
  createBlockedTimeSchema,
} from "../schemas/blocked-times";

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function mapBlockedTime(blockedTime: {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: blockedTime.id,
    date: blockedTime.date.toISOString().slice(0, 10),
    startTime: blockedTime.startTime,
    endTime: blockedTime.endTime,
    reason: blockedTime.reason,
    createdAt: blockedTime.createdAt.toISOString(),
    updatedAt: blockedTime.updatedAt.toISOString(),
  };
}

export async function blockedTimesRoutes(app: FastifyInstance) {
  app.get("/blocked-times", { preHandler: authenticate }, async (request, reply) => {
    const parsed = blockedTimesQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Filtros invalidos." });
    }

    const blockedTimes = await prisma.blockedTime.findMany({
      where: {
        businessId: request.user.businessId,
        ...(parsed.data.from || parsed.data.to
          ? {
              date: {
                ...(parsed.data.from ? { gte: parseDateOnly(parsed.data.from) } : {}),
                ...(parsed.data.to ? { lte: parseDateOnly(parsed.data.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return reply.send({ blockedTimes: blockedTimes.map(mapBlockedTime) });
  });

  app.post("/blocked-times", { preHandler: authenticate }, async (request, reply) => {
    const parsed = createBlockedTimeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ message: parsed.error.issues[0]?.message ?? "Bloqueio invalido." });
    }

    const blockedTime = await prisma.blockedTime.create({
      data: {
        businessId: request.user.businessId,
        date: parseDateOnly(parsed.data.date),
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        reason: parsed.data.reason,
      },
    });

    return reply.status(201).send({ blockedTime: mapBlockedTime(blockedTime) });
  });

  app.delete("/blocked-times/:id", { preHandler: authenticate }, async (request, reply) => {
    const parsed = blockedTimeParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Bloqueio invalido." });
    }

    const blockedTime = await prisma.blockedTime.findFirst({
      where: {
        id: parsed.data.id,
        businessId: request.user.businessId,
      },
      select: { id: true },
    });

    if (!blockedTime) {
      return reply.status(404).send({ message: "Bloqueio nao encontrado." });
    }

    await prisma.blockedTime.delete({ where: { id: blockedTime.id } });
    return reply.send({ message: "Bloqueio removido com sucesso." });
  });
}
