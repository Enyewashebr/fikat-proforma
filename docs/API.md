# API reference

Base URL: `http://localhost:4000/api`. All routes except `POST /auth/login`
require `Authorization: Bearer <token>`.

## Auth
- `POST /auth/login` `{ email, password }` → `{ token, user }`
- `GET /auth/me` → `{ user }`

## Customers
- `GET /customers?q=`
- `GET /customers/:id`
- `POST /customers` `{ name, phone?, email?, address?, taxId?, notes? }`
- `PUT /customers/:id`

## Materials (ADMIN/MANAGER for writes)
- `GET /materials?category=GRANITE|CERAMIC`
- `GET /materials/prices` — all active prices, used by the frontend to
  remember/prefill the last price used per material + application
- `POST /materials` `{ category, name, code? }`
- `POST /materials/:materialId/product-types` `{ name }` — granite only
- `POST /materials/:materialId/stock-sizes` `{ productTypeId?, lengthCm, widthCm, thickness, secondaryWidthCm?, secondaryThickness?, unit, quantityAvailable, lowStockThreshold }`
  — `secondaryWidthCm`/`secondaryThickness` are only for Thread & Riser sets
  (the riser piece's own width/thickness at the same length)
- `POST /materials/prices` `{ materialId, productTypeId?, pricePerM2, currency? }`

## Stock
- `GET /stock/hierarchy?category=GRANITE|CERAMIC` — dashboard tree with status
- `GET /stock/summary` — counts for the dashboard stat cards
- `POST /stock/:stockSizeId/adjust` `{ quantityDelta, type, reason? }` (ADMIN/MANAGER/STOREKEEPER)

## Proformas
- `GET /proformas?status=`
- `GET /proformas/:id`
- `POST /proformas` `{ customerId }` → creates a DRAFT
- `POST /proformas/:id/items` — see **Pricing modes** below for the request shape
- `DELETE /proformas/:id/items/:itemId`
- `GET /proformas/items/:itemId/preview-stock` — optimizer preview, no allocation
- `PUT /proformas/:id/cutting-charge` `{ cuttingCharge }` — flat fee added into
  the subtotal ahead of VAT; only while DRAFT/REVIEW
- `POST /proformas/:id/finalize` — the only endpoint that assigns a number,
  allocates stock, and locks the proforma
- `POST /proformas/:id/reopen` (ADMIN/MANAGER) — releases allocated stock
  back to inventory and drops the proforma to DRAFT so it can be edited
  again; the original number is kept and reused on re-finalize
- `POST /proformas/:id/cancel`
- `GET /proformas/:id/pdf` — streams a printable proforma PDF, branded with
  the company's Amharic/English name and phone numbers, a material code
  column, and the cutting charge line (see `docs/PDF-BRANDING.md`)

### Pricing modes (`POST /proformas/:id/items`)

Every row picks one of three modes — see `proformaCalculator.ts` for the exact math:

| Mode | Used for | Request fields | Price math |
|---|---|---|---|
| `PIECE` | Thread & Riser (sold per set, not by area) | `quantity`, `customerLengthCm`, `customerWidthCm` (reference only) | `total = pricePerPiece x quantity` |
| `AREA_PER_PIECE` (default) | Window Sill, Doorsill, Landing, Kitchen Top | `customerLengthCm`, `customerWidthCm`, `quantity` | `total = (L x W) x pricePerM2 x quantity` |
| `AREA_TOTAL` | Ceramic tiles | `customerLengthCm`/`customerWidthCm` (the selected tile size), `requestedAreaM2` | `total = pricePerM2 x requestedAreaM2`; `quantity` (pieces) is computed server-side as `ceil(requestedAreaM2 / tileArea)` |

`pricePerM2` is optional on every mode — if omitted, the backend falls back
to the material's configured `Price`. Whatever price IS used (typed or
looked up) is remembered as the new default for that exact material +
application, so the next row doesn't need it re-entered.

## Notes
- Dimensions are stored in **centimeters** in the DB and API; the frontend's
  proforma entry form takes **meters** (matches the original spreadsheet UI)
  and converts before calling the API — see `NewProforma.tsx`.
- Money values are always computed server-side in `proformaCalculator.ts`;
  never trust or recompute totals in the frontend.
- **Thread & Riser over-width fallback**: if a customer needs a thread wider
  than the standard 34cm stock, the UI shows a warning suggesting the row be
  added under Kitchen Top instead (cutting one slab into a thread + riser
  piece) and priced at the Kitchen Top rate. This is a manual step, not an
  automatic cross-material substitution — see `docs/ACCEPTANCE-CRITERIA.md`
  for why that was scoped down.
