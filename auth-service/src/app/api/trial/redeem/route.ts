import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startTrial } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// Один промокод на бесплатный триал без карты. Меняется через env без правок кода.
const TRIAL_CODE = (process.env.TRIAL_CODE ?? "Trial7").trim();
const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? "7") || 7;

/**
 * Активация бесплатного триала по промокоду (без карты, без Polar).
 * Десктоп шлёт Authorization: Bearer <token> + { code }.
 * По решению заказчицы повторных проверок нет — код многоразовый.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let code = "";
  try {
    const body = await req.json();
    code = String(body?.code ?? "").trim();
  } catch {
    code = (new URL(req.url).searchParams.get("code") ?? "").trim();
  }

  if (code.toLowerCase() !== TRIAL_CODE.toLowerCase()) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const res = await startTrial(session.user.id, TRIAL_DAYS);
  if (!res.ok) {
    return NextResponse.json({ error: res.reason }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    plan: "pro",
    trialDays: TRIAL_DAYS,
    currentPeriodEnd: res.currentPeriodEnd,
  });
}
