// Клиент авторизации/подписки для десктопа.
//
// ВАЖНО про хранение токена: используется @tauri-apps/plugin-store (auth.json).
// Это НЕ шифрованное хранилище. Токен — серверная сессия (revocable, с TTL),
// но для усиления безопасности стоит мигрировать на OS keychain (crate `keyring`)
// или tauri-plugin-stronghold. См. TODO в README репозитория.

import { openUrl } from "@tauri-apps/plugin-opener";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";
import { Store } from "@tauri-apps/plugin-store";
import { AUTH_URL, getBillingMode } from "@/config/auth";

export type MeResponse = {
  user: { id: string; email: string; name?: string | null; image?: string | null };
  plan: "free" | "pro";
  status: string;
  currentPeriodEnd: string | null;
  /** true = подписка ведётся в Polar (есть customer) — можно открывать portal. */
  managedByPolar?: boolean;
  serverTime?: string;
  chatRemaining?: number;
};

const STORE_FILE = "auth.json";
const K_TOKEN = "auth.token";
const K_ME = "auth.me";
const K_VERIFIED_AT = "auth.lastVerifiedAt";

// Язык интерфейса (ru|en) — сервер использует его для выбора языка email-писем.
// Ставится из AuthContext при известной локали; уходит заголовком X-Locale.
let _locale: string | null = null;
export function setClientLocale(locale: string): void {
  _locale = locale;
}
function localeHeaders(): Record<string, string> {
  return _locale ? { "X-Locale": _locale } : {};
}

async function store() {
  // defaults обязателен в новых версиях @tauri-apps/plugin-store (StoreOptions);
  // указываем пустой объект — совместимо со старой и новой версией.
  return await Store.load(STORE_FILE, { autoSave: true, defaults: {} });
}

export async function getToken(): Promise<string | null> {
  const s = await store();
  return (await s.get<string>(K_TOKEN)) ?? null;
}

export async function setSession(
  token: string,
  me: MeResponse
): Promise<void> {
  const s = await store();
  await s.set(K_TOKEN, token);
  await s.set(K_ME, me);
  await s.set(K_VERIFIED_AT, Date.now());
  await s.save();
}

export async function getCachedMe(): Promise<{ me: MeResponse | null; verifiedAt: number | null }> {
  const s = await store();
  const me = (await s.get<MeResponse>(K_ME)) ?? null;
  const verifiedAt = (await s.get<number>(K_VERIFIED_AT)) ?? null;
  return { me, verifiedAt };
}

export async function clearSession(): Promise<void> {
  const s = await store();
  await s.delete(K_TOKEN);
  await s.delete(K_ME);
  await s.delete(K_VERIFIED_AT);
  await s.save();
}

export type FetchMeResult = MeResponse | "unauthorized" | "network-error";

export async function fetchMe(token: string): Promise<FetchMeResult> {
  try {
    const res = await fetch(`${AUTH_URL}/api/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Сервер один раз фиксирует источник юзера (user_source) — от этого
        // зависит право на авто-триал (direct-юзеры его не получают).
        "X-Billing-Mode": getBillingMode(),
        ...localeHeaders(),
      },
    });
    if (res.status === 401) return "unauthorized";
    if (!res.ok) return "network-error";
    return (await res.json()) as MeResponse;
  } catch {
    return "network-error";
  }
}

/**
 * Запрос авто-триала (trial-билд, после логина при plan=free). Сервер выдаёт
 * строго один раз на аккаунт; повторные вызовы безопасны (идемпотентно).
 * Ошибка сети не блокирует вход — попытка повторится при следующем старте.
 */
export async function requestAutoTrial(
  token: string
): Promise<{ granted: boolean; code?: string }> {
  try {
    const res = await fetch(`${AUTH_URL}/api/trial/auto`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Billing-Mode": getBillingMode(),
      },
    });
    if (!res.ok) return { granted: false, code: `http_${res.status}` };
    const data = (await res.json()) as { ok: boolean; code?: string };
    return data.ok ? { granted: true } : { granted: false, code: data.code };
  } catch {
    return { granted: false, code: "network" };
  }
}

function randomState(): string {
  // crypto.randomUUID доступен в webview Tauri.
  return crypto.randomUUID();
}

/**
 * Обменять одноразовый код (из deep-link siplinx://auth?code=...) на bearer-токен
 * сессии. Код одноразовый и живёт 60с (см. auth-service/src/lib/appAuthCode.ts).
 */
async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${AUTH_URL}/api/app/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Обмен кода не удался (${res.status})`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Сервер не вернул токен");
  return data.token;
}

/**
 * Вход через веб (тот же, что на лендинге) с возвратом токена по deep-link:
 * 1) открываем системный браузер на /app/start?state=<random>;
 * 2) там либо уже готовая сессия с лендинга, либо Google OAuth;
 * 3) /app/complete возвращает в приложение siplinx://auth?code=...&state=...;
 * 4) ловим deep-link, сверяем state, меняем код на токен, тянем /api/me.
 *
 * Раньше здесь был loopback-сервер (tauri-plugin-oauth): он оказался ненадёжным —
 * токен доставлялся инжект-скриптом плагина через fetch на /cb, и после добавления
 * deep-link/single-instance это ломалось, вход зависал на экране логина.
 * Deep-link-возврат надёжнее и переиспользует веб-вход лендинга.
 */
function loginCancelledError(): Error {
  const err = new Error("Вход отменён");
  err.name = "AbortError";
  return err;
}

export async function loginWithGoogle(options: {
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<MeResponse> {
  const { signal, timeoutMs = 90 * 1000 } = options;
  const expectedState = randomState();

  return await new Promise<MeResponse>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unlisteners: Array<() => void> = [];

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      for (const off of unlisteners) {
        try { off(); } catch { /* noop */ }
      }
    };

    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    };

    const abort = () => fail(loginCancelledError());

    if (signal?.aborted) {
      reject(loginCancelledError());
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    const handleUrl = async (raw: string) => {
      if (settled) return;
      let u: URL;
      try { u = new URL(raw); } catch { return; }
      // Ждём именно siplinx://auth?code=...&state=...
      if (u.protocol !== "siplinx:" || u.host !== "auth") return;
      const code = u.searchParams.get("code");
      const state = u.searchParams.get("state");
      if (!code) return;
      // Чужая попытка входа (другой state) — игнорируем.
      if (state && state !== expectedState) return;

      settled = true;
      cleanup();
      try {
        // Возвращаем окно на передний план сразу.
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const appWindow = getCurrentWindow();
          await appWindow.unminimize();
          await appWindow.show();
          await appWindow.setFocus();
        } catch { /* best-effort */ }

        const token = await exchangeCode(code);
        const me = await fetchMe(token);
        if (me === "unauthorized" || me === "network-error") {
          throw new Error("Не удалось подтвердить вход на сервере");
        }
        await setSession(token, me);
        resolve(me);
      } catch (e) {
        reject(e);
      }
    };

    (async () => {
      try {
        // Deep-link приходит двумя каналами: напрямую из плагина deep-link
        // (onOpenUrl) и как событие от single-instance (см. lib.rs) — слушаем оба.
        try {
          const off = await onOpenUrl((urls) => urls.forEach((url) => void handleUrl(url)));
          unlisteners.push(off);
        } catch { /* noop */ }
        try {
          const off = await listen<string>("deep-link-opened", (e) => void handleUrl(e.payload));
          unlisteners.push(off);
        } catch { /* noop */ }

        await openUrl(`${AUTH_URL}/app/start?state=${encodeURIComponent(expectedState)}`);

        // Таймаут на случай, если вход не завершён.
        timer = setTimeout(() => {
          fail(new Error("Время входа истекло. Попробуйте снова."));
        }, timeoutMs);
      } catch (e) {
        fail(e);
      }
    })();
  });
}

async function openAuthedUrl(path: string): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error("Не авторизован");
  const res = await fetch(`${AUTH_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Сервер вернул ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  await openUrl(url);
}

/**
 * Открыть Polar checkout в браузере.
 *  - monthly: $2/неделю, без триала.
 *  - trial7:  7 дней бесплатно, затем $4/неделю (нужна карта).
 */
export async function openCheckout(
  plan: "monthly" | "yearly" | "trial7" = "monthly"
): Promise<void> {
  await openAuthedUrl(`/api/billing/checkout?plan=${plan}`);
}

/** Открыть Polar customer portal в браузере. */
export async function openPortal(): Promise<void> {
  await openAuthedUrl(`/api/billing/portal`);
}

/**
 * Активировать бесплатный триал по промокоду (без карты).
 * После успеха вызывающий код должен сделать refresh() — /api/me вернёт PRO.
 */
export async function redeemTrial(
  code: string
): Promise<{ ok: true } | { ok: false; code: string }> {
  const token = await getToken();
  if (!token) return { ok: false, code: "unauthorized" };
  try {
    const res = await fetch(`${AUTH_URL}/api/trial/redeem`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    // Возвращаем КОД ошибки; человекочитаемый текст подбирает UI через i18n.
    return { ok: false, code: data.error || "server" };
  } catch {
    return { ok: false, code: "network" };
  }
}

export async function logout(): Promise<void> {
  await clearSession();
}

/**
 * Согласие на рекламную рассылку (win-back письма). Отправляется:
 *  - при входе (значение галочки на LoginScreen),
 *  - переключателем в настройках (карточка «Аккаунт»).
 * locale уходит вместе с согласием, чтобы сразу зафиксировать язык писем.
 */
export async function setEmailPrefs(
  marketingOptIn: boolean,
  locale?: string
): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${AUTH_URL}/api/email/prefs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ marketingOptIn, locale }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getEmailPrefs(): Promise<{ marketingOptIn: boolean } | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_URL}/api/email/prefs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as { marketingOptIn: boolean };
  } catch {
    return null;
  }
}
