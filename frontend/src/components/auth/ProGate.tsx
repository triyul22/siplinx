"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { openCheckout, openPortal, redeemTrial } from "@/lib/authClient";
import { Analytics } from "@/lib/analytics";

/**
 * Бренд Siplinx AI: градиент синий #2F6BFF → фиолетовый #7A3BE0.
 */
const BRAND_GRADIENT = "linear-gradient(135deg, #2F6BFF 0%, #7A3BE0 100%)";
const BRAND_BLUE = "#2F6BFF";

const KNOWN_PROMO_ERRORS = ["invalid_code", "already_pro", "unauthorized", "network"];

/**
 * Кнопка апгрейда. Открывает Polar checkout в браузере и затем опрашивает
 * /api/me, пока подписка не станет активной (вебхук обновит статус).
 */
export function UpgradeButton({
  plan = "monthly",
  label,
}: {
  plan?: "monthly" | "yearly" | "trial7";
  label?: string;
}) {
  const { refresh, isPro, me } = useAuth();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProRef = useRef(isPro);
  const managedByPolarRef = useRef(Boolean(me?.managedByPolar));
  const pollTargetRef = useRef<"pro" | "managed_by_polar">("pro");

  const checkoutStatusReached = useCallback(() => {
    if (pollTargetRef.current === "managed_by_polar") {
      return managedByPolarRef.current;
    }
    return isProRef.current;
  }, []);

  useEffect(() => {
    isProRef.current = isPro;
    managedByPolarRef.current = Boolean(me?.managedByPolar);
    if (checkoutStatusReached() && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setBusy(false);
    }
  }, [checkoutStatusReached, isPro, me?.managedByPolar]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      await refresh();
      // Обычный checkout ждёт PRO. Покупка из no-card trial уже была PRO,
      // поэтому ждём именно привязку Polar customer_id => managedByPolar.
      if (checkoutStatusReached() || Date.now() - startedAt > 2 * 60 * 1000) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setBusy(false);
      }
    }, 4000);
  }, [checkoutStatusReached, refresh]);

  const handle = async () => {
    setBusy(true);
    Analytics.track('upgrade_clicked', { plan });
    pollTargetRef.current =
      isPro && me?.status === "trialing" && !me?.managedByPolar
        ? "managed_by_polar"
        : "pro";
    try {
      await openCheckout(plan);
      Analytics.track('checkout_started', { plan });
      startPolling();
    } catch {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      style={{
        padding: "10px 18px",
        borderRadius: 10,
        border: "none",
        background: BRAND_GRADIENT,
        color: "#FFFFFF",
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.7 : 1,
        boxShadow: "0 6px 18px rgba(47,107,255,0.22)",
      }}
    >
      {busy ? t("pro.busy") : label ?? t("pro.upgrade")}
    </button>
  );
}

/** Кнопка управления подпиской (Polar customer portal). */
export function ManageSubscriptionButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          await openPortal();
        } catch (e) {
          // Раньше ошибка глоталась молча и кнопка выглядела «зависшей».
          console.error("[portal] open failed:", e);
          toast.error(t("pro.manageError"));
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        border: `1px solid ${BRAND_BLUE}`,
        background: "transparent",
        color: BRAND_BLUE,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {t("pro.manage")}
    </button>
  );
}

/**
 * Поле активации бесплатного триала по промокоду (без карты).
 * При успехе обновляет статус — /api/me вернёт PRO, и гейт пропустит контент.
 */
export function PromoCodeField() {
  const { refresh } = useAuth();
  const t = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const submit = async () => {
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setMsg(null);
    Analytics.track('trial_code_submitted');
    const res = await redeemTrial(value);
    if (res.ok) {
      setMsg({ kind: "ok", text: t("promo.success") });
      Analytics.track('trial_activated', { days: '7' });
      await refresh();
    } else {
      const key = KNOWN_PROMO_ERRORS.includes(res.code) ? res.code : "server";
      setMsg({ kind: "err", text: t(`promo.err.${key}`) });
      Analytics.track('trial_code_failed', { error: key });
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={t("promo.placeholder")}
          disabled={busy}
          aria-label={t("promo.placeholder")}
          style={{
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid rgba(47,107,255,0.35)",
            background: "#FFFFFF",
            color: "#0E1116",
            minWidth: 160,
          }}
        />
        <button
          onClick={submit}
          disabled={busy || !code.trim()}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: `1px solid ${BRAND_BLUE}`,
            background: "transparent",
            color: BRAND_BLUE,
            fontWeight: 600,
            cursor: busy || !code.trim() ? "default" : "pointer",
            opacity: busy || !code.trim() ? 0.6 : 1,
          }}
        >
          {busy ? t("promo.activating") : t("promo.activate")}
        </button>
      </div>
      {msg && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            color: msg.kind === "ok" ? "#1B7F4B" : "#B23B3B",
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

/**
 * Гейт PRO-фичи. Оборачивай платные функции:
 *   <ProGate feature="Экспорт в PDF"> <PdfExportButton/> </ProGate>
 * Для не-PRO показывает апселл вместо содержимого.
 */
export function ProGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  const { isPro } = useAuth();
  const t = useT();
  if (isPro) return <>{children}</>;

  return (
    <div
      style={{
        border: "1px solid rgba(47,107,255,0.25)",
        borderRadius: 12,
        padding: 20,
        textAlign: "center",
        background:
          "linear-gradient(135deg, rgba(47,107,255,0.06) 0%, rgba(122,59,224,0.06) 100%)",
        color: "#0E1116",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {feature ? t("pro.featureLocked", { feature }) : t("pro.featureLockedGeneric")}
      </div>
      <p style={{ color: "#5A6472", fontSize: 14, marginBottom: 14 }}>
        {t("pro.unlock")}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {/* Сейчас в Polar заведён только месячный план. Кнопку «PRO / год»
            вернуть, когда появится годовой продукт (POLAR_PRODUCT_ID_YEARLY). */}
        <UpgradeButton plan="monthly" label={t("pro.upgrade")} />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "#5A6472" }}>
        {t("pro.orPromoLong")}
      </div>
      <PromoCodeField />
    </div>
  );
}
