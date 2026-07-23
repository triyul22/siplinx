import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubToken, unsubscribe } from "@/lib/emailPrefs";

export const dynamic = "force-dynamic";

/**
 * Отписка из письма. Ссылка подписана HMAC (verifyUnsubToken), логин не нужен.
 * GET — клик по ссылке (показываем страницу подтверждения).
 * POST — One-Click отписка почтовых клиентов (заголовок List-Unsubscribe-Post).
 */

async function handle(req: NextRequest): Promise<{ ok: boolean }> {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyUnsubToken(token);
  if (!userId) return { ok: false };
  await unsubscribe(userId);
  return { ok: true };
}

function page(ok: boolean): string {
  const title = ok ? "Вы отписаны" : "Ссылка недействительна";
  const body = ok
    ? "Больше писем от Siplinx на этот адрес не придёт. Если передумаете, включить рассылку можно в настройках приложения.<br/><br/>You are unsubscribed. No more emails will be sent to this address."
    : "Не удалось подтвердить ссылку отписки. Попробуйте перейти по ссылке из последнего письма ещё раз.<br/><br/>We could not verify this unsubscribe link.";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#F4F6FA;">
<div style="max-width:480px;margin:16vh auto;background:#fff;border-radius:14px;padding:32px;text-align:center;">
<div style="font-size:20px;font-weight:800;color:#0E1116;margin-bottom:16px;">Siplinx AI</div>
<h2 style="font-size:19px;color:#0E1116;margin:0 0 12px;">${title}</h2>
<p style="font-size:14px;line-height:1.6;color:#5A6472;margin:0;">${body}</p>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const { ok } = await handle(req);
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: NextRequest) {
  const { ok } = await handle(req);
  return NextResponse.json({ ok });
}
