"""List students and encoding counts from attendance.db to verify data is present.

Usage:
    python list_encodings.py
"""
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "attendance.db")

def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id, name, face_encoding FROM students")
    students = cur.fetchall()
    cur.execute("SELECT student_id, COUNT(*) FROM student_encodings GROUP BY student_id")
    extra = {row[0]: row[1] for row in cur.fetchall()}

    print(f"DB: {DB_PATH}")
    for sid, name, enc in students:
        base = 1 if enc else 0
        more = extra.get(sid, 0)
        print(f"- ID {sid} | {name} | base_encoding: {base} | extra_encodings: {more}")

    conn.close()

if __name__ == "__main__":
    main()
