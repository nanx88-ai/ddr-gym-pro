# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@WORKFLOW.md

## Istruzioni operative (comunicazione e risparmio crediti)

Tratta ogni conversazione come supporto operativo al lavoro su design, sviluppo front-end, architettura prodotto e strategie digitali.

**Lingua e stile di comunicazione**
- Usa sempre l'italiano nelle risposte, anche se il prompt o il codice sono in inglese.
- Spiegazioni brevi e concise, dritte al punto.
- Design/UX/UI: niente teoria articolata, solo ciò che serve per decidere o iterare (bullet sintetici, esempi brevi).
- Sviluppo/codice: chiaro ma non troppo tecnico, frasi non troppo lunghe, niente gergo superfluo; spiega cosa fai e perché in modo semplice, pochi passi numerati quando serve.
- Preferisci liste chiare a lunghi paragrafi, riduci al minimo i preamboli ("Great question", ecc.).

**Risparmio crediti (comportamento di default)**
- Non avviare strumenti o analisi costose se non esplicitamente richieste: web search, Research, audit estesi, screenshot, anteprime, analisi di performance, benchmark lunghi.
- Non rileggere più volte gli stessi file/cartelle se non richiesto.
- Se serve fare qualcosa di "pesante" (scansione ampia, audit del codice, analisi di un intero progetto, preview grafica, screenshot, report estesi): fermati e chiedi prima il permesso, spiegando in una frase cosa vorresti fare e l'impatto sui crediti.

**Comportamento specifico in Claude Code / Cowork**
- Leggi solo i file e le cartelle direttamente coinvolti nella richiesta, non l'intero repo.
- Descrivi prima in modo breve cosa farai (es. "Leggo questo file e ti propongo una modifica"), poi esegui.
- Non avviare di iniziativa viste, preview, screenshot, audit completi o review di tutta la codebase.
- Se serve un'analisi più ampia (es. leggere l'intero progetto), chiedi sempre prima il permesso in modo esplicito.
- Evita task "a sorpresa": non partire da solo, lascia sempre la possibilità di confermare prima di passi costosi o lunghi.

**Modalità "risparmio crediti"**: su frasi come "usa modalità risparmio crediti", "vai leggero" o "non sprecare crediti":
- riduci al minimo la lunghezza delle risposte;
- non usare strumenti aggiuntivi (web, Research, audit, scansioni) se non strettamente indispensabili;
- concentrati solo sulla soluzione immediata al task, senza esplorazioni extra né approfondimenti non richiesti.

**Preferenze aggiuntive**
- Stack usato spesso: JS/TS, Node, frontend web classico, automazioni e integrazioni AI.
- Più approcci validi → proponi 2-3 opzioni sintetiche con pro/contro, per scegliere velocemente.
- Niente emoji, tono collaborativo, diretto, orientato all'esecuzione.

## What this is

DDR Academy (formerly "Koalendar Palestra") — a gym booking + invoicing app. Next.js 16 (App Router, Turbopack) + Prisma 5 + PostgreSQL (Supabase). Two front-ends in one app:

- **Public booking site** (`src/app/page.tsx`): clients pick a service, date, and slot(s) and book — no login. Supports single and recurring bookings.
- **Admin panel** (`src/app/admin/**`): gym staff manage bookings, clients, schedules, price list, invoices, and stats. Protected by a JWT session cookie.

The `Booking`/`WebhookEvent`/`koalendarBookingId` naming is a holdover from an earlier integration with a third-party scheduler called "Koalendar"; the business logic is now fully custom (see `prisma/schema.prisma` header comment).

## Commands

```bash
npm run dev              # dev server (Turbopack)
npm run build             # prisma generate + next build — always run before considering a change done
npx tsc --noEmit           # type-check only, faster than a full build
npm run lint               # eslint
npx prisma migrate deploy  # apply pending migrations (non-interactive; `prisma migrate dev` doesn't work in this environment — see below)
npx prisma studio           # inspect the DB
npm run db:seed             # seed demo/admin data (creates admin@palestra.local / admin123)
```

No test suite exists in this repo currently — verification is `tsc --noEmit` + `npm run build`, plus manual checks via the dev server/preview when UI is involved.

**Migrations in this environment are non-interactive**, so `prisma migrate dev` will fail with "non-interactive environment". Instead: hand-write the migration SQL under `prisma/migrations/<timestamp>_<name>/migration.sql`, then run `npx prisma migrate deploy` followed by `npx prisma generate`.

## Environment

Requires `.env` (see `.env.example`): `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` (direct, port 5432, for migrations) pointing at Supabase Postgres, `ADMIN_SESSION_SECRET`, optionally `KOALENDAR_WEBHOOK_SECRET` and `CRON_SECRET`. Push notifications need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (same values must also be set on Vercel for prod). See `MIGRAZIONE.md` for full new-machine setup steps.

## Architecture

**Data model** (`prisma/schema.prisma`): `Client` (includes optional `sex`/`dateOfBirth` alongside contact + fiscal fields), `AppointmentType` (a "calendar"/service — its own duration, capacity, approval requirement), `ScheduleBand` (recurring weekly open hours, any number of bands per day of week — no separate "lunch break" concept, just gaps between bands), `ScheduleException` (one-off closures/hours overrides), `SlotOverride` (per-slot capacity/disable), `Booking`, `RescheduleRequest`, `PriceListItem` + `BillingProfile` (per-client billing: `PER_ACCESS` bills one line per attended booking, `FLAT` bills a fixed amount) + `Invoice`/`InvoiceLineItem`/`InvoiceSubmission`, `Integration` (SMTP/OAuth/invoicing provider credentials stored in DB, not env vars), `PushSubscription`, `Reminder`, `Announcement` (single active alert on public booking page), `EmailBroadcast` (log of mass emails sent), `Tariff` (public price list separate from invoice line items), `Subscription` (client abbonamenti with auto-renew support). Status fields (`BookingStatus`, `ClientStatus`, `RescheduleStatus`) are plain strings constrained in app code via `src/lib/constants.ts`, not Postgres enums — kept that way to minimize schema churn.

**Client detail page** (`/admin/clients/[id]`): tabbed view (Anagrafica, Abbonamenti, Prenotazioni, Fatture, Scadenze, Residenza). Anagrafica and Residenza fields are inline-editable (input/select `onBlur`/`onChange` → `PATCH /api/admin/clients/[id]`, same pattern as list-page inline edits elsewhere); the PATCH response only contains scalar fields (Prisma `update()` doesn't return relations), so the client-side merge is `{ ...prev, ...json.client }`, never a wholesale replace, or the relation arrays (subscriptions/bookings/invoices/reminders) get wiped. Field grid uses `sm:grid-cols-4` with per-field `span` (1/2/4) so short fields (CAP, Provincia, Codice SDI) don't stretch as wide as Indirizzo/PEC.

**Business logic lives in `src/lib/`, not in route handlers**:
- `schedule.ts` — computes whether a day is open and its bands (exceptions override weekly bands), generates bookable day slots.
- `booking-rules.ts` — `createCustomBooking()` is the single entry point for creating a booking from both the public site and the admin panel. Public bookings enforce constraints (no past slots, no double-booking same time slot per client, capacity, disabled slots); admin-created bookings pass `bypassConstraints: true` to skip all of that (staff can log a walk-in, overbook, or backdate deliberately). Recurring series pass `skipAdminPush: true` per-occurrence and the caller sends one summary notification instead of one per occurrence.
- `invoicing.ts` + `invoicing-providers/` — invoice number sequencing (`YYYY/NNNN`) and generation from a client's `BillingProfile`; provider-specific submission (Aruba, Fatture in Cloud, manual) is behind a common interface in `invoicing-providers/types.ts`.
- `timezone.ts` — **always** go through this for date/time math involving the gym's wall-clock time. The server runs in UTC (Vercel); constructing dates with `new Date(y,m,d,h,m)` or `setHours` uses the *process* timezone, silently shifting every slot by 1-2h (CET/CEST) from what was configured. `romeWallTimeToInstant`, `dateIsoInRome`, `startOfDayInRome` etc. fix this by going through `Europe/Rome` explicitly via `date-fns-tz`.
- `recurrence.ts` — shared weekly-recurrence expansion (`expandWeeklyOccurrences`, `MAX_OCCURRENCES = 52`) used by both the public booking flow and the admin "Nuovo appuntamento" page.
- `client-token.ts` — opaque per-device "remember me" cookie for the public booking form (no accounts/passwords): a random token tied to a `Client` row prefills contact fields on return visits; server clears the cookie if the token no longer resolves.
- `mailer.ts` — SMTP integration: `sendPlainEmail()` for single recipient (reminders, confirmations), `sendHtmlBroadcast()` for mass emails via Comunicazioni admin page. Graceful no-op if SMTP not configured. Credentials pulled from `Integration` table.

**Auth**: `src/middleware.ts` gates `/admin/*` and `/api/admin/*` by verifying a JWT in the `koalendar_admin_session` cookie (via `jose`, secret = `ADMIN_SESSION_SECRET`). No further per-route auth checks are needed inside `/api/admin/**` handlers — the middleware already rejects unauthenticated requests before they arrive.

**Notifications**: `src/app/api/admin/notifications/route.ts` aggregates everything needing admin attention (pending approvals, reschedule requests, new auto-confirmed bookings, cancellations, upcoming reminders) into `actionable` (disappear once resolved) vs `informational` (dismissible client-side via localStorage, auto-expire after a few days) — consumed by `NotificationBell.tsx`. Recurring-series items are collapsed into one grouped entry (`pending_approval_series`/`new_booking_series`) rather than one row per occurrence. Native web push (`src/lib/push.ts`, VAPID) fires alongside for admin devices that opted in; push calls must be `await`ed, not fire-and-forget — Vercel can freeze the serverless function right after the response is sent, silently killing pending promises.

**Communications** (`/admin/communications`): two subsystems live in the same page:
- **Bacheca (Announcements)**: admin creates/publishes text alerts shown as a banner on the public booking page. Max 1 active at a time; publishing a new one deactivates all others.
- **Email Broadcast**: admin writes HTML-formatted messages (rich text editor: bold, italic, underline, bullet lists) and sends to audience: all clients, active only, or manual selection. Each recipient gets their own copy (no CC/BCC). History logged per send with counts of success/fail.

**Tariffs** (`/admin/tariffs`): public-facing price list (separate from `PriceListItem` which is invoice line items). Each tariff has title, optional subtitle, optional quantity text (e.g. "10 visits", "3 months"), and price. Admin can pause/unpause or delete. Public site shows active tariffs via "Guarda le tariffe" card that opens a sheet/modal. API: `/api/tariffs` (public GET), `/api/admin/tariffs/*` (CRUD).

**Subscriptions** (`/admin/subscriptions`): clients subscribe to tariffs with a start/end date. Admin can enable auto-renewal (extends end date by N months when it hits, repeats until manually disabled). Cron reminder fires at `endDate - notifyDaysBefore` (default 7 days): emails to admin + client, push to admin, then marks `notifiedForEnd` so reminder only sends once per end-date cycle. Auto-renewal happens at cron via `addMonths()` looping until `endDate > today`; `notifiedForEnd` resets so next cycle's reminder fires again. API: `/api/admin/subscriptions/*` (CRUD).

**Admin UI conventions** (`src/lib/ui.ts`, `src/components/IconAction.tsx`): squared design, zero border-radius anywhere (only real exceptions are literal status-dot circles). Shared Tailwind class constants (`btnPrimary`, `input`, `card`, `td`/`th`, `toggleActive`, `toggleInactive`, etc.) instead of ad-hoc classes. Row/table actions use icon buttons (`IconButton`/`IconLink`) with native `title` tooltips on desktop and long-press tooltips on mobile — never bare text buttons — and when a row has more than 2-3 possible actions they go into the `ActionsMenu` kebab dropdown, not a row of loose icons. `MenuAction` supports `disabled` (item stays visible but greyed out/non-clickable — e.g. "Segna come presente" disabled when a booking is already marked present) as distinct from `hidden` (not rendered at all). All interactive controls target 44px (`h-11 w-11` / `min-h-11`) for touch, including custom controls placed next to `IconButton`/`ActionsMenu` — a `SegmentedToggle`-based control with `py-*` padding instead of a fixed `h-11` will visibly mismatch height against the kebab menu beside it. Table `<td>` cells holding numbers/badges/actions get `whitespace-nowrap` explicitly; only the name/text column is left unconstrained. `EditBookingModal.tsx` is the shared date/time-move modal used from both the Prenotazioni and Agenda admin pages. No native browser dialogs (`window.confirm`/`alert`) — always `useConfirm()` from `ConfirmDialog.tsx`. Any admin page with a "go back to parent list" action uses a top-right `btnPrimary` link reading "← Indietro" (not a plain text link, not top-left) — same component/position everywhere (client detail, invoice detail, etc).
  - **Reusable components**: `StatusDot` (colored status indicator + tooltip), `Checkbox` (custom bordered square, yellow checkmark), `SortableTh` (clickable column header with ▲/▼/↕ indicator), `SortDirToggle` (3-state mobile direction toggle: off/A→Z/Z→A with flip animation), `SegmentedToggle` (generic N-option selector), `RichTextEditor` (contentEditable-based HTML: grassetto, corsivo, sottolineato, elenchi), `AttendanceToggle` (single 44×44 button — not two side-by-side toggles — that cycles Da segnare → Presente → Assente → Da segnare on tap; the same three states are also reachable individually from the row's `ActionsMenu` for users who prefer picking directly over cycling).
  - **Mobile nav**: `MobileNavSheet.tsx` is a 3-level draggable bottom sheet (closed / ridotto / full), a single card (handle + grid + settings/logout bar) mounted once and never remounted across levels — only `translateY` changes, so a drag gesture starting from *any* level moves the same DOM node from the first pixel (no pointer-capture loss). The card is positioned `bottom-0` (flush to the true viewport edge); the safe-area inset is the card's own last child (internal padding), **not** an external `bottom: env(safe-area-inset-bottom)` offset — the latter creates a geometric gap where content just past the "visible slice" ends up rendered inside the gap instead of off-screen (the grid's first row peeking through under the closed handle). Tap always advances one level up (closed→ridotto→esteso→ridotto); it never closes on tap — only the overlay or an downward drag past threshold closes it.

**Typography**: Clash Display (headings, `h1`/`h2`/`h3`/`.font-display`) + Satoshi (body, default `--font-sans`), both self-hosted as woff2 under `public/fonts/` and wired via `@font-face` in `globals.css` (not `next/font/google`, not a Fontshare CDN `<link>` — self-hosted keeps the site independent of a third-party CDN at runtime). Applies across both the public site and the admin panel; to swap either family, replace the files in `public/fonts/` and update the `@font-face` `src` paths — no component changes needed since the mapping is CSS-variable-driven.

**Mobile-first constraints worth knowing**: `src/app/admin/layout.tsx` wraps page content in `max-w-[1600px] mx-auto`; individual admin pages should generally *not* re-cap width further unless the content is a small standalone form (then wrap in `mx-auto max-w-md`-style). Without the `whitespace-nowrap` convention above, `table-layout: auto` stretches every column evenly across the wide container instead of letting the text column absorb the row.

## Cron & Background Jobs

**`/api/cron/reminders`** (daily at 08:00 Rome time via Vercel): 
1. **Reminder scadenze**: checks `Reminder` records (client deadlines, certificates, etc) for those hitting their `dueDate - notifyDaysBefore` threshold; sends email to all admins + client, marks `notifiedAt` so only fires once.
2. **Subscription lifecycle**: 
   - **Auto-renew rollover**: for each `Subscription` with `autoRenew=true` and `endDate < today`, advances `endDate` by `renewMonths` months (loops if multiple months behind, e.g. during downtime).
   - **Subscription reminders**: for each sub hitting `endDate - notifyDaysBefore`, emails admin + client (different text for auto-renew vs non-renewing), sends push to admin with `/admin/subscriptions` link, marks `notifiedForEnd` so only fires once per end-date cycle. When `endDate` changes, `notifiedForEnd` resets automatically so the next cycle's reminder fires again.

Calls to `sendPlainEmail()` and `sendAdminPush()` are critical paths — always `await` and error-log; cron itself doesn't crash on individual email failures (logs and continues).

## Deployment

Vercel project `nx8/ddr-gym-pro`, deploys from `master` on push. `vercel.json` defines cron timing (`/api/cron/reminders` at 08:00 daily). No CI test gate — `npx tsc --noEmit` and `npm run build` are the pre-push checks.
