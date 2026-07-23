import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { mintCode } from "@/lib/appAuthCode";
import { attributeUser, REF_COOKIE } from "@/lib/referrals";

export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function desktopReturnPage(location: string): string {
  const href = escapeHtml(location);
  const target = JSON.stringify(location);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Вход в Siplinx</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #FDE8A7;
        color: #2B1908;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 520px;
        padding: 32px;
        text-align: center;
      }
      h1 {
        font-size: 30px;
        line-height: 1.15;
        margin: 0 0 16px;
      }
      p {
        color: rgba(43, 25, 8, 0.72);
        font-size: 16px;
        line-height: 1.5;
        margin: 0 0 20px;
      }
      a {
        display: inline-block;
        border-radius: 12px;
        background: #2F6BFF;
        color: #fff;
        font-size: 15px;
        font-weight: 700;
        padding: 12px 18px;
        text-decoration: none;
      }
      small {
        display: block;
        color: rgba(43, 25, 8, 0.55);
        margin-top: 18px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Готово</h1>
      <p id="status">Возвращаем вас в приложение Siplinx AI…</p>
      <a href="${href}">Открыть Siplinx AI</a>
      <small>Если приложение уже открылось, эту вкладку можно закрыть.</small>
    </main>
    <script>
      const target = ${target};
      window.setTimeout(() => {
        window.location.href = target;
      }, 150);
      window.setTimeout(() => {
        const status = document.getElementById("status");
        if (status) status.textContent = "Если приложение не открылось автоматически, нажмите кнопку ниже.";
      }, 1800);
    </script>
  </body>
</html>`;
}

/**
 * Финальный шаг веб-входа для десктопа. Сюда better-auth редиректит после
 * Google (callbackURL из /app/start), либо /app/start шлёт напрямую, если
 * сессия с лендинга уже есть. К этому моменту есть cookie-сессия.
 *
 * Достаём bearer-токен сессии, мятим одноразовый код и возвращаем его в
 * приложение по deep-link: siplinx://auth?code=...&state=...
 * Токен НЕ кладём в deep-link — только код (обменивается на /api/app/exchange).
 */
export async function GET(req: NextRequest) {
  const state = new URL(req.url).searchParams.get("state") ?? "";

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    const back = new URL("/app/start", req.url);
    back.searchParams.set("state", state);
    return NextResponse.redirect(back);
  }

  const cookieStore = cookies();
  const token =
    cookieStore.get("better-auth.session_token")?.value ??
    cookieStore.get("__Secure-better-auth.session_token")?.value;

  if (!token) {
    return new NextResponse("No session token found", { status: 500 });
  }

  // Реферальная атрибуция: cookie siplinx_ref поставлена кликом по /r/<code>.
  // Write-once на сервере; любая ошибка не должна ломать логин.
  try {
    const ref = cookieStore.get(REF_COOKIE)?.value;
    if (ref) await attributeUser(session.user.id, ref);
  } catch (e) {
    console.warn("[referral] attribution failed (login continues):", e);
  }

  const code = await mintCode(token);
  console.log(`[auth] app web login complete: user=${session.user.id}`);

  const location = `siplinx://auth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  return new NextResponse(desktopReturnPage(location), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
