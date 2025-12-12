
"""Lightweight attention/eye-aspect-ratio utilities for the AI engine."""

import numpy as np
import mediapipe as mp


# Mediapipe face mesh configured for a few faces to keep CPU low.
FACE_MESH = mp.solutions.face_mesh.FaceMesh(max_num_faces=3)

# Landmark indices for the left eye following Mediapipe's face mesh topology.
LEFT_EYE_INDICES = [133, 159, 145, 153, 144, 163]


def _eye_aspect_ratio(landmarks) -> float:
	"""Compute the eye aspect ratio (EAR) for the left eye.

	A higher EAR means the eye is more open; useful for a coarse attention proxy.
	"""

	points = np.array([(landmarks[i].x, landmarks[i].y) for i in LEFT_EYE_INDICES])
	# EAR formula: average of two vertical distances over the horizontal distance.
	ear = (
		np.linalg.norm(points[1] - points[5]) + np.linalg.norm(points[2] - points[4])
	) / (2 * np.linalg.norm(points[0] - points[3]))
	return float(ear)


def is_attentive(landmarks, threshold: float = 0.23) -> bool:
    """Return True if the computed EAR suggests the eye is open/attentive."""

    return _eye_aspect_ratio(landmarks) > threshold
