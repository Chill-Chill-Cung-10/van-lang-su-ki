import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import { getServerEnv } from "./env.js";

export function getStorageClient() {
  const env = getServerEnv();

  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
}

export async function publishGlbToS3(path: string, checksum: string) {
  const env = getServerEnv();
  const client = getStorageClient();
  const key = `glb/${checksum}.glb`;

  try {
    await client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { key, reused: true };
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
  }

  await client.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: await readFile(path),
    ContentType: "model/gltf-binary",
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: { checksum },
  }));
  return { key, reused: false };
}
