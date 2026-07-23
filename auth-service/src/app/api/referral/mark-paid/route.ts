import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/referralAdmin";
import { normalizeCode, markPaid } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Пометить все accrued-начисления партнёра выплаченными (admin).
 * Сама выплата (PayPal) производится вручную ДО вызова.
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
  if (!code) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const res = await markPaid(code);
  console.log(`[referral] mark-paid code=${code} rows=${res.rows} cents=${res.cents}`);
  return NextResponse.json({ ok: true, code, rowsMarked: res.rows, cents: res.cents });
}
