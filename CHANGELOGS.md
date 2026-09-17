# Changelogs

Tài liệu này ghi nhận các thay đổi đáng chú ý theo từng phiên bản. Dự án sử dụng quy ước [Semantic Versioning](https://semver.org/) và định dạng gần với [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added

- Thêm Map Editor Mode end-to-end cho map document dùng chung: asset/scene inspector, transform 2D/3D, walkable polygon, collider overlay, dirty state và save revision có ETag.
- Thêm chế độ chuyển đổi giữa viewport chỉnh vùng 2D và preview GLB 3D dùng đúng camera, model, NPC cùng transform của runtime.
- Thêm package `@van-lang/map-contract` chứa schema Zod V1, semantic validation, collision geometry và fixture canonical Văn Lang dùng chung cho frontend/backend.
- Thêm Maps API list/load/save, revision bất biến được activate nguyên tử, write gate local, migration runner và seed Văn Lang idempotent.
- Chuyển runtime Văn Lang sang đọc document đã validate, hỗ trợ fallback bundled, renderer layer 2D/3D và collision theo transform hiện tại.
- Tái dựng phó bản Văn Lang thành đấu trường chuyển sinh toàn màn hình với background PNG, scene/nhân vật GLB runtime tối ưu, navmesh tam giác hóa, animation `Idle`/`Run`, WASD và điều khiển chạm.
- Thêm hội thoại Huyền Quan Canh Thời lần đầu theo từng tài khoản, HUD Wuxia sau onboarding và các drawer gọn cho nhiệm vụ, bí kíp, phần thưởng, rời phó bản.
- Bổ sung fallback tĩnh khi WebGL/model lỗi và giữ lối thoát an toàn về Bản đồ Ký Ức.
- Thay màn map dạng dashboard bằng bản đồ ký ức toàn màn hình: mây tách khi khai mở, bốn ornament Đông Sơn và tám layer triều đại tương tác độc lập.
- Bổ sung lối quay về màn hình chính từ Bản đồ Ký ức và thiết kế lại nút rời phó bản theo phong cách đồng cổ.
- Tự động tách mây khai mở Bản đồ Ký ức khi người chơi vừa tiến vào, không còn yêu cầu thao tác chạm.
- Phủ xích đồng và huy hiệu ổ khóa lên các triều đại chưa mở, kèm tooltip sử thi “Coming soon” khi hover hoặc focus.
- Thêm cinematic loading riêng cho Văn Lang với text layer cấu hình độc lập và tiến độ preload thật cho cảnh 3D, nhân vật cùng đạo cụ phó bản.
- Thêm bốn slide cốt truyện mở đầu cho tài khoản mới, dùng ảnh tư liệu Văn Lang, hiệu ứng đánh chữ và chuyển thẳng tới bản đồ sau cảnh cuối.
- Thêm luồng đăng ký/đăng nhập cục bộ không cần email xác thực hoặc OTP trước khi vào game.
- Thêm màn menu mở đầu điện ảnh `Văn Lang Sử Ký` theo ngôn ngữ Đông Sơn, hỗ trợ bàn phím, responsive và reduced motion.
- Giải nén gói hướng dẫn thiết kế tham khảo vào `docs/van-lang-agent-pack` mà không ghi đè cấu hình dự án.
- Hợp nhất điểm vào trải nghiệm người chơi tại `/`: luồng Văn Lang thay thế trang giới thiệu cũ, còn `/game-mock` chuyển hướng tương thích về `/`.
- Thêm kế hoạch kỹ thuật Front Mock Design, đối chiếu yêu cầu Version 0 và đề án ngân hàng câu hỏi Thành Văn Lang.
- Tích hợp phó bản 3D Văn Lang bằng React Three Fiber: camera isometric, map modular CC0, NPC beacon và HUD theo ngữ cảnh.
- Tối ưu hai model nhân vật GLB từ khoảng 27 MB xuống khoảng 4.9 MB mỗi file, giữ animation và dùng texture WebP 1K cho runtime.

- Thêm GitHub Actions CI cho push/pull request vào `main`, gồm frozen install, lint, typecheck, build và kiểm tra Docker Compose.
- Chuẩn hóa package manager thành pnpm 11.19.0 bằng Corepack, `packageManager`, `engineStrict` và preinstall guard.
- Bổ sung hướng dẫn pnpm/frozen lockfile; ngăn commit lockfile của npm, yarn hoặc bun.
- Tách ứng dụng thành hai workspace độc lập: `frontend/` dùng Next.js và `backend/` dùng Fastify.
- Di chuyển API, database, storage và cấu hình secret sang backend; bổ sung CORS và biến `NEXT_PUBLIC_API_BASE_URL`.
- Cập nhật README và tài liệu kiến trúc theo cấu trúc mới.
- Thêm cấu hình CodeGraph MCP cục bộ, metadata index và quy trình bắt buộc kiểm tra/đồng bộ CodeGraph trong `AGENTS.md`.
- Thêm repository-local skill `karpathy-guidelines` cho hoạt động viết, review, debug và refactor code.

- Hoàn thiện luồng mock màn hình `game-mock` theo thiết kế isometric ARPG: onboarding kể chuyện, map phó bản Văn Lang mở khóa, dungeon tương tác NPC và boss.
- Hoàn thiện logic điều khiển cơ bản (WASD, Space), âm thanh SFX/Ambient tương tác, HUD Tab nhân vật/bí kíp/leaderboard/battle pass, và modal nhiệm vụ.
- Chuẩn hóa dữ liệu mock Văn Lang (`vanlang-mock-data.ts`) để sát nội dung dự án, bổ sung trường nguồn cho tất cả bí kíp.
- Bổ sung/hoàn thiện trải nghiệm hiển thị âm thanh và tương tác UI trong `vanlang-game-shell.tsx` theo tông neon/dark game HUD.
- Bổ sung ảnh bối cảnh isometric Văn Lang, responsive HUD, focus bàn phím, reduced-motion và chặn thao tác phía sau modal.

### Fixed

- Harden Map Editor/runtime trước dữ liệu map lỗi, save đồng thời/thất bại, dirty navigation, polygon không hợp lệ, coordinate drift khi resize và collision tunneling/recovery với collider transform hoặc chồng lấn.
- Xoay phép chiếu điều khiển theo camera đấu trường để W/S đối nhau 180°, A/D lệch đúng ±90° và hướng mặt nhân vật khớp với chuyển động.
- Hiển thị toàn bộ map 2D trong cùng khung 16:9 với lớp 3D, thu nhỏ nhân vật/NPC/HUD, khôi phục màu thanh máu và làm mượt chuyển động WASD liên tục.
- Đồng bộ góc xoay map 3D với nền 2D, sửa hướng mặt nhân vật theo vector di chuyển, blend `Idle`/`Walk`/`Run` và thêm typewriter không tràn khung cho mọi hội thoại NPC.
- Căn lại tên nhân vật, nội dung và cụm nút hội thoại theo bounding box tỷ lệ của khung Wuxia; giữ vùng đọc cuộn được và bố cục mobile tối thiểu 16 px.
- Giới hạn vùng di chuyển phó bản theo sân tròn trung tâm và ba lối đi thực tế: cầu phía trên, sân phụ bên trái và cầu thang phía dưới.

## 0.1.0 - 2026-09-12

### Added

- Tích hợp phó bản 3D Văn Lang bằng React Three Fiber: camera isometric, map modular CC0, NPC beacon và HUD theo ngữ cảnh.
- Tối ưu hai model nhân vật GLB từ khoảng 27 MB xuống khoảng 4.9 MB mỗi file, giữ animation và dùng texture WebP 1K cho runtime.

- Khởi tạo ứng dụng Next.js full-stack bằng TypeScript và Tailwind CSS.
- Thêm scene Phaser 2D mẫu cho gameplay lịch sử.
- Thêm màn xem avatar 3D tải theo nhu cầu bằng React Three Fiber.
- Thêm API health check, lưu tiến trình và gia sư AI phía máy chủ.
- Thêm PostgreSQL, MinIO, Mailpit và Adminer cho môi trường local bằng Docker Compose.
- Thêm schema dữ liệu ban đầu và các file cấu hình môi trường mẫu.
- Thêm tài liệu hướng dẫn tiếp nhận dự án trong README.
