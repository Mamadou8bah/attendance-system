"""Tiny helper API to generate a face encoding for a supplied image path."""

import base64
import face_recognition
from flask import Flask, request, jsonify

app = Flask(__name__)


@app.post("/encode")
def encode_face():
    path = request.json["image_path"]
    img = face_recognition.load_image_file(path)
    encs = face_recognition.face_encodings(img)

    if not encs:
        return jsonify({"error": "No face detected"}), 400

    encoding_bytes = encs[0].tobytes()
    encoding_b64 = base64.b64encode(encoding_bytes).decode("utf-8")

    return jsonify({"encoding": encoding_b64})


if __name__ == "__main__":
    app.run(port=5001)
