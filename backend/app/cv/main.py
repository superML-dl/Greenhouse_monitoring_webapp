import cv2
import json
import time
from datetime import datetime
from PIL import Image
from ultralytics import YOLO

# Import 2 module bạn đã viết
from preprocessing import preprocess_sticky_trap
from window_slicer import slice_image_for_inference

def main():
    # 1. Khởi tạo mô hình
    print("[INFO] Đang tải mô hình...")
    # Khuyên dùng: trên Pi 4 có thể inference sẽ chậm, sau này bạn có thể 
    # convert sang định dạng NCNN hoặc TFLite (.ncnn / .tflite) để tối ưu FPS.
    model_full = YOLO("best_full.pt")
    model_slice = YOLO("best_slice.pt")

    # 2. Khởi tạo Camera
    # Thông thường Pi Camera hoặc Webcam USB sẽ ở index 0
    cap = cv2.VideoCapture(0)
    
    # Chỉnh độ phân giải camera (tuỳ thuộc vào phần cứng của bạn)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    if not cap.isOpened():
        print("[LỖI] Không thể kết nối với camera.")
        return

    print("[INFO] Hệ thống sẵn sàng. Nhấn 'q' để thoát, 'c' để chụp và phân tích.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("[LỖI] Không thể đọc frame từ camera.")
            break

        # Hiển thị camera trực tiếp để căn chỉnh
        cv2.imshow("Raspberry Pi Camera (Press 'c' to capture, 'q' to quit)", frame)

        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            print("\n[INFO] Đã chụp ảnh, bắt đầu quá trình phân tích...")
            
            # Chuyển BGR (OpenCV) sang RGB (PIL) để đưa vào hàm tiền xử lý
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img_pil = Image.fromarray(img_rgb)

            # --- BƯỚC 1: TIỀN XỬ LÝ (Trích xuất bẫy dính) ---
            print("[1/4] Đang tiền xử lý ảnh...")
            prep_result = preprocess_sticky_trap(img_pil)
            
            if not prep_result.contour_found:
                print("[CẢNH BÁO] Không tìm thấy bẫy dính vàng. Dùng ảnh gốc.")
            
            cropped_image = prep_result.processed_image

            # --- BƯỚC 2: MÔ HÌNH 1 (Lấy nhãn giả từ best_full) ---
            print("[2/4] Chạy mô hình best_full.pt...")
            results_full = model_full(cropped_image, verbose=False)
            
            # Chuyển đổi bounding box sang định dạng dictionary cho slicer
            pseudo_annotations = []
            for r in results_full:
                for box in r.boxes:
                    # Lấy tọa độ [xmin, ymin, xmax, ymax]
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    pseudo_annotations.append({
                        "xmin": x1,
                        "ymin": y1,
                        "xmax": x2,
                        "ymax": y2
                    })
            
            print(f"[INFO] Tìm thấy {len(pseudo_annotations)} nhãn giả từ ảnh tổng thể.")

            # --- BƯỚC 3: CẮT ẢNH THEO THUẬT TOÁN WINDOW SLICER ---
            print("[3/4] Cắt ảnh qua thuật toán Redundancy-Free Window Slicing...")
            slices = slice_image_for_inference(
                image=cropped_image,
                window_size=300,
                step=300,
                final_size=640,
                annotations=pseudo_annotations,
                deduplicate_contained=True,
                debug=False # Chuyển thành True nếu muốn xem log cắt ảnh chi tiết
            )
            print(f"[INFO] Đã tạo ra {len(slices)} lát cắt (slices).")

            # --- BƯỚC 4: MÔ HÌNH 2 (Nhận diện chi tiết trên từng slice) ---
            print("[4/4] Chạy mô hình best_slice.pt trên từng lát cắt...")
            
            # Khởi tạo dictionary để đếm số lượng từng loại côn trùng
            total_counts = {}
            
            for idx, (slice_img, slice_info) in enumerate(slices):
                results_slice = model_slice(slice_img, verbose=False)
                
                for r in results_slice:
                    for box in r.boxes:
                        # Lấy class ID và tên class
                        cls_id = int(box.cls[0])
                        cls_name = model_slice.names[cls_id]
                        
                        # Cộng dồn số lượng
                        if cls_name in total_counts:
                            total_counts[cls_name] += 1
                        else:
                            total_counts[cls_name] = 1

            # --- LƯU KẾT QUẢ TẠM THỜI ---
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            result_data = {
                "timestamp": timestamp,
                "pseudo_labels_found": len(pseudo_annotations),
                "slices_generated": len(slices),
                "insects_counted": total_counts
            }

            # Lưu vào file JSON
            output_filename = f"detection_results_{timestamp}.json"
            with open(output_filename, 'w', encoding='utf-8') as f:
                json.dump(result_data, f, ensure_ascii=False, indent=4)
            
            print(f"\n[HOÀN THÀNH] Kết quả nhận diện: {total_counts}")
            print(f"[INFO] Đã lưu kết quả tạm thời vào: {output_filename}\n")

    # Giải phóng tài nguyên
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()