"""Main loop that ties together face recognition and attention scoring."""

import time
import cv2
import requests

from attention import FACE_MESH, is_attentive
from recognition import load_students, recognize_faces


ATTENDANCE_ENDPOINT = "http://localhost:3000/attendance/log"


def send_log(student_id, attention):
    """Fire-and-forget attendance/attention event to the backend."""

    payload = {
        "student_id": student_id,
        "present": 1 if student_id else 0,
        "attention": float(attention),
    }

    try:
        requests.post(ATTENDANCE_ENDPOINT, json=payload, timeout=3)
    except requests.RequestException as exc:  # Avoid crashing the loop on network hiccups.
        print(f"[warn] failed to log attendance: {exc}")


def run():
    students = load_students()
    print(f"Loaded {len(students)} student encodings")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[error] unable to access webcam")
        return

    print("AI Engine Running... press 'q' to exit")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.05)
                continue

            recognized = recognize_faces(frame, students)

            # Status line summarizing what was detected this frame.
            if recognized:
                names = [r["name"] for r in recognized]
                status_msg = f"Detected: {', '.join(names)}"
                status_color = (0, 200, 0)
            else:
                status_msg = "No face detected"
                status_color = (0, 0, 255)

            cv2.putText(
                frame,
                status_msg,
                (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                status_color,
                2,
            )

            # Attention estimation using the first detected face mesh.
            mesh_result = FACE_MESH.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            attention_flag = False
            if mesh_result.multi_face_landmarks:
                attention_flag = is_attentive(mesh_result.multi_face_landmarks[0].landmark)

            for r in recognized:
                top, right, bottom, left = r["box"]
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    r["name"],
                    (left, top - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )

                if r["id"]:
                    send_log(r["id"], 100 if attention_flag else 0)
                else:
                    # Helpful when running without a backend/DB: still show detections.
                    cv2.putText(frame, "(not logged)", (left, bottom + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            cv2.imshow("Monitoring", frame)
            if cv2.waitKey(1) == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        FACE_MESH.close()


if __name__ == "__main__":
    run()
