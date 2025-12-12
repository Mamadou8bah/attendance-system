const API_URL = 'http://localhost:3000/api';

function showTab(tabName) {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => {
        el.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    if (tabName === 'dashboard') loadDashboard();
    else if (tabName === 'students') loadStudents();
    else if (tabName === 'reports') setTodayDate();
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

document.getElementById('student-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('student-name').value;
    const photo = document.getElementById('student-photo').files[0];
    
    const formData = new FormData();
    formData.append('name', name);
    if (photo) {
        formData.append('photo', photo);
    }
    
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

async function loadDailyReport() {
    const date = document.getElementById('report-date').value;
    if (!date) {
        alert('Please select a date');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/reports/daily?date=${date}`);
        const data = await response.json();
        
        if (data.success) {
            const reportDiv = document.getElementById('report-content');
            const s = data.summary;
            
            let html = `<div class="stats-grid">
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
            
            html += '</tbody></table>';
            reportDiv.innerHTML = html;
        }
    } catch (error) {
        console.error('Error loading report:', error);
        document.getElementById('report-content').innerHTML = 
            '<div class="error">Error loading report</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadStudents();
    setTodayDate();
    
    setInterval(() => {
        if (document.getElementById('dashboard').classList.contains('active')) {
            loadDashboard();
        }
    }, 5000);
});

