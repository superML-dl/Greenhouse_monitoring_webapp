import os
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
import numpy as np
import cv2

# --- CÁC HÀM HELPER ---

def parse_voc_xml(xml_path):
    """Hàm này trả về một danh sách các dictionary {'name': ..., 'box': ...}."""
    if not os.path.exists(xml_path): return []
    tree = ET.parse(xml_path)
    root = tree.getroot()
    objects = []
    for obj in root.findall('object'):
        name = obj.find('name').text
        bndbox = obj.find('bndbox')
        box = [int(bndbox.find(tag).text) for tag in ['xmin', 'ymin', 'xmax', 'ymax']]
        objects.append({'name': name, 'box': box})
    return objects

def get_dominant_color(image):
    img_1x1 = image.resize((1, 1), Image.Resampling.LANCZOS)
    return img_1x1.getpixel((0, 0))

def boxes_intersect(box_a, box_b):
    # Hàm này luôn mong đợi 2 list tọa độ.
    return not (box_a[2] <= box_b[0] or box_a[0] >= box_b[2] or box_a[3] <= box_b[1] or box_a[1] >= box_b[3])

def is_box_fully_contained_in_canvas(bbox, window_box, window_size, final_size):
    # Hàm này luôn mong đợi 1 list tọa độ cho bbox.
    pad_offset = (final_size - window_size) // 2
    bbox_w = bbox[2] - bbox[0]
    bbox_h = bbox[3] - bbox[1]
    final_x = (bbox[0] - window_box[0]) + pad_offset
    final_y = (bbox[1] - window_box[1]) + pad_offset
    return (final_x >= 0 and final_y >= 0 and
            final_x + bbox_w <= final_size and
            final_y + bbox_h <= final_size)

def create_voc_xml(xml_save_path, image_filename, image_size, objects_data):
    """Hàm này nhận vào danh sách các dictionary và xử lý chúng."""
    root = ET.Element("annotation")
    ET.SubElement(root, "filename").text = image_filename
    size_elem = ET.SubElement(root, "size")
    ET.SubElement(size_elem, "width").text = str(image_size[0])
    ET.SubElement(size_elem, "height").text = str(image_size[1])
    ET.SubElement(size_elem, "depth").text = "3"

    for obj_data in objects_data:
        obj_elem = ET.SubElement(root, "object")
        ET.SubElement(obj_elem, "name").text = obj_data['name']
        bndbox_elem = ET.SubElement(obj_elem, "bndbox")
        bbox = obj_data['box']
        ET.SubElement(bndbox_elem, "xmin").text = str(bbox[0])
        ET.SubElement(bndbox_elem, "ymin").text = str(bbox[1])
        ET.SubElement(bndbox_elem, "xmax").text = str(bbox[2])
        ET.SubElement(bndbox_elem, "ymax").text = str(bbox[3])
    
    tree = ET.ElementTree(root)
    ET.indent(tree, space="\t", level=0)
    tree.write(xml_save_path, encoding='utf-8')


# --- HÀM XỬ LÝ CHÍNH CHO MỘT ẢNH (ĐÃ SỬA LỖI) ---
def process_single_image(img_path, xml_path, output_img_dir, output_xml_dir, base_counter, **kwargs):
    window_size = kwargs.get('window_size', 450)
    step = kwargs.get('step', 450)
    final_size = kwargs.get('final_size', 640)

    try:
        original_image = Image.open(img_path).convert("RGB")
        background_source = original_image.copy()
        draw_on_background = ImageDraw.Draw(background_source)
        all_objects = parse_voc_xml(xml_path) # Đây là danh sách các dictionary
        claimed_objects = [False] * len(all_objects)
        padding_color = get_dominant_color(original_image)
    except Exception as e:
        print(f"  - Lỗi khi mở file {os.path.basename(img_path)}: {e}"); return 0

    img_w, img_h = original_image.size
    slices_created_for_this_image = 0

    x_coords = sorted(list(set(list(range(0, img_w - window_size, step)) + [max(0, img_w - window_size)])))
    y_coords = sorted(list(set(list(range(0, img_h - window_size, step)) + [max(0, img_h - window_size)])))
    
    for y in y_coords:
        for x in x_coords:
            window_box = [x, y, x + window_size, y + window_size]

            # ### ĐIỂM SỬA 1: SỬA CÁCH GỌI HÀM ###
            valid_object_indices = [
                i for i, obj_data in enumerate(all_objects)
                if not claimed_objects[i] and 
                   boxes_intersect(obj_data['box'], window_box) and # <<< Sửa ở đây
                   is_box_fully_contained_in_canvas(obj_data['box'], window_box, window_size, final_size) # <<< Sửa ở đây
            ]
            
            if valid_object_indices:
                canvas = Image.new('RGB', (final_size, final_size), padding_color)
                pad_offset = (final_size - window_size) // 2
                background_crop = background_source.crop(window_box)
                canvas.paste(background_crop, (pad_offset, pad_offset))

                new_objects_for_this_slice = []
                for i in valid_object_indices:
                    obj_data = all_objects[i]
                    bbox = obj_data['box'] # <<< Lấy tọa độ
                    name = obj_data['name'] # <<< Lấy tên

                    # ### ĐIỂM SỬA 2: SỬA CÁC HÀM CỦA PILLOW ###
                    pristine_bbox_crop = original_image.crop(bbox) # <<< Dùng list tọa độ
                    
                    final_paste_x = (bbox[0] - window_box[0]) + pad_offset
                    final_paste_y = (bbox[1] - window_box[1]) + pad_offset
                    
                    canvas.paste(pristine_bbox_crop, (final_paste_x, final_paste_y))
                    
                    claimed_objects[i] = True
                    draw_on_background.rectangle(bbox, fill=padding_color) # <<< Dùng list tọa độ
                    
                    bbox_w = bbox[2] - bbox[0]
                    bbox_h = bbox[3] - bbox[1]
                    new_box = [final_paste_x, final_paste_y, final_paste_x + bbox_w, final_paste_y + bbox_h]
                    # ### ĐIỂM SỬA 3: ĐẢM BẢO TẠO ĐÚNG DICTIONARY ###
                    new_objects_for_this_slice.append({'name': name, 'box': new_box})
                
                slice_filename_base = f"slice_{base_counter + slices_created_for_this_image:06d}"
                
                img_save_path = os.path.join(output_img_dir, f"{slice_filename_base}.png")
                canvas.save(img_save_path)
                
                xml_save_path = os.path.join(output_xml_dir, f"{slice_filename_base}.xml")
                create_voc_xml(xml_save_path, f"{slice_filename_base}.png", (final_size, final_size), new_objects_for_this_slice)

                slices_created_for_this_image += 1

            if all(claimed_objects): break
        if all(claimed_objects): break
    
    return slices_created_for_this_image

# --- HÀM ĐIỀU PHỐI XỬ LÝ HÀNG LOẠT ---
def batch_process_directory(images_folder, annotations_folder, output_dir, **kwargs):
    output_img_dir = os.path.join(output_dir, 'images')
    output_xml_dir = os.path.join(output_dir, 'annotations')
    os.makedirs(output_img_dir, exist_ok=True)
    os.makedirs(output_xml_dir, exist_ok=True)

    image_files = sorted([f for f in os.listdir(images_folder) if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
    total_slices_created = 0
    
    print(f"Tìm thấy {len(image_files)} ảnh để xử lý.")

    for img_filename in image_files:
        base_name, _ = os.path.splitext(img_filename)
        xml_filename = f"{base_name}.xml"
        
        img_path = os.path.join(images_folder, img_filename)
        xml_path = os.path.join(annotations_folder, xml_filename)

        print(f"\n--- Bắt đầu xử lý: {img_filename} ---")
        if not os.path.exists(xml_path):
            print(f"  - Cảnh báo: Không tìm thấy file chú thích '{xml_filename}'. Bỏ qua file này.")
            continue
            
        num_created = process_single_image(
            img_path, xml_path, 
            output_img_dir, output_xml_dir, 
            base_counter=total_slices_created, 
            **kwargs
        )
        total_slices_created += num_created
        print(f"  -> Đã tạo {num_created} lát cắt có chứa BBox.")

    print(f"\n===== QUÁ TRÌNH HOÀN TẤT =====")
    print(f"Tổng cộng đã tạo ra {total_slices_created} lát cắt và các file chú thích tương ứng.")
    print(f"Kết quả được lưu tại: {output_dir}")

# --- HÀM CẮT ẢNH CHO INFERENCE MÀ KHÔNG CẦN XML ---
def slice_image_for_inference(image, window_size=450, step=450, final_size=640):
    """
    Cắt ảnh thành các chunks để inference.
    
    Args:
        image: PIL Image hoặc numpy array (BGR nếu CV2)
        window_size: Kích thước cửa sổ trượt
        step: Bước trượt
        final_size: Kích thước output cuối cùng (có padding)
    
    Returns:
        Danh sách tuple: (chunk_image_pil, slice_info)
        slice_info = {'x': x_offset, 'y': y_offset, 'window_size': window_size, 'final_size': final_size}
    """
    # Convert numpy (CV2) to PIL nếu cần
    if isinstance(image, np.ndarray):
        image = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    
    original_image = image.convert("RGB") if image.mode != "RGB" else image
    padding_color = get_dominant_color(original_image)
    
    img_w, img_h = original_image.size
    slices = []
    
    # Tính toán các vị trí cắt
    x_coords = sorted(list(set(list(range(0, img_w - window_size, step)) + [max(0, img_w - window_size)])))
    y_coords = sorted(list(set(list(range(0, img_h - window_size, step)) + [max(0, img_h - window_size)])))
    
    for y in y_coords:
        for x in x_coords:
            window_box = [x, y, x + window_size, y + window_size]
            
            # Lấy crop từ ảnh gốc
            background_crop = original_image.crop(window_box)
            
            # Tạo canvas với padding
            canvas = Image.new('RGB', (final_size, final_size), padding_color)
            pad_offset = (final_size - window_size) // 2
            canvas.paste(background_crop, (pad_offset, pad_offset))
            
            slice_info = {
                'x': x,
                'y': y,
                'window_size': window_size,
                'final_size': final_size,
                'pad_offset': pad_offset
            }
            
            slices.append((canvas, slice_info))
    
    return slices


if __name__ == '__main__':
    IMAGES_FOLDER = "dataset/images/train"
    ANNOTATIONS_FOLDER = "dataset/annotations/train"
    OUTPUT_DIRECTORY = "testngay1103/images"
    slicing_params = {
        'window_size': 300,
        'step': 300,
        'final_size': 640
    }

    batch_process_directory(
        images_folder=IMAGES_FOLDER,
        annotations_folder=ANNOTATIONS_FOLDER,
        output_dir=OUTPUT_DIRECTORY,
        **slicing_params
    )