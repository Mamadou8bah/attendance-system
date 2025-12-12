
"""Lightweight attention/eye-aspect-ratio utilities for the AI engine."""

import cv2
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


def get_head_pose(landmarks, image_shape):
    """Estimate head pose (pitch, yaw, roll) from landmarks."""
    img_h, img_w, _ = image_shape
    
    face_2d = []

    # 3D model points (generic)
    # Nose tip, Chin, Left Eye Left Corner, Right Eye Right Corner, Left Mouth Corner, Right Mouth Corner
    object_points = np.array([
        (0.0, 0.0, 0.0),             # Nose tip
        (0.0, -330.0, -65.0),        # Chin
        (-225.0, 170.0, -135.0),     # Left eye left corner
        (225.0, 170.0, -135.0),      # Right eye right corner
        (-150.0, -150.0, -125.0),    # Left Mouth corner
        (150.0, -150.0, -125.0)      # Right Mouth corner
    ], dtype=np.float64)

    # 2D image points from landmarks
    # Indices: 1 (Nose), 152 (Chin), 33 (Left Eye), 263 (Right Eye), 61 (Left Mouth), 291 (Right Mouth)
    indices = [1, 152, 33, 263, 61, 291]
    
    for idx in indices:
        lm = landmarks[idx]
        x, y = int(lm.x * img_w), int(lm.y * img_h)
        face_2d.append([x, y])
        
    face_2d = np.array(face_2d, dtype=np.float64)
    
    # Camera matrix
    focal_length = 1 * img_w
    cam_matrix = np.array([
        [focal_length, 0, img_w / 2],
        [0, focal_length, img_h / 2],
        [0, 0, 1]
    ])
    
    # Distortion coefficients (assuming none)
    dist_matrix = np.zeros((4, 1), dtype=np.float64)
    
    # Solve PnP
    success, rot_vec, trans_vec = cv2.solvePnP(object_points, face_2d, cam_matrix, dist_matrix)
    
    # Get rotational matrix
    rmat, jac = cv2.Rodrigues(rot_vec)
    
    # Get angles
    angles, mtxR, mtxQ, Q, Qx, Qy, Qz = cv2.RQDecomp3x3(rmat)
    
    # angles are in degrees
    pitch = angles[0] * 360
    yaw = angles[1] * 360
    roll = angles[2] * 360
    
    return pitch, yaw, roll


def is_attentive(landmarks, image_shape=(480, 640, 3), threshold: float = 0.23) -> bool:
    """Return True if the person is facing the camera (attentive).
    
    Criteria:
    - Not turning head left/right too much (Yaw)
    - Not looking down/up too much (Pitch)
    """
    try:
        pitch, yaw, roll = get_head_pose(landmarks, image_shape)
        
        # Thresholds for attentiveness
        # Yaw: Looking left/right. +/- 20 degrees is reasonable.
        # Pitch: Looking up/down. +/- 20 degrees is reasonable.
        
        YAW_THRESHOLD = 20
        PITCH_THRESHOLD = 20
        
        if abs(yaw) > YAW_THRESHOLD:
            return False
        if abs(pitch) > PITCH_THRESHOLD:
            return False
            
        return True
        
    except Exception as e:
        # Fallback or fail safe
        return False
