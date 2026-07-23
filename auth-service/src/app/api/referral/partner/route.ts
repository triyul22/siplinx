import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/referralAdmin";
import { normalizeCode, upsertPartner, getPartner, makeStatsToken } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Создать/обновить партнёра (admin). body: { code, name, contact?, commissionPct? }.
 * В ответе refUrl + statsUrl — обе ссылки админ отправляет блогеру в чат Afluencer.
 */
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
  const name = String(body?.name ?? "").trim();
  if (!code) {
    return NextResponse.json({ error: "invalid_code", hint: "^[a-z0-9-]{3,32}$" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }
  const commissionPct =
    body?.commissionPct !== undefined && body?.commissionPct !== null
      ? Number(body.commissionPct)
      : undefined;
  if (commissionPct !== undefined && !(commissionPct > 0 && commissionPct <= 100)) {
    return NextResponse.json({ error: "invalid_commission_pct" }, { status: 400 });
  }

  await upsertPartner({
    code,
    name,
    contact: body?.contact ? String(body.contact) : undefined,
    commissionPct,
  });

  const partner = await getPartner(code);
  const origin = process.env.BETTER_AUTH_URL || new URL(req.url).origin;
  return NextResponse.json({
    ok: true,
    partner,
    refUrl: `${origin}/r/${code}`,
    statsUrl: `${origin}/partner/${code}?token=${makeStatsToken(code)}`,
  });
}
