import { readFile, writeFile } from "node:fs/promises";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const [inputPath, outputPath, animationList = ""] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error("Usage: node scripts/filter-glb-runtime.mjs <input.glb> <output.glb> [Animation,Names]");
}

const source = await readFile(inputPath);
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2) {
  throw new Error(`${inputPath} is not a binary glTF 2.0 file.`);
}

let offset = 12;
let json;
let binaryChunk;

while (offset < source.length) {
  const chunkLength = source.readUInt32LE(offset);
  const chunkType = source.readUInt32LE(offset + 4);
  const chunk = source.subarray(offset + 8, offset + 8 + chunkLength);

  if (chunkType === JSON_CHUNK) {
    json = JSON.parse(chunk.toString("utf8").trimEnd());
  } else if (chunkType === BIN_CHUNK) {
    binaryChunk = chunk;
  }

  offset += 8 + chunkLength;
}

if (!json || !binaryChunk) {
  throw new Error(`${inputPath} is missing its JSON or binary chunk.`);
}

const keepAnimations = new Set(animationList.split(",").filter(Boolean));
if (json.animations) {
  json.animations = json.animations.filter((animation) => keepAnimations.has(animation.name));
  if (json.animations.length === 0) delete json.animations;
}

for (const node of json.nodes ?? []) delete node.camera;
delete json.cameras;

const jsonBytes = Buffer.from(JSON.stringify(json));
const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
const binaryPadding = (4 - (binaryChunk.length % 4)) % 4;
const paddedBinary = Buffer.concat([binaryChunk, Buffer.alloc(binaryPadding)]);
const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBinary.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(paddedJson.length, 0);
jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
const binaryHeader = Buffer.alloc(8);
binaryHeader.writeUInt32LE(paddedBinary.length, 0);
binaryHeader.writeUInt32LE(BIN_CHUNK, 4);

await writeFile(outputPath, Buffer.concat([header, jsonHeader, paddedJson, binaryHeader, paddedBinary]));
