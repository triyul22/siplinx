"use client";

import { useAuth } from "@/contexts/AuthContext";
import LoginScreen from "./LoginScreen";
import PaywallScreen from "./PaywallScreen";

/**
 * Гейт доступа: пока статус не подтверждён — сплэш; без входа — экран логина;
 * после входа без активной подписки/триала — пейволл; с PRO — само приложение.
 *
 * Бренд Siplinx AI: градиент синий #2F6BFF → фиолетовый #7A3BE0 (как в LoginScreen).
 */
const BRAND_GRADIENT = "linear-gradient(135deg, #2F6BFF 0%, #7A3BE0 100%)";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, isPro } = useAuth();

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(122,59,224,0.10), rgba(255,255,255,0) 60%), #FFFFFF",
          color: "#0E1116",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
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
        </div>
        <span
          className="animate-spin"
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: "3px solid rgba(47,107,255,0.20)",
            borderTopColor: "#2F6BFF",
            display: "inline-block",
          }}
        />
        <span style={{ color: "#94A0B0", fontSize: 13 }}>Загрузка…</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <LoginScreen />;
  }

  // Полный пейволл: вошёл, но без активной подписки/триала — приложение закрыто.
  if (!isPro) {
    return <PaywallScreen />;
  }

  return <>{children}</>;
}
