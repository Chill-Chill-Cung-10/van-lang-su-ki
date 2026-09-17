import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { projectToNavmesh } from "../../frontend/src/app/_components/vanlang-navmesh";

const evidenceDir = "artifacts/ui-evidence";
const password = "VanLang123!";

test.setTimeout(210_000);

async function registerAndLogin(page: import("@playwright/test").Page, name: string, email: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Đăng ký" }).click();
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByLabel("Nhập lại mật khẩu").fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByText("Tạo tài khoản thành công")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

async function finishPrologue(page: import("@playwright/test").Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: "Tiếp theo" }).click();
  }
  await page.getByRole("button", { name: "Đã hiểu" }).click();
  await expect(page.getByRole("heading", { name: "Bản đồ Ký Ức" })).toBeVisible();
}

async function enterDungeon(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Bước vào Văn Lang" }).click();
  await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible({ timeout: 20_000 });
}

async function move(page: import("@playwright/test").Page, key: string, count: number) {
  for (let index = 0; index < count; index += 1) await page.keyboard.press(key);
}

async function restorePlayerPosition(page: import("@playwright/test").Page, playerPos: { x: number; y: number }) {
  await page.evaluate((nextPosition) => {
    const stored = JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}");
    localStorage.setItem("vanlang-game-mock-v4", JSON.stringify({ ...stored, screen: "dungeon", playerPos: nextPosition }));
  }, playerPos);
  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
}

test("navmesh follows the three marked arena routes", () => {
  const walkableCheckpoints = [
    { name: "sân trung tâm", point: { x: 0, y: 0 } },
    { name: "cầu phía trên", point: { x: -3.2, y: -3.2 } },
    { name: "sân phụ bên trái", point: { x: -3, y: 3 } },
    { name: "cầu thang phía dưới", point: { x: 3.8, y: 3.8 } },
  ];

  for (const checkpoint of walkableCheckpoints) {
    const projected = projectToNavmesh(checkpoint.point);
    expect(projected.x, checkpoint.name).toBeCloseTo(checkpoint.point.x, 5);
    expect(projected.y, checkpoint.name).toBeCloseTo(checkpoint.point.y, 5);
  }

  const offRoute = { x: 4, y: -4 };
  const projected = projectToNavmesh(offRoute);
  expect(Math.hypot(projected.x - offRoute.x, projected.y - offRoute.y)).toBeGreaterThan(1.5);
});

test("Văn Lang rebirth arena end-to-end", async ({ browser, page }) => {
  await mkdir(evidenceDir, { recursive: true });
  const runId = Date.now();
  const firstEmail = `rebirth-one-${runId}@local.test`;
  const secondEmail = `rebirth-two-${runId}@local.test`;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    const detail = `${message.text()} ${message.location().url}`;
    if (message.type() === "error" && /vanlang-rebirth|\.glb|gltf|three|hydration/i.test(detail)) consoleErrors.push(detail);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await registerAndLogin(page, "Lạc Tướng Một", firstEmail);
  await finishPrologue(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enterDungeon(page);

  await expect(page.getByRole("dialog", { name: "Huyền Quan Canh Thời" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hiện toàn bộ|Bước vào ký ức/ })).toBeVisible();
  expect(await page.evaluate((email) => localStorage.getItem(`vanlang-rebirth-seen:${email}`), firstEmail)).toBeNull();
  await page.screenshot({ path: `${evidenceDir}/01-first-rebirth-desktop.png`, fullPage: true });

  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("dialog", { name: "Huyền Quan Canh Thời" })).toBeVisible();
  expect(await page.evaluate((email) => localStorage.getItem(`vanlang-rebirth-seen:${email}`), firstEmail)).toBeNull();
  const introButton = page.getByRole("button", { name: /Hiện toàn bộ|Bước vào ký ức/ });
  if (await introButton.getAttribute("name") === "Hiện toàn bộ") await introButton.click();
  if (await page.getByRole("button", { name: "Hiện toàn bộ" }).isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Hiện toàn bộ" }).click();
  }
  await page.getByRole("button", { name: "Bước vào ký ức" }).click();
  await expect(page.getByLabel(/Sinh lực 190 trên 190/)).toBeVisible();
  await expect(page.getByText("190/190", { exact: true })).toBeVisible();
  expect(await page.evaluate((email) => localStorage.getItem(`vanlang-rebirth-seen:${email}`), firstEmail)).toBe("true");
  expect(await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  })).toBe(true);
  await expect(page.locator(".dungeon-npc-label")).toHaveCount(4);
  const visualMetrics = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".rebirth-arena-stage");
    const background = document.querySelector<HTMLElement>(".rebirth-arena-background");
    const hud = document.querySelector<HTMLElement>(".rebirth-hud");
    const health = document.querySelector<HTMLElement>(".rebirth-health > span");
    const npcLabel = document.querySelector<HTMLElement>(".dungeon-npc-label");
    if (!stage || !background || !hud || !health || !npcLabel) throw new Error("Missing arena visual");
    const stageRect = stage.getBoundingClientRect();
    return {
      stageRatio: stageRect.width / stageRect.height,
      objectFit: getComputedStyle(background).objectFit,
      hudWidth: hud.getBoundingClientRect().width,
      healthWidth: health.getBoundingClientRect().width,
      healthBackground: getComputedStyle(health).backgroundImage,
      npcFontSize: Number.parseFloat(getComputedStyle(npcLabel).fontSize),
    };
  });
  expect(visualMetrics.stageRatio).toBeCloseTo(16 / 9, 2);
  expect(visualMetrics.objectFit).toBe("contain");
  expect(visualMetrics.hudWidth).toBeLessThanOrEqual(330);
  expect(visualMetrics.healthWidth).toBeGreaterThan(100);
  expect(visualMetrics.healthBackground).toContain("linear-gradient");
  expect(visualMetrics.npcFontSize).toBeLessThanOrEqual(10);
  await page.screenshot({ path: evidenceDir + "/07-map-hud-fixed.png", fullPage: true });

  const controlOrigin = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  await page.keyboard.press("KeyW");
  const afterForward = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(afterForward.x).toBeGreaterThan(controlOrigin.x);
  expect(afterForward.y).toBeCloseTo(controlOrigin.y, 5);
  await page.keyboard.press("KeyS");
  await page.keyboard.press("KeyA");
  const afterLeft = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(Math.abs(afterLeft.x - controlOrigin.x)).toBeLessThanOrEqual(0.13);
  expect(afterLeft.y).toBeLessThan(controlOrigin.y);
  await page.keyboard.press("KeyD");
  const restoredOrigin = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(Math.abs(restoredOrigin.x - controlOrigin.x)).toBeLessThanOrEqual(0.13);
  expect(Math.abs(restoredOrigin.y - controlOrigin.y)).toBeLessThanOrEqual(0.13);

  const holdStart = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(450);
  await page.keyboard.up("KeyD");
  const holdEnd = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(Math.hypot(holdEnd.x - holdStart.x, holdEnd.y - holdStart.y)).toBeGreaterThan(0.5);
  await page.screenshot({ path: evidenceDir + "/09-player-facing-right.png", fullPage: true });

  await move(page, "KeyA", 28);
  await move(page, "KeyW", 28);
  const boundedPosition = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(Math.abs(boundedPosition.x)).toBeLessThanOrEqual(5.2);
  expect(Math.abs(boundedPosition.y)).toBeLessThanOrEqual(5.2);
  await move(page, "KeyD", 56);
  await move(page, "KeyS", 56);
  const oppositeBoundedPosition = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  expect(Math.abs(oppositeBoundedPosition.x)).toBeLessThanOrEqual(4.4);
  expect(Math.abs(oppositeBoundedPosition.y)).toBeLessThanOrEqual(3.9);

  await page.reload();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("dialog", { name: "Huyền Quan Canh Thời" })).toHaveCount(0);
  await expect(page.getByText("190/190", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Rời phó bản" }).click();
  await expect(page.getByRole("heading", { name: "Rời phó bản" })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/02-dungeon-hud-and-drawer.png`, fullPage: true });
  await page.getByRole("button", { name: "Trở lại cổng" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual({ x: 0, y: 0 });

  await restorePlayerPosition(page, { x: 1.5, y: 1.5 });
  await expect(page.getByText("Trò chuyện với Sử quan Tuyên")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Nhận bí kíp" })).toBeVisible();
  await expect(page.locator(".wuxia-dialogue-copy .type-cursor")).toBeVisible();
  const dialogueBounds = await page.locator(".wuxia-dialogue-copy").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dialogueBounds.scrollWidth).toBeLessThanOrEqual(dialogueBounds.clientWidth + 1);

  const dialogueLayout = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".wuxia-dialogue-card");
    const speaker = document.querySelector<HTMLElement>(".wuxia-speaker");
    const copy = document.querySelector<HTMLElement>(".wuxia-dialogue-copy");
    const actions = document.querySelector<HTMLElement>(".wuxia-dialogue-actions");
    if (!card || !speaker || !copy || !actions) throw new Error("Dialogue layout is incomplete");

    const cardRect = card.getBoundingClientRect();
    const relativeBounds = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return {
        left: (rect.left - cardRect.left) / cardRect.width,
        top: (rect.top - cardRect.top) / cardRect.height,
        right: (rect.right - cardRect.left) / cardRect.width,
        bottom: (rect.bottom - cardRect.top) / cardRect.height,
      };
    };

    return { speaker: relativeBounds(speaker), copy: relativeBounds(copy), actions: relativeBounds(actions) };
  });
  expect(dialogueLayout.speaker.left).toBeGreaterThanOrEqual(0.22);
  expect(dialogueLayout.speaker.right).toBeLessThanOrEqual(0.56);
  expect(dialogueLayout.speaker.top).toBeGreaterThanOrEqual(0.05);
  expect(dialogueLayout.copy.left).toBeGreaterThanOrEqual(0.22);
  expect(dialogueLayout.copy.top).toBeGreaterThanOrEqual(0.29);
  expect(dialogueLayout.copy.right).toBeLessThanOrEqual(0.92);
  expect(dialogueLayout.copy.bottom).toBeLessThanOrEqual(0.82);
  expect(dialogueLayout.actions.right).toBeLessThanOrEqual(0.93);
  expect(dialogueLayout.actions.bottom).toBeLessThanOrEqual(0.93);

  await page.screenshot({ path: evidenceDir + "/08-npc-dialogue-typewriter.png", fullPage: true });
  await expect(page.locator(".wuxia-dialogue-copy .type-cursor")).toHaveCount(0, { timeout: 10_000 });
  await page.screenshot({ path: evidenceDir + "/10-dialogue-bounds-fixed.png", fullPage: true });
  const beforeLockedMove = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos);
  await page.keyboard.press("KeyD");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual(beforeLockedMove);
  await page.getByRole("button", { name: "Nhận bí kíp" }).click();
  await restorePlayerPosition(page, { x: 2.5, y: -1.5 });
  await expect(page.getByText("Trò chuyện với Thử thách Ký Ức Hùng Vương")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByText("Dữ kiện nào phù hợp nhất")).toBeVisible();
  await page.getByRole("button", { name: /^1\./ }).click();
  await expect(page.getByText("Chính xác. Ký ức Hùng Vương đã được phục hồi.")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/03-quest-boss-pass.png`, fullPage: true });
  await page.getByRole("button", { name: "Trở về Bản đồ" }).click();
  await enterDungeon(page);
  await expect(page.getByRole("dialog", { name: "Huyền Quan Canh Thời" })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await restorePlayerPosition(page, { x: 1.5, y: 1.5 });
  await expect(page.getByLabel("Điều khiển cảm ứng")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đi lên" })).toBeVisible();
  await page.getByRole("button", { name: "Đi lên" }).click();
  await page.getByRole("button", { name: "Đi xuống" }).click();
  await expect(page.getByRole("button", { name: "Tương tác với NPC" })).toBeEnabled();
  await page.getByRole("button", { name: "Tương tác với NPC" }).click();
  await expect(page.getByRole("dialog", { name: "Sử quan Tuyên" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).click();
  await page.screenshot({ path: `${evidenceDir}/04-mobile-touch.png`, fullPage: true });
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.getByLabel("Điều khiển cảm ứng")).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/06-tablet-touch.png`, fullPage: true });

  await page.getByRole("button", { name: "Rời phó bản" }).click();
  await page.getByRole("button", { name: "Về Bản đồ Ký Ức" }).click();
  await page.getByRole("button", { name: "Quay lại màn hình chính" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await registerAndLogin(page, "Lạc Tướng Hai", secondEmail);
  await finishPrologue(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enterDungeon(page);
  await expect(page.getByRole("dialog", { name: "Huyền Quan Canh Thời" })).toBeVisible();
  expect(await page.evaluate((email) => localStorage.getItem(`vanlang-rebirth-seen:${email}`), secondEmail)).toBeNull();
  await page.getByRole("button", { name: "Hiện toàn bộ" }).click();
  await page.getByRole("button", { name: "Bước vào ký ức" }).click();

  const storageState = await page.context().storageState();
  const failureContext = await browser.newContext({ storageState, viewport: { width: 1280, height: 800 } });
  await failureContext.route("**/models/vanlang-rebirth/arena.runtime.glb", (route) => route.abort());
  const failurePage = await failureContext.newPage();
  await failurePage.goto("/");
  await failurePage.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(failurePage.getByText("Cảnh 3D tạm thời không khả dụng")).toBeVisible({ timeout: 20_000 });
  await expect(failurePage.getByRole("button", { name: "Rời phó bản" })).toBeVisible();
  await failurePage.screenshot({ path: `${evidenceDir}/05-webgl-asset-fallback.png`, fullPage: true });
  await failureContext.close();

  expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
});

test("malformed API map enters an explicit bundled-data degraded state without breaking gameplay", async ({ page }) => {
  await mkdir(evidenceDir, { recursive: true });
  await page.route("**/api/maps/vanlang", (route) => route.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "http://localhost:3000" },
    contentType: "application/json",
    body: JSON.stringify({
      mapId: "vanlang",
      revision: 99,
      etag: '"vanlang:99:corrupt"',
      activatedAt: new Date(0).toISOString(),
      document: { schemaVersion: 1, mapId: "vanlang" },
    }),
  }));
  const runId = Date.now();
  await registerAndLogin(page, "Fallback Tester", `fallback-${runId}@example.com`);
  await finishPrologue(page);
  await enterDungeon(page);
  await expect(page.getByText(/MAP_FALLBACK_ACTIVE/)).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  await page.screenshot({ path: `${evidenceDir}/07-map-fallback-degraded-pass.png`, fullPage: true });
});






