import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordUserSource, startAutoTrial } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const TRIAL_AUTO_DAYS = Number(process.env.TRIAL_AUTO_DAYS ?? "7") || 7;

/**
 * Авто-триал для trial-билда (без карты, без промокода). Десктоп зовёт после
 * логина, если plan=free. Bearer-токен обязателен. Идемпотентно: повторный
 * вызов (и переустановка приложения) триал не возобновляет — одноразовость
 * гарантирует колонка auto_trial_granted_at.
 *
 * Не-выдача — это НЕ ошибка протокола, поэтому 200 { ok:false, code } —
 * клиент по code решает, показывать ли что-то юзеру (обычно нет).
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Клиент передаёт свой режим сборки; фиксируем источник (пишется один раз).
  const mode = req.headers.get("x-billing-mode");
  if (mode === "trial" || mode === "direct") {
    await recordUserSource(session.user.id, mode);
  }

  const res = await startAutoTrial(session.user.id, TRIAL_AUTO_DAYS);
  if (!res.ok) {
    return NextResponse.json({ ok: false, code: res.code });
  }

  return NextResponse.json({
    ok: true,
    plan: "pro",
    trialDays: TRIAL_AUTO_DAYS,
    currentPeriodEnd: res.currentPeriodEnd,
  });
}
