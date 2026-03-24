"""
Two-Stage CV Pipeline:
  Stage 1: Full image → best_full.pt → pseudo-labels (coarse detections)
  Stage 2: Window slicer crops patches around pseudo-labels → best_slice.pt → refined detections
  Final:   DBSCAN merge to deduplicate overlapping detections
"""
from PIL import Image

from app.cv.model import InsectDetector
from app.cv.window_slicer import slice_around_detections, slice_full_image
from app.cv.clustering import merge_detections_dbscan
from app.core.config import get_settings


class CVPipeline:
    def __init__(self):
        settings = get_settings()
        # Stage 1: Full-image model (coarse/fast)
        self.full_detector = InsectDetector(settings.full_model_path)
        # Stage 2: Slice-level model (fine/precise)
        self.slice_detector = InsectDetector(settings.slice_model_path)

        self.slice_width = settings.slice_width
        self.slice_height = settings.slice_height
        self.overlap_ratio = settings.overlap_ratio
        self.dbscan_eps = settings.dbscan_eps
        self.dbscan_min_samples = settings.dbscan_min_samples

    def load(self):
        """Initialize both models on app startup."""
        print("[Pipeline] Loading Stage 1 model (best_full.pt)...")
        self.full_detector.load_model()
        print("[Pipeline] Loading Stage 2 model (best_slice.pt)...")
        self.slice_detector.load_model()
        print("[Pipeline] Both models loaded successfully.")

    def process_image(
        self,
        image: Image.Image,
        conf_threshold_full: float = 0.25,
        conf_threshold_slice: float = 0.25,
    ) -> dict:
        """
        Full two-stage pipeline:
          1. Run best_full.pt on the full image → pseudo-labels
          2. Crop patches around each pseudo-label using window_slicer
          3. Run best_slice.pt on each patch → refined detections
          4. Remap patch-level bboxes back to original image coordinates
          5. DBSCAN merge to deduplicate

        Returns: {
            "stage1_detections": [...],  # Pseudo-labels from full model
            "stage2_detections": [...],  # Final refined detections
            "patches_processed": int,
        }
        """
        # ── Stage 1: Full-image inference ──
        stage1_dets = self.full_detector.predict(image, conf_threshold=conf_threshold_full)

        # ── Stage 2: Window slicing + slice-model inference ──
        all_stage2_dets = []
        patches_processed = 0

        if stage1_dets:
            # Crop patches centered on each Stage 1 detection
            patches = slice_around_detections(
                image,
                stage1_dets,
                patch_size=self.slice_width,
            )

            for patch_img, x_offset, y_offset, meta in patches:
                patches_processed += 1
                patch_dets = self.slice_detector.predict(
                    patch_img, conf_threshold=conf_threshold_slice
                )

                crop_w = meta["crop_w"]
                crop_h = meta["crop_h"]
                patch_w, patch_h = patch_img.size

                # Remap bboxes from patch coordinates to original image coordinates
                for det in patch_dets:
                    px1, py1, px2, py2 = det["bbox"]

                    # Scale factor: patch was resized from (crop_w, crop_h) to (patch_w, patch_h)
                    scale_x = crop_w / patch_w
                    scale_y = crop_h / patch_h

                    det["bbox"] = [
                        px1 * scale_x + x_offset,
                        py1 * scale_y + y_offset,
                        px2 * scale_x + x_offset,
                        py2 * scale_y + y_offset,
                    ]
                    all_stage2_dets.append(det)
        else:
            # No Stage 1 detections → fallback to grid slicing
            tiles = slice_full_image(
                image,
                slice_width=self.slice_width,
                slice_height=self.slice_height,
                overlap_ratio=self.overlap_ratio,
            )
            for tile_img, x_offset, y_offset in tiles:
                patches_processed += 1
                tile_dets = self.slice_detector.predict(
                    tile_img, conf_threshold=conf_threshold_slice
                )
                for det in tile_dets:
                    x1, y1, x2, y2 = det["bbox"]
                    det["bbox"] = [
                        x1 + x_offset,
                        y1 + y_offset,
                        x2 + x_offset,
                        y2 + y_offset,
                    ]
                    all_stage2_dets.append(det)

        # ── Stage 3: DBSCAN merge ──
        merged = merge_detections_dbscan(
            all_stage2_dets,
            eps=self.dbscan_eps,
            min_samples=self.dbscan_min_samples,
        )

        return {
            "stage1_detections": stage1_dets,
            "stage2_detections": merged,
            "patches_processed": patches_processed,
        }


# Singleton instance
_pipeline: CVPipeline | None = None


def get_pipeline() -> CVPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = CVPipeline()
        _pipeline.load()
    return _pipeline
