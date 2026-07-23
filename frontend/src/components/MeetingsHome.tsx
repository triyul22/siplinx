"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { FileAudio, FileText, Search, Settings, SlidersHorizontal, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  CurrentMeeting,
  useSidebar,
} from "@/components/Sidebar/SidebarProvider";
import { useImportDialog } from "@/contexts/ImportDialogContext";
import { useI18n } from "@/contexts/I18nContext";
import TrialBadge from "@/components/auth/TrialBadge";
import { openSettings } from "@/components/SettingsModal";
import { useConfig } from "@/contexts/ConfigContext";
import { DeviceSelection } from "@/components/DeviceSelection";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useUpdateCheckContext } from "@/components/UpdateCheckProvider";

type MeetingMetadata = {
  created_at?: string;
  folder_path?: string | null;
};

type RecordingMetadata = {
  duration_seconds?: number | null;
};

type SummaryResponse = {
  status?: string;
  data?: unknown;
};

type MeetingCard = CurrentMeeting & {
  createdAt?: string;
  durationSeconds?: number;
  hasSummary?: boolean;
};

function metadataPath(folderPath: string) {
  const separator = folderPath.includes("\\") ? "\\" : "/";
  return `${folderPath.replace(/[\\/]$/, "")}${separator}metadata.json`;
}

function formatDuration(seconds: number | undefined, fallback: string) {
  if (seconds == null || !Number.isFinite(seconds)) return fallback;
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function MeetingsHome({
  onStartRecording,
  recordingDisabled,
}: {
  onStartRecording: () => void;
  recordingDisabled: boolean;
}) {
  const router = useRouter();
  const { lang, t } = useI18n();
  const {
    meetings,
    setCurrentMeeting,
    searchResults,
    searchTranscripts,
    isSearching,
    isMeetingsLoading,
    hasLoadedMeetings,
  } = useSidebar();
  const { openImportDialog } = useImportDialog();
  const { selectedDevices, setSelectedDevices } = useConfig();
  const { updateBannerInfo, showUpdateDialog, dismissUpdate } = useUpdateCheckContext();
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<MeetingCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    const baseCards = meetings.map((meeting): MeetingCard => ({ ...meeting }));

    setCards(baseCards);

    if (baseCards.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      meetings.map(async (meeting): Promise<MeetingCard> => {
        try {
          const [metadata, summary] = await Promise.all([
            invoke<MeetingMetadata>("api_get_meeting_metadata", {
              meetingId: meeting.id,
            }),
            invoke<SummaryResponse>("api_get_summary", {
              meetingId: meeting.id,
            }).catch(() => null),
          ]);

          let durationSeconds: number | undefined;
          if (metadata.folder_path) {
            try {
              const raw = await readTextFile(metadataPath(metadata.folder_path));
              const recordingMetadata = JSON.parse(raw) as RecordingMetadata;
              durationSeconds =
                recordingMetadata.duration_seconds == null
                  ? undefined
                  : Number(recordingMetadata.duration_seconds);
            } catch {
              // Older/imported meetings may not have metadata.json.
            }
          }

          return {
            ...meeting,
            createdAt: metadata.created_at,
            durationSeconds,
            hasSummary:
              summary?.status === "completed" && summary.data != null,
          };
        } catch {
          return meeting;
        }
      }),
    ).then((next) => {
      if (!cancelled) {
        next.sort((a, b) =>
          String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
        );
        setCards(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [meetings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void searchTranscripts(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, searchTranscripts]);

  const visibleCards = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return cards;
    const transcriptMatches = new Set(searchResults.map((result) => result.id));
    return cards.filter(
      (meeting) =>
        meeting.title.toLocaleLowerCase().includes(normalized) ||
        transcriptMatches.has(meeting.id),
    );
  }, [cards, query, searchResults]);
  const shouldShowMeetingPlaceholders =
    !hasLoadedMeetings && isMeetingsLoading && !query;

  const formatDate = (value?: string) => {
    if (!value) return t("home.dateUnknown");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("home.dateUnknown");
    const today = new Date();
    const startToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).getTime();
    const startDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    const days = Math.round((startToday - startDate) / 86_400_000);
    if (days === 0) return t("home.today");
    if (days === 1) return t("home.yesterday");
    return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
    }).format(date);
  };

  const openMeeting = (meeting: MeetingCard) => {
    setCurrentMeeting({ id: meeting.id, title: meeting.title });
    router.push(`/meeting-details?id=${meeting.id}`);
  };

  return (
    <section className="flex h-screen min-h-[600px] w-full overflow-hidden bg-white text-[#232220]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#ececea] bg-[#f7f6f3] px-4 py-5">
        <div className="px-2 pb-5 text-sm font-bold tracking-[-0.01em]">Siplinx AI</div>
        <div className="flex items-center gap-2 rounded-[9px] bg-white px-3 py-2.5 text-sm font-semibold shadow-sm">
          <FileText size={15} />
          {t("home.title")}
        </div>
        <div className="flex-1" />
        <TrialBadge />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center justify-between px-10 pb-5 pt-7">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          {t("home.title")}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openSettings()}
            aria-label={t("sidebar.settings")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e4e2dd] bg-[#f7f6f3] text-[#6b6864] transition hover:bg-[#f0efec]"
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <UpdateBanner
        updateInfo={updateBannerInfo}
        onUpdate={showUpdateDialog}
        onDismiss={dismissUpdate}
      />

      <div className="flex items-center gap-4 px-10 pb-7">
        <button
          type="button"
          disabled={recordingDisabled}
          onClick={onStartRecording}
          className="flex items-center gap-2.5 rounded-xl bg-[#e0402d] px-[22px] py-[13px] text-[14.5px] font-semibold text-white shadow-[0_6px_16px_-4px_rgba(224,64,45,0.45)] transition hover:-translate-y-px hover:bg-[#c9351f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="h-[9px] w-[9px] rounded-full bg-white" />
          {t("home.record")}
        </button>
        <details className="relative">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-[#e4e2dd] text-[#6b6864] hover:bg-[#f7f6f3]" title={t("home.audioDevices")}>
            <SlidersHorizontal size={17} />
          </summary>
          <div className="absolute left-0 top-[52px] z-30 w-[420px] rounded-xl border border-[#e4e2dd] bg-white p-4 shadow-xl">
            <DeviceSelection
              selectedDevices={selectedDevices}
              onDeviceChange={setSelectedDevices}
            />
          </div>
        </details>
        <button
          type="button"
          onClick={() => openImportDialog()}
          className="flex items-center gap-2 rounded-xl border border-[#e4e2dd] px-[18px] py-3 text-sm font-medium text-[#6b6864] transition hover:bg-[#f7f6f3] hover:text-[#232220]"
        >
          <FileAudio size={17} />
          {t("home.import")}
        </button>
      </div>

      <div className="px-10 pb-4">
        <label className="flex max-w-[340px] items-center gap-2.5 rounded-[10px] border border-[#ececea] bg-[#f7f6f3] px-3.5 py-2.5 focus-within:border-[#c9c6c0] focus-within:bg-white">
          <Search size={16} className="shrink-0 text-[#9c9994]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("home.search")}
            className="w-full bg-transparent text-[13.5px] outline-none placeholder:text-[#9c9994]"
          />
          {isSearching && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#d8d6d0] border-t-[#e0402d]" />
          )}
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-10 pb-10 pt-1">
        <div className="px-1 pb-2 pt-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#9c9994]">
          {t("home.recent")}
        </div>

        {shouldShowMeetingPlaceholders ? (
          <div className="space-y-1" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="flex w-full items-center gap-4 rounded-[10px] px-3.5 py-3.5"
              >
                <span className="h-[38px] w-[38px] shrink-0 animate-pulse rounded-[10px] bg-[#ececea]" />
                <span className="min-w-0 flex-1 space-y-2">
                  <span className="block h-4 w-[44%] animate-pulse rounded bg-[#ececea]" />
                  <span className="block h-3 w-[28%] animate-pulse rounded bg-[#f0efec]" />
                </span>
              </div>
            ))}
          </div>
        ) : visibleCards.length === 0 ? (
          query ? (
            <div className="mt-12 text-center text-sm text-[#9c9994]">
              {t("home.noSearchResults")}
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-[520px] text-center">
              <h2 className="text-[17px] font-semibold">{t("home.emptyTitle")}</h2>
              <p className="mx-auto mt-2 max-w-[430px] text-[13.5px] leading-5 text-[#9c9994]">
                {t("home.emptyDescription")}
              </p>
              <button
                type="button"
                onClick={() => router.push("/demo-note")}
                className="mt-6 w-full rounded-xl border border-[#e4e2dd] bg-[#f7f6f3] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <span className="flex items-center justify-between">
                  <span className="rounded-full bg-[#f8e7e3] px-2.5 py-1 text-[11px] font-semibold text-[#b93626]">
                    {t("home.demoTag")}
                  </span>
                  <span className="text-xs text-[#9c9994]">{t("home.demoDuration")}</span>
                </span>
                <span className="mt-4 block text-[15px] font-semibold">{t("home.demoTitle")}</span>
                <span className="mt-1 block text-[12.5px] text-[#9c9994]">{t("home.demoDescription")}</span>
                <span className="mt-3 flex items-center gap-1.5 text-[11.5px] font-medium text-[#9c6b1f]">
                  <Sparkles size={12} />
                  {t("home.demoNotice")}
                </span>
              </button>
            </div>
          )
        ) : (
          <div className="space-y-1">
            {visibleCards.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => openMeeting(meeting)}
                className="flex w-full items-center gap-4 rounded-[10px] border border-transparent px-3.5 py-3.5 text-left transition hover:border-[#ececea] hover:bg-[#f7f6f3]"
              >
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-[#ececea] bg-[#f7f6f3] text-[#6b6864]">
                  <FileText size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold">
                    {meeting.title}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-[#9c9994]">
                    {formatDate(meeting.createdAt)}
                    {" · "}
                    {formatDuration(
                      meeting.durationSeconds,
                      t("home.durationUnknown"),
                    )}
                  </span>
                </span>
                {meeting.hasSummary && (
                  <span className="shrink-0 rounded-full border border-[#dfeee0] bg-[#eef5ee] px-2.5 py-1 text-[11.5px] font-semibold text-[#4c7a52]">
                    {t("home.noteReady")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
