# Import GLB NPC tối ưu và đặt hội thoại trong Map Editor

Trạng thái: **APPROVED — sẵn sàng cho SHIP CORE, chưa triển khai product code**

PR dự kiến: `feat: import optimized GLB NPCs with dialogue placement`

## 1. Mục tiêu và phạm vi đã khóa

PR này là một vertical slice local/internal:

1. Editor upload một file GLB, backend validate và tối ưu đồng bộ, rồi phục vụ bản runtime qua URL relative cùng origin của frontend.
2. Editor dùng asset vừa import để thêm một NPC 3D gồm ID, tên, transform và đúng một đoạn hội thoại.
3. NPC được chọn và di chuyển bằng translation gizmo X/Y/Z; ô số và gizmo dùng chung một nguồn state.
4. Save Flow hiện hữu lưu NPC cùng Map Document; runtime render NPC, phát hiện NPC gần player và mở hội thoại typewriter bằng Space hoặc nút cảm ứng.
5. Map V1/V2 và NPC mock/binding hiện hữu tiếp tục chạy mà không rewrite revision lịch sử.

Không xây asset CMS, dialogue engine hay animation editor. Upload asset và save map là hai thao tác độc lập: upload thành công **không** tạo map revision.

## 2. Điều kiện nền và bằng chứng repository

- Branch nền đã có `2e076bb feat: add atomic map flows and portal transitions`; working tree lúc khảo sát chỉ có `test-results/` untracked. Đây là baseline của spec này.
- `packages/map-contract/src/map-document.ts:65-109` có Map Document V1/V2 và `upgradeMapDocument`; V1 được nâng thành V2 trong memory, không rewrite revision cũ. `SaveMapRequestSchema` và `SaveMapFlowRequestSchema` hiện chỉ nhận V2.
- `packages/map-contract/src/map-document.ts:34-63` có `model3d` và optional `binding: { type: "npc", entityId }`, nhưng tên/hội thoại NPC vẫn nằm ngoài map document.
- `packages/map-contract/src/map-validation.ts:16-58` đã kiểm tra unique object/binding, polygon, spawn, entry point và portal. Đây là boundary để thêm validation NPC.
- `backend/src/server/maps/map-repository.ts:69-104` và `backend/src/server/maps/map-flow-repository.ts` tạo immutable map revisions bằng checksum/ETag; schema version ghi hiện đang là `2`.
- `backend/src/server/storage.ts:1-16` chỉ tạo S3 client cho MinIO và chưa có asset route/store đang dùng. `backend/src/app.ts:10-27` có body limit 1 MiB, CORS và các route map/flow, chưa đăng ký multipart hoặc asset serving.
- `frontend/src/app/admin/maps/map-editor-shell.tsx:28-43` dùng asset catalog hard-code và tạo `model3d`; inspector đã có `NumberField`, dirty tracking và giữ local draft khi save lỗi. Viewport 3D tái sử dụng `VanlangDungeonWorld`.
- `frontend/src/app/_components/vanlang-dungeon-world.tsx:34-40` load model bằng `useGLTF`; `frontend/src/app/_components/vanlang-mock-data.ts:25-36,132-171` giữ NPC/hội thoại cũ; `vanlang-dungeon-screen.tsx:85-90,200-209` đã có dialogue shell, typewriter state và nút cảm ứng.
- `frontend/next.config.ts:1-10` chưa có rewrite cho runtime asset. `package.json:27` đã pin `@gltf-transform/cli@4.5.0`; `scripts/filter-glb-runtime.mjs` đã biết đọc GLB v2 và lọc animation nhưng chưa phải upload pipeline.
- `tests/e2e/map-editor.spec.ts:12-87` đã mock save/conflict và kiểm tra chỉnh transform GLB; `tests/e2e/dungeon-rebirth.spec.ts` đã có helpers vào dungeon/đặt player. Đây là hai seam E2E cần mở rộng.

CodeGraph báo index up to date trước khảo sát: 59 files, 721 nodes, 1,754 edges.

## 3. Quyết định kiến trúc tối thiểu

### 3.1 Không tạo asset catalog/database trong PR này

V0 chỉ cần import, deduplicate và dùng ngay asset trong map. Tên file runtime được derive từ SHA-256 của **bytes GLB nguồn**:

```text
<ASSET_STORAGE_DIR>/glb/<sha256>.glb
/runtime-assets/glb/<sha256>.glb
```

- File tồn tại là record dedupe; không thêm bảng asset, migration hay repository metadata.
- Hai upload cùng bytes trả cùng `checksum` và `src`; upload sau trả `reused: true`.
- Tên gốc chỉ dùng trong response/log, không tham gia path và không được lưu làm filename.
- Ghi file bằng temp file trong cùng filesystem rồi publish atomically với create-if-absent. Request cạnh tranh không overwrite file hoàn chỉnh.
- File temp được xóa ở mọi nhánh success/failure. File runtime chỉ xuất hiện sau khi validate, optimize và post-validate đều pass.

Không tái sử dụng `getStorageClient()` trong PR local này. MinIO/S3 adapter, asset catalog và chuyển storage provider là follow-up riêng; không tạo interface nhiều backend khi hiện chỉ có local store.

### 3.2 Runtime same-origin

- Backend cung cấp `GET /api/assets/glb/:checksum.glb`, stream đúng file trong storage root, `Content-Type: model/gltf-binary`, `ETag` từ checksum và cache immutable.
- Frontend thêm rewrite `/runtime-assets/:path*` tới `${NEXT_PUBLIC_API_BASE_URL}/api/assets/:path*`.
- Map document chỉ lưu `/runtime-assets/glb/<checksum>.glb`. URL nhìn từ browser là relative cùng origin và tiếp tục pass `assetPath` rule hiện hữu.
- Không ghi vào `frontend/public` lúc runtime; thư mục build/source không phải mutable storage.

### 3.3 Cấu hình local

Thêm vào backend env schema và `.env.example`:

```text
ASSET_STORAGE_DIR=.runtime/assets
ASSET_UPLOAD_MAX_BYTES=67108864
```

- Relative storage dir resolve từ backend working directory; production deployment/public storage ngoài scope.
- Thêm `backend/.runtime/` vào `.gitignore`.
- Upload limit 64 MiB áp dụng tại multipart stream, không tăng global JSON body limit 1 MiB.
- Startup/create route bảo đảm `glb/` và temp dir tồn tại; lỗi permission trả lỗi có cấu trúc, không làm app crash sau startup.

## 4. Upload API và GLB pipeline

### 4.1 API contract

`POST /api/admin/assets/glb`, `multipart/form-data`, đúng một field `file`:

```ts
type ImportGlbResponse = {
  checksum: string;          // lowercase SHA-256, 64 hex chars
  src: string;               // /runtime-assets/glb/<checksum>.glb
  originalBytes: number;
  runtimeBytes: number;
  reused: boolean;
  summary: {
    scenes: number;
    meshes: number;
    skins: number;
    morphTargets: number;
    animations: string[];
  };
};
```

- Dùng write gate `MAP_EDITOR_WRITE_ENABLED` và production guard hiện hữu giống map mutation routes.
- `201` khi tạo runtime asset mới; `200` khi checksum đã có và asset hiện hữu pass basic integrity check.
- Không gọi map repository, không nhận `mapId`/ETag và không tạo map/flow revision.
- Các lỗi tối thiểu: `ASSET_UPLOAD_DISABLED` (403), `GLB_FILE_REQUIRED` (400), `GLB_TOO_LARGE` (413), `GLB_INVALID` (422), `GLB_OPTIMIZE_FAILED` (422), `ASSET_STORAGE_FAILED` (500).
- Response lỗi không chứa absolute filesystem path hoặc stderr thô.

Dependency mới duy nhất dự kiến là `@fastify/multipart` trong `backend/package.json`. Pipeline tái sử dụng `@gltf-transform/cli@4.5.0` đã pin ở root; gọi bằng `execFile`/argument array, không qua shell và chỉ với temp paths do server tạo.

### 4.2 Pipeline đồng bộ

1. Stream upload vào temp file, đồng thời tính SHA-256 và byte count; abort ngay khi vượt limit.
2. Kiểm tra GLB magic `glTF`, version `2`, chunk bounds, JSON chunk và BIN chunk.
3. Parse JSON chunk; reject URI ngoài file (`buffers[].uri` hoặc `images[].uri`) để runtime asset tự chứa đầy đủ.
4. Lấy semantic snapshot nguồn: scene/mesh/skin, số joint mỗi skin, morph target mỗi primitive, animation name và channel target path.
5. Chạy glTF Transform optimize một lần với texture WebP tối đa 1K và Meshopt. Không lọc clip, không rename node/bone/animation và không dùng bước làm mất morph/skin.
6. Parse output lần nữa; bắt buộc giữ nguyên số skin, joint counts, morph target counts, animation count/name/channel paths. Bất kỳ invariant nào giảm hoặc parse lỗi đều fail import.
7. Chạy validator/inspect của glTF Transform trên output; warning được log, error làm fail.
8. Publish atomically vào checksum path. Nếu request khác đã thắng race, bỏ temp output và trả asset hiện hữu với `reused: true`.

`scripts/filter-glb-runtime.mjs` không được dùng trên upload vì script đó cố ý xóa animation ngoài allow-list, trái Definition of Done. Có thể tách helper đọc JSON chunk từ script, nhưng không refactor script nếu không cần.

### 4.3 BLOCK và LATER của pipeline

- `[BLOCK]` File giả GLB, GLB hỏng/truncated, external URI hoặc vượt limit không được tạo runtime file.
- `[BLOCK]` Optimize phải giữ skin, skeleton/joints, morph targets và toàn bộ animation; post-validation là điều kiện publish.
- `[BLOCK]` Dedupe và concurrent identical upload không được tạo nhiều URL/file hoặc file partial.
- `[BLOCK]` Optimize/storage failure không mutate Map Editor document đang mở.
- `[LATER]` Queue, progress, resume, batch upload, delete và garbage collection.
- `[LATER]` S3/MinIO adapter và production CDN.

## 5. Map contract V3 và compatibility

### 5.1 Data model tối thiểu

NPC visual mới là dữ liệu top-level, không ép vào `MapObject` và không tạo dialogue registry riêng:

```ts
type MapNpcV3 = {
  id: Slug;
  name: string;              // 1..120
  src: AssetPath;            // /runtime-assets/glb/<sha256>.glb
  transform: Transform3D;
  dialogue: string;          // 1..2000, đúng một đoạn tuyến tính
};

type MapDocumentV3 = Omit<MapDocumentV2, "schemaVersion"> & {
  schemaVersion: 3;
  npcs: MapNpcV3[];          // tối đa 128
};
```

Lý do chọn top-level `npcs`:

- Một record đáp ứng trực tiếp ID, tên, GLB, transform và hội thoại; không cần join object/dialogue.
- Không làm phình `MapObject` cho logic tương tác và không tạo binding hai chiều dễ lệch.
- Runtime/editor có thể render NPC mới độc lập trong khi giữ nguyên bridge NPC cũ.
- Interaction radius dùng hằng số runtime `NPC_INTERACTION_RADIUS` (đề xuất `1.25` world units), chưa đưa thêm field cấu hình.

### 5.2 Upgrade tuần tự

- `MapDocumentSchema` trở thành union V1/V2/V3; normalized `MapDocument` là V3.
- `upgradeMapDocument` thực hiện V1 → V2 như hiện tại, sau đó V2 → V3 bằng `npcs: []`; V3 được structured-clone.
- Bundled `vanlang.v1.json` và revision V1/V2 trong DB không bị sửa/checksum lại. Read envelope normalize trong memory; lần save tiếp theo mới ghi V3.
- Mọi write request mới chỉ nhận V3; map repository và flow repository ghi `schema_version = 3` thay vì hard-code `2`.
- Clone map giữ `npcs` như giữ objects/navmesh, vì NPC ID là map-local; behavior xóa portals hiện hữu không đổi.
- `MapRevisionEnvelopeSchema` vẫn trả normalized V3 cho editor/runtime.

### 5.3 Validation

- NPC ID unique trong `npcs`; đồng thời không trùng `objects[].binding.entityId` để tránh hai NPC cùng identity trong compatibility bridge.
- `src` phải pass same-origin `assetPath`; ở V0 contract không HEAD/check filesystem khi save.
- Transform finite, scale dương theo `Transform3DSchema`; `dialogue` sau trim phải còn nội dung.
- X/Z phải pass kiểm tra điểm hợp lệ trên enabled walkable area và không nằm trong collider chặn. Dùng helper geometry thuần với radius `0`, không fetch asset.
- Y là finite; lúc tạo NPC luôn khởi tạo `document.world.groundY`, sau đó translation gizmo cho phép chỉnh Y.
- Validation issue có `npcId`, code `DUPLICATE_NPC_ID`, `NPC_ID_CONFLICT`, `INVALID_NPC_POSITION` hoặc structural path cụ thể.

### 5.4 NPC cũ

Compatibility bridge trong runtime tạo hai nguồn:

1. `document.npcs`: NPC V3 mới, hội thoại generic.
2. `objects[].binding.type === "npc"`: resolve về `dungeonNpcs` hiện hữu và giữ nguyên quest/boss/timekeeper behavior.

Vì V1/V2 upgrade thành `npcs: []`, toàn bộ NPC cũ tiếp tục render/tương tác như trước. Không chuyển `dungeonNpcs`, quest hoặc progression sang V3 trong PR này.

## 6. Editor UX và translation gizmo

### 6.1 Import và tạo NPC

- Thay catalog GLB hard-code bằng section “NPC GLB” tối thiểu: file input, nút Import, trạng thái importing/error và metadata response gần nhất.
- Import success chỉ chọn `src` vừa nhận; document/dirty state chưa đổi.
- Nút “Thêm NPC” yêu cầu ID, tên và dialogue. Record mới dùng selected `src`, X/Z = `navigation.spawn`, Y = `world.groundY`, rotation 0 và scale 1.
- Nếu spawn không pass NPC position rule, không thêm record và hiển thị validation; không tự chọn một vị trí khó đoán.
- Add NPC chỉ mutate local draft. Save/Save Flow hiện hữu mới tạo revision.

### 6.2 Selection và gizmo

- `MapViewport` nhận selected NPC ID và callbacks select/change. Click NPC trong 3D chọn record tương ứng.
- Dùng `TransformControls` của Drei ở `mode="translate"`; không thêm rotation/scale gizmo.
- Trong lúc drag, object ref cập nhật trực quan; mỗi change ghi `{x,y,z}` về draft. Numeric fields đọc cùng draft nên đồng bộ sau mỗi event.
- Khi Orbit/camera control được thêm hoặc hiện hữu, disable nó trong lúc gizmo dragging để tránh hai interaction cùng nhận pointer.
- X/Z update chỉ commit nếu vị trí hợp lệ; invalid drag/numeric edit giữ giá trị hợp lệ gần nhất và hiện lỗi inline. Y chỉ áp dụng finite bounds contract.
- Inspector NPC chỉ có ID read-only sau create, tên, src read-only, dialogue textarea và Position X/Y/Z. Không thêm animation, rotation, scale, collider, copy/paste hoặc undo UI.

### 6.3 Error preservation

- Upload state tách khỏi `document`; upload fail không reset envelope/draft/selection.
- GLB preview load fail hiển thị placeholder/error cho NPC đó, không remount/reset `MapEditorShell`.
- Save 412/422/5xx giữ behavior hiện hữu: draft NPC/hội thoại và asset selection còn nguyên.
- Reset chỉ reset map draft về envelope như hiện tại; không xóa runtime asset vừa upload.

## 7. Runtime render, nearby detection và hội thoại

### 7.1 Render

- `VanlangDungeonWorld` render `document.npcs` bằng component `RuntimeNpcModel` riêng.
- Clone cached GLTF scene bằng `SkeletonUtils.clone`, không dùng `scene.clone(true)` cho skinned NPC. Điều này giữ skeleton binding và morph target state trên mỗi instance.
- Áp dụng transform từ NPC record. Không chọn/phối animation; clips vẫn nằm nguyên trong asset để follow-up sử dụng.
- Existing `MapModel`, legacy bound model/NPC beacon và map object behavior không đổi.

### 7.2 Nearby NPC

- Shell derive danh sách runtime NPC từ V3 và legacy bridge, rồi chọn NPC gần nhất trong interaction radius bằng khoảng cách X/Z.
- Nếu hai NPC cùng khoảng cách, sort theo ID để deterministic. Validation ngăn trùng ID giữa hai nguồn.
- Recompute khi player/map document thay đổi; portal commit/exit dungeon đóng generic dialogue và xóa nearby state map cũ.
- Movement không cần NPC collider/navmesh động trong PR này.

### 7.3 Dialogue

- Mở generic dialogue khi nearby NPC V3 và user nhấn `Space`, trừ khi focus đang ở input/textarea/button hoặc một modal/dialog khác đang giữ input.
- Nút “Tương tác” cảm ứng hiện hữu gọi cùng `onInteract`; disabled khi không có nearby NPC.
- Dialogue dùng card accessibility hiện hữu, speaker = NPC name, text hiển thị typewriter. Space/click khi đang gõ hiện toàn bộ; thao tác tiếp theo đóng.
- Legacy NPC tiếp tục đi vào state quest/boss/timekeeper hiện hữu, không bị generic handler thay thế.
- Escape đóng generic dialogue. Trong khi dialogue mở, movement và portal interaction bị khóa như modal gameplay.

## 8. API/data flow

```text
GLB file
  -> POST /api/admin/assets/glb
  -> temp + sha256 -> validate -> optimize -> post-validate
  -> <ASSET_STORAGE_DIR>/glb/<sha>.glb
  -> /runtime-assets/glb/<sha>.glb (frontend rewrite)
  -> Add NPC vào local MapDocumentV3 draft
  -> Save Flow hiện hữu -> immutable map revision V3
  -> runtime load V3 -> render/detect/interact/typewriter
```

Failure trước bước Save Flow không thay đổi map revision. Failure của upload/preview/save không xóa local document đang chỉnh.

## 9. Test strategy

### 9.1 Contract/unit

- V1 fixture → V3: giữ objects/bindings, default entry/portals hiện hữu và thêm `npcs: []`; input fixture không mutate.
- V2 → V3 và V3 round-trip/canonicalization deterministic.
- NPC valid giữ transform/dialogue; duplicate ID, conflict legacy binding, empty dialogue, invalid path/scale/XZ đều fail đúng code/path/npcId.
- X/Z boundary trong/ngoài walkable polygon và collider có unit test geometry.
- Existing map-flow/collision tests pass không cần rewrite fixtures.

### 9.2 Backend asset tests

- Valid animated/skinned/morph GLB trả 201, runtime URL GET 200 và summary/invariants còn nguyên.
- Upload cùng bytes lần hai trả 200, cùng checksum/src, `reused: true`; concurrent pair chỉ để lại một final file.
- Bad magic, truncated chunks, non-v2, external URI, oversize và optimizer failure trả đúng status/code, không có final/partial file.
- Storage failure dọn temp và không lộ path/stderr.
- Write gate off trả 403 trước khi chạy optimizer.
- GET checksum sai/không tồn tại trả 400/404; ETag/If-None-Match và immutable cache được kiểm tra.
- Route tests dùng temp directory riêng và injected runner function; không chạy optimizer thật ở mọi test. Có một integration fixture nhỏ chạy pipeline thật.

### 9.3 Editor E2E

- Import success không gọi save map/flow; response asset được chọn.
- Add NPC tạo X/Z tại spawn, Y = groundY và dirty state.
- Click NPC, kéo từng trục X/Y/Z; Position inputs đổi. Sửa input; gizmo/model đổi tương ứng.
- Invalid X/Z không commit; error rõ và draft trước đó còn nguyên.
- Save/reload trả lại đúng NPC, transform và dialogue.
- Upload/preview/save failure giữ document và dialogue đang chỉnh; chụp success/failure evidence.

### 9.4 Runtime E2E

- Runtime fetch same-origin asset URL và render NPC V3 không có console GLTF/Three error.
- Player ngoài radius: Space/nút disabled không mở dialogue. Player trong radius: Space mở đúng speaker/text typewriter.
- Click/Space khi typewriter đang chạy hiện toàn bộ; đóng rồi movement hoạt động lại.
- Nút cảm ứng mở cùng dialogue path.
- Portal/map reload đóng dialogue cũ; NPC V3 của map mới được derive lại.
- Regression: NPC guide/boss/timekeeper cũ và quest flow hiện hữu vẫn hoạt động.

### 9.5 Verification bắt buộc trong phiên implementation

- `pnpm install --frozen-lockfile` sau khi thêm `@fastify/multipart`/lockfile.
- Unit/API/pipeline tests liên quan.
- Playwright editor/runtime success và failure cases, kèm evidence.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `docker compose config --quiet` chỉ khi Compose bị sửa; plan hiện không cần sửa Compose.
- `git diff --check`
- `codegraph sync`, sau đó `codegraph status` phải up to date.

## 10. File ownership và thứ tự để giảm conflict

Không triển khai song song các nhóm cùng sửa contract hoặc `VanlangDungeonWorld`.

### Slice A — contract, owner duy nhất

- `packages/map-contract/src/map-document.ts`
- `packages/map-contract/src/map-validation.ts`
- `packages/map-contract/src/collision.ts` nếu cần export helper point validity
- `packages/map-contract/src/index.ts`
- test contract mới/cập nhật

Hoàn tất Slice A và sync CodeGraph trước khi backend/editor/runtime bắt đầu.

### Slice B — asset backend, không sửa editor/runtime

- `backend/package.json`, `pnpm-lock.yaml`
- `backend/src/server/env.ts`, `backend/.env.example`, `.gitignore`
- mới: `backend/src/server/assets/local-glb-store.ts`
- mới: `backend/src/server/assets/glb-pipeline.ts`
- mới: `backend/src/routes/assets.ts` và tests
- `backend/src/app.ts`
- `frontend/next.config.ts` chỉ cho rewrite

Không sửa `backend/src/server/storage.ts`; S3 follow-up ngoài scope.

### Slice C — editor, owner duy nhất của editor shell/CSS/E2E editor

- `frontend/src/app/_lib/map-api-client.ts`
- `frontend/src/app/admin/maps/map-editor-shell.tsx`
- `frontend/src/app/admin/maps/map-editor.css`
- `tests/e2e/map-editor.spec.ts`

### Slice D — runtime, owner duy nhất của dungeon components/E2E runtime

- `frontend/src/app/_components/vanlang-dungeon-world.tsx`
- `frontend/src/app/_components/vanlang-game-shell.tsx`
- `frontend/src/app/_components/vanlang-dungeon-screen.tsx`
- CSS tương ứng nếu accessibility/layout tối thiểu cần thiết
- `tests/e2e/dungeon-rebirth.spec.ts`

### Slice E — integration/handoff

- `backend/src/server/maps/map-repository.ts`
- `backend/src/server/maps/map-flow-repository.ts`
- tests repository/flow liên quan cho schema version 3
- `CHANGELOGS.md`
- full verification và evidence

Hai repository files ở Slice E được sửa sau contract để tránh hai owner cùng thay hard-coded schema version.

## 11. Definition of Done

- [ ] Upload một GLB hợp lệ và tạo runtime asset same-origin.
- [ ] Giữ skin, skeleton, morph target và animation.
- [ ] Import trùng nội dung tái sử dụng asset theo checksum.
- [ ] Thêm NPC gồm ID, tên, GLB, transform và một đoạn hội thoại.
- [ ] Chọn và kéo NPC theo X/Y/Z; ô số đồng bộ với gizmo.
- [ ] X/Z phải thuộc walkable area; Y khởi tạo bằng `groundY`.
- [ ] Save/reload giữ nguyên NPC và hội thoại.
- [ ] Player đến gần và dùng Space hoặc nút cảm ứng để mở hội thoại typewriter.
- [ ] Existing maps và NPC cũ tiếp tục hoạt động.
- [ ] Upload không tự tạo map revision.
- [ ] Lỗi không làm mất document đang chỉnh.

## 12. OUT OF SCOPE

- Authentication và public deployment.
- Background queue, progress và resume upload.
- Batch upload, delete asset và garbage collection.
- Branching dialogue, quest, reward, AI hoặc combat.
- Animation selection/blending.
- Rotation/scale gizmo.
- Auto collider, LOD và dynamic navmesh.
- Undo/redo và copy/paste NPC.
- Portal hoặc map graph.

Ngoài ra không thêm asset catalog, S3/MinIO provider switch, thumbnail generator, license workflow hoặc hot reload asset trong PR này.

## 13. Rủi ro và biện pháp

| Rủi ro | Mức | Biện pháp trong scope |
| --- | --- | --- |
| Optimizer vô tình xóa skin/morph/clip | BLOCK | Semantic snapshot trước/sau; fail closed trước publish |
| Hai upload giống nhau race | BLOCK | Checksum path + atomic create-if-absent; test concurrent |
| GLB tham chiếu file ngoài | BLOCK | Reject external URI; chỉ nhận self-contained GLB |
| Runtime URL khác origin frontend | BLOCK | Relative `/runtime-assets/...` + Next rewrite + E2E request assertion |
| Schema V3 làm hỏng revision V1/V2 | BLOCK | Upgrade tuần tự, không rewrite lịch sử, fixture regression |
| Gizmo tạo X/Z ngoài navmesh | BLOCK | Validate mỗi update và giữ last-valid transform |
| Skinned model clone sai | BLOCK | `SkeletonUtils.clone` và fixture skinned integration test |
| Optimize sync làm request lâu | Chấp nhận V0 | File limit 64 MiB; queue/progress để follow-up |
| Asset orphan sau upload nhưng chưa save | Chấp nhận V0 | GC/delete ngoài scope; content-addressed file tránh duplicate |
| Local disk mất giữa các lần chạy/deploy | Chấp nhận V0 | Local/internal only; production storage ngoài scope |

## 14. Dependency và migration/data compatibility

- Dependency mới dự kiến: `@fastify/multipart` cho backend.
- Reuse: `@gltf-transform/cli@4.5.0`, Drei/R3F/Three hiện có; không thêm gizmo library.
- Database migration: **không cần** cho asset vì dedupe dựa trên filesystem checksum.
- Data migration: thêm Map Document V3 bằng adapter V1 → V2 → V3; không backfill/rewrite DB.
- Persistence change: mọi map revision mới ghi schema version 3; map-flow schema vẫn version 1.
- Runtime storage `.runtime/assets` bị ignore; không commit binary upload.

## 15. Quyết định reviewer đã khóa

Các BLOCK sau đã được duyệt và không còn là câu hỏi implementation:

1. Giới hạn upload là **64 MiB**; texture tối ưu thành **WebP tối đa 1K**.
2. NPC mới dùng `navigation.spawn` làm X/Z ban đầu và `world.groundY` làm Y ban đầu.
3. GLB có external URI bị reject; backend không tải hoặc tự nhúng dependency ngoài file.
4. Pipeline giữ **toàn bộ** animation trong GLB; animation selection/blending vẫn ngoài scope.

Backlog `[LATER]` không làm trong PR này:

- Catalog để tìm lại asset đã upload sau browser reload. Asset đã gắn trong map vẫn load/save bình thường.
- Interaction radius cấu hình theo từng NPC. PR này dùng hằng số `1.25`.

## 16. Tóm tắt handoff

File dự kiến thay đổi tập trung ở contract V3, asset route/local store/pipeline, Next rewrite, editor NPC inspector/gizmo, runtime render/dialogue và hai E2E specs. Không có DB migration; compatibility được giữ bằng upgrade tuần tự và bridge NPC cũ. Dependency mới duy nhất dự kiến là multipart. Rủi ro chính là semantic preservation của GLB, filesystem race, same-origin rewrite và schema regression; mỗi rủi ro BLOCK đều có test tương ứng.

Đây là bản draft để review. Duyệt hoặc chỉnh các câu hỏi BLOCK trước khi mở phiên SHIP CORE; dùng một session mới cho implementation để tránh scope/session phình ra.
