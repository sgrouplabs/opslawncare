// ─── Mode Selection ───────────────────────────────────────────────────────────
// Use mock data when DATA_MODE=mock or GOOGLE_SHEETS_CREDENTIALS is not set.
// Use live data when DATA_MODE=live and credentials are present.

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

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

// ─── Helper ──────────────────────────────────────────────────────────────────

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

async function updateRow(range, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

// Converts sheet rows into structured client objects.
// Column indices are explicitly mapped by ordinal position (not by header name indexOf)
// to prevent silent corruption when extra columns (e.g. Notes) exist in the sheet.
// Column order (must match sheet Row 1 exactly):
//   A = ID, B = Client Name, C = Address, D = Price per Cut, E = Total Cuts, F = Mileage Roundtrip
function parseClients(rows) {
  if (!rows || rows.length < 2) return [];
  const [, ...dataRows] = rows;
  return dataRows
    .filter(row => row && row.length >= 6)   // guard: skip malformed/empty rows
    .map(row => ({
      id:                 row[0] || uuidv4(),
      name:               row[1] || '',
      address:            row[2] || '',
      pricePerCut:        parseFloat(row[3]) || 0,
      totalCuts:          parseInt(row[4]) || 0,
      mileageRoundtrip:   parseFloat(row[5]) || 0,
    }));
}

// Expenses columns by ordinal position (A=0, B=1, ...):
//   0=ID, 1=Category, 2=Amount, 3=Date, 4=Description
function parseExpenses(rows) {
  if (!rows || rows.length < 2) return [];
  const [, ...dataRows] = rows;
  return dataRows
    .filter(row => row && row.length >= 5)
    .map(row => ({
      id:          row[0] || uuidv4(),
      category:    row[1] || '',
      amount:      parseFloat(row[2]) || 0,
      date:        row[3] || '',
      description: row[4] || '',
    }));
}

// Employees columns by ordinal position (A=0, B=1, ...):
//   0=ID, 1=Name, 2=Days Per Week, 3=Daily Pay, 4=Assigned Days (comma-separated)
function parseEmployees(rows) {
  if (!rows || rows.length < 2) return [];
  const [, ...dataRows] = rows;
  return dataRows
    .filter(row => row && row.length >= 5)
    .map(row => ({
      id:           row[0] || uuidv4(),
      name:         row[1] || '',
      daysPerWeek:  parseInt(row[2]) || 0,
      dailyPay:     parseFloat(row[3]) || 0,
      assignedDays: row[4] ? row[4].split(',').map(d => d.trim()) : [],
    }));
}

// ─── Clients ─────────────────────────────────────────────────────────────────

async function getClients() {
  // Read 7 columns (A-G) to match what addClients writes (ID, Name, Address, Price, Cuts, Mileage, Notes)
  const rows = await getSheetValues('Clients!A2:G');
  return parseClients(rows);
}

async function getClientById(id) {
  const clients = await getClients();
  return clients.find(c => c.id === id) || null;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

async function getExpenses() {
  const rows = await getSheetValues('Expenses!A2:E');
  return parseExpenses(rows);
}

async function addExpense({ category, amount, date, description }) {
  const id = uuidv4();
  await appendRow('Expenses!A2:E', [id, category, amount, date, description]);
  return { id, category, amount, date, description };
}

async function addClients(clientsArray) {
  const rows = clientsArray.map(c => {
    const id = uuidv4();
    return [id, c.name, c.address, c.pricePerCut, c.totalCuts, c.mileageRoundtrip, c.notes || ''];
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Clients!A2:G',
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows },
  });
  return clientsArray.map((c, i) => ({ id: uuidv4(), ...c }));
}

// ─── Employees ─────────────────────────────────────────────────────────────────

async function getEmployees() {
  const rows = await getSheetValues('Employees!A2:E');
  return parseEmployees(rows);
}

async function upsertEmployee(data) {
  const employees = await getEmployees();
  const idx = employees.findIndex(e => e.id === data.id);
  const assignedDaysStr = Array.isArray(data.assignedDays) ? data.assignedDays.join(',') : (data.assignedDays || '');
  if (idx >= 0) {
    const rowNum = idx + 2; // row 2 is first data row
    await updateRow(`Employees!A${rowNum}:E`, [data.id, data.name, data.daysPerWeek, data.dailyPay, assignedDaysStr]);
    return { ...employees[idx], ...data, assignedDays: data.assignedDays };
  }
  await appendRow('Employees!A2:E', [data.id || 'emp-' + String(Date.now()), data.name, data.daysPerWeek, data.dailyPay, assignedDaysStr]);
  return { id: data.id || 'emp-' + String(Date.now()), ...data };
}

async function getTotalWeeklyLabor() {
  const employees = await getEmployees();
  return employees.reduce((sum, e) => sum + (e.dailyPay * e.daysPerWeek), 0);
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

async function getDashboardSummary() {
  const clients = await getClients();
  const expenses = await getExpenses();

  // Total expected revenue
  const totalRevenue = clients.reduce((sum, c) => sum + (c.pricePerCut * c.totalCuts), 0);

  // Total expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Total weekly labor cost
  const totalLaborExpense = await getTotalWeeklyLabor();

  // Net profit (revenue minus expenses AND labor)
  const netProfit = totalRevenue - (totalExpenses + totalLaborExpense);

  // Profit margin %
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  // Recent expenses (last 3)
  const recentExpenses = expenses.slice(-3).reverse();

  // Pending jobs this week (all clients have scheduled cuts)
  const pendingThisWeek = clients.length;

  return {
    totalRevenue,
    totalExpenses,
    totalLaborExpense,
    netProfit,
    profitMargin,
    pendingThisWeek,
    recentExpenses,
    clientCount: clients.length,
  };
}

// ─── Profit Margins per Client ───────────────────────────────────────────────

async function getProfitMargins() {
  const clients = await getClients();
  const expenses = await getExpenses();
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return clients.map(c => {
    const revenue = c.pricePerCut * c.totalCuts;
    const share = c.totalCuts > 0 ? (revenue / (clients.reduce((s, x) => s + x.pricePerCut * x.totalCuts, 0) || 1)) * totalExpenses : 0;
    const net = revenue - share;
    const margin = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : 0;
    return {
      name: c.name,
      address: c.address,
      revenue,
      expenseShare: share.toFixed(2),
      net,
      margin,
      mileageRoundtrip: c.mileageRoundtrip,
    };
  });
}

// ─── Route Optimization (sorted by mileage) ───────────────────────────────────

async function getOptimizedRoute() {
  const clients = await getClients();
  return clients
    .map(c => ({ name: c.name, address: c.address, mileageRoundtrip: c.mileageRoundtrip }))
    .sort((a, b) => a.mileageRoundtrip - b.mileageRoundtrip);
}

module.exports = {
  getClients,
  getClientById,
  getExpenses,
  addExpense,
  addClients,
  getEmployees,
  upsertEmployee,
  getTotalWeeklyLabor,
  getDashboardSummary,
  getProfitMargins,
  getOptimizedRoute,
};
