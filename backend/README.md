# Classroom Attendance & Engagement AI Monitor - Backend API

This is the backend API for the hackathon project. It provides REST endpoints for student registration, attendance tracking, engagement monitoring, and reporting.

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## 📋 API Endpoints

### Health Check
- **GET** `/api/health` - Check if server is running

### Students Management

#### Register a new student
- **POST** `/api/students`
  - Body (multipart/form-data):
    - `name` (required): Student name
    - `photo` (optional): Student photo file
    - `face_encoding` (optional): Face encoding data (JSON array or base64)

#### Get all students
- **GET** `/api/students`
  - Returns list of all registered students

#### Get specific student
- **GET** `/api/students/:id`
  - Returns student details

#### Delete student
- **DELETE** `/api/students/:id`
  - Deletes student and their photo

### Attendance Tracking

#### Record attendance
- **POST** `/api/attendance`
  - Body:
    ```json
    {
      "student_id": 1,
      "session_date": "2024-01-15",
      "session_time": "10:30:00"
    }
    ```

#### Get attendance records
- **GET** `/api/attendance?date=2024-01-15` - Get attendance for a date
- **GET** `/api/attendance?student_id=1` - Get attendance for a student
- **GET** `/api/attendance` - Get today's attendance

#### Bulk attendance
- **POST** `/api/attendance/bulk`
  - Body:
    ```json
    {
      "student_ids": [1, 2, 3],
      "session_date": "2024-01-15",
      "session_time": "10:30:00"
    }
    ```

### AI Engine Integration

#### Process frame data from AI engine
- **POST** `/api/ai/process-frame`
  - Body:
    ```json
    {
      "detections": [
        {
          "student_id": 1,
          "confidence": 0.95
        }
      ],
      "engagement_data": [
        {
          "student_id": 1,
          "attention_score": 85.5,
          "eyes_open": true,
          "facing_camera": true
        }
      ],
      "session_date": "2024-01-15",
      "session_time": "10:30:00"
    }
    ```

#### Record engagement data
- **POST** `/api/ai/engagement`
  - Body:
    ```json
    {
      "student_id": 1,
      "attention_score": 85.5,
      "eyes_open": true,
      "facing_camera": true,
      "session_date": "2024-01-15",
      "session_time": "10:30:00"
    }
    ```

#### Get engagement data for student
- **GET** `/api/ai/engagement/:student_id?date=2024-01-15`

### Reports & Dashboard

#### Daily report
- **GET** `/api/reports/daily?date=2024-01-15`
  - Returns attendance and engagement report for a specific date

#### Student report
- **GET** `/api/reports/student/:id?start_date=2024-01-01&end_date=2024-01-15`
  - Returns detailed report for a specific student

#### Summary statistics
- **GET** `/api/reports/summary?date=2024-01-15`
  - Returns overall summary for a date

#### Dashboard data
- **GET** `/api/reports/dashboard`
  - Returns dashboard overview with trends and top students

## Database Schema

The backend uses SQLite with the following tables:

- **students**: Stores registered students (name, photo, face encoding)
- **attendance**: Tracks when students are present
- **engagement**: Records attention/focus levels over time
- **sessions**: Tracks monitoring sessions

Database file: `backend/attendance.db` (created automatically)

## 🔌 Integration with AI Engine

The AI engine (Python) should send processed frame data to:

```
POST http://localhost:3000/api/ai/process-frame
```

Example Python code to send data:
```python
import requests

data = {
    "detections": [
        {"student_id": 1, "confidence": 0.95}
    ],
    "engagement_data": [
        {
            "student_id": 1,
            "attention_score": 85.5,
            "eyes_open": True,
            "facing_camera": True
        }
    ]
}

response = requests.post("http://localhost:3000/api/ai/process-frame", json=data)
```

## Project Structure

```
backend/
├── server.js          # Main Express server
├── db.js              # Database setup and helpers
├── routes/
│   ├── students.js    # Student management routes
│   ├── attendance.js  # Attendance tracking routes
│   ├── ai.js          # AI engine integration routes
│   └── reports.js     # Reports and dashboard routes
├── uploads/           # Student photos (created automatically)
└── attendance.db      # SQLite database (created automatically)
```

## Privacy & Local Processing

- All data is stored locally in SQLite
- No cloud uploads
- Photos stored in local `uploads/` directory
- All processing happens on the local machine

## 🧪 Testing the API

You can test the API using curl, Postman, or any HTTP client:

```bash
# Health check
curl http://localhost:3000/api/health

# Get all students
curl http://localhost:3000/api/students

# Get dashboard
curl http://localhost:3000/api/reports/dashboard
```

## Notes

- The server automatically creates the database and tables on first run
- Photo uploads are limited to 5MB
- All timestamps are stored in UTC
- Date format: YYYY-MM-DD
- Time format: HH:MM:SS

