# Changelogs

Tài liệu này ghi nhận các thay đổi đáng chú ý theo từng phiên bản. Dự án sử dụng quy ước [Semantic Versioning](https://semver.org/) và định dạng gần với [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added

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
