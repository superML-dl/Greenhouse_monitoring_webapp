"""
Inference API endpoints.
Preprocess + multi-stage pipeline with visual timeline metadata.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from PIL import Image
import io
import base64

from app.services.cv_pipeline import get_pipeline
from app.core.config import get_settings

router = APIRouter()


def _format_detection(det: dict) -> dict:
    x1, y1, x2, y2 = det["bbox"]
    return {
        "species_name": det["class_name"],
        "confidence": round(float(det["confidence"]), 4),
        "bbox_x": round(float(x1), 2),
        "bbox_y": round(float(y1), 2),
        "bbox_w": round(float(x2 - x1), 2),
        "bbox_h": round(float(y2 - y1), 2),
    }


def _pil_to_data_url(image: Image.Image, fmt: str = "PNG", quality: int = 90) -> str:
    buf = io.BytesIO()
    save_kwargs = {}
    normalized = fmt.upper()
    if normalized == "JPEG":
        save_kwargs["quality"] = int(max(1, min(95, quality)))
        save_kwargs["optimize"] = True

    image.save(buf, format=normalized, **save_kwargs)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    mime = "image/jpeg" if normalized == "JPEG" else "image/png"
    return f"data:{mime};base64,{encoded}"


@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    trap_image_id: str = Query(..., min_length=1),
    conf_threshold_full: float = Query(default=0.25, ge=0.0, le=1.0),
    conf_threshold_slice: float = Query(default=0.25, ge=0.0, le=1.0),
):
    """
    Accept an image upload and run the two-stage CV pipeline:
            Stage 1: best_full.pt on full image → pseudo-label annotations (saved)
            Stage 2: proprietary slicer (sourced from full_inference_bboxes) → sliced images
            Stage 3: best_slice.pt on sliced images → refined detections
      Final:   DBSCAN merge

    Returns both stage1 (pseudo-labels) and stage2 (final) detections.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        contents = await file.read()
        settings = get_settings()
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(contents) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large. Max size is {settings.max_upload_size_mb} MB.",
            )
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {e}")

    pipeline = get_pipeline()
    try:
        result = pipeline.process_image(
            image,
            conf_threshold_full=conf_threshold_full,
            conf_threshold_slice=conf_threshold_slice,
            trap_image_id=trap_image_id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference pipeline failure: {exc}")

    preprocess = result["preprocess"]

    # Stage 1 pseudo labels on preprocessed image
    stage1_results_preprocessed = [
        _format_detection(det)
        for det in result["stage1_detections_preprocessed"]
    ]
    stage1_annotations_preprocessed = result.get("stage1_annotations_preprocessed", [])
    stage1_slicing_annotations = result.get("stage1_slicing_annotations", stage1_annotations_preprocessed)
    stage1_annotation_store = result.get("stage1_annotation_store", {})
    stage2_scan_path_raw = result.get("stage2_scan_path", [])
    stage2_slicing_debug = result.get("stage2_slicing_debug", {}) or {}

    # Stage 2 final detections (preprocessed and original spaces)
    stage2_results_preprocessed = [
        _format_detection(det)
        for det in result["stage2_detections_preprocessed"]
    ]
    stage2_results_original = [
        _format_detection(det)
        for det in result["stage2_detections_original"]
    ]

    # Stage 2 sliding windows metadata
    stage2_windows = []
    stage2_window_by_coord: dict[str, dict] = {}
    for idx, window in enumerate(result.get("stage2_windows", []), start=1):
        window_detections = [_format_detection(det) for det in window.get("detections", [])]
        inside_detections = [_format_detection(det) for det in window.get("inside_detections", [])]
        cut_detections = [_format_detection(det) for det in window.get("cut_detections", [])]

        payload = {
            "window_id": idx,
            "bbox_x": round(window["x"], 2),
            "bbox_y": round(window["y"], 2),
            "bbox_w": round(window["w"], 2),
            "bbox_h": round(window["h"], 2),
            "pseudo_intersection_count": int(window.get("pseudo_intersection_count", 0)),
            "pseudo_inside_count": int(window.get("pseudo_inside_count", 0)),
            "validation": window.get("validation", {}),
            "inside_detections": inside_detections,
            "cut_detections": cut_detections,
            "total_detections": len(window_detections),
            "detections": window_detections,
        }
        stage2_windows.append(payload)
        stage2_window_by_coord[f"{int(window['x'])}:{int(window['y'])}"] = payload

    stage2_scan_path = []
    for idx, step in enumerate(stage2_scan_path_raw, start=1):
        stage2_scan_path.append({
            "window_id": idx,
            "bbox_x": int(step.get("x", 0)),
            "bbox_y": int(step.get("y", 0)),
            "bbox_w": int(step.get("w", 0)),
            "bbox_h": int(step.get("h", 0)),
        })

    stage2_valid_slices = []
    for idx, valid_slice in enumerate(result.get("stage2_valid_slice_images", []), start=1):
        x = int(valid_slice.get("x", 0))
        y = int(valid_slice.get("y", 0))
        w = int(valid_slice.get("w", 0))
        h = int(valid_slice.get("h", 0))
        window_payload = stage2_window_by_coord.get(f"{x}:{y}")
        stage2_valid_slices.append({
            "slice_id": idx,
            "bbox_x": x,
            "bbox_y": y,
            "bbox_w": w,
            "bbox_h": h,
            "pseudo_intersection_count": int(valid_slice.get("pseudo_intersection_count", 0)),
            "pseudo_inside_count": int(valid_slice.get("pseudo_inside_count", 0)),
            "total_detections": int(window_payload.get("total_detections", 0)) if window_payload else 0,
            "detections": window_payload.get("detections", []) if window_payload else [],
            "image_data_url": _pil_to_data_url(valid_slice["image"], fmt="JPEG", quality=82),
        })

    return {
        "image_width": preprocess["processed_size"]["w"],
        "image_height": preprocess["processed_size"]["h"],
        "original_image_width": preprocess["original_size"]["w"],
        "original_image_height": preprocess["original_size"]["h"],
        "windows_scanned": result["windows_scanned"],
        "patches_processed": result["patches_processed"],
        "sliced_images_processed": result.get("sliced_images_processed", result["patches_processed"]),
        "preprocess": {
            "contour_found": preprocess["contour_found"],
            "crop_box_original": preprocess["crop_box_original"],
            "original_size": preprocess["original_size"],
            "processed_size": preprocess["processed_size"],
            "hsv_image_data_url": _pil_to_data_url(preprocess["hsv_image"]),
            "processed_image_data_url": _pil_to_data_url(preprocess["processed_image"]),
            "mask_image_data_url": _pil_to_data_url(preprocess["mask_image"]),
            "boxed_image_data_url": _pil_to_data_url(preprocess["boxed_image"]),
        },
        "stage1": {
            "model": "best_full.pt",
            "description": "Pseudo-labels from full-image inference on preprocessed image",
            "coordinate_space": "preprocessed",
            "total_detections": len(stage1_results_preprocessed),
            "detections": stage1_results_preprocessed,
            "annotation_format": "xyxy + xywh + class_name + confidence",
            "annotations": stage1_annotations_preprocessed,
            "slicing_annotations": stage1_slicing_annotations,
            "annotation_store": stage1_annotation_store,
        },
        "stage2": {
            "model": "best_slice.pt",
            "description": "Refined detections from proprietary annotation-guided sliced images",
            "coordinate_space_final": "original",
            "coordinate_space_visual": "preprocessed",
            "total_detections": len(stage2_results_original),
            "total_windows": len(stage2_scan_path),
            "processed_windows": len(stage2_windows),
            "total_valid_slices": len(stage2_valid_slices),
            "scan_path": stage2_scan_path,
            "windows": stage2_windows,
            "sliced_images": stage2_valid_slices,
            "valid_slices": stage2_valid_slices,
            "slicing_debug": stage2_slicing_debug,
            "detections_preprocessed": stage2_results_preprocessed,
            "detections": stage2_results_original,
        },
    }
