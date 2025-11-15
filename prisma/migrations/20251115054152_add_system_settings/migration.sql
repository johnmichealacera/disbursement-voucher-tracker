-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- Insert default BAC approval count setting
INSERT INTO "system_settings" ("id", "key", "value", "description", "createdAt", "updatedAt")
VALUES ('bac-approval-count', 'bac_required_approvals', '3', 'Number of BAC member approvals required for GSO vouchers', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
