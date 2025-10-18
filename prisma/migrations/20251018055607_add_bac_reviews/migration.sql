-- CreateTable
CREATE TABLE "bac_reviews" (
    "id" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "reviewerId" TEXT NOT NULL,
    "disbursementVoucherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "bac_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bac_reviews_reviewerId_disbursementVoucherId_key" ON "bac_reviews"("reviewerId", "disbursementVoucherId");

-- AddForeignKey
ALTER TABLE "bac_reviews" ADD CONSTRAINT "bac_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bac_reviews" ADD CONSTRAINT "bac_reviews_disbursementVoucherId_fkey" FOREIGN KEY ("disbursementVoucherId") REFERENCES "disbursement_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
