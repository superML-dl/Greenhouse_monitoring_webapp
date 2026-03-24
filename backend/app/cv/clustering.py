"""
DBSCAN Clustering for merging overlapping detections from sliced inference.
"""
import numpy as np


def merge_detections_dbscan(detections: list[dict], eps: float = 30.0, min_samples: int = 1) -> list[dict]:
    """
    Takes a list of detections, each with {"bbox": [x1,y1,x2,y2], "confidence": float, "class_name": str},
    and merges overlapping/duplicate detections using DBSCAN clustering on box centers.
    Returns deduplicated detections.
    """
    if not detections:
        return []

    from sklearn.cluster import DBSCAN

    # Group detections by class
    class_groups: dict[str, list[dict]] = {}
    for det in detections:
        cn = det["class_name"]
        if cn not in class_groups:
            class_groups[cn] = []
        class_groups[cn].append(det)

    merged = []

    for class_name, dets in class_groups.items():
        if len(dets) == 1:
            merged.append(dets[0])
            continue

        # Compute box centers
        centers = []
        for d in dets:
            x1, y1, x2, y2 = d["bbox"]
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2
            centers.append([cx, cy])

        centers_array = np.array(centers)
        clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(centers_array)
        labels = clustering.labels_

        # For each cluster, keep the detection with highest confidence
        cluster_map: dict[int, list[int]] = {}
        for idx, label in enumerate(labels):
            if label == -1:
                # Noise point -> keep as-is
                merged.append(dets[idx])
            else:
                if label not in cluster_map:
                    cluster_map[label] = []
                cluster_map[label].append(idx)

        for cluster_indices in cluster_map.values():
            best_idx = max(cluster_indices, key=lambda i: dets[i]["confidence"])
            # Optionally: merge bounding boxes by averaging
            best_det = dets[best_idx].copy()

            # Average the bounding boxes of all detections in this cluster
            all_boxes = np.array([dets[i]["bbox"] for i in cluster_indices])
            best_det["bbox"] = all_boxes.mean(axis=0).tolist()

            merged.append(best_det)

    return merged
