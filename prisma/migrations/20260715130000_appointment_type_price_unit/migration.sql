-- Distingue esplicitamente se il prezzo di un servizio e' a seduta (default,
-- storicamente implicito) o per l'intero pacchetto (usa il campo "quantity"
-- gia' esistente, es. "10 ingressi").
ALTER TABLE "AppointmentType"
  ADD COLUMN "priceUnit" TEXT NOT NULL DEFAULT 'PER_SESSION';

-- Le righe migrate dal vecchio "Tariffario" avevano gia' una quantita'
-- testuale: se compilata, il prezzo era pensato per l'intero pacchetto.
UPDATE "AppointmentType" SET "priceUnit" = 'PACKAGE' WHERE "quantity" IS NOT NULL AND "quantity" <> '';
