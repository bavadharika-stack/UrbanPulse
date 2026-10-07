const express = require('express');
const cors = require('cors');
const config = require('./config');
const userRepository = require('./db');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'UrbanPulse API',
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  await userRepository.seedDemoAccounts();
  app.listen(config.port, () => {
    console.log(`[UrbanPulse Server] Running on http://localhost:${config.port}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start UrbanPulse API:', error);
  process.exitCode = 1;
});
