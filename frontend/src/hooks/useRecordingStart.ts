import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { useTranscripts } from '@/contexts/TranscriptContext';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useConfig } from '@/contexts/ConfigContext';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { recordingService } from '@/services/recordingService';
import Analytics from '@/lib/analytics';
import { showRecordingNotification } from '@/lib/recordingNotification';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/contexts/I18nContext';
import { openCheckout } from '@/lib/authClient';
import {
  getTrialMeetingsStartedToday,
  markTrialMeetingStarted,
  TRIAL_DAILY_MEETING_LIMIT,
} from '@/lib/trialUsage';
import { toast } from 'sonner';

interface UseRecordingStartReturn {
  handleRecordingStart: () => Promise<void>;
  isAutoStarting: boolean;
}

type StartSource = 'home_page' | 'sidebar_auto' | 'sidebar_direct';

// Readiness queries should answer in moments; a hang here means the native side
// is stuck and the UI must recover instead of staying silently dead.
const READINESS_TIMEOUT_MS = 15_000;
// Recording start includes model load (CPU whisper can be slow on weak machines),
// so give it more room before declaring failure.
const START_TIMEOUT_MS = 60_000;

class TimeoutError extends Error {
  constructor(what: string) {
    super(`${what} timed out`);
    this.name = 'TimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(what)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function hideMeetingPillAfterRejectedStart() {
  void emit('pill-hide').catch((error) => {
    console.error('Failed to hide meeting pill after rejected recording start:', error);
  });
}

/**
 * Custom hook for managing recording start lifecycle.
 * Handles both manual start (button click) and auto-start (from sidebar navigation).
 *
 * Features:
 * - Provider-aware readiness check (parakeet / localWhisper / cloud)
 * - Timeouts: a hung native call resets the UI with an error toast instead of a dead button
 * - Meeting title generation (format: Meeting DD_MM_YY_HH_MM_SS)
 * - Transcript clearing on start
 * - Analytics tracking
 * - Recording notification display
 * - Auto-start from sidebar via sessionStorage flag
 */
export function useRecordingStart(
  isRecording: boolean,
  setIsRecording: (value: boolean) => void,
  showModal?: (name: 'modelSelector', message?: string) => void
): UseRecordingStartReturn {
  const [isAutoStarting, setIsAutoStarting] = useState(false);

  const { clearTranscripts, setMeetingTitle } = useTranscripts();
  const { setIsMeetingActive } = useSidebar();
  const { selectedDevices, transcriptModelConfig } = useConfig();
  const { setStatus } = useRecordingState();
  const { me } = useAuth();
  const t = useT();
  const isNoCardTrial = me?.status === 'trialing' && !me?.managedByPolar;

  // Generate meeting title with timestamp
  const generateMeetingTitle = useCallback(() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `Meeting ${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;
  }, []);

  // Provider-aware: check that the ACTIVE transcription engine has a model.
  // Previously this always asked Parakeet, so with localWhisper selected the gate
  // passed/failed on the wrong engine.
  const checkTranscriptionReady = useCallback(async (): Promise<boolean> => {
    const provider = transcriptModelConfig?.provider || 'parakeet';
    if (provider === 'localWhisper') {
      return await invoke<boolean>('whisper_has_available_models');
    }
    if (provider === 'parakeet') {
      await invoke('parakeet_init');
      return await invoke<boolean>('parakeet_has_available_models');
    }
    // Cloud providers: nothing to download locally; the backend validates at start.
    return true;
  }, [transcriptModelConfig?.provider]);

  // Check if any model is currently downloading (parakeet or whisper)
  const checkIfModelDownloading = useCallback(async (): Promise<boolean> => {
    try {
      const provider = transcriptModelConfig?.provider || 'parakeet';
      const command =
        provider === 'localWhisper' ? 'whisper_get_available_models' : 'parakeet_get_available_models';
      const models = await invoke<any[]>(command);
      const isDownloading = models.some(m =>
        m.status && (
          typeof m.status === 'object'
            ? 'Downloading' in m.status
            : m.status === 'Downloading'
        )
      );
      return isDownloading;
    } catch (error) {
      console.error('Failed to check model download status:', error);
      return false; // Default to not downloading (will show error + modal)
    }
  }, [transcriptModelConfig?.provider]);

  const ensureTrialCanRecord = useCallback(async (source: StartSource): Promise<boolean> => {
    if (!isNoCardTrial) return true;

    const meetingsToday = await getTrialMeetingsStartedToday();
    if (meetingsToday < TRIAL_DAILY_MEETING_LIMIT) return true;

    toast.error(t('recording.trialLimitTitle'), {
      description: t('recording.trialLimitDesc', { limit: TRIAL_DAILY_MEETING_LIMIT }),
      duration: 8000,
      action: {
        label: t('pro.upgrade'),
        onClick: () => {
          void openCheckout('trial7').catch((error) => {
            console.error('Failed to open checkout after trial limit:', error);
            toast.error(t('pro.manageError'));
          });
        },
      },
    });
    Analytics.trackButtonClick('start_recording_blocked_trial_limit', source);
    setStatus(RecordingStatus.IDLE);
    return false;
  }, [isNoCardTrial, setStatus, t]);

  // Single start flow shared by all three entry points (button, auto-start, sidebar event)
  const runStartFlow = useCallback(
    async (source: StartSource): Promise<void> => {
      console.log(`Recording start requested (${source}) - checking transcription model status`);

      if (!(await ensureTrialCanRecord(source))) {
        hideMeetingPillAfterRejectedStart();
        return;
      }

      let ready = false;
      try {
        ready = await withTimeout(
          checkTranscriptionReady(),
          READINESS_TIMEOUT_MS,
          'Transcription readiness check'
        );
      } catch (error) {
        console.error('Failed to check transcription readiness:', error);
        ready = false;
      }

      if (!ready) {
        const isDownloading = await checkIfModelDownloading();
        if (isDownloading) {
          toast.info('Model download in progress', {
            description: 'Please wait for the transcription model to finish downloading before recording.',
            duration: 5000,
          });
          Analytics.trackButtonClick('start_recording_blocked_downloading', source);
        } else {
          toast.error('Transcription model not ready', {
            description: 'Please download a transcription model before recording.',
            duration: 5000,
          });
          showModal?.('modelSelector', 'Transcription model setup required');
          Analytics.trackButtonClick('start_recording_blocked_missing', source);
        }
        setStatus(RecordingStatus.IDLE);
        hideMeetingPillAfterRejectedStart();
        return;
      }

      const meetingTitle = generateMeetingTitle();

      // Set STARTING status before initiating backend recording
      setStatus(RecordingStatus.STARTING, 'Initializing recording...');

      try {
        console.log('Starting backend recording with meeting:', meetingTitle);
        await withTimeout(
          recordingService.startRecordingWithDevices(
            selectedDevices?.micDevice || null,
            selectedDevices?.systemDevice || null,
            meetingTitle
          ),
          START_TIMEOUT_MS,
          'Recording start'
        );
        console.log('Backend recording started successfully');

        // Update UI state after successful backend start
        // Note: RECORDING status will be set by RecordingStateContext event listener
        setMeetingTitle(meetingTitle);
        setIsRecording(true); // This will also update the sidebar via the useEffect
        clearTranscripts(); // Clear previous transcripts when starting new recording
        setIsMeetingActive(true);
        if (isNoCardTrial) {
          await markTrialMeetingStarted();
        }
        Analytics.trackButtonClick('start_recording', source);

        // Show recording notification if enabled
        await showRecordingNotification();
      } catch (error) {
        console.error(`Failed to start recording (${source}):`, error);
        const message = error instanceof Error ? error.message : 'Failed to start recording';
        setStatus(RecordingStatus.ERROR, message);
        setIsRecording(false); // Reset state on error
        toast.error('Failed to start recording', {
          description: message,
          duration: 7000,
        });
        hideMeetingPillAfterRejectedStart();
        Analytics.trackButtonClick('start_recording_error', source);
        throw error;
      }
    },
    [
      checkTranscriptionReady,
      checkIfModelDownloading,
      generateMeetingTitle,
      selectedDevices,
      setMeetingTitle,
      setIsRecording,
      clearTranscripts,
      setIsMeetingActive,
      showModal,
      setStatus,
      ensureTrialCanRecord,
      isNoCardTrial,
    ]
  );

  // Handle manual recording start (from button click)
  const handleRecordingStart = useCallback(async () => {
    // Re-throw so RecordingControls can handle device-specific errors
    await runStartFlow('home_page');
  }, [runStartFlow]);

  // Keep the latest start logic and live state in refs so the mount-once
  // listeners below never capture stale values and never need to re-register.
  // Re-registering on every render/dep-change opened a window where a
  // synchronously-dispatched sidebar event could land between removeEventListener
  // and addEventListener and be lost — the "first click does nothing" bug.
  const runStartFlowRef = useRef(runStartFlow);
  const isRecordingRef = useRef(isRecording);
  const isAutoStartingRef = useRef(isAutoStarting);
  runStartFlowRef.current = runStartFlow;
  isRecordingRef.current = isRecording;
  isAutoStartingRef.current = isAutoStarting;

  // Single guarded entry point for both the flag path and the event path.
  const triggerAutoStart = useCallback(async (source: 'sidebar_auto' | 'sidebar_direct') => {
    if (isRecordingRef.current || isAutoStartingRef.current) {
      console.log('Recording already starting/in progress, ignoring trigger:', source);
      return;
    }
    setIsAutoStarting(true);
    isAutoStartingRef.current = true; // guard concurrent triggers before React re-renders
    try {
      await runStartFlowRef.current(source);
    } catch {
      // Error already surfaced via status + toast inside runStartFlow
    } finally {
      setIsAutoStarting(false);
      isAutoStartingRef.current = false;
    }
  }, []);

  // Consume the autoStartRecording flag: on mount (covers navigation to home and
  // events dispatched before this listener existed) and whenever the window
  // regains focus/visibility (covers a flag set while home was still mounting).
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const consumeFlag = () => {
      if (sessionStorage.getItem('autoStartRecording') === 'true') {
        sessionStorage.removeItem('autoStartRecording'); // clear before starting
        console.log('Auto-starting recording from flag...');
        void triggerAutoStart('sidebar_auto');
      }
    };

    // Read on mount.
    consumeFlag();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') consumeFlag();
    };
    window.addEventListener('focus', consumeFlag);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('focus', consumeFlag);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [triggerAutoStart]);

  // Listen for the direct sidebar/tray event (acceleration when already on home).
  // Registered exactly once (triggerAutoStart is stable) so there is no
  // remove/add gap for a synchronous dispatch to slip through.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleDirectStart = () => {
      // The event is an accelerator; the flag may still be set by the sidebar.
      // Clear it so the focus/visibility path doesn't double-fire.
      sessionStorage.removeItem('autoStartRecording');
      void triggerAutoStart('sidebar_direct');
    };

    window.addEventListener('start-recording-from-sidebar', handleDirectStart);
    return () => {
      window.removeEventListener('start-recording-from-sidebar', handleDirectStart);
    };
  }, [triggerAutoStart]);

  return {
    handleRecordingStart,
    isAutoStarting,
  };
}
