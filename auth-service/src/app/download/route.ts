import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { capture, utmFromUrl } from "@/lib/track";

// Одна кнопка «Скачать» на лендинге ведёт сюда. Эндпоинт определяет ОС по
// User-Agent и 302-редиректит на свежий установщик из последнего GitHub-релиза,
// поэтому ссылка на сайте не зависит от номера версии.
//
// Здесь же ловим событие «начал скачивание» в PostHog: единая точка, через
// которую проходят все загрузки (см. lib/track.ts).

const REPO = "triyul22/siplinx";
const RELEASES = `https://github.com/${REPO}/releases`;
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const DOWNLOAD_ANON_COOKIE = "siplinx_download_anon";
const DOWNLOAD_ANON_MAX_AGE = 60 * 60 * 24 * 365;

type Platform = "mac" | "win";
type Asset = { name: string; browser_download_url: string };
type SessionUser = { id: string; email?: string | null; name?: string | null };

function isSafeAnonId(value: string | undefined): value is string {
  return !!value && /^[a-zA-Z0-9_-]{8,128}$/.test(value);
}

async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    return session?.user ? (session.user as SessionUser) : null;
  } catch {
    return null;
  }
}

function applyAnonCookie(req: NextRequest, res: NextResponse, anonId: string, existed: boolean) {
  if (existed) return;

  res.cookies.set(DOWNLOAD_ANON_COOKIE, anonId, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: DOWNLOAD_ANON_MAX_AGE,
  });
}

function detectPlatform(req: NextRequest): Platform | null {
  const forced = req.nextUrl.searchParams.get("platform");
  if (forced === "mac" || forced === "win") return forced;

  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  // Мобильные сначала: в iOS User-Agent есть "mac os x", иначе iPhone получил бы .dmg.
  if (/iphone|ipad|ipod|android|mobile/.test(ua)) return null;
  if (ua.includes("win")) return "win";
  if (ua.includes("mac")) return "mac";
  return null;
}

type Variant = "trial" | "direct";

function pickAsset(assets: Asset[], platform: Platform, variant: Variant): Asset | undefined {
  // Два билда в одном релизе: direct-артефакты несут суффикс "-direct" в имени
  // продукта (Siplinx.AI-direct_...), trial — как раньше, без суффикса.
  const pool = assets.filter((a) =>
    variant === "direct"
      ? a.name.toLowerCase().includes("-direct")
      : !a.name.toLowerCase().includes("-direct")
  );
  const by = (suffix: string) => pool.find((a) => a.name.toLowerCase().endsWith(suffix));
  if (platform === "mac") return by(".dmg");
  // Windows: предпочитаем NSIS-установщик (-setup.exe), затем любой .exe, затем .msi.
  return by("-setup.exe") ?? by(".exe") ?? by(".msi");
}

export async function GET(req: NextRequest) {
  const platform = detectPlatform(req);
  // Лендинг №2 ссылается с ?variant=direct (билд «сразу оплата, без триала»).
  const variant: Variant =
    req.nextUrl.searchParams.get("variant") === "direct" ? "direct" : "trial";
  const user = await getSessionUser(req);
  const existingAnonId = req.cookies.get(DOWNLOAD_ANON_COOKIE)?.value;
  const anonId = isSafeAnonId(existingAnonId) ? existingAnonId : crypto.randomUUID();
  const hadAnonCookie = isSafeAnonId(existingAnonId);
  const downloadId = crypto.randomUUID();
  const distinctId = user?.id ? user.id : `anon_${anonId}`;

  // Событие «начал скачивание». Если браузер уже залогинен через /web/start,
  // пишем событие под better-auth user.id/email. Иначе используем стабильный
  // first-party cookie-id: один человек больше не превращается в новый anon
  // person на каждый повторный hit /download.
  const trackDownload = (resolved: string) =>
    capture("app_download_started", distinctId, {
      platform: platform ?? "unknown",
      variant,
      resolved, // asset | releases_fallback | unknown_platform
      download_id: downloadId,
      download_anon_id: anonId,
      is_authenticated: Boolean(user),
      referer: req.headers.get("referer") || undefined,
      auth_user_id: user?.id,
      email: user?.email ?? undefined,
      $set: user
        ? {
            auth_user_id: user.id,
            email: user.email ?? undefined,
            name: user.name ?? undefined,
          }
        : undefined,
      ...utmFromUrl(req.nextUrl),
    });

  const redirect = (url: string) => {
    const res = NextResponse.redirect(url, 302);
    applyAnonCookie(req, res, anonId, hadAnonCookie);
    return res;
  };

  // Неизвестная ОС (Linux/мобильный) → страница релизов, пусть выберут вручную.
  if (!platform) {
    await trackDownload("unknown_platform");
    return redirect(`${RELEASES}/latest`);
  }

  try {
    const res = await fetch(LATEST_API, {
      headers: { Accept: "application/vnd.github+json" },
      // Кэш 60с: новая версия по кнопке появляется почти сразу после релиза.
      // Это ~60 запросов/час к GitHub (на грани анонимного лимита) — при
      // ошибке API есть фолбэк ниже, так что кнопка не ломается.
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);

    const release = (await res.json()) as { assets?: Asset[] };
    const asset = pickAsset(release.assets ?? [], platform, variant);
    if (asset) {
      await trackDownload("asset");
      return redirect(asset.browser_download_url);
    }
  } catch {
    // упадём на страницу релизов ниже
  }

  await trackDownload("releases_fallback");
  return redirect(`${RELEASES}/latest`);
}
