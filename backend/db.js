const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'attendance.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      photo_path TEXT,
      face_encoding BLOB,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating students table:', err.message);
    } else {
      console.log('Students table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      session_date DATE NOT NULL,
      session_time TIME NOT NULL,
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating attendance table:', err.message);
    } else {
      console.log('Attendance table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS engagement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      session_date DATE NOT NULL,
      session_time TIME NOT NULL,
      attention_score REAL NOT NULL,
      eyes_open INTEGER DEFAULT 1,
      facing_camera INTEGER DEFAULT 1,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating engagement table:', err.message);
    } else {
      console.log('Engagement table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date DATE NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      total_students INTEGER DEFAULT 0,
      avg_engagement REAL DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error('Error creating sessions table:', err.message);
    } else {
      console.log('Sessions table ready');
    }
  });
}

const dbHelpers = {
  createStudent: (name, photoPath, faceEncoding, callback) => {
    const encodingBlob = faceEncoding ? Buffer.from(faceEncoding) : null;
    db.run(
      'INSERT INTO students (name, photo_path, face_encoding) VALUES (?, ?, ?)',
      [name, photoPath, encodingBlob],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, name, photo_path: photoPath });
        }
      }
    );
  },

  getAllStudents: (callback) => {
    db.all('SELECT id, name, photo_path, created_at FROM students ORDER BY name', [], (err, rows) => {
      callback(err, rows);
    });
  },

  getStudentById: (id, callback) => {
    db.get('SELECT * FROM students WHERE id = ?', [id], (err, row) => {
      callback(err, row);
    });
  },

  recordAttendance: (studentId, sessionDate, sessionTime, callback) => {
    db.run(
      'INSERT INTO attendance (student_id, session_date, session_time) VALUES (?, ?, ?)',
      [studentId, sessionDate, sessionTime],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, student_id: studentId });
        }
      }
    );
  },

  getAttendanceByDate: (date, callback) => {
    db.all(
      `SELECT a.*, s.name 
       FROM attendance a 
       JOIN students s ON a.student_id = s.id 
       WHERE a.session_date = ? 
       ORDER BY a.session_time`,
      [date],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  getAttendanceByStudent: (studentId, callback) => {
    db.all(
      'SELECT * FROM attendance WHERE student_id = ? ORDER BY session_date DESC, session_time DESC',
      [studentId],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  recordEngagement: (studentId, sessionDate, sessionTime, attentionScore, eyesOpen, facingCamera, callback) => {
    db.run(
      `INSERT INTO engagement (student_id, session_date, session_time, attention_score, eyes_open, facing_camera) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [studentId, sessionDate, sessionTime, attentionScore, eyesOpen ? 1 : 0, facingCamera ? 1 : 0],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID });
        }
      }
    );
  },

  getEngagementByStudent: (studentId, date, callback) => {
    db.all(
      `SELECT * FROM engagement 
       WHERE student_id = ? AND session_date = ? 
       ORDER BY timestamp`,
      [studentId, date],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  getAverageEngagement: (studentId, date, callback) => {
    db.get(
      `SELECT AVG(attention_score) as avg_score, COUNT(*) as count 
       FROM engagement 
       WHERE student_id = ? AND session_date = ?`,
      [studentId, date],
      (err, row) => {
        callback(err, row);
      }
    );
  },

  createSession: (sessionDate, callback) => {
    db.run(
      'INSERT INTO sessions (session_date) VALUES (?)',
      [sessionDate],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, session_date: sessionDate });
        }
      }
    );
  },

  endSession: (sessionId, totalStudents, avgEngagement, callback) => {
    db.run(
      'UPDATE sessions SET end_time = CURRENT_TIMESTAMP, total_students = ?, avg_engagement = ? WHERE id = ?',
      [totalStudents, avgEngagement, sessionId],
      (err) => {
        callback(err);
      }
    );
  },

  getDailyReport: (date, callback) => {
    db.all(
      `SELECT 
        s.id as student_id,
        s.name,
        COUNT(DISTINCT a.id) as attendance_count,
        AVG(e.attention_score) as avg_engagement,
        MAX(e.attention_score) as max_engagement,
        MIN(e.attention_score) as min_engagement
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.session_date = ?
      LEFT JOIN engagement e ON s.id = e.student_id AND e.session_date = ?
      GROUP BY s.id, s.name
      ORDER BY s.name`,
      [date, date],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  getDashboardData: (callback) => {
    const today = new Date().toISOString().split('T')[0];
    db.all(
      `SELECT 
        COUNT(DISTINCT s.id) as total_students,
        COUNT(DISTINCT a.student_id) as present_today,
        AVG(e.attention_score) as avg_engagement_today
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.session_date = ?
      LEFT JOIN engagement e ON s.id = e.student_id AND e.session_date = ?`,
      [today, today],
      (err, rows) => {
        callback(err, rows[0] || { total_students: 0, present_today: 0, avg_engagement_today: 0 });
      }
    );
  }
};

module.exports = { db, dbHelpers };

