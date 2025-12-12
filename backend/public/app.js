const API_URL = 'http://localhost:3000/api';

// --- Courses helpers ---

async function loadCoursesIntoSelect(selectId) {
    try {
        const response = await fetch(`${API_URL}/courses`);
        const data = await response.json();
        const select = document.getElementById(selectId);
        if (!select) return;

        if (!data.success) {
            select.innerHTML = '<option value="">Error loading courses</option>';
            return;
        }

        const courses = data.courses || [];
        if (courses.length === 0) {
            select.innerHTML = '<option value="">No courses yet</option>';
        } else {
            select.innerHTML = '<option value="">Select course...</option>' +
                courses.map(c => `<option value="${c.id}">${c.name}${c.code ? ' (' + c.code + ')' : ''}</option>`).join('');
        }
    } catch (err) {
        console.error('Error loading courses:', err);
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Error loading courses</option>';
        }
    }
}

async function promptNewCourse() {
    const name = prompt('Enter course name (e.g., CSC 301):');
    if (!name || !name.trim()) return;

    try {
        const response = await fetch(`${API_URL}/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() })
        });
        const data = await response.json();
        if (!data.success) {
            alert('Failed to create course: ' + (data.error || 'Unknown error'));
            return;
        }

        // Reload course selects
        await loadCoursesIntoSelect('course-select');
        await loadCoursesIntoSelect('report-course-select');

        alert('Course created successfully');
    } catch (err) {
        console.error('Error creating course:', err);
        alert('Error creating course');
    }
}

function showTab(tabName, event) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => {
        el.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    if (tabName === 'dashboard') loadDashboard();
    else if (tabName === 'students') loadStudents();
    else if (tabName === 'reports') {
        setTodayDate();
        loadCoursesIntoSelect('report-course-select');
    }
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('report-date').value = today;
}

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/reports/dashboard`);
        const data = await response.json();
        
        if (data.success) {
            const overview = data.dashboard.overview;
            
            document.getElementById('total-students').textContent = overview.total_students || 0;
            document.getElementById('present-today').textContent = overview.present_today || 0;
            document.getElementById('avg-engagement').textContent = 
                (overview.avg_engagement_today || 0) + '%';
            
            const attendanceRate = overview.total_students > 0
                ? ((overview.present_today / overview.total_students) * 100).toFixed(1)
                : 0;
            document.getElementById('attendance-rate').textContent = attendanceRate + '%';
            
            const topStudentsDiv = document.getElementById('top-students');
            const students = data.dashboard.top_engaged_students || [];
            
            if (students.length > 0) {
                topStudentsDiv.innerHTML = students.map(s => `
                    <div class="student-card">
                        <h3>${s.name}</h3>
                        <p>Engagement: ${s.avg_engagement}%</p>
                        <div class="engagement-bar">
                            <div class="engagement-fill" style="width: ${s.avg_engagement}%"></div>
                        </div>
                    </div>
                `).join('');
            } else {
                topStudentsDiv.innerHTML = '<p class="loading">No engagement data yet</p>';
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        document.getElementById('top-students').innerHTML = 
            '<div class="error">Error loading dashboard data</div>';
    }
}

async function loadStudents() {
    try {
        const response = await fetch(`${API_URL}/students`);
        const data = await response.json();
        
        if (data.success) {
            const studentsDiv = document.getElementById('students-list');
            const students = data.students || [];
            
            if (students.length > 0) {
                studentsDiv.innerHTML = students.map(s => {
                    const date = new Date(s.created_at).toLocaleDateString();
                    const photo = s.photo_url ? `<img src="${s.photo_url}" alt="${s.name}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; margin-top: 10px;">` : '';
                    return `<div class="student-card">
                        <h3>${s.name}</h3>
                        <p>Registered: ${date}</p>
                        ${photo}
                        <div class="card-actions">
                            <button class="primary-btn" onclick="viewStudentDetail(${s.id}, '${s.name.replace(/'/g, "&#39;")}')">View</button>
                            <button class="danger-btn" onclick="deleteStudent(${s.id})">Delete</button>
                        </div>
                    </div>`;
                }).join('');
            } else {
                studentsDiv.innerHTML = '<p class="loading">No students registered yet</p>';
            }
        }
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('students-list').innerHTML = 
            '<div class="error">Error loading students</div>';
    }
}

async function viewStudentDetail(id, name) {
    if (!id) return;
    const modal = document.getElementById('student-detail-modal');
    const body = document.getElementById('student-detail-body');
    const title = document.getElementById('student-detail-name');
    if (!modal || !body || !title) return;

    title.textContent = name || 'Student Details';
    body.innerHTML = '<p class="loading">Loading attendance...</p>';
    modal.style.display = 'block';

    try {
        const resp = await fetch(`${API_URL}/reports/student/${id}`);
        const data = await resp.json();
        if (!data.success) {
            body.innerHTML = `<div class="error">${data.error || 'Failed to load student data'}</div>`;
            return;
        }

        const stats = data.statistics || {};
        const attendance = data.attendance || [];

        let html = `<p><strong>Total days present:</strong> ${stats.total_attendance_days || 0}</p>
                    <p><strong>Average engagement:</strong> ${stats.avg_engagement || 0}</p>`;

        if (attendance.length === 0) {
            html += '<p>No attendance records yet.</p>';
        } else {
            html += `<h3>Sessions Attended</h3>
                     <table>
                        <thead><tr><th>Course</th><th>Session</th><th>Date</th><th>Time</th></tr></thead>
                        <tbody>`;
            attendance.forEach(a => {
                const courseLabel = a.course_name
                    ? `${a.course_name}${a.course_code ? ' (' + a.course_code + ')' : ''}`
                    : 'N/A';
                const sessionLabel = a.session_number ? `Session ${a.session_number}` : '-';
                const dateVal = a.course_session_date || a.session_date;
                html += `<tr>
                    <td>${courseLabel}</td>
                    <td>${sessionLabel}</td>
                    <td>${dateVal}</td>
                    <td>${a.session_time}</td>
                </tr>`;
            });
            html += '</tbody></table>';
        }

        body.innerHTML = html;
    } catch (err) {
        console.error('Error loading student detail:', err);
        body.innerHTML = '<div class="error">Error loading student details</div>';
    }
}

function closeStudentDetail() {
    const modal = document.getElementById('student-detail-modal');
    if (modal) modal.style.display = 'none';
}

async function deleteStudent(id) {
    if (!id) return;
    const confirmDelete = confirm('Delete this student? This cannot be undone.');
    if (!confirmDelete) return;

    try {
        const response = await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            alert('Student deleted');
            loadStudents();
        } else {
            alert('Error: ' + (data.error || 'Failed to delete student'));
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        alert('Error deleting student. Make sure the backend is running.');
    }
}

document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('student-name').value;
    const photos = Array.from(document.getElementById('student-photo').files || []);
    
    const formData = new FormData();
    formData.append('name', name);
    photos.forEach(p => formData.append('photos', p));
    
    try {
        const response = await fetch(`${API_URL}/students`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Student registered successfully!');
            document.getElementById('student-name').value = '';
            document.getElementById('student-photo').value = '';
            loadStudents();
        } else {
            alert('Error: ' + (data.error || 'Failed to register student'));
        }
    } catch (error) {
        console.error('Error registering student:', error);
        alert('Error registering student. Make sure the backend is running.');
    }
});


function toggleReportInputs() {
    const type = document.getElementById('report-type').value;
    document.getElementById('daily-inputs').style.display = type === 'daily' ? 'block' : 'none';
    document.getElementById('weekly-inputs').style.display = type === 'weekly' ? 'block' : 'none';

    const courseInputs = document.getElementById('course-inputs');
    const courseSessionInputs = document.getElementById('course-session-inputs');
    if (!courseInputs || !courseSessionInputs) return;

    const isCourseOverall = type === 'course-overall';
    const isCourseSession = type === 'course-session';

    courseInputs.style.display = (isCourseOverall || isCourseSession) ? 'flex' : 'none';
    courseSessionInputs.style.display = isCourseSession ? 'flex' : 'none';

    if (isCourseOverall || isCourseSession) {
        loadCoursesIntoSelect('report-course-select');

        // When a course is selected in course-session mode, load its sessions
        const courseSelect = document.getElementById('report-course-select');
        if (courseSelect && !courseSelect.dataset.sessionListenerAttached) {
            courseSelect.addEventListener('change', async () => {
                if (document.getElementById('report-type').value !== 'course-session') return;
                const courseId = courseSelect.value;
                const sessionSelect = document.getElementById('report-session-select');
                if (!sessionSelect) return;
                if (!courseId) {
                    sessionSelect.innerHTML = '<option value="">Select course first</option>';
                    return;
                }
                try {
                    const resp = await fetch(`${API_URL}/courses/${courseId}/sessions`);
                    const data = await resp.json();
                    if (!data.success) {
                        sessionSelect.innerHTML = '<option value="">Error loading sessions</option>';
                        return;
                    }
                    const sessions = data.sessions || [];
                    if (sessions.length === 0) {
                        sessionSelect.innerHTML = '<option value="">No sessions yet</option>';
                    } else {
                        sessionSelect.innerHTML = '<option value="">Select session...</option>' +
                            sessions.map(s => `<option value="${s.id}">Session ${s.session_number} - ${s.session_date}</option>`).join('');
                    }
                } catch (err) {
                    console.error('Error loading course sessions:', err);
                    const sessionSelectEl = document.getElementById('report-session-select');
                    if (sessionSelectEl) {
                        sessionSelectEl.innerHTML = '<option value="">Error loading sessions</option>';
                    }
                }
            });
            courseSelect.dataset.sessionListenerAttached = 'true';
        }
    }
}

async function loadReport() {
    const type = document.getElementById('report-type').value;
    const reportDiv = document.getElementById('report-content');
    reportDiv.innerHTML = '<p class="loading">Loading report...</p>';

    try {
        let url = `${API_URL}/reports/${type}`;
        if (type === 'daily') {
            const date = document.getElementById('report-date').value;
            if (!date) {
                alert('Please select a date');
                return;
            }
            url += `?date=${date}`;
        } else if (type === 'course-overall') {
            const courseId = document.getElementById('report-course-select').value;
            if (!courseId) {
                alert('Please select a course');
                return;
            }
            url = `${API_URL}/reports/course/${courseId}/overall`;
        } else if (type === 'course-session') {
            const courseId = document.getElementById('report-course-select').value;
            const sessionId = document.getElementById('report-session-select').value;
            if (!courseId) {
                alert('Please select a course');
                return;
            }
            if (!sessionId) {
                alert('Please select a session');
                return;
            }
            url = `${API_URL}/reports/course/${courseId}/session/${sessionId}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            const s = data.summary;
            let html = '';

            if (type === 'daily') {
                html = `<div class="stats-grid">
                    <div class="stat-card"><h3>Total Students</h3><p class="stat-number">${s.total_students}</p></div>
                    <div class="stat-card"><h3>Present</h3><p class="stat-number">${s.present_students}</p></div>
                    <div class="stat-card"><h3>Absent</h3><p class="stat-number">${s.absent_students}</p></div>
                    <div class="stat-card"><h3>Attendance Rate</h3><p class="stat-number">${s.attendance_rate}%</p></div>
                </div>
                <table class="report-table">
                    <thead><tr><th>Student</th><th>Present</th><th>Avg Engagement</th><th>Max</th><th>Min</th></tr></thead>
                    <tbody>`;
                
                data.students.forEach(s => {
                    html += `<tr>
                        <td>${s.name}</td>
                        <td>${s.present ? '✓' : '✗'}</td>
                        <td>${s.avg_engagement || 'N/A'}</td>
                        <td>${s.max_engagement || 'N/A'}</td>
                        <td>${s.min_engagement || 'N/A'}</td>
                    </tr>`;
                });
            } else if (type === 'weekly') {
                html = `<div class="stats-grid">
                    <div class="stat-card"><h3>Total Students</h3><p class="stat-number">${s.total_students}</p></div>
                    <div class="stat-card"><h3>Avg Engagement</h3><p class="stat-number">${s.avg_engagement || 0}</p></div>
                </div>
                <h3>Weekly Summary (${data.date_range.start} to ${data.date_range.end})</h3>
                <table class="report-table">
                    <thead><tr><th>Student</th><th>Days Present</th><th>Avg Engagement</th></tr></thead>
                    <tbody>`;
                
                data.students.forEach(s => {
                    html += `<tr>
                        <td>${s.name}</td>
                        <td>${s.days_present}</td>
                        <td>${s.avg_engagement || 'N/A'}</td>
                    </tr>`;
                });
            } else if (type === 'overall') {
                html = `<div class="stats-grid">
                    <div class="stat-card"><h3>Total Students</h3><p class="stat-number">${s.total_students}</p></div>
                    <div class="stat-card"><h3>Avg Engagement</h3><p class="stat-number">${s.avg_engagement || 0}</p></div>
                </div>
                <h3>Overall Performance</h3>
                <table class="report-table">
                    <thead><tr><th>Student</th><th>Total Days Present</th><th>Avg Engagement</th></tr></thead>
                    <tbody>`;
                
                data.students.forEach(s => {
                    html += `<tr>
                        <td>${s.name}</td>
                        <td>${s.total_days_present}</td>
                        <td>${s.avg_engagement || 'N/A'}</td>
                    </tr>`;
                });
            } else if (type === 'course-overall') {
                html = `<div class="stats-grid">
                    <div class="stat-card"><h3>Total Students</h3><p class="stat-number">${s.total_students}</p></div>
                    <div class="stat-card"><h3>Avg Engagement</h3><p class="stat-number">${s.avg_engagement || 0}</p></div>
                </div>
                <h3>Course Overall Performance</h3>
                <table class="report-table">
                    <thead><tr><th>Student</th><th>Sessions Present</th><th>Avg Engagement</th></tr></thead>
                    <tbody>`;

                data.students.forEach(s => {
                    html += `<tr>
                        <td>${s.name}</td>
                        <td>${s.total_sessions_present}</td>
                        <td>${s.avg_engagement || 'N/A'}</td>
                    </tr>`;
                });
            } else if (type === 'course-session') {
                html = `<div class="stats-grid">
                    <div class="stat-card"><h3>Total Students</h3><p class="stat-number">${s.total_students}</p></div>
                    <div class="stat-card"><h3>Present</h3><p class="stat-number">${s.present_students}</p></div>
                    <div class="stat-card"><h3>Absent</h3><p class="stat-number">${s.absent_students}</p></div>
                    <div class="stat-card"><h3>Attendance Rate</h3><p class="stat-number">${s.attendance_rate}%</p></div>
                </div>
                <h3>Course Session ${data.session.session_number} - ${data.session.session_date}</h3>
                <table class="report-table">
                    <thead><tr><th>Student</th><th>Present</th><th>Avg Engagement</th><th>Max</th><th>Min</th></tr></thead>
                    <tbody>`;

                data.students.forEach(st => {
                    html += `<tr>
                        <td>${st.name}</td>
                        <td>${st.present ? '✓' : '✗'}</td>
                        <td>${st.avg_engagement || 'N/A'}</td>
                        <td>${st.max_engagement || 'N/A'}</td>
                        <td>${st.min_engagement || 'N/A'}</td>
                    </tr>`;
                });
            }
            
            html += '</tbody></table>';
            reportDiv.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading report:', error);
        reportDiv.innerHTML = '<div class="error">Error loading report</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadStudents();
    setTodayDate();
    loadCoursesIntoSelect('course-select');
});

// Session Management
let sessionTimerInterval;

async function checkSessionStatus() {
    try {
        const response = await fetch(`${API_URL}/session/status`);
        const data = await response.json();
        
        if (data.success) {
            updateSessionUI(data.isActive, data.remainingSeconds);
        }
    } catch (error) {
        console.error('Error checking session status:', error);
    }
}

function updateSessionUI(isActive, remainingSeconds) {
    const startBtn = document.getElementById('start-session-btn');
    const stopBtn = document.getElementById('stop-session-btn');
    const durationInput = document.getElementById('session-duration');
    const timerDisplay = document.getElementById('session-timer');
    
    if (!startBtn || !stopBtn) return; 

    if (isActive) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.6';
        stopBtn.disabled = false;
        stopBtn.style.opacity = '1';
        durationInput.disabled = true;
        
        // Update timer
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Start local countdown if not already running
        if (!sessionTimerInterval) {
            sessionTimerInterval = setInterval(() => {
                remainingSeconds--;
                if (remainingSeconds < 0) {
                    checkSessionStatus(); // Sync with server
                } else {
                    const m = Math.floor(remainingSeconds / 60);
                    const s = remainingSeconds % 60;
                    timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                }
            }, 1000);
        }
    } else {
        startBtn.disabled = false;
        startBtn.style.opacity = '1';
        stopBtn.disabled = true;
        stopBtn.style.opacity = '0.6';
        durationInput.disabled = false;
        timerDisplay.textContent = "00:00";
        
        if (sessionTimerInterval) {
            clearInterval(sessionTimerInterval);
            sessionTimerInterval = null;
        }
    }
}

async function startSession() {
    const duration = document.getElementById('session-duration').value;
    const courseSelect = document.getElementById('course-select');
    const courseId = courseSelect ? courseSelect.value : '';

    if (!courseId) {
        alert('Please select a course before starting a session');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ duration: parseInt(duration), course_id: parseInt(courseId) })
        });
        const data = await response.json();
        if (data.success) {
            checkSessionStatus();
        }
    } catch (error) {
        console.error('Error starting session:', error);
    }
}

async function stopSession() {
    try {
        const response = await fetch(`${API_URL}/session/stop`, {
            method: 'POST'
        });
        const data = await response.json();
        if (data.success) {
            checkSessionStatus();
        }
    } catch (error) {
        console.error('Error stopping session:', error);
    }
}

// Initialize session check
document.addEventListener('DOMContentLoaded', () => {
    checkSessionStatus();
    // Poll status every 30 seconds to stay in sync
    setInterval(checkSessionStatus, 30000);
});


