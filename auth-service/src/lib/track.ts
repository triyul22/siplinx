// Серверный трекинг событий в PostHog (тот же EU-проект 209375, что у клиента).
//
// Зачем сервер, а не JS на лендинге: событие «скачал» должно ловиться на КАЖДОМ
// скачивании, включая прямые ссылки и клиентов с выключенным JS. Эндпоинт
// /download — единая точка, через которую проходят все загрузки.
//
// Ключ PostHog — публичный project write-key (он и так зашит в клиентский
// бинарник), поэтому дефолт захардкожен; env POSTHOG_KEY может переопределить.

const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";
const POSTHOG_KEY =
  process.env.POSTHOG_KEY || "phc_qnmK7KqRbUvbZy3R4YBjWnZ2RrDTWmhHzW4CFSpdJjMt";

/**
 * Fire-and-forget capture в PostHog. Никогда не бросает: сбой аналитики не
 * должен ломать основную операцию (редирект на скачивание). Возвращает промис;
 * вызывающий может его дождаться (на Vercel serverless незавершённый fetch
 * может оборваться, поэтому короткий await лучше, чем «выстрелил и забыл»).
 */
export async function capture(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "auth-service" },
        timestamp: new Date().toISOString(),
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch {
    // Аналитика — необязательный побочный эффект. Молча глотаем.
  }
}

/** UTM-метки из query — чтобы видеть, с какого канала пришло скачивание. */
export function utmFromUrl(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = url.searchParams.get(k);
    if (v) out[k] = v;
  }
  const ref = url.searchParams.get("ref");
  if (ref) out.ref = ref;
  return out;
}
