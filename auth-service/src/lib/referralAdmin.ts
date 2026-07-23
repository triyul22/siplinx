import { NextRequest, NextResponse } from "next/server";

/**
 * Общая авторизация админ-эндпоинтов рефералки:
 * Authorization: Bearer <REFERRAL_ADMIN_SECRET>. Секрет не задан → 503
 * (эндпоинты выключены). Секрет НЕ логировать.
 */
export function adminGate(req: NextRequest): NextResponse | null {
  const secret = process.env.REFERRAL_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "referral admin disabled" }, { status: 503 });
  }
  const hdr = req.headers.get("authorization") ?? "";
  if (hdr !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
