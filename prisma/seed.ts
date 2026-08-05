import bcrypt from "bcrypt";
import { DayOfWeek, PrismaClient, SubscriptionStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

type SeedWorkingHour = {
  dayOfWeek: DayOfWeek;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  isActive: boolean;
};

async function main() {
  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {
      name: "Starter",
      description: "Para profissionais autonomos que querem uma agenda online simples.",
      priceInCents: 3900,
      isActive: true,
    },
    create: {
      name: "Starter",
      slug: "starter",
      description: "Para profissionais autonomos que querem uma agenda online simples.",
      priceInCents: 3900,
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "pro" },
    update: {
      name: "Pro",
      description: "Para profissionais que querem mais relatorios e personalizacao.",
      priceInCents: 6900,
      isActive: true,
    },
    create: {
      name: "Pro",
      slug: "pro",
      description: "Para profissionais que querem mais relatorios e personalizacao.",
      priceInCents: 6900,
      isActive: true,
    },
  });

  await prisma.plan.upsert({
    where: { slug: "premium" },
    update: {
      name: "Premium",
      description: "Para negocios que querem automacoes, equipe e recursos avancados.",
      priceInCents: 9900,
      isActive: true,
    },
    create: {
      name: "Premium",
      slug: "premium",
      description: "Para negocios que querem automacoes, equipe e recursos avancados.",
      priceInCents: 9900,
      isActive: true,
    },
  });

  const passwordHash = await bcrypt.hash("123456", 10);

  const user = await prisma.user.upsert({
    where: { email: "admin@conectaagenda.com" },
    update: {
      name: "Admin Teste",
      passwordHash,
      role: UserRole.PROFESSIONAL,
    },
    create: {
      name: "Admin Teste",
      email: "admin@conectaagenda.com",
      passwordHash,
      role: UserRole.PROFESSIONAL,
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: "barbeariateste" },
    update: {
      userId: user.id,
      name: "Barbearia Teste",
      whatsapp: "21999999999",
      city: "Rio de Janeiro",
      primaryColor: "#111827",
    },
    create: {
      userId: user.id,
      name: "Barbearia Teste",
      slug: "barbeariateste",
      whatsapp: "21999999999",
      city: "Rio de Janeiro",
      primaryColor: "#111827",
    },
  });

  await prisma.businessSettings.upsert({
    where: { businessId: business.id },
    update: {
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      bookingIntervalMinutes: 30,
      allowCancellation: true,
      allowReschedule: true,
    },
    create: {
      businessId: business.id,
      timezone: "America/Sao_Paulo",
      currency: "BRL",
      bookingIntervalMinutes: 30,
    },
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      planId: starterPlan.id,
      status: SubscriptionStatus.ACTIVE,
    },
    create: {
      userId: user.id,
      planId: starterPlan.id,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  const services = [
    {
      name: "Corte masculino",
      priceInCents: 3500,
      durationMinutes: 30,
    },
    {
      name: "Barba",
      priceInCents: 2500,
      durationMinutes: 20,
    },
    {
      name: "Corte + Barba",
      priceInCents: 5500,
      durationMinutes: 50,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name: service.name,
        },
      },
      update: {
        priceInCents: service.priceInCents,
        durationMinutes: service.durationMinutes,
        isActive: true,
      },
      create: {
        businessId: business.id,
        ...service,
        isActive: true,
      },
    });
  }

  const workingHours: SeedWorkingHour[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "18:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    isActive: true,
  }));

  workingHours.push({
    dayOfWeek: DayOfWeek.SATURDAY,
    startTime: "09:00",
    endTime: "13:00",
    breakStart: null,
    breakEnd: null,
    isActive: true,
  });

  workingHours.push({
    dayOfWeek: DayOfWeek.SUNDAY,
    startTime: null,
    endTime: null,
    breakStart: null,
    breakEnd: null,
    isActive: false,
  });

  for (const workingHour of workingHours) {
    await prisma.workingHour.upsert({
      where: {
        businessId_dayOfWeek: {
          businessId: business.id,
          dayOfWeek: workingHour.dayOfWeek,
        },
      },
      update: workingHour,
      create: {
        businessId: business.id,
        ...workingHour,
      },
    });
  }

  await seedSuperAdmin();
}

async function seedSuperAdmin() {
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    return;
  }

  const superAdminPasswordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash: superAdminPasswordHash,
      role: UserRole.SUPER_ADMIN,
    },
    create: {
      name,
      email,
      passwordHash: superAdminPasswordHash,
      role: UserRole.SUPER_ADMIN,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
