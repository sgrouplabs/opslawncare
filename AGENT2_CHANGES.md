# Agent 2 Changes — Frontend & UI/UX Redesign

## Overview
Complete redesign of `opslawncare/frontend/index.html` with a dark theme, neon green (#39FF14) accents, and an integrated Leaflet.js client map.

---

## Theme & Colors

| Element | Before | After |
|---|---|---|
| Body background | `#f3f4f6` (light gray) | `#0f1117` (deep charcoal) |
| Cards | `bg-white` | `bg-[#1a1d27]` with `#2a2d3a` borders |
| Primary text | gray-800 | gray-100 / gray-50 |
| Secondary text | gray-500 | gray-400 / gray-500 |
| KPI profit numbers | `text-green-600` | `text-neon` (`#39FF14`) |
| Table headers | `bg-gray-50` | `bg-[#12151e]` with gray-400 text |
| Scrollbar | default | Custom neon green thumb on dark track |

---

## Navbar
- Dark background `#1a1d27` with `#2a2d3a` bottom border
- **Added 🌿 logo** with neon green drop-shadow glow effect
- "Ops Lawncare" branding in `#39FF14` neon green
- Subtitle "Anderson, SC" in gray-500
- Clock hidden on mobile, shown on sm+
- **"Add Expense" button** — fully restyled to neon green (`btn-neon`): `#39FF14` background, `color:#000`, bold font, glow shadow on hover

---

## Brand Logo
- 🌿 emoji at top-left of navbar
- Styled with `filter: drop-shadow(0 0 6px rgba(57,255,20,0.7))` for neon green glow

---

## Leaflet Map (NEW)

- **Leaflet CSS + JS** loaded from unpkg CDN (`unpkg.com/leaflet@1.9.4`)
- New **"Client Map" card** in left column (top position)
- Centered on **Anderson, SC** — `lat 34.5034, lon -82.6501`, zoom 12
- **OpenStreetMap** tiles used
- **Neon green dot markers** — `divIcon` with `#39FF14` fill, `box-shadow` glow
- Popups styled dark (`#1a1d27` bg, `#2a2d3a` border, neon glow)
- Popup shows: client name (neon green), address with icon, price per cut, phone (if available)
- Fetches from `/api/clients` and plots all clients with lat/lon coordinates
- Auto-fits bounds to show all clients with 20% padding
- Custom dark-styled zoom controls

---

## Cards (all restyled)

Every card now uses:
```css
background: #1a1d27;
border: 1px solid #2a2d3a;
border-radius: 0.75rem;
transition: box-shadow + border-color 0.3s ease;
```
On hover: `border-color: rgba(57,255,20,0.3)` + `box-shadow: 0 0 8px rgba(57,255,20,0.4)`

---

## KPI Cards

- Added `kpi-card` class with `border-left: 3px solid transparent`
- On hover: `border-left-color: var(--neon-green)` (neon left accent bar)
- Weekly Revenue: `text-neon` (#39FF14)
- Net Profit: `text-purple-400`
- Pending Route: `text-orange-400`
- Today's Forecast: white/gray text, dark icon background

---

## Financial Summary Section

| Box | Before | After |
|---|---|---|
| Total Revenue | `bg-green-50` | `bg-[#0f1f0f]` + green border |
| Total Expenses | `bg-red-50` | `bg-[#1f0f0f]` + red border |
| Net Profit | `bg-blue-50` | `bg-[#0f0f1f]` + purple border |
| Profit Margin | `bg-gray-100` | `bg-[#12151e]` + gray border |

---

## Tables

- Header: `bg-[#12151e]` with `text-gray-400` uppercase text
- Body rows: `divide-y divide-[#2a2d3a]`
- Hover: `hover:bg-[#39FF14]/5` (subtle green tint)
- Price/Cut column: `text-neon` (neon green)
- Profit table Net column: `text-purple-400`
- Profit Margin column: neon green (≥50%), yellow (≥25%), red (<25%)

---

## Weather Grid & Calendar

- 7-day forecast: today highlighted with `bg-green-900/20 border-green-700/40`
- Calendar: today highlighted with `calendar-today` class (neon border + green tint)
- Day names: neon green when today, gray otherwise

---

## Recent Expenses

- Each row: dark icon container (`bg-red-900/30`), expense category in gray-100, amount in red-400
- Dividers: `border-[#2a2d3a]` (subtle dark separators)

---

## Add Expense Modal

- Backdrop: `bg-black/70` (slightly more opaque)
- Modal: `card` class (dark bg + border)
- Form inputs: `bg-[#12151e]` with `#2a2d3a` borders, `text-gray-100`, green focus ring
- Select dropdown: dark styled to match
- **Submit button**: `btn-neon` class — full width, neon green, bold
- X close button: gray-500 → gray-300 on hover

---

## Sorting

- Sort icons: `text-gray-500`, active state `color: #39FF14`
- Sortable columns still clickable, logic unchanged

---

## All Existing Features Preserved

- ✅ Weather forecast widget (restyled)
- ✅ Client route table with sort (restyled)
- ✅ Profit margins table (restyled)
- ✅ Financial summary (restyled)
- ✅ Add Expense modal + form submission (restyled)
- ✅ Recent expenses list (restyled)
- ✅ Week calendar (restyled)
- ✅ All `fetch()` calls to `/api/*` preserved with same data shapes
- ✅ Clock updates every 60 seconds
- ✅ Number formatters (`usd()`, `pct()`) unchanged

---

## Leaflet Map Client Requirements

- ✅ Leaflet CSS/JS via unpkg CDN
- ✅ "Client Map" card/section added
- ✅ Centered on Anderson, SC (34.5034, -82.6501)
- ✅ OpenStreetMap tiles
- ✅ Neon green markers for each client
- ✅ Popup shows name, address, price on click
- ✅ Fetches from `/api/clients`
- ✅ Standard OSM tiles used (dark-friendly popup styling compensates)
