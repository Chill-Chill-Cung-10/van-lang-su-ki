# Kiến trúc Version 0

## Quyết định chính

Repository có hai ứng dụng độc lập:

- `frontend/`: Next.js, React, Phaser và React Three Fiber.
- `backend/`: Fastify REST API, Drizzle ORM và các adapter hạ tầng.

Frontend không giữ secret hoặc truy cập trực tiếp database. Mọi thao tác dữ liệu và AI đi qua backend tại `NEXT_PUBLIC_API_BASE_URL`. PostgreSQL, MinIO, Mailpit và Adminer tiếp tục chạy local bằng Docker Compose.

## Luồng hệ thống

```text
Trình duyệt
  │
  ▼
Frontend Next.js :3000
  ├─ giao diện responsive
  ├─ Phaser cho gameplay
  └─ React Three Fiber cho avatar
  │ HTTP / JSON
  ▼
Backend Fastify :4000
  ├─ /api/health
  ├─ /api/progress
  └─ /api/ai/tutor
      ├─ PostgreSQL local
      ├─ MinIO local
      ├─ Mailpit local
      └─ OpenAI API (tùy chọn)
```

Backend chỉ cho phép CORS từ `FRONTEND_URL`. Khóa OpenAI và thông tin kết nối dịch vụ chỉ nằm trong môi trường backend.

## Ranh giới thay thế dịch vụ

- Mã truy cập dữ liệu nằm trong `backend/src/server/db` để có thể đổi `DATABASE_URL` hoặc thay adapter.
- Mã lưu trữ nằm trong `backend/src/server/storage.ts` và dùng giao thức S3-compatible.
- Route AI chỉ đọc khóa ở backend và trả fallback khi OpenAI chưa được cấu hình.
- Frontend chỉ cần đổi `NEXT_PUBLIC_API_BASE_URL` khi backend chuyển host.
- Khi chuyển lên Supabase, có thể thay lớp database/storage mà không đổi scene Phaser hoặc component giao diện.
