import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/referralAdmin";
import { normalizeCode, deactivatePartner } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/** Деактивация партнёра (admin): ссылка перестаёт ставить cookie, начисления не трогаются. */
export async function POST(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const code = normalizeCode(String(body?.code ?? ""));
  if (!code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const found = await deactivatePartner(code);
  if (!found) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, code, active: false });
}
