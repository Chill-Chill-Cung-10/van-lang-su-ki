# Dấu Ấn Đại Việt AI

[![CI](https://github.com/nWind9218/van-lang-su-ki/actions/workflows/ci.yml/badge.svg)](https://github.com/nWind9218/van-lang-su-ki/actions/workflows/ci.yml)

Base project Version 0 cho nền tảng game hóa học lịch sử Việt Nam. Repository được tách thành hai ứng dụng độc lập: frontend Next.js phục vụ giao diện/gameplay và backend Fastify cung cấp API, kết nối PostgreSQL, MinIO và OpenAI. Hạ tầng dữ liệu vẫn chạy local bằng Docker Compose để có thể thay bằng dịch vụ cloud ở phiên bản sau.

## 1. Tech stack

| Nhóm | Công nghệ | Vai trò |
| --- | --- | --- |
| Frontend | Next.js, React, TypeScript | Giao diện, server rendering và routing |
| Giao diện | Tailwind CSS và CSS tokens | Responsive mobile-first |
| Gameplay | Phaser | Scene game 2D/2.5D chạy trong trình duyệt |
| 3D | Three.js, React Three Fiber, Drei | Avatar/GLB tải theo nhu cầu |
| Backend | Node.js, Fastify, TypeScript | REST API độc lập tại cổng 4000 |
| Database | PostgreSQL, Drizzle ORM | Hồ sơ, tiến trình và kết quả học tập |
| Object storage | MinIO | Asset 3D và tệp theo giao thức S3-compatible |
| Email local | Mailpit | Nhận email thử nghiệm mà không gửi ra ngoài |
| AI | OpenAI Responses API | Gia sư AI phía backend, có fallback khi chưa cấu hình |
| Local operations | Docker Compose | Khởi động database và các dịch vụ phụ trợ |

## 2. Yêu cầu trên máy phát triển

- Node.js 20.9 trở lên.
- pnpm 11.19.0, được pin bằng trường `packageManager` tại root.
- Docker Desktop có hỗ trợ lệnh `docker compose`.
- Git.
- CodeGraph CLI nếu muốn dùng quy trình tra cứu code được cấu hình sẵn.

Kích hoạt đúng phiên bản pnpm bằng Corepack:

```bash
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm --version
```

Kết quả phải là `11.19.0`. Repository có guard tại `scripts/ensure-pnpm.mjs`; lệnh cài đặt bằng npm hoặc yarn sẽ bị từ chối để tránh tạo lockfile không đồng nhất.

## 3. Cài đặt lần đầu

### Bước 1: lấy mã nguồn

```bash
git clone https://github.com/nWind9218/van-lang-su-ki.git
cd van-lang-su-ki
```

### Bước 2: tạo cấu hình local

PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env.local
```

macOS/Linux:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env.local
```

- `.env` chỉ cấu hình các container local.
- `frontend/.env.local` chỉ chứa biến public của giao diện.
- `backend/.env.local` chứa kết nối database, MinIO, SMTP và khóa OpenAI.
- Không commit bất kỳ file `.env` hoặc `.env.local` nào.

### Bước 3: cài package

```bash
pnpm install
```

Trong CI hoặc khi cần bảo đảm dependency khớp tuyệt đối với lockfile:

```bash
pnpm install --frozen-lockfile
```

### Bước 4: chạy database và dịch vụ local

```bash
pnpm services:up
docker compose ps
```

Lần chạy đầu Docker sẽ tạo database, các bảng mẫu và một người chơi demo. Script trong `infra/postgres/init` chỉ tự chạy khi volume PostgreSQL được tạo mới.

| Dịch vụ | URL/port | Ghi chú |
| --- | --- | --- |
| Frontend | http://localhost:3000 | Next.js |
| Backend API | http://localhost:4000 | Fastify |
| PostgreSQL | localhost:5432 | Kết nối bằng `DATABASE_URL` |
| Adminer | http://localhost:8080 | System: PostgreSQL, Server: `db` |
| MinIO API | http://localhost:9000 | Endpoint S3-compatible |
| MinIO Console | http://localhost:9001 | Quản lý bucket và asset |
| Mailpit | http://localhost:8025 | Xem email thử nghiệm |

### Bước 5: chạy cả frontend và backend

```bash
pnpm dev
```

Mở http://localhost:3000 và kiểm tra backend tại http://localhost:4000/api/health.

Có thể chạy riêng từng ứng dụng:

```bash
pnpm dev:frontend
pnpm dev:backend
```

## 4. Lệnh thường dùng

```bash
pnpm install         # cài dependency cho toàn workspace
pnpm dev             # chạy frontend và backend song song
pnpm dev:frontend    # chỉ chạy Next.js
pnpm dev:backend     # chỉ chạy Fastify
pnpm lint            # kiểm tra code trong toàn workspace
pnpm typecheck       # kiểm tra TypeScript của hai ứng dụng
pnpm build           # build frontend và backend
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
├─ frontend/                        # ứng dụng Next.js
│  ├─ .env.example                 # biến public của frontend
│  └─ src/app/
│     ├─ _components/              # component gắn với trang chủ
│     ├─ admin/                    # admin mini
│     └─ avatar/                   # màn 3D tải theo nhu cầu
├─ backend/                         # dịch vụ REST API Fastify
│  ├─ .env.example                 # database, storage, email và AI
│  └─ src/
│     ├─ routes/
│     │  ├─ health.ts              # health check
│     │  ├─ progress.ts            # đọc/ghi tiến trình demo
│     │  └─ tutor.ts               # gia sư AI
│     └─ server/
│        ├─ db/                    # Drizzle schema và PostgreSQL adapter
│        ├─ env.ts                 # kiểm tra biến môi trường
│        └─ storage.ts             # MinIO/S3 adapter
├─ infra/
│  └─ postgres/init/               # schema/seed khi tạo volume mới
├─ docs/
│  ├─ requirements/                # requirement chuẩn của Version 0
│  ├─ references/                  # tài liệu đầu vào
│  └─ ARCHITECTURE.md              # ranh giới frontend/backend
├─ assets/references/               # ảnh tham chiếu ban đầu
├─ .agents/skills/
│  └─ karpathy-guidelines/         # coding guidelines dùng trong repository
├─ .github/workflows/
│  └─ ci.yml                       # CI cho push và pull request vào main
├─ .codegraph/                      # metadata local cho CodeGraph
├─ .codex/config.toml               # cấu hình CodeGraph MCP cho Codex
├─ AGENTS.md                        # quy tắc CodeGraph và coding agent
├─ .env.example                     # cấu hình Docker Compose
├─ docker-compose.yml               # PostgreSQL, MinIO, Mailpit, Adminer
├─ CHANGELOGS.md                    # lịch sử thay đổi
├─ scripts/
│  └─ ensure-pnpm.mjs              # từ chối npm/yarn, chỉ cho phép pnpm
├─ package.json                     # pin pnpm và lệnh dùng chung
├─ pnpm-lock.yaml                   # lockfile duy nhất của repository
└─ pnpm-workspace.yaml              # khai báo và cấu hình workspace
```

## 6. API backend mẫu

Base URL local: `http://localhost:4000`.

### Health check

```bash
curl http://localhost:4000/api/health
```

### Đọc tiến trình người chơi demo

```bash
curl http://localhost:4000/api/progress
```

### Cập nhật một nhiệm vụ

```bash
curl -X PATCH http://localhost:4000/api/progress \
  -H "Content-Type: application/json" \
  -d '{"questId":"bach-dang-938","status":"in_progress","progress":{"step":1}}'
```

### Gọi gia sư AI

Điền `OPENAI_API_KEY` trong `backend/.env.local`, sau đó:

```bash
curl -X POST http://localhost:4000/api/ai/tutor \
  -H "Content-Type: application/json" \
  -d '{"question":"Vì sao địa hình sông Bạch Đằng có lợi?","context":"Ngô Quyền cho đóng cọc ngầm và lợi dụng thủy triều."}'
```

Khóa OpenAI chỉ được đọc trong backend và không được dùng tiền tố `NEXT_PUBLIC_`.

## 7. Quy trình thay đổi

1. Chạy `codegraph status` và `codegraph sync` trước khi tra cứu code.
2. Tạo nhánh theo mục tiêu, ví dụ `feature/quest-map` hoặc `fix/mobile-controls`.
3. Cập nhật code và thêm migration nếu schema thay đổi.
4. Ghi thay đổi vào mục `Unreleased` của `CHANGELOGS.md`.
5. Chạy `pnpm check` và `codegraph sync` trước khi tạo pull request.
6. Nêu rõ cách kiểm thử và ảnh hưởng đến dữ liệu trong pull request.

## 8. Chuyển dịch vụ local lên cloud sau này

- PostgreSQL: đổi `DATABASE_URL`; nếu chuyển Supabase, giữ schema SQL rồi thay adapter trong `backend/src/server/db`.
- MinIO: đổi endpoint/credential hoặc thay implementation trong `backend/src/server/storage.ts`.
- Mailpit: thay cấu hình SMTP trong `backend/.env.local` bằng nhà cung cấp email thật.
- OpenAI: đặt secret trong môi trường deploy backend; không đưa khóa vào frontend.

Chi tiết nằm trong `docs/ARCHITECTURE.md`. Tài liệu yêu cầu chuẩn nằm trong `docs/requirements/DAU_AN_DAI_VIET_AI_REQUIREMENTS_VERSION_0.docx`; tài liệu nguồn nằm trong `docs/references`.

## 9. Trạng thái Version 0

Base project hiện cung cấp hai ứng dụng tách biệt, giao diện khởi đầu, gameplay mẫu, API mẫu và hạ tầng local. Xác thực người dùng, CMS đầy đủ, RAG trên kho tri thức và pipeline tối ưu GLB là các hạng mục tiếp theo, chưa phải tính năng production hoàn chỉnh.

## 10. CodeGraph và coding agent

Repository đã cấu hình CodeGraph MCP tại `.codex/config.toml`, quy tắc làm việc tại `AGENTS.md` và skill Karpathy tại `.agents/skills/karpathy-guidelines/SKILL.md`.

Sau khi clone lần đầu:

```bash
codegraph index
```

Quy trình hằng ngày:

```bash
codegraph status
codegraph sync
codegraph explore "Mô tả luồng hoặc symbol cần tìm"
codegraph impact <symbol>
```

Sau khi thay đổi code, chạy lại `codegraph sync` và xác nhận index đã cập nhật.

## 11. Continuous Integration

Workflow `.github/workflows/ci.yml` tự chạy khi push hoặc tạo pull request vào `main`, đồng thời hỗ trợ chạy thủ công từ tab Actions.

CI sử dụng pnpm 11.19.0 và Node.js 22 trên Ubuntu, với quyền GitHub token chỉ đọc. Mỗi run thực hiện:

1. Cài dependency bằng `pnpm install --frozen-lockfile`.
2. Chạy `pnpm lint`.
3. Chạy `pnpm typecheck`.
4. Chạy `pnpm build`.
5. Kiểm tra cấu hình bằng `docker compose config --quiet`.

Các run cũ trên cùng branch sẽ được hủy khi có commit mới để tiết kiệm thời gian CI.
