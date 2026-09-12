# Changelogs

Tài liệu này ghi nhận các thay đổi đáng chú ý theo từng phiên bản. Dự án sử dụng quy ước [Semantic Versioning](https://semver.org/) và định dạng gần với [Keep a Changelog](https://keepachangelog.com/).

## Unreleased

### Added

- Chuẩn hóa package manager thành pnpm 11.19.0 bằng Corepack, `packageManager`, `engineStrict` và preinstall guard.
- Bổ sung hướng dẫn pnpm/frozen lockfile; ngăn commit lockfile của npm, yarn hoặc bun.
- Tách ứng dụng thành hai workspace độc lập: `frontend/` dùng Next.js và `backend/` dùng Fastify.
- Di chuyển API, database, storage và cấu hình secret sang backend; bổ sung CORS và biến `NEXT_PUBLIC_API_BASE_URL`.
- Cập nhật README và tài liệu kiến trúc theo cấu trúc mới.
- Thêm cấu hình CodeGraph MCP cục bộ, metadata index và quy trình bắt buộc kiểm tra/đồng bộ CodeGraph trong `AGENTS.md`.
- Thêm repository-local skill `karpathy-guidelines` cho hoạt động viết, review, debug và refactor code.

## 0.1.0 - 2026-09-12

### Added

- Khởi tạo ứng dụng Next.js full-stack bằng TypeScript và Tailwind CSS.
- Thêm scene Phaser 2D mẫu cho gameplay lịch sử.
- Thêm màn xem avatar 3D tải theo nhu cầu bằng React Three Fiber.
- Thêm API health check, lưu tiến trình và gia sư AI phía máy chủ.
- Thêm PostgreSQL, MinIO, Mailpit và Adminer cho môi trường local bằng Docker Compose.
- Thêm schema dữ liệu ban đầu và các file cấu hình môi trường mẫu.
- Thêm tài liệu hướng dẫn tiếp nhận dự án trong README.
