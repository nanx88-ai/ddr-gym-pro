-- Unifica Servizi (AppointmentType), Tariffe (Tariff) e Listino (PriceListItem)
-- in un'unica voce "Servizi". I dati esistenti vengono abbinati per nome
-- uguale (Tariff.title = AppointmentType.name, PriceListItem.name =
-- AppointmentType.name); dove non c'e' corrispondenza viene creato un nuovo
-- servizio "vetrina-only" (non prenotabile) a partire dalla riga orfana, cosi'
-- nessun abbonamento/profilo di fatturazione perde il suo riferimento.

-- 1) Nuove colonne su AppointmentType (vetrina + fatturazione).
ALTER TABLE "AppointmentType"
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "quantity" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 22,
  ADD COLUMN "vatNature" TEXT,
  ADD COLUMN "showInServiceList" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showInTariffs" BOOLEAN NOT NULL DEFAULT true;

-- 2) Copia i dati di Tariff sui servizi esistenti con lo stesso nome.
UPDATE "AppointmentType" a
SET "subtitle" = t."subtitle",
    "quantity" = t."quantity",
    "unitPrice" = t."price",
    "sortOrder" = t."sortOrder",
    "showInTariffs" = t."active"
FROM "Tariff" t
WHERE t."title" = a."name";

-- 3) Copia i dati di PriceListItem sui servizi esistenti con lo stesso nome
--    (il prezzo/IVA di fatturazione ha precedenza su quello di vetrina,
--    perche' e' quello usato realmente per generare le fatture).
UPDATE "AppointmentType" a
SET "description" = p."description",
    "unitPrice" = p."unitPrice",
    "vatRate" = p."vatRate",
    "vatNature" = p."vatNature"
FROM "PriceListItem" p
WHERE p."name" = a."name";

-- 4) Tariffe orfane (nessun servizio con lo stesso titolo): diventano nuovi
--    servizi "solo vetrina" (non prenotabili, non richiedono approvazione),
--    cosi' gli abbonamenti collegati restano validi dopo la migrazione.
INSERT INTO "AppointmentType"
  ("id", "name", "durationMinutes", "capacity", "requiresApproval", "active",
   "subtitle", "quantity", "unitPrice", "sortOrder", "showInServiceList", "showInTariffs", "createdAt")
SELECT
  'svc_' || md5(t."id" || clock_timestamp()::text),
  -- Dedup: se due Tariff orfane hanno lo stesso titolo, o il titolo coincide
  -- con un servizio gia' creato in questo stesso INSERT, distingui col suffisso.
  t."title" || CASE WHEN row_number() OVER (PARTITION BY t."title" ORDER BY t."createdAt") > 1
                     THEN ' (' || row_number() OVER (PARTITION BY t."title" ORDER BY t."createdAt") || ')'
                     ELSE '' END,
  60, 1, false, t."active",
  t."subtitle", t."quantity", t."price", t."sortOrder", false, t."active", t."createdAt"
FROM "Tariff" t
WHERE NOT EXISTS (SELECT 1 FROM "AppointmentType" a WHERE a."name" = t."title");

-- 5) Voci di listino orfane (nessun servizio con lo stesso nome): diventano
--    nuovi servizi "solo fatturazione" (non prenotabili, non in vetrina).
INSERT INTO "AppointmentType"
  ("id", "name", "durationMinutes", "capacity", "requiresApproval", "active",
   "description", "unitPrice", "vatRate", "vatNature", "showInServiceList", "showInTariffs", "createdAt")
SELECT
  'svc_' || md5(p."id" || clock_timestamp()::text),
  p."name" || CASE WHEN row_number() OVER (PARTITION BY p."name" ORDER BY p."createdAt") > 1
                    THEN ' (' || row_number() OVER (PARTITION BY p."name" ORDER BY p."createdAt") || ')'
                    ELSE '' END,
  60, 1, false, p."active",
  p."description", p."unitPrice", p."vatRate", p."vatNature", false, false, p."createdAt"
FROM "PriceListItem" p
WHERE NOT EXISTS (SELECT 1 FROM "AppointmentType" a WHERE a."name" = p."name")
  AND NOT EXISTS (SELECT 1 FROM "Tariff" t WHERE t."title" = p."name");

-- 6) Subscription: aggiungi appointmentTypeId, popolalo via il nome della
--    tariffa collegata, poi elimina la vecchia colonna/FK.
ALTER TABLE "Subscription" ADD COLUMN "appointmentTypeId" TEXT;
UPDATE "Subscription" s
SET "appointmentTypeId" = a."id"
FROM "Tariff" t
JOIN "AppointmentType" a ON a."name" = t."title"
WHERE s."tariffId" = t."id";

ALTER TABLE "Subscription" ALTER COLUMN "appointmentTypeId" SET NOT NULL;
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_tariffId_fkey";
ALTER TABLE "Subscription" DROP COLUMN "tariffId";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_appointmentTypeId_fkey"
  FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7) BillingProfile: stessa cosa via il nome della voce di listino collegata.
ALTER TABLE "BillingProfile" ADD COLUMN "appointmentTypeId" TEXT;
UPDATE "BillingProfile" b
SET "appointmentTypeId" = a."id"
FROM "PriceListItem" p
JOIN "AppointmentType" a ON a."name" = p."name"
WHERE b."priceListItemId" = p."id";

ALTER TABLE "BillingProfile" ALTER COLUMN "appointmentTypeId" SET NOT NULL;
ALTER TABLE "BillingProfile" DROP CONSTRAINT "BillingProfile_priceListItemId_fkey";
ALTER TABLE "BillingProfile" DROP COLUMN "priceListItemId";
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_appointmentTypeId_fkey"
  FOREIGN KEY ("appointmentTypeId") REFERENCES "AppointmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8) Rimuovi i vecchi modelli, ora scollegati.
DROP TABLE "Tariff";
DROP TABLE "PriceListItem";
