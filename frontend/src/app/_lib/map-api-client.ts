import {
  MapListResponseSchema,
  MapRevisionEnvelopeSchema,
  canonicalStringify,
  validateMapDocument,
  type MapDocument,
  type MapRevisionEnvelope,
  type MapSummary,
} from "@van-lang/map-contract";
import vanlangFixture from "@van-lang/map-contract/maps/vanlang.v1.json";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class MapApiError extends Error {
  constructor(public status: number, public code: string, message = code) { super(message); }
}

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new MapApiError(response.status, body.code ?? "MAP_REQUEST_FAILED", body.message);
  return body;
}

export async function listMaps(): Promise<MapSummary[]> {
  return MapListResponseSchema.parse(await parseResponse(await fetch(`${API_BASE_URL}/api/maps`, { cache: "no-store" }))).maps;
}

export async function loadMap(mapId: string): Promise<MapRevisionEnvelope> {
  return MapRevisionEnvelopeSchema.parse(await parseResponse(await fetch(`${API_BASE_URL}/api/maps/${encodeURIComponent(mapId)}`, { cache: "no-store" })));
}

export async function saveMap(mapId: string, document: MapDocument, etag: string): Promise<MapRevisionEnvelope> {
  const response = await fetch(`${API_BASE_URL}/api/admin/maps/${encodeURIComponent(mapId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "If-Match": etag },
    body: JSON.stringify({ document }),
  });
  return MapRevisionEnvelopeSchema.parse(await parseResponse(response));
}

export async function loadRuntimeMap(mapId: string): Promise<{ document: MapDocument; envelope: MapRevisionEnvelope | null; fallback: boolean }> {
  try {
    const envelope = await loadMap(mapId);
    return { document: envelope.document, envelope, fallback: false };
  } catch (error) {
    if (mapId !== "vanlang") throw error;
    const validation = validateMapDocument(vanlangFixture);
    if (!validation.success) throw new MapApiError(500, "MAP_FALLBACK_INVALID", canonicalStringify(validation.issues));
    return { document: validation.document, envelope: null, fallback: true };
  }
}
