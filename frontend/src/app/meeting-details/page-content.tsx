"use client";
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Summary, SummaryResponse } from '@/types';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TranscriptPanel } from '@/components/MeetingDetails/TranscriptPanel';
import { SummaryPanel } from '@/components/MeetingDetails/SummaryPanel';
import { ModelConfig } from '@/components/ModelSettingsModal';

// Custom hooks
import { useMeetingData } from '@/hooks/meeting-details/useMeetingData';
import { useSummaryGeneration } from '@/hooks/meeting-details/useSummaryGeneration';
import { useTemplates } from '@/hooks/meeting-details/useTemplates';
import { useCopyOperations } from '@/hooks/meeting-details/useCopyOperations';
import { useMeetingOperations } from '@/hooks/meeting-details/useMeetingOperations';
import { useConfig } from '@/contexts/ConfigContext';
import { useT } from '@/contexts/I18nContext';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Copy, MoreHorizontal, RefreshCw } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { RetranscribeDialog } from '@/components/MeetingDetails/RetranscribeDialog';
import { MeetingChat } from '@/components/MeetingChat';

export default function PageContent({
  meeting,
  summaryData,
  shouldAutoGenerate = false,
  onAutoGenerateComplete,
  onMeetingUpdated,
  onRefetchTranscripts,
  // Pagination props for efficient transcript loading
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
}: {
  meeting: any;
  summaryData: Summary | null;
  shouldAutoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  onMeetingUpdated?: () => Promise<void>;
  onRefetchTranscripts?: () => Promise<void>;
  // Pagination props
  segments?: any[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;
}) {
  console.log('📄 PAGE CONTENT: Initializing with data:', {
    meetingId: meeting.id,
    summaryDataKeys: summaryData ? Object.keys(summaryData) : null,
    transcriptsCount: meeting.transcripts?.length
  });

  const t = useT();

  // State
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isRecording] = useState(false);
  const [summaryResponse] = useState<SummaryResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'note' | 'transcript'>('note');
  const [quoteTimestamp, setQuoteTimestamp] = useState<number | null>(null);
  const [showRetranscribe, setShowRetranscribe] = useState(false);
  const router = useRouter();

  // Ref to store the modal open function from SummaryGeneratorButtonGroup
  const openModelSettingsRef = useRef<(() => void) | null>(null);

  // Sidebar context
  const { serverAddress } = useSidebar();

  // Get model config from ConfigContext
  const { modelConfig, setModelConfig } = useConfig();

  // Custom hooks
  const meetingData = useMeetingData({ meeting, summaryData, onMeetingUpdated });
  const templates = useTemplates();
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Curated short list per spec: Standard, Planerka, Lecture up front, then the
  // rest behind "Show all". Always include the currently selected template so
  // the <select> value never falls out of the option set.
  const TEMPLATE_PRIORITY = ['standard_meeting', 'planerka', 'lecture'];
  const visibleTemplates = (() => {
    if (showAllTemplates) return templates.availableTemplates;
    const byId = new Map(templates.availableTemplates.map((tpl) => [tpl.id, tpl]));
    const curated = TEMPLATE_PRIORITY.map((id) => byId.get(id)).filter(
      (tpl): tpl is { id: string; name: string; description: string } => Boolean(tpl),
    );
    const selected = templates.availableTemplates.find(
      (tpl) => tpl.id === templates.selectedTemplate,
    );
    if (selected && !curated.some((tpl) => tpl.id === selected.id)) curated.push(selected);
    return curated;
  })();

  // Callback to register the modal open function
  const handleRegisterModalOpen = (openFn: () => void) => {
    console.log('📝 Registering modal open function in PageContent');
    openModelSettingsRef.current = openFn;
  };

  // Callback to trigger modal open (called from error handler)
  const handleOpenModelSettings = () => {
    console.log('🔔 Opening model settings from PageContent');
    if (openModelSettingsRef.current) {
      openModelSettingsRef.current();
    } else {
      console.warn('⚠️ Modal open function not yet registered');
    }
  };

  // Save model config to backend database and sync via event
  const handleSaveModelConfig = async (config?: ModelConfig) => {
    if (!config) return;
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey ?? null,
        ollamaEndpoint: config.ollamaEndpoint ?? null,
      });

      // Emit event so ConfigContext and other listeners stay in sync
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

      toast.success(t('misc.summary.modelSettingsSaved'));
    } catch (error) {
      console.error('Failed to save model config:', error);
      toast.error(t('misc.summary.modelSettingsSaveFailed'));
    }
  };

  const summaryGeneration = useSummaryGeneration({
    meeting,
    transcripts: meetingData.transcripts,
    modelConfig: modelConfig,
    isModelConfigLoading: false, // ConfigContext loads on mount
    selectedTemplate: templates.selectedTemplate,
    onMeetingUpdated,
    updateMeetingTitle: meetingData.updateMeetingTitle,
    setAiSummary: meetingData.setAiSummary,
    onOpenModelSettings: handleOpenModelSettings,
  });

  const copyOperations = useCopyOperations({
    meeting,
    transcripts: meetingData.transcripts,
    meetingTitle: meetingData.meetingTitle,
    aiSummary: meetingData.aiSummary,
    blockNoteSummaryRef: meetingData.blockNoteSummaryRef,
  });

  const meetingOperations = useMeetingOperations({
    meeting,
  });

  const handleExportMarkdown = async () => {
    try {
      const summaryMarkdown = await meetingData.blockNoteSummaryRef.current?.getMarkdown?.() ?? '';
      const transcript = meetingData.transcripts
        .map((segment: { text: string }) => segment.text)
        .join('\n\n');
      const destination = await save({
        defaultPath: `${meetingData.meetingTitle || 'meeting'}.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!destination) return;

      const filePath = destination.toLowerCase().endsWith('.md')
        ? destination
        : `${destination}.md`;
      const content = `# ${meetingData.meetingTitle}\n\n${summaryMarkdown}\n\n## ${t('home.transcriptTab')}\n\n${transcript}`;

      await invoke('save_transcript', { filePath, content });
      toast.success(t('home.exported'));
      Analytics.trackFeatureUsed('meeting_export_markdown');
    } catch (error) {
      console.error('Failed to export markdown:', error);
      toast.error(t('home.exportFailed'), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDeleteMeeting = async () => {
    if (!window.confirm(t('sidebar.deleteConfirmText'))) return;
    await invoke('api_delete_meeting', { meetingId: meeting.id });
    await onMeetingUpdated?.();
    router.push('/');
  };

  // Track page view
  useEffect(() => {
    Analytics.trackPageView('meeting_details');
  }, []);

  // Auto-generate summary when flag is set
  useEffect(() => {
    let cancelled = false;

    const autoGenerate = async () => {
      if (shouldAutoGenerate && meetingData.transcripts.length > 0 && !cancelled) {
        console.log(`🤖 Auto-generating summary with ${modelConfig.provider}/${modelConfig.model}...`);
        await summaryGeneration.handleGenerateSummary('');

        // Notify parent that auto-generation is complete (only if not cancelled)
        if (onAutoGenerateComplete && !cancelled) {
          onAutoGenerateComplete();
        }
      }
    };

    autoGenerate();

    // Cleanup: cancel if component unmounts or meeting changes
    return () => {
      cancelled = true;
    };
  }, [shouldAutoGenerate, meeting.id]); // Re-run if meeting changes

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex h-screen flex-col overflow-hidden bg-white text-[#232220]"
    >
      <header className="shrink-0 border-b border-[#ececea] px-10 pb-0 pt-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#6b6864] hover:bg-[#f7f6f3]"
              aria-label={t('home.back')}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <input
                value={meetingData.meetingTitle}
                onChange={(event) => meetingData.handleTitleChange(event.target.value)}
                onBlur={() => void meetingData.saveAllChanges()}
                className="w-full min-w-[320px] bg-transparent text-2xl font-semibold tracking-[-0.02em] outline-none"
              />
              <p className="mt-1 text-sm text-[#9c9994]">
                {new Intl.DateTimeFormat(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(meeting.created_at))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copyOperations.handleCopySummary()}
              disabled={!meetingData.aiSummary}
              className="flex items-center gap-2 rounded-[10px] border border-[#ececea] bg-[#f7f6f3] px-3 py-2 text-sm font-medium disabled:opacity-40"
            >
              <Copy size={15} />
              {t('home.copy')}
            </button>
            <label className="relative">
              <select
                value={templates.selectedTemplate}
                onChange={(event) => {
                  if (event.target.value === '__show_all__') {
                    setShowAllTemplates(true);
                    return;
                  }
                  const selected = templates.availableTemplates.find(
                    (template) => template.id === event.target.value,
                  );
                  if (selected) templates.handleTemplateSelection(selected.id, selected.name);
                }}
                className="appearance-none rounded-[10px] border border-[#ececea] bg-[#f7f6f3] py-2 pl-3 pr-8 text-sm font-medium outline-none"
              >
                {visibleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
                {!showAllTemplates &&
                  visibleTemplates.length < templates.availableTemplates.length && (
                    <option value="__show_all__">{t('home.templateShowAll')}</option>
                  )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5" size={14} />
            </label>
            <button
              type="button"
              onClick={() => void summaryGeneration.handleRegenerateSummary()}
              disabled={!meetingData.aiSummary}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ececea] bg-[#f7f6f3] disabled:opacity-40"
              aria-label={t('home.regenerate')}
            >
              <RefreshCw size={15} />
            </button>
            <details className="relative">
              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-[#ececea] bg-[#f7f6f3]">
                <MoreHorizontal size={17} />
              </summary>
              <div className="absolute right-0 top-11 z-20 min-w-[210px] rounded-[10px] border border-[#e4e2dd] bg-white p-1.5 shadow-xl">
                <button onClick={() => void meetingOperations.handleOpenMeetingFolder()} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f7f6f3]">{t('home.openFolder')}</button>
                <button onClick={() => setShowRetranscribe(true)} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f7f6f3]">{t('home.refineTranscript')}</button>
                <button onClick={() => void handleExportMarkdown()} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f7f6f3]">{t('home.exportMarkdown')}</button>
                <button onClick={() => void handleDeleteMeeting()} className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">{t('home.delete')}</button>
              </div>
            </details>
          </div>
        </div>

        <nav className="mt-6 flex gap-6">
          {(['note', 'transcript'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-3 text-sm font-semibold ${
                activeTab === tab
                  ? 'border-[#e0402d] text-[#232220]'
                  : 'border-transparent text-[#9c9994]'
              }`}
            >
              {tab === 'note' ? t('home.noteTab') : t('home.transcriptTab')}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {activeTab === 'transcript' ? (
          <TranscriptPanel
            transcripts={meetingData.transcripts}
            customPrompt={customPrompt}
            onPromptChange={setCustomPrompt}
            onCopyTranscript={copyOperations.handleCopyTranscript}
            onOpenMeetingFolder={meetingOperations.handleOpenMeetingFolder}
            isRecording={isRecording}
            disableAutoScroll={true}
            usePagination={true}
            segments={segments}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            totalCount={totalCount}
            loadedCount={loadedCount}
            onLoadMore={onLoadMore}
            meetingId={meeting.id}
            meetingFolderPath={meeting.folder_path}
            onRefetchTranscripts={onRefetchTranscripts}
            documentMode
            focusTimestamp={quoteTimestamp}
          />
        ) : <SummaryPanel
          meeting={meeting}
          meetingTitle={meetingData.meetingTitle}
          onTitleChange={meetingData.handleTitleChange}
          isEditingTitle={meetingData.isEditingTitle}
          onStartEditTitle={() => meetingData.setIsEditingTitle(true)}
          onFinishEditTitle={() => meetingData.setIsEditingTitle(false)}
          isTitleDirty={meetingData.isTitleDirty}
          summaryRef={meetingData.blockNoteSummaryRef}
          isSaving={meetingData.isSaving}
          onSaveAll={meetingData.saveAllChanges}
          onCopySummary={copyOperations.handleCopySummary}
          onOpenFolder={meetingOperations.handleOpenMeetingFolder}
          aiSummary={meetingData.aiSummary}
          summaryStatus={summaryGeneration.summaryStatus}
          transcripts={meetingData.transcripts}
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSaveModelConfig={handleSaveModelConfig}
          onGenerateSummary={summaryGeneration.handleGenerateSummary}
          onStopGeneration={summaryGeneration.handleStopGeneration}
          customPrompt={customPrompt}
          summaryResponse={summaryResponse}
          onSaveSummary={meetingData.handleSaveSummary}
          onSummaryChange={meetingData.handleSummaryChange}
          onDirtyChange={meetingData.setIsSummaryDirty}
          summaryError={summaryGeneration.summaryError}
          onRegenerateSummary={summaryGeneration.handleRegenerateSummary}
          getSummaryStatusMessage={summaryGeneration.getSummaryStatusMessage}
          availableTemplates={templates.availableTemplates}
          selectedTemplate={templates.selectedTemplate}
          onTemplateSelect={templates.handleTemplateSelection}
          isModelConfigLoading={false}
          onOpenModelSettings={handleRegisterModalOpen}
          documentMode
        />}
      </div>
      <MeetingChat
        meetingId={meeting.id}
        context={async () => {
          const summary = await meetingData.blockNoteSummaryRef.current?.getMarkdown?.() ?? '';
          const transcript = meetingData.transcripts
            .map((segment: { audio_start_time?: number; text: string }) => {
              const seconds = Math.max(0, Math.floor(segment.audio_start_time ?? 0));
              return `[${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}] ${segment.text}`;
            })
            .join('\n');
          return `ЗАМЕТКА:\n${summary}\n\nТРАНСКРИПТ:\n${transcript}`;
        }}
        onEdit={async (summary) => {
          await meetingData.handleSaveSummary({ markdown: summary });
          meetingData.setAiSummary({ markdown: summary } as unknown as Summary);
        }}
        onQuote={(time) => {
          const [minutes, seconds] = time.split(':').map(Number);
          setQuoteTimestamp((Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0));
          setActiveTab('transcript');
          window.setTimeout(() => setQuoteTimestamp(null), 2500);
        }}
      />
      {meeting.folder_path && (
        <RetranscribeDialog
          open={showRetranscribe}
          onOpenChange={setShowRetranscribe}
          meetingId={meeting.id}
          meetingFolderPath={meeting.folder_path}
          onComplete={onRefetchTranscripts}
        />
      )}
    </motion.div>
  );
}
