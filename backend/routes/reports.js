const express = require('express');
const { dbHelpers } = require('../db');

const router = express.Router();

router.get('/daily', (req, res, next) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  dbHelpers.getDailyReport(targetDate, (err, report) => {
    if (err) {
      return next(err);
    }

    const formattedReport = report.map(r => ({
      student_id: r.student_id,
      name: r.name,
      attendance_count: r.attendance_count || 0,
      present: (r.attendance_count || 0) > 0,
      avg_engagement: r.avg_engagement ? parseFloat(r.avg_engagement).toFixed(2) : null,
      max_engagement: r.max_engagement ? parseFloat(r.max_engagement).toFixed(2) : null,
      min_engagement: r.min_engagement ? parseFloat(r.min_engagement).toFixed(2) : null
    }));

    const total = formattedReport.length;
    const present = formattedReport.filter(s => s.present).length;
    const withEngagement = formattedReport.filter(s => s.avg_engagement !== null);
    const avgEng = withEngagement.length > 0 
      ? (withEngagement.reduce((sum, s) => sum + parseFloat(s.avg_engagement), 0) / withEngagement.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      date: targetDate,
      summary: {
        total_students: total,
        present_students: present,
        absent_students: total - present,
        attendance_rate: total > 0 ? ((present / total) * 100).toFixed(2) : 0,
        avg_engagement: avgEng
      },
      students: formattedReport
    });
  });
});

router.get('/student/:id', (req, res, next) => {
  const studentId = parseInt(req.params.id);
  const { start_date, end_date } = req.query;

  if (isNaN(studentId)) {
    return res.status(400).json({ success: false, error: 'Invalid student ID' });
  }

  // Get student info first
  dbHelpers.getStudentById(studentId, (err, student) => {
    if (err) {
      return next(err);
    }
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    let dateQuery = '';
    let dateParams = [];
    if (start_date && end_date) {
      dateQuery = 'AND session_date BETWEEN ? AND ?';
      dateParams = [start_date, end_date];
    } else if (start_date) {
      dateQuery = 'AND session_date >= ?';
      dateParams = [start_date];
    } else if (end_date) {
      dateQuery = 'AND session_date <= ?';
      dateParams = [end_date];
    }

    const { db } = require('../db');
    db.all(
      `SELECT * FROM attendance 
       WHERE student_id = ? ${dateQuery}
       ORDER BY session_date DESC, session_time DESC`,
      [studentId, ...dateParams],
      (err, attendanceRecords) => {
        if (err) {
          return next(err);
        }

        db.all(
          `SELECT 
            session_date,
            AVG(attention_score) as avg_engagement,
            COUNT(*) as sample_count
           FROM engagement 
           WHERE student_id = ? ${dateQuery}
           GROUP BY session_date
           ORDER BY session_date DESC`,
          [studentId, ...dateParams],
          (err, engagementRecords) => {
            if (err) {
              return next(err);
            }

            const totalDays = attendanceRecords.length;
            const avgEng = engagementRecords.length > 0
              ? (engagementRecords.reduce((sum, r) => sum + parseFloat(r.avg_engagement), 0) / engagementRecords.length).toFixed(2)
              : 0;

            res.json({
              success: true,
              student: {
                id: student.id,
                name: student.name,
                photo_path: student.photo_path
              },
              period: {
                start_date: start_date || 'all',
                end_date: end_date || 'all'
              },
              statistics: {
                total_attendance_days: totalDays,
                avg_engagement: avgEng,
                engagement_samples: engagementRecords.reduce((sum, r) => sum + r.sample_count, 0)
              },
              attendance: attendanceRecords,
              engagement_by_date: engagementRecords
            });
          }
        );
      }
    );
  });
});

router.get('/summary', (req, res, next) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  dbHelpers.getDailyReport(targetDate, (err, report) => {
    if (err) {
      return next(err);
    }

    const total = report.length;
    const present = report.filter(s => (s.attendance_count || 0) > 0).length;
    const withEng = report.filter(s => s.avg_engagement !== null);
    const avgEng = withEng.length > 0
      ? (withEng.reduce((sum, s) => sum + parseFloat(s.avg_engagement || 0), 0) / withEng.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      date: targetDate,
      summary: {
        total_students: total,
        present_students: present,
        absent_students: total - present,
        attendance_rate: total > 0 ? ((present / total) * 100).toFixed(2) : 0,
        avg_engagement: avgEng,
        students_tracked_engagement: withEng.length
      }
    });
  });
});

router.get('/dashboard', (req, res, next) => {
  dbHelpers.getDashboardData((err, data) => {
    if (err) {
      return next(err);
    }

    const today = new Date().toISOString().split('T')[0];

    const { db } = require('../db');
    db.all(
      `SELECT 
        session_date,
        COUNT(DISTINCT student_id) as students_tracked,
        AVG(attention_score) as avg_engagement
       FROM engagement 
       WHERE session_date >= date('now', '-5 days')
       GROUP BY session_date
       ORDER BY session_date DESC`,
      [],
      (err, trends) => {
        if (err) {
          return next(err);
        }

        db.all(
          `SELECT 
            s.id,
            s.name,
            AVG(e.attention_score) as avg_engagement,
            COUNT(e.id) as samples
           FROM students s
           JOIN engagement e ON s.id = e.student_id
           WHERE e.session_date = ?
           GROUP BY s.id, s.name
           ORDER BY avg_engagement DESC
           LIMIT 5`,
          [today],
          (err, topStudents) => {
            if (err) {
              return next(err);
            }

            res.json({
              success: true,
              dashboard: {
                overview: {
                  total_students: data.total_students || 0,
                  present_today: data.present_today || 0,
                  avg_engagement_today: data.avg_engagement_today ? parseFloat(data.avg_engagement_today).toFixed(2) : 0,
                  attendance_rate: data.total_students > 0 
                    ? ((data.present_today / data.total_students) * 100).toFixed(2) 
                    : 0
                },
                engagement_trends: trends.map(t => ({
                  date: t.session_date,
                  students_tracked: t.students_tracked,
                  avg_engagement: parseFloat(t.avg_engagement || 0).toFixed(2)
                })),
                top_engaged_students: topStudents.map(s => ({
                  id: s.id,
                  name: s.name,
                  avg_engagement: parseFloat(s.avg_engagement).toFixed(2),
                  samples: s.samples
                }))
              }
            });
          }
        );
      }
    );
  });
});

module.exports = router;

