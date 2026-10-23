-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('SHOPIFY_WEB', 'FACEBOOK', 'STORE');

-- CreateEnum
CREATE TYPE "LuckyCodeStatus" AS ENUM ('PENDING', 'ACTIVE', 'USED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CodEligibilityMode" AS ENUM ('CONFIRMED_ORDER', 'PAID', 'MANUAL_APPROVAL');

-- CreateEnum
CREATE TYPE "WinnerNameMode" AS ENUM ('MASKED', 'FIRST_NAME', 'FULL_NAME_WITH_CONSENT');

-- CreateEnum
CREATE TYPE "PrizeType" AS ENUM ('VOUCHER', 'FREE_SHIPPING', 'PRODUCT_POOL');

-- CreateEnum
CREATE TYPE "GiftCategory" AS ENUM ('POLO', 'TSHIRT', 'SHIRT', 'JACKET', 'PANTS', 'OTHER');

-- CreateEnum
CREATE TYPE "SpinStatus" AS ENUM ('COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "WinnerStatus" AS ENUM ('WON', 'CONFIRMED', 'FULFILLED', 'VOID');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "VoucherSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "ordersEndAt" TIMESTAMP(3),
    "minimumOrderValue" INTEGER NOT NULL DEFAULT 1300000,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "codePrefix" TEXT NOT NULL DEFAULT 'HUSSIO-BF26',
    "spinsPerOrder" INTEGER NOT NULL DEFAULT 1,
    "multiSpinEnabled" BOOLEAN NOT NULL DEFAULT false,
    "codeValidityDays" INTEGER NOT NULL DEFAULT 30,
    "codEligibilityMode" "CodEligibilityMode" NOT NULL DEFAULT 'CONFIRMED_ORDER',
    "winnerNameMode" "WinnerNameMode" NOT NULL DEFAULT 'MASKED',
    "voucherValidityDays" INTEGER NOT NULL DEFAULT 30,
    "voucherCombinesWithOrderDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "voucherCombinesWithProductDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "voucherCombinesWithShippingDiscounts" BOOLEAN NOT NULL DEFAULT false,
    "termsContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prize" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wheelLabel" TEXT NOT NULL,
    "wheelCaption" TEXT,
    "type" "PrizeType" NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "giftPoolId" TEXT,
    "voucherValue" INTEGER,
    "voucherMinSpend" INTEGER,
    "stockLimit" INTEGER,
    "stockUsed" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftPool" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GiftCategory" NOT NULL,
    "quantityTotal" INTEGER NOT NULL DEFAULT 0,
    "quantityRemaining" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftItem" (
    "id" TEXT NOT NULL,
    "giftPoolId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" "GiftCategory" NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LuckyCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "orderReference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerCity" TEXT,
    "phoneHash" TEXT NOT NULL,
    "phoneHint" TEXT,
    "orderValue" INTEGER NOT NULL,
    "status" "LuckyCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "shopifyOrderId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LuckyCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spin" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "luckyCodeId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "giftItemId" TEXT,
    "segmentIndex" INTEGER NOT NULL,
    "randomValue" INTEGER NOT NULL,
    "totalWeight" INTEGER NOT NULL,
    "status" "SpinStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Spin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PrizeType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minimumSpend" INTEGER,
    "status" "VoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "syncStatus" "VoucherSyncStatus" NOT NULL DEFAULT 'PENDING',
    "shopifyDiscountId" TEXT,
    "syncError" TEXT,
    "syncedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "redeemedOrderRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "spinId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "status" "WinnerStatus" NOT NULL DEFAULT 'WON',
    "city" TEXT,
    "consentFullName" BOOLEAN NOT NULL DEFAULT false,
    "sizePreference" TEXT,
    "customerNote" TEXT,
    "customerConfirmedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "shopDomain" TEXT,
    "orderId" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "note" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "Channel",
    "prizeId" TEXT,
    "luckyCodeId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Prize_campaignId_active_sortOrder_idx" ON "Prize"("campaignId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPool_campaignId_category_key" ON "GiftPool"("campaignId", "category");

-- CreateIndex
CREATE INDEX "GiftItem_giftPoolId_active_quantity_idx" ON "GiftItem"("giftPoolId", "active", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "LuckyCode_code_key" ON "LuckyCode"("code");

-- CreateIndex
CREATE INDEX "LuckyCode_campaignId_status_idx" ON "LuckyCode"("campaignId", "status");

-- CreateIndex
CREATE INDEX "LuckyCode_channel_orderReference_idx" ON "LuckyCode"("channel", "orderReference");

-- CreateIndex
CREATE UNIQUE INDEX "LuckyCode_campaignId_channel_orderReference_key" ON "LuckyCode"("campaignId", "channel", "orderReference");

-- CreateIndex
CREATE UNIQUE INDEX "Spin_luckyCodeId_key" ON "Spin"("luckyCodeId");

-- CreateIndex
CREATE INDEX "Spin_campaignId_createdAt_idx" ON "Spin"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_spinId_key" ON "Voucher"("spinId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "Voucher_campaignId_status_idx" ON "Voucher"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_spinId_key" ON "Winner"("spinId");

-- CreateIndex
CREATE INDEX "Winner_campaignId_status_createdAt_idx" ON "Winner"("campaignId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_webhookId_key" ON "WebhookEvent"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookEvent_topic_receivedAt_idx" ON "WebhookEvent"("topic", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_campaignId_name_createdAt_idx" ON "AnalyticsEvent"("campaignId", "name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prize" ADD CONSTRAINT "Prize_giftPoolId_fkey" FOREIGN KEY ("giftPoolId") REFERENCES "GiftPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPool" ADD CONSTRAINT "GiftPool_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftItem" ADD CONSTRAINT "GiftItem_giftPoolId_fkey" FOREIGN KEY ("giftPoolId") REFERENCES "GiftPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LuckyCode" ADD CONSTRAINT "LuckyCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LuckyCode" ADD CONSTRAINT "LuckyCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_luckyCodeId_fkey" FOREIGN KEY ("luckyCodeId") REFERENCES "LuckyCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spin" ADD CONSTRAINT "Spin_giftItemId_fkey" FOREIGN KEY ("giftItemId") REFERENCES "GiftItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "Spin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_spinId_fkey" FOREIGN KEY ("spinId") REFERENCES "Spin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "Prize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
