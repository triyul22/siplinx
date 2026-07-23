"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/I18nContext";
import { UpgradeButton } from "./ProGate";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

const DAY_MS = 24 * 60 * 60 * 1000;
const ENDING_TOAST_KEY = "siplinx.trialEndingToastDay";

/**
 * Ненавязчивая индикация триала в сайдбаре: «Триал · осталось N дн.».
 * Клик открывает модал с кнопкой оплаты ($4/нед, trial7). Последние 2 дня
 * бейдж акцентный + один тост в день запуска про дату окончания.
 * Рендерится только для НАШЕГО триала без карты (managedByPolar=false):
 * у Polar-триала карта уже привязана, оплата произойдёт сама.
 */
export default function TrialBadge() {
  const { me, isPro } = useAuth();
  const t = useT();
  const [open, setOpen] = useState(false);

  const isOurTrial =
    isPro && me?.status === "trialing" && !me?.managedByPolar && !!me?.currentPeriodEnd;

  // N дней считаем от serverTime (не от локальных часов юзера).
  const daysLeft = useMemo(() => {
    if (!isOurTrial || !me?.currentPeriodEnd) return 0;
    const end = new Date(me.currentPeriodEnd).getTime();
    const server = me.serverTime ? new Date(me.serverTime).getTime() : Date.now();
    return Math.max(0, Math.ceil((end - server) / DAY_MS));
  }, [isOurTrial, me?.currentPeriodEnd, me?.serverTime]);

  const endDateLabel = useMemo(() => {
    if (!me?.currentPeriodEnd) return "";
    return new Date(me.currentPeriodEnd).toLocaleDateString();
  }, [me?.currentPeriodEnd]);

  const ending = daysLeft <= 2;

  // Последние 2 дня: один тост в день запуска «Триал заканчивается <дата>».
  useEffect(() => {
    if (!isOurTrial || !ending) return;
    try {
      const today = new Date().toDateString();
      if (localStorage.getItem(ENDING_TOAST_KEY) !== today) {
        localStorage.setItem(ENDING_TOAST_KEY, today);
        toast.warning(t("trial.endingToast", { date: endDateLabel }));
      }
    } catch {
      // localStorage недоступен — просто без тоста.
    }
  }, [isOurTrial, ending, endDateLabel, t]);

  if (!isOurTrial) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center justify-center px-3 py-1.5 mb-1 text-sm font-medium rounded-lg transition-colors shadow-sm ${
          ending
            ? "text-white bg-amber-500 hover:bg-amber-600"
            : "text-blue-700 bg-blue-50 hover:bg-blue-100"
        }`}
      >
        {t("trial.badge", { days: String(daysLeft) })}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogTitle>{t("trial.modal.title")}</DialogTitle>
          <p className="text-sm text-gray-600">
            {t("trial.modal.text", { date: endDateLabel })}
          </p>
          <div className="flex justify-center pt-2">
            <UpgradeButton plan="trial7" label={t("paywall.trial7Cta")} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
