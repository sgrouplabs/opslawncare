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
  return rows.slice(1).filter(r => r && r.length >= 6).map(r => ({
    id:               r[0] || uuidv4(),
    name:            r[1] || '',
    address:         r[2] || '',
    pricePerCut:     parseFloat(r[3]) || 0,
    totalCuts:       parseInt(r[4]) || 0,
    mileageRoundtrip: parseFloat(r[5]) || 0,
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
  return parseClients(await getSheetValues('Clients!A2:G'));
}

async function getClientById(id) {
  const clients = await getClients();
  return clients.find(c => c.id === id) || null;
}

async function addClients(clientsArray) {
  const rows = clientsArray.map(c => [
    uuidv4(), c.name, c.address, c.pricePerCut, c.totalCuts, c.mileageRoundtrip, c.notes || ''
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Clients!A2:G',
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows },
  });
  return clientsArray.map(c => ({ id: uuidv4(), ...c }));
}

// Update an existing client row by ID
async function updateClient(id, { name, address, pricePerCut, totalCuts, mileageRoundtrip, notes }) {
  const rowNum = await findRowById('Clients!A:A', id);
  if (!rowNum) throw new Error('Client not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Clients!A${rowNum}:G${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [[id, name, address, pricePerCut, totalCuts, mileageRoundtrip, notes || '']] },
  });
  return { id, name, address, pricePerCut, totalCuts, mileageRoundtrip, notes };
}

// Delete client row by ID
async function deleteClient(id) {
  const rowNum = await findRowById('Clients!A:A', id);
  if (!rowNum) throw new Error('Client not found: ' + id);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Clients!A${rowNum}:G${rowNum}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [['', '', '', '', '', '', '']] },
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
};
