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

// Helper to ensure a column exists before attempting to add it (for migrations)
function ensureColumn(table, column, definition, callback) {
  db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
    if (err) {
      console.error(`Error checking table info for ${table}:`, err.message);
      if (callback) callback(err);
      return;
    }

    const exists = rows.some(r => r.name === column);
    if (exists) {
      if (callback) callback(null);
      return;
    }

    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, [], (alterErr) => {
      if (alterErr) {
        console.error(`Error adding column ${column} to ${table}:`, alterErr.message);
      } else {
        console.log(`Added column ${column} to ${table}`);
      }
      if (callback) callback(alterErr || null);
    });
  });
}

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

  db.run(`
    CREATE TABLE IF NOT EXISTS student_encodings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      face_encoding BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating student_encodings table:', err.message);
    } else {
      console.log('Student encodings table ready');
    }
  });

  // Courses and course sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating courses table:', err.message);
    } else {
      console.log('Courses table ready');
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS course_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      session_number INTEGER NOT NULL,
      session_date DATE NOT NULL,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      total_students INTEGER DEFAULT 0,
      avg_engagement REAL DEFAULT 0,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    )
  `, (err) => {
    if (err) {
      console.error('Error creating course_sessions table:', err.message);
    } else {
      console.log('Course sessions table ready');
    }
  });

  // Migration: add course-related columns to existing tables if missing
  ensureColumn('attendance', 'course_id', 'INTEGER', () => {});
  ensureColumn('attendance', 'course_session_id', 'INTEGER', () => {});
  ensureColumn('engagement', 'course_id', 'INTEGER', () => {});
  ensureColumn('engagement', 'course_session_id', 'INTEGER', () => {});
  ensureColumn('sessions', 'course_id', 'INTEGER', () => {});
  ensureColumn('sessions', 'session_number', 'INTEGER', () => {});
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

  addStudentEncoding: (studentId, faceEncoding, callback) => {
    const encodingBlob = faceEncoding ? Buffer.from(faceEncoding) : null;
    db.run(
      'INSERT INTO student_encodings (student_id, face_encoding) VALUES (?, ?)',
      [studentId, encodingBlob],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, student_id: studentId });
        }
      }
    );
  },

  getStudentEncodings: (callback) => {
    db.all('SELECT student_id, face_encoding FROM student_encodings', [], (err, rows) => {
      callback(err, rows);
    });
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

  // Record attendance for a (possibly course-specific) session
  // studentId, sessionDate, sessionTime, courseSessionId, courseId, callback
  recordAttendance: (studentId, sessionDate, sessionTime, courseSessionId, courseId, callback) => {
    db.run(
      'INSERT INTO attendance (student_id, session_date, session_time, course_session_id, course_id) VALUES (?, ?, ?, ?, ?)',
      [studentId, sessionDate, sessionTime, courseSessionId || null, courseId || null],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, student_id: studentId, course_session_id: courseSessionId || null, course_id: courseId || null });
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

  // Record engagement for a (possibly course-specific) session
  // studentId, sessionDate, sessionTime, attentionScore, eyesOpen, facingCamera, courseSessionId, courseId, callback
  recordEngagement: (studentId, sessionDate, sessionTime, attentionScore, eyesOpen, facingCamera, courseSessionId, courseId, callback) => {
    db.run(
      `INSERT INTO engagement (student_id, session_date, session_time, attention_score, eyes_open, facing_camera, course_session_id, course_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, sessionDate, sessionTime, attentionScore, eyesOpen ? 1 : 0, facingCamera ? 1 : 0, courseSessionId || null, courseId || null],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, course_session_id: courseSessionId || null, course_id: courseId || null });
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

  // Create a new session for a course (increments session_number per course)
  createCourseSession: (courseId, sessionDate, callback) => {
    db.get(
      'SELECT COALESCE(MAX(session_number), 0) + 1 AS next_num FROM course_sessions WHERE course_id = ?',
      [courseId],
      (err, row) => {
        if (err) {
          return callback(err, null);
        }
        const nextNum = row ? row.next_num : 1;
        db.run(
          'INSERT INTO course_sessions (course_id, session_number, session_date) VALUES (?, ?, ?)',
          [courseId, nextNum, sessionDate],
          function(insertErr) {
            if (insertErr) {
              callback(insertErr, null);
            } else {
              callback(null, { id: this.lastID, course_id: courseId, session_number: nextNum, session_date: sessionDate });
            }
          }
        );
      }
    );
  },

  // Finalize a course session with summary stats
  finalizeCourseSession: (courseSessionId, callback) => {
    db.get(
      'SELECT COUNT(DISTINCT student_id) as total_students FROM attendance WHERE course_session_id = ?',
      [courseSessionId],
      (err, attendanceRow) => {
        if (err) return callback(err);

        db.get(
          'SELECT AVG(attention_score) as avg_engagement FROM engagement WHERE course_session_id = ?',
          [courseSessionId],
          (engErr, engagementRow) => {
            if (engErr) return callback(engErr);

            const totalStudents = attendanceRow ? attendanceRow.total_students || 0 : 0;
            const avgEng = engagementRow && engagementRow.avg_engagement != null
              ? engagementRow.avg_engagement
              : 0;

            db.run(
              'UPDATE course_sessions SET end_time = CURRENT_TIMESTAMP, total_students = ?, avg_engagement = ? WHERE id = ?',
              [totalStudents, avgEng, courseSessionId],
              (updateErr) => callback(updateErr)
            );
          }
        );
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

  getWeeklyReport: (startDate, endDate, callback) => {
    db.all(
      `SELECT 
        s.id as student_id,
        s.name,
        COUNT(DISTINCT a.session_date) as days_present,
        AVG(e.attention_score) as avg_engagement
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.session_date BETWEEN ? AND ?
      LEFT JOIN engagement e ON s.id = e.student_id AND e.session_date BETWEEN ? AND ?
      GROUP BY s.id, s.name
      ORDER BY s.name`,
      [startDate, endDate, startDate, endDate],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  getOverallReport: (callback) => {
    db.all(
      `SELECT 
        s.id as student_id,
        s.name,
        COUNT(DISTINCT a.session_date) as total_days_present,
        AVG(e.attention_score) as avg_engagement
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      LEFT JOIN engagement e ON s.id = e.student_id
      GROUP BY s.id, s.name
      ORDER BY s.name`,
      [],
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
  },

  // Courses helpers
  createCourse: (name, code, callback) => {
    db.run(
      'INSERT INTO courses (name, code) VALUES (?, ?)',
      [name, code || null],
      function(err) {
        if (err) {
          callback(err, null);
        } else {
          callback(null, { id: this.lastID, name, code: code || null });
        }
      }
    );
  },

  getCourses: (callback) => {
    db.all(
      `SELECT c.id, c.name, c.code,
              COUNT(cs.id) as session_count
       FROM courses c
       LEFT JOIN course_sessions cs ON c.id = cs.course_id
       GROUP BY c.id, c.name, c.code
       ORDER BY c.name`,
      [],
      (err, rows) => callback(err, rows)
    );
  },

  getCourseSessions: (courseId, callback) => {
    db.all(
      `SELECT id, course_id, session_number, session_date, start_time, end_time, total_students, avg_engagement
       FROM course_sessions
       WHERE course_id = ?
       ORDER BY session_number`,
      [courseId],
      (err, rows) => callback(err, rows)
    );
  },

  getCourseOverallReport: (courseId, callback) => {
    db.all(
      `SELECT 
        s.id as student_id,
        s.name,
        COUNT(DISTINCT a.course_session_id) as total_sessions_present,
        AVG(e.attention_score) as avg_engagement
       FROM students s
       LEFT JOIN attendance a ON s.id = a.student_id AND a.course_id = ?
       LEFT JOIN engagement e ON s.id = e.student_id AND e.course_id = ?
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [courseId, courseId],
      (err, rows) => callback(err, rows)
    );
  },

  getCourseSessionReport: (courseId, courseSessionId, callback) => {
    db.all(
      `SELECT 
        s.id as student_id,
        s.name,
        COUNT(a.id) as attendance_count,
        AVG(e.attention_score) as avg_engagement,
        MAX(e.attention_score) as max_engagement,
        MIN(e.attention_score) as min_engagement
       FROM students s
       LEFT JOIN attendance a ON s.id = a.student_id AND a.course_id = ? AND a.course_session_id = ?
       LEFT JOIN engagement e ON s.id = e.student_id AND e.course_id = ? AND e.course_session_id = ?
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [courseId, courseSessionId, courseId, courseSessionId],
      (err, rows) => callback(err, rows)
    );
  }
};

module.exports = { db, dbHelpers };

