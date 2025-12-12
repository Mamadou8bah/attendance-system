const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbHelpers } = require('../db');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'student-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif)'));
    }
  }
});

router.get('/', (req, res, next) => {
  dbHelpers.getAllStudents((err, students) => {
    if (err) {
      return next(err);
    }
    res.json({
      success: true,
      count: students.length,
      students: students
    });
  });
});

router.get('/:id', (req, res, next) => {
  const studentId = parseInt(req.params.id);
  
  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, error: 'Invalid student ID' });
  }

  dbHelpers.getStudentById(studentId, (err, student) => {
    if (err) {
      return next(err);
    }
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    
    const studentData = {
      id: student.id,
      name: student.name,
      photo_path: student.photo_path,
      photo_url: student.photo_path ? `/uploads/${path.basename(student.photo_path)}` : null,
      created_at: student.created_at
    };
    
    res.json({ success: true, student: studentData });
  });
});

router.post('/', upload.single('photo'), (req, res, next) => {
  const { name, face_encoding } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Student name is required' 
    });
  }

  const photoPath = req.file ? req.file.path : null;
  
  let faceEncoding = null;
  if (face_encoding) {
    try {
      if (face_encoding.startsWith('[')) {
        faceEncoding = JSON.parse(face_encoding);
      } else {
        faceEncoding = Buffer.from(face_encoding, 'base64');
      }
    } catch (e) {
      console.warn('Could not parse face encoding:', e.message);
    }
  }

  dbHelpers.createStudent(name.trim(), photoPath, faceEncoding, (err, student) => {
    if (err) {
      if (photoPath && fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
      return next(err);
    }

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: {
        ...student,
        photo_url: photoPath ? `/uploads/${path.basename(photoPath)}` : null
      }
    });
  });
});

router.delete('/:id', (req, res, next) => {
  const studentId = parseInt(req.params.id);
  
  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, error: 'Invalid student ID' });
  }

  // First get the student to delete their photo
  dbHelpers.getStudentById(studentId, (err, student) => {
    if (err) {
      return next(err);
    }
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    if (student.photo_path && fs.existsSync(student.photo_path)) {
      fs.unlinkSync(student.photo_path);
    }

    const { db } = require('../db');
    db.run('DELETE FROM students WHERE id = ?', [studentId], (err) => {
      if (err) {
        return next(err);
      }
      res.json({
        success: true,
        message: 'Student deleted successfully'
      });
    });
  });
});

module.exports = router;

