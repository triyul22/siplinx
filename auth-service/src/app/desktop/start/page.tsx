"use client";

import { useEffect, useRef, useState } from "react";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
});

/**
 * Точка входа логина для десктопа. Десктоп открывает в браузере:
 *   /desktop/start?port=<loopback>&state=<random>
 * Здесь стартуем Google OAuth с callbackURL обратно на /desktop/complete,
 * пробрасывая port+state. После Google пользователь попадёт на /desktop/complete,
 * который вернёт токен на loopback десктопа.
 */
export default function DesktopStart() {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const port = params.get("port") ?? "";
    const state = params.get("state") ?? "";

    const callbackURL = `/desktop/complete?port=${encodeURIComponent(
      port
    )}&state=${encodeURIComponent(state)}`;

    authClient.signIn
      .social({ provider: "google", callbackURL })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: "16vh auto", padding: 24, textAlign: "center" }}>
      <h2>Вход в Siplinx AI</h2>
      <p style={{ opacity: 0.8 }}>Перенаправляем на вход через Google…</p>
      {error && (
        <pre style={{ color: "#6F1D1B", whiteSpace: "pre-wrap" }}>{error}</pre>
      )}
    </main>
  );
}
