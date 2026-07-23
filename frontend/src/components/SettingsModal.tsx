"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, FolderOpen, Globe2, Languages, ShieldCheck, User, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useConfig } from "@/contexts/ConfigContext";
import AccountSettings from "@/components/auth/AccountSettings";
import AnalyticsConsentSwitch from "@/components/AnalyticsConsentSwitch";
import { TRANSCRIPTION_LANGUAGES } from "@/components/LanguageSelection";
import { UpdateDialog } from "@/components/UpdateDialog";
import { updateService, UpdateInfo } from "@/services/updateService";
import { Analytics } from "@/lib/analytics";
import { Switch } from "@/components/ui/switch";

const NOTIFICATIONS_KEY = "siplinx_notifications_enabled";
const OPEN_SETTINGS_EVENT = "siplinx:open-settings";
const PRIVACY_POLICY_URL = "https://siplinx-ai.vercel.app/privacy";
const CONTACT_MAILTO = "mailto:hello@siplinx.com";

/** Открыть модалку настроек из любого места приложения. */
export function openSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT));
}

function SettingsRow({
  icon,
  title,
  description,
  last,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`flex items-center gap-4 px-1 py-4 ${last ? "" : "border-b border-[#ececea]"}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f7f6f3] text-[#6b6864]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-[#232220]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-[#9c9994]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function SettingsModal() {
  const { lang, setLang, t } = useI18n();
  const { selectedLanguage, setSelectedLanguage, transcriptModelConfig } = useConfig();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [appVersion, setAppVersion] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setNotifyEnabled(localStorage.getItem(NOTIFICATIONS_KEY) !== "false");
    getVersion().then(setAppVersion).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setAccountOpen(false);
  }, []);

  const toggleNotify = () => {
    const next = !notifyEnabled;
    setNotifyEnabled(next);
    localStorage.setItem(NOTIFICATIONS_KEY, String(next));
  };

  const handleCheckForUpdates = async () => {
    setIsChecking(true);
    try {
      const info = await updateService.checkForUpdates(true);
      setUpdateInfo(info);
      if (info.available) {
        setShowUpdateDialog(true);
      } else {
        toast.success(t("misc.about.latestVersion"));
      }
    } catch (error: any) {
      toast.error(
        t("misc.about.checkUpdatesFailed", {
          error: error?.message || t("misc.about.unknownError"),
        }),
      );
    } finally {
      setIsChecking(false);
    }
  };

  const openExternal = (url: string) => {
    void invoke("open_external_url", { url }).catch((error) => {
      console.error("Failed to open link:", error);
    });
  };

  const copySupportId = async () => {
    try {
      const id = await Analytics.getPersistentUserId();
      await navigator.clipboard.writeText(id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy support ID:", error);
    }
  };

  const transcriptionLanguageOptions =
    transcriptModelConfig.provider === "parakeet"
      ? TRANSCRIPTION_LANGUAGES.filter(
          (language) => language.code === "auto" || language.code === "auto-translate",
        )
      : TRANSCRIPTION_LANGUAGES;
  const selectedTranscriptionLanguage = transcriptionLanguageOptions.some(
    (language) => language.code === selectedLanguage,
  )
    ? selectedLanguage
    : "auto";

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(30,28,25,0.28)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex max-h-[90vh] w-[540px] max-w-[92vw] flex-col overflow-hidden rounded-[14px] border border-[#e4e2dd] bg-white shadow-[0_30px_60px_-12px_rgba(20,18,15,0.35)]">
        <header className="flex items-center justify-between border-b border-[#ececea] px-6 py-4">
          <h1 className="text-[15.5px] font-semibold tracking-[-0.01em]">
            {t("sidebar.settings")}
          </h1>
          <button
            type="button"
            onClick={close}
            aria-label={t("settings.button.done")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7f6f3] text-[#6b6864] transition hover:bg-[#f0efec]"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <SettingsRow
            icon={<Globe2 size={18} />}
            title={t("settings.simple.language")}
            description={t("settings.simple.languageDesc")}
          >
            <select
              value={lang}
              onChange={(event) => setLang(event.target.value as "ru" | "en")}
              className="rounded-lg border border-[#e4e2dd] bg-[#f7f6f3] px-3 py-2 text-sm"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </SettingsRow>

          <SettingsRow
            icon={<Languages size={18} />}
            title={t("settings.language.transcriptionLanguage")}
            description={t("settings.language.transcriptionLanguageDesc")}
          >
            <select
              value={selectedTranscriptionLanguage}
              onChange={(event) => setSelectedLanguage(event.target.value)}
              className="max-w-[230px] rounded-lg border border-[#e4e2dd] bg-[#f7f6f3] px-3 py-2 text-sm"
            >
              {transcriptionLanguageOptions.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                  {language.code !== "auto" &&
                    language.code !== "auto-translate" &&
                    ` (${language.code})`}
                </option>
              ))}
            </select>
          </SettingsRow>

          <SettingsRow
            icon={<FolderOpen size={18} />}
            title={t("settings.simple.folder")}
            description={t("settings.simple.folderDesc")}
          >
            <button
              onClick={() => void invoke("open_recordings_folder")}
              className="rounded-lg border border-[#e4e2dd] px-3 py-2 text-sm hover:bg-[#f7f6f3]"
            >
              {t("settings.simple.open")}
            </button>
          </SettingsRow>

          <SettingsRow
            icon={<Bell size={18} />}
            title={t("settings.simple.notifications")}
            description={t("settings.simple.notificationsDesc")}
          >
            <Switch
              checked={notifyEnabled}
              onCheckedChange={toggleNotify}
              aria-label={t("settings.simple.notifications")}
              className="data-[state=checked]:bg-[#e0402d] data-[state=unchecked]:bg-[#d8d6d0]"
            />
          </SettingsRow>

          <SettingsRow
            icon={<User size={18} />}
            title={t("settings.simple.account")}
            description={t("settings.simple.accountDesc")}
            last={accountOpen}
          >
            <button
              onClick={() => setAccountOpen((v) => !v)}
              className="rounded-lg border border-[#e4e2dd] px-3 py-2 text-sm hover:bg-[#f7f6f3]"
            >
              {accountOpen
                ? t("settings.simple.collapse")
                : t("settings.simple.manage")}
            </button>
          </SettingsRow>
          {accountOpen && (
            <div className="mb-4 rounded-xl border border-[#ececea] bg-[#f7f6f3] p-1 [&>div]:mb-0 [&>div]:border-0 [&>div]:bg-transparent">
              <AccountSettings />
            </div>
          )}

          <SettingsRow
            icon={<ShieldCheck size={18} />}
            title={t("settings.simple.privacy")}
            description={t("settings.simple.privacyDesc")}
            last
          >
            <AnalyticsConsentSwitch variant="compact" />
          </SettingsRow>
        </div>

        <footer className="border-t border-[#ececea] bg-[#f7f6f3] px-6 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-[#6b6864]">
              Siplinx AI{appVersion ? ` · v${appVersion}` : ""}
            </span>
            <button
              onClick={handleCheckForUpdates}
              disabled={isChecking}
              className="text-[12.5px] font-semibold text-[#232220] underline decoration-[#d8d6d0] underline-offset-4 transition hover:text-[#e0402d] disabled:opacity-60"
            >
              {isChecking
                ? t("misc.about.checking")
                : t("misc.about.checkForUpdates")}
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#9c9994]">
            <button
              onClick={() => openExternal(PRIVACY_POLICY_URL)}
              className="hover:text-[#6b6864]"
            >
              {t("settings.simple.privacyPolicy")}
            </button>
            <button
              onClick={() => openExternal(CONTACT_MAILTO)}
              className="hover:text-[#6b6864]"
            >
              {t("settings.simple.contactUs")}
            </button>
            <button
              onClick={copySupportId}
              className="inline-flex items-center gap-1 hover:text-[#6b6864]"
            >
              {idCopied ? (
                <>
                  <Check size={12} className="text-green-600" />
                  {t("settings.simple.copiedId")}
                </>
              ) : (
                t("settings.simple.copySupportId")
              )}
            </button>
          </div>
        </footer>
      </div>

      <UpdateDialog
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
        updateInfo={updateInfo}
      />
    </div>
  );
}
