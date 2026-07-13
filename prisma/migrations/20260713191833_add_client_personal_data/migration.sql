-- AddColumn: sex e dateOfBirth a Client
ALTER TABLE "Client" ADD COLUMN "sex" TEXT;
ALTER TABLE "Client" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
