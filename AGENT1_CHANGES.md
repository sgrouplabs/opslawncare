# Agent 1: Backend & Data Architect — Changes Summary

## Overview
Updated the `opslawncare` backend to serve Anderson, SC mock data by default when Google Sheets credentials are not configured.

---

## Files Created

### `src/services/mockData.js` (NEW)
Hardcoded Anderson, SC mock data service with the same interface as `sheets.js`.

**5 Clients (Anderson, SC 29621):**
| Name | Address | Price/Cut | Total Cuts | Mileage RT |
|------|---------|-----------|------------|------------|
| Rodriguez Residence | 412 Oak St | $55 | 14 | 4.2 mi |
| Thompson Lawn Care | 1847 Greendale Dr | $75 | 18 | 8.7 mi |
| Patel Home | 3021 N Broad St | $45 | 10 | 3.1 mi |
| Davis Estate | 908 N Fant St | $85 | 20 | 11.4 mi |
| Martinez Family | 567 James St | $40 | 8 | 1.8 mi |

**Coordinates:** All clients within Anderson, SC (~34.50°N, -82.65°W)

**8 Expenses (Fuel, Equipment, Labor):** Ranging $28–$200, dated March 2026

**Computed Metrics (mock):**
- Total Revenue: $4,590
- Total Expenses: $820.50
- Net Profit: $3,769.50
- Profit Margin: 82.1%
- Client Count: 5

**Exports (same shape as sheets.js):**
- `getClients()` → array of client objects with id, name, address, lat, lon, pricePerCut, totalCuts, mileageRoundtrip
- `getClientById(id)` → single client or null
- `getExpenses()` → array of expense objects with id, category, amount, date, description
- `addExpense()` → appends to in-memory array, returns new expense
- `getDashboardSummary()` → { totalRevenue, totalExpenses, netProfit, profitMargin, pendingThisWeek, recentExpenses, clientCount }
- `getProfitMargins()` → [{ name, address, revenue, expenseShare, net, margin, mileageRoundtrip }]
- `getOptimizedRoute()` → sorted by mileageRoundtrip ascending

---

## Files Modified

### `src/services/sheets.js`
Added mode-switching logic at the top of the file:
```js
const DATA_MODE = process.env.DATA_MODE || (process.env.GOOGLE_SHEETS_CREDENTIALS ? 'live' : 'mock');

if (DATA_MODE === 'mock') {
  console.log('[sheets] Running in MOCK mode — serving Anderson, SC demo data');
  module.exports = require('./mockData');
  return;
}
```
- **No changes to any existing function logic** — all original Google Sheets code is preserved intact
- **Auto-detects**: if `GOOGLE_SHEETS_CREDENTIALS` is set, uses live; otherwise mock
- **Override**: set `DATA_MODE=live` to force live mode, `DATA_MODE=mock` to force mock

### `src/services/weather.js`
- Changed `DEFAULT_LAT` / `DEFAULT_LON` from Berlin (52.52/13.405) to **Anderson, SC (34.5034 / -82.6501)**
- Added `MOCK_FORECAST` — 7-day spring forecast for Anderson, SC (temps 54–82°F, partly cloudy/clear, one rain day April 2)
- Added `DATA_MODE=mock` check inside `fetch7DayForecast()` — returns static mock data when `DATA_MODE=mock` (weather is free API so default remains 'live', but mock is available)

---

## Files NOT Modified
- `server.js` — untouched
- `src/routes/api.js` — untouched (routes already delegate to sheets.js, so they automatically get mock data)

---

## How to Test

```bash
# Should auto-detect mock mode (no GOOGLE_SHEETS_CREDENTIALS set)
DATA_MODE=mock node -e "require('./src/services/sheets').getClients().then(c => console.log(c))"

# Test weather mock
DATA_MODE=mock node -e "require('./src/services/weather').fetch7DayForecast().then(f => console.log(f))"

# Run full server (serves mock data by default)
node server.js
```

## Switching to Live Mode
```bash
# Option 1: Set credentials env var (auto-detects live)
GOOGLE_SHEETS_CREDENTIALS='{...}' GOOGLE_SHEETS_SPREADSHEET_ID='...' node server.js

# Option 2: Force live mode explicitly
DATA_MODE=live GOOGLE_SHEETS_CREDENTIALS='{...}' GOOGLE_SHEETS_SPREADSHEET_ID='...' node server.js
```
