import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { attributeUser, REF_COOKIE } from "@/lib/referrals";

export const dynamic = "force-dynamic";

function isAllowedLoopbackPort(port: string): boolean {
  const p = Number(port);
  const min = Number(process.env.DESKTOP_LOOPBACK_PORT_MIN ?? 38400);
  const max = Number(process.env.DESKTOP_LOOPBACK_PORT_MAX ?? 38500);
  return Number.isInteger(p) && p >= min && p <= max;
}

/**
 * Финальный шаг логина для десктопа.
 * Сюда Better Auth редиректит после успешного входа через Google
 * (это callbackURL из /desktop/start). На этом этапе уже есть cookie-сессия.
 *
 * Берём токен сессии (== bearer-токен) и редиректим на loopback десктопа:
 *   http://127.0.0.1:<port>/callback?token=...&state=...
 * Десктоп ловит это своим временным сервером (tauri-plugin-oauth).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const port = searchParams.get("port") ?? "";
  const state = searchParams.get("state") ?? "";

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    const back = new URL("/desktop/start", req.url);
    back.searchParams.set("port", port);
    back.searchParams.set("state", state);
    return NextResponse.redirect(back);
  }

  if (!isAllowedLoopbackPort(port)) {
    return new NextResponse("Invalid loopback port", { status: 400 });
  }

  // Регресс-защита сохранения email: better-auth к этому моменту уже записал
  // юзера (с email) в таблицу "user". Логируем только id — email в логи нельзя.
  console.log(`[auth] desktop login complete: user=${session.user.id}`);

  // Реферальная атрибуция (write-once); ошибка не должна ломать логин.
  try {
    const ref = cookies().get(REF_COOKIE)?.value;
    if (ref) await attributeUser(session.user.id, ref);
  } catch (e) {
    console.warn("[referral] attribution failed (login continues):", e);
  }

  // bearer-токен Better Auth == значение cookie сессии.
  // (Плагин bearer принимает в Authorization тот же токен, что лежит в cookie.)
  const cookieStore = cookies();
  const token =
    cookieStore.get("better-auth.session_token")?.value ??
    cookieStore.get("__Secure-better-auth.session_token")?.value;

  if (!token) {
    return new NextResponse("No session token found", { status: 500 });
  }

  const redirect = new URL(`http://127.0.0.1:${port}/callback`);
  redirect.searchParams.set("token", token);
  redirect.searchParams.set("state", state);

  // 302 на loopback. Десктоп закроет вкладку/покажет "можно вернуться в приложение".
  return NextResponse.redirect(redirect.toString());
}
