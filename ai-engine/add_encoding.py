"""Add a face encoding for a student from an image file.

Usage:
    python add_encoding.py --student-id 1 --image path/to/photo.jpg

This will compute the face encoding from the image and insert it into
../backend/attendance.db (student_encodings table) and also set students.face_encoding
if it is currently NULL.
"""
import argparse
import os
import sqlite3

import face_recognition
import numpy as np

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "attendance.db")

def add_encoding(student_id: int, image_path: str):
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    img = face_recognition.load_image_file(image_path)
    encs = face_recognition.face_encodings(img)
    if not encs:
        raise RuntimeError("No face detected in image")

    enc = encs[0]
    enc_bytes = enc.astype(np.float64).tobytes()

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO student_encodings (student_id, face_encoding) VALUES (?, ?)",
            (student_id, enc_bytes),
        )
        cur.execute(
            "UPDATE students SET face_encoding = ? WHERE id = ? AND (face_encoding IS NULL OR face_encoding = '')",
            (enc_bytes, student_id),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Stored encoding for student {student_id} from {image_path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--student-id", type=int, required=True)
    parser.add_argument("--image", required=True)
    args = parser.parse_args()
    add_encoding(args.student_id, args.image)


if __name__ == "__main__":
    main()
