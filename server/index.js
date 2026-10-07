const express = require('express');
const cors = require('cors');
const config = require('./config');
const userRepository = require('./db');
const reportsRepository = require('./db/reports');
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const { uploadDirectory } = require('./middleware/reportUpload');

const app = express();

// Middleware
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDirectory, {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ngo', ngoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'UrbanPulse API',
    timestamp: new Date().toISOString(),
  });
});

app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Image must be 5 MB or smaller.' });
  }
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, message: 'Upload exactly one image in the image field.' });
  }
  if (error.code === 'UPLOAD_INVALID_TYPE') {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (error.status === 404) {
    return res.status(404).json({ success: false, message: 'Image not found.' });
  }
  console.error('Unhandled API Error:', error);
  return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

const startServer = async () => {
  await userRepository.seedDemoAccounts();
  const demoCitizen = await userRepository.findUserByEmail('demo@urbanpulse.com');
  await reportsRepository.seedDemoReports(demoCitizen.id);
  app.listen(config.port, () => {
    console.log(`[UrbanPulse Server] Running on http://localhost:${config.port}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start UrbanPulse API:', error);
  process.exitCode = 1;
});
