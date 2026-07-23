'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { TranscriptModelProps } from '@/components/TranscriptSettings';
import { SelectedDevices } from '@/components/DeviceSelection';
import { configService, ModelConfig } from '@/services/configService';
import { invoke } from '@tauri-apps/api/core';
import Analytics from '@/lib/analytics';
import { BetaFeatures, BetaFeatureKey, loadBetaFeatures, saveBetaFeatures } from '@/types/betaFeatures';
import { DEFAULT_WHISPER_MODEL, DEFAULT_PARAKEET_MODEL, localeNeedsWhisper, isWindowsPlatform } from '@/constants/modelDefaults';
import { areLocalModelAutoDownloadsEnabled } from '@/config/localModels';
import {
  DEFAULT_SUMMARY_MODEL_CONFIG,
  isLegacyLocalSummaryProvider,
  normalizeCloudOnlySummaryConfig,
} from '@/config/summaryDefaults';

export interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}

export interface StorageLocations {
  database: string;
  models: string;
  recordings: string;
}

export interface NotificationSettings {
  recording_notifications: boolean;
  time_based_reminders: boolean;
  meeting_reminders: boolean;
  respect_do_not_disturb: boolean;
  notification_sound: boolean;
  system_permission_granted: boolean;
  consent_given: boolean;
  manual_dnd_mode: boolean;
  notification_preferences: {
    show_recording_started: boolean;
    show_recording_stopped: boolean;
    show_recording_paused: boolean;
    show_recording_resumed: boolean;
    show_transcription_complete: boolean;
    show_meeting_reminders: boolean;
    show_system_errors: boolean;
    meeting_reminder_minutes: number[];
  };
}

interface ConfigContextType {
  // Model configuration
  modelConfig: ModelConfig;
  setModelConfig: (config: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;

  // Transcript model configuration
  transcriptModelConfig: TranscriptModelProps;
  setTranscriptModelConfig: (config: TranscriptModelProps | ((prev: TranscriptModelProps) => TranscriptModelProps)) => void;

  // Device configuration
  selectedDevices: SelectedDevices;
  setSelectedDevices: (devices: SelectedDevices) => void;

  // Language preference
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;

  // UI preferences
  showConfidenceIndicator: boolean;
  toggleConfidenceIndicator: (checked: boolean) => void;

  // Beta features
  betaFeatures: BetaFeatures;
  toggleBetaFeature: (featureKey: BetaFeatureKey, enabled: boolean) => void;

  // Ollama models
  models: OllamaModel[];
  modelOptions: Record<ModelConfig['provider'], string[]>;
  error: string;

  // Summary configuration
  isAutoSummary: boolean;
  toggleIsAutoSummary: (checked: boolean) => void;

  // Provider-specific API keys
  providerApiKeys: {
    claude: string | null;
    groq: string | null;
    openai: string | null;
    openrouter: string | null;
  };
  updateProviderApiKey: (provider: string, apiKey: string | null) => void;

  // Preference settings (lazy loaded)
  notificationSettings: NotificationSettings | null;
  storageLocations: StorageLocations | null;
  isLoadingPreferences: boolean;
  loadPreferences: () => Promise<void>;
  updateNotificationSettings: (settings: NotificationSettings) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);


export function ConfigProvider({ children }: { children: ReactNode }) {
  // Model configuration state
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_SUMMARY_MODEL_CONFIG);

  // Transcript model configuration state
  const [transcriptModelConfig, setTranscriptModelConfig] = useState<TranscriptModelProps>({
    provider: 'parakeet',
    model: 'parakeet-tdt-0.6b-v3-int8',
    apiKey: null
  });

  // Provider-specific API keys (loaded once at startup)
  // Additional providers can be added here when UI support is ready.
  const [providerApiKeys, setProviderApiKeys] = useState<{
    claude: string | null;
    groq: string | null;
    openai: string | null;
    openrouter: string | null;
  }>({
    claude: null,
    groq: null,
    openai: null,
    openrouter: null,
  });

  // Ollama models list and error state
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string>('');

  // Device configuration state
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevices>({
    micDevice: null,
    systemDevice: null
  });

  // Language preference state
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('primaryLanguage');
      if (saved) return saved;
      return 'auto';
    }
    return 'auto';
  });

  // UI preferences state
  const [showConfidenceIndicator, setShowConfidenceIndicator] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showConfidenceIndicator');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Summary configs
  const [isAutoSummary, setisAutoSummary] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('isAutoSummary');
      return saved !== null ? saved === 'true' : false
    }
    return false;
  });

  // Beta features state (localStorage)
  const [betaFeatures, setBetaFeatures] = useState<BetaFeatures>(() => {
    return loadBetaFeatures();
  });

  // Preference settings state (lazy loaded)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [storageLocations, setStorageLocations] = useState<StorageLocations | null>(null);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const preferencesLoadedRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Load Ollama models (uses saved endpoint, re-runs when endpoint changes after config load)
  useEffect(() => {
    const loadModels = async () => {
      if (modelConfig.provider !== 'ollama') {
        setModels([]);
        setError('');
        return;
      }

      try {
        const endpoint = modelConfig.ollamaEndpoint || null;
        const modelList = await invoke<OllamaModel[]>('get_ollama_models', { endpoint });
        setModels(modelList);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Ollama models');
        console.error('Error loading models:', err);
      }
    };
    loadModels();
  }, [modelConfig.provider, modelConfig.ollamaEndpoint]);

  // Load transcript configuration on mount
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        const config = await configService.getTranscriptConfig();
        if (config) {
          console.log('[ConfigContext] Loaded saved transcript config:', config);
          setTranscriptModelConfig({
            provider: config.provider || 'parakeet',
            model: config.model || 'parakeet-tdt-0.6b-v3-int8',
            apiKey: config.apiKey || null
          });
        }
      } catch (error) {
        console.error('[ConfigContext] Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, []);

  // Hybrid transcription for Russian/Kazakh locales: select / upgrade the local Whisper model to
  // DEFAULT_WHISPER_MODEL while keeping the spoken-language preference on "auto" unless the user
  // explicitly picked a language. OS/app locale is not the meeting language; mixed RU/EN/KK
  // meetings need Whisper auto-detection to stay available.
  // Kazakh needs Whisper, and Russian on macOS benefits from Metal-backed Whisper large-v3. We move
  // to Whisper once its model is actually downloaded; until then Parakeet (or an older Whisper
  // model) keeps recording working. We never override a deliberate non-Whisper provider choice. The
  // model marker is keyed by model name, so bumping DEFAULT_WHISPER_MODEL migrates existing users
  // exactly once.
  //
  // The effect runs once on mount. If the model still has to be downloaded we AWAIT the download
  // command (whisper_download_model resolves only when the file is fully on disk, per the Rust
  // command) and then apply the switch, so the config flips without an app restart. Users keep the
  // app open for days, so a "retry next launch" approach left them stuck on the old (slow) model.
  useEffect(() => {
    let cancelled = false;

    // Wait for any in-flight recording to stop before writing the transcript config. Rust reads the
    // transcript config at recording start, so writing between recordings is safe; writing mid-record
    // could take effect only on the next start anyway, so we just defer to be clean.
    const waitUntilNotRecording = async (): Promise<void> => {
      const recording = await invoke<boolean>('is_recording').catch(() => false);
      if (!recording) return;
      const { listen } = await import('@tauri-apps/api/event');
      await new Promise<void>((resolve) => {
        let unlisten: (() => void) | undefined;
        listen('recording-stopped', () => {
          unlisten?.();
          resolve();
        }).then((fn) => {
          unlisten = fn;
          // Re-check in case the recording stopped between our check and the listener attaching.
          invoke<boolean>('is_recording').then((stillRecording) => {
            if (!stillRecording) {
              unlisten?.();
              resolve();
            }
          }).catch(() => {});
        });
      });
    };

    // Point the saved transcript config at DEFAULT_WHISPER_MODEL and record the migration marker.
    // Called both on the happy path (model already present) and after a background download lands.
    const applyWhisperModel = async () => {
      if (cancelled) return;
      await waitUntilNotRecording();
      if (cancelled) return;
      await invoke('api_save_transcript_config', {
        provider: 'localWhisper',
        model: DEFAULT_WHISPER_MODEL,
        apiKey: null,
      });
      if (cancelled) return;
      setTranscriptModelConfig({ provider: 'localWhisper', model: DEFAULT_WHISPER_MODEL, apiKey: null });
      localStorage.setItem('siplinx.whisperModelApplied', DEFAULT_WHISPER_MODEL);
      console.log(`[ConfigContext] Hybrid: selected Whisper ${DEFAULT_WHISPER_MODEL} for RU/KK locale`);
    };

    const autoSelectWhisperForLocale = async () => {
      try {
        if (typeof window === 'undefined') return;

        let loc: string | null = null;
        try {
          const { locale } = await import('@tauri-apps/plugin-os');
          loc = await locale();
        } catch {
          loc = typeof navigator !== 'undefined' ? navigator.language : null;
        }
        if (!localeNeedsWhisper(loc)) return;

        if (!areLocalModelAutoDownloadsEnabled()) {
          console.log('[ConfigContext] Local model auto-downloads are disabled; skipping Whisper download');
          return;
        }

        // (2) Model: stop if we've already applied the current default for this install.
        if (localStorage.getItem('siplinx.whisperModelApplied') === DEFAULT_WHISPER_MODEL) return;

        // Respect a deliberate non-Whisper provider (e.g. a cloud API the user configured).
        const current = await configService.getTranscriptConfig().catch(() => null);
        if (current?.provider && current.provider !== 'parakeet' && current.provider !== 'localWhisper') {
          localStorage.setItem('siplinx.whisperModelApplied', DEFAULT_WHISPER_MODEL);
          return;
        }

        // Inspect the desired model's current status.
        const statusOf = async (): Promise<unknown> => {
          const models = await invoke<Array<{ name: string; status: unknown }>>('whisper_get_available_models').catch(() => []);
          return models.find((m) => m.name === DEFAULT_WHISPER_MODEL)?.status;
        };

        const status = await statusOf();
        const isAvailable = status === 'Available';
        // Rust encodes an in-progress download as { Downloading: <percent> } (see ModelStatus).
        const isDownloading = typeof status === 'object' && status !== null && 'Downloading' in (status as object);

        if (isAvailable) {
          await applyWhisperModel();
          return;
        }

        // Not available yet. Trigger the download and AWAIT it so we can flip the config the moment
        // it finishes: no app restart needed. The kick marker only prevents *this* mount from firing a
        // duplicate invoke; it is not a permanent "gave up" flag. We clear it on completion or failure
        // so a partially downloaded / aborted model is retried on the next launch. We also skip the
        // kick if Rust already reports the model as Downloading (e.g. kicked by the models UI), and
        // instead just poll for completion, since whisper_download_model rejects concurrent downloads.
        const kickKey = `siplinx.whisperDownloadKicked.${DEFAULT_WHISPER_MODEL}`;

        try {
          if (!isDownloading) {
            localStorage.setItem(kickKey, '1');
            console.log(`[ConfigContext] Hybrid: downloading ${DEFAULT_WHISPER_MODEL} in background`);
            // Resolves only when the file is fully written to disk (Rust command awaits the download).
            await invoke('whisper_download_model', { modelName: DEFAULT_WHISPER_MODEL });
          } else {
            // A download is already running elsewhere; wait for it to finish by polling status.
            console.log(`[ConfigContext] Hybrid: ${DEFAULT_WHISPER_MODEL} already downloading, awaiting completion`);
            for (;;) {
              if (cancelled) return;
              await new Promise((r) => setTimeout(r, 5000));
              const s = await statusOf();
              if (s === 'Available') break;
              const stillDownloading = typeof s === 'object' && s !== null && 'Downloading' in (s as object);
              if (!stillDownloading) throw new Error('download no longer in progress and model not available');
            }
          }

          if (cancelled) return;

          // Re-verify the model actually landed before switching (guards against a resolve without a
          // usable file, e.g. a corrupted download).
          if ((await statusOf()) !== 'Available') {
            localStorage.removeItem(kickKey);
            console.warn(`[ConfigContext] Hybrid: ${DEFAULT_WHISPER_MODEL} download finished but model not Available; will retry next launch`);
            return;
          }

          await applyWhisperModel();
          localStorage.removeItem(kickKey);
        } catch (err) {
          // Clear the kick marker so the (possibly partial) download is retried next launch.
          localStorage.removeItem(kickKey);
          console.error('[ConfigContext] Whisper model download failed:', err);
        }
      } catch (e) {
        console.warn('[ConfigContext] Hybrid Whisper auto-select skipped:', e);
      }
    };
    autoSelectWhisperForLocale();

    return () => {
      cancelled = true;
    };
  }, []);

  // Reverse hybrid migration for Russian on Windows: move OFF Whisper back to Parakeet v3.
  // On Windows the GPU is forced off, so Whisper runs on CPU where only base-q5_1 keeps up — and
  // base is unusable on Russian. Parakeet v3 is multilingual, real-time on CPU, and coherent on RU
  // (validated on i7-10510U: RTF ~0.3, readable transcript). We only migrate users that landed on
  // localWhisper via the auto-hybrid default (marked by siplinx.whisperModelApplied); a deliberate
  // provider choice (cloud API, or a manual Whisper pick) is never overridden. Kazakh is untouched
  // (Parakeet v3 has no Kazakh) and macOS is untouched (Metal Whisper large-v3 is better there).
  useEffect(() => {
    let cancelled = false;

    const waitUntilNotRecording = async (): Promise<void> => {
      const recording = await invoke<boolean>('is_recording').catch(() => false);
      if (!recording) return;
      const { listen } = await import('@tauri-apps/api/event');
      await new Promise<void>((resolve) => {
        let unlisten: (() => void) | undefined;
        listen('recording-stopped', () => {
          unlisten?.();
          resolve();
        }).then((fn) => {
          unlisten = fn;
          invoke<boolean>('is_recording').then((stillRecording) => {
            if (!stillRecording) {
              unlisten?.();
              resolve();
            }
          }).catch(() => {});
        });
      });
    };

    // Point the saved transcript config at Parakeet and record the migration marker.
    const applyParakeet = async () => {
      if (cancelled) return;
      await waitUntilNotRecording();
      if (cancelled) return;
      await invoke('api_save_transcript_config', {
        provider: 'parakeet',
        model: DEFAULT_PARAKEET_MODEL,
        apiKey: null,
      });
      if (cancelled) return;
      setTranscriptModelConfig({ provider: 'parakeet', model: DEFAULT_PARAKEET_MODEL, apiKey: null });
      localStorage.setItem('siplinx.transcriptProviderApplied', 'parakeet');
      console.log(`[ConfigContext] Hybrid: selected Parakeet ${DEFAULT_PARAKEET_MODEL} for RU on Windows`);
    };

    const autoSelectParakeetForRussianWindows = async () => {
      try {
        if (typeof window === 'undefined') return;
        if (!isWindowsPlatform()) return;

        let loc: string | null = null;
        try {
          const { locale } = await import('@tauri-apps/plugin-os');
          loc = await locale();
        } catch {
          loc = typeof navigator !== 'undefined' ? navigator.language : null;
        }
        if (!(loc ?? '').toLowerCase().startsWith('ru')) return;

        if (!areLocalModelAutoDownloadsEnabled()) {
          console.log('[ConfigContext] Local model auto-downloads are disabled; skipping Parakeet download');
          return;
        }

        // (2) Provider: stop if we've already migrated this install.
        if (localStorage.getItem('siplinx.transcriptProviderApplied') === 'parakeet') return;

        const current = await configService.getTranscriptConfig().catch(() => null);
        const provider = current?.provider;

        // Already on Parakeet (fresh installs default here): nothing to do, just mark done.
        if (provider === 'parakeet') {
          localStorage.setItem('siplinx.transcriptProviderApplied', 'parakeet');
          return;
        }

        // Only migrate an auto-default localWhisper. A localWhisper set by our hybrid logic carries
        // the siplinx.whisperModelApplied marker; without it, treat localWhisper as a manual choice.
        const whisperWasAuto = !!localStorage.getItem('siplinx.whisperModelApplied');
        const isAutoDefaultWhisper = provider === 'localWhisper' && whisperWasAuto;
        const isUnset = !provider;

        if (!isAutoDefaultWhisper && !isUnset) {
          // Deliberate provider choice (cloud API, or manual Whisper). Respect it, mark done.
          localStorage.setItem('siplinx.transcriptProviderApplied', 'parakeet');
          return;
        }

        // Ensure the Parakeet engine + model are ready before switching.
        await invoke('parakeet_init').catch(() => {});

        const statusOf = async (): Promise<unknown> => {
          const models = await invoke<Array<{ name: string; status: unknown }>>('parakeet_get_available_models').catch(() => []);
          return models.find((m) => m.name === DEFAULT_PARAKEET_MODEL)?.status;
        };

        const status = await statusOf();
        const isAvailable = status === 'Available';
        const isDownloading = typeof status === 'object' && status !== null && 'Downloading' in (status as object);

        if (isAvailable) {
          await applyParakeet();
          return;
        }

        // Model not on disk yet (rare: it's pulled at onboarding). Download and AWAIT it, then flip
        // the config without an app restart, mirroring the Whisper hybrid path.
        const kickKey = `siplinx.parakeetDownloadKicked.${DEFAULT_PARAKEET_MODEL}`;
        try {
          if (!isDownloading) {
            localStorage.setItem(kickKey, '1');
            console.log(`[ConfigContext] Hybrid: downloading ${DEFAULT_PARAKEET_MODEL} in background`);
            await invoke('parakeet_download_model', { modelName: DEFAULT_PARAKEET_MODEL });
          } else {
            console.log(`[ConfigContext] Hybrid: ${DEFAULT_PARAKEET_MODEL} already downloading, awaiting completion`);
            for (;;) {
              if (cancelled) return;
              await new Promise((r) => setTimeout(r, 5000));
              const s = await statusOf();
              if (s === 'Available') break;
              const stillDownloading = typeof s === 'object' && s !== null && 'Downloading' in (s as object);
              if (!stillDownloading) throw new Error('download no longer in progress and model not available');
            }
          }

          if (cancelled) return;

          if ((await statusOf()) !== 'Available') {
            localStorage.removeItem(kickKey);
            console.warn(`[ConfigContext] Hybrid: ${DEFAULT_PARAKEET_MODEL} download finished but model not Available; will retry next launch`);
            return;
          }

          await applyParakeet();
          localStorage.removeItem(kickKey);
        } catch (err) {
          localStorage.removeItem(kickKey);
          console.error('[ConfigContext] Parakeet model download failed:', err);
        }
      } catch (e) {
        console.warn('[ConfigContext] Hybrid Parakeet auto-select skipped:', e);
      }
    };
    autoSelectParakeetForRussianWindows();

    return () => {
      cancelled = true;
    };
  }, []);

  // Sync language preference to Rust on mount (fixes startup desync bug)
  useEffect(() => {
    if (selectedLanguage) {
      invoke('set_language_preference', { language: selectedLanguage })
        .then(() => {
          console.log('[ConfigContext] Synced language preference to Rust on startup:', selectedLanguage);
        })
        .catch(err => {
          console.error('[ConfigContext] Failed to sync language preference to Rust on startup:', err);
        });
    }
  }, []); 

  // Load model configuration on mount
  useEffect(() => {
    const fetchModelConfig = async () => {
      try {
        const data = await configService.getModelConfig();
        if (data && data.provider) {
          if (isLegacyLocalSummaryProvider(data.provider) || data.provider === 'siplinx-cloud') {
            const normalized = normalizeCloudOnlySummaryConfig(data);
            const shouldPersist =
              normalized.provider !== data.provider ||
              normalized.model !== data.model ||
              normalized.ollamaEndpoint !== data.ollamaEndpoint;

            if (shouldPersist) {
              await invoke('api_save_model_config', {
                provider: normalized.provider,
                model: normalized.model,
                whisperModel: normalized.whisperModel,
                apiKey: null,
                ollamaEndpoint: normalized.ollamaEndpoint,
              });
              console.log('[ConfigContext] Migrated local summary config to Siplinx Cloud:', normalized);
            }

            setModelConfig(prev => ({
              ...prev,
              ...normalized,
            }));

            const map = JSON.parse(localStorage.getItem('providerModelMap') || '{}');
            map[normalized.provider] = normalized.model;
            localStorage.setItem('providerModelMap', JSON.stringify(map));
            return;
          }

          // If provider is custom-openai, fetch the additional config
          if (data.provider === 'custom-openai') {
            try {
              const customConfig = await configService.getCustomOpenAIConfig();
              if (customConfig) {
                // Merge custom config fields into modelConfig
                console.log('[ConfigContext] Loading custom OpenAI config:', {
                  endpoint: customConfig.endpoint,
                  model: customConfig.model,
                });
                const resolvedModel = customConfig.model || data.model || '';
                setModelConfig(prev => ({
                  ...prev,
                  provider: data.provider,
                  model: resolvedModel || prev.model,
                  whisperModel: data.whisperModel || prev.whisperModel,
                  customOpenAIEndpoint: customConfig.endpoint,
                  customOpenAIModel: customConfig.model,
                  customOpenAIApiKey: customConfig.apiKey,
                  maxTokens: customConfig.maxTokens,
                  temperature: customConfig.temperature,
                  topP: customConfig.topP,
                }));

                // Seed per-provider model cache from DB
                if (resolvedModel) {
                  const map = JSON.parse(localStorage.getItem('providerModelMap') || '{}');
                  map[data.provider] = resolvedModel;
                  localStorage.setItem('providerModelMap', JSON.stringify(map));
                }

                return; // Early return
              }
            } catch (err) {
              console.error('[ConfigContext] Failed to fetch custom OpenAI config:', err);
            }
          }

          // For non-custom-openai providers, just set base config
          setModelConfig(prev => ({
            ...prev,
            provider: data.provider,
            model: data.model || prev.model,
            whisperModel: data.whisperModel || prev.whisperModel,
            ollamaEndpoint: data.ollamaEndpoint,
          }));

          // Seed per-provider model cache from DB
          if (data.model) {
            const map = JSON.parse(localStorage.getItem('providerModelMap') || '{}');
            map[data.provider] = data.model;
            localStorage.setItem('providerModelMap', JSON.stringify(map));
          }
        }
      } catch (error) {
        console.error('Failed to fetch saved model config in ConfigContext:', error);
      }
    };
    fetchModelConfig();
  }, []);

  // Load all provider API keys on mount
  useEffect(() => {
    const loadAllApiKeys = async () => {
      try {
        const providers = ['claude', 'groq', 'openai', 'openrouter'];
        const keys = await Promise.all(
          providers.map(p =>
            invoke<string>('api_get_api_key', { provider: p })
              .catch(() => null) // Gracefully handle missing keys
          )
        );

        setProviderApiKeys({
          claude: keys[0],
          groq: keys[1],
          openai: keys[2],
          openrouter: keys[3],
        });
        console.log('[ConfigContext] Loaded provider API keys');
      } catch (error) {
        console.error('[ConfigContext] Failed to load provider API keys:', error);
      }
    };

    loadAllApiKeys();
  }, []);

  // Listen for model config updates from other components
  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<ModelConfig>('model-config-updated', (event) => {
        console.log('[ConfigContext] Received model-config-updated event:', event.payload);
        const normalized = normalizeCloudOnlySummaryConfig(event.payload);
        setModelConfig(normalized);

        // Update provider-specific key when config changes
        if (normalized.apiKey && normalized.provider !== 'custom-openai') {
          updateProviderApiKey(normalized.provider, normalized.apiKey);
        }
      });
      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupListener().then(fn => cleanup = fn);

    return () => {
      cleanup?.();
    };
  }, []);

  // Load device preferences on mount
  useEffect(() => {
    const loadDevicePreferences = async () => {
      try {
        const prefs = await configService.getRecordingPreferences();
        if (prefs && (prefs.preferred_mic_device || prefs.preferred_system_device)) {
          setSelectedDevices({
            micDevice: prefs.preferred_mic_device,
            systemDevice: prefs.preferred_system_device
          });
          console.log('Loaded device preferences:', prefs);
        }
      } catch (error) {
        console.log('No device preferences found or failed to load:', error);
      }
    };
    loadDevicePreferences();
  }, []);

  // Calculate model options based on available models
  const modelOptions: Record<ModelConfig['provider'], string[]> = {
    'siplinx-cloud': [DEFAULT_SUMMARY_MODEL_CONFIG.model],
    ollama: models.map(model => model.name),
    claude: ['claude-3-5-sonnet-latest'],
    groq: ['llama-3.3-70b-versatile'],
    openrouter: [],
    openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    'builtin-ai': [],
    'custom-openai': [],
  };

  // Toggle confidence indicator with localStorage persistence
  const toggleConfidenceIndicator = useCallback((checked: boolean) => {
    setShowConfidenceIndicator(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showConfidenceIndicator', checked.toString());
    }
    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('confidenceIndicatorChanged', { detail: checked }));
  }, []);

  const toggleIsAutoSummary = useCallback((checked: boolean) => {
    setisAutoSummary(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('isAutoSummary', checked.toString());
    }
  }, [])

  // Toggle beta feature with localStorage persistence and analytics
  const toggleBetaFeature = useCallback((featureKey: BetaFeatureKey, enabled: boolean) => {
    setBetaFeatures(prev => {
      const updated = { ...prev, [featureKey]: enabled };
      saveBetaFeatures(updated);

      // Track analytics with specific feature
      Analytics.track('beta_feature_toggled', {
        feature: featureKey,
        enabled: enabled.toString(),
      }).catch(err => console.error('Failed to track beta feature toggle:', err));

      return updated;
    });
  }, []);

  // Update individual provider API key
  const updateProviderApiKey = useCallback((provider: string, apiKey: string | null) => {
    setProviderApiKeys(prev => ({ ...prev, [provider]: apiKey }));
  }, []);

  // Lazy load preference settings (only loads if not already cached)
  const loadPreferences = useCallback(async () => {
    // If already loaded, don't reload
    if (preferencesLoadedRef.current) {
      return;
    }

    // If currently loading, don't start another load
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    setIsLoadingPreferences(true);
    try {
      // Load notification settings from backend
      let settings: NotificationSettings | null = null;
      try {
        settings = await invoke<NotificationSettings>('get_notification_settings');
        setNotificationSettings(settings);
      } catch (notifError) {
        console.error('[ConfigContext] Failed to load notification settings:', notifError);
        // Use default values if notification settings fail to load
        setNotificationSettings(null);
      }

      // Load storage locations
      const [dbDir, modelsDir, recordingsDir] = await Promise.all([
        invoke<string>('get_database_directory'),
        invoke<string>('whisper_get_models_directory'),
        invoke<string>('get_default_recordings_folder_path')
      ]);

      setStorageLocations({
        database: dbDir,
        models: modelsDir,
        recordings: recordingsDir
      });

      // Mark as loaded
      preferencesLoadedRef.current = true;
    } catch (error) {
      console.error('[ConfigContext] Failed to load preferences:', error);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingPreferences(false);
    }
  }, []);

  // Update notification settings
  const updateNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    try {
      await invoke('set_notification_settings', { settings });
      setNotificationSettings(settings);
    } catch (error) {
      console.error('[ConfigContext] Failed to update notification settings:', error);
      throw error; // Re-throw so component can handle error
    }
  }, []);

  // Wrapper for setSelectedLanguage that persists to localStorage and syncs to Rust
  const handleSetSelectedLanguage = useCallback((lang: string) => {
    setSelectedLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('primaryLanguage', lang);
    }
    // Sync with Rust in-memory state for live recording
    invoke('set_language_preference', { language: lang }).catch(err =>
      console.error('Failed to sync language preference to Rust:', err)
    );
  }, []);

  const value: ConfigContextType = useMemo(() => ({
    modelConfig,
    setModelConfig,
    isAutoSummary,
    toggleIsAutoSummary,
    providerApiKeys,
    updateProviderApiKey,
    transcriptModelConfig,
    setTranscriptModelConfig,
    selectedDevices,
    setSelectedDevices,
    selectedLanguage,
    setSelectedLanguage: handleSetSelectedLanguage,
    showConfidenceIndicator,
    toggleConfidenceIndicator,
    betaFeatures,
    toggleBetaFeature,
    models,
    modelOptions,
    error,
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings,
  }), [
    modelConfig,
    isAutoSummary,
    toggleIsAutoSummary,
    providerApiKeys,
    updateProviderApiKey,
    transcriptModelConfig,
    selectedDevices,
    selectedLanguage,
    handleSetSelectedLanguage,
    showConfidenceIndicator,
    toggleConfidenceIndicator,
    betaFeatures,
    toggleBetaFeature,
    models,
    modelOptions,
    error,
    notificationSettings,
    storageLocations,
    isLoadingPreferences,
    loadPreferences,
    updateNotificationSettings,
  ]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
