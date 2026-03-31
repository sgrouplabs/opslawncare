const { v4: uuidv4 } = require('uuid');

// ─── Anderson, SC Mock Employees ───────────────────────────────────────────

const EMPLOYEES = [
  { id: 'emp-001', name: 'Bentley',  daysPerWeek: 5, dailyPay: 145, assignedDays: ['Monday','Tuesday','Wednesday','Thursday','Friday'] },
  { id: 'emp-002', name: 'Kevin',    daysPerWeek: 4, dailyPay: 135, assignedDays: ['Tuesday','Wednesday','Thursday','Friday'] },
  { id: 'emp-003', name: 'Mr. Lee',  daysPerWeek: 3, dailyPay: 155, assignedDays: ['Monday','Wednesday','Friday'] },
];

function calcWeeklyPay(emp) { return emp.dailyPay * emp.daysPerWeek; }

function getEmployees() { return EMPLOYEES.map(e => ({...e})); }

function upsertEmployee(data) {
  const idx = EMPLOYEES.findIndex(e => e.id === data.id);
  if (idx >= 0) { EMPLOYEES[idx] = {...EMPLOYEES[idx], ...data}; return EMPLOYEES[idx]; }
  const newEmp = { id: 'emp-' + String(Date.now()), ...data };
  EMPLOYEES.push(newEmp);
  return newEmp;
}

function getTotalWeeklyLabor() {
  return EMPLOYEES.reduce((sum, e) => sum + calcWeeklyPay(e), 0);
}

// ─── Anderson, SC Mock Clients ──────────────────────────────────────────────
// Coordinates: Anderson, SC ≈ 34.5034° N, -82.6501° W

const MOCK_CLIENTS = [
  {
    id: 'client-001',
    name: 'Rodriguez Residence',
    address: '412 Oak St, Anderson, SC 29621',
    lat: 34.5100,
    lon: -82.6480,
    pricePerCut: 55,
    totalCuts: 14,
    mileageRoundtrip: 4.2,
  },
  {
    id: 'client-002',
    name: 'Thompson Lawn Care',
    address: '1847 Greendale Dr, Anderson, SC 29621',
    lat: 34.4950,
    lon: -82.6600,
    pricePerCut: 75,
    totalCuts: 18,
    mileageRoundtrip: 8.7,
  },
  {
    id: 'client-003',
    name: 'Patel Home',
    address: '3021 N Broad St, Anderson, SC 29621',
    lat: 34.5200,
    lon: -82.6410,
    pricePerCut: 45,
    totalCuts: 10,
    mileageRoundtrip: 3.1,
  },
  {
    id: 'client-004',
    name: 'Davis Estate',
    address: '908 N Fant St, Anderson, SC 29621',
    lat: 34.5080,
    lon: -82.6550,
    pricePerCut: 85,
    totalCuts: 20,
    mileageRoundtrip: 11.4,
  },
  {
    id: 'client-005',
    name: 'Martinez Family',
    address: '567 James St, Anderson, SC 29621',
    lat: 34.4980,
    lon: -82.6440,
    pricePerCut: 40,
    totalCuts: 8,
    mileageRoundtrip: 1.8,
  },
];

// ─── Anderson, SC Mock Expenses ─────────────────────────────────────────────

const MOCK_EXPENSES = [
  {
    id: 'exp-001',
    category: 'Fuel',
    amount: 85.00,
    date: '2026-03-01',
    description: 'Gas station fill-up - week 1',
  },
  {
    id: 'exp-002',
    category: 'Equipment',
    amount: 120.00,
    date: '2026-03-05',
    description: 'Blade sharpening - mower deck',
  },
  {
    id: 'exp-003',
    category: 'Labor',
    amount: 200.00,
    date: '2026-03-08',
    description: 'Part-time helper - Saturday jobs',
  },
  {
    id: 'exp-004',
    category: 'Fuel',
    amount: 72.50,
    date: '2026-03-12',
    description: 'Gas station fill-up - week 2',
  },
  {
    id: 'exp-005',
    category: 'Equipment',
    amount: 45.00,
    date: '2026-03-15',
    description: 'Oil change - riding mower',
  },
  {
    id: 'exp-006',
    category: 'Fuel',
    amount: 90.00,
    date: '2026-03-19',
    description: 'Gas station fill-up - week 3',
  },
  {
    id: 'exp-007',
    category: 'Labor',
    amount: 180.00,
    date: '2026-03-22',
    description: 'Part-time helper - weekend route',
  },
  {
    id: 'exp-008',
    category: 'Equipment',
    amount: 28.00,
    date: '2026-03-25',
    description: 'Air filter replacement',
  },
];

// ─── Dashboard Summary ───────────────────────────────────────────────────────

async function getDashboardSummary() {
  const clients = MOCK_CLIENTS;
  const expenses = MOCK_EXPENSES;

  const totalRevenue = clients.reduce((sum, c) => sum + (c.pricePerCut * c.totalCuts), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalLaborExpense = getTotalWeeklyLabor();
  const netProfit = totalRevenue - (totalExpenses + totalLaborExpense);
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
  const recentExpenses = expenses.slice(-3).reverse();

  return {
    totalRevenue,
    totalExpenses,
    totalLaborExpense,
    netProfit,
    profitMargin,
    pendingThisWeek: clients.length,
    recentExpenses,
    clientCount: clients.length,
  };
}

// ─── Profit Margins per Client ───────────────────────────────────────────────

async function getProfitMargins() {
  const clients = MOCK_CLIENTS;
  const expenses = MOCK_EXPENSES;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = clients.reduce((sum, c) => sum + c.pricePerCut * c.totalCuts, 0);

  return clients.map(c => {
    const revenue = c.pricePerCut * c.totalCuts;
    const share = totalRevenue > 0 ? (revenue / totalRevenue) * totalExpenses : 0;
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
  return MOCK_CLIENTS
    .map(c => ({ name: c.name, address: c.address, mileageRoundtrip: c.mileageRoundtrip }))
    .sort((a, b) => a.mileageRoundtrip - b.mileageRoundtrip);
}

// ─── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  getClients: async () => MOCK_CLIENTS,
  getClientById: async (id) => MOCK_CLIENTS.find(c => c.id === id) || null,
  getExpenses: async () => MOCK_EXPENSES,
  addExpense: async ({ category, amount, date, description }) => {
    const expense = {
      id: uuidv4(),
      category,
      amount: parseFloat(amount),
      date,
      description: description || '',
    };
    MOCK_EXPENSES.push(expense);
    return expense;
  },
  updateExpense: async (id, data) => {
    const idx = MOCK_EXPENSES.findIndex(e => e.id === id);
    if (idx < 0) throw new Error('Expense not found: ' + id);
    MOCK_EXPENSES[idx] = { ...MOCK_EXPENSES[idx], ...data };
    return MOCK_EXPENSES[idx];
  },
  deleteExpense: async (id) => {
    const idx = MOCK_EXPENSES.findIndex(e => e.id === id);
    if (idx < 0) throw new Error('Expense not found: ' + id);
    MOCK_EXPENSES.splice(idx, 1);
  },
  addClients: async (clientsArray) => {
    const added = clientsArray.map(c => {
      const newClient = { id: 'client-' + Date.now() + Math.random().toString(36).slice(2), ...c };
      MOCK_CLIENTS.push(newClient);
      return newClient;
    });
    return added;
  },
  updateClient: async (id, data) => {
    const idx = MOCK_CLIENTS.findIndex(c => c.id === id);
    if (idx < 0) throw new Error('Client not found: ' + id);
    MOCK_CLIENTS[idx] = { ...MOCK_CLIENTS[idx], ...data };
    return MOCK_CLIENTS[idx];
  },
  deleteClient: async (id) => {
    const idx = MOCK_CLIENTS.findIndex(c => c.id === id);
    if (idx < 0) throw new Error('Client not found: ' + id);
    MOCK_CLIENTS.splice(idx, 1);
  },
  getEmployees: async () => getEmployees(),
  upsertEmployee: async (data) => upsertEmployee(data),
  deleteEmployee: async (id) => {
    const idx = EMPLOYEES.findIndex(e => e.id === id);
    if (idx >= 0) EMPLOYEES.splice(idx, 1);
  },
  getTotalWeeklyLabor: async () => getTotalWeeklyLabor(),
  getDashboardSummary,
  getProfitMargins,
  getOptimizedRoute,
};
