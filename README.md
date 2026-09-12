# Dấu Ấn Đại Việt AI

Base project Version 0 cho nền tảng game hóa học lịch sử Việt Nam. Repository dùng Next.js full-stack: giao diện người chơi và admin mini ở frontend, API routes và các adapter hạ tầng ở backend. Gameplay mẫu chạy bằng Phaser; khu vực avatar 3D dùng React Three Fiber và chỉ tải khi người dùng mở màn hình tương ứng.

## 1. Tech stack

| Nhóm | Công nghệ | Vai trò |
| --- | --- | --- |
| Web full-stack | Next.js, React, TypeScript | Frontend, server rendering và backend API nhẹ |
| Giao diện | Tailwind CSS và CSS tokens | Responsive mobile-first |
| Gameplay | Phaser | Scene game 2D/2.5D chạy trong trình duyệt |
| 3D | Three.js, React Three Fiber, Drei | Avatar/GLB tải theo nhu cầu |
| Database | PostgreSQL | Hồ sơ, tiến trình và kết quả học tập |
| Object storage | MinIO | Asset 3D và tệp theo giao thức S3-compatible |
| Email local | Mailpit | Nhận email thử nghiệm mà không gửi ra ngoài |
| AI | OpenAI Responses API | Gia sư AI phía máy chủ, có fallback khi chưa cấu hình |
| Local operations | Docker Compose | Khởi động database và các dịch vụ phụ trợ |

Kiến trúc hiện tại giữ backend trong Next.js theo quyết định của tài liệu Version 0. PostgreSQL và MinIO được bọc qua lớp server riêng để có thể chuyển sang Supabase hoặc dịch vụ cloud khác sau này.

## 2. Yêu cầu trên máy phát triển

- Node.js 20.9 trở lên.
- pnpm 10 trở lên. Nếu chưa có, chạy `corepack enable` rồi `corepack prepare pnpm@latest --activate`.
- Docker Desktop có hỗ trợ lệnh `docker compose`.
- Git.

## 3. Cài đặt lần đầu

### Bước 1: lấy mã nguồn

```bash
git clone https://github.com/nWind9218/van-lang-su-ki.git
cd van-lang-su-ki
```

Nếu bạn đang tiếp nhận thư mục mã nguồn trực tiếp thì chỉ cần mở terminal tại thư mục gốc của dự án.

### Bước 2: tạo cấu hình local

PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
```

macOS/Linux:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

Các giá trị mặc định chỉ dùng cho local. Hãy đổi mật khẩu trước khi chia sẻ môi trường hoặc đưa hệ thống lên internet. Không commit `.env` hay `.env.local`.

### Bước 3: cài package

```bash
pnpm install
```

### Bước 4: chạy database và dịch vụ local

```bash
pnpm services:up
docker compose ps
```

Lần chạy đầu Docker sẽ tạo database, các bảng mẫu và một người chơi demo. Script trong `infra/postgres/init` chỉ tự chạy khi volume PostgreSQL được tạo mới.

Các địa chỉ local:

| Dịch vụ | URL/port | Ghi chú |
| --- | --- | --- |
| Web app | http://localhost:3000 | Có sau bước chạy app |
| PostgreSQL | localhost:5432 | Kết nối bằng `DATABASE_URL` |
| Adminer | http://localhost:8080 | System: PostgreSQL, Server: `db` |
| MinIO API | http://localhost:9000 | Endpoint S3-compatible |
| MinIO Console | http://localhost:9001 | Quản lý bucket và asset |
| Mailpit | http://localhost:8025 | Xem email thử nghiệm |

### Bước 5: chạy ứng dụng

```bash
pnpm dev
```

Mở http://localhost:3000. Kiểm tra backend tại http://localhost:3000/api/health.

## 4. Lệnh thường dùng

```bash
pnpm dev             # chạy Next.js ở chế độ phát triển
pnpm lint            # kiểm tra quy tắc code
pnpm typecheck       # kiểm tra TypeScript
pnpm build           # build production
pnpm check           # chạy lint, typecheck và build
pnpm services:up     # bật hạ tầng local
pnpm services:logs   # theo dõi log Docker
pnpm services:down   # tắt container, giữ dữ liệu
pnpm services:reset  # xóa container và volume local
```

`pnpm services:reset` sẽ xóa toàn bộ dữ liệu local trong PostgreSQL và MinIO. Chỉ dùng khi muốn khởi tạo lại môi trường từ đầu.

## 5. Project directory

```text
van-lang-su-ki/
├─ .agents/skills/
│  └─ karpathy-guidelines/         # skill coding guidelines dùng trong repository
├─ .codegraph/                     # metadata local cho CodeGraph index
├─ .codex/config.toml              # cấu hình CodeGraph MCP cho Codex
├─ AGENTS.md                       # quy tắc CodeGraph và coding agent
├─ assets/
│  └─ references/                 # ảnh tham chiếu ban đầu, chưa phải asset production
├─ apps/
│  └─ web/
│     ├─ .env.example              # cấu hình mẫu cho Next.js và backend
│     ├─ src/app/                  # giao diện, route và API routes
│     │  ├─ _components/           # component gắn với trang chủ
│     │  ├─ admin/                 # admin mini
│     │  ├─ api/                   # backend HTTP của Version 0
│     │  │  ├─ ai/tutor/           # endpoint gia sư AI
│     │  │  ├─ health/             # health check
│     │  │  └─ progress/           # đọc/ghi tiến trình demo
│     │  └─ avatar/                # màn 3D tải theo nhu cầu
│     └─ src/server/               # database, storage và biến môi trường
├─ docs/
│  ├─ requirements/                # tài liệu requirement chuẩn của Version 0
│  ├─ references/                  # đề án và ngân hàng câu hỏi nguồn
│  └─ ARCHITECTURE.md              # quyết định và ranh giới kiến trúc
├─ infra/
│  └─ postgres/init/               # schema/seed chạy khi tạo volume mới
├─ .env.example                    # cấu hình mẫu cho Docker Compose
├─ docker-compose.yml              # PostgreSQL, MinIO, Mailpit, Adminer
├─ CHANGELOGS.md                    # lịch sử thay đổi theo phiên bản
├─ package.json                    # các lệnh dùng chung tại repository root
└─ pnpm-workspace.yaml             # cấu hình workspace
```

## 6. API backend mẫu

### Health check

```bash
curl http://localhost:3000/api/health
```

### Đọc tiến trình người chơi demo

```bash
curl http://localhost:3000/api/progress
```

### Cập nhật một nhiệm vụ

```bash
curl -X PATCH http://localhost:3000/api/progress \
  -H "Content-Type: application/json" \
  -d '{"questId":"bach-dang-938","status":"in_progress","progress":{"step":1}}'
```

### Gọi gia sư AI

Điền `OPENAI_API_KEY` trong `apps/web/.env.local`, sau đó:

```bash
curl -X POST http://localhost:3000/api/ai/tutor \
  -H "Content-Type: application/json" \
  -d '{"question":"Vì sao địa hình sông Bạch Đằng có lợi?","context":"Ngô Quyền cho đóng cọc ngầm và lợi dụng thủy triều."}'
```

Khóa OpenAI chỉ được đọc trong server route, không được đặt tên với tiền tố `NEXT_PUBLIC_`.

## 7. Quy trình thay đổi

1. Tạo nhánh theo mục tiêu, ví dụ `feature/quest-map` hoặc `fix/mobile-controls`.
2. Cập nhật code và thêm migration nếu schema thay đổi.
3. Ghi thay đổi vào mục `Unreleased` của `CHANGELOGS.md`.
4. Chạy `pnpm check` trước khi tạo pull request.
5. Nêu rõ cách kiểm thử và ảnh hưởng đến dữ liệu trong pull request.

## 8. Chuyển dịch vụ local lên cloud sau này

- PostgreSQL: đổi `DATABASE_URL`; nếu chuyển Supabase, giữ schema SQL rồi thay adapter auth/storage theo kế hoạch.
- MinIO: đổi endpoint và credential sang dịch vụ S3-compatible, hoặc thay implementation trong `src/server/storage.ts`.
- Mailpit: thay cấu hình SMTP bằng nhà cung cấp email thật.
- OpenAI: đặt secret trong môi trường deploy; không đưa khóa vào mã nguồn hay bundle trình duyệt.

Chi tiết các quyết định kỹ thuật nằm trong `docs/ARCHITECTURE.md`. Tài liệu yêu cầu chuẩn nằm trong `docs/requirements/DAU_AN_DAI_VIET_AI_REQUIREMENTS_VERSION_0.docx`; các tài liệu đầu vào khác nằm trong `docs/references`.

## 9. Trạng thái Version 0

Base project hiện cung cấp khung kỹ thuật, giao diện khởi đầu, gameplay mẫu, API mẫu và hạ tầng local. Xác thực người dùng, CMS đầy đủ, RAG trên kho tri thức và pipeline tối ưu GLB là các hạng mục tiếp theo, chưa phải tính năng production hoàn chỉnh.

## 10. CodeGraph và coding agent

Repository đã cấu hình CodeGraph MCP cho Codex tại `.codex/config.toml`, quy tắc làm việc chung tại `AGENTS.md` và skill Karpathy tại `.agents/skills/karpathy-guidelines/SKILL.md`.

Sau khi clone lần đầu, cài CodeGraph CLI nếu máy chưa có rồi tạo index:

```bash
codegraph index
```

Trong công việc hằng ngày, luôn kiểm tra và đồng bộ index trước khi đọc rộng repository:

```bash
codegraph status
codegraph sync
codegraph explore "Mô tả luồng hoặc symbol cần tìm"
codegraph impact <symbol>
```

Sau khi thay đổi code, chạy lại `codegraph sync` và xác nhận `codegraph status` báo index đã cập nhật. Codex cần trust project và khởi động lại session sau lần đầu thêm cấu hình MCP local.
