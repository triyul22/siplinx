import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { consumeChatRequest } from "@/lib/chatUsage";

export const dynamic = "force-dynamic";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.4-mini";

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function extractOpenAIText(data: OpenAIResponsePayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

function parseJsonResult(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entitlement = await getEntitlement(session.user.id);
  if (entitlement.plan !== "pro") {
    return NextResponse.json({ error: "pro_required" }, { status: 402 });
  }

  const body = await req.json().catch(() => null) as {
    meeting_context?: string;
    question?: string;
  } | null;
  let context = body?.meeting_context?.trim();
  const question = body?.question?.trim();
  if (!context || !question) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (question.length > 2_000) {
    return NextResponse.json({ error: "context_too_long" }, { status: 413 });
  }
  // Trim overly long meetings instead of rejecting them (~30k tokens budget).
  // The note lives at the head of the context and the tail holds the most recent
  // transcript, so keep both ends and drop the middle.
  const MAX_CONTEXT_CHARS = 90_000;
  if (context.length > MAX_CONTEXT_CHARS) {
    const half = Math.floor(MAX_CONTEXT_CHARS / 2);
    context = `${context.slice(0, half)}\n\n[...часть транскрипта пропущена...]\n\n${context.slice(context.length - half)}`;
  }

  const remaining = await consumeChatRequest(session.user.id);
  if (remaining === null) {
    return NextResponse.json({ error: "daily_limit", remaining: 0 }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[chat] OPENAI_API_KEY is not configured");
    return NextResponse.json({ error: "chat_unavailable" }, { status: 503 });
  }

  const prompt = `Ты — ассистент по одной встрече. Отвечай только по переданному контексту.
Определи, это вопрос или команда отредактировать заметку.
Верни только JSON без markdown:
- вопрос: {"action":"answer","answer":"...","quotes":[{"time":"MM:SS","text":"точная короткая цитата"}]}
- правка: {"action":"edit","newSummary":"полная новая заметка Markdown","note":"что изменено","quotes":[]}
Не выдумывай цитаты: используй только дословный текст и существующий таймкод из контекста.

КОНТЕКСТ ВСТРЕЧИ:
${context}

ЗАПРОС:
${question}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  const model =
    process.env.OPENAI_CHAT_MODEL ||
    process.env.OPENAI_SUMMARY_MODEL ||
    DEFAULT_OPENAI_CHAT_MODEL;

  try {
    const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 4096,
        reasoning: { effort: "none" },
        store: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[chat] OpenAI API error:", response.status, detail);
      return NextResponse.json({ error: "chat_failed", remaining }, { status: 502 });
    }

    const data = (await response.json()) as OpenAIResponsePayload;
    const raw = extractOpenAIText(data);
    if (!raw) {
      console.error("[chat] OpenAI response did not contain output text");
      return NextResponse.json({ error: "chat_failed", remaining }, { status: 502 });
    }

    const result = parseJsonResult(raw);
    return NextResponse.json({ ...result, remaining });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[chat] generation failed", error);
    return NextResponse.json({ error: "chat_failed", remaining }, { status: 502 });
  }
}
