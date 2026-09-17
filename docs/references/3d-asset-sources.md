# Nguồn 3D Cho Phó Bản

## Asset đang dùng

- **Đấu trường chuyển sinh Văn Lang (owner-provided)**: chủ sở hữu dự án cung cấp `spawn_chapter_map.glb` (36.944.244 byte). Bản runtime `frontend/public/models/vanlang-rebirth/arena.runtime.glb` còn 559.464 byte; đã loại camera, xác nhận model nguồn không có animation, giảm mesh còn 75%, giới hạn texture WebP 1K và nén Meshopt. File gốc không được đưa vào runtime/repository.
- **Nhân vật chuyển sinh (owner-provided)**: chủ sở hữu dự án cung cấp `nhan-vat-01.glb` (26.507.220 byte). Bản runtime `frontend/public/models/vanlang-rebirth/hero.runtime.glb` đã loại camera và 36 clip ngoài scope, chỉ giữ animation đúng tên `Idle`, `Walk` và `Run`, giảm mesh còn 60%, giới hạn texture WebP 1K và nén Meshopt. File gốc không được đưa vào runtime/repository.
- **Ảnh nền đấu trường (owner-provided)**: `2d_spawn_chapter_map.glb` thực chất là PNG 1536×864. Runtime dùng đúng đuôi tại `frontend/public/vanlang-rebirth-arena.png` (3.255.480 byte), không phục vụ file mang đuôi sai.
- **Wuxia UI pack (owner-provided)**: chỉ các frame cần cho HUD, health, DialogueBox, quest drawer và nameplate được đưa vào `frontend/public/ui/wuxia/`; text, tên, HP và icon vẫn là lớp HTML/SVG truy cập được.
- **Kenney Fantasy Town Kit 2.0**: mô-đun cây, đá, hàng rào, cổng, xe kéo và cấu kiện gỗ cho cảnh Văn Lang. Pack có giấy phép CC0, chứa GLB và được tối ưu theo hướng low-poly. Các file được dùng trực tiếp nằm trong `frontend/public/models/vanlang/`; bản gốc và giấy phép được giữ tại `assets/vendor/kenney-fantasy-town-kit/`.
- **Chiến binh giáp đỏ / Vệ binh áo lục**: model nội bộ từ `assets/characters/`. Bản runtime nằm tại `frontend/public/models/`, đã giảm từ khoảng 27 MB xuống khoảng 4.9 MB mỗi file bằng glTF Transform, WebP texture 1K, quantization và giảm lưới 30% nhưng vẫn giữ animation.

## Các nguồn mở rộng đã kiểm tra

| Nguồn | Phù hợp với | License / định dạng | Quyết định |
| --- | --- | --- | --- |
| [Kenney Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit) | Làng, cổng, hàng rào, địa hình stylized | CC0, GLB/FBX/OBJ | Đang dùng cho Văn Lang |
| [Kenney Modular Dungeon Kit](https://www.kenney.nl/assets/modular-dungeon-kit) | Phó bản thành, đền, hang về sau | CC0, modular 3D | Dự phòng cho Âu Lạc / Thăng Long |
| [Poly Haven](https://polyhaven.com/) | HDRI, texture nền, điểm nhấn chất lượng cao | CC0 | Chỉ dùng texture/HDRI được tối ưu kích thước |
| [Quaternius](https://quaternius.com/) | Thiên nhiên, props, NPC low-poly | CC0, có glTF ở nhiều pack | Chọn từng pack sau khi kiểm tra bối cảnh |

## Không đưa vào build

Khronos Sponza là scene thử nghiệm tốt nhưng không phù hợp bối cảnh Văn Lang và model có điều khoản CryEngine riêng. Không dùng làm asset production.

## Quy tắc thêm map mới

1. Chỉ nhận asset có giấy phép phù hợp để phân phối cùng game; lưu file license cùng asset.
2. Ưu tiên GLB hoặc glTF, tách môi trường thành các mô-đun nhỏ để tải theo phó bản.
3. Chạy `gltf-transform optimize` với texture tối đa 1K hoặc 2K tùy khoảng cách camera, rồi ghi nhận kích thước trước/sau.
4. Giữ camera kể chuyện cố định ở các cảnh nhiệm vụ; chỉ mở camera tự do ở màn xem avatar.

