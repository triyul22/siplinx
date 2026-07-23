import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlement, recordUserSource } from "@/lib/entitlements";
import { getChatRemaining } from "@/lib/chatUsage";
import { recordLocale } from "@/lib/emailPrefs";

export const dynamic = "force-dynamic";

/**
 * Главный endpoint для десктопа. Принимает Authorization: Bearer <token>.
 * Возвращает профиль + текущий план (free | pro).
 * Десктоп зовёт его при старте и периодически (см. offline-грейс на клиенте).
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ent = await getEntitlement(session.user.id);
  const chatRemaining = await getChatRemaining(session.user.id);

  // Фиксация источника юзера ('trial' | 'direct') из заголовка билда — пишем
  // только пока не зафиксирован, чтобы не делать запись на каждый /api/me.
  const mode = req.headers.get("x-billing-mode");
  if (!ent.userSource && (mode === "trial" || mode === "direct")) {
    await recordUserSource(session.user.id, mode);
  }

  // Locale для выбора языка писем (обновляем при каждом заходе — язык может
  // меняться). Согласие на рекламу (marketing_opt_in) клиент шлёт отдельным
  // явным вызовом POST /api/email/prefs (галочка на логине + тумблер в настройках).
  const locale = req.headers.get("x-locale");
  if (locale) await recordLocale(session.user.id, locale);

  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image ?? null,
    },
    plan: ent.plan,
    status: ent.status,
    currentPeriodEnd: ent.currentPeriodEnd,
    managedByPolar: ent.managedByPolar,
    serverTime: new Date().toISOString(),
    chatRemaining,
  });
}
