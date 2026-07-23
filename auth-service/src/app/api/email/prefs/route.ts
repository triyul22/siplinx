import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEmailPrefs, setMarketingOptIn, recordLocale } from "@/lib/emailPrefs";

export const dynamic = "force-dynamic";

/**
 * Настройки рассылки для десктопа (карточка «Аккаунт» → переключатель
 * «Письма с советами и предложениями»). Bearer-токен обязателен.
 *  GET  → текущее состояние { marketingOptIn }.
 *  POST { marketingOptIn: boolean, locale?: string } → записать.
 */

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const prefs = await getEmailPrefs(session.user.id);
  return NextResponse.json({
    marketingOptIn: prefs.marketingOptIn,
    unsubscribed: Boolean(prefs.unsubscribedAt),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let optIn: boolean | undefined;
  let locale: string | undefined;
  try {
    const body = await req.json();
    optIn = typeof body?.marketingOptIn === "boolean" ? body.marketingOptIn : undefined;
    locale = typeof body?.locale === "string" ? body.locale : undefined;
  } catch {
    /* пустое тело */
  }

  if (locale) await recordLocale(session.user.id, locale);
  if (typeof optIn === "boolean") await setMarketingOptIn(session.user.id, optIn);

  const prefs = await getEmailPrefs(session.user.id);
  return NextResponse.json({ ok: true, marketingOptIn: prefs.marketingOptIn });
}
