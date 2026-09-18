# Triển khai production chi phí thấp

Kiến trúc mục tiêu:

- Vercel Hobby chạy `frontend/`.
- Render Free chạy Fastify backend từ `render.yaml`.
- Supabase Free cung cấp PostgreSQL.
- Cloudflare quản lý DNS. Backend hỗ trợ storage S3-compatible; có thể dùng Supabase Storage S3 hoặc Cloudflare R2.

## 1. Supabase

1. Tạo project ở region Singapore.
2. Trong **Connect**, lấy connection string của **Shared Pooler / Session mode** (cổng `5432`). Render cần endpoint IPv4; không tự ghép hostname pooler.
3. Percent-encode ký tự đặc biệt trong mật khẩu.
4. Dùng connection string này làm `DATABASE_URL` trên Render.

Backend chạy migration idempotent trước mỗi lần khởi động. Migration `001_initial.sql` tạo schema nền; các migration tiếp theo tạo map, map flow và ngân hàng câu hỏi.

## 2. Render backend

1. Tạo Blueprint từ repository và cho Render đọc `render.yaml`.
2. Điền secret `DATABASE_URL`.
3. Điền `FRONTEND_URL` bằng URL Vercel ban đầu; cập nhật thành domain thật sau khi gắn domain.
4. `OPENAI_API_KEY` có thể để trống nếu chưa dùng gia sư AI.
5. Xác nhận `https://<service>.onrender.com/api/health` trả `200`.
6. Gắn custom domain `api.<domain>` và cập nhật lại `FRONTEND_URL` nếu cần.

`autoDeployTrigger` hiện để `commit` nhằm deploy khi `main` thay đổi trong lúc GitHub Actions của tài khoản đang bị khóa billing. Sau khi CI hoạt động lại, đổi thành `checksPass`.

Render Free ngủ sau thời gian không có request. Request đầu tiên sau khi ngủ có thể chậm. Không lưu file lâu dài trên filesystem của service.

## 3. Vercel frontend

1. Import repository vào Vercel.
2. Chọn Root Directory là `frontend`.
3. Giữ tùy chọn **Include source files outside of the Root Directory** để frontend đọc package workspace `packages/map-contract`.
4. Khai báo:

   ```text
   NEXT_PUBLIC_APP_URL=https://<domain>
   NEXT_PUBLIC_API_BASE_URL=https://api.<domain>
   NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED=false
   ```

5. Deploy và gắn `<domain>` cùng `www.<domain>`.

## 4. Cloudflare DNS

Thêm đúng record mà Vercel và Render hiển thị trong màn hình custom domain. Không tự đoán IP. Dùng Cloudflare Free và giữ SSL/TLS ở chế độ `Full (strict)` sau khi hai origin đã cấp chứng chỉ.

## 5. Storage S3-compatible

Khai báo trên Render:

```text
ASSET_STORAGE_DRIVER=s3
ASSET_PUBLIC_BASE_URL=https://<project>.supabase.co/storage/v1/object/public/<bucket>
S3_ENDPOINT=https://<project>.storage.supabase.co/storage/v1/s3
S3_REGION=<region>
S3_BUCKET=<bucket>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>
```

Bucket phải public để URL asset hoạt động. Không commit credential S3. GLB mẫu đang bundle trong frontend vẫn đọc được độc lập với bucket.

Editor production tiếp tục bị khóa cho tới khi có authentication/authorization:

```text
MAP_EDITOR_WRITE_ENABLED=false
NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED=false
```

Chỉ bật editor/upload sau khi route admin có authentication. Local development tiếp tục dùng `ASSET_STORAGE_DRIVER=local`.

## 6. Kiểm tra sau deploy

```text
GET https://api.<domain>/api/health
GET https://<domain>/
GET https://<domain>/admin/maps
```

Sau mỗi merge vào `main`, Render và Vercel tự build/deploy commit mới. Khi GitHub Actions hoạt động lại, bảo vệ `main` và yêu cầu CI pass trước khi merge.
