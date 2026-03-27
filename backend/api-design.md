# LawnCare Pro — Backend API Design

## Overview

A Node.js/Express backend that serves as the API layer between a static frontend and:
1. **Google Sheets** — used as a simple database (clients, jobs, expenses)
2. **Open-Meteo** — free weather API for 7-day forecasts

No server-side rendering. All responses are JSON.

---

## Google Sheets Database Schema

Three sheets in one spreadsheet:

### Sheet 1: `Clients`
| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | `client_id` | string (UUID) | Unique identifier |
| B | `name` | string | Client full name |
| C | `address` | string | Service address |
| D | `phone` | string | Contact number |
| E | `email` | string | Email (optional) |
| F | `lawn_size_sqft` | number | Lawn area in sq ft |
| G | `service_type` | string | `weekly` / `biweekly` / `monthly` / `one-time` |
| H | `base_price` | number | Monthly/job price in dollars |
| I | `notes` | string | Free-text notes |
| J | `created_at` | string (ISO date) | Date added |

### Sheet 2: `Jobs`
| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | `job_id` | string (UUID) | Unique identifier |
| B | `client_id` | string (FK) | References Clients |
| C | `date` | string (ISO date) | Scheduled/service date |
| D | `description` | string | Work performed |
| E | `price_charged` | number | Amount billed |
| F | `cost_materials` | number | Material costs |
| G | `labor_hours` | number | Hours worked |
| H | `labor_rate` | number | Hourly labor cost |
| I | `profit` | number | `price_charged - cost_materials - (labor_hours * labor_rate)` |
| J | `status` | string | `scheduled` / `completed` / `cancelled` |
| K | `created_at` | string (ISO date) | Record created |

### Sheet 3: `Expenses`
| Column | Field | Type | Description |
|--------|-------|------|-------------|
| A | `expense_id` | string (UUID) | Unique identifier |
| B | `date` | string (ISO date) | Expense date |
| C | `category` | string | `fuel` / `equipment` / `supplies` / `labor` / `other` |
| D | `description` | string | What was purchased |
| E | `amount` | number | Cost in dollars |
| F | `created_at` | string (ISO date) | Record created |

---

## API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
Google Sheets uses a **service account** OAuth2 flow. The server loads credentials from `credentials.json`. No per-user auth — a single service account writes to the sheet.

**Auth Flow:**
1. Server starts → loads `credentials.json` (service account JSON key)
2. Uses `googleapis` `auth.fromJSON()` to create a JWT client
3. Calls `google.auth.getClient({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] })`
4. Caches the auth client; re-authenticates automatically on token refresh
5. All sheet operations use this shared auth client

---

### Endpoints

#### Health
```
GET /health
```
**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-27T14:30:00.000Z"
}
```

---

#### Clients

```
GET /clients
```
**Response 200:**
```json
{
  "clients": [
    {
      "client_id": "uuid-...",
      "name": "Jane Doe",
      "address": "123 Maple St",
      "phone": "555-0101",
      "email": "jane@example.com",
      "lawn_size_sqft": 5000,
      "service_type": "weekly",
      "base_price": 80.00,
      "notes": "Has a dog",
      "created_at": "2026-01-15"
    }
  ],
  "count": 1
}
```

```
GET /clients/:clientId
```
**Response 200:**
```json
{ "client": { ...full client object... } }
```
**Response 404:**
```json
{ "error": "Client not found" }
```

```
POST /clients
```
**Request body:**
```json
{
  "name": "Jane Doe",
  "address": "123 Maple St",
  "phone": "555-0101",
  "email": "jane@example.com",
  "lawn_size_sqft": 5000,
  "service_type": "weekly",
  "base_price": 80.00,
  "notes": "Has a dog"
}
```
**Response 201:**
```json
{ "client_id": "uuid-generated", "message": "Client created" }
```
**Response 400:**
```json
{ "error": "Missing required field: name" }
```

---

#### Jobs

```
GET /jobs
```
**Query params:** `?client_id=uuid&status=completed&from=2026-03-01&to=2026-03-31`
**Response 200:**
```json
{
  "jobs": [
    {
      "job_id": "uuid-...",
      "client_id": "uuid-...",
      "date": "2026-03-15",
      "description": "Weekly mowing",
      "price_charged": 80.00,
      "cost_materials": 0,
      "labor_hours": 1.0,
      "labor_rate": 25.00,
      "profit": 55.00,
      "status": "completed",
      "created_at": "2026-03-15"
    }
  ],
  "count": 1
}
```

```
GET /jobs/:jobId
```
**Response 200:** `{ "job": { ...job object... } }`

```
POST /jobs
```
**Request body:**
```json
{
  "client_id": "uuid-...",
  "date": "2026-03-15",
  "description": "Weekly mowing",
  "price_charged": 80.00,
  "cost_materials": 10.00,
  "labor_hours": 1.0,
  "labor_rate": 25.00,
  "status": "completed"
}
```
**Response 201:**
```json
{ "job_id": "uuid-generated", "message": "Job created" }
```
> Note: `profit` is computed server-side: `price_charged - cost_materials - (labor_hours * labor_rate)`

---

#### Expenses

```
GET /expenses
```
**Query params:** `?category=fuel&from=2026-03-01&to=2026-03-31`
**Response 200:**
```json
{
  "expenses": [
    {
      "expense_id": "uuid-...",
      "date": "2026-03-10",
      "category": "fuel",
      "description": "Gas for mower",
      "amount": 32.50,
      "created_at": "2026-03-10"
    }
  ],
  "count": 1
}
```

```
POST /expenses
```
**Request body:**
```json
{
  "date": "2026-03-10",
  "category": "fuel",
  "description": "Gas for mower",
  "amount": 32.50
}
```
**Response 201:**
```json
{ "expense_id": "uuid-generated", "message": "Expense recorded" }
```

---

#### Dashboard / Analytics

```
GET /dashboard/summary
```
**Response 200:**
```json
{
  "total_clients": 24,
  "active_jobs_this_month": 18,
  "total_revenue_this_month": 3240.00,
  "total_expenses_this_month": 412.50,
  "net_profit_this_month": 2827.50,
  "profit_margin_pct": 87.3
}
```

```
GET /dashboard/profit-margins
```
**Query params:** `?from=2026-01-01&to=2026-03-31`
**Response 200:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-03-31" },
  "jobs": [
    {
      "job_id": "uuid-...",
      "client_name": "Jane Doe",
      "date": "2026-03-15",
      "revenue": 80.00,
      "costs": 35.00,
      "profit": 45.00,
      "margin_pct": 56.25
    }
  ],
  "summary": {
    "total_revenue": 2400.00,
    "total_costs": 840.00,
    "total_profit": 1560.00,
    "avg_margin_pct": 65.0
  }
}
```

---

#### Weather (Open-Meteo)

```
GET /weather
```
**Query params:** `?lat=40.7128&lon=-74.0060` (defaults to configured location)
**Response 200:**
```json
{
  "location": { "lat": 40.7128, "lon": -74.0060 },
  "forecast": [
    {
      "date": "2026-03-27",
      "weather_code": 3,
      "weather_description": "Partly cloudy",
      "temp_max_c": 18.5,
      "temp_min_c": 10.2,
      "precipitation_mm": 0.2,
      "wind_speed_kmh": 14,
      "humidity_pct": 72
    },
    ...7 days total...
  ]
}
```

Weather code mappings (WMO codes):
- 0 = Clear sky
- 1-3 = Partly cloudy / Overcast
- 45-48 = Fog
- 51-67 = Drizzle / Rain
- 71-77 = Snow
- 80-82 = Rain showers
- 95-99 = Thunderstorm

---

## Error Response Format

All errors follow this structure:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

Error codes:
- `VALIDATION_ERROR` — 400, missing/invalid input
- `NOT_FOUND` — 404, resource doesn't exist
- `GOOGLE_SHEETS_ERROR` — 500, sheet operation failed
- `WEATHER_API_ERROR` — 502, Open-Meteo unreachable
- `INTERNAL_ERROR` — 500, unexpected server error

---

## Project Structure (Backend)

```
lawncare/backend/
├── server.js              # Express app entry point
├── package.json
├── credentials.json       # Google service account JSON (gitignored)
├── src/
│   ├── config/
│   │   ├── index.js       # Config (port, sheet ID, default location)
│   │   └── weather-codes.js  # WMO weather code → description mapping
│   ├── middleware/
│   │   ├── errorHandler.js  # Global error handler
│   │   └── validate.js      # Request validation helpers
│   ├── routes/
│   │   ├── index.js          # Route aggregator
│   │   ├── clients.js
│   │   ├── jobs.js
│   │   ├── expenses.js
│   │   ├── dashboard.js
│   │   └── weather.js
│   ├── services/
│   │   ├── googleSheets.js   # Google Sheets read/write logic
│   │   └── weather.js        # Open-Meteo fetch logic
│   └── utils/
│       ├── uuid.js           # UUID v4 generator
│       └── date.js           # Date helpers
└── tests/
    ├── clients.test.js
    ├── jobs.test.js
    ├── expenses.test.js
    └── weather.test.js
```

---

## Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "googleapis": "^140.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

---

## Environment Variables (`.env`)

```
PORT=3000
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
WEATHER_DEFAULT_LAT=40.7128
WEATHER_DEFAULT_LON=-74.0060
WEATHER_DEFAULT_CITY="New York"
```

`credentials.json` is the service account key file — placed alongside `server.js` and gitignored.

---

## Open-Meteo Integration

**Endpoint:** `https://api.open-meteo.com/v1/forecast`

**Params:**
- `latitude`, `longitude` — location
- `daily` — comma-separated variables: `weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,relative_humidity_2m_max`
- `timezone` — `auto` (server local timezone)
- `forecast_days` — `7`

No API key required. Free tier is sufficient for this use case.

---

## Google Sheets Auth Flow (Detailed)

```
1. Developer creates project at console.cloud.google.com
2. Enables Google Sheets API
3. Creates Service Account → downloads JSON key as credentials.json
4. Shares the target spreadsheet with the service account email (xxx@xxx.iam.gserviceaccount.com)
5. Server: google.auth.fromJSON(credentials) → creates auth client
6. Server: google.auth.getClient({ scopes: [...SPREADSHEETS] }) → ready to use
7. google.sheets({ version: 'v4', auth }) → all API calls go through this
```

**Read pattern:** `spreadsheets.values.get({ spreadsheetId, range })`  
**Write pattern:** `spreadsheets.values.append({ spreadsheetId, range, valueInputOption: 'USER_ENTERED', resource: { values: [[...row]] } })`  
**Update pattern:** `spreadsheets.values.update({ spreadsheetId, range, valueInputOption: 'USER_ENTERED', resource: { values: [[...row]] } })`

All sheet ranges assume header rows in row 1, data starting row 2.
