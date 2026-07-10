-- CreateTable
CREATE TABLE "ScheduleBand" (
    "id" TEXT NOT NULL,
    "appointmentTypeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBand_appointmentTypeId_dayOfWeek_idx" ON "ScheduleBand"("appointmentTypeId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "ScheduleBand" ADD CONSTRAINT "ScheduleBand_appointmentTypeId_fkey" FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migra i dati esistenti: ogni giorno aperto diventa una singola fascia
-- open-close (la pausa pranzo non viene portata avanti, il nuovo modello
-- non la prevede piu' come concetto a parte - l'admin puo' ricreare due
-- fasce separate se vuole lo stesso effetto).
INSERT INTO "ScheduleBand" ("id", "appointmentTypeId", "dayOfWeek", "startTime", "endTime", "createdAt")
SELECT gen_random_uuid()::text, "appointmentTypeId", "dayOfWeek", "openTime", "closeTime", CURRENT_TIMESTAMP
FROM "WeeklySchedule"
WHERE "isOpen" = true;

-- DropForeignKey
ALTER TABLE "WeeklySchedule" DROP CONSTRAINT "WeeklySchedule_appointmentTypeId_fkey";

-- DropTable
DROP TABLE "WeeklySchedule";

-- AlterTable
ALTER TABLE "ScheduleException" DROP COLUMN "breakEnd",
DROP COLUMN "breakStart";
