-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 7,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
