# Migrazione su nuovo PC/account + Supabase

Questo progetto è stato migrato da SQLite locale a PostgreSQL (Supabase).
Nessun dato va importato manualmente: le tabelle si ricreano da zero con Prisma.

## Prerequisiti sul nuovo PC

- Node.js 20+ e npm
- Git
- Account Supabase con un progetto già creato
- Repo GitHub del progetto già collegato

## Passaggi (da fare tu, sul nuovo PC)

1. Clona il repo:
   ```
   git clone <url-repo-github>
   cd app
   ```

2. Copia `.env.example` in `.env`:
   ```
   cp .env.example .env
   ```

3. Apri Supabase → progetto → **Settings → Database → Connection string**.
   Compila in `.env`:
   - `DATABASE_URL`: connection string **Transaction pooler** (porta 6543, con `?pgbouncer=true`)
   - `DIRECT_URL`: connection string diretta (porta 5432, senza pgbouncer) — serve solo a Prisma per le migration
   - `ADMIN_SESSION_SECRET`: genera un valore casuale nuovo (es. `openssl rand -hex 32`), non riusare quello vecchio

4. Installa le dipendenze:
   ```
   npm install
   ```

5. Crea le tabelle su Supabase (prima volta, da zero):
   ```
   npx prisma migrate dev --name init
   ```

6. (Opzionale) Popola dati demo/admin iniziali:
   ```
   npx prisma db seed
   ```
   Crea l'utente admin `admin@palestra.local` / `admin123` — **da cambiare** dopo il primo login.

7. Avvia in locale per verificare:
   ```
   npm run dev
   ```

## Cosa dire a Claude Code sul nuovo PC (prima richiesta)

Incolla questo messaggio come primo prompt:

> Questo è il progetto Koalendar (gestionale prenotazioni + fatturazione per una palestra),
> Next.js 16 + Prisma + PostgreSQL su Supabase. Il DB è già collegato (vedi `.env`).
> Leggi `prisma/schema.prisma` per il data model e `src/lib/` per le regole di business
> (schedule.ts = generazione slot, booking-rules.ts = regole prenotazione,
> invoicing.ts = fatturazione). L'ambiente è già pronto (`npm install` fatto,
> `prisma migrate dev` già eseguito). Verifica che tutto funzioni con `npx tsc --noEmit`
> e avviando il dev server.

Questo basta a un nuovo Claude Code per orientarsi senza bisogno della cronologia
di questa conversazione: lo schema e i commenti nel codice sono già la documentazione.

## Dopo la verifica, sul PC vecchio

Solo dopo aver confermato che tutto funziona sul nuovo PC contro Supabase,
puoi cancellare la cartella locale `koa/app` da questo PC in sicurezza:
i dati veri ora vivono su Supabase, non più nel file `prisma/dev.db` locale.
