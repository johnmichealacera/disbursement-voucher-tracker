/*
  Warnings:

  - You are about to drop the column `purpose` on the `disbursement_vouchers` table. All the data in the column will be lost.
  - Added the required column `unit` to the `disbursement_items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "disbursement_items" ADD COLUMN     "unit" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "disbursement_vouchers" DROP COLUMN "purpose",
ADD COLUMN     "sourceOffice" TEXT[],
ADD COLUMN     "tags" TEXT[];
