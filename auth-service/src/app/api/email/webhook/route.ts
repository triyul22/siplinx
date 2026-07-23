import { NextRequest, NextResponse } from "next/server";
import { updateStatusByResendId, unsubscribe } from "@/lib/emailPrefs";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Вебхук Resend: email.sent/opened/clicked/bounced/complained.
 * Обновляем status в email_log по resend_id. Bounce/complaint → отписываем
 * юзера (больше ничего не слать на этот адрес).
 *
 * Проверка подписи: Resend использует Svix. Чтобы не тянуть зависимость в v1,
 * защищаемся общим секретом в query (?secret=<RESEND_WEBHOOK_SECRET>). Если
 * секрет задан, он обязателен. TODO: перейти на проверку svix-подписи.
 */

type ResendEvent = {
  type?: string;
  data?: { email_id?: string; to?: string | string[] };
};

function eventToStatus(type: string): string | null {
  switch (type) {
    case "email.sent":
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const provided = new URL(req.url).searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  let evt: ResendEvent;
  try {
    evt = (await req.json()) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const type = evt.type ?? "";
  const status = eventToStatus(type);
  const resendId = evt.data?.email_id;

  if (status && resendId) {
    await updateStatusByResendId(resendId, status);
  }

  // Bounce / жалоба на спам → отписать по email, чтобы не долбить дальше.
  if (type === "email.bounced" || type === "email.complained") {
    const to = Array.isArray(evt.data?.to) ? evt.data?.to[0] : evt.data?.to;
    if (to) {
      const { rows } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [to]);
      if (rows.length) await unsubscribe(rows[0].id);
    }
  }

  return NextResponse.json({ ok: true });
}
