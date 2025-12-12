const express = require('express');
const { dbHelpers } = require('../db');
const sessionStore = require('../sessionStore');

const router = express.Router();

router.post('/process-frame', (req, res, next) => {
  const { 
    detections,
    engagement_data,
    session_date,
    session_time
  } = req.body;

  // Check session status
  const sessionState = sessionStore.getState();
  const isSessionActive = sessionState.isActive;
  const courseId = sessionState.courseId || null;
  const courseSessionId = sessionState.courseSessionId || null;

  if (!detections || !Array.isArray(detections)) {
    return res.status(400).json({ 
      success: false, 
      error: 'detections array is required' 
    });
  }

  const date = session_date || new Date().toISOString().split('T')[0];
  const time = session_time || new Date().toTimeString().split(' ')[0];

  const results = { attendance: [], engagement: [], errors: [] };
  let processed = 0;
  const total = detections.length + (engagement_data ? engagement_data.length : 0);

  if (total === 0) {
    return res.json({ success: true, message: 'No data to process', results });
  }

  detections.forEach(d => {
    // Only record attendance if session is active
    if (d.student_id && isSessionActive) {
      dbHelpers.recordAttendance(d.student_id, date, time, courseSessionId, courseId, (err, att) => {
        processed++;
        if (err) results.errors.push({ type: 'attendance', student_id: d.student_id, error: err.message });
        else results.attendance.push(att);
        if (processed === total) sendResponse();
      });
    } else {
      processed++;
      if (processed === total) sendResponse();
    }
  });

  if (engagement_data && Array.isArray(engagement_data)) {
    engagement_data.forEach(e => {
      // Only record engagement if session is active
      if (e.student_id && isSessionActive) {
        dbHelpers.recordEngagement(
          e.student_id,
          date,
          time,
          e.attention_score || 0,
          e.eyes_open !== false,
          e.facing_camera !== false,
          courseSessionId,
          courseId,
          (err, result) => {
          processed++;
          if (err) results.errors.push({ type: 'engagement', student_id: e.student_id, error: err.message });
          else results.engagement.push(result);
          if (processed === total) sendResponse();
        }
        );
      } else {
        // Skip engagement recording if no session or no student_id
        processed++;
        if (processed === total) sendResponse();
      }
    });
  } else {
    // If no engagement data, check if we are done
    if (processed === total) sendResponse();
  }

  function sendResponse() {
    res.json({
      success: true,
      message: 'Frame processed successfully',
      results: {
        attendance_recorded: results.attendance.length,
        engagement_recorded: results.engagement.length,
        errors: results.errors.length
      },
      data: results
    });
  }
});

router.post('/engagement', (req, res, next) => {
  const {
    student_id,
    attention_score,
    eyes_open,
    facing_camera,
    session_date,
    session_time
  } = req.body;

  if (!student_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Student ID is required' 
    });
  }

  if (attention_score === undefined || attention_score === null) {
    return res.status(400).json({ 
      success: false, 
      error: 'Attention score is required' 
    });
  }

  const date = session_date || new Date().toISOString().split('T')[0];
  const time = session_time || new Date().toTimeString().split(' ')[0];

  const sessionState = sessionStore.getState();
  const courseId = sessionState.courseId || null;
  const courseSessionId = sessionState.courseSessionId || null;

  dbHelpers.recordEngagement(
    student_id,
    date,
    time,
    parseFloat(attention_score),
    eyes_open !== false,
    facing_camera !== false,
    courseSessionId,
    courseId,
    (err, result) => {
    if (err) return next(err);
    res.status(201).json({
      success: true,
      message: 'Engagement data recorded successfully',
      engagement: { ...result, student_id, attention_score: parseFloat(attention_score), session_date: date, session_time: time }
    });
  }
  );
});

// GET /api/ai/engagement/:student_id - Get engagement data for a student
router.get('/engagement/:student_id', (req, res, next) => {
  const studentId = parseInt(req.params.student_id);
  const { date } = req.query;

  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, error: 'Invalid student ID' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  dbHelpers.getEngagementByStudent(studentId, targetDate, (err, records) => {
    if (err) return next(err);
    dbHelpers.getAverageEngagement(studentId, targetDate, (err, avg) => {
      if (err) return next(err);
      res.json({
        success: true,
        student_id: studentId,
        date: targetDate,
        count: records.length,
        average_engagement: avg ? parseFloat(avg.avg_score || 0).toFixed(2) : 0,
        engagement_records: records
      });
    });
  });
});

module.exports = router;

