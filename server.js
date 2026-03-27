require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// API Routes
app.use('/api', apiRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/frontend/index.html');
});

app.listen(PORT, () => {
  console.log(`Ops Lawncare server running on http://localhost:${PORT}`);
});

module.exports = app;
