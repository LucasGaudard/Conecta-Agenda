import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { buildApp } from "../app";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../utils/jwt";

test("commercial guards, public privacy, tenant isolation and immediate unblock (no database)", async () => {
  const subscription = {
    status: "ACTIVE",
    currentPeriodEnd: new Date(Date.now() + 86400000),
    currentPeriodStart: new Date(),
    trialEndsAt: null,
    plan: { name: "Plano", slug: "plano", priceInCents: 5000 },
  };
  const business = {
    id: "own-business",
    name: "Teste",
    slug: "teste",
    isManuallyBlocked: true,
    blockReason: "SECRET INTERNAL REASON",
    blockedByUserId: "secret-admin",
    accessOverrideUntil: null,
    settings: null,
    user: { subscription },
  };
  const user = {
    id: "professional",
    name: "Teste",
    email: "test@example.com",
    role: "PROFESSIONAL",
    business,
    subscription,
  };
  let businessReads = 0;
  const originalUser = prisma.user.findUnique;
  const originalBusiness = prisma.business.findUnique;
  prisma.user.findUnique = mock.fn(
    async () => user,
  ) as unknown as typeof prisma.user.findUnique;
  prisma.business.findUnique = mock.fn(
    async (args: { where: { id?: string; slug?: string } }) => {
      businessReads++;
      if (args.where.id) assert.equal(args.where.id, "own-business");
      return business;
    },
  ) as unknown as typeof prisma.business.findUnique;
  const originalTransaction = prisma.$transaction;
  const transaction = mock.fn(async () => {
    throw new Error("Unexpected write");
  });
  prisma.$transaction = transaction as typeof prisma.$transaction;
  const app = buildApp();
  const token = signAuthToken({ userId: user.id, businessId: business.id });
  const headers = { authorization: `Bearer ${token}` };
  try {
    for (const url of [
      "/dashboard",
      "/services",
      "/working-hours",
      "/blocked-times",
      "/customers",
      "/appointments",
      "/finance/summary",
    ]) {
      const response = await app.inject({ url, headers });
      assert.equal(response.statusCode, 403, url);
      assert.equal(response.json().code, "BUSINESS_ACCESS_BLOCKED");
    }
    for (const [method, url] of [
      ["PUT", "/business/me"],
      ["POST", "/onboarding/complete"],
      ["POST", "/appointments"],
      ["DELETE", "/appointments/id"],
    ] as const) {
      assert.equal(
        (await app.inject({ method, url, headers, payload: {} })).statusCode,
        403,
      );
    }
    const status = await app.inject({ url: "/billing/status?businessId=other", headers });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().canAccess, false);
    assert.ok(!status.body.includes("SECRET"));
    assert.ok(!status.body.includes("secret-admin"));
    assert.equal((await app.inject({ url: "/auth/me", headers })).statusCode, 200);
    assert.equal((await app.inject({ url: "/business/me", headers })).statusCode, 200);
    const publicPage = await app.inject({ url: "/public/teste" });
    assert.equal(publicPage.json().business.bookingAvailable, false);
    assert.ok(
      !/SECRET|PAST_DUE|MANUALLY_BLOCKED|subscription|passwordHash/.test(publicPage.body),
    );
    for (const request of [
      { url: "/public/teste/available-times?serviceId=s&date=2099-01-01" },
      {
        method: "POST" as const,
        url: "/public/teste/appointments",
        payload: {
          serviceId: "s",
          date: "2099-01-01",
          startTime: "10:00",
          customerName: "Cliente",
          customerWhatsapp: "11999999999",
        },
      },
    ]) {
      const response = await app.inject(request);
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().code, "PUBLIC_BOOKING_UNAVAILABLE");
      assert.ok(!/pagamento|assinatura|SECRET|MANUALLY_BLOCKED/.test(response.body));
    }
    assert.equal(transaction.mock.callCount(), 0);
    business.isManuallyBlocked = false;
    // Invalid payload reaches validation only after the guard allows this same token.
    assert.equal(
      (await app.inject({ method: "POST", url: "/appointments", headers, payload: {} }))
        .statusCode,
      400,
    );
    subscription.status = "PAST_DUE";
    subscription.currentPeriodEnd = new Date("2020-01-01");
    assert.equal((await app.inject({ url: "/dashboard", headers })).statusCode, 402);
    assert.equal(
      (await app.inject({ url: "/admin/businesses", headers })).statusCode,
      403,
    );
    user.role = "SUPER_ADMIN";
    const reads = businessReads;
    assert.equal(
      (await app.inject({ url: "/admin/businesses?page=invalid", headers })).statusCode,
      400,
    );
    assert.equal(businessReads, reads);
    assert.equal((await app.inject({ url: "/dashboard" })).statusCode, 401);
  } finally {
    await app.close();
    prisma.user.findUnique = originalUser;
    prisma.business.findUnique = originalBusiness;
    prisma.$transaction = originalTransaction;
    mock.restoreAll();
  }
});
