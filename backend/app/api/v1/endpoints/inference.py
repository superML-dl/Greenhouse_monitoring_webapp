"""
Inference API endpoints.
Two-stage pipeline: full model → window slicer → slice model → merged results.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from PIL import Image
import io

from app.services.cv_pipeline import get_pipeline
from app.core.config import get_settings

router = APIRouter()


@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    conf_threshold_full: float = Query(default=0.25, ge=0.0, le=1.0),
    conf_threshold_slice: float = Query(default=0.25, ge=0.0, le=1.0),
):
    """
    Accept an image upload and run the two-stage CV pipeline:
      Stage 1: best_full.pt on full image → pseudo-labels
      Stage 2: window_slicer crops → best_slice.pt → refined detections
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
    result = pipeline.process_image(
        image,
        conf_threshold_full=conf_threshold_full,
        conf_threshold_slice=conf_threshold_slice,
    )

    # Format Stage 1 (pseudo-labels)
    stage1_results = []
    for det in result["stage1_detections"]:
        x1, y1, x2, y2 = det["bbox"]
        stage1_results.append({
            "species_name": det["class_name"],
            "confidence": round(det["confidence"], 4),
            "bbox_x": round(x1, 2),
            "bbox_y": round(y1, 2),
            "bbox_w": round(x2 - x1, 2),
            "bbox_h": round(y2 - y1, 2),
        })

    # Format Stage 2 (final detections)
    stage2_results = []
    for det in result["stage2_detections"]:
        x1, y1, x2, y2 = det["bbox"]
        stage2_results.append({
            "species_name": det["class_name"],
            "confidence": round(det["confidence"], 4),
            "bbox_x": round(x1, 2),
            "bbox_y": round(y1, 2),
            "bbox_w": round(x2 - x1, 2),
            "bbox_h": round(y2 - y1, 2),
        })

    return {
        "image_width": image.width,
        "image_height": image.height,
        "patches_processed": result["patches_processed"],
        "stage1": {
            "model": "best_full.pt",
            "description": "Pseudo-labels from full-image inference",
            "total_detections": len(stage1_results),
            "detections": stage1_results,
        },
        "stage2": {
            "model": "best_slice.pt",
            "description": "Refined detections from sliced patches (final)",
            "total_detections": len(stage2_results),
            "detections": stage2_results,
        },
    }
