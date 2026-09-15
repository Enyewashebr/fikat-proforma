# Acceptance criteria

Use this as the go/no-go checklist before calling any phase "done" — a
successful `npm run build` only proves the code compiles, not that the
business rules hold.

## Proforma
- [x] Customer can be selected before a draft is created
- [x] Multiple items can be added to one proforma
- [x] Items remain editable (add/remove) while status is DRAFT/REVIEW
- [x] Adding an item never changes proforma status
- [x] Proforma only becomes FINALIZED on an explicit action
- [x] Subtotal, VAT, and grand total are computed server-side
- [x] Price per row (fixed price per piece or per m² depending on pricing
      mode) can be typed in, falling back to the material's configured price
      when left blank — and whatever price is used is remembered as the new
      default for that material + application, so it's never re-typed on
      the next row for the same thing
- [x] Proforma can be downloaded/printed as a PDF, before or after finalize,
      branded with the company's Amharic/English name and phone numbers,
      showing the customer's address and each item's material code
- [x] A finalized proforma can be reopened for editing (ADMIN/MANAGER),
      releasing its allocated stock back to inventory
- [x] A flat cutting charge can be entered before finalize, added into the
      subtotal ahead of VAT

## Pricing modes
- [x] Thread & Riser: priced per piece/set (`total = fixedPrice x quantity`),
      not by area
- [x] Window Sill, Doorsill, Landing, Kitchen Top: priced per piece by area
      (`total = (L x W) x pricePerM2 x quantity`) — unchanged from the
      original spec
- [x] Ceramic: priced by total area requested, not by a cut length/width
      (`total = pricePerM2 x requestedAreaM2`); the physical tile count
      needed is computed automatically from the selected stock size
- [x] Thread & Riser sets are modeled as one stock record per length with a
      secondary width/thickness for the riser piece (never as independently
      trackable inventory — they're sold as a set, not separately)

## Stock
- [x] Materials can be searched/filtered by category
- [x] Granite is grouped by material → product type → stock size
- [x] Ceramic is grouped by material → stock size
- [x] Quantity can be increased/decreased
- [x] Every quantity change writes a StockTransaction row
- [x] Quantity can never go negative
- [x] Low-stock / out-of-stock status reflects `lowStockThreshold`

## Stock optimization
- [x] CUT mode: a stock piece produces multiple identical customer pieces
      when they physically fit (e.g. 1.40 m stock yields two 0.67 m pieces
      + 0.06 m waste), not just a single-piece-fit check
- [x] Waste from a cut is never joined with another piece's waste to
      fabricate an extra customer piece
- [x] For repeated pieces, higher-yield stock is consumed first; ties are
      broken by the smaller stock size (see `stockOptimizer.ts` module
      comment and `TEST 2`/`TEST 3` in the test suite)
- [x] ASSEMBLE mode: whole stock pieces are combined end-to-end only when no
      single piece is long enough (e.g. 2.00 m + 2.20 m covers 4.05 m)
- [x] ASSEMBLE mode prefers fewer stock pieces over pure waste minimization
      (see `TEST 4`) — matches the "production preference over waste
      minimization" business rule
- [x] Actual inventory quantity is a hard constraint in both modes
- [x] Insufficient stock is detected and reported (with a shortage count)
      before finalize, not silently allowed through
- [x] Unit tests cover the cutting/assembly/shortage/width-rejection cases
      (`backend/src/services/__tests__/stockOptimizer.test.ts`, run with
      `npm test` in `backend/`)

## Product selection
- [x] Granite: Category → Material → Application → customer dimensions
- [x] Ceramic: Category → Product → customer dimensions (no application step)
- [x] Choosing a category resets the material/application selected under the
      other category
- [x] The optimizer only ever searches stock matching the exact selected
      material (+ application, for granite) — never substitutes a different
      material/application even if dimensions are similar
- [x] Same product name with different stock sizes (e.g. "Satin Grey" at
      120×60×9 and 60×60×15) are kept as separate stock records under one
      material, never merged

## Security / access
- [x] Passwords are hashed (bcrypt), never stored plain
- [x] JWT required on all API routes except `/auth/login`
- [x] Role checks on write endpoints (materials, stock adjust, proformas)
- [ ] Rate limiting, HTTPS termination, and audit-log review UI (deployment concern)

## Not yet built (tracked, not hidden)
- **Thread & Riser over-width auto-substitution**: when a customer needs a
  thread wider than the standard 34cm stock, the spec describes
  automatically cutting a Kitchen Top slab into a thread + riser pair and
  pricing at the Kitchen Top rate. This is scoped down to a UI warning
  telling the user to add that row under Kitchen Top manually — full
  automation would mean the optimizer reasoning about cutting TWO different
  width-strips out of ONE slab cross-section (not just length), which is a
  materially different (2D nesting) problem from the 1D length logic
  everywhere else in `stockOptimizer.ts`. Flagging this honestly rather than
  half-implementing it silently.
- Stock reservation on DRAFT/REVIEW proformas (prevents two reps promising
  the same piece) — schema has `quantityReserved`, logic not wired up yet
- Reporting endpoints (stock movement, waste, sales)
- Broader test coverage (proformaService, controllers) — only the optimizer
  has unit tests so far
- CI/CD and backup automation
