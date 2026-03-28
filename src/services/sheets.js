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

// Converts sheet rows [{name, pricePerCut, totalCuts, mileageRoundtrip}, ...]
// into structured client objects.
function parseClients(rows) {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map(row => {
    const obj = {};
    header.forEach((col, i) => { obj[col] = row[i] || ''; });
    return {
      id: obj['ID'] || uuidv4(),
      name: obj['Client Name'] || '',
      address: obj['Address'] || '',
      pricePerCut: parseFloat(obj['Price per Cut'] || 0),
      totalCuts: parseInt(obj['Total Cuts'] || 0),
      mileageRoundtrip: parseFloat(obj['Mileage Roundtrip'] || 0),
    };
  });
}

function parseExpenses(rows) {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  return data.map(row => {
    const obj = {};
    header.forEach((col, i) => { obj[col] = row[i] || ''; });
    return {
      id: obj['ID'] || uuidv4(),
      category: obj['Category'] || '',
      amount: parseFloat(obj['Amount'] || 0),
      date: obj['Date'] || '',
      description: obj['Description'] || '',
    };
  });
}

// ─── Clients ─────────────────────────────────────────────────────────────────

async function getClients() {
  const rows = await getSheetValues('Clients!A2:F');
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

// ─── Dashboard Summary ───────────────────────────────────────────────────────

async function getDashboardSummary() {
  const clients = await getClients();
  const expenses = await getExpenses();

  // Total expected revenue
  const totalRevenue = clients.reduce((sum, c) => sum + (c.pricePerCut * c.totalCuts), 0);

  // Total expenses
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net profit
  const netProfit = totalRevenue - totalExpenses;

  // Profit margin %
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

  // Recent expenses (last 3)
  const recentExpenses = expenses.slice(-3).reverse();

  // Pending jobs this week (all clients have scheduled cuts)
  const pendingThisWeek = clients.length;

  return {
    totalRevenue,
    totalExpenses,
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
  getDashboardSummary,
  getProfitMargins,
  getOptimizedRoute,
};
