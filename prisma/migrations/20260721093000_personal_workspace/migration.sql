-- Personal workspace data is introduced without claiming existing dashboards.
-- Run the explicit legacy-owner script before enforcing a NOT NULL ownerId in a later release.
ALTER TABLE "UserRecord"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "DashboardRecord" ADD COLUMN "ownerId" TEXT;

CREATE TABLE "SessionRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPreference" (
  "userId" TEXT NOT NULL,
  "themeMode" TEXT NOT NULL DEFAULT 'system',
  "locale" TEXT NOT NULL DEFAULT 'zh-CN',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "dashboardListView" TEXT NOT NULL DEFAULT 'grid',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "SessionRecord_tokenHash_key" ON "SessionRecord"("tokenHash");
CREATE INDEX "SessionRecord_userId_expiresAt_idx" ON "SessionRecord"("userId", "expiresAt");
CREATE INDEX "DashboardRecord_ownerId_updatedAt_idx" ON "DashboardRecord"("ownerId", "updatedAt");

ALTER TABLE "DashboardRecord"
  ADD CONSTRAINT "DashboardRecord_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "UserRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SessionRecord"
  ADD CONSTRAINT "SessionRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
