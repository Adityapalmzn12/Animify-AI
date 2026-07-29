from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _has_mediapipe() -> bool:
    try:
        import mediapipe  # noqa: F401
        import cv2  # noqa: F401
        import numpy  # noqa: F401

        return True
    except ImportError:
        return False


def enhance_faces_in_frames(frames_dir: Path) -> int:
    """
    Lightweight OSS face enhancement using MediaPipe Face Detection +
    local contrast / bilateral smoothing on face ROIs.
    Returns number of frames touched.
    """
    if not _has_mediapipe():
        logger.warning("mediapipe/cv2 not installed; skip face enhance")
        return 0

    import cv2
    import mediapipe as mp

    detector = mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.5,
    )
    touched = 0
    for frame_path in sorted(frames_dir.glob("frame_*.png")):
        img = cv2.imread(str(frame_path))
        if img is None:
            continue
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = detector.process(rgb)
        if not result.detections:
            continue
        h, w = img.shape[:2]
        for det in result.detections:
            box = det.location_data.relative_bounding_box
            x1 = max(0, int(box.xmin * w))
            y1 = max(0, int(box.ymin * h))
            x2 = min(w, int((box.xmin + box.width) * w))
            y2 = min(h, int((box.ymin + box.height) * h))
            if x2 <= x1 or y2 <= y1:
                continue
            roi = img[y1:y2, x1:x2]
            smooth = cv2.bilateralFilter(roi, 9, 75, 75)
            lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l2 = clahe.apply(l)
            enhanced = cv2.cvtColor(cv2.merge([l2, a, b]), cv2.COLOR_LAB2BGR)
            img[y1:y2, x1:x2] = enhanced
            touched += 1
        cv2.imwrite(str(frame_path), img)
    detector.close()
    return touched


def soft_background_blur(frames_dir: Path, strength: float = 0.35) -> int:
    """
    CPU stand-in for background removal: MediaPipe selfie segmentation
    keeps the person sharp and gently blurs the background.
    """
    if not _has_mediapipe():
        logger.warning("mediapipe/cv2 not installed; skip background soft-blur")
        return 0

    import cv2
    import mediapipe as mp
    import numpy as np

    segmenter = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
    count = 0
    for frame_path in sorted(frames_dir.glob("frame_*.png")):
        img = cv2.imread(str(frame_path))
        if img is None:
            continue
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = segmenter.process(rgb)
        if result.segmentation_mask is None:
            continue
        mask = result.segmentation_mask
        mask3 = np.stack([mask] * 3, axis=-1)
        blurred = cv2.GaussianBlur(img, (31, 31), 0)
        out = (img * mask3 + blurred * (1.0 - mask3)).astype(np.uint8)
        cv2.imwrite(str(frame_path), out)
        count += 1
    segmenter.close()
    return count
