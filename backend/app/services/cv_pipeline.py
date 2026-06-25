"""
Preprocess + Two-Stage CV Pipeline:
    Stage 0: HSV yellow threshold + largest-contour crop (sticky trap extraction)
    Stage 1: Full preprocessed image -> best_full.pt (pseudo-label annotations)
    Stage 1.5: Persist/reload annotation dataset from Supabase full_inference_bboxes
    Stage 2: Proprietary 300x300 sliding slicer -> sliced images
    Stage 3: Run best_slice.pt on sliced images
    Final:   DBSCAN merge + map detections back to original image coordinates
"""
from PIL import Image
from supabase import Client, create_client

from app.cv.model import InsectDetector
from app.cv.preprocessing import preprocess_sticky_trap
from app.cv.window_slicer import slice_image_for_inference
from app.cv.clustering import merge_detections_dbscan
from app.core.config import get_settings


class CVPipeline:
    def __init__(self):
        settings = get_settings()
        # Stage 1: Full-image model (coarse/fast)
        self.full_detector = InsectDetector(settings.full_model_path)
        # Stage 2: Slice-level model (fine/precise)
        self.slice_detector = InsectDetector(settings.slice_model_path)

        # Sliding-window scan parameters (explicitly fixed by product requirements)
        self.window_size = 300
        # Keep overlap so insects cut by one window can be fully captured by another.
        overlap = max(0.0, min(0.9, float(settings.overlap_ratio)))
        self.window_stride = max(1, int(self.window_size * (1.0 - overlap)))

        # Slice model input size (model expects square 640x640)
        self.slice_model_input_size = max(settings.slice_width, settings.slice_height)

        self.dbscan_eps = settings.dbscan_eps
        self.dbscan_min_samples = settings.dbscan_min_samples
        self.debug_slicing = bool(settings.debug_slicing)
        self._stage1_annotation_store: dict | None = None
        self._supabase: Client | None = self._init_supabase_client()

    def _init_supabase_client(self) -> Client | None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_key:
            print("[Pipeline] Supabase credentials not configured; Stage-1 bbox persistence is disabled.")
            return None
        try:
            return create_client(settings.supabase_url, settings.supabase_key)
        except Exception as exc:
            print(f"[Pipeline] Failed to initialize Supabase client: {exc}")
            return None

    @staticmethod
    def _shift_det_to_original(det: dict, offset_x: int, offset_y: int) -> dict:
        shifted = det.copy()
        x1, y1, x2, y2 = shifted["bbox"]
        shifted["bbox"] = [x1 + offset_x, y1 + offset_y, x2 + offset_x, y2 + offset_y]
        return shifted

    @staticmethod
    def _serialize_det(det: dict) -> dict:
        return {
            "bbox": [float(v) for v in det["bbox"]],
            "confidence": float(det["confidence"]),
            "class_name": str(det["class_name"]),
        }

    @staticmethod
    def _clip_xyxy_to_image(
        bbox: list[float],
        image_width: int,
        image_height: int,
    ) -> list[float] | None:
        x1 = max(0.0, min(float(image_width), float(bbox[0])))
        y1 = max(0.0, min(float(image_height), float(bbox[1])))
        x2 = max(0.0, min(float(image_width), float(bbox[2])))
        y2 = max(0.0, min(float(image_height), float(bbox[3])))
        if x2 <= x1 or y2 <= y1:
            return None
        return [x1, y1, x2, y2]

    @classmethod
    def _to_annotation_entry(
        cls,
        det: dict,
        image_width: int,
        image_height: int,
    ) -> dict | None:
        """Normalize detection dict to a structured annotation record."""
        clipped = cls._clip_xyxy_to_image(det["bbox"], image_width, image_height)
        if clipped is None:
            return None

        x1, y1, x2, y2 = clipped
        w = x2 - x1
        h = y2 - y1
        return {
            "bbox": [x1, y1, x2, y2],
            "xmin": x1,
            "ymin": y1,
            "xmax": x2,
            "ymax": y2,
            "x_center": x1 + (w / 2.0),
            "y_center": y1 + (h / 2.0),
            "width": w,
            "height": h,
            "class_name": str(det["class_name"]),
            "confidence": float(det["confidence"]),
        }

    def _save_stage1_annotation_store(
        self,
        annotations: list[dict],
        image_width: int,
        image_height: int,
    ) -> dict:
        """Persist the latest Stage-1 annotation dataset in process memory."""
        self._stage1_annotation_store = {
            "store_type": "in_memory_persistent_state",
            "image_width": int(image_width),
            "image_height": int(image_height),
            "count": len(annotations),
            "annotations": annotations,
        }
        return self._stage1_annotation_store

    def _persist_stage1_annotations_to_supabase(
        self,
        trap_image_id: str,
        annotations: list[dict],
        image_width: int,
        image_height: int,
    ) -> bool:
        if self._supabase is None:
            return False

        try:
            self._supabase.table("full_inference_bboxes").delete().eq("trap_image_id", trap_image_id).execute()

            rows = []
            for ann in annotations:
                x1 = float(ann["xmin"])
                y1 = float(ann["ymin"])
                w = float(ann["width"])
                h = float(ann["height"])
                if w <= 0.0 or h <= 0.0:
                    continue

                rows.append({
                    "trap_image_id": trap_image_id,
                    "class_name": str(ann["class_name"]),
                    "confidence": float(ann["confidence"]),
                    "bbox_x": x1,
                    "bbox_y": y1,
                    "bbox_w": w,
                    "bbox_h": h,
                    "source_image_width": int(image_width),
                    "source_image_height": int(image_height),
                    "model_name": "best_full.pt",
                })

            if rows:
                self._supabase.table("full_inference_bboxes").insert(rows).execute()

            return True
        except Exception as exc:
            print(f"[Pipeline] Failed to persist Stage-1 bboxes to Supabase: {exc}")
            return False

    def _load_stage1_annotations_from_supabase(
        self,
        trap_image_id: str,
        image_width: int,
        image_height: int,
    ) -> list[dict]:
        if self._supabase is None:
            return []

        try:
            response = (
                self._supabase
                .table("full_inference_bboxes")
                .select("bbox_x, bbox_y, bbox_w, bbox_h, class_name, confidence, source_image_width, source_image_height")
                .eq("trap_image_id", trap_image_id)
                .order("created_at")
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            print(f"[Pipeline] Failed to load Stage-1 bboxes from Supabase: {exc}")
            return []

        annotations: list[dict] = []
        for row in rows:
            x1 = float(row["bbox_x"])
            y1 = float(row["bbox_y"])
            w = float(row["bbox_w"])
            h = float(row["bbox_h"])
            if w <= 0.0 or h <= 0.0:
                continue

            row_img_w = int(row.get("source_image_width") or image_width)
            row_img_h = int(row.get("source_image_height") or image_height)
            x2 = x1 + w
            y2 = y1 + h

            clipped = self._clip_xyxy_to_image([x1, y1, x2, y2], row_img_w, row_img_h)
            if clipped is None:
                continue

            x1, y1, x2, y2 = clipped
            w = x2 - x1
            h = y2 - y1
            annotations.append({
                "bbox": [x1, y1, x2, y2],
                "xmin": x1,
                "ymin": y1,
                "xmax": x2,
                "ymax": y2,
                "x_center": x1 + (w / 2.0),
                "y_center": y1 + (h / 2.0),
                "width": w,
                "height": h,
                "class_name": str(row["class_name"]),
                "confidence": float(row["confidence"]),
            })

        return annotations

    @staticmethod
    def _build_scan_path(
        image_width: int,
        image_height: int,
        window_size: int,
        step: int,
    ) -> list[dict]:
        x_coords = sorted(list(set(list(range(0, max(1, image_width - window_size), step)) + [max(0, image_width - window_size)])))
        y_coords = sorted(list(set(list(range(0, max(1, image_height - window_size), step)) + [max(0, image_height - window_size)])))

        scan_path: list[dict] = []
        for y in y_coords:
            for x in x_coords:
                crop_x2 = min(image_width, x + window_size)
                crop_y2 = min(image_height, y + window_size)
                scan_path.append({
                    "x": int(x),
                    "y": int(y),
                    "w": int(crop_x2 - x),
                    "h": int(crop_y2 - y),
                })
        return scan_path

    def load(self):
        """Initialize both models on app startup."""
        print("[Pipeline] Loading Stage 1 model (best_full.pt)...")
        self.full_detector.load_model()
        print("[Pipeline] Loading Stage 2 model (best_slice.pt)...")
        self.slice_detector.load_model()

        stage1_ok = self.full_detector.model is not None
        stage2_ok = self.slice_detector.model is not None
        if stage1_ok and stage2_ok:
            print("[Pipeline] Both models loaded successfully.")
        else:
            print(
                "[Pipeline] Model startup status: "
                f"stage1={'ok' if stage1_ok else 'failed'}, "
                f"stage2={'ok' if stage2_ok else 'failed'}."
            )

    def process_image(
        self,
        image: Image.Image,
        conf_threshold_full: float = 0.1,
        conf_threshold_slice: float = 0.1,
        trap_image_id: str = "",
    ) -> dict:
        """
        Full pipeline with mandatory preprocessing and full-coverage slicing.

        Returns: {
            "preprocess": {...},
            "stage1_detections_preprocessed": [...],
            "stage1_detections_original": [...],
            "stage1_annotations_preprocessed": [...],
            "stage1_slicing_annotations": [...],
            "stage1_annotation_store": {...},
            "stage2_detections_preprocessed": [...],
            "stage2_detections_original": [...],
            "stage2_windows": [...],
            "windows_scanned": int,
            "patches_processed": int,
            "sliced_images_processed": int,
        }
        """
        # ── Stage 0: Preprocess image before any slicing/detection ──
        prep = preprocess_sticky_trap(image)
        processed_image = prep.processed_image
        crop_x = prep.crop_box["x"]
        crop_y = prep.crop_box["y"]

        # ── Stage 1: Full-image pseudo-label inference on clean preprocessed image ──
        stage1_input_image = processed_image.copy()
        stage1_pre = self.full_detector.predict(stage1_input_image, conf_threshold=conf_threshold_full)
        stage1_original = [
            self._shift_det_to_original(det, crop_x, crop_y)
            for det in stage1_pre
        ]

        # Explicit temporary annotation store used by the sliding-window stage.
        stage1_annotations_preprocessed = []
        for det in stage1_pre:
            normalized = self._to_annotation_entry(det, processed_image.width, processed_image.height)
            if normalized is not None:
                stage1_annotations_preprocessed.append(normalized)

        stage1_slicing_annotations = stage1_annotations_preprocessed
        stage1_annotation_store_source = "in_memory_runtime_stage1"

        if not trap_image_id:
            raise RuntimeError(
                "trap_image_id is required. Proprietary slicing must use Supabase Stage-1 bbox coordinates."
            )

        if self._supabase is None:
            raise RuntimeError(
                "Supabase is not configured. Cannot run proprietary slicing without Supabase Stage-1 bbox synchronization."
            )

        persisted = self._persist_stage1_annotations_to_supabase(
            trap_image_id,
            stage1_annotations_preprocessed,
            processed_image.width,
            processed_image.height,
        )
        if not persisted:
            raise RuntimeError(
                "Failed to persist Stage-1 bboxes to Supabase. "
                "Cannot continue proprietary slicing without persisted coordinates."
            )

        loaded_reloaded = self._load_stage1_annotations_from_supabase(
            trap_image_id,
            processed_image.width,
            processed_image.height,
        )
        if stage1_annotations_preprocessed and not loaded_reloaded:
            raise RuntimeError(
                "Supabase Stage-1 bbox reload returned empty after persist. "
                "Cannot continue proprietary slicing without synchronized coordinates."
            )

        stage1_slicing_annotations = loaded_reloaded
        stage1_annotation_store_source = "supabase_full_inference_bboxes_reloaded"

        stage1_annotation_store = self._save_stage1_annotation_store(
            stage1_slicing_annotations,
            processed_image.width,
            processed_image.height,
        )
        stage1_annotation_store["source"] = stage1_annotation_store_source
        stage1_annotation_store["trap_image_id"] = trap_image_id

        # ── Stage 2: Proprietary annotation-driven sliding slicer -> sliced images ──
        stage2_scan_path = self._build_scan_path(
            processed_image.width,
            processed_image.height,
            self.window_size,
            self.window_stride,
        )

        slicing_debug: dict = {
            "annotation_source": stage1_annotation_store_source,
            "annotation_count": len(stage1_slicing_annotations),
            "trap_image_id": trap_image_id,
            "using_supabase_map": stage1_annotation_store_source.startswith("supabase_full_inference_bboxes"),
            "scan_order": "row-major",
            "window_size": int(self.window_size),
            "window_stride": int(self.window_stride),
        }
        sliced_images = slice_image_for_inference(
            processed_image,
            window_size=self.window_size,
            step=self.window_stride,
            final_size=self.slice_model_input_size,
            annotations=stage1_slicing_annotations,
            deduplicate_contained=True,
            telemetry=slicing_debug,
            debug=self.debug_slicing,
        )

        if self.debug_slicing and stage1_slicing_annotations and slicing_debug.get("unclaimed_annotations", 0) > 0:
            print(
                "[Pipeline] Unclaimed Stage-1 annotations after slicing: "
                f"{slicing_debug.get('unclaimed_annotations')} / {len(stage1_slicing_annotations)}"
            )

        all_stage2_pre = []
        stage2_windows = []
        stage2_valid_slice_images = []
        patches_processed = 0

        for canvas_img, slice_info in sliced_images:
            window_detections = []
            inside_detections = []
            cut_detections = []
            patches_processed += 1

            patch_img = canvas_img
            if patch_img.size != (self.slice_model_input_size, self.slice_model_input_size):
                patch_img = patch_img.resize((self.slice_model_input_size, self.slice_model_input_size), Image.LANCZOS)

            patch_dets = self.slice_detector.predict(
                patch_img,
                conf_threshold=conf_threshold_slice,
            )

            patch_w, patch_h = patch_img.size
            final_size = float(slice_info["final_size"])
            scale_to_canvas_x = final_size / float(patch_w)
            scale_to_canvas_y = final_size / float(patch_h)

            pad = float(slice_info["pad_offset"])
            content_x1 = pad
            content_y1 = pad
            content_x2 = pad + float(slice_info["crop_w"])
            content_y2 = pad + float(slice_info["crop_h"])

            offset_x = float(slice_info["x"])
            offset_y = float(slice_info["y"])

            for det in patch_dets:
                px1, py1, px2, py2 = det["bbox"]

                # Convert model-space coordinates back to slicer-canvas coordinates.
                fx1 = px1 * scale_to_canvas_x
                fy1 = py1 * scale_to_canvas_y
                fx2 = px2 * scale_to_canvas_x
                fy2 = py2 * scale_to_canvas_y

                fully_inside = (
                    fx1 >= content_x1
                    and fx2 <= content_x2
                    and fy1 >= content_y1
                    and fy2 <= content_y2
                )

                # Keep all detections since window_slicer explicitly pastes intact insects
                # on the padded area (edge handling). The proprietary masking handles duplicates.
                if not fully_inside:
                    # Keep diagnostics for edge detections
                    ix1 = max(fx1, content_x1)
                    iy1 = max(fy1, content_y1)
                    ix2 = min(fx2, content_x2)
                    iy2 = min(fy2, content_y2)
                    if ix2 > ix1 and iy2 > iy1:
                        cut_det = det.copy()
                        cut_det["bbox"] = [
                            ix1 - pad + offset_x,
                            iy1 - pad + offset_y,
                            ix2 - pad + offset_x,
                            iy2 - pad + offset_y,
                        ]
                        cut_detections.append(cut_det)

                remapped_det = det.copy()
                remapped_det["bbox"] = [
                    fx1 - pad + offset_x,
                    fy1 - pad + offset_y,
                    fx2 - pad + offset_x,
                    fy2 - pad + offset_y,
                ]
                all_stage2_pre.append(remapped_det)
                window_detections.append(remapped_det)
                inside_detections.append(remapped_det)

            stage2_windows.append({
                "x": int(slice_info["x"]),
                "y": int(slice_info["y"]),
                "w": int(slice_info["crop_w"]),
                "h": int(slice_info["crop_h"]),
                "pseudo_intersection_count": int(slice_info.get("pseudo_intersection_count", 0)),
                "pseudo_inside_count": int(slice_info.get("pseudo_inside_count", 0)),
                "validation": {
                    "is_valid": len(cut_detections) == 0,
                    "inside_count": len(inside_detections),
                    "cut_count": len(cut_detections),
                },
                "inside_detections": [self._serialize_det(d) for d in inside_detections],
                "cut_detections": [self._serialize_det(d) for d in cut_detections],
                "detections": [self._serialize_det(d) for d in window_detections],
            })

            stage2_valid_slice_images.append({
                "x": int(slice_info["x"]),
                "y": int(slice_info["y"]),
                "w": int(slice_info["crop_w"]),
                "h": int(slice_info["crop_h"]),
                "pseudo_intersection_count": int(slice_info.get("pseudo_intersection_count", 0)),
                "pseudo_inside_count": int(slice_info.get("pseudo_inside_count", 0)),
                "image": canvas_img.copy(),
            })

        # ── Final: Merge on preprocessed space, then map to original ──
        merged_pre = merge_detections_dbscan(
            all_stage2_pre,
            eps=self.dbscan_eps,
            min_samples=self.dbscan_min_samples,
        )

        merged_original = [
            self._shift_det_to_original(det, crop_x, crop_y)
            for det in merged_pre
        ]

        return {
            "preprocess": {
                "contour_found": prep.contour_found,
                "crop_box_original": prep.crop_box,
                "original_size": {
                    "w": prep.original_image.width,
                    "h": prep.original_image.height,
                },
                "processed_size": {
                    "w": prep.processed_image.width,
                    "h": prep.processed_image.height,
                },
                "hsv_image": prep.hsv_image,
                "processed_image": prep.processed_image,
                "mask_image": prep.mask_image,
                "boxed_image": prep.boxed_image,
            },
            "stage1_detections_preprocessed": stage1_pre,
            "stage1_detections_original": stage1_original,
            "stage1_annotations_preprocessed": stage1_annotations_preprocessed,
            "stage1_slicing_annotations": stage1_slicing_annotations,
            "stage1_annotation_store": stage1_annotation_store,
            "stage2_detections_preprocessed": merged_pre,
            "stage2_detections_original": merged_original,
            "windows_scanned": len(stage2_scan_path),
            "patches_processed": patches_processed,
            "sliced_images_processed": patches_processed,
            "stage2_scan_path": stage2_scan_path,
            "stage2_windows": stage2_windows,
            "stage2_valid_slice_images": stage2_valid_slice_images,
            "stage2_slicing_debug": slicing_debug,
        }


# Singleton instance
_pipeline: CVPipeline | None = None


def get_pipeline() -> CVPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = CVPipeline()
        _pipeline.load()
    return _pipeline
