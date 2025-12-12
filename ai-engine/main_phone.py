"""Phone-stream AI loop: face recognition + simple attention, posts to backend.

Usage:
    VIDEO_URL=http://<phone-ip>:8080/video BACKEND_URL=http://localhost:3000 python main_phone.py
"""
import os
import time
import cv2
import requests

from attention import FACE_MESH, is_attentive
from recognition import load_students, recognize_faces

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# To use your phone camera:
# 1. Install an "IP Webcam" app on your phone.
# 2. Start the server in the app.
# 3. Replace '0' below with the URL shown in the app (e.g., "http://192.168.1.5:8080/video").
#    Keep the quotes if it's a URL string!
VIDEO_SOURCE = "http://10.60.81.233:8080/video"
# ---------------------------------------------------------

VIDEO_URL = os.getenv("VIDEO_URL", VIDEO_SOURCE)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
FRAME_DOWNSCALE = 0.5  # reduce CPU cost on high-res phone streams
ATTENTION_SCORE_ATTENTIVE = 1.0
ATTENTION_SCORE_INATTENTIVE = 0.0


def post_frame(detections, engagements):
    """Send detections/engagement in one call to the backend."""
    if not detections and not engagements:
        return

    payload = {
        "detections": detections,
        "engagement_data": engagements,
    }
    try:
        resp = requests.post(f"{BACKEND_URL}/api/ai/process-frame", json=payload, timeout=3)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f"[warn] failed to post frame data: {exc}")


def run():
    students = load_students()
    print(f"Loaded {len(students)} student encodings")
    print(f"Opening video source: {VIDEO_URL}")

    cap = cv2.VideoCapture(VIDEO_URL)
    if not cap.isOpened():
        print("[error] unable to open video source; set VIDEO_URL env var to your phone stream")
        return

    print("AI Engine (phone stream) Running... press 'q' to exit")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            if FRAME_DOWNSCALE and FRAME_DOWNSCALE != 1.0:
                frame_proc = cv2.resize(frame, (0, 0), fx=FRAME_DOWNSCALE, fy=FRAME_DOWNSCALE)
            else:
                frame_proc = frame

            recognized = recognize_faces(frame_proc, students)

            # Attention estimation using first face mesh
            mesh_result = FACE_MESH.process(cv2.cvtColor(frame_proc, cv2.COLOR_BGR2RGB))
            attention_flag = False
            if mesh_result.multi_face_landmarks:
                attention_flag = is_attentive(mesh_result.multi_face_landmarks[0].landmark, frame_proc.shape)

            # Prepare payloads
            detections = []
            engagements = []

            for r in recognized:
                top, right, bottom, left = r["box"]
                cv2.rectangle(frame_proc, (left, top), (right, bottom), (0, 255, 0), 2)
                cv2.putText(
                    frame_proc,
                    r["name"],
                    (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )

                if r["id"]:
                    detections.append({"student_id": r["id"]})
                    engagements.append(
                        {
                            "student_id": r["id"],
                            "attention_score": ATTENTION_SCORE_ATTENTIVE if attention_flag else ATTENTION_SCORE_INATTENTIVE,
                            "eyes_open": attention_flag,
                            "facing_camera": True,
                        }
                    )

            # Post to backend
            post_frame(detections, engagements)

            # Status overlay
            status_msg = "No face detected" if not recognized else "Detected: " + ", ".join(r["name"] for r in recognized)
            status_color = (0, 0, 255) if not recognized else (0, 200, 0)
            cv2.putText(frame_proc, status_msg, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)

            cv2.imshow("Phone Monitoring", frame_proc)
            if cv2.waitKey(1) == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        FACE_MESH.close()


if __name__ == "__main__":
    run()
