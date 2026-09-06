-- Initial schema only: apply atomically; no legacy content is imported here.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('READER', 'AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('READING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'READER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "freesoundAccessTokenCiphertext" TEXT,
    "freesoundRefreshTokenCiphertext" TEXT,
    "freesoundTokenExpiresAt" TIMESTAMP(3),
    "freesoundUsername" TEXT,
    "freesoundImportQuotaLimit" INTEGER NOT NULL DEFAULT 0,
    "freesoundImportQuotaUsed" INTEGER NOT NULL DEFAULT 0,
    "freesoundQuotaResetAt" TIMESTAMP(3),
    "aiBackgroundQuotaLimit" INTEGER NOT NULL DEFAULT 0,
    "aiBackgroundQuotaUsed" INTEGER NOT NULL DEFAULT 0,
    "aiBackgroundQuotaResetAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT,
    "genre" TEXT[],
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "authorId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryBlock" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "moodTag" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "StoryBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Effect" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "intensity" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "delayMs" INTEGER,
    "audioSrc" TEXT,
    "audioAssetId" TEXT,
    "loop" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Effect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "status" "ReadingStatus" NOT NULL DEFAULT 'READING',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "effectsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "effectsByCategory" JSONB NOT NULL DEFAULT '{"visual":true,"audio":true,"motion":true,"transition":true}',
    "intensityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "fontSize" TEXT NOT NULL DEFAULT 'md',
    "fontFamily" TEXT NOT NULL DEFAULT 'cormorant',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EffectDefinition" (
    "effectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EffectDefinition_pkey" PRIMARY KEY ("effectId")
);

-- CreateTable
CREATE TABLE "EffectKeywordSuggestion" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "EffectKeywordSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundAsset" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "render" JSONB NOT NULL,
    "moodTags" TEXT[],
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL DEFAULT 'global',
    "source" TEXT NOT NULL DEFAULT 'admin_upload',
    "generationPrompt" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorPalette" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "secondary" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "backgroundTintColor" TEXT NOT NULL,
    "backgroundTintOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "moodTags" TEXT[],
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ColorPalette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenePreset" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "moodTags" TEXT[],
    "status" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "renderConfig" JSONB NOT NULL,
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "sourceChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenePreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "startBlockId" TEXT NOT NULL,
    "endBlockId" TEXT NOT NULL,
    "basedOnPresetId" TEXT,
    "renderConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "freesoundId" TEXT,
    "license" TEXT,
    "attributionAuthorName" TEXT,
    "attributionSourceUrl" TEXT,
    "attributionLicenseName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBackgroundGenerationSession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalPrompt" TEXT NOT NULL,
    "seedA" INTEGER NOT NULL,
    "seedB" INTEGER NOT NULL,
    "hashA" TEXT,
    "hashB" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "AiBackgroundGenerationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_status_createdAt_id_idx" ON "Story"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Story_authorId_updatedAt_id_idx" ON "Story"("authorId", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Story_status_submittedAt_id_idx" ON "Story"("status", "submittedAt", "id");

-- CreateIndex
CREATE INDEX "Story_reviewedById_idx" ON "Story"("reviewedById");

-- CreateIndex
CREATE INDEX "Chapter_storyId_order_idx" ON "Chapter"("storyId", "order");

-- CreateIndex
CREATE INDEX "Chapter_storyId_status_order_idx" ON "Chapter"("storyId", "status", "order");

-- CreateIndex
CREATE INDEX "StoryBlock_chapterId_order_idx" ON "StoryBlock"("chapterId", "order");

-- CreateIndex
CREATE INDEX "Effect_audioAssetId_idx" ON "Effect"("audioAssetId");

-- CreateIndex
CREATE INDEX "Effect_blockId_idx" ON "Effect"("blockId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_id_idx" ON "Bookmark"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Bookmark_storyId_idx" ON "Bookmark"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_storyId_key" ON "Bookmark"("userId", "storyId");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_status_updatedAt_id_idx" ON "ReadingProgress"("userId", "status", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "ReadingProgress_storyId_idx" ON "ReadingProgress"("storyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_storyId_key" ON "ReadingProgress"("userId", "storyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "EffectDefinition_isActive_effectId_idx" ON "EffectDefinition"("isActive", "effectId");

-- CreateIndex
CREATE INDEX "EffectKeywordSuggestion_normalizedKeyword_idx" ON "EffectKeywordSuggestion"("normalizedKeyword");

-- CreateIndex
CREATE UNIQUE INDEX "EffectKeywordSuggestion_effectId_normalizedKeyword_key" ON "EffectKeywordSuggestion"("effectId", "normalizedKeyword");

-- CreateIndex
CREATE INDEX "BackgroundAsset_scope_status_idx" ON "BackgroundAsset"("scope", "status");

-- CreateIndex
CREATE INDEX "BackgroundAsset_ownerId_status_idx" ON "BackgroundAsset"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ColorPalette_status_idx" ON "ColorPalette"("status");

-- CreateIndex
CREATE INDEX "ScenePreset_status_idx" ON "ScenePreset"("status");

-- CreateIndex
CREATE INDEX "Scene_chapterId_idx" ON "Scene"("chapterId");

-- CreateIndex
CREATE INDEX "Scene_basedOnPresetId_idx" ON "Scene"("basedOnPresetId");

-- CreateIndex
CREATE INDEX "AudioAsset_ownerId_createdAt_idx" ON "AudioAsset"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_ownerId_freesoundId_key" ON "AudioAsset"("ownerId", "freesoundId");

-- CreateIndex
CREATE INDEX "AiBackgroundGenerationSession_ownerId_status_idx" ON "AiBackgroundGenerationSession"("ownerId", "status");

-- CreateIndex
CREATE INDEX "AiBackgroundGenerationSession_expiresAt_idx" ON "AiBackgroundGenerationSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBlock" ADD CONSTRAINT "StoryBlock_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "StoryBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Effect" ADD CONSTRAINT "Effect_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EffectKeywordSuggestion" ADD CONSTRAINT "EffectKeywordSuggestion_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "EffectDefinition"("effectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackgroundAsset" ADD CONSTRAINT "BackgroundAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_basedOnPresetId_fkey" FOREIGN KEY ("basedOnPresetId") REFERENCES "ScenePreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudioAsset" ADD CONSTRAINT "AudioAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiBackgroundGenerationSession" ADD CONSTRAINT "AiBackgroundGenerationSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
