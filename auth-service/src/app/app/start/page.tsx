"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
});

type Phase = "checking" | "google" | "retry";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return await Promise.race([
    promise,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * Веб-вход для ДЕСКТОПА. Приложение открывает в браузере:
 *   /app/start?state=<random>
 * Если в браузере уже есть сессия (юзер входил на лендинге) — сразу на
 * /app/complete, БЕЗ повторного Google. Иначе — Google OAuth с callbackURL
 * на /app/complete. Дальше /app/complete вернёт токен в приложение по
 * deep-link siplinx://auth?code=...&state=...
 */
export default function AppStart() {
  const started = useRef(false);
  const [completeUrl, setCompleteUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  const startGoogle = useCallback(async (target: string | null = completeUrl) => {
    if (!target) return;

    setError(null);
    setPhase("google");
    setCanRetry(false);

    try {
      await authClient.signIn.social({ provider: "google", callbackURL: target });
      window.setTimeout(() => {
        setPhase("retry");
        setCanRetry(true);
      }, 3000);
    } catch (e: unknown) {
      setError(String(e));
      setPhase("retry");
      setCanRetry(true);
    }
  }, [completeUrl]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const state = new URLSearchParams(window.location.search).get("state") || "";
    const complete = `/app/complete?state=${encodeURIComponent(state)}`;
    setCompleteUrl(complete);

    (async () => {
      try {
        const s = await withTimeout(authClient.getSession(), 5000);
        if (s?.data?.user) {
          window.location.href = complete;
          return;
        }
      } catch {
        /* нет сессии — идём через Google */
      }
      void startGoogle(complete);
    })();
  }, [startGoogle]);

  return (
    <main style={{ maxWidth: 520, margin: "16vh auto", padding: 24, textAlign: "center" }}>
      <h2>Вход в Siplinx</h2>
      <p style={{ opacity: 0.8 }}>
        {phase === "checking" && "Проверяем сессию…"}
        {phase === "google" && "Открываем вход через Google…"}
        {phase === "retry" && "Если вход не открылся или открылся не в том браузере, попробуйте ещё раз."}
      </p>
      {canRetry && (
        <button
          onClick={() => void startGoogle()}
          style={{
            border: 0,
            borderRadius: 12,
            background: "#2F6BFF",
            color: "#fff",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 700,
            padding: "12px 18px",
          }}
        >
          Открыть вход ещё раз
        </button>
      )}
      {error && <pre style={{ color: "#6F1D1B", whiteSpace: "pre-wrap" }}>{error}</pre>}
    </main>
  );
}
