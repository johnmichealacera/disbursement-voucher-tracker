-- CreateEnum
CREATE TYPE "PayeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CanvasItemType" AS ENUM ('VOUCHER', 'ITEM', 'NOTE', 'ATTACHMENT');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SECRETARY';

-- CreateTable
CREATE TABLE "payee_directory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "PayeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payee_directory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_items" (
    "id" TEXT NOT NULL,
    "type" "CanvasItemType" NOT NULL,
    "content" TEXT NOT NULL,
    "position" JSONB,
    "size" JSONB,
    "metadata" JSONB,
    "userId" TEXT,
    "disbursementVoucherId" TEXT,
    "disbursementItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payee_directory_name_address_key" ON "payee_directory"("name", "address");

-- AddForeignKey
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_disbursementVoucherId_fkey" FOREIGN KEY ("disbursementVoucherId") REFERENCES "disbursement_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_disbursementItemId_fkey" FOREIGN KEY ("disbursementItemId") REFERENCES "disbursement_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
