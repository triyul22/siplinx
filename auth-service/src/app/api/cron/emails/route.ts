import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureEmailSchema } from "@/lib/emailPrefs";
import { ensureSchema } from "@/lib/entitlements";
import { sendTemplate } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Планировщик email-секвенции. Запускается раз в час (Vercel Cron, см.
 * vercel.json). Защита: заголовок Authorization: Bearer <CRON_SECRET>
 * (Vercel сам подставляет его к cron-вызовам, если задан env CRON_SECRET).
 *
 * Логика детерминирована по датам: T0 = auto_trial_granted_at. Для каждого
 * юзера считаем, какие шаблоны «созрели», и зовём sendTemplate — он сам
 * гарантирует идемпотентность (email_log), проверяет отписку и marketing_opt_in.
 * Cron решает ТОЛЬКО тайминг, всё остальное — в sendTemplate.
 */

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // локально/без секрета — не блокируем
  const hdr = req.headers.get("authorization") ?? "";
  return hdr === `Bearer ${secret}`;
}

type Row = {
  user_id: string;
  plan: string;
  status: string | null;
  customer_id: string | null;
  current_period_end: Date | null;
  auto_trial_granted_at: Date | null;
};

/** Повторяет вычисление plan/status из getEntitlement (истёкший наш триал → free). */
function effective(r: Row): { plan: "free" | "pro"; status: string; isPaid: boolean } {
  const periodEnd = r.current_period_end ? new Date(r.current_period_end).getTime() : null;
  const trialExpired =
    r.status === "trialing" && !r.customer_id && periodEnd !== null && periodEnd < Date.now();
  const plan: "free" | "pro" = !trialExpired && r.plan === "pro" ? "pro" : "free";
  const status = trialExpired ? "expired" : r.status ?? "none";
  const isPaid = plan === "pro" && status === "active";
  return { plan, status, isPaid };
}

/** Список созревших шаблонов для юзера (без учёта уже отправленных — это в sendTemplate). */
function dueTemplates(r: Row): string[] {
  const { plan, isPaid } = effective(r);
  const due: string[] = [];

  // paid_welcome — при активной платной подписке, независимо от триала.
  if (isPaid) {
    due.push("paid_welcome");
    return due; // оплатившему шлём только paid_welcome, секвенцию 1-7 гасим.
  }

  const t0 = r.auto_trial_granted_at ? new Date(r.auto_trial_granted_at).getTime() : null;
  if (t0 === null) return due; // без авто-триала (direct) секвенции нет.
  const age = Date.now() - t0;

  if (age >= 15 * MIN) due.push("trial_welcome");
  if (age >= 2 * DAY) due.push("trial_value");
  if (age >= 5 * DAY) due.push("trial_ending_2d");
  if (age >= 6.5 * DAY) due.push("trial_last_day");
  // win-back — только когда триал уже кончился (plan=free). Опт-ин проверит sendTemplate.
  if (plan === "free") {
    if (age >= 8 * DAY) due.push("winback_1");
    if (age >= 12 * DAY) due.push("winback_2");
    if (age >= 20 * DAY) due.push("winback_3");
  }
  return due;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await ensureSchema();
  await ensureEmailSchema();

  const { rows } = await pool.query<Row>(
    `SELECT e.user_id, e.plan, e.status, e.customer_id, e.current_period_end, e.auto_trial_granted_at
       FROM user_entitlement e
       JOIN "user" u ON u.id = e.user_id
       LEFT JOIN user_email_prefs p ON p.user_id = e.user_id
      WHERE (e.auto_trial_granted_at IS NOT NULL OR (e.plan = 'pro' AND e.status = 'active'))
        AND (p.unsubscribed_at IS NULL)`
  );

  let sent = 0;
  const skipped: Record<string, number> = {};
  for (const r of rows) {
    for (const tpl of dueTemplates(r)) {
      const res = await sendTemplate(r.user_id, tpl);
      if (res.ok) sent += 1;
      else skipped[res.reason] = (skipped[res.reason] ?? 0) + 1;
    }
  }

  return NextResponse.json({ ok: true, users: rows.length, sent, skipped });
}

// Vercel Cron дергает GET по расписанию; переиспользуем ту же логику.
export async function GET(req: NextRequest) {
  return POST(req);
}
