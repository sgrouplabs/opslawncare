const express = require('express');
const router = express.Router();
const sheets = require('../services/sheets');
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
