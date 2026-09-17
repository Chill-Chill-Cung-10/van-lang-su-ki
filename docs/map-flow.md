# Map Flow: tạo map và di chuyển qua directed portal

Trạng thái: **IMPLEMENTED — PR 1 + hardening**
PR: `feat(map-flow): create maps and traverse linked portals`
Time-box của phiên này: 20–30 phút; không viết product code, migration hay dependency.

## 1. Mục tiêu và phạm vi đã khóa

PR này bổ sung một vertical slice duy nhất:

1. Map Editor tạo map mới bằng cách clone active revision của một map đang có, rồi đặt node mới vào flow graph.
2. Editor hiển thị/chỉnh directed portal giữa các map và lưu toàn bộ thay đổi bằng một thao tác **Save Flow** atomic.
3. Runtime tải snapshot của flow, phát hiện trigger trên map nguồn, tải đúng revision của map đích và đặt player tại entry point đích.
4. Map V1 hiện tại, gồm fixture `vanlang.v1.json`, tiếp tục đọc được qua adapter V1 → V2; không rewrite revision lịch sử.

Mục tiêu tối thiểu là luồng clone → nối portal → Save Flow → traverse hai chiều có kiểm soát. Không mở rộng Map Editor thành công cụ quản trị nội dung tổng quát.

### 1.1 BLOCK trong PR này

- `[BLOCK]` Snapshot flow phải pin đúng revision của mọi map node; không được trộn graph mới với map revision cũ.
- `[BLOCK]` Save Flow phải all-or-nothing khi thay đổi nhiều map.
- `[BLOCK]` Stale flow ETag hoặc stale map ETag phải trả conflict trước khi ghi bất kỳ revision nào.
- `[BLOCK]` Portal target mất, entry point không tồn tại/không hợp lệ, trigger nguồn không reachable, map/portal ID trùng hoặc document sai schema phải làm cả Save Flow thất bại.
- `[BLOCK]` Runtime load/asset/scene failure phải giữ nguyên map nguồn và vị trí nguồn.
- `[BLOCK]` Runtime phải chặn double dispatch, bounce loop và transition đệ quy giữa hai portal đối diện.
- `[BLOCK]` Clone phải atomic với việc thêm node vào flow; retry/conflict không được tạo map mồ côi.
- `[BLOCK]` V1 database revision và bundled `vanlang` fixture vẫn load/play được.

### 1.2 OUT OF SCOPE

Giữ toàn bộ Global OUT OF SCOPE đã duyệt cho Map Editor, với ngoại lệ duy nhất là **create-by-clone** được prompt này đưa vào scope. Cụ thể không làm:

- Viết hoặc thử implementation trong phiên PLAN này.
- Tạo map trống, template catalog, import/export map, xóa map, đổi `mapId` hoặc duplicate flow.
- Upload/asset management hoặc thêm/sửa asset binary.
- Animation-path editor, rigid-body physics, A*, NPC pathfinding.
- Undo/redo, autosave, graph auto-layout, drag animation, minimap, transition cinematic mới hoặc editor/runtime polish.
- Draft/publish/approval workflow, scheduled activation, rollback UI hoặc history browser.
- Multiplayer, collaborative editing, presence, merge UI hoặc hot-swap flow/map vào session đang chơi.
- Production admin authentication/authorization; V0 write gate local/internal hiện có vẫn là điều kiện tiên quyết.
- Thay đổi NPC/quest content model, progression hoặc world-map dynasty unlock.
- Xóa API single-map hiện tại trong PR này; editor mới không dùng API đó cho thay đổi liên-map.

## 2. Bằng chứng repository và ràng buộc hiện tại

- `packages/map-contract/src/map-document.ts:65-101`: contract hiện chỉ có `MapDocumentSchemaV1`; envelope/save request cũng khóa ở V1.
- `packages/map-contract/src/map-validation.ts:16-49`: validation hiện chỉ kiểm tra nội-map (ID, polygon, spawn) và canonicalization hướng polygon; chưa có validation liên-map.
- `backend/src/server/maps/map-repository.ts:16-104`: repository chỉ có list/load/save một map; mỗi save mở transaction riêng, lock một row `maps`, so một ETag và tạo một immutable revision.
- `backend/src/routes/maps.ts:19-65`: API hiện có list/load và `PUT /api/admin/maps/:mapId`; stale ETag trả `412 MAP_REVISION_CONFLICT`.
- `backend/src/server/db/migrations/002_map_documents.sql`: `maps` trỏ `active_revision_id`; `map_revisions` unique `(map_id, revision)` và giữ `schema_version`, JSON document, checksum.
- `backend/src/server/db/seed-maps.ts:6-37`: seed `vanlang.v1.json` là idempotent và không overwrite khi map đã có revision.
- `frontend/src/app/admin/maps/map-editor-shell.tsx:117-184`: editor giữ một envelope/document, dirty-check bằng canonical JSON và save một map với một ETag; conflict giữ local draft.
- `frontend/src/app/_lib/map-api-client.ts:24-49`: client chỉ list/load/save map; runtime fallback chỉ cho `mapId === "vanlang"` bằng bundled V1 fixture.
- `frontend/src/app/_components/vanlang-game-shell.tsx:179-191`: runtime load document khi vào dungeon nhưng chưa có transition state machine; lỗi load chỉ ghi `mapLoadError`.
- `frontend/src/app/_components/vanlang-navmesh.ts`: movement đã nhận `MapDocument`, dùng `resolveMovement`/`nearestValidPoint`; fallback spawn lấy từ fixture V1.
- `frontend/src/app/_components/vanlang-dungeon-world.tsx:42-57,171-181`: navmesh/render/camera đều lấy từ document; scene readiness hiện chỉ là callback sau Suspense.
- `frontend/src/app/_components/vanlang-cinematic-loader.tsx:23-72`: loader hiện preload tài nguyên Văn Lang một lần, nuốt lỗi tài nguyên và có minimum screen time; không phù hợp để xác nhận portal transition thành công.
- `backend/src/routes/maps.test.ts:9-109` và `tests/e2e/map-editor.spec.ts:12-70`: đã có memory API, round-trip/ETag/error coverage và editor save mock; đây là seam để mở rộng test.

CodeGraph báo index current tại thời điểm khảo sát: 54 files, 592 nodes, 1,310 edges. Các truy vấn `explore` đã lần theo `validateMapDocument`, `MapsRepository.save`, `mapsRoutes`, `MapEditorShell`, `loadRuntimeMap`, `VanlangGameShell`, `VanlangDungeonWorld`, `NavmeshSurface`, `VanlangCinematicLoader` và các caller/test liên quan.

## 3. Contract được đề xuất

### 3.1 Map document V2

V2 kế thừa toàn bộ trường V1 và thêm hai khái niệm. Tên field dưới đây là contract cần khóa trong implementation:

```ts
type EntryPointV2 = {
  id: Slug;
  position: Vec2;       // world X/Z
  facingDeg: number;    // yaw khi player xuất hiện
};

type DirectedPortalV2 = {
  id: Slug;
  enabled: boolean;
  trigger: {
    type: "circle";     // chỉ circle trong PR này
    center: Vec2;       // world X/Z trên map nguồn
    radius: number;
  };
  target: {
    mapId: Slug;
    entryPointId: Slug;
  };
};

type MapDocumentV2 = Omit<MapDocumentV1, "schemaVersion"> & {
  schemaVersion: 2;
  navigation: MapDocumentV1["navigation"] & {
    entryPoints: EntryPointV2[];
  };
  portals: DirectedPortalV2[];
};
```

Quyết định contract:

- **Portal nằm trong map nguồn** (`document.portals`). Vì trigger dùng hệ tọa độ/navmesh nguồn và thay đổi portal phải tạo revision cho map nguồn.
- **Entry point nằm trong map đích** (`document.navigation.entryPoints`). Một entry có thể được nhiều portal trỏ tới.
- Portal là directed. Hai chiều cần hai portal độc lập; graph cycle được phép.
- V1 `navigation.spawn` vẫn là spawn khi vào map từ world-map/reset; portal transition luôn dùng entry point được chỉ định.
- Trigger V0 chỉ là circle để tái sử dụng toán học khoảng cách và tránh mở rộng polygon editing. Polygon/box trigger là `[LATER]`.

### 3.2 Flow graph V1

Graph có schema/version riêng, không dùng `MapDocument.schemaVersion`:

```ts
type MapFlowNodeV1 = {
  mapId: Slug;
  mapRevision: number;       // revision immutable được snapshot pin
  position: { x: number; y: number }; // normalized [0, 1] trong graph editor
};

type MapFlowDocumentV1 = {
  schemaVersion: 1;
  flowId: Slug;
  nodes: MapFlowNodeV1[];
};
```

- Node position chỉ phục vụ graph editor và nằm trong flow revision, không nằm trong map document.
- Edge không lưu lặp trong graph document; edge được derive từ `portals` của map revision mà node pin. Source of truth duy nhất cho edge là portal nguồn.
- Mỗi immutable flow revision pin `mapRevision` của từng node. Vì vậy runtime có thể tải snapshot nhất quán ngay cả khi endpoint legacy làm active revision của một map thay đổi sau đó.
- Flow envelope có `revision`, `etag`, `activatedAt`, `document`, tương tự map envelope. Flow ETag được tính từ `flowId + revision + checksum(canonical flow document)`.

## 4. Schema version, migration và fallback

### 4.1 Contract compatibility

- `MapDocumentSchema` trở thành discriminated union V1/V2; export type input union và một normalized runtime/editor type V2.
- Thêm hàm thuần `upgradeMapDocument(input)`:
  - V2: validate/canonicalize và trả nguyên nghĩa.
  - V1: giữ mọi field cũ, đổi `schemaVersion` thành `2`, thêm `portals: []`, thêm entry `{ id: "default", position: navigation.spawn, facingDeg: 0 }`.
- Không mutate JSON đầu vào và không rewrite checksum/revision V1 trong DB.
- Mọi read path cho editor/runtime normalize V1 → V2 sau khi parse. Mọi write mới lưu V2 và `map_revisions.schema_version = 2`.
- `packages/map-contract/maps/vanlang.v1.json` giữ nguyên để chứng minh backward compatibility. Bundled fallback parse V1 rồi chạy cùng adapter; không tạo một fixture V2 trùng dữ liệu trong PR này.

### 4.2 Database migration kế tiếp

Thêm migration mới, không sửa `002_map_documents.sql` đã áp dụng:

- `map_flows(flow_id PK, display_name, active_revision_id, created_at, updated_at)`.
- `map_flow_revisions(id UUID PK, flow_id FK RESTRICT, revision > 0, schema_version, document JSONB, checksum, created_by, created_at, UNIQUE(flow_id, revision), UNIQUE(flow_id, id))`.
- Composite deferred FK từ `(flow_id, active_revision_id)` đến `(flow_id, id)`, cùng pattern với maps.
- Index revision history theo `(flow_id, created_at DESC)`.

Không cần sửa bảng/revision V1 hiện có. Seed idempotent bảo đảm flow mặc định (đề xuất `vanlang`) tồn tại và node đầu tiên pin active revision hiện tại của map `vanlang`; nếu flow đã có revision thì skip, không overwrite thay đổi người dùng.

Migration chạy trong transaction của migration runner hiện tại. Failure rollback toàn migration và không ghi `schema_migrations`; không reset volume.

## 5. API và repository

### 5.1 Read API

- `GET /api/map-flows/:flowId` → flow envelope và summary node; hỗ trợ `If-None-Match`.
- `GET /api/map-flows/:flowId/maps/:mapId` → map envelope đúng `mapRevision` được active flow snapshot pin, không mặc định lấy `maps.active_revision_id`.
- `GET /api/maps` và `GET /api/maps/:mapId` giữ tương thích cho list/legacy consumer.

### 5.2 Create-by-clone

`POST /api/admin/map-flows/:flowId/maps` với:

```ts
{
  sourceMapId: string;
  mapId: string;
  metadata: { name: string; description: string; thumbnailSrc?: string };
  nodePosition: { x: number; y: number };
  expectedSourceMapEtag: string;
}
```

Header `If-Match` chứa flow ETag. Server:

1. Lock flow row rồi source map row theo thứ tự quy định.
2. Recheck flow/source ETag và `mapId` chưa tồn tại.
3. Clone source active document qua adapter V2; đổi `mapId`/metadata; giữ world, objects, navigation và entry points; **xóa `portals`** để không vô tình nhân bản liên kết.
4. Tạo map + revision 1, thêm graph node pin revision 1, tạo và activate flow revision mới trong cùng transaction.
5. Trả `201` gồm map envelope và flow envelope mới.

Nếu retry sau success với cùng `mapId`, trả `409 MAP_ALREADY_EXISTS`; client reload flow để xác định kết quả. Không thêm idempotency-key trong PR này. Nếu conflict/failure trước commit, không có map/node/revision mồ côi.

### 5.3 Atomic Save Flow

`PUT /api/admin/map-flows/:flowId` là API duy nhất Editor dùng cho thay đổi graph/portal liên-map:

```ts
{
  document: MapFlowDraftV1; // nodes có mapId + position; server điền revision mới
  maps: Array<{
    mapId: string;
    expectedEtag: string;
    document: MapDocumentV2;
  }>;
}
```

Header `If-Match` chứa base flow ETag. `maps` chỉ gồm map dirty, nhưng mỗi item bắt buộc có ETag đã load từ active flow snapshot.

Server thực hiện trong **một PostgreSQL transaction trên một connection**:

1. Parse structural contract, reject duplicate map IDs và path/size vượt giới hạn trước `BEGIN` khi có thể.
2. `BEGIN`; lock `map_flows` row, sau đó mọi `maps` row liên quan theo `map_id ASC` để tránh deadlock.
3. Recheck flow ETag trước; sau đó recheck ETag của từng dirty map đối với revision đang được base flow pin.
4. Resolve tất cả node: dirty document dùng draft; node không dirty dùng immutable revision đang pin. Kiểm tra target/entry/trigger liên-map trên tập snapshot hoàn chỉnh.
5. Canonicalize; insert revision mới chỉ cho map dirty.
6. Tạo flow revision mới với node positions và map revision numbers đã resolve.
7. Update `maps.active_revision_id` cho map dirty và `map_flows.active_revision_id`.
8. `COMMIT`; chỉ sau commit mới trả envelopes/ETags mới.

Bất kỳ lỗi insert/update/validation/conflict nào chạy `ROLLBACK`; không revision nào được activate, không response giả thành công. Immutable rows đã insert trong transaction cũng biến mất sau rollback.

### 5.4 ETag và conflict

- Flow ETag phát hiện thay đổi graph, node set/position hoặc snapshot membership.
- Per-map ETag phát hiện map dirty bị sửa qua flow khác/tab khác hoặc endpoint legacy.
- Server không “last write wins”, không partial merge và không tự retry.
- `412 FLOW_REVISION_CONFLICT` khi flow ETag stale; `412 MAP_REVISION_CONFLICT` kèm danh sách `mapIds` khi một hay nhiều map stale. Không trả document server đầy đủ trong lỗi.
- `409 MAP_ALREADY_EXISTS` dành cho clone ID collision; `404 FLOW_NOT_FOUND`/`MAP_NOT_FOUND` cho resource route mất; `422 MAP_FLOW_INVALID` cho target/entry/trigger semantic invalid.
- Editor giữ toàn bộ local draft khi 412/422, hiển thị map/path lỗi và yêu cầu reload/resolve; Save button không gửi song song.

## 6. Validation rules

### 6.1 Structural/intra-map

- Giữ toàn bộ V1 rules: slug/path/finite bounds, unique object/binding/polygon ID, polygon non-degenerate/non-self-intersect, spawn hợp lệ, collider requirements.
- `entryPoints`: tối thiểu 1, tối đa 64; ID unique trong map; position/facing finite; position phải pass `isPositionValid` với player radius của map đích.
- `portals`: tối đa 128; ID unique trong map; radius hữu hạn, dương và có giới hạn contract; trigger center phải pass `isPositionValid` với player radius của map nguồn.
- `document.mapId` phải bằng map item/path; V1 write bị từ chối sau khi normalize boundary để mọi revision mới là V2.

### 6.2 Inter-map/flow

- `flowId` ở body/path phải khớp; map node ID unique; node position hữu hạn và trong `[0,1]`.
- Mọi node phải resolve tới đúng một map revision hợp lệ.
- Mọi enabled portal phải có target map là node trong cùng flow snapshot và `entryPointId` tồn tại trên target document.
- Portal tới map không còn tồn tại, node bị bỏ khỏi draft nhưng vẫn được portal trỏ tới, hoặc target entry bị xóa đều là `MAP_FLOW_INVALID`; cả transaction rollback.
- Self-loop, cycle và hai portal đối hướng được phép. Loop prevention là trách nhiệm runtime state machine, không cấm graph hợp lệ.
- Disabled portal không traverse nhưng target vẫn phải hợp lệ để tránh lưu dangling data rồi lỗi khi bật lại.
- Orphan entry point được phép; nhiều portal có thể cùng target entry.
- Clone source phải thuộc active flow snapshot và source ETag phải khớp snapshot đó.

## 7. Editor behavior

- Editor load một flow envelope và các map envelope được snapshot pin; state gồm base envelopes, working documents và graph draft.
- Dirty tracking tính riêng flow layout và từng map bằng canonical serialization; Save Flow gửi đúng map dirty nhưng luôn gửi graph draft.
- Chọn map không làm mất draft của map khác trong cùng flow. Rời trang/reload khi còn dirty dùng confirm hiện có.
- “Clone map” yêu cầu ID/name/node position, gọi create-by-clone, rồi replace base flow bằng response mới và chọn node mới.
- Portal inspector nằm trên map nguồn: chọn trigger center/radius, target map, target entry. Entry-point inspector nằm trong navigation của map đích.
- Validation issue phải map về `mapId + path`; editor không chỉ hiện lỗi generic.
- Không làm graph auto-layout/animation/polish. UI tối thiểu đủ tạo node, chọn node, kéo position, tạo/sửa/xóa portal và entry point, Save Flow.

## 8. Runtime transition state machine

Trạng thái explicit trên shell:

```text
idle -> loading -> committed -> cooldown -> idle
                 \-> failed ----> cooldown -> idle
```

- `idle`: movement/interactions hoạt động. Transition chỉ bắt đầu khi player **đi từ ngoài vào trong** một enabled trigger; đứng sẵn trong trigger không phát lặp.
- `loading`: capture `{transitionId, sourceMapId, sourcePosition, portalId}`; khóa movement/interactions; giữ source document đang render; fetch target map revision qua flow endpoint và chờ dữ liệu + scene/assets báo ready. Chỉ một transition in-flight; request cũ bị abort/ignore theo `transitionId`.
- `committed`: trong một state update, đổi `currentMapId`, document, player position/facing sang target entry và reset map-scoped UI (nearby NPC/dialog/drawer/movement). Chỉ commit sau khi target validate và scene ready.
- `failed`: không đổi current map/document/player position; hiển thị lỗi có retry/thoát trigger, log code có cấu trúc; không dùng fallback `vanlang` cho một target bất kỳ vì làm vậy sẽ commit sai map.
- `cooldown`: tối thiểu 500 ms **và** player phải ra ngoài mọi portal trigger của map hiện tại trước khi re-arm. Sau failure, source portal cũng phải được exit/re-enter hoặc user bấm retry rõ ràng.

Loop prevention:

- Rising-edge trigger + single in-flight transition + transition token loại double dispatch.
- Cooldown/exit condition ngăn A→B lập tức kích B→A khi entry B nằm trong trigger quay lại.
- Không tự traverse chuỗi portal trong cùng tick/render; cycle graph vẫn hợp lệ khi người chơi chủ động rời và vào lại.
- Component unmount/flow change abort request; late promise không được commit.

Loader hiện tại chỉ dùng cho lần vào Văn Lang và nuốt asset errors, nên portal transition dùng một trạng thái loading tối thiểu riêng hoặc refactor loader thành presentation-only; success phải do target data + scene readiness quyết định, không do timer.

## 9. Test matrix

| Lớp | Case | Kỳ vọng |
|---|---|---|
| Contract | Parse V1 fixture `vanlang` | Pass; adapter tạo V2 với `default` entry và `portals: []`; fixture không đổi |
| Contract | Parse/canonicalize V2 | Entry/portal giữ nguyên nghĩa; output deterministic |
| Contract | Duplicate entry/portal ID, invalid radius/position | Fail với code/path/mapId cụ thể |
| Contract | Graph node duplicate/out-of-range | Fail structural/semantic validation |
| Inter-map | Portal target map mất hoặc node bị remove | `MAP_FLOW_INVALID`; không revision mới |
| Inter-map | Target entry mất/invalid navmesh | `MAP_FLOW_INVALID`; path chỉ đúng source portal/target entry |
| Inter-map | Source trigger center invalid | `MAP_FLOW_INVALID`; Save Flow rollback |
| Inter-map | A↔B cycle | Hợp lệ ở contract/Save Flow |
| API clone | Clone happy path | `201`; map revision 1 + graph revision cùng commit; portals clone rỗng |
| API clone | Stale flow/source ETag | `412`; không map/node orphan |
| API clone | Duplicate new map ID | `409`; state không đổi |
| API save | Hai map + graph happy path | Một flow revision mới pin đúng revision mới của cả hai; ETag response mới |
| API save | Stale flow ETag | `412 FLOW_REVISION_CONFLICT`; zero writes |
| API save | Một trong nhiều map stale | `412 MAP_REVISION_CONFLICT` liệt kê map; zero writes cho tất cả |
| Repository | Inject failure sau insert map thứ nhất/trước flow activation | Transaction rollback; active pointers/revision counts không đổi |
| Repository | Lock maps ở order khác nhau từ hai request | Không deadlock do sort `map_id`; một request thắng, request kia 412 |
| Migration | Fresh DB | Tạo flow tables/FKs/index và seed snapshot hợp lệ |
| Migration | Existing DB có `vanlang` V1 và user revision | Không rewrite/overwrite; tạo flow pin active revision hiện tại |
| Migration | Re-run migrate/seed | No-op an toàn |
| Editor E2E | Clone, kéo node, tạo entry + portal, Save Flow | Request payload/ETags đúng; dirty reset sau success |
| Editor E2E | Save 412/422 | Local drafts của mọi map còn nguyên; lỗi gắn đúng map/path |
| Editor E2E | Edit map A, chuyển B, quay A | Draft A không mất; một Save Flow gửi các map dirty |
| Runtime | Đi vào portal A→B | loading khóa input; commit đúng pinned revision/entry/facing |
| Runtime | Target 404/invalid entry/scene failure | Ở nguyên A và source position; failed→cooldown; có retry |
| Runtime | Enter portal nhiều tick / double click retry | Chỉ một request/commit |
| Runtime | Entry B nằm trong trigger B→A | Không bounce; phải hết cooldown và exit/re-enter |
| Runtime | Late response sau unmount/request mới | Không commit stale response |
| Regression | Existing world-map → Văn Lang fallback | V1 fallback vẫn chạy; movement/navmesh/NPC tests hiện có pass |

Test transaction rollback cần repository integration test với PostgreSQL test database hoặc transaction-capable fixture; memory repository không đủ chứng minh atomicity.

## 10. Danh sách file dự kiến thay đổi khi implementation

Danh sách forecast, không phải thay đổi của phiên PLAN.

Shared contract/data:

- `packages/map-contract/src/map-document.ts`
- `packages/map-contract/src/map-validation.ts`
- `packages/map-contract/src/index.ts`
- unit tests mới/cập nhật cạnh contract (đề xuất `map-validation.test.ts`)
- `packages/map-contract/maps/vanlang.v1.json` **không sửa**, chỉ dùng trong compatibility tests

Backend/database:

- migration mới, đề xuất `backend/src/server/db/migrations/003_map_flows.sql`
- `backend/src/server/db/schema.ts`
- `backend/src/server/db/seed-maps.ts` hoặc seed flow tách riêng
- `backend/src/server/maps/map-repository.ts` (chỉ nếu tách shared helpers cần thiết)
- repository mới, đề xuất `backend/src/server/maps/map-flow-repository.ts`
- `backend/src/routes/maps.ts` hoặc route mới `backend/src/routes/map-flows.ts`
- `backend/src/app.ts`
- `backend/src/routes/maps.test.ts` và test route/repository/transaction mới

Frontend editor/runtime:

- `frontend/src/app/_lib/map-api-client.ts`
- `frontend/src/app/admin/maps/map-editor-shell.tsx`
- `frontend/src/app/admin/maps/map-editor.css` (layout tối thiểu, không polish)
- `frontend/src/app/_components/vanlang-game-shell.tsx`
- `frontend/src/app/_components/vanlang-dungeon-screen.tsx`
- `frontend/src/app/_components/vanlang-dungeon-world.tsx` (scene-ready/failure contract nếu cần)
- `frontend/src/app/_components/vanlang-navmesh.ts`
- loading component hiện có chỉ sửa nếu tách presentation khỏi readiness là cần thiết
- `tests/e2e/map-editor.spec.ts`
- runtime E2E hiện có hoặc spec map-flow mới
- `CHANGELOGS.md`

Không dự kiến dependency/package-manager config/lockfile change.

## 11. Thứ tự implementation đề xuất

1. Contract V2 + V1 adapter + inter-map validator; khóa fixtures/tests trước.
2. Migration/seed + flow repository với transaction/locking/ETag integration tests.
3. Read/clone/Save Flow routes + API tests.
4. API client + editor multi-map draft/graph/portal tối thiểu + E2E conflict/validation.
5. Runtime pinned-load + transition state machine + failure/loop tests.
6. Regression, changelog, full verification và CodeGraph sync.

Không bắt đầu bước sau khi tests của bước trước chưa xanh; edge case mới không ảnh hưởng data/security/happy path ghi `[LATER]` thay vì mở scope.

## 12. Definition of Done

- [ ] Portal được lưu duy nhất trong source `MapDocumentV2`; target entry nằm trong target navigation; graph node position và pinned map revision nằm trong versioned `MapFlowDocumentV1`.
- [ ] Existing DB revisions và bundled `vanlang.v1.json` load qua adapter, không bị rewrite; mọi write mới là V2.
- [ ] Clone tạo map revision 1 và flow node trong một transaction; clone không copy portals.
- [ ] Save Flow thay đổi nhiều map + graph all-or-nothing, pin đúng revisions và trả ETags mới.
- [ ] Flow/map stale conflict trả 412 và không có partial write; target/entry/trigger invalid trả 422 và rollback.
- [ ] Runtime đi A→B đến đúng entry/facing; failure giữ A; no double dispatch/bounce loop; cycles vẫn traverse được sau re-arm.
- [ ] Editor giữ multi-map drafts qua selection, giữ drafts sau conflict, hiển thị validation theo map/path.
- [ ] Write gate local/internal hiện có áp dụng cho toàn bộ endpoint mutate mới.
- [ ] Test matrix BLOCK có test tự động, gồm conflict, target mất, entry invalid, transaction/transition failure và loop prevention.
- [ ] Không thêm polish, dependency hoặc thay đổi ngoài danh sách forecast nếu chưa được duyệt lại.
- [ ] `CHANGELOGS.md` cập nhật trong phiên implementation.

## 13. Verification checklist cho phiên implementation

- [ ] `pnpm install --frozen-lockfile` chỉ chạy nếu dependency/workspace config thực sự đổi (hiện không dự kiến).
- [ ] Contract/unit/API/repository transaction tests liên quan pass.
- [ ] Runtime/editor Playwright cases liên quan pass, gồm success và failure evidence.
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `docker compose config --quiet` nếu Compose bị sửa (hiện không dự kiến).
- [ ] Migration chạy trên fresh DB, existing V1 DB và re-run.
- [ ] `git diff --check`
- [ ] `codegraph sync` rồi `codegraph status` báo current trước handoff.

## 14. Giả định còn cần reviewer xác nhận

1. Flow mặc định dùng `flowId = "vanlang"`; runtime vào dungeon hiện tại sẽ load active snapshot của flow này.
2. Clone giữ objects/navmesh/entry points nhưng xóa portals là hành vi mong muốn.
3. Trigger circle là đủ cho PR đầu; polygon/box trigger để `[LATER]`.
4. Graph node position normalized `[0,1]`, độc lập world X/Z.
5. Session runtime pin một flow revision từ lúc vào/reload; Save Flow không hot-swap session đang chơi.
6. Endpoint legacy single-map được giữ để tương thích nhưng Map Editor mới chỉ dùng Save Flow cho chỉnh sửa; flow snapshot vẫn nhất quán dù active map legacy đổi.
7. Sau transition failure, retry rõ ràng hoặc exit/re-enter trigger đều được phép; không tự retry nền.

Nếu bất kỳ giả định nào bị bác bỏ, cập nhật spec trước khi implement; không tự mở rộng scope trong phiên SHIP CORE.
