import { NextRequest, NextResponse } from "next/server";
import { normalizeCode, verifyStatsToken, buildReport } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Read-only страница статистики партнёра, без логина (ссылку с HMAC-токеном
 * выдаёт админ вместе с реф-ссылкой). Инфлюенсеры с Afluencer ожидают видеть
 * свои клики/конверсии — это наш минимальный «кабинет». Только агрегаты,
 * никаких PII приглашённых юзеров. Язык EN (аудитория Afluencer англоязычная).
 */

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = normalizeCode(params.code ?? "");
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!code || !token || !verifyStatsToken(code, token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [report] = await buildReport(code);
  if (!report) return new NextResponse("Not found", { status: 404 });

  const origin = process.env.BETTER_AUTH_URL || new URL(req.url).origin;
  const refUrl = `${origin}/r/${code}`;

  const rows: Array<[string, string]> = [
    ["Link clicks", String(report.clicks)],
    ["Signups from your link", String(report.attributedUsers)],
    ["Paid charges", String(report.paidOrders)],
    ["Your commission rate", `${report.commissionPct}%`],
    ["Earned (pending payout)", money(report.unpaidCents)],
    ["Paid out to you", money(report.paidOutCents)],
  ];

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Siplinx partner stats: ${esc(report.name)}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#F4F6FA;color:#0E1116;">
<div style="max-width:560px;margin:8vh auto;background:#fff;border-radius:14px;padding:32px;">
<div style="font-size:20px;font-weight:800;margin-bottom:4px;">Siplinx <span style="background:linear-gradient(135deg,#2F6BFF 0%,#7A3BE0 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#7A3BE0;">AI</span></div>
<h1 style="font-size:18px;margin:0 0 20px;">Partner stats: ${esc(report.name)}</h1>
<p style="font-size:13px;color:#5A6472;margin:0 0 6px;">Your referral link (90-day cookie):</p>
<p style="font-size:15px;font-weight:600;word-break:break-all;background:#F4F6FA;border-radius:8px;padding:10px 12px;margin:0 0 24px;">${refUrl}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:9px 0;color:#5A6472;border-bottom:1px solid #EEF1F6;">${k}</td><td style="padding:9px 0;text-align:right;font-weight:600;border-bottom:1px solid #EEF1F6;">${v}</td></tr>`
  )
  .join("")}
</table>
<p style="font-size:12px;color:#94A0B0;line-height:1.6;margin:20px 0 0;">
You earn ${report.commissionPct}% of every weekly charge, recurring, for as long as the subscriber stays.
Payouts: monthly (1st-5th), PayPal, $25 minimum (smaller balances roll over).
Questions: reply in our Afluencer chat.
</p>
</div></body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
