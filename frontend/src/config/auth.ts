// Конфиг авторизации десктопа.

// URL облачного auth-сервиса. В проде задаётся через NEXT_PUBLIC_AUTH_URL при сборке
// (next.config: env прокидывается на этапе build, т.к. фронт собирается в статику).
export const AUTH_URL =
  (process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:3210").replace(/\/$/, "");

// Диапазон loopback-портов. ДОЛЖЕН совпадать с DESKTOP_LOOPBACK_PORT_MIN/MAX
// в auth-service/.env (там проверяется белый список портов).
export const LOOPBACK_PORTS = [38400, 38401, 38402, 38403, 38404];

// Сколько дней разрешаем работать оффлайн с последним подтверждённым статусом.
// Privacy-first: приложение должно оставаться рабочим без постоянной связи.
export const OFFLINE_GRACE_DAYS = 7;

// Режим биллинга билда. Зашивается при сборке через NEXT_PUBLIC_BILLING_MODE
// (фронт статика — как NEXT_PUBLIC_AUTH_URL). Влияет ТОЛЬКО на поведение до
// первого получения подписки: запрашивать ли авто-триал после логина и какой
// тариф показывает пейволл. Всё остальное живёт в серверной БД.
//  - "trial":  авто-триал 7 дней после входа, после истечения пейволл $4/нед.
//  - "direct": без триала, сразу пейволл $2/нед.
export type BillingMode = "trial" | "direct";

export function getBillingMode(): BillingMode {
  return process.env.NEXT_PUBLIC_BILLING_MODE === "direct" ? "direct" : "trial";
}
