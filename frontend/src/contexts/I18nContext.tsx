"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { translations, type Lang } from "@/i18n/translations";

/**
 * Локализация UI. Стратегия выбора языка (согласована с заказчицей):
 *  1) если пользователь выбирал язык вручную — берём его (localStorage);
 *  2) иначе авто-детект по языку системы (Tauri plugin-os locale());
 *  3) фолбэк — английский.
 * Ручной выбор в настройках перебивает авто-детект.
 */

const STORAGE_KEY = "siplinx.lang";

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number | null | undefined>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function savedLang(): Lang | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "ru" || v === "en" ? v : null;
}

function langFromLocale(locale: string | null | undefined): Lang {
  return (locale ?? "").toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Стартуем с сохранённого выбора либо EN; системный язык подхватим в эффекте.
  const [lang, setLangState] = useState<Lang>(() => savedLang() ?? "en");

  useEffect(() => {
    // Если пользователь уже выбирал язык — не трогаем.
    if (savedLang()) return;
    let cancelled = false;
    (async () => {
      let detected: Lang;
      try {
        const { locale } = await import("@tauri-apps/plugin-os");
        detected = langFromLocale(await locale());
      } catch {
        detected =
          typeof navigator !== "undefined"
            ? langFromLocale(navigator.language)
            : "en";
      }
      if (!cancelled) setLangState(detected);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* localStorage недоступен — не критично */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number | null | undefined>) => {
      const dict = translations[lang] ?? translations.en;
      let s = dict[key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          // split/join вместо RegExp — без экранирования и без риска с регэкспами.
          s = s.split(`{${k}}`).join(String(v ?? ""));
        }
      }
      return s;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n должен использоваться внутри <I18nProvider>");
  return ctx;
}

/** Удобный хук: только функция перевода. */
export function useT() {
  return useI18n().t;
}
