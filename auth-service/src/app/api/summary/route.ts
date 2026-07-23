import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_SUMMARY_MODEL = "gpt-5.4-mini";

const MEETING_PROMPT = (transcript: string, language?: string) => `${language ? `Пиши на языке: ${language}\n\n` : ""}Ты — ассистент встреч. Ниже транскрипт встречи, записанный автоматически (в нём есть ошибки распознавания речи — восстанавливай смысл по контексту, но НЕ выдумывай факты, которых нет).

Составь саммари СТРОГО на языке транскрипта (русский транскрипт → русское саммари) в формате Markdown по структуре:

# <Короткий заголовок встречи>

## Краткое содержание
2-4 предложения: о чём встреча и главный итог.

## Ключевые решения
- маркированный список; если решений нет — напиши «Не зафиксированы»

## Задачи
- формат: «исполнитель: задача (срок)»; если исполнитель/срок не названы — не выдумывай их

## Основные темы обсуждения
- 3-7 пунктов

Правила: не выдумывай имена, даты, числа и названия; если название компании/площадки звучит как ошибка распознавания — пропусти его; сохраняй конкретику (цифры, суммы, сроки), которая есть в транскрипте.

ТРАНСКРИПТ:
${transcript}`;

const LECTURE_PROMPT = (transcript: string, language?: string) => `${language ? `Пиши на языке: ${language}\n\n` : ""}Ты — ассистент встреч. Ниже транскрипт лекции/обучающей встречи, записанный автоматически (в нём есть ошибки распознавания речи — восстанавливай смысл по контексту, но НЕ выдумывай факты, которых нет).

Составь конспект СТРОГО на языке транскрипта в формате Markdown:

# <Тема>

## Краткое содержание
2-4 предложения: о чём лекция и главный вывод.

## Ключевые тезисы
- главные мысли и утверждения лектора

## Важные понятия
- формат: «понятие: определение»

## Выводы
- итоговые выводы и рекомендации

## Вопросы
- вопросы, которые задавались (если задавались)

Правила: не выдумывай имена, даты, числа; сохраняй конкретику, которая есть в транскрипте.

ТРАНСКРИПТ:
${transcript}`;

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
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

export async function POST(req: NextRequest) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. PRO entitlement check
  const entitlement = await getEntitlement(session.user.id);
  if (entitlement.plan !== "pro") {
    return NextResponse.json({ error: "pro_required" }, { status: 402 });
  }

  // 3. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const {
    transcript,
    summary_kind = "meeting",
    language,
  } = body as {
    transcript?: string;
    summary_kind?: string;
    language?: string;
    template_id?: string; // reserved for future use
  };

  // 4. Validate transcript
  if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json({ error: "transcript_required" }, { status: 400 });
  }
  if (transcript.length > 400_000) {
    return NextResponse.json({ error: "transcript_too_long" }, { status: 413 });
  }

  // 5. Check OpenAI key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[summary] OPENAI_API_KEY is not configured");
    return NextResponse.json({ error: "summary_unavailable" }, { status: 503 });
  }

  // 6. Build prompt based on summary kind
  const kind = typeof summary_kind === "string" ? summary_kind.toLowerCase() : "meeting";
  const lang = typeof language === "string" && language.trim() ? language.trim() : undefined;
  const prompt = kind === "lecture" ? LECTURE_PROMPT(transcript, lang) : MEETING_PROMPT(transcript, lang);

  // 7. Call OpenAI with 60s timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  const model = process.env.OPENAI_SUMMARY_MODEL || DEFAULT_OPENAI_SUMMARY_MODEL;

  try {
    const openaiRes = await fetch(OPENAI_RESPONSES_ENDPOINT, {
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

    if (!openaiRes.ok) {
      const detail = await openaiRes.text().catch(() => "");
      console.error("[summary] OpenAI API error:", openaiRes.status, detail);
      return NextResponse.json({ error: "summary_failed" }, { status: 502 });
    }

    const data = (await openaiRes.json()) as OpenAIResponsePayload;
    const summaryMarkdown = extractOpenAIText(data);
    if (!summaryMarkdown) {
      console.error("[summary] OpenAI response did not contain output text");
      return NextResponse.json({ error: "summary_failed" }, { status: 502 });
    }
    const usage = data.usage ?? {};

    return NextResponse.json({
      summary_markdown: summaryMarkdown,
      model,
      tokens_in: usage.input_tokens ?? 0,
      tokens_out: usage.output_tokens ?? 0,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      console.error("[summary] OpenAI request timed out after 60s");
    } else {
      console.error("[summary] OpenAI fetch error:", err);
    }
    return NextResponse.json({ error: "summary_failed" }, { status: 502 });
  }
}
