"use client";

import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useT, useI18n } from "@/contexts/I18nContext";
import { ManageSubscriptionButton, UpgradeButton } from "./ProGate";
import { getEmailPrefs, setEmailPrefs } from "@/lib/authClient";

function formatPeriodEnd(value: string | null | undefined, lang: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Карточка «Аккаунт» в настройках: email, текущий план, управление подпиской
 * (Polar customer portal — только когда подписка ведётся в Polar; для нашего
 * триала без карты портал бессмыслен), выход из аккаунта.
 */
export default function AccountSettings() {
  const { user, me, isPro, logout, refresh } = useAuth();
  const t = useT();
  const { lang } = useI18n();

  // Согласие на рекламную рассылку (win-back). null = ещё грузим.
  const [optIn, setOptIn] = useState<boolean | null>(null);
  useEffect(() => {
    if (user) void refresh();
  }, [refresh, user?.id]);

  useEffect(() => {
    let alive = true;
    getEmailPrefs().then((p) => {
      if (alive && p) setOptIn(p.marketingOptIn);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggleOptIn = async () => {
    if (optIn === null) return;
    const next = !optIn;
    setOptIn(next); // оптимистично
    const ok = await setEmailPrefs(next, lang);
    if (!ok) setOptIn(!next); // откат при ошибке
  };

  const planInfo = useMemo(() => {
    if (!isPro) {
      return {
        label: t("account.planFree"),
        detail: null,
        isProPlan: false,
      };
    }

    const date = formatPeriodEnd(me?.currentPeriodEnd, lang);
    const isTrial = me?.status === "trialing" && !me?.managedByPolar;

    return {
      label: isTrial ? t("account.planTrialLabel") : t("account.planProLabel"),
      detail: date
        ? isTrial
          ? t("account.planTrialUntil", { date })
          : t("account.planProUntil", { date })
        : t("account.planDatePending"),
      isProPlan: !isTrial,
    };
  }, [isPro, lang, me?.currentPeriodEnd, me?.status, me?.managedByPolar, t]);
  const canBuyDuringNoCardTrial =
    isPro && me?.status === "trialing" && !me?.managedByPolar;

  if (!user) return null;

  return (
    <div className="p-4 border rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-3">{t("account.title")}</h3>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium break-all">{user.email}</div>
          <div className="mt-2 flex flex-col items-start gap-1">
            <div
              className={
                planInfo.isProPlan
                  ? "inline-flex rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700"
                  : "text-sm font-medium text-gray-700"
              }
            >
              {planInfo.label}
            </div>
            {planInfo.detail && (
              <div className="text-sm text-gray-600">{planInfo.detail}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canBuyDuringNoCardTrial && (
            <UpgradeButton plan="trial7" label={t("account.buyNow")} />
          )}
          {me?.managedByPolar && <ManageSubscriptionButton />}
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-gray-700"
          >
            <LogOut className="w-4 h-4" />
            {t("account.signOut")}
          </button>
        </div>
      </div>

      {optIn !== null && (
        <label className="flex items-start gap-2 mt-4 pt-4 border-t border-gray-100 cursor-pointer">
          <input
            type="checkbox"
            checked={optIn}
            onChange={toggleOptIn}
            className="mt-0.5"
            style={{ accentColor: "#7A3BE0" }}
          />
          <span className="text-sm">
            <span className="font-medium">{t("account.emailPrefs")}</span>
            <span className="block text-gray-500 text-xs mt-0.5">
              {t("account.emailPrefsHint")}
            </span>
          </span>
        </label>
      )}
    </div>
  );
}
