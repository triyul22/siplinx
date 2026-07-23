import { NextRequest, NextResponse } from "next/server";
import { redeemCode } from "@/lib/appAuthCode";

export const dynamic = "force-dynamic";

/**
 * Обмен одноразового кода (из deep-link siplinx://auth?code=...) на bearer-токен
 * сессии. Зовётся десктопом (fetch из Tauri webview). CORS для /api/* уже задан
 * в next.config.js. Код одноразовый и живёт 60с — см. lib/appAuthCode.ts.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }

  const token = await redeemCode(code);
  if (!token) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  return NextResponse.json({ token });
}

// Префлайт CORS (fetch с Content-Type: application/json — непростой запрос).
export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
