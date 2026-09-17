import { CloneMapRequestSchema, SaveMapFlowRequestSchema } from "@van-lang/map-contract";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getServerEnv } from "../server/env.js";
import {
  databaseMapFlowsRepository,
  FlowMapAlreadyExistsError,
  FlowMapNotFoundError,
  FlowMapRevisionConflictError,
  FlowNotFoundError,
  FlowRevisionConflictError,
  MapFlowInvalidError,
  type MapFlowsRepository,
} from "../server/maps/map-flow-repository.js";

const paramsSchema = z.object({ flowId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64) });
const mapParamsSchema = paramsSchema.extend({ mapId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64) });
type Options = { repository?: MapFlowsRepository; writeEnabled?: boolean; frontendUrl?: string };

export const mapFlowsRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  const repository = options.repository ?? databaseMapFlowsRepository;
  const writeAllowed = (request: { headers: Record<string, unknown> }) => {
    const env = options.writeEnabled === undefined || options.frontendUrl === undefined ? getServerEnv() : null;
    return { enabled: options.writeEnabled ?? env!.MAP_EDITOR_WRITE_ENABLED, origin: request.headers.origin === (options.frontendUrl ?? env!.FRONTEND_URL) };
  };

  app.get("/api/map-flows/:flowId", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_FLOW_ID" });
    try {
      const flow = await repository.loadFlow(params.data.flowId);
      if (!flow) return reply.status(404).send({ code: "FLOW_NOT_FOUND" });
      if (request.headers["if-none-match"] === flow.etag) return reply.status(304).send();
      reply.header("ETag", flow.etag);
      return flow;
    } catch (error) { app.log.error(error, "Map flow load failed"); return reply.status(503).send({ code: "MAP_FLOW_DATABASE_UNAVAILABLE" }); }
  });

  app.get("/api/map-flows/:flowId/maps/:mapId", async (request, reply) => {
    const params = mapParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_MAP_FLOW_PATH" });
    try {
      const map = await repository.loadMap(params.data.flowId, params.data.mapId);
      if (!map) return reply.status(404).send({ code: "MAP_NOT_FOUND" });
      if (request.headers["if-none-match"] === map.etag) return reply.status(304).send();
      reply.header("ETag", map.etag);
      return map;
    } catch (error) { app.log.error(error, "Pinned map load failed"); return reply.status(503).send({ code: "MAP_FLOW_DATABASE_UNAVAILABLE" }); }
  });

  app.post("/api/admin/map-flows/:flowId/maps", async (request, reply) => {
    const gate = writeAllowed(request);
    if (!gate.enabled) return reply.status(503).send({ code: "MAP_EDITOR_WRITE_DISABLED" });
    if (!gate.origin) return reply.status(403).send({ code: "MAP_EDITOR_ORIGIN_REJECTED" });
    const params = paramsSchema.safeParse(request.params);
    const body = CloneMapRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ code: "MAP_FLOW_REQUEST_INVALID", issues: body.success ? [] : body.error.issues });
    const expected = request.headers["if-match"];
    if (typeof expected !== "string") return reply.status(400).send({ code: "IF_MATCH_REQUIRED" });
    try {
      const created = await repository.cloneMap(params.data.flowId, expected, body.data);
      reply.header("ETag", created.flow.etag);
      return reply.status(201).send(created);
    } catch (error) { return sendMutationError(reply, error); }
  });

  app.put("/api/admin/map-flows/:flowId", async (request, reply) => {
    const gate = writeAllowed(request);
    if (!gate.enabled) return reply.status(503).send({ code: "MAP_EDITOR_WRITE_DISABLED" });
    if (!gate.origin) return reply.status(403).send({ code: "MAP_EDITOR_ORIGIN_REJECTED" });
    const params = paramsSchema.safeParse(request.params);
    const body = SaveMapFlowRequestSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.status(400).send({ code: "MAP_FLOW_REQUEST_INVALID", issues: body.success ? [] : body.error.issues });
    const expected = request.headers["if-match"];
    if (typeof expected !== "string") return reply.status(400).send({ code: "IF_MATCH_REQUIRED" });
    try {
      const saved = await repository.saveFlow(params.data.flowId, expected, body.data);
      reply.header("ETag", saved.flow.etag);
      return saved;
    } catch (error) { return sendMutationError(reply, error); }
  });
};

function sendMutationError(reply: { status: (code: number) => { send: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof FlowNotFoundError) return reply.status(404).send({ code: "FLOW_NOT_FOUND" });
  if (error instanceof FlowMapNotFoundError) return reply.status(404).send({ code: "MAP_NOT_FOUND" });
  if (error instanceof FlowMapAlreadyExistsError) return reply.status(409).send({ code: "MAP_ALREADY_EXISTS" });
  if (error instanceof FlowRevisionConflictError) return reply.status(412).send({ code: "FLOW_REVISION_CONFLICT" });
  if (error instanceof FlowMapRevisionConflictError) return reply.status(412).send({ code: "MAP_REVISION_CONFLICT", mapIds: error.mapIds });
  if (error instanceof MapFlowInvalidError) return reply.status(422).send({ code: "MAP_FLOW_INVALID", issues: error.issues });
  return reply.status(503).send({ code: "MAP_FLOW_SAVE_FAILED" });
}
