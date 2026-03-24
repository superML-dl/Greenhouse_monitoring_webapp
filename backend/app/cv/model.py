"""
YOLOv8 Model loading and inference module.
"""
from pathlib import Path


class InsectDetector:
    def __init__(self, weights_path: str):
        self.weights_path = weights_path
        self.model = None

    def load_model(self):
        """Load YOLOv8 model weights. Call once on startup."""
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.weights_path)
            print(f"Model loaded from {self.weights_path}")
        except Exception as e:
            print(f"Warning: Could not load model from {self.weights_path}: {e}")
            print("Model inference will be unavailable until weights are provided.")
            self.model = None

    def predict(self, image, conf_threshold: float = 0.25):
        """
        Run inference on a single image (PIL Image or numpy array).
        Returns list of detections: [{"bbox": [x1,y1,x2,y2], "confidence": float, "class_name": str}]
        """
        if self.model is None:
            return []

        results = self.model.predict(source=image, conf=conf_threshold, verbose=False)

        detections = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = self.model.names.get(cls_id, f"class_{cls_id}")
                detections.append({
                    "bbox": xyxy,  # [x1, y1, x2, y2]
                    "confidence": conf,
                    "class_name": cls_name,
                })

        return detections
