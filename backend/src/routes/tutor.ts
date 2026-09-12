import type { FastifyPluginAsync } from "fastify";
import OpenAI from "openai";
import { z } from "zod";
import { getServerEnv } from "../server/env.js";

const requestSchema = z.object({
  question: z.string().min(3).max(1200),
  context: z.string().max(4000).optional(),
});

export const tutorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/ai/tutor", async (request, reply) => {
    const input = requestSchema.safeParse(request.body);

    if (!input.success) {
      return reply.status(400).send({
        message: "Câu hỏi không hợp lệ.",
        issues: input.error.issues,
      });
    }

    const env = getServerEnv();

    if (!env.OPENAI_API_KEY) {
      return reply.status(503).send({
        message: "Gia sư AI chưa được cấu hình. Các chức năng học tập cốt lõi vẫn hoạt động.",
      });
    }

    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        instructions:
          "Bạn là gia sư lịch sử Việt Nam. Chỉ trả lời từ ngữ cảnh đã cung cấp, nêu rõ khi thiếu dữ kiện, không tạo nguồn hoặc sự kiện không có trong ngữ cảnh. Trả lời ngắn gọn, phù hợp học sinh.",
        input: `Ngữ cảnh đã kiểm duyệt:\n${input.data.context ?? "Chưa có ngữ cảnh."}\n\nCâu hỏi:\n${input.data.question}`,
      });

      return { answer: response.output_text, model: env.OPENAI_MODEL };
    } catch (error) {
      app.log.error(error, "Tutor request failed");
      return reply.status(502).send({
        message: "Gia sư AI đang tạm gián đoạn. Vui lòng thử lại sau.",
      });
    }
  });
};
