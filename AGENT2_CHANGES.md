# Agent 2 — Frontend & UI/UX Changes

## Files Modified

### `frontend/index.html`

**Navbar changes:**
- Added `Clients` nav link (pointing to `/clients.html`) next to the clock, with Dashboard link also available
- Added `Add Client` button (neon green `btn-neon`) next to the existing `Add Expense` button
- Both buttons visible with icons on desktop; icon-only on mobile via `hidden sm:inline` pattern

**New "Add Client" modal (`#add-client-modal`):**
- Dark-themed modal (`bg-gray-800` card, `bg-black/70` backdrop, neon green header)
- Modal ID: `add-client-modal`
- Fields (matching Google Sheets columns):
  - Client Name (text, required)
  - Address (text, required)
  - Price Per Cut (number, required)
  - Total Cuts (number, required)
  - Mileage Roundtrip (number, required)
  - Notes (textarea, optional)
- "Add Another Client" button: dynamically inserts another full client block via `addAnotherClientRow()`
- Each extra block has a "Remove" button (hidden on the first row)
- Submit button: "Add All Clients" → `POST /api/clients/bulk` with all client rows
- Success: close modal + `window.location.reload()`
- Error: displays error message inline in the modal
- Backdrop click closes the modal

**JavaScript additions:**
- `openAddClientModal()` — opens modal, resets form, resets row counter
- `closeAddClientModal()` — closes modal
- `addAnotherClientRow()` — increments `clientRowCount`, inserts new client block HTML
- `removeClientRow(button)` — removes the closest `.client-form-row`, re-numbers remaining rows, hides remove btn on row 1
- `submitClients(e)` — collects all form rows, validates, `POST /api/clients/bulk`, handles success/error
- Backdrop click handler added for `#add-client-modal`

---

## Files Created

### `frontend/clients.html`

**Layout:**
- Full-page dark-themed layout matching index.html exactly (`#0f1117` bg, `#1a1d27` cards, `#39FF14` neon green accents)
- Same navbar: logo left, clock, Dashboard link, active Clients link, Add Client button

**Stats row (4 KPI cards):**
- Total Clients | Total Revenue | Total Mileage | Avg Price/Cut

**Full-page client table:**
- Columns: Client Name | Address | Price/Cut | Total Cuts | **Revenue** | Mileage | Actions
- Revenue = `pricePerCut × totalCuts` (computed client-side)
- Columns sortable by clicking headers: Client Name, Price/Cut, Total Cuts, Revenue, Mileage
- Sort indicators (▲/▼) on active column — font-awesome sort-up/sort-down icons
- Delete action per row (with confirm dialog) → `DELETE /api/clients/:id`
- Empty/loading states handled

**Add Client modal:**
- Exact same modal as index.html (same functions shared)
- On success: refreshes the table without full page reload

**JavaScript functions:**
- `loadClients()` — fetches `/api/clients`, renders table and stats
- `renderStats(clients)` — aggregates and shows 4 KPI values
- `renderTable(clients)` — renders table rows with computed revenue column
- `tableSort(key)` — sorts by name/price/total/revenue/mileage, flips ascending/descending, updates sort icons
- `deleteClient(id)` — confirms, sends `DELETE /api/clients/:id`, reloads table
- Modal functions: `openAddClientModal()`, `closeAddClientModal()`, `addAnotherClientRow()`, `removeClientRow()`, `submitClients()` (same logic as index.html)
- `window.location.origin + '/api'` used as API base (works on any host/port)

---

## Theme Matched (unchanged from existing index.html)
- Background: `#0f1117`
- Cards: `#1a1d27`
- Neon green: `#39FF14` / `green-400`
- Glow borders: `box-shadow: 0 0 8px rgba(57,255,20,0.4)`
- Font: Segoe UI / system-ui
- All Tailwind utility classes preserved exactly
