-- Classificazione servizio: ingresso singolo vs venduto ad abbonamento.
ALTER TABLE "AppointmentType"
  ADD COLUMN "bookingKind" TEXT NOT NULL DEFAULT 'ONE_TIME';

-- Collega le prenotazioni generate da un abbonamento all'abbonamento stesso,
-- per poterle ritrovare/tracciare insieme.
ALTER TABLE "Booking" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
