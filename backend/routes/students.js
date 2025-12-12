const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { dbHelpers } = require('../db');
const { spawnSync } = require('child_process');

const AI_ENCODER = path.join(__dirname, '..', '..', 'ai-engine', 'add_encoding.py');

function encodePhoto(studentId, photoPath) {
  if (!photoPath) return false;
  const abs = path.resolve(photoPath);
  const py = process.env.PYTHON || 'python';
  console.log('Encoding photo:', { studentId, photoPath: abs, encoder: AI_ENCODER });
  console.log('Encoder exists:', fs.existsSync(AI_ENCODER));
  console.log('Image exists:', fs.existsSync(abs));
  const result = spawnSync(py, [AI_ENCODER, '--student-id', String(studentId), '--image', abs], {
    cwd: path.join(__dirname, '..', '..'),
    encoding: 'utf-8',
  });
  console.log('Encode result:', { status: result.status, stdout: result.stdout, stderr: result.stderr });
  if (result.status !== 0) {
    console.warn('Auto-encode failed:', result.stderr || result.stdout || `code ${result.status}`);
    return false;
  }
  return true;
}

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

router.post('/', upload.array('photos', 5), (req, res, next) => {
  const { name, face_encoding, face_encodings } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Student name is required' 
    });
  }

  const photoPaths = (req.files || []).map(f => f.path);
  const primaryPhoto = photoPaths.length > 0 ? photoPaths[0] : null;
  
  // Collect encodings: single value or array (JSON or base64 strings)
  const parsedEncodings = [];
  const encInputs = [];
  if (face_encoding) encInputs.push(face_encoding);
  if (face_encodings) {
    try {
      const arr = JSON.parse(face_encodings);
      if (Array.isArray(arr)) encInputs.push(...arr);
    } catch (e) {
      // ignore malformed batch encodings
    }
  }
  encInputs.forEach(val => {
    try {
      if (typeof val === 'string' && val.startsWith('[')) {
        parsedEncodings.push(Buffer.from(JSON.parse(val)));
      } else if (typeof val === 'string') {
        parsedEncodings.push(Buffer.from(val, 'base64'));
      } else if (Array.isArray(val)) {
        parsedEncodings.push(Buffer.from(val));
      }
    } catch (e) {
      console.warn('Could not parse face encoding entry:', e.message);
    }
  });

  dbHelpers.createStudent(name.trim(), primaryPhoto, parsedEncodings[0], (err, student) => {
    if (err) {
      photoPaths.forEach(p => fs.existsSync(p) && fs.unlinkSync(p));
      return next(err);
    }

    // Store additional encodings if provided
    if (parsedEncodings.length > 1) {
      parsedEncodings.slice(1).forEach(enc => {
        dbHelpers.addStudentEncoding(student.id, enc, () => {});
      });
    }

    // Store extra photos if provided
    if (photoPaths.length > 1) {
      // keep primary in students table; extra photos are just saved on disk for now
    }

    // Auto-generate encodings from all uploaded photos (primary + extras)
    const autoResults = photoPaths.map(p => encodePhoto(student.id, p));
    const autoSuccess = autoResults.filter(Boolean).length;

    res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      student: {
        ...student,
        photo_url: primaryPhoto ? `/uploads/${path.basename(primaryPhoto)}` : null,
        photos: photoPaths.map(p => `/uploads/${path.basename(p)}`),
        encodings_saved: parsedEncodings.length
      },
      auto_encoded: autoSuccess,
      auto_encode_failed: photoPaths.length - autoSuccess
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

