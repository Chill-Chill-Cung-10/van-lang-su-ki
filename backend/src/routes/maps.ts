import { SaveMapRequestSchema, validateMapDocument, type MapDocument } from "@van-lang/map-contract";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getServerEnv } from "../server/env.js";
import {
  databaseMapsRepository,
  MapDocumentInvalidError,
  MapNotFoundError,
  MapRevisionConflictError,
  type MapsRepository,
} from "../server/maps/map-repository.js";

const paramsSchema = z.object({ mapId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64) });
type Options = { repository?: MapsRepository; writeEnabled?: boolean; frontendUrl?: string };

export const mapsRoutes: FastifyPluginAsync<Options> = async (app, options) => {
  const repository = options.repository ?? databaseMapsRepository;

  app.get("/api/maps", async (_request, reply) => {
    try {
      return { maps: await repository.list() };
    } catch (error) {
      app.log.error(error, "Map list failed");
      return reply.status(503).send({ code: "MAP_DATABASE_UNAVAILABLE", message: "Không thể tải danh sách map." });
    }
  });

  app.get("/api/maps/:mapId", async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_MAP_ID", issues: params.error.issues });
    try {
      const found = await repository.load(params.data.mapId);
      if (!found) return reply.status(404).send({ code: "MAP_NOT_FOUND" });
      if (request.headers["if-none-match"] === found.etag) return reply.status(304).send();
      reply.header("ETag", found.etag);
      return found;
    } catch (error) {
      if (error instanceof MapDocumentInvalidError) return reply.status(500).send({ code: "MAP_DOCUMENT_INVALID" });
      app.log.error(error, "Map load failed");
      return reply.status(503).send({ code: "MAP_DATABASE_UNAVAILABLE" });
    }
  });

  app.put("/api/admin/maps/:mapId", async (request, reply) => {
    const env = options.writeEnabled === undefined || options.frontendUrl === undefined ? getServerEnv() : null;
    const writeEnabled = options.writeEnabled ?? env!.MAP_EDITOR_WRITE_ENABLED;
    const frontendUrl = options.frontendUrl ?? env!.FRONTEND_URL;
    if (!writeEnabled) return reply.status(503).send({ code: "MAP_EDITOR_WRITE_DISABLED" });
    if (request.headers.origin !== frontendUrl) return reply.status(403).send({ code: "MAP_EDITOR_ORIGIN_REJECTED" });
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ code: "INVALID_MAP_ID", issues: params.error.issues });
    const structural = SaveMapRequestSchema.safeParse(request.body);
    if (!structural.success) return reply.status(400).send({ code: "MAP_DOCUMENT_INVALID", issues: structural.error.issues });
    if (structural.data.document.mapId !== params.data.mapId) return reply.status(400).send({ code: "MAP_ID_MISMATCH" });
    const semantic = validateMapDocument(structural.data.document);
    if (!semantic.success) return reply.status(400).send({ code: "MAP_DOCUMENT_INVALID", issues: semantic.issues });
    const expectedEtag = request.headers["if-match"];
    if (typeof expectedEtag !== "string") return reply.status(400).send({ code: "IF_MATCH_REQUIRED" });
    try {
      const saved = await repository.save(params.data.mapId, expectedEtag, semantic.document as MapDocument);
      reply.header("ETag", saved.etag);
      return saved;
    } catch (error) {
      if (error instanceof MapNotFoundError) return reply.status(404).send({ code: "MAP_NOT_FOUND" });
      if (error instanceof MapRevisionConflictError) return reply.status(412).send({ code: "MAP_REVISION_CONFLICT" });
      app.log.error(error, "Map save failed");
      return reply.status(503).send({ code: "MAP_SAVE_FAILED" });
    }
  });
};
