const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { sequelize } = require('./models');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Path to frontend dist
const FRONTEND_PATH = path.resolve(__dirname, '../../frontend/dist');

// Check if frontend exists
const frontendExists = fs.existsSync(FRONTEND_PATH);
if (frontendExists) {
  console.log('Frontend found at: ' + FRONTEND_PATH);
} else {
  console.warn('Warning: Frontend not found at ' + FRONTEND_PATH);
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api', routes);

// Serve static frontend files
if (frontendExists) {
  app.use(express.static(FRONTEND_PATH));
}

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found' });
});

// SPA fallback
if (frontendExists) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// Read version
const versionPath = path.resolve(__dirname, '../../version.txt');
let version = '1.0.0';
try {
  if (fs.existsSync(versionPath)) {
    version = fs.readFileSync(versionPath, 'utf8').trim();
  }
} catch (e) {}

// Start server
const startServer = async () => {
  try {
    console.log('');
    console.log('========================================');
    console.log('  POS System v' + version);
    console.log('========================================');
    console.log('');
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connection established.');
    if (process.env.NODE_ENV == 'production') {
      await sequelize.sync();
      console.log('Database synchronized.');
    } else {
      console.log('Production mode: skip sequelize.sync (use migrations).');
    }
    app.listen(PORT, () => {
      console.log('');
      console.log('Server running on port ' + PORT);
      console.log('Application: http://localhost:' + PORT);
      console.log('API: http://localhost:' + PORT + '/api');
      console.log('');
      console.log('Press Ctrl+C to stop.');
      console.log('========================================');
    });
  } catch (error) {
    console.error('ERROR: ' + error.message);
    process.exit(1);
  }
};

startServer();
module.exports = app;
