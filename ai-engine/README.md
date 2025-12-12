# AI Engine

Minimal steps to run the webcam-based face recognition + attention loop.

## Setup
1. Create a virtual env (recommended) and install deps:
   ```bash
   pip install -r requirements.txt
   ```
2. Ensure a webcam is available.
3. (Optional) Prepare `../backend/db.sqlite` with table `students(id INTEGER PRIMARY KEY, name TEXT, encoding BLOB)` and populate encodings (64-bit float numpy arrays).

## Run
```bash
python engine.py
```
Press `q` to exit.

## Encode helper
Start the helper API if you want to encode a still image to store in the DB:
```bash
python encode.py
```
POST JSON `{ "image_path": "/abs/path/to/image.jpg" }` to `http://localhost:5001/encode` to get a base64 encoding.
