import { expect, test, type Page, type Route } from "@playwright/test";
import { isPositionValid, type MapDocument, type MapRevisionEnvelope } from "@van-lang/map-contract";
import { mkdir, readFile } from "node:fs/promises";

const evidenceDir = "artifacts/ui-evidence";
const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3000",
  "access-control-allow-methods": "GET, PUT, OPTIONS",
  "access-control-allow-headers": "Content-Type, If-Match",
};

async function mockMapApi(page: Page, options: { delayFirstSave?: boolean; failFirstSave?: boolean; secondMap?: boolean } = {}) {
  let active = JSON.parse(await readFile("packages/map-contract/maps/vanlang.v1.json", "utf8")) as MapDocument;
  let revision = 1;
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
    releaseSave,
    revision: () => revision,
    saveCount: () => saveCount,
  };
}

test("editor loads, saves atomically, and shows validation failure", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await mockMapApi(page);
  await page.goto("/admin/maps");
  await expect(page.getByRole("heading", { name: "Map Editor" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Map" })).toHaveValue("vanlang");
  await expect(page.getByText("Scene Objects")).toBeVisible();
  await expect(page.getByText("Walkable Area")).toBeVisible();

  await page.getByRole("button", { name: "3D góc người chơi" }).click();
  await expect(page.getByLabel("Map viewport 3D")).toBeVisible();
  await expect(page.getByLabel("Đấu trường chuyển sinh Văn Lang 3D")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Preview 3D đã sẵn sàng.", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Cảnh 3D tạm thời không khả dụng.", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: `${evidenceDir}/map-editor-3d-preview.png`, fullPage: true });
  await page.getByRole("button", { name: "2D chỉnh vùng" }).click();
  await expect(page.getByLabel("Map viewport 2D")).toBeVisible();

  const name = page.getByLabel("Tên map");
  await name.fill(`Văn Lang UI E2E ${Date.now()}`);
  await expect(page.getByText("Chưa lưu")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Đã lưu revision \d+\./)).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/map-editor-pass.png`, fullPage: true });

  await name.fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Map còn lỗi validation. Hãy sửa trước khi lưu.")).toBeVisible();
  await expect(page.getByText(/metadata\.name/)).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/map-editor-validation-fail.png`, fullPage: true });
});

test("invalid polygon never reaches Save and active map remains unchanged", async ({ page }) => {
  const api = await mockMapApi(page);
  await page.goto("/admin/maps");
  const points = page.locator(".map-viewport svg circle");
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
  await expect(page.getByText(/Đã lưu revision 2\./)).toBeVisible();
  await expect(name).toHaveValue("Newest working copy");
  await expect(page.getByText("Chưa lưu")).toBeVisible();
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
  await expect(failedPage.getByText("Chưa lưu")).toBeVisible();
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
  const doubleClickCanvasPoint = async () => {
    await svg.evaluate((element) => {
      const point = element.createSVGPoint();
      point.x = 750;
      point.y = 250;
      const transformed = point.matrixTransform(element.getScreenCTM()!);
      element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, clientX: transformed.x, clientY: transformed.y }));
    });
  };
  await doubleClickCanvasPoint();
  await page.setViewportSize({ width: 980, height: 900 });
  await doubleClickCanvasPoint();
  const draftPoints = (await svg.locator("polyline.draft").getAttribute("points"))!.trim().split(" ").map((value) => value.split(",").map(Number));
  expect(draftPoints[0]).toEqual([500, 500]);
  expect(Math.abs(draftPoints[1][0] - 750)).toBeLessThan(1);
  expect(Math.abs(draftPoints[1][1] - 250)).toBeLessThan(1);
  expect(Math.abs(draftPoints[2][0] - draftPoints[1][0])).toBeLessThan(1);
  expect(Math.abs(draftPoints[2][1] - draftPoints[1][1])).toBeLessThan(1);
});

test("live Văn Lang editor save matches runtime and invalid geometry cannot replace active revision", async ({ page, request }) => {
  test.skip(process.env.LIVE_MAP_EDITOR_TEST !== "1", "Requires the local writable Maps API.");
  await mkdir(evidenceDir, { recursive: true });
  const original = await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope;

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
    await expect(page.getByText(/Đã lưu revision \d+\./)).toBeVisible();
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
    await expect(page.getByAltText("Nền Văn Lang")).toBeVisible();
    const revealDialog = page.getByRole("button", { name: "Hiện toàn bộ" });
    if (await revealDialog.isVisible()) await revealDialog.click();
    await page.getByRole("button", { name: "Bước vào ký ức" }).click();
    for (let index = 0; index < 80; index += 1) await page.keyboard.press("ArrowRight");
    const player = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos as { x: number; y: number });
    expect(isPositionValid(saved.document, { x: player.x, z: player.y })).toBe(true);
    await page.screenshot({ path: `${evidenceDir}/09-live-runtime-match-pass.png`, fullPage: true });

    await page.goto("/admin/maps");
    const revisionBeforeInvalid = (await (await request.get("http://localhost:4000/api/maps/vanlang")).json() as MapRevisionEnvelope).revision;
    const handles = page.locator(".map-viewport svg circle");
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
