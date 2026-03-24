"""
Window Slicer Module.
Slices regions of interest (from full-model pseudo-labels) into fixed-size patches
for the second-stage slice model inference.
"""
from PIL import Image


def slice_around_detections(
    image: Image.Image,
    detections: list[dict],
    patch_size: int = 640,
    padding: float = 0.2,
) -> list[tuple[Image.Image, int, int, dict]]:
    """
    For each detection from the full model, crop a patch centered on the detection.
    This creates focused windows around pseudo-labeled regions.
    
    Args:
        image: Full original PIL Image
        detections: List of dicts from Stage 1, each having {"bbox": [x1,y1,x2,y2], ...}
        patch_size: Target patch dimension (square)
        padding: Extra padding ratio around each detection box
    
    Returns:
        List of (cropped_image, x_offset, y_offset, original_detection)
    """
    img_w, img_h = image.size
    patches = []

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        det_w = x2 - x1
        det_h = y2 - y1

        # Center of detection
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2

        # Determine crop size: at least patch_size, or the detection box + padding
        crop_w = max(patch_size, det_w * (1 + padding * 2))
        crop_h = max(patch_size, det_h * (1 + padding * 2))

        # Compute crop bounds centered on detection
        crop_x1 = max(0, int(cx - crop_w / 2))
        crop_y1 = max(0, int(cy - crop_h / 2))
        crop_x2 = min(img_w, int(cx + crop_w / 2))
        crop_y2 = min(img_h, int(cy + crop_h / 2))

        # Crop the patch
        patch = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))

        # Resize to patch_size if needed for consistent model input
        if patch.size[0] != patch_size or patch.size[1] != patch_size:
            # Store original crop dimensions for bbox remapping
            patch = patch.resize((patch_size, patch_size), Image.LANCZOS)

        patches.append((patch, crop_x1, crop_y1, {
            "crop_w": crop_x2 - crop_x1,
            "crop_h": crop_y2 - crop_y1,
            "original_detection": det,
        }))

    return patches


def slice_full_image(
    image: Image.Image,
    slice_width: int = 300,
    slice_height: int = 300,
    overlap_ratio: float = 0.2,
) -> list[tuple[Image.Image, int, int]]:
    """
    Fallback: Slice the entire image into a grid of fixed-size tiles
    (used when no detections from Stage 1, or as an alternative approach).
    
    Returns: list of (cropped_image, x_offset, y_offset)
    """
    width, height = image.size
    step_x = int(slice_width * (1 - overlap_ratio))
    step_y = int(slice_height * (1 - overlap_ratio))

    tiles = []
    for y in range(0, height, step_y):
        for x in range(0, width, step_x):
            w = min(slice_width, width - x)
            h = min(slice_height, height - y)
            tile = image.crop((x, y, x + w, y + h))
            tiles.append((tile, x, y))

    return tiles
