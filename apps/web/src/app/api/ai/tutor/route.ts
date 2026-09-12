import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/server/env";

const requestSchema = z.object({
  question: z.string().min(3).max(1200),
  context: z.string().max(4000).optional(),
});

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ message: "Câu hỏi không hợp lệ.", issues: input.error.issues }, { status: 400 });
  }

  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return NextResponse.json(
      { message: "Gia sư AI chưa được cấu hình. Các chức năng học tập cốt lõi vẫn hoạt động." },
      { status: 503 },
    );
  }

  try {
    const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: env.OPENAI_MODEL,
      instructions:
        "Bạn là gia sư lịch sử Việt Nam. Chỉ trả lời từ ngữ cảnh đã cung cấp, nêu rõ khi thiếu dữ kiện, không tạo nguồn hoặc sự kiện không có trong ngữ cảnh. Trả lời ngắn gọn, phù hợp học sinh.",
      input: `Ngữ cảnh đã kiểm duyệt:\n${input.data.context ?? "Chưa có ngữ cảnh."}\n\nCâu hỏi:\n${input.data.question}`,
    });

    return NextResponse.json({ answer: response.output_text, model: env.OPENAI_MODEL });
  } catch (error) {
    console.error("Tutor request failed", error);
    return NextResponse.json(
      { message: "Gia sư AI đang tạm gián đoạn. Vui lòng thử lại sau." },
      { status: 502 },
    );
  }
}
