"""
YOLOv8 Model loading and inference module.
"""

import gc
from pathlib import Path

class InsectDetector:
    def __init__(self, weights_path: str):
        self.weights_path = weights_path
        self.model = None
        self._class_names: dict | None = None

    def load_model(self):
        """Load YOLOv8 model weights. Call once on startup."""
        try:
            from ultralytics import YOLO

            self.model = YOLO(self.weights_path)
            # Cache class names so we can access them even after model prediction
            if self.model and hasattr(self.model, 'names'):
                self._class_names = dict(self.model.names)
            print(f"Model loaded from {self.weights_path}")
        except Exception as e:
            err = str(e)
            model_path = Path(self.weights_path)

            # Some older .pt checkpoints reference an old ultralytics OpenVINO module path.
            # If that import path no longer exists, prefer sibling .onnx exports when present.
            if (
                "ultralytics.nn.backends.openvino" in err
                and model_path.suffix.lower() == ".pt"
            ):
                fallback_path = model_path.with_suffix(".onnx")
                if fallback_path.exists():
                    try:
                        from ultralytics import YOLO

                        self.model = YOLO(str(fallback_path))
                        self.weights_path = str(fallback_path)
                        if self.model and hasattr(self.model, 'names'):
                            self._class_names = dict(self.model.names)
                        print(
                            "Warning: .pt checkpoint is incompatible with current ultralytics "
                            f"({e}). Falling back to {fallback_path}."
                        )
                        return
                    except Exception as fallback_error:
                        print(
                            f"Warning: Could not load fallback ONNX model {fallback_path}: "
                            f"{fallback_error}"
                        )

            print(f"Warning: Could not load model from {self.weights_path}: {e}")
            print("Model inference will be unavailable until weights are provided.")
            self.model = None

    def unload_model(self):
        """Release model from memory. Useful on memory-constrained environments."""
        if self.model is not None:
            del self.model
            self.model = None
            gc.collect()

    def predict(self, image, conf_threshold: float = 0.1):
        """
        Run inference on a single image (PIL Image or numpy array).
        Returns list of detections: [{"bbox": [x1,y1,x2,y2], "confidence": float, "class_name": str}]
        """
        if self.model is None:
            return []

        results = self.model.predict(source=image, conf=conf_threshold, verbose=False)

        detections = []
        names = self._class_names or (self.model.names if self.model else {})
        for result in results:
            boxes = result.boxes
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name = names.get(cls_id, f"class_{cls_id}")
                detections.append({
                    "bbox": xyxy,  # [x1, y1, x2, y2]
                    "confidence": conf,
                    "class_name": cls_name,
                })

        # Free prediction results to reduce peak memory
        del results
        gc.collect()

        return detections
