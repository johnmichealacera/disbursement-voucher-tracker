-- Add releaseRecipient column to store the name of the person who received the released funds
ALTER TABLE "disbursement_vouchers"
ADD COLUMN "releaseRecipient" TEXT;

