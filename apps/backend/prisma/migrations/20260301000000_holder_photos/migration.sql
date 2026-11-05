-- AlterTable
ALTER TABLE "tickets" ADD COLUMN "holderPhotoId" UUID;

-- CreateTable
CREATE TABLE "order_photos" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "slot" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_photos_storageKey_key" ON "order_photos"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_photos_orderId_slot_key" ON "order_photos"("orderId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "order_photos_orderId_sha256_key" ON "order_photos"("orderId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_holderPhotoId_key" ON "tickets"("holderPhotoId");

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_holderPhotoId_fkey" FOREIGN KEY ("holderPhotoId") REFERENCES "order_photos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity constraints (not expressible in Prisma schema)
ALTER TABLE "order_photos"
  ADD CONSTRAINT "order_photos_slot_positive" CHECK ("slot" >= 1),
  ADD CONSTRAINT "order_photos_size_positive" CHECK ("sizeBytes" > 0);
