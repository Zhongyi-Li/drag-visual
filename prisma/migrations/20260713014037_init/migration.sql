-- CreateTable
CREATE TABLE "DashboardRecord" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "draftSchema" JSONB NOT NULL,
    "publishedSchema" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardRecord_pkey" PRIMARY KEY ("id")
);
