"""Proprietary annotation-guided window slicer for backend inference.

Exact port of the reference window_slicerrr.py logic:
  1. Slide a 300x300 window across the image.
  2. Skip windows with 0 intersecting bounding boxes.
  3. Map each window region to a 640x640 padded canvas.
  4. For each intersecting box:
     - Fully contained AND not claimed → keep (pristine paste), mark claimed.
     - NOT fully contained OR already claimed → mask with yellow rectangle.
  5. Only save canvases that claimed at least one new box.
"""
from PIL import Image, ImageDraw

# Helper functions 

def _get_dominant_color(image: Image.Image) -> tuple:
    """Return the dominant (average) color by resizing to 1x1.
    Used to fill canvas padding so it blends with the image background."""
    img_1x1 = image.resize((1, 1), Image.Resampling.LANCZOS)
    return img_1x1.getpixel((0, 0))


def _boxes_intersect(box_a, box_b) -> bool:
    """Check if two [xmin, ymin, xmax, ymax] boxes intersect.
    Matches reference: strict < / > (not <= / >=)."""
    return not (
        box_a[2] <= box_b[0]
        or box_a[0] >= box_b[2]
        or box_a[3] <= box_b[1]
        or box_a[1] >= box_b[3]
    )


def _is_box_fully_contained_in_canvas(
    bbox, window_box, window_size: int, final_size: int
) -> bool:
    """Check whether bbox, after being shifted onto the padded canvas,
    lies entirely within the [0, 0, final_size, final_size] boundary.

    This is the EXACT check from the reference:
        pad_offset = (final_size - window_size) // 2
        final_x = (bbox[0] - window_box[0]) + pad_offset
        final_y = (bbox[1] - window_box[1]) + pad_offset
        → final_x >= 0 and final_y >= 0
          and final_x + bbox_w <= final_size
          and final_y + bbox_h <= final_size
    """
    pad_offset = (final_size - window_size) // 2
    bbox_w = float(bbox[2]) - float(bbox[0])
    bbox_h = float(bbox[3]) - float(bbox[1])
    final_x = (float(bbox[0]) - float(window_box[0])) + pad_offset
    final_y = (float(bbox[1]) - float(window_box[1])) + pad_offset
    return (
        final_x >= 0
        and final_y >= 0
        and final_x + bbox_w <= final_size
        and final_y + bbox_h <= final_size
    )


def _map_box_to_canvas(bbox, window_x: float, window_y: float, pad_offset: float):
    """Translate a bbox from image coordinates to canvas coordinates."""
    return [
        float(bbox[0]) - window_x + pad_offset,
        float(bbox[1]) - window_y + pad_offset,
        float(bbox[2]) - window_x + pad_offset,
        float(bbox[3]) - window_y + pad_offset,
    ]


def _clip_box_to_image_bounds(box, image_width: int, image_height: int):
    """Clip a box to image boundaries, return None if degenerate."""
    left = max(0.0, min(float(image_width), float(box[0])))
    top = max(0.0, min(float(image_height), float(box[1])))
    right = max(0.0, min(float(image_width), float(box[2])))
    bottom = max(0.0, min(float(image_height), float(box[3])))
    if right <= left or bottom <= top:
        return None
    return [left, top, right, bottom]


def _annotation_to_xyxy(annotation: dict, image_width: int, image_height: int):
    """Convert supported annotation formats into [xmin, ymin, xmax, ymax].

    Supported schemas:
      - {"bbox": [xmin, ymin, xmax, ymax], ...}
      - {"xmin": ..., "ymin": ..., "xmax": ..., "ymax": ..., ...}
      - {"x_center": ..., "y_center": ..., "width": ..., "height": ..., ...}
        (absolute pixels or YOLO-normalized in [0,1])
    """
    if not isinstance(annotation, dict):
        return None

    if "bbox" in annotation:
        bbox = annotation.get("bbox")
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            return [float(v) for v in bbox]
        return None

    if all(k in annotation for k in ("xmin", "ymin", "xmax", "ymax")):
        return [
            float(annotation["xmin"]),
            float(annotation["ymin"]),
            float(annotation["xmax"]),
            float(annotation["ymax"]),
        ]

    if all(k in annotation for k in ("x_center", "y_center", "width", "height")):
        xc = float(annotation["x_center"])
        yc = float(annotation["y_center"])
        w = float(annotation["width"])
        h = float(annotation["height"])

        is_normalized = max(abs(xc), abs(yc), abs(w), abs(h)) <= 1.0
        if is_normalized:
            xc *= float(image_width)
            yc *= float(image_height)
            w *= float(image_width)
            h *= float(image_height)

        return [xc - (w / 2.0), yc - (h / 2.0), xc + (w / 2.0), yc + (h / 2.0)]

    return None


# ---------------------------------------------------------------------------
# Main slicing function
# ---------------------------------------------------------------------------

def slice_image_for_inference(
    image: Image.Image,
    window_size: int = 300,
    step: int = 300,
    final_size: int = 640,
    annotations: list[dict] | None = None,
    deduplicate_contained: bool = True,
    telemetry: dict | None = None,
    debug: bool = False,
) -> list[tuple[Image.Image, dict]]:
    """Deterministic annotation-guided window slicer.

    Exactly replicates the reference window_slicerrr.py logic:

    For each 300x300 window on the grid:
      1. Find ALL annotation boxes that intersect this window
         (including already-claimed ones — they need to be masked).
      2. If 0 intersecting boxes → skip window entirely.
      3. Create a 640x640 canvas with dominant-color padding.
      4. Paste the window crop from background_source onto the canvas center.
      5. For each intersecting box:
         a. Check: is this box 100% contained in the 640x640 canvas?
         b. IF fully contained AND NOT claimed:
            → Paste pristine crop from original image onto canvas.
            → Mark box as claimed globally.
            → Erase box on background_source (fill with dominant color).
         c. IF NOT fully contained OR already claimed:
            → Draw a solid yellow rectangle over the mapped box on canvas.
      6. If at least one NEW box was claimed → save the canvas.
      7. If all boxes are claimed → early stop.

    Returns:
      List of (canvas_image, slice_info_dict) tuples.
    """
    if image.mode != "RGB":
        image = image.convert("RGB")

    original_image = image
    background_source = original_image.copy()
    draw_on_background = ImageDraw.Draw(background_source)

    img_w, img_h = image.size
    if img_w <= 0 or img_h <= 0:
        return []

    # Padding color: dominant color of the image (matches reference).
    padding_color = _get_dominant_color(original_image)
    pad_offset = max(0, (final_size - window_size) // 2)

    # Build sliding window coordinate grid (matches reference exactly).
    x_coords = sorted(list(set(
        list(range(0, max(1, img_w - window_size), step))
        + [max(0, img_w - window_size)]
    )))
    y_coords = sorted(list(set(
        list(range(0, max(1, img_h - window_size), step))
        + [max(0, img_h - window_size)]
    )))

    # Parse annotations into [xmin, ymin, xmax, ymax] boxes.
    annotation_boxes: list[list[float]] = []
    if annotations is not None:
        for ann in annotations:
            box = _annotation_to_xyxy(ann, img_w, img_h)
            if box is None:
                continue
            box = _clip_box_to_image_bounds(box, img_w, img_h)
            if box is None:
                continue
            annotation_boxes.append(box)

    # Global claimed state — one entry per annotation box.
    claimed = [False] * len(annotation_boxes)

    # Telemetry / stats tracking.
    stats = {
        "total_windows": len(x_coords) * len(y_coords),
        "windows_scanned": 0,
        "windows_with_intersection": 0,
        "windows_saved": 0,
        "total_annotations": len(annotation_boxes),
        "intersection_checks": 0,
        "intersections_matched": 0,
        "containment_checks": 0,
        "fully_contained": 0,
        "partial_masks_applied": 0,
        "claimed_annotations": 0,
        "unclaimed_annotations": 0,
        "coverage_ratio": 1.0,
        "early_stop_all_claimed": False,
        "unclaimed_indices_sample": [],
    }

    def _finalize_stats():
        if annotations is not None and deduplicate_contained:
            unclaimed_indices = [i for i, c in enumerate(claimed) if not c]
            stats["unclaimed_annotations"] = len(unclaimed_indices)
            stats["unclaimed_indices_sample"] = [int(i) for i in unclaimed_indices[:20]]
            if len(annotation_boxes) > 0:
                stats["coverage_ratio"] = float(stats["claimed_annotations"]) / float(len(annotation_boxes))
            else:
                stats["coverage_ratio"] = 1.0
        else:
            stats["unclaimed_annotations"] = 0
            stats["coverage_ratio"] = 1.0

        if telemetry is not None:
            telemetry.update(stats)

        if debug:
            print(
                "[Slicer] FINAL STATS: windows=%d scanned=%d intersected=%d saved=%d "
                "ann=%d claimed=%d unclaimed=%d fully_contained=%d masked=%d "
                "coverage=%.3f early_stop=%s"
                % (
                    stats["total_windows"],
                    stats["windows_scanned"],
                    stats["windows_with_intersection"],
                    stats["windows_saved"],
                    stats["total_annotations"],
                    stats["claimed_annotations"],
                    stats["unclaimed_annotations"],
                    stats["fully_contained"],
                    stats["partial_masks_applied"],
                    stats["coverage_ratio"],
                    str(stats["early_stop_all_claimed"]),
                )
            )

    # ----- Main sliding window loop -----
    sliced_images: list[tuple[Image.Image, dict]] = []

    for y in y_coords:
        for x in x_coords:
            stats["windows_scanned"] += 1
            window_box = [x, y, x + window_size, y + window_size]

            if annotations is None:
                # No annotations: process every window (non-annotation mode).
                crop_x2 = min(img_w, x + window_size)
                crop_y2 = min(img_h, y + window_size)
                crop = background_source.crop((x, y, crop_x2, crop_y2))
                crop_w, crop_h = crop.size
                canvas = Image.new("RGB", (final_size, final_size), padding_color)
                canvas.paste(crop, (pad_offset, pad_offset))
                sliced_images.append((canvas, {
                    "x": int(x), "y": int(y),
                    "crop_w": int(crop_w), "crop_h": int(crop_h),
                    "window_size": int(window_size),
                    "final_size": int(final_size),
                    "pad_offset": int(pad_offset),
                    "pseudo_intersection_count": 0,
                    "pseudo_inside_count": 0,
                }))
                stats["windows_saved"] += 1
                continue

            # ── Step 1: Find ALL boxes intersecting this window ──
            # CRITICAL: Include already-claimed boxes — they must be masked.
            intersecting_indices: list[int] = []
            for i, bbox in enumerate(annotation_boxes):
                stats["intersection_checks"] += 1
                if _boxes_intersect(bbox, window_box):
                    intersecting_indices.append(i)

            # ── Step 2: Skip if no intersections ──
            if not intersecting_indices:
                continue

            stats["windows_with_intersection"] += 1
            stats["intersections_matched"] += len(intersecting_indices)

            if debug:
                print(
                    "[Slicer] Found %d intersecting boxes in window [%d, %d]"
                    % (len(intersecting_indices), x, y)
                )

            # ── Step 3: Create 640x640 canvas ──
            crop_x2 = min(img_w, x + window_size)
            crop_y2 = min(img_h, y + window_size)
            crop = background_source.crop((x, y, crop_x2, crop_y2))
            crop_w, crop_h = crop.size

            canvas = Image.new("RGB", (final_size, final_size), padding_color)
            canvas.paste(crop, (pad_offset, pad_offset))
            draw_on_canvas = ImageDraw.Draw(canvas)

            # Track how many NEW boxes are claimed in this window.
            newly_claimed_count = 0

            # ── Step 4: Process each intersecting box ──
            for i in intersecting_indices:
                bbox = annotation_boxes[i]
                stats["containment_checks"] += 1

                # Check: is this box 100% contained within the 640x640 canvas?
                fully_contained = _is_box_fully_contained_in_canvas(
                    bbox, window_box, window_size, final_size
                )
                already_claimed = claimed[i]

                if debug:
                    print(
                        "[Slicer]   Box [%d] fully contained: %s"
                        % (i, str(fully_contained))
                    )
                    print(
                        "[Slicer]   Box [%d] already claimed: %s"
                        % (i, str(already_claimed))
                    )

                if fully_contained and not already_claimed:
                    # ── KEEP: Paste pristine crop, mark claimed ──
                    src_x1 = int(max(0, round(bbox[0])))
                    src_y1 = int(max(0, round(bbox[1])))
                    src_x2 = int(min(img_w, round(bbox[2])))
                    src_y2 = int(min(img_h, round(bbox[3])))
                    pristine_crop = original_image.crop((src_x1, src_y1, src_x2, src_y2))

                    paste_x = int((float(bbox[0]) - float(x)) + pad_offset)
                    paste_y = int((float(bbox[1]) - float(y)) + pad_offset)
                    canvas.paste(pristine_crop, (paste_x, paste_y))

                    # Mark as globally claimed.
                    claimed[i] = True
                    stats["claimed_annotations"] += 1
                    stats["fully_contained"] += 1
                    newly_claimed_count += 1

                    # Erase on background_source so future windows see a clean bg.
                    draw_on_background.rectangle(bbox, fill=padding_color)

                    if debug:
                        print(
                            "[Slicer]   Box [%d] CLAIMED: pristine crop pasted, "
                            "background erased" % i
                        )
                else:
                    # ── ERASER: Mask with dominant background color rectangle ──
                    mapped = _map_box_to_canvas(bbox, float(x), float(y), float(pad_offset))

                    # Clip the mapped box to the canvas bounds [0, 0, final_size, final_size]
                    mask_x1 = max(0.0, mapped[0])
                    mask_y1 = max(0.0, mapped[1])
                    mask_x2 = min(float(final_size), mapped[2])
                    mask_y2 = min(float(final_size), mapped[3])

                    if mask_x2 > mask_x1 and mask_y2 > mask_y1:
                        draw_on_canvas.rectangle(
                            [mask_x1, mask_y1, mask_x2, mask_y2],
                            fill=padding_color,
                        )
                        stats["partial_masks_applied"] += 1

                        if debug:
                            reason = "already claimed" if already_claimed else "cut by edge"
                            print(
                                "[Slicer]   Masking box [%d] with dominant-color "
                                "rectangle %s: Executed (reason: %s)"
                                % (i, str(padding_color), reason)
                            )

            # ── Step 5: Only save canvas if we claimed at least one new box ──
            if newly_claimed_count > 0:
                sliced_images.append((canvas, {
                    "x": int(x),
                    "y": int(y),
                    "crop_w": int(crop_w),
                    "crop_h": int(crop_h),
                    "window_size": int(window_size),
                    "final_size": int(final_size),
                    "pad_offset": int(pad_offset),
                    "pseudo_intersection_count": len(intersecting_indices),
                    "pseudo_inside_count": newly_claimed_count,
                }))
                stats["windows_saved"] += 1

            # ── Step 6: Early stop if all annotations are claimed ──
            if deduplicate_contained and all(claimed):
                stats["early_stop_all_claimed"] = True
                if debug:
                    print("[Slicer] All annotations claimed — early stop.")
                _finalize_stats()
                return sliced_images

        # Also check early stop at end of each row (matches reference).
        if annotations is not None and deduplicate_contained and claimed and all(claimed):
            stats["early_stop_all_claimed"] = True
            if debug:
                print("[Slicer] All annotations claimed at row end — early stop.")
            _finalize_stats()
            return sliced_images

    _finalize_stats()
    return sliced_images
