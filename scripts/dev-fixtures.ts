/* eslint @typescript-eslint/no-require-imports: "off" -- Load the guarded profile before runtime API/Prisma imports. */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";

const {
  readContext,
  revalidate,
  history,
  migrations,
  safeError,
} = require("./dev-database.cjs");
const root = path.resolve(__dirname, "..");
const accountsRelative = "apps/api/.env.development.accounts.local";
const accountsFile = path.join(root, accountsRelative);
const professionalEmail = "profissional@conecta-agenda.test";
const adminEmail = "superadmin@conecta-agenda.test";
const professionalName = "Profissional Ficticio Dev";
const adminName = "Administrador Ficticio Dev";
const businessName = "Agenda Ficticia Dev";
const businessSlug = "agenda-ficticia-dev";
type App = ReturnType<typeof import("../apps/api/src/app").buildApp>;
type AccountResponse = {
  token: string;
  user: { id: string; role: string };
  business: { id: string } | null;
};

function ensure(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
function credentials(host: string, database: string) {
  const ignored = spawnSync("git", ["check-ignore", "--quiet", accountsRelative], {
    cwd: root,
  });
  ensure(ignored.status === 0, "DEV_ACCOUNTS_MUST_BE_GIT_IGNORED");
  if (!existsSync(accountsFile)) {
    const password = () => `Aa9!${randomBytes(24).toString("base64url")}`;
    writeFileSync(
      accountsFile,
      [
        "# PRIVATE: fictional Neon DEV accounts only. Never share or commit this file.",
        `DEV_DATABASE_HOST=${host}`,
        `DEV_DATABASE_NAME=${database}`,
        `PROFESSIONAL_EMAIL=${professionalEmail}`,
        `PROFESSIONAL_PASSWORD=${password()}`,
        `SUPER_ADMIN_EMAIL=${adminEmail}`,
        `SUPER_ADMIN_PASSWORD=${password()}`,
        "",
      ].join("\n"),
      { flag: "wx", mode: 0o600 },
    );
  }
  const values = parseEnv(readFileSync(accountsFile, "utf8"));
  ensure(
    values.DEV_DATABASE_HOST === host && values.DEV_DATABASE_NAME === database,
    "DEV_ACCOUNTS_DESTINATION_MISMATCH",
  );
  ensure(
    values.PROFESSIONAL_EMAIL === professionalEmail &&
      values.SUPER_ADMIN_EMAIL === adminEmail,
    "DEV_ACCOUNTS_IDENTITY_MISMATCH",
  );
  ensure(
    values.PROFESSIONAL_PASSWORD &&
      values.SUPER_ADMIN_PASSWORD &&
      values.PROFESSIONAL_PASSWORD !== values.SUPER_ADMIN_PASSWORD,
    "DEV_ACCOUNTS_PASSWORD_INVALID",
  );
  return values as typeof values & {
    PROFESSIONAL_PASSWORD: string;
    SUPER_ADMIN_PASSWORD: string;
  };
}
function dateString(offset: number) {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function main() {
  const context = readContext();
  console.log(JSON.stringify({ fixtureValidation: await revalidate(context) }));
  const { PrismaClient, UserRole, DayOfWeek, AppointmentStatus } =
    require("@prisma/client") as typeof import("@prisma/client");
  const client = new PrismaClient({
    datasourceUrl: context.config.DATABASE_URL,
    log: [],
  });
  // API routes must use exactly this explicitly targeted, silent Prisma client.
  (globalThis as typeof globalThis & { prisma: PrismaClient }).prisma = client;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("DEV_EXTERNAL_HTTP_REFUSED");
  };
  let app: App | undefined;
  const checks: string[] = [];
  try {
    const state = await history(client, migrations());
    ensure(
      state.applied.length === 4 && state.pending.length === 0,
      "DEV_SCHEMA_NOT_READY",
    );
    const unknownUsers = await client.user.count({
      where: { email: { notIn: [professionalEmail, adminEmail] } },
    });
    ensure(unknownUsers === 0, "DEV_NON_FIXTURE_USERS_REFUSED");
    const accounts = credentials(
      new URL(context.config.DATABASE_URL).hostname,
      context.config.DEV_DATABASE_NAME,
    );
    const { provisionAdmin, validateAdminEnvironment } =
      require("../prisma/admin-provisioning") as typeof import("../prisma/admin-provisioning");
    const { hashPassword } =
      require("../apps/api/src/utils/password") as typeof import("../apps/api/src/utils/password");
    validateAdminEnvironment({
      SUPER_ADMIN_NAME: adminName,
      SUPER_ADMIN_EMAIL: adminEmail,
      SUPER_ADMIN_PASSWORD: accounts.SUPER_ADMIN_PASSWORD,
    });
    validateAdminEnvironment({
      SUPER_ADMIN_NAME: professionalName,
      SUPER_ADMIN_EMAIL: professionalEmail,
      SUPER_ADMIN_PASSWORD: accounts.PROFESSIONAL_PASSWORD,
    });
    const { buildApp } =
      require("../apps/api/src/app") as typeof import("../apps/api/src/app");
    const { env } =
      require("../apps/api/src/env") as typeof import("../apps/api/src/env");
    const { prisma } =
      require("../apps/api/src/lib/prisma") as typeof import("../apps/api/src/lib/prisma");
    ensure(
      prisma === client &&
        env.DATABASE_URL === context.config.DATABASE_URL &&
        env.JWT_SECRET === context.config.JWT_SECRET &&
        process.env.BILLING_CHECKOUT_MODE === "OFF",
      "DEV_API_DATASOURCE_MISMATCH",
    );
    app = buildApp();
    app.log.level = "silent";
    await app.ready();
    const request = async (
      method: "GET" | "POST" | "PUT" | "OPTIONS",
      url: string,
      status = 200,
      token?: string,
      payload?: Record<string, unknown>,
    ) => {
      const response = await app!.inject({
        method,
        url,
        payload,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      ensure(response.statusCode === status, "DEV_FIXTURE_HTTP_CHECK_FAILED");
      return response;
    };
    // Refuse account collisions and credential mismatches before any fixture write.
    const existingAccounts = await client.user.findMany({
      where: { email: { in: [professionalEmail, adminEmail] } },
      include: { business: true, subscription: true },
    });
    for (const account of existingAccounts) {
      const isProfessional = account.email === professionalEmail;
      ensure(
        account.name === (isProfessional ? professionalName : adminName) &&
          account.role ===
            (isProfessional ? UserRole.PROFESSIONAL : UserRole.SUPER_ADMIN) &&
          (isProfessional
            ? account.business?.name === businessName
            : !account.business && !account.subscription),
        "DEV_EXISTING_ACCOUNT_REFUSED",
      );
      await request("POST", "/auth/login", 200, undefined, {
        email: account.email,
        password: isProfessional
          ? accounts.PROFESSIONAL_PASSWORD
          : accounts.SUPER_ADMIN_PASSWORD,
      });
    }
    // Last identity/TLS/profile check immediately before the first seed write.
    console.log(
      JSON.stringify({
        beforeFixturesValidation: await revalidate(context),
        apiUsesExplicitDevClient: true,
      }),
    );
    for (const [slug, name, priceInCents] of [
      ["starter", "Starter Dev", 3900],
      ["pro", "Pro Dev", 6900],
      ["premium", "Premium Dev", 9900],
    ] as const) {
      if (!(await client.plan.findUnique({ where: { slug } })))
        await client.plan.create({
          data: {
            id: `dev43_plan_${slug}`,
            slug,
            name,
            priceInCents,
            description: "Plano ficticio para testes locais; sem cobranca.",
          },
        });
    }
    let professional: AccountResponse;
    const existingProfessional = await client.user.findUnique({
      where: { email: professionalEmail },
    });
    if (existingProfessional) {
      ensure(
        existingProfessional.role === UserRole.PROFESSIONAL &&
          existingProfessional.name === professionalName,
        "DEV_EXISTING_ACCOUNT_REFUSED",
      );
      professional = (
        await request("POST", "/auth/login", 200, undefined, {
          email: professionalEmail,
          password: accounts.PROFESSIONAL_PASSWORD,
        })
      ).json<AccountResponse>();
    } else {
      professional = (
        await request("POST", "/auth/register", 201, undefined, {
          name: professionalName,
          email: professionalEmail,
          password: accounts.PROFESSIONAL_PASSWORD,
          businessName,
          whatsapp: "5500000000000",
        })
      ).json<AccountResponse>();
      ensure(
        (await request("GET", "/onboarding/status", 200, professional.token)).json()
          .completed === false,
        "DEV_ONBOARDING_INITIAL_STATE_FAILED",
      );
      checks.push("registration-and-initial-onboarding");
    }
    ensure(
      professional.user.role === "PROFESSIONAL" && professional.business,
      "DEV_PROFESSIONAL_ROLE_FAILED",
    );
    const businessId = professional.business.id;
    const business = await client.business.findUniqueOrThrow({
      where: { id: businessId },
    });
    ensure(business.name === businessName, "DEV_EXISTING_BUSINESS_REFUSED");
    const originalTrial = await client.subscription.findUniqueOrThrow({
      where: { userId: professional.user.id },
    });
    ensure(
      originalTrial.status === "TRIALING" &&
        originalTrial.trialEndsAt &&
        originalTrial.trialEndsAt.getTime() - business.createdAt.getTime() ===
          7 * 86400000 &&
        originalTrial.currentPeriodStart === null &&
        originalTrial.currentPeriodEnd === null,
      "DEV_TRIAL_SEVEN_DAYS_FAILED",
    );
    if (
      !(await request("GET", "/onboarding/status", 200, professional.token)).json()
        .completed
    ) {
      await request("POST", "/onboarding/complete", 200, professional.token, {
        name: businessName,
        slug: businessSlug,
        whatsapp: "5500000000000",
        city: "Cidade Ficticia",
        description:
          "Ambiente exclusivo de desenvolvimento. Todos os dados sao ficticios.",
        primaryColor: "#7C3AED",
        timezone: "America/Sao_Paulo",
        bookingIntervalMinutes: 30,
      });
    }
    ensure(
      (await request("GET", "/onboarding/status", 200, professional.token)).json()
        .completed === true,
      "DEV_ONBOARDING_COMPLETION_FAILED",
    );
    checks.push("onboarding-completion", "seven-day-trial-from-business-creation");
    const existingAdmin = await client.user.findUnique({
      where: { email: adminEmail },
      include: { business: true, subscription: true },
    });
    if (existingAdmin) {
      ensure(
        existingAdmin.role === UserRole.SUPER_ADMIN &&
          existingAdmin.name === adminName &&
          !existingAdmin.business &&
          !existingAdmin.subscription,
        "DEV_EXISTING_ADMIN_REFUSED",
      );
    } else {
      await provisionAdmin(
        {
          SUPER_ADMIN_NAME: adminName,
          SUPER_ADMIN_EMAIL: adminEmail,
          SUPER_ADMIN_PASSWORD: accounts.SUPER_ADMIN_PASSWORD,
        },
        {
          findExisting: async (email) =>
            Boolean(
              await client.user.findUnique({ where: { email }, select: { id: true } }),
            ),
          create: async (data) => {
            await client.user.create({ data });
          },
        },
        hashPassword,
      );
    }
    const admin = (
      await request("POST", "/auth/login", 200, undefined, {
        email: adminEmail,
        password: accounts.SUPER_ADMIN_PASSWORD,
      })
    ).json<AccountResponse>();
    ensure(
      admin.user.role === "SUPER_ADMIN" && admin.business === null,
      "DEV_ADMIN_ROLE_FAILED",
    );
    const login = (
      await request("POST", "/auth/login", 200, undefined, {
        email: professionalEmail,
        password: accounts.PROFESSIONAL_PASSWORD,
      })
    ).json<AccountResponse>();
    ensure(login.user.id === professional.user.id, "DEV_LOGIN_IDENTITY_FAILED");
    await request("POST", "/auth/login", 401, undefined, {
      email: professionalEmail,
      password: "invalid-fixture-password",
    });
    await request("GET", "/dashboard", 401);
    await request("GET", "/admin/overview", 403, professional.token);
    await request("GET", "/admin/overview", 200, admin.token);
    const adminMe = (await request("GET", "/auth/me", 200, admin.token)).json();
    ensure(
      adminMe.business === null &&
        adminMe.subscription === null &&
        adminMe.access === null,
      "DEV_ADMIN_BUSINESS_ISOLATION_FAILED",
    );
    const professionalMe = (
      await request("GET", "/auth/me", 200, professional.token)
    ).json();
    ensure(
      professionalMe.access?.canAccess === true &&
        professionalMe.access.status === "TRIAL",
      "DEV_TRIAL_ACCESS_FAILED",
    );
    checks.push(
      "both-real-password-logins",
      "invalid-login-and-anonymous-rejection",
      "professional-admin-permissions",
      "admin-without-business-or-subscription",
      "trial-access",
    );
    const services = [
      {
        id: "dev43_service_standard",
        name: "Atendimento Ficticio",
        priceInCents: 8000,
        durationMinutes: 30,
        isActive: true,
      },
      {
        id: "dev43_service_extended",
        name: "Sessao Ficticia Completa",
        priceInCents: 15000,
        durationMinutes: 60,
        isActive: true,
      },
      {
        id: "dev43_service_inactive",
        name: "Servico Ficticio Inativo",
        priceInCents: 5000,
        durationMinutes: 30,
        isActive: false,
      },
    ];
    for (const service of services) {
      const existing = await client.service.findUnique({ where: { id: service.id } });
      ensure(
        !existing || existing.businessId === businessId,
        "DEV_FIXTURE_TENANT_MISMATCH",
      );
      if (!existing) await client.service.create({ data: { ...service, businessId } });
    }
    for (let index = 1; index <= 4; index++) {
      const id = `dev43_customer_${index}`;
      const existing = await client.customer.findUnique({ where: { id } });
      ensure(
        !existing || existing.businessId === businessId,
        "DEV_FIXTURE_TENANT_MISMATCH",
      );
      if (!existing)
        await client.customer.create({
          data: {
            id,
            businessId,
            name: `Cliente Ficticio ${index}`,
            whatsapp: `550000000000${index}`,
            notes: "Dados ficticios; nao enviar mensagens.",
          },
        });
    }
    if (!(await client.workingHour.count({ where: { businessId } })))
      await request("PUT", "/working-hours", 200, professional.token, {
        workingHours: Object.values(DayOfWeek).map((dayOfWeek) => ({
          dayOfWeek,
          isActive: true,
          startTime: "09:00",
          endTime: "18:00",
          breakStart: "12:00",
          breakEnd: "13:00",
        })),
      });
    if (!(await client.blockedTime.count({ where: { businessId } })))
      await request("POST", "/blocked-times", 201, professional.token, {
        date: dateString(1),
        startTime: "15:00",
        endTime: "16:00",
        reason: "Bloqueio ficticio para testar a agenda",
      });
    // Historical/final states are fixtures, not payments; no BillingPayment is written.
    const appointments = [
      [-1, "09:00", "09:30", AppointmentStatus.COMPLETED],
      [0, "09:00", "09:30", AppointmentStatus.COMPLETED],
      [0, "10:00", "10:30", AppointmentStatus.CONFIRMED],
      [0, "11:00", "11:30", AppointmentStatus.SCHEDULED],
      [0, "14:00", "14:30", AppointmentStatus.CANCELED],
      [0, "16:00", "16:30", AppointmentStatus.NO_SHOW],
      [1, "09:00", "09:30", AppointmentStatus.SCHEDULED],
      [1, "10:00", "10:30", AppointmentStatus.CONFIRMED],
    ] as const;
    for (const [index, [offset, startTime, endTime, status]] of appointments.entries()) {
      const id = `dev43_appointment_${index}`;
      const existing = await client.appointment.findUnique({ where: { id } });
      ensure(
        !existing || existing.businessId === businessId,
        "DEV_FIXTURE_TENANT_MISMATCH",
      );
      if (!existing)
        await client.appointment.create({
          data: {
            id,
            businessId,
            customerId: `dev43_customer_${(index % 4) + 1}`,
            serviceId: services[0]!.id,
            serviceName: services[0]!.name,
            priceInCents: services[0]!.priceInCents,
            durationMinutes: 30,
            date: new Date(`${dateString(offset)}T00:00:00.000Z`),
            startTime,
            endTime,
            status,
            notes: "Agendamento ficticio para visualizacao local.",
          },
        });
    }
    const today = dateString(0),
      tomorrow = dateString(1);
    const dashboard = (
      await request("GET", "/dashboard", 200, professional.token)
    ).json();
    const finance = (
      await request("GET", "/finance/summary", 200, professional.token)
    ).json();
    ensure(
      dashboard.summary.totalServices === 2 &&
        dashboard.summary.totalCustomers === 4 &&
        dashboard.summary.totalAppointmentsToday === 5 &&
        dashboard.summary.totalAppointmentsTomorrow === 2,
      "DEV_DASHBOARD_FIXTURE_COUNTS_FAILED",
    );
    ensure(
      finance.today.completedInCents === 8000 &&
        finance.today.expectedInCents === 16000 &&
        finance.month.completedInCents >= 8000,
      "DEV_FINANCE_FIXTURE_COUNTS_FAILED",
    );
    await request("GET", `/appointments?date=${today}`, 200, professional.token);
    await request("GET", "/customers", 200, professional.token);
    await request("GET", "/services", 200, professional.token);
    ensure(
      (await request("GET", "/working-hours", 200, professional.token)).json()
        .workingHours.length === 7,
      "DEV_WORKING_HOURS_FAILED",
    );
    await request("GET", "/blocked-times", 200, professional.token);
    const slots = (
      await request(
        "GET",
        `/appointments/available-times?serviceId=${services[0]!.id}&date=${tomorrow}`,
        200,
        professional.token,
      )
    ).json();
    ensure(
      slots.availableTimes.includes("11:00") &&
        !slots.availableTimes.includes("15:00") &&
        !slots.availableTimes.includes("12:00"),
      "DEV_AVAILABILITY_BLOCKS_FAILED",
    );
    await request("GET", `/public/${businessSlug}`, 200);
    const publicServices = (
      await request("GET", `/public/${businessSlug}/services`, 200)
    ).json();
    ensure(publicServices.services.length === 2, "DEV_INACTIVE_SERVICE_EXPOSURE");
    await request(
      "GET",
      `/public/${businessSlug}/available-times?serviceId=${services[0]!.id}&date=${tomorrow}`,
      200,
    );
    checks.push(
      "dashboard-real-fixture-counts",
      "finance-real-fixture-totals",
      "agenda-customers-services",
      "seven-working-days",
      "availability-breaks-and-blocks",
      "public-booking-and-active-services",
    );
    const billing = (
      await request("GET", "/billing/status", 200, professional.token)
    ).json();
    ensure(
      billing.providerConfigured === false &&
        billing.checkoutAvailable === false &&
        billing.currentPeriodStart === null &&
        billing.currentPeriodEnd === null,
      "DEV_BILLING_NOT_OFF",
    );
    await request("POST", "/billing/checkout", 503, professional.token, {});
    const finalTrial = await client.subscription.findUniqueOrThrow({
      where: { id: originalTrial.id },
    });
    ensure(
      finalTrial.status === originalTrial.status &&
        finalTrial.trialEndsAt?.getTime() === originalTrial.trialEndsAt!.getTime(),
      "DEV_TRIAL_MUTATION_REFUSED",
    );
    ensure(
      (await client.billingPayment.count()) === 0 &&
        (await client.billingCheckoutAttempt.count()) === 0,
      "DEV_UNEXPECTED_BILLING_DATA",
    );
    checks.push(
      "mercado-pago-and-checkout-off",
      "checkout-never-grants-paid-access",
      "trial-never-restarted",
    );
    console.log(
      JSON.stringify({
        prepared: true,
        accountEmails: [professionalEmail, adminEmail],
        credentialFile: accountsRelative,
        credentialsPrinted: false,
        counts: {
          users: await client.user.count(),
          businesses: await client.business.count(),
          plans: await client.plan.count(),
          subscriptions: await client.subscription.count(),
          services: await client.service.count(),
          customers: await client.customer.count(),
          appointments: await client.appointment.count(),
          workingHours: await client.workingHour.count(),
          blockedTimes: await client.blockedTime.count(),
          billingPayments: 0,
          checkoutAttempts: 0,
        },
        checks,
        checksPassed: checks.length,
        persistentServersStarted: false,
      }),
    );
  } finally {
    if (app) await app.close();
    await client.$disconnect();
    globalThis.fetch = previousFetch;
  }
}
void main().catch((error) => {
  console.error(safeError(error));
  process.exitCode = 1;
});
