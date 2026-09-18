import { expect, test, type Page, type Route } from "@playwright/test";
import { isPositionValid, upgradeMapDocument, type MapDocument, type MapRevisionEnvelope } from "@van-lang/map-contract";
import { mkdir, readFile } from "node:fs/promises";

const evidenceDir = "artifacts/ui-evidence";
const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3000",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "Content-Type, If-Match",
};

async function mockMapApi(page: Page, options: { delayFirstSave?: boolean; failFirstSave?: boolean; secondMap?: boolean; portal?: boolean } = {}) {
  let active = upgradeMapDocument(JSON.parse(await readFile("packages/map-contract/maps/vanlang.v1.json", "utf8")));
  if (options.portal) active.portals.push({ id: "portal-home", enabled: true, trigger: { type: "circle", center: { ...active.navigation.spawn }, radius: 0.8 }, target: { mapId: "vanlang", entryPointId: "default" } });
  let revision = 1;
  let flowRevision = 1;
  let flowNodes = [{ mapId: "vanlang", mapRevision: 1, position: { x: 0.3, y: 0.5 } }];
  const flowMaps = new Map<string, MapDocument>([["vanlang", structuredClone(active)]]);
  let saveCount = 0;
  let releaseSave = () => {};
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  const envelope = (document = active) => ({
    mapId: document.mapId,
    revision,
    etag: `"${document.mapId}:${revision}:test"`,
    activatedAt: new Date(0).toISOString(),
    document,
  });
  const fulfill = (route: Route, status: number, body?: unknown) =>
    route.fulfill({ status, headers: corsHeaders, contentType: "application/json", body: body === undefined ? "" : JSON.stringify(body) });

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return fulfill(route, 204);
    if (request.method() === "POST" && path === "/api/admin/assets/glb") return fulfill(route, 201, {
      assetId: "a".repeat(64), checksum: "a".repeat(64), src: "/models/vanlang-rebirth/hero.runtime.glb",
      originalBytes: 1024, runtimeBytes: 900, reused: false, summary: { scenes: 1, meshes: 1, skins: 1, morphTargets: 0, animations: ["Idle"] },
    });
    if (request.method() === "GET" && path === "/api/map-flows/vanlang") return fulfill(route, 200, { flowId: "vanlang", revision: flowRevision, etag: `"vanlang:${flowRevision}:flow"`, activatedAt: new Date(0).toISOString(), document: { schemaVersion: 1, flowId: "vanlang", nodes: flowNodes } });
    if (request.method() === "GET" && path.startsWith("/api/map-flows/vanlang/maps/")) {
      const mapId = path.split("/").at(-1)!;
      const document = flowMaps.get(mapId);
      const mapRevision = flowNodes.find((node) => node.mapId === mapId)?.mapRevision ?? 1;
      return document ? fulfill(route, 200, { mapId, revision: mapRevision, etag: `"${mapId}:${mapRevision}:map"`, activatedAt: new Date(0).toISOString(), document }) : fulfill(route, 404, { code: "MAP_NOT_FOUND" });
    }
    if (request.method() === "POST" && path === "/api/admin/map-flows/vanlang/maps") {
      const input = request.postDataJSON() as { sourceMapId: string; mapId: string; metadata: MapDocument["metadata"]; nodePosition: { x: number; y: number } };
      if (flowMaps.has(input.mapId)) return fulfill(route, 409, { code: "MAP_ALREADY_EXISTS" });
      const document = { ...structuredClone(flowMaps.get(input.sourceMapId)!), mapId: input.mapId, metadata: { ...flowMaps.get(input.sourceMapId)!.metadata, ...input.metadata }, portals: [] };
      flowMaps.set(input.mapId, document);
      flowNodes = [...flowNodes, { mapId: input.mapId, mapRevision: 1, position: input.nodePosition }];
      flowRevision += 1;
      return fulfill(route, 201, { flow: { flowId: "vanlang", revision: flowRevision, etag: `"vanlang:${flowRevision}:flow"`, activatedAt: new Date(0).toISOString(), document: { schemaVersion: 1, flowId: "vanlang", nodes: flowNodes } }, map: { mapId: input.mapId, revision: 1, etag: `"${input.mapId}:1:map"`, activatedAt: new Date(0).toISOString(), document } });
    }
    if (request.method() === "PUT" && path === "/api/admin/map-flows/vanlang") {
      const input = request.postDataJSON() as { document: { nodes: Array<{ mapId: string; position: { x: number; y: number } }> }; maps: Array<{ mapId: string; document: MapDocument }> };
      saveCount += 1;
      if (options.delayFirstSave && saveCount === 1) await saveGate;
      if (options.failFirstSave && saveCount === 1) return fulfill(route, 503, { code: "MAP_SAVE_FAILED", message: "Database unavailable" });
      const invalid = input.maps.flatMap((item) => item.document.portals).some((portal) => Math.abs(portal.trigger.center.x) > 100 || Math.abs(portal.trigger.center.z) > 100);
      if (invalid) return fulfill(route, 422, { code: "MAP_FLOW_INVALID", message: "Trigger portal ngoài navmesh" });
      for (const item of input.maps) {
        flowMaps.set(item.mapId, item.document);
        if (item.mapId === "vanlang") active = item.document;
      }
      flowNodes = input.document.nodes.map((node) => ({ ...node, mapRevision: (flowNodes.find((item) => item.mapId === node.mapId)?.mapRevision ?? 1) + Number(input.maps.some((item) => item.mapId === node.mapId)) }));
      revision = flowNodes.find((node) => node.mapId === "vanlang")?.mapRevision ?? revision;
      flowRevision += 1;
      return fulfill(route, 200, { flow: { flowId: "vanlang", revision: flowRevision, etag: `"vanlang:${flowRevision}:flow"`, activatedAt: new Date(0).toISOString(), document: { schemaVersion: 1, flowId: "vanlang", nodes: flowNodes } }, maps: input.maps.map((item) => { const mapRevision = flowNodes.find((node) => node.mapId === item.mapId)!.mapRevision; return { mapId: item.mapId, revision: mapRevision, etag: `"${item.mapId}:${mapRevision}:next"`, activatedAt: new Date(0).toISOString(), document: item.document }; }) });
    }
    if (request.method() === "GET" && path === "/api/maps") {
      const maps = [{
        mapId: "vanlang",
        name: active.metadata.name,
        description: active.metadata.description,
        activeRevision: revision,
        updatedAt: new Date(0).toISOString(),
      }];
      if (options.secondMap) maps.push({ ...maps[0], mapId: "other", name: "Map khác" });
      return fulfill(route, 200, { maps });
    }
    if (request.method() === "GET" && path.startsWith("/api/maps/")) {
      if (path.endsWith("/other")) {
        const other = structuredClone(active);
        other.mapId = "other";
        return fulfill(route, 200, envelope(other));
      }
      return fulfill(route, 200, envelope());
    }
    if (request.method() === "PUT" && path === "/api/admin/maps/vanlang") {
      saveCount += 1;
      if (options.delayFirstSave && saveCount === 1) await saveGate;
      if (options.failFirstSave && saveCount === 1) return fulfill(route, 503, { code: "MAP_SAVE_FAILED", message: "Database unavailable" });
      active = (request.postDataJSON() as { document: MapDocument }).document;
      revision += 1;
      return fulfill(route, 200, envelope());
    }
    return fulfill(route, 404, { code: "NOT_FOUND" });
  });

  return {
    active: () => active,
    flowMap: (mapId: string) => flowMaps.get(mapId),
    releaseSave,
    revision: () => revision,
    saveCount: () => saveCount,
  };
}

test("imports an NPC, saves and reloads its dialogue and transform", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  const api = await mockMapApi(page);
  await page.goto("/admin/maps");
  const panel = page.getByText("NPC GLB").locator("..");
  await panel.getByLabel("NPC GLB").setInputFiles("frontend/public/models/vanlang-rebirth/hero.runtime.glb");
  await panel.getByLabel("NPC ID").fill("historian");
  await panel.getByLabel("Tên").fill("Sử quan");
  await panel.getByLabel("Hội thoại").fill("Hãy lắng nghe chuyện xưa.");
  await panel.getByRole("button", { name: "Import và thêm NPC" }).click();
  await expect(page.getByText(/Đã import và thêm NPC Sử quan/)).toBeVisible();
  await expect(page.getByLabel("Map viewport 3D")).toBeVisible();

  const inspector = page.getByText("NPC", { exact: true }).last().locator("..");
  await inspector.getByLabel("Position Y").fill("0.75");
  await inspector.getByLabel("Position X").fill("0.25");
  await page.getByRole("button", { name: "Lưu map" }).click();
  await expect(page.getByText(/Đã lưu map r2 và đồng bộ Map Flow r2/)).toBeVisible();
  expect(api.active().npcs[0]).toMatchObject({ id: "historian", name: "Sử quan", dialogue: "Hãy lắng nghe chuyện xưa.", transform: { position: { x: 0.25, y: 0.75 } } });

  await page.reload();
  await expect(page.getByText("NPC GLB")).toBeVisible();
  expect(api.active().npcs[0].transform.position).toMatchObject({ x: 0.25, y: 0.75 });
  await page.screenshot({ path: `${evidenceDir}/npc-glb-import-save-reload-pass.png`, fullPage: true });
});

test("portal point and entrypoint stay synchronized between Map and Map Flow", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  const api = await mockMapApi(page, { portal: true });
  await page.goto("/admin/maps");
  await expect(page.getByRole("button", { name: "portal-home → vanlang/default" })).toBeVisible();
  await expect(page.locator(".map-viewport .portal-trigger.selected .portal-handle")).toBeVisible();

  const handle = page.locator(".map-viewport .portal-trigger.selected .portal-handle");
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error("Portal handle is not visible");
  const initialX = Number(await page.getByLabel("Portal X").inputValue());
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 32, bounds.y + bounds.height / 2, { steps: 4 });
  await page.mouse.up();
  const movedX = Number(await page.getByLabel("Portal X").inputValue());
  expect(movedX).toBeGreaterThan(initialX);

  await page.getByLabel("ID dùng trong Map Flow").fill("arrival");
  await page.getByRole("button", { name: "Lưu map" }).click();
  await expect(page.getByText(/Đã lưu map r2 và đồng bộ Map Flow r2/)).toBeVisible();
  expect(api.saveCount()).toBe(1);
  expect(api.revision()).toBe(2);
  expect(api.flowMap("vanlang")?.portals[0]).toMatchObject({ trigger: { center: { x: movedX } }, target: { mapId: "vanlang", entryPointId: "arrival" } });

  await page.getByRole("button", { name: "Map Flow", exact: true }).click();
  await page.getByLabel("Portal", { exact: true }).selectOption("portal-home");
  await expect(page.getByLabel("Trigger X")).toHaveValue(String(movedX));
  await expect(page.getByLabel("Entrypoint đích")).toHaveValue("arrival");
  await page.screenshot({ path: `${evidenceDir}/map-portal-entrypoint-sync-pass.png`, fullPage: true });
});

test("spawn markers stay visible and invalid portal trigger is repaired before save", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  const api = await mockMapApi(page, { portal: true });
  await page.goto("/admin/maps");

  await expect(page.getByRole("img", { name: "Spawn point" })).toBeVisible();
  await page.getByLabel("Portal X").fill("8.8");
  await page.getByLabel("Portal Z").fill("2.1");
  await page.getByRole("button", { name: "Lưu map" }).click();
  await expect(page.getByText(/Đã tự đưa portal portal-home vào vị trí hợp lệ gần nhất/)).toBeVisible();

  const saved = api.flowMap("vanlang");
  expect(saved).not.toBeNull();
  expect(isPositionValid(saved!, saved!.portals[0].trigger.center)).toBe(true);
  await page.getByRole("button", { name: "Overlay vùng" }).click();
  await expect(page.getByRole("img", { name: "Spawn point" })).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: `${evidenceDir}/map-spawn-portal-repair-pass.png`, fullPage: true });
});
test("editor loads, saves atomically, and shows validation failure", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await mockMapApi(page);
  await page.goto("/admin/maps");
  await expect(page.getByRole("heading", { name: "Map Editor" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Map" })).toHaveValue("vanlang");
  await expect(page.getByText("Scene Objects")).toBeVisible();
  await expect(page.getByText("Walkable Area")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu map" })).toBeDisabled();

  await page.getByRole("button", { name: "3D góc người chơi" }).click();
  await expect(page.getByLabel("Map viewport 3D")).toBeVisible();
  await expect(page.getByLabel("Đấu trường chuyển sinh Văn Lang 3D")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Preview 3D đã sẵn sàng.", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Cảnh 3D tạm thời không khả dụng.", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/map-editor-3d-preview.png`, fullPage: true });
  await page.getByRole("button", { name: "Overlay vùng" }).click();
  await expect(page.getByLabel("Map viewport Overlay")).toBeVisible();
  await expect(page.getByText("Overlay đã sẵn sàng:", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^Di chuyển điểm 1 của / }).first()).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/map-editor-overlay.png`, fullPage: true });
  await page.getByRole("button", { name: "2D chỉnh vùng" }).click();
  await expect(page.getByLabel("Map viewport 2D")).toBeVisible();

  const name = page.getByLabel("Tên map");
  await name.fill(`Văn Lang UI E2E ${Date.now()}`);
  await expect(page.getByText("Chưa lưu").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu map" })).toBeEnabled();
  await page.getByRole("button", { name: "Lưu map" }).click();
  await expect(page.getByText(/Đã lưu map r\d+ và đồng bộ Map Flow r\d+\./)).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/map-editor-pass.png`, fullPage: true });

  await name.fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Map còn lỗi validation. Hãy sửa trước khi lưu.")).toBeVisible();
  await expect(page.getByText(/metadata\.name/)).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/map-editor-validation-fail.png`, fullPage: true });
});

test("Map Flow creates maps, configures entrypoints, links portals, and persists layout", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  const api = await mockMapApi(page);
  await page.goto("/admin/maps");
  await page.getByRole("button", { name: "Tạo map mới" }).click();
  await expect(page.getByLabel("Map Flow editor")).toBeVisible();

  await page.getByLabel("Map ID mới").fill("second-map");
  await page.getByLabel("Tên hiển thị").fill("Map thứ hai");
  await page.getByRole("button", { name: "Tạo map", exact: true }).click();
  await expect(page.getByText(/Đã tạo map second-map revision 1/)).toBeVisible();
  await expect(page.getByLabel("Map đang chọn")).toHaveValue("second-map");

  await page.getByRole("group", { name: "2. Entrypoint của map" }).getByLabel("ID").fill("arrival");

  await page.getByRole("button", { name: "Output vanlang" }).click();
  await page.getByRole("button", { name: "Input second-map" }).click();
  await expect(page.getByLabel("Portal", { exact: true })).toHaveValue(/portal-second-map/);
  await expect(page.getByLabel("Entrypoint đích")).toHaveValue("arrival");

  const node = page.locator(".map-flow-node").filter({ hasText: "second-map" });
  const bounds = await node.boundingBox();
  if (!bounds) throw new Error("Cloned flow node is not visible");
  await page.mouse.move(bounds.x + 50, bounds.y + 35);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 90, bounds.y - 80, { steps: 5 });
  await page.mouse.up();
  const savedNodeX = await page.getByLabel("Node X").inputValue();
  expect(Number(savedNodeX)).not.toBeCloseTo(0.75);
  await page.getByRole("button", { name: "Save Flow" }).click();
  await expect(page.getByText(/Đã lưu flow revision/)).toBeVisible();
  expect(api.flowMap("vanlang")?.portals[0].target).toEqual({ mapId: "second-map", entryPointId: "arrival" });
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByLabel("Node X")).toHaveValue(savedNodeX);
  await page.screenshot({ path: `${evidenceDir}/map-flow-create-portal-pass.png`, fullPage: true });

  await page.getByLabel("Map đang chọn").selectOption("vanlang");
  await page.getByLabel("Portal", { exact: true }).selectOption("portal-second-map-1");
  await page.getByLabel("Trigger X").fill("9000");
  await page.getByRole("button", { name: "Save Flow" }).click();
  await expect(page.getByText(/MAP_FLOW_INVALID: draft local vẫn được giữ/)).toBeVisible();
  await expect(page.getByLabel("Trigger X")).toHaveValue("9000");
  await page.screenshot({ path: `${evidenceDir}/map-flow-validation-fail.png`, fullPage: true });
});

test("invalid polygon never reaches Save and active map remains unchanged", async ({ page }) => {
  const api = await mockMapApi(page);
  await page.goto("/admin/maps");
  const points = page.locator(".map-viewport svg .point-handle");
  const first = await points.nth(0).boundingBox();
  const second = await points.nth(1).boundingBox();
  if (!first || !second) throw new Error("Walkable polygon handles are not visible");
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
  await page.mouse.up();
  await expect(page.getByText(/Polygon có hai điểm liên tiếp trùng nhau|Polygon phải có diện tích khác 0|Polygon không được tự giao nhau/).first()).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Map còn lỗi validation. Hãy sửa trước khi lưu.")).toBeVisible();
  expect(api.saveCount()).toBe(0);
  expect(api.active().navigation.walkablePolygons[0].points[0]).not.toEqual(api.active().navigation.walkablePolygons[0].points[1]);
});

test("failed and rapid saves preserve the newest working copy without reverse overwrite", async ({ page }) => {
  const delayed = await mockMapApi(page, { delayFirstSave: true });
  await page.goto("/admin/maps");
  const name = page.getByLabel("Tên map");
  await name.fill("Submitted copy");
  await page.getByRole("button", { name: "Save", exact: true }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(delayed.saveCount).toBe(1);
  await name.fill("Newest working copy");
  delayed.releaseSave();
  await expect(page.getByText(/Đã lưu map r2 và đồng bộ Map Flow r2\./)).toBeVisible();
  await expect(name).toHaveValue("Newest working copy");
  await expect(page.getByText("Chưa lưu").first()).toBeVisible();
  expect(delayed.active().metadata.name).toBe("Submitted copy");
  expect(delayed.saveCount()).toBe(1);

  const failedPage = await page.context().newPage();
  const failed = await mockMapApi(failedPage, { failFirstSave: true });
  await failedPage.goto("/admin/maps");
  const failedName = failedPage.getByLabel("Tên map");
  await failedName.fill("Unsaved after failure");
  await failedPage.getByRole("button", { name: "Save", exact: true }).click();
  await expect(failedPage.getByText("Database unavailable", { exact: true })).toBeVisible();
  await expect(failedName).toHaveValue("Unsaved after failure");
  await expect(failedPage.getByText("Chưa lưu").first()).toBeVisible();
  expect(failed.active().metadata.name).toBe("Văn Lang");
  await failedPage.close();
});

test("dirty map switch and editor exit both require confirmation", async ({ page }) => {
  await mockMapApi(page, { secondMap: true });
  await page.goto("/admin/maps");
  await page.getByLabel("Tên map").fill("Dirty");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page.getByRole("combobox", { name: "Map" }).selectOption("other");
  await expect(page.getByRole("combobox", { name: "Map" })).toHaveValue("vanlang");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Về game" }).click();
  await expect(page).toHaveURL(/\/admin\/maps/);
});

test("viewport resize does not change pointer-to-map coordinates", async ({ page }) => {
  await mockMapApi(page);
  await page.goto("/admin/maps");
  await page.getByRole("button", { name: "Vẽ vùng mới" }).click();
  const svg = page.locator(".map-viewport svg");
  const clickCanvasPoint = async () => {
    await svg.evaluate((element) => {
      const point = element.createSVGPoint();
      point.x = 750;
      point.y = 250;
      const transformed = point.matrixTransform(element.getScreenCTM()!);
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: transformed.x, clientY: transformed.y }));
    });
  };
  await clickCanvasPoint();
  await page.setViewportSize({ width: 980, height: 900 });
  await clickCanvasPoint();
  const draftPoints = (await svg.locator("polyline.draft").getAttribute("points"))!.trim().split(" ").map((value) => value.split(",").map(Number));
  expect(Math.abs(draftPoints[0][0] - 750)).toBeLessThan(1);
  expect(Math.abs(draftPoints[0][1] - 250)).toBeLessThan(1);
  expect(Math.abs(draftPoints[1][0] - draftPoints[0][0])).toBeLessThan(1);
  expect(Math.abs(draftPoints[1][1] - draftPoints[0][1])).toBeLessThan(1);
});

test("quick region creation supports midpoint insertion and manual coordinates", async ({ page }) => {
  await mockMapApi(page);
  await page.goto("/admin/maps");
  await page.getByRole("button", { name: "Tạo chữ nhật quanh spawn" }).click();
  await expect(page.getByText("Chưa lưu").first()).toBeVisible();
  await expect(page.locator(".map-viewport svg .insert-handle")).toHaveCount(4);
  await page.locator(".map-viewport svg .insert-handle").first().click();
  await expect(page.getByLabel(/^#\d+ X$/)).toHaveCount(5);
  await page.getByLabel("#1 X").fill("-2.25");
  await expect(page.getByLabel("#1 X")).toHaveValue("-2.25");
});

test("overlay point drag and insertion update the same polygon shown in 2D", async ({ page }) => {
  await mockMapApi(page);
  await page.goto("/admin/maps");
  const xField = page.getByLabel("#1 X");
  const initialX = Number(await xField.inputValue());
  await page.getByRole("button", { name: "Overlay vùng" }).click();
  await expect(page.getByText("Overlay đã sẵn sàng:", { exact: false })).toBeVisible({ timeout: 30_000 });

  const handle = page.getByRole("button", { name: /^Di chuyển điểm 1 của / }).first();
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error("Overlay point handle is not visible");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 36, bounds.y + bounds.height / 2 + 12, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await xField.inputValue())).not.toBe(initialX);

  const pointCount = await page.getByLabel(/^#\d+ X$/).count();
  await page.getByRole("button", { name: /^Chèn điểm sau điểm 1 của / }).click();
  await expect(page.getByLabel(/^#\d+ X$/)).toHaveCount(pointCount + 1);

  const movedX = Number(await xField.inputValue());
  await page.getByRole("button", { name: "2D chỉnh vùng" }).click();
  const canvasX = Number(await page.locator(".map-viewport svg g.selected .point-handle").first().getAttribute("cx"));
  expect(Math.abs(canvasX - (movedX + 6) / 12 * 1000)).toBeLessThan(0.5);
});

test("live legacy save preserves the pinned runtime snapshot and invalid geometry cannot replace active revision", async ({ page, request }) => {
  test.skip(process.env.LIVE_MAP_EDITOR_TEST !== "1", "Requires the local writable Maps API.");
  await mkdir(evidenceDir, { recursive: true });
  const original = await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope;
  const pinnedBefore = await (await request.get("http://localhost:4000/api/map-flows/vanlang/maps/vanlang")).json() as MapRevisionEnvelope;

  try {
    await page.goto("/admin/maps");
    await expect(page.getByRole("combobox", { name: "Map" })).toHaveValue("vanlang");
    const marker = `Văn Lang hardening ${Date.now()}`;
    await page.getByLabel("Tên map").fill(marker);

    await page.getByRole("button", { name: /Huyền Quan Canh Thời/ }).click();
    const glbPosition = page.getByLabel("Position X");
    const movedGlbX = Number(await glbPosition.inputValue()) + 0.1;
    await glbPosition.fill(String(movedGlbX));
    await page.getByLabel("Collider").first().selectOption("rectangle");
    await page.getByLabel("Width collider").first().fill("0.3");
    await page.getByLabel("Depth collider").first().fill("0.3");
    await page.getByLabel("Local rotation°").first().fill("25");

    await page.getByRole("button", { name: "+ Nền Văn Lang", exact: true }).click();
    await page.getByLabel("Position X").fill("0.55");
    await page.getByLabel("Position Y").fill("0.45");

    const firstPoint = page.locator(".map-viewport svg circle").first();
    const pointBox = await firstPoint.boundingBox();
    if (!pointBox) throw new Error("Walkable polygon handle is not visible");
    await page.mouse.move(pointBox.x + pointBox.width / 2, pointBox.y + pointBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(pointBox.x + pointBox.width / 2 + 6, pointBox.y + pointBox.height / 2 + 4);
    await page.mouse.up();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Đã lưu map r\d+ và đồng bộ Map Flow r\d+\./)).toBeVisible();
    await page.screenshot({ path: `${evidenceDir}/08-live-editor-save-pass.png`, fullPage: true });

    await page.reload();
    await expect(page.getByLabel("Tên map")).toHaveValue(marker);
    await page.getByRole("button", { name: /Nền Văn Lang sprite2d/ }).click();
    await expect(page.getByLabel("Position X")).toHaveValue("0.55");
    await page.getByRole("button", { name: /Huyền Quan Canh Thời/ }).click();
    await expect(page.getByLabel("Position X")).toHaveValue(String(movedGlbX));
    await expect(page.getByLabel("Collider").first()).toHaveValue("rectangle");

    const saved = await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope;
    expect(saved.revision).toBe(original.revision + 1);
    expect(saved.document.metadata.name).toBe(marker);
    expect(saved.document.objects.some((object) => object.kind === "sprite2d" && object.transform2d.position.x === 0.55)).toBe(true);
    const pinnedAfter = await (await request.get("http://localhost:4000/api/map-flows/vanlang/maps/vanlang")).json() as MapRevisionEnvelope;
    expect(pinnedAfter.revision).toBe(pinnedBefore.revision);
    expect(pinnedAfter.document.metadata.name).toBe(pinnedBefore.document.metadata.name);

    await page.goto("/");
    const account = `live-hardening-${Date.now()}@example.com`;
    await page.getByRole("tab", { name: "Đăng ký" }).click();
    await page.getByLabel("Tên hiển thị").fill("Live Hardening");
    await page.getByLabel("Email").fill(account);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("VanLang123!");
    await page.getByLabel("Nhập lại mật khẩu").fill("VanLang123!");
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await page.getByLabel("Email").fill(account);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("VanLang123!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Tiếp theo" }).click();
    await page.getByRole("button", { name: "Đã hiểu" }).click();
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}");
      localStorage.setItem("vanlang-game-mock-v4", JSON.stringify({ ...state, screen: "dungeon", selectedMap: "vanlang", playerPos: { x: 0, y: 0 } }));
    });
    await page.reload();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/MAP_FALLBACK_ACTIVE/)).toHaveCount(0);
    await expect(page.getByAltText("Nền Văn Lang")).toHaveCount(0);
    const revealDialog = page.getByRole("button", { name: "Hiện toàn bộ" });
    if (await revealDialog.isVisible()) await revealDialog.click();
    await page.getByRole("button", { name: "Bước vào ký ức" }).click();
    for (let index = 0; index < 80; index += 1) await page.keyboard.press("ArrowRight");
    const player = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos as { x: number; y: number });
    expect(isPositionValid(pinnedAfter.document, { x: player.x, z: player.y })).toBe(true);
    await page.screenshot({ path: `${evidenceDir}/09-live-runtime-match-pass.png`, fullPage: true });

    await page.goto("/admin/maps");
    const revisionBeforeInvalid = (await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope).revision;
    const handles = page.locator(".map-viewport svg .point-handle");
    const first = await handles.nth(0).boundingBox();
    const second = await handles.nth(1).boundingBox();
    if (!first || !second) throw new Error("Walkable polygon handles are not visible");
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
    await page.mouse.up();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Map còn lỗi validation. Hãy sửa trước khi lưu.")).toBeVisible();
    const revisionAfterInvalid = (await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope).revision;
    expect(revisionAfterInvalid).toBe(revisionBeforeInvalid);
    await page.screenshot({ path: `${evidenceDir}/10-live-invalid-polygon-blocked.png`, fullPage: true });
  } finally {
    const current = await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope;
    const restored = await request.put("http://localhost:4000/api/admin/maps/vanlang", {
      headers: { Origin: "http://localhost:3000", "If-Match": current.etag },
      data: { document: original.document },
    });
    expect(restored.ok()).toBe(true);
  }
});
