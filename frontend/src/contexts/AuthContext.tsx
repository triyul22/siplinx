"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import * as authApi from "@/lib/authClient";
import { OFFLINE_GRACE_DAYS, getBillingMode } from "@/config/auth";
import { useT, useI18n } from "@/contexts/I18nContext";
import Analytics from "@/lib/analytics";

type Status = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: Status;
  user: authApi.MeResponse["user"] | null;
  plan: "free" | "pro";
  isPro: boolean;
  /** Полный ответ /api/me (status, currentPeriodEnd, serverTime, managedByPolar). */
  me: authApi.MeResponse | null;
  /** true, если статус взят из оффлайн-кэша (нет связи с сервером). */
  offline: boolean;
  login: (opts?: { marketingOptIn?: boolean; signal?: AbortSignal }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTH_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const AUTH_REFRESH_THROTTLE_MS = 30 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  // t пересоздаётся при смене языка; держим его в ref, чтобы bootstrap не
  // перезапускался (и не задваивал запрос авто-триала) при детекте локали.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const { lang } = useI18n();
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<authApi.MeResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const lastRefreshAtRef = useRef(0);

  // Язык интерфейса → сервер (заголовок X-Locale в /api/me) для выбора языка писем.
  useEffect(() => {
    authApi.setClientLocale(lang);
  }, [lang]);

  // Trial-билд: после логина юзеру с plan=free запрашиваем авто-триал 7 дней.
  // Одноразовость гарантирует сервер; ошибка сети не блокирует вход —
  // попытка повторится при следующем старте (идемпотентно).
  const maybeAutoTrial = useCallback(
    async (token: string, current: authApi.MeResponse): Promise<authApi.MeResponse> => {
      if (getBillingMode() !== "trial" || current.plan !== "free") return current;

      const res = await authApi.requestAutoTrial(token);
      if (!res.granted) return current;

      const fresh = await authApi.fetchMe(token);
      if (fresh === "unauthorized" || fresh === "network-error") return current;

      Analytics.track("auto_trial_granted");
      toast.success(tRef.current("trial.grantedToast"));
      return fresh;
    },
    []
  );

  const bootstrap = useCallback(async () => {
    const token = await authApi.getToken();
    if (!token) {
      setMe(null);
      setOffline(false);
      setStatus("unauthenticated");
      return;
    }

    const res = await authApi.fetchMe(token);

    if (res === "unauthorized") {
      // Токен отозван/протух — выходим.
      await authApi.clearSession();
      setMe(null);
      setOffline(false);
      setStatus("unauthenticated");
      return;
    }

    if (res === "network-error") {
      // Оффлайн-грейс: пускаем с последним известным статусом, если он свежий.
      const { me: cached, verifiedAt } = await authApi.getCachedMe();
      const ageDays = verifiedAt ? (Date.now() - verifiedAt) / DAY_MS : Infinity;
      if (cached && ageDays <= OFFLINE_GRACE_DAYS) {
        setMe(cached);
        setOffline(true);
        setStatus("authenticated");
      } else {
        // Не смогли подтвердить и грейс истёк — просим войти заново.
        setMe(null);
        setOffline(false);
        setStatus("unauthenticated");
      }
      return;
    }

    const finalMe = await maybeAutoTrial(token, res);
    await authApi.setSession(token, finalMe);
    setMe(finalMe);
    setOffline(false);
    setStatus("authenticated");
  }, [maybeAutoTrial]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const refreshEntitlementIfStale = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < AUTH_REFRESH_THROTTLE_MS) return;
    lastRefreshAtRef.current = now;
    await bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const interval = window.setInterval(() => {
      void refreshEntitlementIfStale();
    }, AUTH_REFRESH_INTERVAL_MS);

    const onFocus = () => {
      void refreshEntitlementIfStale();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshEntitlementIfStale();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshEntitlementIfStale, status]);

  const login = useCallback(
    async (opts?: { marketingOptIn?: boolean; signal?: AbortSignal }) => {
      try {
        let res = await authApi.loginWithGoogle({ signal: opts?.signal });
        const token = await authApi.getToken();
        if (token) {
          res = await maybeAutoTrial(token, res);
          await authApi.setSession(token, res);
          // Согласие на рекламу (галочка на логине) + locale для языка писем.
          // Best-effort: провал не должен ломать вход.
          void authApi.setEmailPrefs(opts?.marketingOptIn ?? false, lang);
        }
        setMe(res);
        setOffline(false);
        setStatus("authenticated");
      } catch (e) {
        setStatus("unauthenticated");
        throw e;
      }
    },
    [maybeAutoTrial, lang]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setMe(null);
    setOffline(false);
    setStatus("unauthenticated");
  }, []);

  const refresh = useCallback(async () => {
    await bootstrap();
  }, [bootstrap]);

  const plan = me?.plan ?? "free";

  return (
    <AuthContext.Provider
      value={{
        status,
        user: me?.user ?? null,
        plan,
        isPro: plan === "pro",
        me,
        offline,
        login,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри <AuthProvider>");
  return ctx;
}

/** Удобный хук: есть ли активная PRO-подписка. */
export function usePro(): boolean {
  return useAuth().isPro;
}
