"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { getBillingMode } from "@/config/auth";
import { UpgradeButton, PromoCodeField } from "./ProGate";
import { Analytics } from "@/lib/analytics";

/**
 * Экран пейволла. Показывается после входа, если у пользователя НЕТ активной
 * подписки и НЕТ триала. Пользоваться приложением без PRO/триала нельзя.
 *
 * Тариф зависит от режима билда (NEXT_PUBLIC_BILLING_MODE):
 *  - trial:  $4/нед (trial7); если триал уже истёк — текст про его окончание.
 *  - direct: $2/нед (monthly), без упоминаний триала.
 *
 * Бренд Siplinx AI: градиент синий #2F6BFF → фиолетовый #7A3BE0.
 */
const BRAND_GRADIENT = "linear-gradient(135deg, #2F6BFF 0%, #7A3BE0 100%)";

export default function PaywallScreen() {
  const { user, me, logout, refresh } = useAuth();
  const t = useT();

  const mode = getBillingMode();
  const trialExpired = mode === "trial" && me?.status === "expired";

  useEffect(() => {
    Analytics.track('paywall_viewed', { mode, trial_expired: String(trialExpired) });
  }, [mode, trialExpired]);

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
      <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: -0.5 }}>
          Siplinx{" "}
          <span
            style={{
              background: BRAND_GRADIENT,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            AI PRO
          </span>
        </h1>
        <p style={{ color: "#5A6472", marginBottom: 24, lineHeight: 1.5 }}>
          {trialExpired ? t("paywall.trialEnded.subtitle") : t("paywall.subtitle")}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          {mode === "trial" ? (
            <UpgradeButton plan="trial7" label={t("paywall.trial7Cta")} />
          ) : (
            <UpgradeButton plan="monthly" label={t("paywall.monthly")} />
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#94A0B0" }}>
          {mode === "trial"
            ? t(trialExpired ? "paywall.cardNote.trialUsed" : "paywall.cardNote")
            : t("paywall.cardNote.direct")}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "#5A6472" }}>
          {t("paywall.orPromo")}
        </div>
        <PromoCodeField />

        <div style={{ marginTop: 28, fontSize: 12, color: "#94A0B0" }}>
          <button
            onClick={() => refresh()}
            style={{
              background: "none",
              border: "none",
              color: "#2F6BFF",
              cursor: "pointer",
              fontSize: 12,
              textDecoration: "underline",
            }}
          >
            {t("paywall.refresh")}
          </button>
          {user && (
            <>
              <span style={{ margin: "0 8px" }}>·</span>
              <button
                onClick={() => logout()}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94A0B0",
                  cursor: "pointer",
                  fontSize: 12,
                  textDecoration: "underline",
                }}
              >
                {t("paywall.logout", { email: user.email })}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
