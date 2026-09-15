# Fikat Proforma

Proforma, stock optimization and inventory management system for granite & ceramic businesses.

This repo has two apps:

```
fikat-proforma/
├── backend/     Express + TypeScript + Prisma + PostgreSQL API
├── frontend/    React + TypeScript + Vite + Tailwind app
└── docker-compose.yml   Local Postgres for development
```

## What's implemented in this scaffold

This is a real, runnable Phase 1–2 build (see `docs` notes inline in each service):

- Full relational schema (Prisma) for users, customers, materials, granite product
  types, stock sizes, stock items, stock transactions, proformas, proforma items,
  prices, settings, audit log.
- JWT auth with role-based guards (ADMIN / MANAGER / SALES / STOREKEEPER).
- Stock service with transaction-based quantity changes (every change is logged,
  never a bare `quantity = x` write).
- Stock optimizer: given a customer length/width/quantity requirement and a list
  of available stock sizes, finds a combination of stock pieces that covers the
  requirement, minimizing waste — this is the "2.00 + 2.20 = 4.20 covers 4.05"
  logic from the spec, not a single-piece-fit check.
- Proforma calculator: billable area = customer length × width, unit price =
  billable area × **fixed price per m² typed on that row** (falls back to the
  material's configured price if left blank), total = qty × unit price, VAT
  15% (configurable in `settings`) — all computed server-side so the frontend
  never invents totals.
- Proforma lifecycle: `DRAFT → REVIEW → FINALIZED / CANCELLED`. Adding a row
  never finalizes anything — only an explicit "Finalize proforma" action does,
  and only a finalized proforma allocates stock transactions.
- **Reopen for editing**: a finalized proforma can be sent back to DRAFT
  (`POST /proformas/:id/reopen`, ADMIN/MANAGER only) — this releases the
  stock it had allocated back to inventory and lets you add/remove rows
  again. Re-finalizing reuses the same proforma number.
- **PDF download/print**: `GET /proformas/:id/pdf` streams a printable PDF
  (pdfkit) with the item table and totals; the frontend's "Download / print
  PDF" button works on drafts too, so you can preview before finalizing, and
  printing is just the browser's PDF viewer print dialog.
- Dashboard endpoint that returns the granite (material → product type → size)
  and ceramic (material → size) hierarchies with quantities and low/out-of-stock
  status.
- Frontend: login, dashboard (expandable stock hierarchy, in/low/out-of-stock
  badges), New Proforma (Excel-style multi-row entry that stays editable until
  you click "Finalize proforma", with PDF download and reopen-to-edit),
  proforma list, customers, materials admin.

## What's still a stub / needs your input before production

- `docker-compose.yml` gives you local Postgres; you still need to run migrations.
- No automated tests yet (see "Next steps" below) — the acceptance checklist
  from the spec is in `docs/ACCEPTANCE-CRITERIA.md`.
- Stock reservation (`RESERVED` state) is modeled in the schema but not yet
  wired into controllers — flagged with `// TODO`. Reporting endpoints beyond
  the dashboard aren't built either.
- No CI/CD, backup automation, or production deployment config yet.

## Getting started

### 1. Database

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (db `fikat`, user/pass `fikat`/`fikat`).

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed   # optional: creates an admin user + sample materials
npm run dev
```

API runs on `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173` and talks to the API via `VITE_API_URL`
(defaults to `http://localhost:4000`, see `frontend/.env.example`).

### Default login (after seeding)

```
email: admin@fikat.local
password: admin1234
```

The seed script (`backend/prisma/seed.ts`) now creates the full catalog you
described:

- **Granite** materials: 603, 602, 651, 654, G-640, Galaxy, Juprana, Marquino —
  each with product types Thread & Riser, Window Sill, Doorsill, Landing,
  Kitchen Top, and the size ranges you gave (e.g. Thread & Riser 120×34 through
  220×34 in 5 cm steps; Window Sill/Doorsill at widths 20/25/28/30; Landing
  40×40 and 60×60; Kitchen Top 220×63, 240×63, 260×70).
- **Ceramic** materials: Satin Grey, GLM Polished White, Mosaic White, each
  with their own sizes.

Seed quantities and prices are placeholders — edit them from the Stock
dashboard and Materials page once you know real counts, or add more materials
the same way (`POST /materials`, `/materials/:id/product-types`,
`/materials/:id/stock-sizes`, `/materials/prices` — see `docs/API.md`).

## Next steps (recommended order)

1. Review the seeded catalog against your real stock counts and adjust
   quantities/prices from the app (or re-run `npx prisma db seed` after
   editing `backend/prisma/seed.ts`).
2. Wire up stock reservation on `DRAFT`/`REVIEW` proformas if you want to prevent
   two sales reps promising the same stock.
3. Add the reporting endpoints listed in `docs/API.md` (stock movement, waste,
   sales) and a branded PDF layout if you want your logo/letterhead on it.
4. Add tests (`backend/src` has clean service/controller separation specifically
   so `services/*` can be unit tested without spinning up HTTP).
5. Set up CI, backups, and a production environment.
