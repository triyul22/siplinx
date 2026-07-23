"use client";

// Временная страница для проверки реального входа через Google (без десктопа).
// Можно удалить после проверки.

import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({ baseURL: process.env.NEXT_PUBLIC_AUTH_URL });

export default function TestLogin() {
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadMe = async () => {
    try {
      const r = await fetch("/api/me");
      setMe(r.ok ? await r.json() : null);
    } catch (e) {
      setErr(String(e));
    }
  };

  // Тест оплаты: дергаем наш checkout-роут (по cookie-сессии) и уходим в Polar.
  const buyPro = async () => {
    try {
      const r = await fetch("/api/billing/checkout?plan=monthly");
      const j = await r.json();
      if (j?.url) window.location.href = j.url;
      else setErr("checkout: " + JSON.stringify(j));
    } catch (e) {
      setErr(String(e));
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  return (
    <main style={{ maxWidth: 560, margin: "10vh auto", textAlign: "center", padding: 24 }}>
      <h2>Тест входа (временная страница)</h2>
      {me ? (
        <>
          <p>
            Вошли как <b>{me.user?.email}</b>
          </p>
          <p>
            План: <b>{me.plan}</b>
          </p>
          <pre
            style={{
              textAlign: "left",
              background: "#fff8e7",
              padding: 12,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 12,
            }}
          >
            {JSON.stringify(me, null, 2)}
          </pre>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <button
              onClick={buyPro}
              style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer", background: "#6F1D1B", color: "#FFE6A7", border: "none", fontWeight: 600 }}
            >
              Купить PRO (sandbox)
            </button>
            <button
              onClick={loadMe}
              style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
            >
              Обновить статус
            </button>
          </div>
          <button
            onClick={async () => {
              await authClient.signOut();
              loadMe();
            }}
            style={{ padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
          >
            Выйти
          </button>
        </>
      ) : (
        <button
          onClick={() =>
            authClient.signIn.social({ provider: "google", callbackURL: "/test-login" })
          }
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: "1px solid #99582A",
            background: "#fff",
            cursor: "pointer",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Войти через Google
        </button>
      )}
      {err && <p style={{ color: "#6F1D1B" }}>{err}</p>}
    </main>
  );
}
