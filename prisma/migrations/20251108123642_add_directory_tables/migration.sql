-- CreateTable
CREATE TABLE "tag_directory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PayeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_directory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_directory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "defaultUnitPrice" DECIMAL(12,2),
    "status" "PayeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_directory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tag_directory_name_key" ON "tag_directory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "item_directory_name_unit_key" ON "item_directory"("name", "unit");
