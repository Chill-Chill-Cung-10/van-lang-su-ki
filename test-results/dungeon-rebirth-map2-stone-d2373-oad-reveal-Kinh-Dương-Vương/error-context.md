# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dungeon-rebirth.spec.ts >> map2 stone puzzle wrong retry, completion, and reload reveal Kinh Dương Vương
- Location: tests\e2e\dungeon-rebirth.spec.ts:421:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Phiến đá Kinh Dương Vương' })
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Phiến đá Kinh Dương Vương' }) with timeout 12000ms
  - waiting for getByRole('heading', { name: 'Phiến đá Kinh Dương Vương' })

```

```yaml
- link "Đi tới nội dung chính":
  - /url: "#noi-dung-chinh"
- alert
- main:
  - paragraph: Có lỗi xảy ra
  - heading "Hành trình đang tạm gián đoạn" [level=1]
  - paragraph: Dữ liệu của bạn chưa bị mất. Hãy thử tải lại phần này.
  - button "Thử lại"
```

# Test source

```ts
  342 |   const target = { ...upgradeMapDocument(fixture), mapId: "second-map", metadata: { ...source.metadata, name: "Map thứ hai" }, navigation: { ...source.navigation, entryPoints: [{ id: "arrival", position: { x: 1, z: 1 }, facingDeg: 90 }] }, portals: [{ id: "back-to-source", enabled: true, trigger: { type: "circle" as const, center: { x: 1, z: 1 }, radius: 0.2 }, target: { mapId: "vanlang", entryPointId: "default" } }] };
  343 |   let targetMode: "success" | "http-error" | "invalid" | "slow" = "success";
  344 |   let targetRequests = 0;
  345 |   await page.route("**/api/map-flows/vanlang/maps/**", async (route) => {
  346 |     const mapId = new URL(route.request().url()).pathname.split("/").at(-1)!;
  347 |     if (mapId === "second-map") targetRequests += 1;
  348 |     if (mapId === "second-map" && targetMode === "http-error") return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "TARGET_LOAD_FAILED", message: "Target unavailable" }) });
  349 |     if (mapId === "second-map" && targetMode === "invalid") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mapId, revision: 1, etag: '"invalid"', activatedAt: new Date(0).toISOString(), document: { schemaVersion: 2, mapId } }) });
  350 |     if (mapId === "second-map") await new Promise((resolve) => setTimeout(resolve, targetMode === "slow" ? 2_000 : 350));
  351 |     const document = mapId === "second-map" ? target : source;
  352 |     return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mapId, revision: 1, etag: `"${mapId}:1:test"`, activatedAt: new Date(0).toISOString(), document }) });
  353 |   });
  354 | 
  355 |   const email = `portal-${Date.now()}@example.com`;
  356 |   await registerAndLogin(page, "Portal Tester", email);
  357 |   await finishPrologue(page);
  358 |   await page.evaluate((account) => localStorage.setItem(`vanlang-rebirth-seen:${account}`, "true"), email);
  359 |   await enterDungeon(page);
  360 |   await expect(page.getByRole("button", { name: "Bước vào ký ức" })).toBeVisible();
  361 |   await page.getByRole("button", { name: "Bước vào ký ức" }).click();
  362 |   await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual({ x: source.navigation.spawn.x, y: source.navigation.spawn.z });
  363 |   await page.keyboard.press("KeyD");
  364 |   await expect(page.getByText("Đang tải map đích… Input đã khóa.")).toBeVisible();
  365 |   await page.keyboard.press("KeyD");
  366 |   await page.keyboard.press("KeyD");
  367 |   expect(targetRequests).toBe(1);
  368 |   await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("second-map");
  369 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual({ x: 1, y: 1 });
  370 |   await page.waitForTimeout(700);
  371 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("second-map");
  372 |   expect(targetRequests).toBeLessThanOrEqual(2);
  373 |   await page.screenshot({ path: `${evidenceDir}/08-portal-transition-pass.png`, fullPage: true });
  374 | 
  375 |   await page.reload();
  376 |   await page.getByRole("button", { name: "Tiếp tục" }).click();
  377 |   await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  378 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("second-map");
  379 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual({ x: 1, y: 1 });
  380 | 
  381 |   targetMode = "http-error";
  382 |   await page.evaluate(() => {
  383 |     const current = JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}");
  384 |     localStorage.setItem("vanlang-game-mock-v4", JSON.stringify({ ...current, screen: "dungeon", selectedMap: "vanlang", playerPos: { x: 0, y: 0 } }));
  385 |   });
  386 |   await page.reload();
  387 |   await page.getByRole("button", { name: "Tiếp tục" }).click();
  388 |   await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  389 |   await page.waitForTimeout(500);
  390 |   await page.keyboard.press("KeyD");
  391 |   await expect(page.getByText(/Bạn vẫn ở map nguồn/)).toBeVisible();
  392 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("vanlang");
  393 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").playerPos)).toEqual({ x: 0, y: 0.28 });
  394 |   await page.screenshot({ path: `${evidenceDir}/09-portal-transition-rollback.png`, fullPage: true });
  395 | 
  396 |   targetMode = "invalid";
  397 |   await page.reload();
  398 |   await page.getByRole("button", { name: "Tiếp tục" }).click();
  399 |   await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  400 |   await page.keyboard.press("KeyA");
  401 |   await page.keyboard.press("KeyD");
  402 |   await expect(page.getByText(/Bạn vẫn ở map nguồn/)).toBeVisible();
  403 |   expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("vanlang");
  404 | 
  405 |   targetMode = "slow";
  406 |   await page.reload();
  407 |   await page.getByRole("button", { name: "Tiếp tục" }).click();
  408 |   await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  409 |   await page.keyboard.press("KeyA");
  410 |   await page.keyboard.press("KeyD");
  411 |   await expect(page.getByText("Đang tải map đích… Input đã khóa.")).toBeVisible();
  412 |   const sourceBeforeRefresh = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}"));
  413 |   await page.reload();
  414 |   await page.getByRole("button", { name: "Tiếp tục" }).click();
  415 |   await expect(page.getByRole("main", { name: "Phó bản Văn Lang" })).toBeVisible();
  416 |   const sourceAfterRefresh = await page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}"));
  417 |   expect(sourceAfterRefresh.selectedMap).toBe(sourceBeforeRefresh.selectedMap);
  418 |   expect(sourceAfterRefresh.playerPos).toEqual(sourceBeforeRefresh.playerPos);
  419 | });
  420 | 
  421 | test("map2 stone puzzle wrong retry, completion, and reload reveal Kinh Dương Vương", async ({ page }) => {
  422 |   const fixture = JSON.parse(await readFile("packages/map-contract/maps/vanlang.v1.json", "utf8"));
  423 |   const source = upgradeMapDocument(fixture);
  424 |   source.portals = [{ id: "to-map2", enabled: true, trigger: { type: "circle", center: { x: 0, z: 0.28 }, radius: 0.13 }, target: { mapId: "map2", entryPointId: "default" } }];
  425 |   const target = { ...upgradeMapDocument(fixture), mapId: "map2", metadata: { ...source.metadata, name: "Cổng Huyền Sử" }, objects: [{ id: "kinh-duong-vuong-stone", name: "Phiến đá Kinh Dương Vương", enabled: true, renderOrder: 1, collider: { type: "none" as const }, kind: "model3d" as const, renderLayer: "world3d" as const, src: "/models/vanlang-rebirth/arena.runtime.glb", transform3d: { position: { x: 1, y: 0.72, z: 1 }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 0.1, y: 0.1, z: 0.1 } }, castShadow: false, receiveShadow: false }], navigation: { ...source.navigation, spawn: { x: 1, z: 1 }, entryPoints: [{ id: "default", position: { x: 1, z: 1 }, facingDeg: 0 }] }, portals: [], npcs: [{ id: "kinh-duong-vuong", name: "Kinh Dương Vương", src: "/models/vanlang-rebirth/hero.runtime.glb", transform: { position: { x: 1, y: 0.72, z: 1 }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 0.1, y: 0.1, z: 0.1 } }, dialogue: "Ta là Kinh Dương Vương, tên Lộc Tục." }] };
  426 |   await page.route("**/api/map-flows/vanlang/maps/**", (route) => { const mapId = new URL(route.request().url()).pathname.split("/").at(-1)!; const document = mapId === "map2" ? target : source; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mapId, revision: 1, etag: `\"${mapId}:1:test\"`, activatedAt: new Date(0).toISOString(), document }) }); });
  427 |   const questions = Array.from({ length: 20 }, (_, index) => ({ id: `c1-M01-${index + 1}`, sortOrder: index + 1, topic: "Huyền sử", difficultyLevel: "recognize", questionText: `Câu hỏi M01 số ${index + 1}`, options: ["Đúng", "Sai A", "Sai B", "Sai C"], hint: null, damage: 10 }));
  428 |   await page.route("**/api/questions/stage/M01?poolSize=20", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stage: { code: "M01" }, questions }) }));
  429 |   let correct = false;
  430 |   await page.route("**/api/questions/answer", async (route) => { const body = route.request().postDataJSON(); correct = body.selectedOptionIndex === 0; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isCorrect: correct, correctOptionIndex: 0, damage: correct ? 10 : 0, feedback: correct ? "Chính xác" : "Hãy thử câu khác", generalExplanation: null }) }); });
  431 |   const email = `stone-${Date.now()}@example.com`;
  432 |   await registerAndLogin(page, "Stone Tester", email);
  433 |   await finishPrologue(page);
  434 |   await page.evaluate((account) => { localStorage.setItem(`vanlang-rebirth-seen:${account}`, "true"); localStorage.setItem(`vanlang:kinh-duong-vuong-stone:v1:${encodeURIComponent(account)}`, JSON.stringify({ version: 1, accountId: account, mapId: "map2", placed: Array.from({ length: 19 }, (_, index) => index + 1), seenQuestionIds: [], completed: false })); }, email);
  435 |   await enterDungeon(page);
  436 |   await page.getByRole("button", { name: "Bước vào ký ức" }).click();
  437 |   await page.keyboard.press("KeyD");
  438 |   await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("vanlang-game-mock-v4") ?? "{}").selectedMap)).toBe("map2");
  439 |   await expect(page.getByText("Phiến đá Kinh Dương Vương", { exact: true })).toBeVisible();
  440 |   await expect(page.getByText("Kinh Dương Vương", { exact: true })).not.toBeVisible();
  441 |   await page.keyboard.press("Space");
> 442 |   await expect(page.getByRole("heading", { name: "Phiến đá Kinh Dương Vương" })).toBeVisible();
      |                                                                                  ^ Error: expect(locator).toBeVisible() failed
  443 |   await page.getByRole("button", { name: "Mảnh đá 20" }).click();
  444 |   const firstQuestion = await page.locator(".stone-question > p").first().textContent();
  445 |   await page.getByRole("button", { name: "Sai A" }).click(); await page.getByRole("button", { name: "Trả lời" }).click();
  446 |   await expect(page.getByText("Tiến độ 19/20")).toBeVisible();
  447 |   await page.getByRole("button", { name: "Thử mảnh lại" }).click(); await page.getByRole("button", { name: "Mảnh đá 20" }).click();
  448 |   await expect(page.locator(".stone-question > p").first()).not.toHaveText(firstQuestion ?? "");
  449 |   await page.getByRole("button", { name: "Đúng" }).click(); await page.getByRole("button", { name: "Trả lời" }).click();
  450 |   await expect(page.getByText("Tiến độ 20/20")).toBeVisible();
  451 |   await page.getByRole("button", { name: "Đóng thử thách" }).click();
  452 |   await expect(page.getByText("Phiến đá Kinh Dương Vương", { exact: true })).not.toBeVisible();
  453 |   await expect(page.getByText("Kinh Dương Vương", { exact: true })).toBeVisible();
  454 |   await page.reload(); await page.getByRole("button", { name: "Tiếp tục" }).click();
  455 |   await expect(page.getByText("Kinh Dương Vương", { exact: true })).toBeVisible();
  456 | });
  457 | 
  458 | 
  459 | 
  460 | 
  461 | 
  462 | 
  463 | 
```