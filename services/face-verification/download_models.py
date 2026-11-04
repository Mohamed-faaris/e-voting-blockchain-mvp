from pathlib import Path
from urllib.request import urlretrieve

MODELS = {
    "face_detection_yunet_2023mar.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    "face_recognition_sface_2021dec.onnx": "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

for filename, url in MODELS.items():
    destination = MODEL_DIR / filename
    if destination.exists() and destination.stat().st_size > 100_000:
        print(f"Already present: {destination}")
        continue
    print(f"Downloading {filename}...")
    urlretrieve(url, destination)
    if destination.stat().st_size < 100_000:
        destination.unlink(missing_ok=True)
        raise RuntimeError(f"Downloaded model looks incomplete: {filename}")
    print(f"Saved {destination}")
