# Meridian Ops Console (`platform/web`)

The bank's internal **dispute-ops web UI** — the platform P0 surface that the
cohort logs into and explores. A Next.js 14 (App Router, TypeScript) app that
reads the Meridian Postgres database directly via the `pg` driver.

This is the "go explore the bank" moment from the platform design doc: an
analyst's dispute queue full of red Reg E countdown timers, evidence scattered
across systems, duplicate tickets, provisional-credit errors.

## Pages

| Route | What it shows |
|---|---|
| `/login` | Email-only sign-in. Looks up the analyst in `meridian.analysts`, stores `analyst_id` + `scope` in an httpOnly cookie. Lists 3 sample seeded logins. |
| `/` | **Dispute queue** (the hero). The `dispute_queue` view, ordered by `hours_to_deadline` ASC. RED/AMBER/GREEN Reg E countdown per row, BREACHED badge, merchant risk badges, summary stats (open / breached / % breached). Scoped to the analyst's dispute type. |
| `/disputes/[id]` | Dispute detail: transaction, customer, evidence rows, linked tickets, provisional-credit info. **Surfaces `provisional_credit_error` prominently.** |
| `/transactions` | Searchable, paginated transaction explorer. Filter by `account_id`. Always `LIMIT`ed; filters hit indexed columns — fast against millions of rows. |
| `/customers/[id]` | Customer 360: profile, accounts, recent transactions, disputes. |

## Prerequisites

- Node.js 18.18+ (tested on Node 20/25) and npm
- The Meridian Postgres running with the `meridian` schema + demo data

## 1. Start the database (from `platform/db`)

```bash
cd ../db
docker compose up -d        # Postgres 16 on localhost:5432
./load.sh                   # schema + deterministic demo seed
```

`./load.sh` regenerates the seed via `uv` and loads it. If you already have the
CSVs in `platform/db/seed/data/` and don't want to regenerate, you can load them
directly (explicit column lists handle defaulted columns):

```bash
cd ../db
docker compose exec -T meridian-db psql -U meridian -d meridian -v ON_ERROR_STOP=1 < schema.sql
for t in customers accounts merchants transactions analysts disputes dispute_evidence tickets policy_chunks; do
  cols=$(head -1 "seed/data/$t.csv")
  docker compose exec -T meridian-db psql -U meridian -d meridian \
    -c "\copy meridian.$t ($cols) FROM STDIN WITH (FORMAT csv, HEADER true)" < "seed/data/$t.csv"
done
```

## 2. Configure & run the web app (from `platform/web`)

```bash
cp .env.example .env          # default points at the local Docker Postgres
npm install
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000 → you'll be redirected to `/login`. Sign in with any
seeded analyst email — the login page lists three samples, e.g.:

- `analyst1@meridianbank.test` (scope **Type A** — card fraud / unauthorized)
- `analyst2@meridianbank.test` (scope **Type B** — merchant / quality)

No password is required for this sandbox (P0). The cookie just identifies which
seeded analyst you are; Type A / Type B analysts see only their dispute type.

## Production build

```bash
npm run build
npm run start                 # serves on http://localhost:3000
```

All data pages render at **request time** (`export const dynamic = "force-dynamic"`),
so `npm run build` never touches the database — the build is green even if
Postgres is down.

## Environment

| Var | Default | Notes |
|---|---|---|
| `MERIDIAN_DB_URL` | `postgresql://meridian:meridian@localhost:5432/meridian` | Postgres connection string. For hosted Supabase, use the **session pooler** connection string. |

## Deploy (Vercel + Supabase)

Point `MERIDIAN_DB_URL` at the Supabase Postgres **pooler** connection string and
deploy to Vercel. The same code serves the local Docker DB and hosted Supabase —
only the env var changes.

## Security / correctness notes

- **Poisoned policy chunk never reaches the UI.** No page queries
  `meridian.policy_chunks`, so the injection payload in the one poisoned chunk
  cannot leak to screen.
- **All queries are parameterized** (`$1`, `$2`, …) — no string interpolation of
  user input. Path params (`[id]`) are additionally validated as numeric.
- **Every query is `LIMIT`ed** and filters/sorts hit indexed columns
  (`account_id`, `txn_ts`, `reg_e_due_at`, `dispute_type`, `status`), so the app
  stays fast against the millions-of-rows `transactions` table.
- **Scope enforcement** mirrors the W16 RLS lesson at the query layer:
  `type_a` / `type_b` analysts only see their dispute type in the queue.

## Layout

```
platform/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # root layout
│   │   ├── globals.css                # Tailwind
│   │   ├── login/                     # /login (page, client form, server action)
│   │   ├── page.tsx                   # / dispute queue (hero)
│   │   ├── disputes/[id]/page.tsx     # dispute detail
│   │   ├── transactions/page.tsx      # transaction explorer
│   │   ├── customers/[id]/page.tsx    # customer 360
│   │   └── api/logout/route.ts        # POST sign-out
│   ├── components/                    # Header, AppShell, badges
│   └── lib/                           # db pool, queries, session, auth, format
├── .env.example
├── tailwind.config.ts
├── next.config.mjs
└── package.json
```
