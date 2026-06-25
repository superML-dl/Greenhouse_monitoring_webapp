"""
Image pre-processing for sticky trap extraction:
RGB/BGR -> HSV -> yellow threshold -> largest contour -> crop.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image


@dataclass
class PreprocessResult:
    original_image: Image.Image
    processed_image: Image.Image
    hsv_image: Image.Image
    mask_image: Image.Image
    boxed_image: Image.Image
    crop_box: dict
    contour_found: bool


def _to_uint8_rgb(image: Image.Image) -> np.ndarray:
    return np.array(image.convert('RGB'), dtype=np.uint8)


def preprocess_sticky_trap(image: Image.Image) -> PreprocessResult:
    """
    Sticky-trap preprocessing algorithm:
      1) RGB/BGR -> HSV
      2) Yellow threshold mask
      3) Find largest contour
      4) Crop by contour bounding rectangle

    Fallback: if no contour is found, keep original image.
    """
    original_rgb = _to_uint8_rgb(image)
    original_h, original_w = original_rgb.shape[:2]

    # OpenCV uses BGR by default.
    bgr = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

    lower_yellow = np.array([20, 100, 100], dtype=np.uint8)
    upper_yellow = np.array([40, 255, 255], dtype=np.uint8)
    mask = cv2.inRange(hsv, lower_yellow, upper_yellow)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    contour_found = len(contours) > 0
    if contour_found:
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
    else:
        x, y, w, h = 0, 0, original_w, original_h

    boxed = bgr.copy()
    cv2.rectangle(boxed, (x, y), (x + w, y + h), (0, 0, 255), 2)

    cropped = bgr[y:y + h, x:x + w]

    # Convert previews back to RGB for PIL serialization/transport.
    hsv_bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    mask_rgb = cv2.cvtColor(mask, cv2.COLOR_GRAY2RGB)

    return PreprocessResult(
        original_image=Image.fromarray(original_rgb),
        processed_image=Image.fromarray(cv2.cvtColor(cropped, cv2.COLOR_BGR2RGB)),
        hsv_image=Image.fromarray(cv2.cvtColor(hsv_bgr, cv2.COLOR_BGR2RGB)),
        mask_image=Image.fromarray(mask_rgb),
        boxed_image=Image.fromarray(cv2.cvtColor(boxed, cv2.COLOR_BGR2RGB)),
        crop_box={
            'x': int(x),
            'y': int(y),
            'w': int(w),
            'h': int(h),
        },
        contour_found=contour_found,
    )
