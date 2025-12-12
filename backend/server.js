const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, dbHelpers } = require('./db');
const sessionStore = require('./sessionStore');
const aiProcess = require('./aiProcess');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware to log requests (skip very frequent AI frame posts)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/ai/process-frame')) {
    return next();
  }
  console.log(`${req.method} ${req.url}`);
  next();
});

const studentsRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const aiRoutes = require('./routes/ai');
const reportsRoutes = require('./routes/reports');
const sessionRoutes = require('./routes/session');
const coursesRoutes = require('./routes/courses');

// Direct session management endpoints (ensure these never 404)
app.get('/api/session/status', (req, res) => {
  const state = sessionStore.getState();
  const remaining = state.isActive ? Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000)) : 0;

  res.json({
    success: true,
    isActive: state.isActive,
    remainingSeconds: remaining,
    duration: state.duration,
    courseId: state.courseId,
    courseSessionId: state.courseSessionId,
    sessionNumber: state.sessionNumber
  });
});

app.post('/api/session/start', (req, res, next) => {
  const { duration, course_id } = req.body;
  const minutes = parseInt(duration) || 10;
  const courseId = parseInt(course_id);

  if (!courseId || isNaN(courseId)) {
    return res.status(400).json({
      success: false,
      error: 'course_id is required to start a session'
    });
  }

  const sessionDate = new Date().toISOString().split('T')[0];

  dbHelpers.createCourseSession(courseId, sessionDate, (err, session) => {
    if (err) return next(err);

    sessionStore.startSession(minutes, {
      courseId: courseId,
      courseSessionId: session.id,
      sessionNumber: session.session_number
    });

    // Start AI engine for this session if not already running
    aiProcess.startAI({ backendUrl: `http://localhost:${PORT}` });

    res.json({
      success: true,
      message: `Session ${session.session_number} for course started for ${minutes} minutes`,
      isActive: true,
      duration: minutes,
      courseId: courseId,
      courseSessionId: session.id,
      sessionNumber: session.session_number
    });
  });
});

app.post('/api/session/stop', (req, res, next) => {
  const state = sessionStore.getState();
  const courseSessionId = state.courseSessionId;

  if (courseSessionId) {
    dbHelpers.finalizeCourseSession(courseSessionId, (err) => {
      if (err) return next(err);

      sessionStore.stopSession();

      // Stop AI engine when session ends
      aiProcess.stopAI();

      res.json({
        success: true,
        message: 'Session stopped',
        isActive: false
      });
    });
  } else {
    sessionStore.stopSession();

    // Stop AI engine even if no course session id was set
    aiProcess.stopAI();

    res.json({
      success: true,
      message: 'Session stopped',
      isActive: false
    });
  }
});

// Direct overall reports endpoint to avoid 404s
app.get('/api/reports/overall', (req, res, next) => {
  dbHelpers.getOverallReport((err, report) => {
    if (err) return next(err);

    const formattedReport = report.map(r => ({
      student_id: r.student_id,
      name: r.name,
      total_days_present: r.total_days_present || 0,
      avg_engagement: r.avg_engagement ? parseFloat(r.avg_engagement).toFixed(2) : null
    }));

    const total = formattedReport.length;
    const withEngagement = formattedReport.filter(s => s.avg_engagement !== null);
    const avgEng = withEngagement.length > 0
      ? (withEngagement.reduce((sum, s) => sum + parseFloat(s.avg_engagement), 0) / withEngagement.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      type: 'overall',
      summary: {
        total_students: total,
        avg_engagement: avgEng
      },
      students: formattedReport
    });
  });
});

app.use('/api/students', studentsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/courses', coursesRoutes);

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

