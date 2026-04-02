// ─── Mode Selection ───────────────────────────────────────────────────────────

const DATA_MODE = process.env.DATA_MODE || (process.env.GOOGLE_SHEETS_CREDENTIALS ? 'live' : 'mock');

if (DATA_MODE === 'mock') {
  console.log('[sheets] Running in MOCK mode — serving Anderson, SC demo data');
  module.exports = require('./mockData');
  return;
}

// ─── Live Google Sheets Mode ─────────────────────────────────────────────────

const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets           = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID   = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

// ─── Geocoding cache & mileage helper ────────────────────────────────────────

const GEOCODE_CACHE = new Map();

async function geocodeAddress(address) {
  if (GEOCODE_CACHE.has(address)) return GEOCODE_CACHE.get(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'BurtonLandscapeApp/1.0' } });
  const data = await res.json();
  if (!data || data.length === 0) return null;
  const { lat, lon } = data[0];
  const result = { lat: parseFloat(lat), lon: parseFloat(lon) };
  GEOCODE_CACHE.set(address, result);
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Haversine fallback — straight-line distance when OSRM is unavailable
function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

async function getMileage(fromAddress, toAddress) {
  if (!fromAddress || !toAddress) return 0;
  try {
    // Geocode sequentially with rate-limit sleep between calls (Nominatim max 1 req/s)
    const from = await geocodeAddress(fromAddress);
    await sleep(1100);
    const to   = await geocodeAddress(toAddress);
    if (!from || !to) return 0;

    // Try OSRM driving route first
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('OSRM HTTP ' + res.status);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const meters = data.routes[0].distance;
      return Math.round(meters * 0.000621371 * 10) / 10;
    }
    // No route found — fall back to Haversine straight-line
    const miles = haversineMiles(from.lat, from.lon, to.lat, to.lon);
    console.warn('[sheets] OSRM returned no route; using Haversine fallback:', miles, 'mi');
    return miles;
  } catch (err) {
    // OSRM or network error — try Haversine with whatever geocode results we have cached
    console.warn('[sheets] getMileage error, attempting Haversine fallback:', err.message);
    try {
      const from = await geocodeAddress(fromAddress);
      const to   = await geocodeAddress(toAddress);
      if (from && to) {
        const miles = haversineMiles(from.lat, from.lon, to.lat, to.lon);
        console.warn('[sheets] Haversine fallback:', miles, 'mi');
        return miles;
      }
    } catch (_) {}
    return 0;
  }
}

// ─── Low-level sheet helpers ─────────────────────────────────────────────────

async function getSheetValues(range) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
  return res.data.values || [];
}

async function appendRow(range, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

// Finds the sheet row number (1-indexed) where col A equals `id`.
// Returns null if not found.
async function findRowById(range, id) {
  const rows = await getSheetValues(range);
  for (let i = 1; i < rows.length; i++) {          // skip header row 0
    if (rows[i][0] === id) return i + 1;             // +1 → sheet row number
  }
  return null;
}

async function deleteRow(rangePrefix, rowNumber, colCount) {
  // Clear the row by writing empty values to it
  const emptyRow = Array(colCount).fill('');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${rangePrefix}${rowNumber}:${String.fromCharCode(64 + colCount)}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [emptyRow] },
  });
}

// ─── Row parsers — ordinal column mapping (A=0, B=1 …) ─────────────────────
// Guards against malformed/empty rows and extra columns.

function parseClients(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).filter(r => r && r.length >= 2).map(r => ({
    id:               r[0] || uuidv4(),
    name:            r[1] || '',
    address:         r[2] || '',
    pricePerCut:     parseFloat(r[3]) || 0,
    totalCuts:       parseInt(r[4]) || 0,
    mileageRoundtrip: parseFloat(r[5]) || 0,
    notes:           r[6] || '',
    cutFrequency:    (r[7] || '').trim() || '',
    paymentMethod:   (r[8] || '').trim() || '',
  }));
}

function parseExpenses(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).filter(r => r && r.length >= 5).map(r => ({
    id:          r[0] || uuidv4(),
    category:    r[1] || '',
    amount:     parseFloat(r[2]) || 0,
    date:        r[3] || '',
    description: r[4] || '',
  }));
}

// Employees — sheet columns: A=ID, B=Name, C=Days Per Week, D=Daily Pay, E=Assigned Days
function parseEmployees(rows) {
  if (!rows || rows.length < 2) return [];
  return rows.slice(1).filter(r => r && r.length >= 5).map(r => ({
    id:          r[0] || uuidv4(),
    name:        r[1] || '',
    daysPerWeek: parseInt(r[2]) || 0,
    dailyPay:    parseFloat(r[3]) || 0,
    // Assigned Days stored as comma-separated string, e.g. "Monday,Wednesday,Friday"
    assignedDays: r[4]
      ? r[4].split(',').map(d => d.trim().toLowerCase())
      : [],
  }));
}

// ─── Clients ─────────────────────────────────────────────────────────────────

async function getClients() {
  return parseClients(await getSheetValues('Clients!A2:I'));
}

async function getClientById(id) {
  const clients = await getClients();
  return clients.find(c => c.id === id) || null;
}

async function addClients(clientsArray) {
  const rows = clientsArray.map(c => [
    uuidv4(), c.name, c.address, c.pricePerCut, c.totalCuts,
    c.mileageRoundtrip || 0,
    c.notes || '',
    c.cutFrequency || '',
    c.paymentMethod || '',
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Clients!A2:I',
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows },
  });
  return clientsArray.map(c => ({ id: uuidv4(), ...c }));
}

// Update an existing client row by ID
async function updateClient(id, { name, address, pricePerCut, totalCuts, mileageRoundtrip, notes, cutFrequency, paymentMethod }) {
  const rowNum = await findRowById('Clients!A:A', id);
  if (!rowNum) throw new Error('Client not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Clients!A${rowNum}:I${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[id, name, address, pricePerCut, totalCuts, mileageRoundtrip || 0, notes || '', cutFrequency || '', paymentMethod || '']] },
  });
  return { id, name, address, pricePerCut, totalCuts, mileageRoundtrip, notes, cutFrequency, paymentMethod };
}

// Delete client row by ID
async function deleteClient(id) {
  const rowNum = await findRowById('Clients!A:A', id);
  if (!rowNum) throw new Error('Client not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Clients!A${rowNum}:I${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [['', '', '', '', '', '', '', '', '']] },
  });
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

async function getExpenses() {
  return parseExpenses(await getSheetValues('Expenses!A2:E'));
}

async function addExpense({ category, amount, date, description }) {
  const id = uuidv4();
  await appendRow('Expenses!A2:E', [id, category, amount, date, description || '']);
  return { id, category, amount, date, description };
}

// Update an existing expense row by ID
async function updateExpense(id, { category, amount, date, description }) {
  const rowNum = await findRowById('Expenses!A:A', id);
  if (!rowNum) throw new Error('Expense not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Expenses!A${rowNum}:E${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[id, category, amount, date, description || '']] },
  });
  return { id, category, amount, date, description };
}

// Delete expense row by ID
async function deleteExpense(id) {
  const rowNum = await findRowById('Expenses!A:A', id);
  if (!rowNum) throw new Error('Expense not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Expenses!A${rowNum}:E${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [['', '', '', '', '']] },
  });
}

// ─── Employees ────────────────────────────────────────────────────────────────

async function getEmployees() {
  return parseEmployees(await getSheetValues('Employees!A2:E'));
}

// upsertEmployee — creates or updates a single employee row.
// assignedDays: array of lowercase day names e.g. ['monday','wednesday','friday']
async function upsertEmployee({ id, name, daysPerWeek, dailyPay, assignedDays }) {
  const assignedDaysStr = Array.isArray(assignedDays)
    ? assignedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(',')
    : (assignedDays || '');

  if (id) {
    // Update existing row — find its sheet row number by scanning column A
    const rowNum = await findRowById('Employees!A:A', id);
    if (rowNum) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Employees!A${rowNum}:E${rowNum}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[id, name, daysPerWeek, dailyPay, assignedDaysStr]] },
      });
    }
    return { id, name, daysPerWeek, dailyPay, assignedDays };
  } else {
    // Append new row — server generates the ID
    const newId = 'emp-' + Date.now();
    await appendRow('Employees!A2:E', [newId, name, daysPerWeek, dailyPay, assignedDaysStr]);
    return { id: newId, name, daysPerWeek, dailyPay, assignedDays };
  }
}

// Delete employee by ID
async function deleteEmployee(id) {
  const rowNum = await findRowById('Employees!A:A', id);
  if (!rowNum) throw new Error('Employee not found: ' + id);
  // Clear the 5-column row (A–E)
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Employees!A${rowNum}:E${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [['', '', '', '', '']] },
  });
}

async function getTotalWeeklyLabor() {
  const employees = await getEmployees();
  return employees.reduce((sum, e) => sum + (e.dailyPay * e.daysPerWeek), 0);
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

async function getDashboardSummary() {
  const [clients, expenses, laborCost] = await Promise.all([
    getClients(),
    getExpenses(),
    getTotalWeeklyLabor(),
  ]);

  const totalRevenue    = clients.reduce((s, c) => s + c.pricePerCut * c.totalCuts, 0);
  const totalExpenses  = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit      = totalRevenue - (totalExpenses + laborCost);
  const profitMargin   = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  return {
    totalRevenue,
    totalExpenses,
    totalLaborExpense: laborCost,
    netProfit,
    profitMargin,
    pendingThisWeek: clients.length,
    recentExpenses:   expenses.slice(-3).reverse(),
    clientCount: clients.length,
  };
}

// ─── Profit Margins per Client ───────────────────────────────────────────────

async function getProfitMargins() {
  const [clients, expenses, laborCost] = await Promise.all([
    getClients(),
    getExpenses(),
    getTotalWeeklyLabor(),
  ]);

  const totalRevenue = clients.reduce((s, c) => s + c.pricePerCut * c.totalCuts, 0);
  const totalCosts  = expenses.reduce((s, e) => s + e.amount, 0) + laborCost;

  return clients.map(c => {
    const revenue = c.pricePerCut * c.totalCuts;
    const share   = totalRevenue > 0 ? (revenue / totalRevenue) * totalCosts : 0;
    const net     = revenue - share;
    const margin  = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : 0;
    return {
      name:              c.name,
      address:           c.address,
      revenue,
      expenseShare:     share.toFixed(2),
      net,
      margin,
      mileageRoundtrip: c.mileageRoundtrip,
    };
  });
}

// ─── Route Optimization ───────────────────────────────────────────────────────

async function getOptimizedRoute() {
  const clients = await getClients();
  return clients
    .map(c => ({ name: c.name, address: c.address, mileageRoundtrip: c.mileageRoundtrip }))
    .sort((a, b) => a.mileageRoundtrip - b.mileageRoundtrip);
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  getClients,
  getClientById,
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  addClients,
  updateClient,
  deleteClient,
  getEmployees,
  upsertEmployee,
  deleteEmployee,
  getTotalWeeklyLabor,
  getDashboardSummary,
  getProfitMargins,
  getOptimizedRoute,
  getMileage,
};
