const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'public')));

const studentsRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const aiRoutes = require('./routes/ai');
const reportsRoutes = require('./routes/reports');

app.use('/api/students', studentsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Attendance System Backend is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Classroom Attendance & Engagement AI Monitor API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      students: '/api/students',
      attendance: '/api/attendance',
      ai: '/api/ai',
      reports: '/api/reports',
      dashboard: '/api/reports/dashboard'
    },
    documentation: 'See README.md for full API documentation'
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Classroom Attendance & Engagement AI Monitor API',
    version: '1.0.0',
    status: 'running',
    frontend: 'Visit http://localhost:3000 in your browser for the dashboard',
    api: 'Visit /api for API information',
    endpoints: {
      health: '/api/health',
      students: '/api/students',
      attendance: '/api/attendance',
      ai: '/api/ai',
      reports: '/api/reports',
      dashboard: '/api/reports/dashboard'
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = app;

