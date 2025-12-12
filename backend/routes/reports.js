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
      type: 'daily',
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

router.get('/weekly', (req, res, next) => {
  const { start_date, end_date } = req.query;
  
  // Default to current week if not provided
  let start, end;
  if (start_date && end_date) {
    start = start_date;
    end = end_date;
  } else {
    const curr = new Date();
    const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    const last = first + 6; // last day is the first day + 6

    start = new Date(curr.setDate(first)).toISOString().split('T')[0];
    end = new Date(curr.setDate(last)).toISOString().split('T')[0];
  }

  dbHelpers.getWeeklyReport(start, end, (err, report) => {
    if (err) return next(err);

    const formattedReport = report.map(r => ({
      student_id: r.student_id,
      name: r.name,
      days_present: r.days_present || 0,
      avg_engagement: r.avg_engagement ? parseFloat(r.avg_engagement).toFixed(2) : null
    }));

    const total = formattedReport.length;
    const withEngagement = formattedReport.filter(s => s.avg_engagement !== null);
    const avgEng = withEngagement.length > 0 
      ? (withEngagement.reduce((sum, s) => sum + parseFloat(s.avg_engagement), 0) / withEngagement.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      type: 'weekly',
      date_range: { start, end },
      summary: {
        total_students: total,
        avg_engagement: avgEng
      },
      students: formattedReport
    });
  });
});

router.get('/overall', (req, res, next) => {
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

// Course-level overall report across all sessions for a course
router.get('/course/:courseId/overall', (req, res, next) => {
  const courseId = parseInt(req.params.courseId);
  if (isNaN(courseId)) {
    return res.status(400).json({ success: false, error: 'Invalid course ID' });
  }

  dbHelpers.getCourseOverallReport(courseId, (err, report) => {
    if (err) return next(err);

    const formatted = report.map(r => ({
      student_id: r.student_id,
      name: r.name,
      total_sessions_present: r.total_sessions_present || 0,
      avg_engagement: r.avg_engagement ? parseFloat(r.avg_engagement).toFixed(2) : null
    }));

    const total = formatted.length;
    const withEng = formatted.filter(s => s.avg_engagement !== null);
    const avgEng = withEng.length > 0
      ? (withEng.reduce((sum, s) => sum + parseFloat(s.avg_engagement), 0) / withEng.length).toFixed(2)
      : 0;

    res.json({
      success: true,
      type: 'course-overall',
      course_id: courseId,
      summary: {
        total_students: total,
        avg_engagement: avgEng
      },
      students: formatted
    });
  });
});

// Per-course-session detailed report
router.get('/course/:courseId/session/:sessionId', (req, res, next) => {
  const courseId = parseInt(req.params.courseId);
  const sessionId = parseInt(req.params.sessionId);

  if (isNaN(courseId) || isNaN(sessionId)) {
    return res.status(400).json({ success: false, error: 'Invalid course or session ID' });
  }

  const { db } = require('../db');

  db.get(
    'SELECT id, course_id, session_number, session_date, start_time, end_time FROM course_sessions WHERE id = ? AND course_id = ?',
    [sessionId, courseId],
    (err, sessionRow) => {
      if (err) return next(err);
      if (!sessionRow) {
        return res.status(404).json({ success: false, error: 'Course session not found' });
      }

      dbHelpers.getCourseSessionReport(courseId, sessionId, (repErr, report) => {
        if (repErr) return next(repErr);

        const formatted = report.map(r => ({
          student_id: r.student_id,
          name: r.name,
          present: (r.attendance_count || 0) > 0,
          avg_engagement: r.avg_engagement ? parseFloat(r.avg_engagement).toFixed(2) : null,
          max_engagement: r.max_engagement ? parseFloat(r.max_engagement).toFixed(2) : null,
          min_engagement: r.min_engagement ? parseFloat(r.min_engagement).toFixed(2) : null
        }));

        const total = formatted.length;
        const present = formatted.filter(s => s.present).length;
        const withEng = formatted.filter(s => s.avg_engagement !== null);
        const avgEng = withEng.length > 0
          ? (withEng.reduce((sum, s) => sum + parseFloat(s.avg_engagement), 0) / withEng.length).toFixed(2)
          : 0;

        res.json({
          success: true,
          type: 'course-session',
          course_id: courseId,
          session: {
            id: sessionRow.id,
            session_number: sessionRow.session_number,
            session_date: sessionRow.session_date,
            start_time: sessionRow.start_time,
            end_time: sessionRow.end_time
          },
          summary: {
            total_students: total,
            present_students: present,
            absent_students: total - present,
            attendance_rate: total > 0 ? ((present / total) * 100).toFixed(2) : 0,
            avg_engagement: avgEng
          },
          students: formatted
        });
      });
    }
  );
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
    // Distinct sessions the student actually attended (optionally course-linked)
    db.all(
      `SELECT DISTINCT 
         a.session_date,
         a.session_time,
         a.course_id,
         a.course_session_id,
         cs.session_number,
         cs.session_date AS course_session_date,
         c.name AS course_name,
         c.code AS course_code
       FROM attendance a
       LEFT JOIN course_sessions cs ON a.course_session_id = cs.id
       LEFT JOIN courses c ON a.course_id = c.id
       WHERE a.student_id = ? ${dateQuery}
       ORDER BY COALESCE(cs.session_date, a.session_date) DESC, a.session_time DESC`,
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

