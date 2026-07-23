"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { Analytics } from "@/lib/analytics";

/**
 * Экран входа. Показывается, пока пользователь не авторизован.
 * Регистрация обязательна для использования приложения.
 *
 * Бренд Siplinx AI: градиент синий #2F6BFF → фиолетовый #7A3BE0.
 */
const BRAND_GRADIENT = "linear-gradient(135deg, #2F6BFF 0%, #7A3BE0 100%)";
const MIN_FOCUS_CANCEL_ARM_MS = 1500;
const RETURN_WITHOUT_AUTH_GRACE_MS = 8000;

export default function LoginScreen() {
  const { login } = useAuth();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const returnCancelTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const loginStartedAtRef = useRef(0);
  // По умолчанию НЕ отмечено: pre-checked не считается согласием по GDPR.
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  useEffect(() => {
    const autoCancelAfterReturn = () => {
      const controller = abortRef.current;
      if (!controller) return;

      const elapsedMs = Date.now() - loginStartedAtRef.current;
      if (elapsedMs < MIN_FOCUS_CANCEL_ARM_MS) return;
      if (returnCancelTimerRef.current) {
        window.clearTimeout(returnCancelTimerRef.current);
      }

      // A successful OAuth deep-link also focuses the app. Give that handler
      // enough time to arrive and exchange the code before treating focus as
      // user return. Existing browser sessions can complete very quickly, but
      // Windows may deliver the deep-link event a few seconds after focus.
      returnCancelTimerRef.current = window.setTimeout(() => {
        if (abortRef.current !== controller) return;
        attemptRef.current += 1;
        controller.abort();
        abortRef.current = null;
        returnCancelTimerRef.current = null;
        setBusy(false);
        setError(t("login.returnedWithoutAuth"));
        Analytics.track("login_auto_cancelled");
      }, RETURN_WITHOUT_AUTH_GRACE_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") autoCancelAfterReturn();
    };

    window.addEventListener("focus", autoCancelAfterReturn);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", autoCancelAfterReturn);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (returnCancelTimerRef.current) {
        window.clearTimeout(returnCancelTimerRef.current);
        returnCancelTimerRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [t]);

  const handleLogin = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    loginStartedAtRef.current = Date.now();
    if (returnCancelTimerRef.current) {
      window.clearTimeout(returnCancelTimerRef.current);
      returnCancelTimerRef.current = null;
    }

    setError(null);
    setBusy(true);
    Analytics.track('login_initiated');
    try {
      await login({ marketingOptIn, signal: controller.signal });
      if (attempt === attemptRef.current) {
        Analytics.track('login_completed');
      }
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      Analytics.track('login_failed', { error: msg });
    } finally {
      if (attempt === attemptRef.current) {
        setBusy(false);
        abortRef.current = null;
        if (returnCancelTimerRef.current) {
          window.clearTimeout(returnCancelTimerRef.current);
          returnCancelTimerRef.current = null;
        }
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(122,59,224,0.10), rgba(255,255,255,0) 60%), #FFFFFF",
        color: "#0E1116",
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>
          Siplinx{" "}
          <span
            style={{
              background: BRAND_GRADIENT,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI
          </span>
        </h1>
        <p style={{ color: "#5A6472", marginBottom: 28, lineHeight: 1.5 }}>
          {t("login.subtitle")}
        </p>

        <button
          onClick={handleLogin}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 22px",
            borderRadius: 12,
            border: "none",
            background: BRAND_GRADIENT,
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
            boxShadow: "0 8px 24px rgba(47,107,255,0.25)",
            transition: "opacity 0.15s ease",
          }}
        >
          {/* Google G на белой подложке для контраста на градиенте */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "#FFFFFF",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7C43.9 38 46.5 31.8 46.5 24.5z"/>
              <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 16 0 19.9 0 23.5s.9 7.5 2.5 10.9l7.9-6.1z"/>
              <path fill="#34A853" d="M24 47c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-3.7-13.6-9l-7.9 6.1C6.4 42.6 14.6 47 24 47z"/>
            </svg>
          </span>
          {busy ? t("login.opening") : t("login.signIn")}
        </button>

        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 20,
            textAlign: "left",
            color: "#5A6472",
            fontSize: 12,
            lineHeight: 1.45,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            style={{ marginTop: 2, accentColor: "#7A3BE0", cursor: "pointer" }}
          />
          <span>{t("login.marketingOptIn")}</span>
        </label>

        {error && (
          <p style={{ color: "#DC2626", marginTop: 16, fontSize: 13 }}>{error}</p>
        )}

        <p style={{ color: "#94A0B0", marginTop: 24, fontSize: 12 }}>
          {t("login.hint")}
        </p>
      </div>
    </div>
  );
}
