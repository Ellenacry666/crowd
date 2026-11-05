-- CreateEnum
CREATE TYPE "CameraType" AS ENUM ('GATE', 'CROWD');

-- CreateTable
CREATE TABLE "cameras" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" "CameraType" NOT NULL,
    "name" TEXT NOT NULL,
    "streamUrl" TEXT,
    "capacity" INTEGER,
    "apiKeyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crowd_snapshots" (
    "id" UUID NOT NULL,
    "cameraId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "peopleCount" INTEGER NOT NULL DEFAULT 0,
    "inCount" INTEGER NOT NULL DEFAULT 0,
    "outCount" INTEGER NOT NULL DEFAULT 0,
    "density" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crowd_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineups" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "artistName" TEXT NOT NULL,
    "isGuestStar" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lineups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cameras_apiKeyHash_key" ON "cameras"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_eventId_type_key" ON "cameras"("eventId", "type");

-- CreateIndex
CREATE INDEX "crowd_snapshots_cameraId_capturedAt_idx" ON "crowd_snapshots"("cameraId", "capturedAt");

-- CreateIndex
CREATE INDEX "crowd_snapshots_eventId_capturedAt_idx" ON "crowd_snapshots"("eventId", "capturedAt");

-- CreateIndex
CREATE INDEX "lineups_eventId_startAt_idx" ON "lineups"("eventId", "startAt");

-- AddForeignKey
ALTER TABLE "cameras" ADD CONSTRAINT "cameras_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowd_snapshots" ADD CONSTRAINT "crowd_snapshots_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "cameras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crowd_snapshots" ADD CONSTRAINT "crowd_snapshots_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity constraints (not expressible in Prisma schema)
ALTER TABLE "cameras"
  ADD CONSTRAINT "cameras_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "crowd_snapshots"
  ADD CONSTRAINT "crowd_snapshots_counts_nonneg" CHECK ("peopleCount" >= 0 AND "inCount" >= 0 AND "outCount" >= 0);
ALTER TABLE "lineups"
  ADD CONSTRAINT "lineups_time_range" CHECK ("endAt" > "startAt");
