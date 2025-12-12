const express = require('express');
const { dbHelpers } = require('../db');

const router = express.Router();

router.post('/', (req, res, next) => {
  const { student_id, session_date, session_time } = req.body;

  if (!student_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Student ID is required' 
    });
  }

  const date = session_date || new Date().toISOString().split('T')[0];
  const time = session_time || new Date().toTimeString().split(' ')[0];

  dbHelpers.recordAttendance(student_id, date, time, (err, attendance) => {
    if (err) {
      return next(err);
    }
    res.status(201).json({
      success: true,
      message: 'Attendance recorded successfully',
      attendance: {
        ...attendance,
        session_date: date,
        session_time: time
      }
    });
  });
});

router.get('/', (req, res, next) => {
  const { date, student_id } = req.query;

  if (date) {
    dbHelpers.getAttendanceByDate(date, (err, records) => {
      if (err) {
        return next(err);
      }
      res.json({
        success: true,
        date: date,
        count: records.length,
        attendance: records
      });
    });
  } else if (student_id) {
    const studentId = parseInt(student_id);
    if (isNaN(studentId)) {
      return res.status(400).json({ success: false, error: 'Invalid student ID' });
    }
    
    dbHelpers.getAttendanceByStudent(studentId, (err, records) => {
      if (err) {
        return next(err);
      }
      res.json({
        success: true,
        student_id: studentId,
        count: records.length,
        attendance: records
      });
    });
  } else {
    const today = new Date().toISOString().split('T')[0];
    dbHelpers.getAttendanceByDate(today, (err, records) => {
      if (err) {
        return next(err);
      }
      res.json({
        success: true,
        date: today,
        count: records.length,
        attendance: records
      });
    });
  }
});

// POST /api/attendance/bulk - Record attendance for multiple students at once
router.post('/bulk', (req, res, next) => {
  const { student_ids, session_date, session_time } = req.body;

  if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'student_ids array is required' 
    });
  }

  const date = session_date || new Date().toISOString().split('T')[0];
  const time = session_time || new Date().toTimeString().split(' ')[0];
  
  const results = [];
  let completed = 0;
  let errors = [];

  student_ids.forEach((studentId) => {
    dbHelpers.recordAttendance(studentId, date, time, (err, attendance) => {
      completed++;
      if (err) {
        errors.push({ student_id: studentId, error: err.message });
      } else {
        results.push(attendance);
      }

      if (completed === student_ids.length) {
        if (errors.length > 0 && results.length === 0) {
          return res.status(500).json({
            success: false,
            error: 'Failed to record attendance',
            errors: errors
          });
        }
        res.status(201).json({
          success: true,
          message: `Recorded attendance for ${results.length} student(s)`,
          recorded: results.length,
          failed: errors.length,
          attendance: results,
          errors: errors.length > 0 ? errors : undefined
        });
      }
    });
  });
});

module.exports = router;

