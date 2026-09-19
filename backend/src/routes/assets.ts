import multipart from "@fastify/multipart";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyPluginAsync } from "fastify";
import { getServerEnv } from "../server/env.js";
import { optimizeGlb, publishGlb, validateGlb, type OptimizeRunner } from "../server/assets/glb-pipeline.js";
import { publishGlbToS3 } from "../server/storage.js";

type Options = { storageDir?: string; storageDriver?: "local" | "s3"; publicBaseUrl?: string; maxBytes?: number; writeEnabled?: boolean; frontendUrl?: string; runner?: OptimizeRunner };
const checksumPattern = /^[a-f0-9]{64}$/;
const imageTypes = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

export const assetsRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  const env = options.storageDir === undefined || options.maxBytes === undefined || options.writeEnabled === undefined || options.frontendUrl === undefined ? getServerEnv() : null;
  const storageDir = resolve(options.storageDir ?? env!.ASSET_STORAGE_DIR);
  const storageDriver = options.storageDriver ?? env?.ASSET_STORAGE_DRIVER ?? "local";
  const publicBaseUrl = options.publicBaseUrl ?? env?.ASSET_PUBLIC_BASE_URL;
  const maxBytes = options.maxBytes ?? env!.ASSET_UPLOAD_MAX_BYTES;
  const writeEnabled = options.writeEnabled ?? env!.MAP_EDITOR_WRITE_ENABLED;
  const frontendUrl = options.frontendUrl ?? env!.FRONTEND_URL;
  if (storageDriver === "local") {
    await mkdir(`${storageDir}/glb`, { recursive: true });
    await mkdir(`${storageDir}/image`, { recursive: true });
  }
  await app.register(multipart, { limits: { files: 1, fileSize: maxBytes, fields: 0 } });

  app.post("/api/admin/assets/glb", async (request, reply) => {
    if (!writeEnabled) return reply.status(403).send({ code: "ASSET_UPLOAD_DISABLED" });
    if (request.headers.origin !== frontendUrl) return reply.status(403).send({ code: "MAP_EDITOR_ORIGIN_REJECTED" });
    const tempDir = await mkdtemp(`${tmpdir()}/vanlang-glb-`);
    const input = `${tempDir}/source.glb`;
    const output = `${tempDir}/runtime.glb`;
    try {
      const part = await request.file();
      if (!part || part.fieldname !== "file" || !part.filename.toLowerCase().endsWith(".glb")) return reply.status(400).send({ code: "GLB_FILE_REQUIRED" });
      const hash = createHash("sha256");
      let originalBytes = 0;
      const counter = new Transform({ transform(chunk: Buffer, _encoding, callback) { originalBytes += chunk.length; hash.update(chunk); callback(null, chunk); } });
      await pipeline(part.file, counter, createWriteStream(input, { flags: "wx" }));
      if (part.file.truncated) return reply.status(413).send({ code: "GLB_TOO_LARGE" });
      validateGlb(await readFile(input));
      const checksum = hash.digest("hex");
      const summary = await optimizeGlb(input, output, options.runner);
      const runtimeBytes = (await stat(output)).size;
      const published = storageDriver === "s3"
        ? await publishGlbToS3(output, checksum)
        : await publishGlb(output, storageDir, checksum);
      return reply.status(published.reused ? 200 : 201).send({
        assetId: checksum, checksum, src: `/runtime-assets/glb/${checksum}.glb`, originalBytes, runtimeBytes, reused: published.reused, summary,
      });
    } catch (error) {
      request.log.warn(error, "GLB import failed");
      const message = (error as Error).message;
      if (message === "GLB_INVALID" || message === "GLB_EXTERNAL_URI") return reply.status(422).send({ code: "GLB_INVALID" });
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send({ code: "GLB_TOO_LARGE" });
      return reply.status(422).send({ code: "GLB_OPTIMIZE_FAILED" });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  app.post("/api/admin/assets/image", async (request, reply) => {
    if (!writeEnabled) return reply.status(403).send({ code: "ASSET_UPLOAD_DISABLED" });
    if (request.headers.origin !== frontendUrl) return reply.status(403).send({ code: "MAP_EDITOR_ORIGIN_REJECTED" });
    try {
      const part = await request.file();
      const extension = part ? imageTypes[part.mimetype as keyof typeof imageTypes] : undefined;
      if (!part || part.fieldname !== "file" || !extension) return reply.status(400).send({ code: "IMAGE_FILE_REQUIRED" });
      const buffer = await part.toBuffer();
      if (part.file.truncated) return reply.status(413).send({ code: "IMAGE_TOO_LARGE" });
      const validSignature = extension === "png" ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : extension === "jpg" ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9
        : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
      if (!validSignature) return reply.status(422).send({ code: "IMAGE_INVALID" });
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const path = `${storageDir}/image/${checksum}.${extension}`;
      let reused = false;
      try { await writeFile(path, buffer, { flag: "wx" }); }
      catch (error) { if ((error as { code?: string }).code === "EEXIST") reused = true; else throw error; }
      return reply.status(reused ? 200 : 201).send({ assetId: checksum, checksum, src: `/runtime-assets/image/${checksum}.${extension}`, bytes: buffer.length, reused });
    } catch (error) {
      request.log.warn(error, "Image import failed");
      if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send({ code: "IMAGE_TOO_LARGE" });
      return reply.status(422).send({ code: "IMAGE_IMPORT_FAILED" });
    }
  });

  app.get("/api/assets/glb/:checksum.glb", async (request, reply) => {
    const checksum = (request.params as { checksum?: string }).checksum ?? "";
    if (!checksumPattern.test(checksum)) return reply.status(400).send({ code: "INVALID_ASSET_ID" });
    if (storageDriver === "s3") return reply.redirect(`${publicBaseUrl}/glb/${checksum}.glb`);
    const path = `${storageDir}/glb/${checksum}.glb`;
    try {
      await stat(path);
      const etag = `"${checksum}"`;
      if (request.headers["if-none-match"] === etag) return reply.status(304).send();
      return reply.header("ETag", etag).header("Cache-Control", "public, max-age=31536000, immutable").type("model/gltf-binary").send(createReadStream(path));
    } catch { return reply.status(404).send({ code: "ASSET_NOT_FOUND" }); }
  });

  app.get("/api/assets/image/:filename", async (request, reply) => {
    const filename = (request.params as { filename?: string }).filename ?? "";
    const match = filename.match(/^([a-f0-9]{64})\.(png|jpg|webp)$/);
    if (!match) return reply.status(400).send({ code: "INVALID_ASSET_ID" });
    try {
      const etag = `"${match[1]}"`;
      if (request.headers["if-none-match"] === etag) return reply.status(304).send();
      const mime = match[2] === "jpg" ? "image/jpeg" : `image/${match[2]}`;
      return reply.header("ETag", etag).header("Cache-Control", "public, max-age=31536000, immutable").type(mime).send(createReadStream(`${storageDir}/image/${filename}`));
    } catch { return reply.status(404).send({ code: "ASSET_NOT_FOUND" }); }
  });
};
