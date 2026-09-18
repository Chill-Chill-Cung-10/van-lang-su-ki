import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

export type GlbSummary = { scenes: number; meshes: number; skins: number; morphTargets: number; animations: string[] };
type SemanticSnapshot = GlbSummary & { joints: number[]; animationChannels: string[][] };
export type OptimizeRunner = (input: string, output: string) => Promise<void>;

function glbJson(bytes: Buffer): Record<string, unknown> {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("GLB_INVALID");
  }
  let offset = 12;
  let json: Record<string, unknown> | undefined;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > bytes.length) throw new Error("GLB_INVALID");
    if (type === 0x4e4f534a && !json) {
      try { json = JSON.parse(bytes.toString("utf8", offset, offset + length).replace(/\0+$/g, "").trim()) as Record<string, unknown>; }
      catch { throw new Error("GLB_INVALID"); }
    }
    offset += length;
  }
  if (!json || offset !== bytes.length) throw new Error("GLB_INVALID");
  const buffers = (json.buffers ?? []) as Array<{ uri?: string }>;
  const images = (json.images ?? []) as Array<{ uri?: string }>;
  if ([...buffers, ...images].some((item) => item.uri)) throw new Error("GLB_EXTERNAL_URI");
  return json;
}

function snapshot(bytes: Buffer): SemanticSnapshot {
  const json = glbJson(bytes);
  const meshes = (json.meshes ?? []) as Array<{ primitives?: Array<{ targets?: unknown[] }> }>;
  const skins = (json.skins ?? []) as Array<{ joints?: unknown[] }>;
  const animations = (json.animations ?? []) as Array<{ name?: string; channels?: Array<{ target?: { path?: string } }> }>;
  return {
    scenes: ((json.scenes ?? []) as unknown[]).length,
    meshes: meshes.length,
    skins: skins.length,
    morphTargets: meshes.reduce((total, mesh) => total + (mesh.primitives ?? []).reduce((sum, primitive) => sum + (primitive.targets?.length ?? 0), 0), 0),
    animations: animations.map((animation, index) => animation.name ?? `animation-${index}`),
    joints: skins.map((skin) => skin.joints?.length ?? 0),
    animationChannels: animations.map((animation) => (animation.channels ?? []).map((channel) => channel.target?.path ?? "")),
  };
}

async function stripCameras(path: string) {
  const bytes = await readFile(path);
  const json = glbJson(bytes);
  if (!Array.isArray(json.cameras) || json.cameras.length === 0) return;
  delete json.cameras;
  for (const node of (json.nodes ?? []) as Array<Record<string, unknown>>) delete node.camera;
  const encoded = Buffer.from(JSON.stringify(json), "utf8");
  const padded = Buffer.concat([encoded, Buffer.alloc((4 - encoded.length % 4) % 4, 0x20)]);
  let offset = 12;
  const chunks: Buffer[] = [];
  let replacedJson = false;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const data = type === 0x4e4f534a && !replacedJson ? (replacedJson = true, padded) : bytes.subarray(offset + 8, offset + 8 + length);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(data.length, 0);
    header.writeUInt32LE(type, 4);
    chunks.push(header, data);
    offset += 8 + length;
  }
  const header = Buffer.alloc(12);
  header.write("glTF", 0, "ascii");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + chunks.reduce((total, chunk) => total + chunk.length, 0), 8);
  await writeFile(path, Buffer.concat([header, ...chunks]));
}

export const runGltfTransform: OptimizeRunner = async (input, output) => {
  const cli = fileURLToPath(new URL("../../../../node_modules/@gltf-transform/cli/bin/cli.js", import.meta.url));
  await execFileAsync(process.execPath, [cli, "optimize", input, output, "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"], {
    cwd: new URL("../../../../", import.meta.url),
    maxBuffer: 1024 * 1024,
  });
};

export async function optimizeGlb(input: string, output: string, runner: OptimizeRunner = runGltfTransform): Promise<GlbSummary> {
  const before = snapshot(await readFile(input));
  await runner(input, output);
  await stripCameras(output);
  const afterBytes = await readFile(output);
  const after = snapshot(afterBytes);
  if (before.skins !== after.skins || before.morphTargets !== after.morphTargets || JSON.stringify(before.joints) !== JSON.stringify(after.joints)
    || JSON.stringify(before.animations) !== JSON.stringify(after.animations) || JSON.stringify(before.animationChannels) !== JSON.stringify(after.animationChannels)) {
    throw new Error("GLB_SEMANTICS_CHANGED");
  }
  return { scenes: after.scenes, meshes: after.meshes, skins: after.skins, morphTargets: after.morphTargets, animations: after.animations };
}

export async function publishGlb(output: string, storageDir: string, checksum: string): Promise<{ path: string; reused: boolean }> {
  const directory = `${storageDir}/glb`;
  const finalPath = `${directory}/${checksum}.glb`;
  const stagedPath = `${directory}/.${checksum}-${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true });
  try {
    await copyFile(output, stagedPath, constants.COPYFILE_EXCL);
    await link(stagedPath, finalPath);
    return { path: finalPath, reused: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    glbJson(await readFile(finalPath));
    return { path: finalPath, reused: true };
  } finally {
    await rm(stagedPath, { force: true });
    await rm(output, { force: true });
  }
}

export function validateGlb(bytes: Buffer) { return snapshot(bytes); }
