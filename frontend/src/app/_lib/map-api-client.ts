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

export type ImportedGlb = { assetId: string; checksum: string; src: string; originalBytes: number; runtimeBytes: number; reused: boolean };
export type ImportedImage = { assetId: string; checksum: string; src: string; bytes: number; reused: boolean };
export type StageQuestion = { id: string; sortOrder: number; topic: string; difficultyLevel: string; questionText: string; options: string[]; hint: string | null; damage: number };
export type QuestionAnswer = { isCorrect: boolean; correctOptionIndex: number; damage: number; feedback: string; generalExplanation: string | null };

export async function loadQuestionPool(stageCode: string, poolSize: number): Promise<StageQuestion[]> {
  const body = await parseResponse(await fetch(`${API_BASE_URL}/api/questions/stage/${encodeURIComponent(stageCode)}?poolSize=${poolSize}`, { cache: "no-store" })) as { questions?: StageQuestion[] };
  if (!Array.isArray(body.questions) || body.questions.length < poolSize || body.questions.some((question) => "correctOptionIndex" in question)) throw new MapApiError(502, "QUESTION_POOL_INVALID");
  return body.questions;
}

export async function submitQuestionAnswer(questionId: string, selectedOptionIndex: number): Promise<QuestionAnswer> {
  return parseResponse(await fetch(`${API_BASE_URL}/api/questions/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, selectedOptionIndex }) })) as Promise<QuestionAnswer>;
}

export async function importGlb(file: File): Promise<ImportedGlb> {
  const form = new FormData();
  form.set("file", file);
  return parseResponse(await fetch(`${API_BASE_URL}/api/admin/assets/glb`, { method: "POST", body: form })) as Promise<ImportedGlb>;
}

export async function importImage(file: File): Promise<ImportedImage> {
  const form = new FormData();
  form.set("file", file);
  return parseResponse(await fetch(`${API_BASE_URL}/api/admin/assets/image`, { method: "POST", body: form })) as Promise<ImportedImage>;
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
