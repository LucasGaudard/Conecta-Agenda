import type { FastifyInstance } from "fastify";
import { Prisma, SubscriptionStatus, UserRole } from "@prisma/client";

import { resolveBusinessAccess, type BusinessAccessState } from "../domain/business-access";
import { prisma } from "../lib/prisma";
import { requireSuperAdmin } from "../middlewares/auth";
import {
  adminBusinessesQuerySchema,
  adminBusinessParamsSchema,
  createAdminBusinessSchema,
  updateBusinessAccessSchema,
} from "../schemas/admin";
import { hashPassword } from "../utils/password";
import { generateUniqueBusinessSlug } from "../utils/slug";

type AdminBusinessRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  whatsapp: string | null;
  city: string | null;
  address?: string | null;
  instagram?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  createdAt: Date;
  isManuallyBlocked: boolean;
  blockReason: string | null;
  blockedAt: Date | null;
  accessOverrideUntil: Date | null;
  user: {
    id: string;
    name: string;
    email: string;
    subscription: {
      id: string;
      status: SubscriptionStatus;
      currentPeriodEnd: Date | null;
      trialEndsAt: Date | null;
      plan: {
        id: string;
        name: string;
        slug: string;
        priceInCents: number;
      };
    } | null;
  };
};

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapSubscription(subscription: AdminBusinessRecord["user"]["subscription"]) {
  return subscription
    ? {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: serializeDate(subscription.currentPeriodEnd),
        trialEndsAt: serializeDate(subscription.trialEndsAt),
        plan: subscription.plan,
      }
    : null;
}

function getAccess(record: AdminBusinessRecord): BusinessAccessState {
  return resolveBusinessAccess({
    isManuallyBlocked: record.isManuallyBlocked,
    accessOverrideUntil: record.accessOverrideUntil,
    subscription: record.user.subscription,
  });
}

function mapBusinessListItem(record: AdminBusinessRecord) {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    whatsapp: record.whatsapp,
    city: record.city,
    createdAt: record.createdAt.toISOString(),
    isManuallyBlocked: record.isManuallyBlocked,
    blockReason: record.blockReason,
    blockedAt: serializeDate(record.blockedAt),
    accessOverrideUntil: serializeDate(record.accessOverrideUntil),
    owner: {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
    },
    subscription: mapSubscription(record.user.subscription),
    access: getAccess(record),
  };
}

function getBusinessInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
            plan: {
              select: {
                id: true,
                name: true,
                slug: true,
                priceInCents: true,
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.BusinessInclude;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/overview", { preHandler: requireSuperAdmin }, async (_request, reply) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [
      totalProfessionals,
      totalBusinesses,
      activeSubscriptions,
      trialingSubscriptions,
      pastDueSubscriptions,
      canceledSubscriptions,
      manuallyBlockedBusinesses,
      registrationsThisMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { role: UserRole.PROFESSIONAL } }),
      prisma.business.count(),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.CANCELED } }),
      prisma.business.count({ where: { isManuallyBlocked: true } }),
      prisma.business.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    return reply.send({
      totalProfessionals,
      totalBusinesses,
      activeSubscriptions,
      trialingSubscriptions,
      pastDueSubscriptions,
      canceledSubscriptions,
      manuallyBlockedBusinesses,
      registrationsThisMonth,
    });
  });

  app.get("/admin/businesses", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const parsed = adminBusinessesQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Filtros invalidos." });
    }

    const { accessStatus, page, pageSize, search, subscriptionStatus } = parsed.data;
    const where: Prisma.BusinessWhereInput = {
      ...(subscriptionStatus
        ? {
            user: {
              subscription: {
                status: subscriptionStatus,
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { whatsapp: { contains: search, mode: "insensitive" } },
              { user: { name: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const records = await prisma.business.findMany({
      where,
      include: getBusinessInclude(),
      orderBy: { createdAt: "desc" },
    });

    const filtered = records
      .map(mapBusinessListItem)
      .filter((business) => !accessStatus || business.access.status === accessStatus);
    const total = filtered.length;
    const businesses = filtered.slice((page - 1) * pageSize, page * pageSize);

    return reply.send({
      businesses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  });

  app.get("/admin/businesses/:id", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const parsed = adminBusinessParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({ message: "Negocio invalido." });
    }

    const record = await prisma.business.findUnique({
      where: { id: parsed.data.id },
      include: {
        ...getBusinessInclude(),
        settings: {
          select: {
            timezone: true,
            currency: true,
            bookingIntervalMinutes: true,
            allowCancellation: true,
            allowReschedule: true,
          },
        },
        _count: {
          select: {
            services: true,
            customers: true,
            appointments: true,
          },
        },
      },
    });

    if (!record) {
      return reply.status(404).send({ message: "Negocio nao encontrado." });
    }

    return reply.send({
      business: {
        ...mapBusinessListItem(record),
        description: record.description,
        address: record.address,
        instagram: record.instagram,
        logoUrl: record.logoUrl,
        primaryColor: record.primaryColor,
        settings: {
          timezone: record.settings?.timezone ?? "America/Sao_Paulo",
          currency: record.settings?.currency ?? "BRL",
          bookingIntervalMinutes: record.settings?.bookingIntervalMinutes ?? 30,
          allowCancellation: record.settings?.allowCancellation ?? true,
          allowReschedule: record.settings?.allowReschedule ?? true,
        },
        counts: record._count,
      },
    });
  });

  app.patch(
    "/admin/businesses/:id/access",
    { preHandler: requireSuperAdmin },
    async (request, reply) => {
      const parsedParams = adminBusinessParamsSchema.safeParse(request.params);
      const parsedBody = updateBusinessAccessSchema.safeParse(request.body);

      if (!parsedParams.success) {
        return reply.status(400).send({ message: "Negocio invalido." });
      }

      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ message: parsedBody.error.issues[0]?.message ?? "Dados invalidos." });
      }

      const existingBusiness = await prisma.business.findUnique({
        where: { id: parsedParams.data.id },
        select: { id: true },
      });

      if (!existingBusiness) {
        return reply.status(404).send({ message: "Negocio nao encontrado." });
      }

      const updatedBusiness = await prisma.business.update({
        where: { id: existingBusiness.id },
        data: parsedBody.data.isManuallyBlocked
          ? {
              isManuallyBlocked: true,
              blockReason: parsedBody.data.blockReason,
              blockedAt: new Date(),
              blockedByUserId: request.user.id,
              accessOverrideUntil: parsedBody.data.accessOverrideUntil,
            }
          : {
              isManuallyBlocked: false,
              blockReason: null,
              blockedAt: null,
              blockedByUserId: null,
              accessOverrideUntil: parsedBody.data.accessOverrideUntil,
            },
        include: getBusinessInclude(),
      });

      return reply.send({ business: mapBusinessListItem(updatedBusiness) });
    },
  );

  app.post("/admin/businesses", { preHandler: requireSuperAdmin }, async (request, reply) => {
    const parsed = createAdminBusinessSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply
        .status(400)
        .send({ message: parsed.error.issues[0]?.message ?? "Dados invalidos." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.ownerEmail },
      select: { id: true },
    });

    if (existingUser) {
      return reply.status(409).send({ message: "E-mail ja cadastrado." });
    }

    const plan = await prisma.plan.findUnique({
      where: { slug: parsed.data.planSlug },
      select: { id: true },
    });

    if (!plan) {
      return reply.status(400).send({ message: "Plano nao encontrado." });
    }

    const passwordHash = await hashPassword(parsed.data.temporaryPassword);
    const slug = await generateUniqueBusinessSlug(parsed.data.businessName);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: parsed.data.ownerName,
            email: parsed.data.ownerEmail,
            passwordHash,
            role: UserRole.PROFESSIONAL,
          },
          select: { id: true },
        });

        const business = await tx.business.create({
          data: {
            userId: user.id,
            name: parsed.data.businessName,
            slug,
            whatsapp: parsed.data.whatsapp,
            city: parsed.data.city,
            primaryColor: "#111827",
            accessOverrideUntil: parsed.data.accessOverrideUntil,
          },
          select: { id: true },
        });

        await tx.businessSettings.create({
          data: { businessId: business.id },
        });

        await tx.subscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        return business;
      });

      const business = await prisma.business.findUnique({
        where: { id: result.id },
        include: getBusinessInclude(),
      });

      if (!business) {
        return reply.status(404).send({ message: "Negocio nao encontrado." });
      }

      return reply.status(201).send({
        business: mapBusinessListItem(business),
        message: "Profissional criado com senha temporaria.",
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return reply.status(409).send({ message: "E-mail ou slug ja cadastrado." });
      }

      request.log.error(error);
      return reply.status(500).send({ message: "Nao foi possivel criar o profissional." });
    }
  });
}
