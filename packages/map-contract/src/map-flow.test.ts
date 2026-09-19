import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalStringify, getNpcDialogueChain, upgradeMapDocument, validateMapDocument, validateMapFlowDocument, validateMapFlowSnapshot } from "./index.js";

const fixture = JSON.parse(await readFile(new URL("../maps/vanlang.v1.json", import.meta.url), "utf8"));

test("upgrades V1 without mutating the fixture", () => {
  const before = canonicalStringify(fixture);
  const upgraded = upgradeMapDocument(fixture);
  assert.equal(upgraded.schemaVersion, 4);
  assert.deepEqual(upgraded.npcs, []);
  assert.deepEqual(upgraded.portals, []);
  assert.deepEqual(upgraded.navigation.entryPoints, [{ id: "default", position: fixture.navigation.spawn, facingDeg: 0 }]);
  assert.equal(upgraded.navigation.spawnFacingDeg, 180);
  assert.equal(canonicalStringify(fixture), before);
});

test("validates V3 NPC data and preserves legacy compatibility", () => {
  const document = upgradeMapDocument(fixture);
  const npc = {
    id: "historian",
    name: "Sử quan",
    src: "/runtime-assets/glb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.glb",
    transform: { position: { x: document.navigation.spawn.x, y: document.world.groundY, z: document.navigation.spawn.z }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    dialogue: "Hãy lắng nghe chuyện xưa.",
  };
  document.npcs = [npc];
  const valid = validateMapDocument(document);
  assert.equal(valid.success, true);
  if (valid.success) assert.deepEqual(valid.document.npcs[0], npc);

  document.npcs.push({ ...npc });
  const duplicate = validateMapDocument(document);
  assert.equal(duplicate.success, false);
  if (!duplicate.success) assert.equal(duplicate.issues.some((issue) => issue.code === "DUPLICATE_NPC_ID"), true);

  document.npcs = [{ ...npc, id: "outside", transform: { ...npc.transform, position: { x: 9_000, y: 0, z: 9_000 } } }];
  const outside = validateMapDocument(document);
  assert.equal(outside.success, false);
  if (!outside.success) assert.equal(outside.issues.some((issue) => issue.code === "INVALID_NPC_POSITION"), true);
});

test("supports and validates NPC multi-conversation chain and fallback", () => {
  const document = upgradeMapDocument(fixture);
  const npcWithChain = {
    id: "elder",
    name: "Già làng",
    src: "/runtime-assets/glb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.glb",
    transform: { position: { x: document.navigation.spawn.x, y: document.world.groundY, z: document.navigation.spawn.z }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    dialogue: "Chào mừng tráng sĩ đến với Văn Lang.",
    dialogueChain: [
      { text: "Chào mừng tráng sĩ đến với Văn Lang." },
      { text: "Nơi đây lưu giữ ký ức về thời kỳ dựng nước.", speaker: "Già làng" },
      { text: "Ta sẽ cố gắng tìm lại cổ vật!", speaker: "Người chơi" },
    ],
  };
  document.npcs = [npcWithChain];
  const valid = validateMapDocument(document);
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.deepEqual(valid.document.npcs[0].dialogueChain, npcWithChain.dialogueChain);
    const resolvedChain = getNpcDialogueChain(valid.document.npcs[0]);
    assert.equal(resolvedChain.length, 3);
    assert.equal(resolvedChain[0].text, "Chào mừng tráng sĩ đến với Văn Lang.");
    assert.equal(resolvedChain[2].speaker, "Người chơi");
  }

  // Legacy NPC without dialogueChain
  const legacyNpc = {
    id: "legacy-guide",
    name: "Hướng dẫn viên",
    src: "/runtime-assets/glb/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.glb",
    transform: { position: { x: document.navigation.spawn.x, y: document.world.groundY, z: document.navigation.spawn.z }, rotationDeg: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    dialogue: "Câu thoại đơn lẻ.",
  };
  const legacyChain = getNpcDialogueChain(legacyNpc);
  assert.equal(legacyChain.length, 1);
  assert.equal(legacyChain[0].text, "Câu thoại đơn lẻ.");
  assert.equal(legacyChain[0].speaker, "Hướng dẫn viên");

  // Invalid step: empty text
  const invalidNpc = {
    ...npcWithChain,
    dialogueChain: [{ text: "" }],
  };
  document.npcs = [invalidNpc];
  const invalid = validateMapDocument(document);
  assert.equal(invalid.success, false);
});

test("validates duplicate portal IDs and invalid trigger or entry positions", () => {
  const document = upgradeMapDocument(fixture);
  document.navigation.entryPoints.push({ id: "default", position: { x: 9_000, z: 9_000 }, facingDeg: 0 });
  document.portals = [
    { id: "gate", enabled: true, trigger: { type: "circle", center: { x: 9_000, z: 9_000 }, radius: 1 }, target: { mapId: "vanlang", entryPointId: "default" } },
    { id: "gate", enabled: false, trigger: { type: "circle", center: document.navigation.spawn, radius: 1 }, target: { mapId: "vanlang", entryPointId: "default" } },
  ];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set(["DUPLICATE_ENTRY_POINT_ID", "INVALID_ENTRY_POINT", "INVALID_PORTAL_TRIGGER", "DUPLICATE_PORTAL_ID"]));
});

test("rejects overlapping portal triggers", () => {
  const document = upgradeMapDocument(fixture);
  document.portals = [
    { id: "gate-a", enabled: true, trigger: { type: "circle", center: { x: 0, z: 0 }, radius: 0.5 }, target: { mapId: "vanlang", entryPointId: "default" } },
    { id: "gate-b", enabled: true, trigger: { type: "circle", center: { x: 0.75, z: 0 }, radius: 0.5 }, target: { mapId: "vanlang", entryPointId: "default" } },
  ];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.issues.some((issue) => issue.code === "OVERLAPPING_PORTAL_TRIGGER" && issue.portalId === "gate-b"), true);
});

test("rejects entry points and triggers invalidated by a navmesh edit", () => {
  const document = upgradeMapDocument(fixture);
  document.navigation.entryPoints = [{ id: "arrival", position: { x: 3, z: 3 }, facingDeg: 0 }];
  document.portals = [{ id: "gate", enabled: true, trigger: { type: "circle", center: { x: -3, z: -3 }, radius: 0.25 }, target: { mapId: "vanlang", entryPointId: "arrival" } }];
  document.navigation.walkablePolygons = [{ id: "center-only", enabled: true, points: [{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }] }];
  const result = validateMapDocument(document);
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set(["INVALID_ENTRY_POINT", "INVALID_PORTAL_TRIGGER"]));
});

test("validates graph duplicates and cross-map targets", () => {
  const duplicate = validateMapFlowDocument({ schemaVersion: 1, flowId: "vanlang", nodes: [
    { mapId: "vanlang", mapRevision: 1, position: { x: 0.2, y: 0.3 } },
    { mapId: "vanlang", mapRevision: 1, position: { x: 0.4, y: 0.5 } },
  ] });
  assert.equal(duplicate.success, false);

  const source = upgradeMapDocument(fixture);
  source.portals = [{ id: "gate", enabled: true, trigger: { type: "circle", center: source.navigation.spawn, radius: 1 }, target: { mapId: "missing", entryPointId: "default" } }];
  const flow = { schemaVersion: 1 as const, flowId: "vanlang", nodes: [{ mapId: "vanlang", mapRevision: 1, position: { x: 0.2, y: 0.3 } }] };
  assert.equal(validateMapFlowSnapshot(flow, new Map([["vanlang", source]]))[0]?.code, "PORTAL_TARGET_NOT_FOUND");
});
