const express = require('express');
const router  = express.Router();
const sheets  = require('../services/sheets');
const weather = require('../services/weather');

// ─── Health ──────────────────────────────────────────────────────────────────

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Clients ─────────────────────────────────────────────────────────────────

router.get('/clients', async (req, res) => {
  try {
    const clients = await sheets.getClients();
    res.json({ clients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch clients', code: 'CLIENTS_FETCH_ERROR' });
  }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const client = await sheets.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found', code: 'CLIENT_NOT_FOUND' });
    res.json({ client });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'CLIENT_FETCH_ERROR' });
  }
});

// PUT /api/clients/:id — update an existing client row
router.put('/clients/:id', async (req, res) => {
  const { id } = req.params;
  const { name, address, pricePerCut, totalCuts, mileageRoundtrip, notes, cutFrequency, paymentMethod } = req.body;
  if (!name || !address) {
    return res.status(400).json({ error: 'Missing required fields: name, address', code: 'MISSING_FIELDS' });
  }
  try {
    const updated = await sheets.updateClient(id, { name, address, pricePerCut, totalCuts, mileageRoundtrip, notes, cutFrequency, paymentMethod });
    console.log('[API] PUT /clients/' + id + ' → ok');
    res.json({ success: true, client: updated });
  } catch (err) {
    console.error('[API] PUT /clients error:', err.message);
    res.status(500).json({ error: err.message, code: 'CLIENT_UPDATE_ERROR' });
  }
});

router.post('/clients/bulk', async (req, res) => {
  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ error: 'Missing or invalid "clients" array', code: 'INVALID_REQUEST' });
  }
  try {
    const BUSINESS_ADDRESS = '2703 Lane Ave, Anderson, SC 29621';
    for (const client of clients) {
      const mileage = await sheets.getMileage(BUSINESS_ADDRESS, client.address);
      client.mileageRoundtrip = mileage;
    }
    const added = await sheets.addClients(clients);
    res.status(201).json({ success: true, count: added.length, clients: added });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add clients', code: 'CLIENTS_ADD_ERROR' });
  }
});

// DELETE /api/clients/:id — remove client
router.delete('/clients/:id', async (req, res) => {
  try {
    await sheets.deleteClient(req.params.id);
    console.log('[API] DELETE /clients/' + req.params.id + ' → ok');
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /clients error:', err.message);
    res.status(500).json({ error: 'Failed to delete client', code: 'CLIENT_DELETE_ERROR' });
  }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

router.get('/expenses', async (req, res) => {
  try {
    const expenses = await sheets.getExpenses();
    res.json({ expenses });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch expenses', code: 'EXPENSES_FETCH_ERROR' });
  }
});

router.post('/expenses', async (req, res) => {
  const { category, amount, date, description } = req.body;
  if (!category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required fields: category, amount, date', code: 'MISSING_FIELDS' });
  }
  try {
    const expense = await sheets.addExpense({ category, amount, date, description: description || '' });
    res.status(201).json({ expense });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add expense', code: 'EXPENSE_ADD_ERROR' });
  }
});

// PUT /api/expenses/:id — update an existing expense row
router.put('/expenses/:id', async (req, res) => {
  const { id } = req.params;
  const { category, amount, date, description } = req.body;
  if (!category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required fields: category, amount, date', code: 'MISSING_FIELDS' });
  }
  try {
    const updated = await sheets.updateExpense(id, { category, amount, date, description: description || '' });
    console.log('[API] PUT /expenses/' + id + ' → ok');
    res.json({ success: true, expense: updated });
  } catch (err) {
    console.error('[API] PUT /expenses error:', err.message);
    res.status(500).json({ error: err.message, code: 'EXPENSE_UPDATE_ERROR' });
  }
});

// DELETE /api/expenses/:id — remove expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    await sheets.deleteExpense(req.params.id);
    console.log('[API] DELETE /expenses/' + req.params.id + ' → ok');
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /expenses error:', err.message);
    res.status(500).json({ error: 'Failed to delete expense', code: 'EXPENSE_DELETE_ERROR' });
  }
});

// ─── Employees ────────────────────────────────────────────────────────────────

router.get('/employees', async (req, res) => {
  try {
    const employees = await sheets.getEmployees();
    console.log('[API] GET /employees →', employees.length, 'rows');
    res.json({ employees });
  } catch (err) {
    console.error('[API] GET /employees error:', err.message);
    res.status(500).json({ error: 'Failed to fetch employees', code: 'EMPLOYEES_FETCH_ERROR' });
  }
});

router.post('/employees', async (req, res) => {
  const { id, name, daysPerWeek, dailyPay, assignedDays } = req.body;
  if (!name || daysPerWeek == null || dailyPay == null || !Array.isArray(assignedDays)) {
    return res.status(400).json({
      error: 'Missing required fields: name, daysPerWeek, dailyPay, assignedDays[]',
      code: 'MISSING_FIELDS',
    });
  }
  try {
    const employee = await sheets.upsertEmployee({ id, name, daysPerWeek, dailyPay, assignedDays });
    console.log('[API] POST /employees →', id ? 'updated' : 'created', employee.id);
    res.status(201).json({ employee });
  } catch (err) {
    console.error('[API] POST /employees error:', err.message);
    res.status(500).json({ error: 'Failed to upsert employee', code: 'EMPLOYEE_UPSERT_ERROR' });
  }
});

router.delete('/employees/:id', async (req, res) => {
  try {
    await sheets.deleteEmployee(req.params.id);
    console.log('[API] DELETE /employees/' + req.params.id + ' → ok');
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /employees error:', err.message);
    res.status(500).json({ error: 'Failed to delete employee', code: 'EMPLOYEE_DELETE_ERROR' });
  }
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard/summary', async (req, res) => {
  try {
    const summary = await sheets.getDashboardSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary', code: 'DASHBOARD_ERROR' });
  }
});

router.get('/dashboard/profit-margins', async (req, res) => {
  try {
    const margins = await sheets.getProfitMargins();
    res.json({ margins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profit margins', code: 'PROFIT_MARGINS_ERROR' });
  }
});

router.get('/dashboard/route', async (req, res) => {
  try {
    const route = await sheets.getOptimizedRoute();
    res.json({ route });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch route', code: 'ROUTE_ERROR' });
  }
});

// ─── Schedule ─────────────────────────────────────────────────────────────────

router.get('/schedule', async (req, res) => {
  try {
    const schedule = await sheets.getSchedule();
    res.json({ schedule });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch schedule', code: 'SCHEDULE_FETCH_ERROR' });
  }
});

// ─── Jobs ─────────────────────────────────────────────────────────────────────

router.get('/jobs', async (req, res) => {
  try {
    const jobs = await sheets.getJobs();
    // Sort ascending by date
    jobs.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs', code: 'JOBS_FETCH_ERROR' });
  }
});

// ─── Weather ─────────────────────────────────────────────────────────────────

router.get('/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || undefined;
    const lon = parseFloat(req.query.lon) || undefined;
    const forecast = await weather.fetch7DayForecast(lat, lon);
    res.json({ forecast });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch weather', code: 'WEATHER_ERROR' });
  }
});

module.exports = router;
