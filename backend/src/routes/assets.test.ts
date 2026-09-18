import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import test from "node:test";
import Fastify from "fastify";
import { assetsRoutes } from "./assets.js";
import { optimizeGlb } from "../server/assets/glb-pipeline.js";

function glb(document: Record<string, unknown>) {
  const json = Buffer.from(JSON.stringify(document), "utf8");
  const padding = (4 - json.length % 4) % 4;
  const chunk = Buffer.concat([json, Buffer.alloc(padding, 0x20)]);
  const result = Buffer.alloc(20 + chunk.length);
  result.write("glTF", 0, "ascii");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(chunk.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  chunk.copy(result, 20);
  return result;
}

function multipartBody(file: Buffer) {
  const boundary = "vanlang-test-boundary";
  return {
    boundary,
    body: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="npc.glb"\r\nContent-Type: model/gltf-binary\r\n\r\n`),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

test("imports, deduplicates and serves a valid GLB", async () => {
  const storageDir = await mkdtemp(`${tmpdir()}/vanlang-assets-test-`);
  const app = Fastify();
  await app.register(assetsRoutes, { storageDir, maxBytes: 1024 * 1024, writeEnabled: true, frontendUrl: "http://localhost:3000", runner: async (input, output) => copyFile(input, output) });
  const file = glb({ asset: { version: "2.0" }, scenes: [{}], scene: 0, nodes: [], meshes: [], skins: [], animations: [] });
  const multipart = multipartBody(file);
  try {
    const responses = await Promise.all([1, 2].map(() => app.inject({ method: "POST", url: "/api/admin/assets/glb", headers: { origin: "http://localhost:3000", "content-type": `multipart/form-data; boundary=${multipart.boundary}` }, payload: multipart.body })));
    assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 201]);
    const imported = responses.find((response) => response.statusCode === 201)!.json();
    assert.match(imported.checksum, /^[a-f0-9]{64}$/);
    assert.equal(imported.src, `/runtime-assets/glb/${imported.checksum}.glb`);
    assert.equal(imported.reused, false);

    const reused = responses.find((response) => response.statusCode === 200)!;
    assert.equal(reused.json().reused, true);
    assert.equal(reused.json().checksum, imported.checksum);
    assert.deepEqual(await readdir(`${storageDir}/glb`), [`${imported.checksum}.glb`]);

    const fetched = await app.inject({ method: "GET", url: `/api/assets/glb/${imported.checksum}.glb` });
    assert.equal(fetched.statusCode, 200);
    assert.equal(fetched.headers["content-type"], "model/gltf-binary");
    assert.deepEqual(fetched.rawPayload, file);
    const cached = await app.inject({ method: "GET", url: `/api/assets/glb/${imported.checksum}.glb`, headers: { "if-none-match": `"${imported.checksum}"` } });
    assert.equal(cached.statusCode, 304);
  } finally {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  }
});

test("rejects invalid GLB without publishing", async () => {
  const storageDir = await mkdtemp(`${tmpdir()}/vanlang-assets-test-`);
  const app = Fastify();
  await app.register(assetsRoutes, { storageDir, maxBytes: 1024, writeEnabled: true, frontendUrl: "http://localhost:3000", runner: async () => assert.fail("optimizer must not run") });
  const multipart = multipartBody(Buffer.from("not a glb"));
  try {
    const response = await app.inject({ method: "POST", url: "/api/admin/assets/glb", headers: { origin: "http://localhost:3000", "content-type": `multipart/form-data; boundary=${multipart.boundary}` }, payload: multipart.body });
    assert.equal(response.statusCode, 422);
    assert.equal(response.json().code, "GLB_INVALID");
    assert.deepEqual(await readdir(`${storageDir}/glb`), []);
  } finally {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  }
});

test("post-validation preserves skins, morph targets and all animation channels", async () => {
  const directory = await mkdtemp(`${tmpdir()}/vanlang-semantics-`);
  const input = `${directory}/input.glb`;
  const output = `${directory}/output.glb`;
  await writeFile(input, glb({
    asset: { version: "2.0" }, scenes: [{}], meshes: [{ primitives: [{ targets: [{ POSITION: 0 }] }] }],
    skins: [{ joints: [0, 1] }], nodes: [{}, {}],
    animations: [{ name: "Idle", channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }], samplers: [{ input: 0, output: 0 }] }],
  }));
  try {
    const summary = await optimizeGlb(input, output, async (source, target) => copyFile(source, target));
    assert.deepEqual(summary, { scenes: 1, meshes: 1, skins: 1, morphTargets: 1, animations: ["Idle"] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("real glTF Transform pipeline produces a post-validated runtime GLB", async () => {
  const directory = await mkdtemp(`${tmpdir()}/vanlang-gltf-transform-`);
  const input = `${directory}/input.glb`;
  const output = `${directory}/output.glb`;
  await writeFile(input, glb({ asset: { version: "2.0" }, scenes: [{ nodes: [0] }], scene: 0, nodes: [{ camera: 0 }], cameras: [{ type: "perspective", perspective: { yfov: 1, znear: 0.1 } }], meshes: [], skins: [], animations: [] }));
  try {
    const summary = await optimizeGlb(input, output);
    assert.deepEqual(summary, { scenes: 1, meshes: 0, skins: 0, morphTargets: 0, animations: [] });
    assert.equal((await readFile(output)).includes(Buffer.from('"cameras"')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
