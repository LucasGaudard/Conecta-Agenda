import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { getBillingConfig } from "./config";
import { getBillingProvider } from "./index";
import { MercadoPagoBillingProvider } from "./mercado-pago-provider";
import { buildApp } from "../app";
import { prisma } from "../lib/prisma";
import { signAuthToken } from "../utils/jwt";

test("missing, partial and invalid configuration do not throw", () => {
  assert.equal(getBillingConfig({}).providerConfigured, false);
  assert.equal(
    getBillingConfig({ MERCADO_PAGO_ACCESS_TOKEN: "test-only" }).providerConfigured,
    false,
  );
  assert.equal(
    getBillingConfig({ MERCADO_PAGO_SUCCESS_URL: "javascript:alert(1)" }).successUrl,
    null,
  );
});

test("all provider operations fail closed, including configured adapter, without network", async () => {
  const network = mock.method(globalThis, "fetch", async () => {
    throw new Error("Network forbidden");
  });
  const config = getBillingConfig({
    MERCADO_PAGO_ACCESS_TOKEN: "test-only",
    MERCADO_PAGO_WEBHOOK_SECRET: "test-only",
    MERCADO_PAGO_PLAN_ID: "test-plan",
    MERCADO_PAGO_SUCCESS_URL: "https://example.com/success",
    MERCADO_PAGO_FAILURE_URL: "https://example.com/failure",
    MERCADO_PAGO_PENDING_URL: "https://example.com/pending",
  });
  assert.equal(config.providerConfigured, true);
  try {
    for (const [provider, code] of [
      [getBillingProvider(getBillingConfig({})), "BILLING_PROVIDER_NOT_CONFIGURED"],
      [
        new MercadoPagoBillingProvider(getBillingConfig({})),
        "BILLING_PROVIDER_NOT_CONFIGURED",
      ],
      [getBillingProvider(config), "BILLING_PROVIDER_NOT_IMPLEMENTED"],
    ] as const) {
      for (const operation of [
        () =>
          provider.createSubscriptionCheckout({
            subscriptionId: "s",
            businessId: "b",
            userId: "u",
            plan: { id: "p", priceInCents: 100 },
          }),
        () => provider.getSubscription("test-id"),
        () => provider.cancelSubscription("test-id"),
        () => provider.reactivateSubscription("test-id"),
      ])
        await assert.rejects(operation, { code });
    }
    assert.equal(network.mock.callCount(), 0);
  } finally {
    network.mock.restore();
  }
});

test("billing routes and webhook never mutate subscription or trust caller fields", async () => {
  const names = [
    "ACCESS_TOKEN",
    "WEBHOOK_SECRET",
    "PLAN_ID",
    "SUCCESS_URL",
    "FAILURE_URL",
    "PENDING_URL",
  ].map((key) => `MERCADO_PAGO_${key}`);
  const originalEnv = names.map((key) => process.env[key]);
  names.forEach((key) => {
    delete process.env[key];
  });
  const subscription = {
    id: "s",
    status: "PAST_DUE",
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    plan: { id: "p", name: "Plano", slug: "plano", priceInCents: 5000 },
  };
  const business = {
    id: "b",
    isManuallyBlocked: true,
    accessOverrideUntil: null,
    user: { id: "u", subscription },
  };
  const user: { id: string; role: string; business: { id: string } | null } = {
    id: "u",
    role: "PROFESSIONAL",
    business: { id: "b" },
  };
  const originals = {
    user: prisma.user.findUnique,
    business: prisma.business.findUnique,
    update: prisma.subscription.update,
    transaction: prisma.$transaction,
  };
  prisma.user.findUnique = mock.fn(
    async () => user,
  ) as unknown as typeof prisma.user.findUnique;
  prisma.business.findUnique = mock.fn(async (args: { where: { id: string } }) => {
    assert.equal(args.where.id, "b");
    return business;
  }) as unknown as typeof prisma.business.findUnique;
  const writes = mock.fn(async () => {
    throw new Error("Unexpected write");
  });
  prisma.subscription.update = writes as unknown as typeof prisma.subscription.update;
  prisma.$transaction = writes as unknown as typeof prisma.$transaction;
  const app = buildApp();
  const headers = {
    authorization: `Bearer ${signAuthToken({ userId: "u", businessId: "b" })}`,
  };
  try {
    for (const url of ["/billing/checkout", "/billing/cancel"]) {
      assert.equal((await app.inject({ method: "POST", url })).statusCode, 401);
      const response = await app.inject({ method: "POST", url, headers });
      assert.equal(response.statusCode, 503);
      assert.equal(response.json().code, "BILLING_PROVIDER_NOT_CONFIGURED");
      for (const payload of [
        { businessId: "other" },
        { priceInCents: 1 },
        { status: "ACTIVE" },
        { providerSubscriptionId: "other" },
      ])
        assert.equal(
          (await app.inject({ method: "POST", url, headers, payload })).statusCode,
          400,
        );
      assert.equal(
        (await app.inject({ method: "POST", url: `${url}?businessId=other`, headers }))
          .statusCode,
        400,
      );
      user.role = "SUPER_ADMIN";
      assert.equal((await app.inject({ method: "POST", url, headers })).statusCode, 403);
      user.role = "PROFESSIONAL";
      user.business = null;
      assert.equal((await app.inject({ method: "POST", url, headers })).statusCode, 403);
      user.business = { id: "b" };
    }
    const status = await app.inject({ url: "/billing/status", headers });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().providerConfigured, false);
    assert.equal(status.json().checkoutAvailable, false);
    assert.ok(!/accessToken|webhookSecret|providerSubscriptionId/.test(status.body));
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/webhooks/mercado-pago",
          payload: { status: "ACTIVE" },
        })
      ).statusCode,
      400,
    );
    const notification = {
      type: "subscription_preapproval",
      data: { id: "test-id" },
      status: "ACTIVE",
    };
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/mercado-pago",
      payload: notification,
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().code, "BILLING_PROVIDER_NOT_CONFIGURED");
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-only";
    const configured = await app.inject({
      method: "POST",
      url: "/webhooks/mercado-pago",
      payload: notification,
    });
    assert.equal(configured.statusCode, 503);
    assert.equal(configured.json().processed, false);
    assert.equal(subscription.status, "PAST_DUE");
    assert.equal(writes.mock.callCount(), 0);
  } finally {
    await app.close();
    prisma.user.findUnique = originals.user;
    prisma.business.findUnique = originals.business;
    prisma.subscription.update = originals.update;
    prisma.$transaction = originals.transaction;
    names.forEach((key, index) => {
      const value = originalEnv[index];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
});
