import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/referralAdmin";
import { buildReport } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Сводка по партнёрам (admin, единственный «дашборд», смотреть curl-ом).
 * Все суммы в центах USD. unpaidCents = accrued (к выплате).
 */
export async function GET(req: NextRequest) {
  const denied = adminGate(req);
  if (denied) return denied;
  const report = await buildReport();
  return NextResponse.json({ ok: true, partners: report });
}
