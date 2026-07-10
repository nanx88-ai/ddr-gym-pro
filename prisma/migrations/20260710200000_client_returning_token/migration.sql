-- AlterTable
ALTER TABLE "Client" ADD COLUMN "returningToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_returningToken_key" ON "Client"("returningToken");
