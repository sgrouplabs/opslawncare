# Agent 1: Backend & Data Architect — Changes Summary

## Files Modified

### `src/services/mockData.js`
- **Added `EMPLOYEES` array** — 3 workers (Bentley, Kevin, Mr. Lee) with `id`, `name`, `daysPerWeek`, `dailyPay`, `assignedDays[]`
- **Added `calcWeeklyPay(emp)`** — helper: `dailyPay × daysPerWeek`
- **Added `getEmployees()`** — returns shallow copy of all employees
- **Added `upsertEmployee(data)`** — inserts or updates by `id`; auto-generates `emp-<timestamp>` for new records
- **Added `getTotalWeeklyLabor()`** — sums `calcWeeklyPay` across all employees
- **Updated `getDashboardSummary()`** — now includes `totalLaborExpense` from `getTotalWeeklyLabor()`; `netProfit = totalRevenue - (totalExpenses + totalLaborExpense)`
- **Updated module.exports** — added `getEmployees`, `upsertEmployee`, `getTotalWeeklyLabor`

### `src/services/sheets.js`
- **Added `updateRow(range, values)`** — uses `sheets.spreadsheets.values.update` (needed for in-place employee updates)
- **Added `parseEmployees(rows)`** — maps sheet rows to employee objects; `assignedDays` parsed from comma-separated string
- **Added `getEmployees()`** — reads `Employees!A2:E`
- **Added `upsertEmployee(data)`** — finds by ID (updates row) or appends new row via `appendRow`
- **Added `getTotalWeeklyLabor()`** — computes `Σ(dailyPay × daysPerWeek)` from live sheet data
- **Updated `getDashboardSummary()` (live mode)** — same `totalLaborExpense` / `netProfit` adjustment as mockData
- **Updated module.exports** — added `getEmployees`, `upsertEmployee`, `getTotalWeeklyLabor`

### `src/routes/api.js`
- **Added `GET /api/employees`** — returns `{ employees: [...] }`
- **Added `POST /api/employees`** — upserts employee; expects `{ id?, name, daysPerWeek, dailyPay, assignedDays[] }`; returns `{ employee }`

## Employees Sheet Column Layout
| A | B | C | D | E |
|---|---|---|---|---|
| ID | Name | Days Per Week | Daily Pay | Assigned Days |
| emp-001 | Bentley | 5 | 145 | Monday,Tuesday,Wednesday,Thursday,Friday |

## Dashboard Summary Response (both modes)
```json
{
  "totalRevenue": 7765,
  "totalExpenses": 820.5,
  "totalLaborExpense": 1680,
  "netProfit": 5264.5,
  "profitMargin": "67.8",
  "pendingThisWeek": 5,
  "recentExpenses": [...],
  "clientCount": 5
}
```

## Key Design Decisions
- `assignedDays` stored as **comma-separated string** in sheets (e.g., `"Monday,Wednesday,Friday"`) and as a **JS array** in the API response
- `upsertEmployee` auto-generates an ID (`emp-<timestamp>`) if `id` is not provided
- `netProfit` formula updated to subtract **both** `totalExpenses` AND `totalLaborExpense` from revenue
