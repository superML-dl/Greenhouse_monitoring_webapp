"""
SAHI / Fixed-size Image Slicing Module.
Pre-processes large trap images into smaller tiles for YOLOv8 inference.
"""
import math
from dataclasses import dataclass


@dataclass
class SliceResult:
    image_bytes: bytes
    x_offset: int
    y_offset: int
    width: int
    height: int


def compute_slices(
    image_width: int,
    image_height: int,
    slice_width: int = 640,
    slice_height: int = 640,
    overlap_ratio: float = 0.2,
) -> list[tuple[int, int, int, int]]:
    """
    Compute (x, y, w, h) slicing coordinates.
    Returns a list of bounding boxes for each slice.
    """
    step_x = int(slice_width * (1 - overlap_ratio))
    step_y = int(slice_height * (1 - overlap_ratio))

    slices = []
    for y in range(0, image_height, step_y):
        for x in range(0, image_width, step_x):
            w = min(slice_width, image_width - x)
            h = min(slice_height, image_height - y)
            slices.append((x, y, w, h))

    return slices


def slice_image(image, slice_width=640, slice_height=640, overlap_ratio=0.2):
    """
    Slice a PIL Image into smaller tiles.
    Returns: list of (cropped_image, x_offset, y_offset)
    """
    width, height = image.size
    coords = compute_slices(width, height, slice_width, slice_height, overlap_ratio)

    tiles = []
    for (x, y, w, h) in coords:
        tile = image.crop((x, y, x + w, y + h))
        tiles.append((tile, x, y))

    return tiles
