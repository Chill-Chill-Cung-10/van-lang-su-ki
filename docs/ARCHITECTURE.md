# Kiến trúc Version 0

## Quyết định chính

Version 0 dùng một ứng dụng Next.js full-stack. Frontend nằm trong các route giao diện của App Router; backend nhẹ nằm trong `src/app/api` và `src/server`. Cách tổ chức này đáp ứng yêu cầu có frontend và backend nhưng chưa tạo thêm một dịch vụ ứng dụng phải vận hành riêng.

## Luồng hệ thống

```text
Trình duyệt
  ├─ Giao diện Next.js
  ├─ Phaser chỉ tải tại màn gameplay
  └─ React Three Fiber chỉ tải tại màn avatar
          │
          ▼
Next.js API routes
  ├─ PostgreSQL local (tiến trình, hồ sơ, kết quả)
  ├─ MinIO local (asset GLB và tệp)
  ├─ Mailpit local (email thử nghiệm)
  └─ OpenAI API (tùy chọn, khóa chỉ ở phía máy chủ)
```

## Ranh giới thay thế dịch vụ

- Mã truy cập dữ liệu nằm trong `src/server/db` để có thể đổi `DATABASE_URL` hoặc thay adapter.
- Mã lưu trữ nằm trong `src/server/storage.ts` và dùng giao thức S3-compatible, nên có thể chuyển từ MinIO sang một dịch vụ object storage khác.
- Route AI chỉ đọc khóa ở máy chủ và trả thông báo fallback khi OpenAI chưa được cấu hình.
- Khi chuyển lên Supabase, có thể thay lớp database/storage mà không đổi scene Phaser hoặc các component giao diện.
