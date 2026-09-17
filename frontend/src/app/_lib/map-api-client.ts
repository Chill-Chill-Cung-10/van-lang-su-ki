import {
  MapListResponseSchema,
  MapFlowEnvelopeSchema,
  MapRevisionEnvelopeSchema,
  canonicalStringify,
  validateMapDocument,
  type MapDocument,
  type CloneMapRequest,
  type MapFlowDraft,
  type MapFlowEnvelope,
  type MapRevisionEnvelope,
  type MapSummary,
} from "@van-lang/map-contract";
import vanlangFixture from "@van-lang/map-contract/maps/vanlang.v1.json";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export class MapApiError extends Error {
  constructor(public status: number, public code: string, message = code, public issues: Array<{ mapId?: string; path?: string; message?: string }> = []) { super(message); }
}

async function parseResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new MapApiError(response.status, body.code ?? "MAP_REQUEST_FAILED", body.message, Array.isArray(body.issues) ? body.issues : []);
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

export async function loadMapFlow(flowId: string): Promise<MapFlowEnvelope> {
  return MapFlowEnvelopeSchema.parse(await parseResponse(await fetch(`${API_BASE_URL}/api/map-flows/${encodeURIComponent(flowId)}`, { cache: "no-store" })));
}

export async function loadFlowMap(flowId: string, mapId: string, signal?: AbortSignal): Promise<MapRevisionEnvelope> {
  return MapRevisionEnvelopeSchema.parse(await parseResponse(await fetch(`${API_BASE_URL}/api/map-flows/${encodeURIComponent(flowId)}/maps/${encodeURIComponent(mapId)}`, { cache: "no-store", signal })));
}

export async function cloneFlowMap(flowId: string, input: CloneMapRequest, flowEtag: string): Promise<{ flow: MapFlowEnvelope; map: MapRevisionEnvelope }> {
  const body = await parseResponse(await fetch(`${API_BASE_URL}/api/admin/map-flows/${encodeURIComponent(flowId)}/maps`, {
    method: "POST", headers: { "Content-Type": "application/json", "If-Match": flowEtag }, body: JSON.stringify(input),
  }));
  return { flow: MapFlowEnvelopeSchema.parse(body.flow), map: MapRevisionEnvelopeSchema.parse(body.map) };
}

export async function saveMapFlow(flowId: string, document: MapFlowDraft, maps: Array<{ mapId: string; expectedEtag: string; document: MapDocument }>, flowEtag: string): Promise<{ flow: MapFlowEnvelope; maps: MapRevisionEnvelope[] }> {
  const body = await parseResponse(await fetch(`${API_BASE_URL}/api/admin/map-flows/${encodeURIComponent(flowId)}`, {
    method: "PUT", headers: { "Content-Type": "application/json", "If-Match": flowEtag }, body: JSON.stringify({ document, maps }),
  }));
  return { flow: MapFlowEnvelopeSchema.parse(body.flow), maps: body.maps.map((item: unknown) => MapRevisionEnvelopeSchema.parse(item)) };
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
