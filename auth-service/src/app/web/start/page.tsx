"use client";

import { useEffect, useRef, useState } from "react";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL,
});

/**
 * Веб-точка входа логина для лендинга. Лендинг открывает:
 *   /web/start?redirect=https://siplinx.com[/путь]
 * Здесь стартуем Google OAuth с callbackURL = redirect. После Google
 * better-auth создаёт/обновляет пользователя в общей БД ("user") и
 * возвращает браузер на лендинг. redirect должен быть в trustedOrigins
 * (см. src/lib/auth.ts), иначе better-auth откажется редиректить обратно.
 *
 * Аналог desktop/start (там loopback), но для веба — просто внешний redirect.
 */
export default function WebStart() {
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const redirect =
      new URLSearchParams(window.location.search).get("redirect") || "/";

    authClient.signIn
      .social({ provider: "google", callbackURL: redirect })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ maxWidth: 520, margin: "16vh auto", padding: 24, textAlign: "center" }}>
      <h2>Вход в Siplinx</h2>
      <p style={{ opacity: 0.8 }}>Перенаправляем на вход через Google…</p>
      {error && (
        <pre style={{ color: "#6F1D1B", whiteSpace: "pre-wrap" }}>{error}</pre>
      )}
    </main>
  );
}
