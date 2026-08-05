import type { FastifyInstance } from "fastify";
import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";

import { authenticate } from "../middlewares/auth";
import { loginSchema, registerSchema } from "../schemas/auth";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword } from "../utils/password";
import { signAuthToken } from "../utils/jwt";
import { generateUniqueBusinessSlug } from "../utils/slug";
import { resolveBusinessAccess, type BusinessAccessState } from "../domain/business-access";

type AuthResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  business: {
    id: string;
    name: string;
    slug: string;
  } | null;
  token: string;
};

type AuthMeResponse = Omit<AuthResponse, "token"> & {
  subscription: {
    status: string;
    plan: {
      name: string;
      slug: string;
    };
  } | null;
  access: BusinessAccessState | null;
};

function formatAuthResponse(input: {
  user: { id: string; name: string; email: string; role: UserRole };
  business: { id: string; name: string; slug: string } | null;
}): AuthResponse {
  return {
    user: input.user,
    business: input.business,
    token: signAuthToken({
      userId: input.user.id,
      businessId: input.business?.id ?? null,
      role: input.user.role,
    }),
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Dados de cadastro invalidos." });
    }

    const { name, email, password, businessName, whatsapp } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return reply.status(409).send({ message: "E-mail ja cadastrado." });
    }

    const starterPlan = await prisma.plan.findUnique({
      where: { slug: "starter" },
      select: { id: true },
    });

    if (!starterPlan) {
      return reply.status(500).send({
        message:
          "Plano Starter nao encontrado. Rode pnpm db:seed antes de cadastrar usuarios.",
      });
    }

    const businessDisplayName = businessName || `Agenda de ${name}`;
    const businessSlug = await generateUniqueBusinessSlug(businessDisplayName);
    const passwordHash = await hashPassword(password);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            passwordHash,
            role: UserRole.PROFESSIONAL,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        });

        const business = await tx.business.create({
          data: {
            userId: user.id,
            name: businessDisplayName,
            slug: businessSlug,
            whatsapp: whatsapp || null,
            primaryColor: "#111827",
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

        await tx.businessSettings.create({
          data: {
            businessId: business.id,
          },
        });

        await tx.subscription.create({
          data: {
            userId: user.id,
            planId: starterPlan.id,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        return { user, business };
      });

      return reply.status(201).send(formatAuthResponse(result));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.status(409).send({ message: "E-mail ou slug ja cadastrado." });
      }

      request.log.error(error);
      return reply.status(500).send({ message: "Nao foi possivel criar a conta." });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Dados de login invalidos." });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (
      !user ||
      !(await comparePassword(password, user.passwordHash)) ||
      (user.role === UserRole.PROFESSIONAL && !user.business)
    ) {
      return reply.status(401).send({ message: "Credenciais invalidas." });
    }

    return reply.send(
      formatAuthResponse({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        business: user.business ?? null,
      }),
    );
  });

  app.get("/auth/me", { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            isManuallyBlocked: true,
            accessOverrideUntil: true,
          },
        },
        subscription: {
          select: {
            status: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            plan: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user || (user.role === UserRole.PROFESSIONAL && !user.business)) {
      return reply.status(401).send({ message: "Token ausente ou invalido." });
    }

    const access =
      user.business
        ? resolveBusinessAccess({
            isManuallyBlocked: user.business.isManuallyBlocked,
            accessOverrideUntil: user.business.accessOverrideUntil,
            subscription: user.subscription,
          })
        : null;

    const response: AuthMeResponse = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      business: user.business
        ? {
            id: user.business.id,
            name: user.business.name,
            slug: user.business.slug,
          }
        : null,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            plan: user.subscription.plan,
          }
        : null,
      access,
    };

    return reply.send(response);
  });
}
