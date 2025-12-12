const express = require('express');
const { dbHelpers } = require('../db');

const router = express.Router();

// GET /api/courses - list all courses with session counts
router.get('/', (req, res, next) => {
  dbHelpers.getCourses((err, courses) => {
    if (err) return next(err);
    res.json({ success: true, courses });
  });
});

// POST /api/courses - create a new course
router.post('/', (req, res, next) => {
  const { name, code } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Course name is required' });
  }

  dbHelpers.createCourse(name.trim(), code && code.trim ? code.trim() : code, (err, course) => {
    if (err) return next(err);
    res.status(201).json({ success: true, course });
  });
});

// GET /api/courses/:id/sessions - list sessions for a course
router.get('/:id/sessions', (req, res, next) => {
  const courseId = parseInt(req.params.id);
  if (isNaN(courseId)) {
    return res.status(400).json({ success: false, error: 'Invalid course id' });
  }

  dbHelpers.getCourseSessions(courseId, (err, sessions) => {
    if (err) return next(err);
    res.json({ success: true, sessions });
  });
});

module.exports = router;
