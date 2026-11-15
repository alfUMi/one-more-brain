-- Trigram matching for fuzzy search on titles and bodies.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('TEXT', 'LINK', 'HIGHLIGHT', 'VOICE', 'IMAGE');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('INBOX', 'KEPT', 'ARCHIVED', 'DONE');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('WEB', 'EXTENSION', 'MOBILE', 'SHARE_SHEET', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "AiStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'SCREENSHOT', 'AUDIO');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('TIME', 'RECURRING', 'LOCATION');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('ACTIVE', 'FIRED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GeoTrigger" AS ENUM ('ENTER', 'EXIT');

-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('WEB_PUSH', 'EXTENSION_PUSH', 'FCM', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('REMINDER', 'DIGEST', 'REVIEW');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "digestTime" TEXT NOT NULL DEFAULT '08:00',
    "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDigestOn" DATE,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "accent" TEXT NOT NULL DEFAULT 'teal',
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "aiTokensMonth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'INBOX',
    "source" "ItemSource" NOT NULL,
    "title" TEXT,
    "titleIsAi" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT,
    "quote" TEXT,
    "url" TEXT,
    "pageTitle" TEXT,
    "favicon" TEXT,
    "language" TEXT,
    "aiStatus" "AiStatus" NOT NULL DEFAULT 'PENDING',
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "triagedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "search" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('simple', coalesce("quote", '')), 'B') ||
        setweight(to_tsvector('simple', coalesce("body", '')), 'B') ||
        setweight(to_tsvector('simple', coalesce("pageTitle", '')), 'C') ||
        setweight(to_tsvector('simple', coalesce("url", '')), 'D')
    ) STORED,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTag" (
    "itemId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "suggested" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemTag_pkey" PRIMARY KEY ("itemId","tagId")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "fireAt" TIMESTAMP(3),
    "rrule" TEXT,
    "timezone" TEXT NOT NULL,
    "untilAt" TIMESTAMP(3),
    "placeId" UUID,
    "geoTrigger" "GeoTrigger",
    "isAiSuggested" BOOLEAN NOT NULL DEFAULT false,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "radiusM" INTEGER NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "itemId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "graduatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("itemId")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ChannelKind" NOT NULL,
    "address" TEXT NOT NULL,
    "keys" JSONB,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "reminderId" UUID,
    "type" "DeliveryType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE INDEX "Item_userId_status_capturedAt_idx" ON "Item"("userId", "status", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "Item_userId_updatedAt_idx" ON "Item"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Item_userId_capturedAt_idx" ON "Item"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "Item_search_idx" ON "Item" USING GIN ("search");

-- CreateIndex
CREATE INDEX "Item_title_idx" ON "Item" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Item_body_idx" ON "Item" USING GIN ("body" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Attachment_itemId_idx" ON "Attachment"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "ItemTag_tagId_idx" ON "ItemTag"("tagId");

-- CreateIndex
CREATE INDEX "Reminder_status_fireAt_idx" ON "Reminder"("status", "fireAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_updatedAt_idx" ON "Reminder"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Review_userId_nextAt_idx" ON "Review"("userId", "nextAt");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_kind_address_key" ON "Channel"("kind", "address");

-- CreateIndex
CREATE INDEX "Delivery_reminderId_idx" ON "Delivery"("reminderId");

-- CreateIndex
CREATE INDEX "Delivery_userId_sentAt_idx" ON "Delivery"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTag" ADD CONSTRAINT "ItemTag_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTag" ADD CONSTRAINT "ItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
