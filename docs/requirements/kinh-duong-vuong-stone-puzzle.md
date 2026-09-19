# Kế hoạch triển khai thử thách Phiến đá Kinh Dương Vương

Trạng thái: **DRAFT — chờ người dùng duyệt, chưa triển khai**  
Phạm vi: `map2` — **Cổng Huyền Sử**, stage PostgreSQL **M01**  
Loại phiên: PLAN; tài liệu này không cho phép tự động chạy migration, seed hoặc sửa mã sản phẩm.

## 1. Mục tiêu và lát cắt phát hành

Người chơi đi tới phiến đá trên `map2`, mở một lượt M01 gồm 10 câu hỏi lấy từ PostgreSQL, trả lời từng câu và được thử lại câu sai. Khi hoàn thành đủ 10 câu đúng, trạng thái được lưu riêng theo tài khoản và NPC dẫn chuyện xuất hiện tại map2 để người chơi tương tác.

Kế hoạch chia làm hai bước nhưng chỉ được coi là sẵn sàng phát hành sau khi cả hai đạt Definition of Done:

1. **SHIP CORE — vertical slice:** map2-only marker, tải M01, UI câu hỏi, retry có chủ ý, resume bằng localStorage, hoàn thành và hiện NPC; khóa nút/ref phía client chống double-click cơ bản.
2. **HARDENING — các mục `[BLOCK]`:** idempotency bền vững qua timeout/refresh, kiểm tra contract và dữ liệu thiếu, lỗi mạng/retry, isolation theo account, API/unit/E2E tests.

Không xây abstraction puzzle dùng chung. Tên map, stage, vị trí marker và NPC là cấu hình cục bộ của feature Kinh Dương Vương.

## 2. Bằng chứng hiện trạng

- Runtime tải map theo flow cố định `vanlang` và `state.selectedMap`; portal chỉ commit `selectedMap` sau khi scene đích ready (`frontend/src/app/_components/vanlang-game-shell.tsx:203-270`, `:273-302`). Vì vậy điều kiện kích hoạt bắt buộc là `mapDocument.mapId === "map2"`, không dựa vào tên hiển thị.
- Progress gameplay hiện dùng một key chung `vanlang-game-mock-v4`, trong khi chỉ cờ rebirth được scope bằng `accountId` (`vanlang-game-shell.tsx:55`, `:90-122`, `:192-200`). Puzzle phải có storage riêng, versioned và account-scoped để không làm rộng migration state cũ.
- Tương tác hiện chọn NPC gần nhất, mở `DialogState`, khóa chuyển động khi dialog/drawer mở và truyền toàn bộ state xuống `VanlangDungeonScreen` (`vanlang-game-shell.tsx:392`, `:465-518`, `:727-765`). Đây là seam để thêm stone interaction và puzzle modal.
- `VanlangDungeonScreen` đã có lớp dialog có keyboard/touch, focusable actions và prompt tương tác (`frontend/src/app/_components/vanlang-dungeon-screen.tsx:98-208`, `:240-341`). Puzzle nên tái dùng quy ước accessibility/focus này, không nhét logic fetch vào world renderer.
- `VanlangDungeonWorld` render runtime NPC từ `document.npcs` và portal, nhưng hiện chưa có khái niệm puzzle marker hay visibility theo progress (`frontend/src/app/_components/vanlang-dungeon-world.tsx:75-110`, `:313`). Core chỉ thêm marker/NPC primitive có điều kiện cho feature này; không đổi map contract.
- `MapNpcSchemaV3` chỉ mô tả NPC tĩnh và mọi `document.npcs` đều được render; schema không có điều kiện unlock (`packages/map-contract/src/map-document.ts:96-139`). Vì thế không thêm field puzzle/visibility vào `MapDocument` trong phạm vi này.
- `GET /api/questions/stage/:code` lấy câu theo stage, random trong nhóm difficulty, trả dữ liệu không có đáp án đúng; `POST /api/questions/answer` xác thực đáp án, trả feedback/đáp án đúng và luôn insert một `learning_attempt` (`backend/src/routes/questions.ts:19-94`, `:97-135`). API hiện chưa có idempotency key.
- Migration `004_questions.sql` tạo `stages` và `questions`, gồm FK stage, 4 mức độ, 4 options và review status (`backend/src/server/db/migrations/004_questions.sql:4-45`). Seed chính thức đọc `c1-stages.json` và `c1-questions.json`, insert trong transaction với `ON CONFLICT DO NOTHING` (`backend/src/server/db/seeds/seed-questions.ts:41-96`).
- Seed M01 hiện có 30 câu `pending_review`; cấu hình một lượt là 10 câu theo tỷ lệ `recognize: 4`, `understand: 3`, `apply: 2`, `challenge: 1`, `enemyHp: 100`, `damagePerCorrect: 10`.
- E2E hiện đã có helper login, vào dungeon, chỉnh localStorage, test NPC Space/touch và test portal commit/rollback/refresh (`tests/e2e/dungeon-rebirth.spec.ts:11-53`, `:74-137`, `:337-425`). Test puzzle mở rộng chính file này để giữ cùng journey.
- Live PostgreSQL `van_lang_su_ki` (PostgreSQL 17.11) đang healthy. `schema_migrations` chỉ có `002_map_documents.sql` và `003_map_flows.sql`; `stages` và `questions` không tồn tại. **Migration `004_questions.sql` hiện chưa được áp dụng.** Map live `map2` đang ở revision 18, tên `Cổng Huyền Sử`, thuộc flow `vanlang` revision 41, và hiện có 0 object/0 NPC/1 portal.

## 3. Quyết định phạm vi

### Core

- Chỉ hoạt động khi map runtime có `mapId === "map2"`; không kích hoạt trên `vanlang` hoặc map khác dù metadata trùng tên.
- Stone marker và NPC hoàn thành dùng primitive/HTML marker hiện có trong Three.js, không phụ thuộc asset mới và không sửa live map revision.
- Nguồn câu hỏi duy nhất ở runtime là `GET /api/questions/stage/M01` từ PostgreSQL. `questions_template.json` không phải và không được phép trở thành nguồn/fallback.
- Một run giữ nguyên snapshot 10 câu đã nhận; refresh không bốc lại bộ câu mới.
- Sai được thử lại đúng câu hiện tại. Đúng mới chuyển câu tiếp theo. Hoàn thành khi cả 10 câu trong snapshot đã được trả lời đúng.
- Completion chỉ lưu local theo account; không cấp reward, không mở portal và không ghi quest/account progress ở backend.

### Hardening bắt buộc trước khi ship

- Idempotency từ client tới PostgreSQL cho mỗi lần submit có chủ ý.
- Contract validation cho response, số lượng câu và options.
- Retry rõ ràng cho load/submit error mà không đổi run hoặc tạo attempt mới ngoài ý muốn.
- Khôi phục an toàn từ JSON hỏng, schema cũ, account không khớp và request đang dở.
- API tests và E2E bao phủ duplicate submit, refresh, account isolation và completion reveal.

## 4. State machine

| State | Ý nghĩa | Sự kiện hợp lệ | State kế tiếp |
|---|---|---|---|
| `unavailable` | Không ở `map2` | portal commit vào `map2` | `stone_ready` hoặc state đã restore |
| `stone_ready` | Phiến đá hiện, chưa có run | vào bán kính + Space/touch | `loading_run` |
| `loading_run` | Đang GET M01, input di chuyển bị khóa | đủ đúng 10 câu | `question_ready` |
| `loading_run` | như trên | lỗi/contract sai | `load_error` |
| `load_error` | Không tạo partial run | retry | `loading_run` |
| `question_ready` | Hiện câu hiện tại, cho chọn 1 option | submit | `submitting` |
| `submitting` | Disable options/nút; có `attemptId` ổn định | response sai | `wrong_feedback` |
| `submitting` | như trên | response đúng, còn câu | `correct_feedback` |
| `submitting` | như trên | response đúng, hết câu | `completing` |
| `submitting` | timeout/network/server error | retry cùng `attemptId` | `submit_error` rồi `submitting` |
| `wrong_feedback` | Hiện feedback, correct option, explanation | “Thử lại” | `question_ready` cùng question, tạo attempt mới ở lần submit kế |
| `correct_feedback` | Khóa câu đã đúng | “Câu tiếp theo” | `question_ready` với index + 1 |
| `completing` | Ghi completion local atomically | ghi thành công | `completed` |
| `completed` | Ẩn phiến đá tương tác, hiện NPC | tương tác NPC | dialogue hiện hữu; state vẫn `completed` |

Quy tắc bổ sung:

- Rời map2 đóng UI nhưng không xóa run. Quay lại map2 restore state.
- Refresh ở `question_ready`, `wrong_feedback`, `correct_feedback` giữ nguyên run/index/kết quả đã xác nhận.
- Refresh ở `submitting`/`submit_error` phục hồi request đang dở và chỉ cho retry bằng đúng `attemptId`; không tự động phát POST nền.
- Dialog, drawer, portal transition hoặc puzzle modal đang mở đều khóa movement/interact để tránh hai interaction cùng lúc.
- `completed` là terminal trong core. Replay/reset riêng cho puzzle là `[LATER]`.

## 5. Quy tắc chọn và retry câu hỏi

1. Khi bắt đầu run mới, client gọi đúng một lần `GET /api/questions/stage/M01`.
2. Backend tiếp tục là nơi chọn ngẫu nhiên. Kỳ vọng M01 trả đúng 10 ID duy nhất theo distribution 4/3/2/1. Client không tự random, không đọc seed JSON và không dùng `questions_template.json`.
3. Client kiểm tra `stage.code === "M01"`, `questions.length === stage.questionsPerRun === 10`, ID không trùng và mỗi câu có đúng 4 options. Sai contract thì vào `load_error`, không lưu partial run.
4. Snapshot public của 10 câu được lưu cùng run để refresh không làm đổi đề. Snapshot tuyệt đối không chứa `correctOptionIndex` trước khi server trả lời.
5. Người chơi phải chọn option trước khi submit. Trong lúc submit, toàn bộ options và nút submit bị khóa.
6. Trả lời sai: giữ nguyên `currentQuestionIndex`; hiện `feedback`, `correctOptionIndex`, `generalExplanation`; nút “Thử lại” trả về cùng câu. Lần thử lại có chủ ý tạo một `attemptId` mới.
7. Trả lời đúng: câu được đánh dấu solved và không thể submit lại; chỉ nút “Câu tiếp theo” tăng index.
8. Load error được retry GET chỉ khi chưa có snapshot hợp lệ. Submit error retry POST cùng payload và cùng `attemptId`.
9. Backend phải xác nhận question thuộc stage M01 khi xử lý answer; không chấp nhận ID của stage khác trong run M01.

## 6. localStorage versioned và account-scoped

Key đề xuất:

```text
vanlang:kinh-duong-vuong-stone:v1:<encodeURIComponent(accountId)>
```

Payload logic:

```ts
type KinhDuongVuongStoneSaveV1 = {
  version: 1;
  accountId: string;
  mapId: "map2";
  stageCode: "M01";
  status: "stone_ready" | "question_ready" | "wrong_feedback" |
    "correct_feedback" | "submitting" | "submit_error" | "completed";
  runId: string | null;
  questions: Array<{
    id: string;
    sortOrder: number;
    topic: string;
    difficultyLevel: string;
    questionText: string;
    options: string[];
    hint: string | null;
    damage: number;
  }>;
  currentQuestionIndex: number;
  solvedQuestionIds: string[];
  selectedOptionIndex: number | null;
  lastFeedback: null | {
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
    correctOptionIndex: number;
    damage: number;
    feedback: string;
    generalExplanation: string | null;
  };
  inFlightAttempt: null | {
    attemptId: string;
    questionId: string;
    selectedOptionIndex: number;
  };
  completedAt: string | null;
  updatedAt: string;
};
```

Restore rules:

- Parse và validate shape/version; `payload.accountId` phải bằng prop `accountId` hiện tại, `mapId` phải là `map2`, `stageCode` phải là `M01`.
- Bản ghi sai JSON/version/account/ID/index được bỏ riêng cho puzzle và trở về `stone_ready`; không xóa `vanlang-game-mock-v4` hoặc storage của account khác.
- Ghi `inFlightAttempt` trước khi POST. Chỉ clear sau response hợp lệ; đây là điều kiện để retry đúng `attemptId` sau timeout/refresh.
- Ghi `completedAt` và `status: completed` trước khi render NPC. Nếu storage write thất bại, hiện lỗi và không công bố completion giả.
- Không đưa `dialog`, focus state, loading flag hoặc AbortController vào storage.

## 7. Chống submit trùng

### Core guard phía client

- Handler kiểm tra `submittingRef` đồng bộ trước khi gọi `setState`, không chỉ dựa vào disabled prop.
- Mỗi lần nhấn submit có chủ ý tạo đúng một UUID `attemptId`, persist payload rồi mới gọi API.
- Double-click, Space/Enter lặp và touch đồng thời trong cùng request đều no-op.
- Câu đã đúng hoặc không khớp `currentQuestion.id` không được submit.

### Hardening bền vững phía server `[BLOCK]`

- Thêm migration kế tiếp (không sửa lại migration 004) để bổ sung `client_attempt_id` unique và `selected_option_index` cho `learning_attempts`.
- `POST /api/questions/answer` nhận `attemptId`, `stageCode`, `questionId`, `selectedOptionIndex`; validate UUID và stage membership.
- Insert theo unique `client_attempt_id`. Request lặp cùng payload trả lại cùng kết quả và không tạo row thứ hai; cùng `attemptId` nhưng payload khác trả `409 ATTEMPT_ID_REUSED`.
- Xử lý concurrent duplicate trong transaction/upsert, không dùng check-then-insert không khóa.
- Response có cờ `recorded` hoặc semantics tương đương để test được lần đầu và replay.
- `DEMO_PLAYER_ID` vẫn được dùng theo kiến trúc hiện tại. Không triển khai account persistence backend trong feature này.

## 8. Luồng hoàn thành và NPC

1. Server xác nhận câu thứ 10 đúng.
2. Client cập nhật solved set, xác minh 10 ID duy nhất đều solved, rồi vào `completing`.
3. Persist `completed` cho đúng `accountId`.
4. Đóng puzzle modal, phiến đá chuyển sang trạng thái không tương tác/đã giải, và NPC Kinh Dương Vương (hoặc tên nội dung được duyệt) xuất hiện tại vị trí cấu hình trên map2.
5. `VanlangDungeonWorld` chỉ render NPC completion khi `mapId === "map2" && puzzle.status === "completed"`; trước đó NPC không có trong scene/accessibility tree.
6. Proximity logic của shell đưa NPC vào prompt Space/touch. Tương tác mở dialogue hiện hữu; không có reward, cutscene, portal unlock hay backend quest update.
7. Refresh, rời/quay lại map2 và đăng nhập lại cùng account vẫn thấy NPC. Account khác trên cùng browser không thấy NPC nếu chưa hoàn thành.

Core dùng primitive/marker và dialogue text, không import GLB/image. Asset, VFX và animation được để ngoài phạm vi.

## 9. Phân loại edge cases

### `[BLOCK]` — phải giải quyết trước khi feature được coi là done

- Migration 004 và seed M01 chưa có trong môi trường đích: API phải được rollout sau migration/seed có kiểm chứng; UI phải fail rõ ràng nếu 404/DB schema thiếu.
- Bộ M01 không đủ đúng 10 câu, ID trùng, option count sai hoặc stageCode sai: chặn bắt đầu, không tạo partial run.
- Double submit/timeout/retry tạo nhiều `learning_attempts`: áp dụng UUID idempotency và unique constraint như mục 7.
- Question ID không thuộc M01: backend từ chối, tránh ghi attempt sai stage.
- Refresh giữa submit: giữ cùng `attemptId`; không tự coi là sai/đúng và không bốc run mới.
- localStorage dùng nhầm account hoặc bị hỏng: bỏ riêng record puzzle, không rò completion giữa tài khoản.
- Chỉ map2 được kích hoạt; đi portal hoặc load lỗi không làm mất/hoàn thành run.
- NPC không được xuất hiện trước khi completion đã persist thành công.
- Dữ liệu production chưa được duyệt: deployment production phải đổi/kiểm chứng M01 `review_status = approved`; việc route hiện chấp nhận `pending_review` chỉ phù hợp dev/staging và cần quyết định rõ trước release.
- Bảo toàn baseline chưa commit: mọi patch implementation phải được review theo file/hunk, không format hoặc revert các thay đổi đang có ở game shell, dungeon screen/world, map client, map contract và các file editor.

### `[LATER]` — backlog hardening/polish sau lát cắt phát hành

- Đồng bộ UI realtime giữa nhiều tab; unique idempotency vẫn bảo vệ DB, tab cũ có thể yêu cầu reload.
- Replay/reset run đã hoàn thành và lịch sử nhiều run.
- Analytics ngoài `learning_attempts`, dashboard tác giả và telemetry funnel.
- VFX, animation nứt/sáng phiến đá, âm thanh riêng, model/portrait NPC mới.
- Prefetch M01 trước khi tương tác phiến đá.
- Offline queue và đồng bộ lại khi có mạng.
- Tổng quát hóa thành puzzle framework hoặc map-authored puzzle schema.

### OUT OF SCOPE

- Viết code trong phiên PLAN này.
- Chạy migration hoặc seed thật trong phiên PLAN này.
- Import asset.
- Backend account persistence hoặc thay `DEMO_PLAYER_ID` bằng account thật.
- Reward, cutscene, mở/khóa portal hoặc thay đổi quest progression.
- Generic puzzle framework.
- VFX/animation nâng cao.
- Sửa nội dung 30 câu M01 hoặc dùng `questions_template.json`.
- Refactor progress global `vanlang-game-mock-v4` ngoài phần tích hợp tối thiểu của puzzle.

## 10. Danh sách file dự kiến chạm tới khi được duyệt

### Core

- `frontend/src/app/_components/vanlang-game-shell.tsx`: owner state machine, map2/proximity guard, persistence và API orchestration.
- `frontend/src/app/_components/vanlang-dungeon-screen.tsx`: puzzle modal, feedback, keyboard/touch/focus và props completion.
- `frontend/src/app/_components/vanlang-dungeon-screen.css`: layout responsive/accessibility cho modal và marker states.
- `frontend/src/app/_components/vanlang-dungeon-world.tsx`: render stone marker và NPC completion dạng primitive, chỉ trên map2.
- `frontend/src/app/_lib/map-api-client.ts`: thêm typed GET M01/POST answer tối thiểu, tái dùng `API_BASE_URL` và error convention hiện có.
- `tests/e2e/dungeon-rebirth.spec.ts`: journey map2, puzzle, retry, refresh, account isolation và NPC reveal.
- `CHANGELOGS.md`: ghi thay đổi user-visible sau khi implementation hoàn tất.

### Hardening/database

- `backend/src/routes/questions.ts`: stage membership, `attemptId`, replay idempotent và error contract.
- `backend/src/routes/questions.test.ts` (mới): API selection/validation/idempotency tests.
- `backend/src/server/db/schema.ts`: map cột idempotency mới của `learning_attempts`.
- `backend/src/server/db/migrations/005_question_attempt_idempotency.sql` (mới): cột/index unique; không rewrite 004.
- `backend/package.json`: chỉ thêm script `db:seed:questions` nếu đội muốn lệnh chuẩn hóa thay vì gọi seed entrypoint trực tiếp.

### Dữ liệu được dùng nhưng không dự kiến sửa

- `backend/src/server/db/migrations/004_questions.sql`.
- `backend/src/server/db/seeds/seed-questions.ts`.
- `backend/src/server/db/seeds/c1-stages.json` và `c1-questions.json`.
- `packages/map-contract/src/map-document.ts`: đã khảo sát; không cần đổi vì generic puzzle schema là out of scope.
- Live map2 revision 18: không mutate; marker/NPC thuộc feature runtime để tránh ghi đè dữ liệu map đang thay đổi.

## 11. Chiến lược bảo toàn thay đổi chưa commit

Baseline khảo sát có 21 tracked files đã sửa và 2 untracked files. Trong đó các seam đang dirty gồm `vanlang-game-shell.tsx`, `vanlang-dungeon-screen.tsx`, `vanlang-dungeon-world.tsx`, `map-api-client.ts` và `map-document.ts`.

Khi implementation được duyệt:

1. Chụp lại `git status --short --branch` và `git diff --stat`; lưu danh sách baseline trong handoff, không stash/reset/checkout.
2. Với mỗi file dirty phải đọc current on-disk source và diff hiện hữu trước khi patch; patch theo hunk nhỏ, bám source hiện tại.
3. Không chạy formatter toàn repo, không sửa whitespace hoặc adjacent code, không đụng ảnh evidence/editor changes.
4. Sau từng phase, dùng `git diff -- <file>` để chứng minh chỉ có hunk puzzle; so lại danh sách untracked để không ghi đè file người dùng.
5. Nếu hunk cần sửa đã thay đổi tiếp trong lúc làm, dừng file đó và rebase patch thủ công lên baseline mới; tuyệt đối không khôi phục phiên bản từ HEAD.
6. `packages/map-contract/src/map-document.ts` đang dirty nhưng kế hoạch không cần sửa; giữ nguyên byte-for-byte.

## 12. Definition of Done

- [ ] Trên map2, người chơi tới gần phiến đá và mở puzzle bằng Space hoặc touch; map khác không có puzzle.
- [ ] Run lấy từ PostgreSQL stage M01 qua API, đúng 10 câu duy nhất theo contract; không dùng JSON frontend hay `questions_template.json`.
- [ ] Không leak đáp án đúng trước submit.
- [ ] Sai hiển thị feedback và cho retry cùng câu; đúng mới cho sang câu tiếp.
- [ ] Double-click/key repeat/concurrent request và retry sau timeout không tạo duplicate `learning_attempts`.
- [ ] Refresh ở mọi state quan trọng khôi phục đúng run/index/feedback/in-flight attempt cho đúng account.
- [ ] Hoàn thành đủ 10 câu persist trước, sau đó mới hiện NPC; NPC tiếp tục hiện sau refresh và không hiện với account khác.
- [ ] Không phát reward, cutscene, portal unlock, backend account progress hay asset/VFX mới.
- [ ] API trả lỗi rõ cho missing M01, insufficient pool, invalid stage/question và reused attemptId khác payload.
- [ ] Migration/seed rollout được kiểm chứng trên dev/staging và có bằng chứng rollback rehearsal trước production.
- [ ] Unit/API/E2E tests mục 13 pass; `pnpm lint`, `pnpm typecheck`, `pnpm build` pass.
- [ ] `codegraph sync` đã chạy sau thay đổi code và `codegraph status` báo up to date.
- [ ] `CHANGELOGS.md` được cập nhật sau implementation; baseline chưa commit của người dùng được bảo toàn.

## 13. Checklist test

### API/database

- [ ] GET M01 trả metadata đúng và 10 ID duy nhất; distribution 4/3/2/1 khi pool đủ.
- [ ] GET không trả `correctOptionIndex`, feedback arrays hoặc field nội bộ.
- [ ] GET unknown stage/insufficient pool trả lỗi có mã ổn định.
- [ ] POST đúng/sai trả đúng damage/feedback/explanation và chỉ chấp nhận question thuộc M01.
- [ ] Hai POST concurrent cùng `attemptId` + cùng payload tạo đúng một row và cùng kết quả.
- [ ] Reuse `attemptId` với payload khác trả 409, không insert.
- [ ] Seed chạy lại không tăng số stage/question ngoài dữ liệu mong đợi.

### State/localStorage

- [ ] JSON hỏng, version khác, account khác và index ngoài range đều reset riêng puzzle an toàn.
- [ ] Snapshot không đổi sau refresh; không gọi lại GET khi run hợp lệ đang dở.
- [ ] Submit error giữ question/selection/attemptId; retry không nhân row.
- [ ] Wrong retry tạo attempt mới chỉ sau thao tác người dùng; correct question không submit lại.
- [ ] Completion persist trước NPC reveal.

### E2E/UI

- [ ] Portal tới map2, marker chỉ xuất hiện ở Cổng Huyền Sử và có prompt Space/touch.
- [ ] Loading, empty/error, wrong feedback, correct feedback và progress `n/10` đều có accessible status.
- [ ] Focus vào modal, Escape policy rõ ràng, movement khóa khi modal mở và focus trả về hợp lý khi đóng.
- [ ] Hoàn thành 10 câu làm NPC xuất hiện và tương tác dialogue được bằng Space/touch.
- [ ] Refresh giữa run và sau completion đúng; account B không thừa hưởng account A.
- [ ] Portal rời/quay lại không mất run; API failure không teleport/reset progress.
- [ ] Viewport desktop/mobile không tràn nội dung dài.

### Lệnh verification dự kiến

```powershell
pnpm --dir backend test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e -- tests/e2e/dungeon-rebirth.spec.ts
codegraph sync
codegraph status
```

Chỉ chạy `pnpm install --frozen-lockfile` nếu có thay đổi dependency/workspace config. Luôn dùng pnpm 11.19.0; không dùng npm/yarn/bun/npx.

## 14. Checklist rollout và rollback database

### Trước rollout (sau khi được duyệt, không phải phiên PLAN)

- [ ] Backup/snapshot DB hoặc ít nhất export `schema_migrations`, `stages`, `questions`, `learning_attempts` counts và schema.
- [ ] Xác nhận lại live `schema_migrations`; hiện tại 004 chưa áp dụng.
- [ ] Review migration 004 và migration idempotency mới; chạy trên dev/staging trước.
- [ ] Chạy migrator chuẩn `pnpm --dir backend db:migrate`; xác nhận đúng migration rows, constraints và indexes.
- [ ] Chạy seed questions bằng script chuẩn hóa đã duyệt; xác nhận M01 có 30 source rows và stage config 10/4-3-2-1.
- [ ] Smoke GET M01 và POST bằng test transaction/account demo; ghi evidence row-count trước/sau.
- [ ] Không seed production khi 30 câu M01 vẫn `pending_review` nếu chưa có phê duyệt nội dung.

### Rollback

- [ ] Tắt/rollback frontend feature trước để không tiếp tục gọi contract mới.
- [ ] Với migration idempotency mới: dừng writer, backup các cột mới, drop unique constraint/index rồi drop `client_attempt_id`/`selected_option_index` trong transaction; xóa đúng row migration tương ứng chỉ sau khi DDL rollback thành công.
- [ ] Với seed M01: xóa `questions WHERE stage_code = 'M01'` trước rồi xóa stage M01, chỉ khi xác nhận không có dữ liệu nghiệp vụ cần giữ; ưu tiên restore snapshot thay vì xóa nếu đã có traffic thật.
- [ ] Với migration 004: chỉ drop `questions`/`stages` và xóa `004_questions.sql` khỏi `schema_migrations` khi toàn bộ consumer đã rollback và không có stage khác; không dùng `services:reset` vì sẽ xóa volume rộng.
- [ ] Không xóa `learning_attempts` hiện hữu. Nếu attempts M01 đã phát sinh, export/giữ lại hoặc xóa theo ID/time window được duyệt, không dùng câu lệnh broad.
- [ ] Sau rollback, chạy schema/read-only checks, API smoke và `docker compose config --quiet`; ghi lại row counts và migration list.

## 15. Điểm cần duyệt trước SHIP CORE

1. Chấp nhận flow 10 câu, sai retry cùng câu cho tới đúng, completion khi đủ 10/10.
2. Chấp nhận marker/NPC primitive không asset cho core và tên NPC/dialogue cụ thể sẽ được content owner duyệt.
3. Chấp nhận thêm migration idempotency kế tiếp thay vì sửa migration 004.
4. Xác nhận policy môi trường: `pending_review` chỉ dùng dev/staging; production yêu cầu `approved`.
5. Duyệt danh sách file và chiến lược giữ nguyên dirty baseline trước khi mở phiên implementation mới.

Sau khi các điểm trên được duyệt, thực hiện từng phase trong session mới: **SHIP CORE**, rồi **HARDENING**, không gộp polish/LATER vào cùng PR.
