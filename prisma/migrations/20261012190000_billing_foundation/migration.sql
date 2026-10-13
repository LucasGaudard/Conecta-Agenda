-- Billing foundation only: additive structures, no backfill and no changes to existing subscriptions.
CREATE TYPE "BillingProvider" AS ENUM ('MERCADO_PAGO');
CREATE TYPE "BillingEnvironment" AS ENUM ('TEST', 'PRODUCTION');
CREATE TYPE "BillingCheckoutStatus" AS ENUM ('CREATED', 'PROVIDER_CREATED', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "BillingEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'REFUNDED', 'CHARGED_BACK', 'UNKNOWN');

ALTER TABLE "Subscription"
  ADD COLUMN "provider" "BillingProvider",
  ADD COLUMN "providerEnvironment" "BillingEnvironment",
  ADD COLUMN "providerSubscriptionId" TEXT,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "externalReference" TEXT,
  ADD COLUMN "nextPaymentAt" TIMESTAMP(3),
  ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "lastProviderSyncAt" TIMESTAMP(3);

CREATE TABLE "ProviderPlan" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "environment" "BillingEnvironment" NOT NULL,
  "providerPlanId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingCheckoutAttempt" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "environment" "BillingEnvironment" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "providerSubscriptionId" TEXT,
  "status" "BillingCheckoutStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingCheckoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "provider" "BillingProvider" NOT NULL,
  "environment" "BillingEnvironment" NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "requestId" TEXT,
  "topic" TEXT NOT NULL,
  "action" TEXT,
  "resourceId" TEXT NOT NULL,
  "payloadHash" TEXT,
  "status" "BillingEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingPayment" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "provider" "BillingProvider" NOT NULL,
  "environment" "BillingEnvironment" NOT NULL,
  "providerPaymentId" TEXT NOT NULL,
  "providerAuthorizedPaymentId" TEXT,
  "status" "BillingPaymentStatus" NOT NULL,
  "providerStatus" TEXT NOT NULL,
  "statusDetail" TEXT,
  "amountInCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "paidAt" TIMESTAMP(3),
  "providerCreatedAt" TIMESTAMP(3),
  "providerUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_externalReference_key" ON "Subscription"("externalReference");
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "Subscription_provider_providerEnvironment_providerSubscriptionId_key" ON "Subscription"("provider", "providerEnvironment", "providerSubscriptionId");

CREATE UNIQUE INDEX "ProviderPlan_planId_provider_environment_key" ON "ProviderPlan"("planId", "provider", "environment");
CREATE UNIQUE INDEX "ProviderPlan_provider_environment_providerPlanId_key" ON "ProviderPlan"("provider", "environment", "providerPlanId");
CREATE INDEX "ProviderPlan_provider_environment_isActive_idx" ON "ProviderPlan"("provider", "environment", "isActive");

CREATE UNIQUE INDEX "BillingCheckoutAttempt_idempotencyKey_key" ON "BillingCheckoutAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "BillingCheckoutAttempt_externalReference_key" ON "BillingCheckoutAttempt"("externalReference");
CREATE INDEX "BillingCheckoutAttempt_subscriptionId_createdAt_idx" ON "BillingCheckoutAttempt"("subscriptionId", "createdAt");
CREATE INDEX "BillingCheckoutAttempt_provider_environment_providerSubscriptionId_idx" ON "BillingCheckoutAttempt"("provider", "environment", "providerSubscriptionId");
CREATE INDEX "BillingCheckoutAttempt_status_expiresAt_idx" ON "BillingCheckoutAttempt"("status", "expiresAt");

CREATE UNIQUE INDEX "BillingEvent_deduplicationKey_key" ON "BillingEvent"("deduplicationKey");
CREATE UNIQUE INDEX "BillingEvent_provider_environment_topic_providerEventId_key" ON "BillingEvent"("provider", "environment", "topic", "providerEventId");
CREATE INDEX "BillingEvent_subscriptionId_receivedAt_idx" ON "BillingEvent"("subscriptionId", "receivedAt");
CREATE INDEX "BillingEvent_status_receivedAt_idx" ON "BillingEvent"("status", "receivedAt");
CREATE INDEX "BillingEvent_provider_environment_resourceId_idx" ON "BillingEvent"("provider", "environment", "resourceId");

CREATE UNIQUE INDEX "BillingPayment_provider_environment_providerPaymentId_key" ON "BillingPayment"("provider", "environment", "providerPaymentId");
CREATE INDEX "BillingPayment_subscriptionId_status_idx" ON "BillingPayment"("subscriptionId", "status");
CREATE INDEX "BillingPayment_provider_environment_providerAuthorizedPaymentId_idx" ON "BillingPayment"("provider", "environment", "providerAuthorizedPaymentId");
CREATE INDEX "BillingPayment_status_providerUpdatedAt_idx" ON "BillingPayment"("status", "providerUpdatedAt");

ALTER TABLE "ProviderPlan" ADD CONSTRAINT "ProviderPlan_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingCheckoutAttempt" ADD CONSTRAINT "BillingCheckoutAttempt_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
