const express = require('express');
const cors = require('cors');
const config = require('./config');
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

// Start Server
app.listen(config.port, () => {
  console.log(`[UrbanPulse Server] Running on http://localhost:${config.port}`);
});
