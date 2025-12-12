"""Face encoding helpers used by the AI engine loop."""

import sqlite3
from typing import List, Dict, Any

import cv2
import face_recognition
import numpy as np


DB_PATH = "../backend/db.sqlite"


def load_students(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
	"""Fetch students and their encodings from SQLite.

	Falls back to an empty list if the DB is missing or unreadable so the loop can still run.
	"""

	try:
		with sqlite3.connect(db_path) as conn:
			cur = conn.cursor()
			cur.execute("SELECT id, name, encoding FROM students")
			rows = cur.fetchall()
	except Exception as exc:
		print(f"[warn] could not load students from {db_path}: {exc}")
		return []

	students = []
	for sid, name, enc in rows:
		if enc:
			students.append(
				{
					"id": sid,
					"name": name,
					"encoding": np.frombuffer(enc, dtype=np.float64),
				}
			)
	return students


def _match_student(enc: np.ndarray, student_encodings: List[Dict[str, Any]], tolerance: float) -> Dict[str, Any]:
	"""Find the closest student encoding within tolerance."""

	if not student_encodings:
		return {"id": None, "name": "Unknown"}

	known_vectors = [s["encoding"] for s in student_encodings]
	distances = face_recognition.face_distance(known_vectors, enc)
	best_idx = int(np.argmin(distances))
	if distances[best_idx] <= tolerance:
		match = student_encodings[best_idx]
		return {"id": match["id"], "name": match["name"]}

	return {"id": None, "name": "Unknown"}


def recognize_faces(frame, student_encodings: List[Dict[str, Any]], tolerance: float = 0.45):
	"""Return list of recognized faces with metadata for drawing/logging.

	Downscales and uses the HOG model for faster CPU inference; rescales boxes back.
	"""

	# Downscale to speed up face detection on CPU-heavy environments.
	small = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
	rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)

	locations_small = face_recognition.face_locations(
		rgb_small, number_of_times_to_upsample=0, model="hog"
	)
	encodings_small = face_recognition.face_encodings(rgb_small, locations_small)

	results = []
	for enc, (top, right, bottom, left) in zip(encodings_small, locations_small):
		match = _match_student(enc, student_encodings, tolerance)
		# Scale back up since we used 0.25 scaling above.
		scaled_box = (top * 4, right * 4, bottom * 4, left * 4)
		results.append(
			{
				"name": match["name"],
				"id": match["id"],
				"box": scaled_box,
				"encoding": enc,
			}
		)

	return results
