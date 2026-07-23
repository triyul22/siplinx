import { NextRequest, NextResponse } from "next/server";
import { normalizeCode, registerClick, REF_COOKIE, REF_COOKIE_MAX_AGE } from "@/lib/referrals";

export const dynamic = "force-dynamic";

/**
 * Реферальная ссылка партнёра: https://siplinx-ai.vercel.app/r/<code>
 * Валидный активный код: clicks+1, cookie siplinx_ref (90 дней), 302 на /download.
 * Неизвестный/неактивный: без cookie, но всё равно на /download (юзера не терять).
 * Повторный клик по другой ссылке перезаписывает cookie (last-click wins до
 * момента атрибуции; после записи в БД атрибуция уже write-once).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const download = new URL("/download", req.url);
  const res = NextResponse.redirect(download, 302);

  try {
    const code = normalizeCode(params.code ?? "");
    if (code && (await registerClick(code))) {
      res.cookies.set(REF_COOKIE, code, {
        maxAge: REF_COOKIE_MAX_AGE,
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
    }
  } catch (e) {
    // Реф-механика не должна ломать скачивание.
    console.warn("[referral] click handling failed:", e);
  }

  return res;
}
