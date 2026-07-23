'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ModelConfig, ModelSettingsModal } from '@/components/ModelSettingsModal';
import { Switch } from './ui/switch';
import { useConfig } from '@/contexts/ConfigContext';
import { useT } from '@/contexts/I18nContext';
import { getCachedMe } from '@/lib/authClient';
import {
  DEFAULT_SUMMARY_MODEL_CONFIG,
  normalizeCloudOnlySummaryConfig,
  summaryProviderRequiresOwnApiKey,
} from '@/config/summaryDefaults';

const CLOUD_SUMMARY_KEY = 'siplinx_cloud_summary_enabled';

interface SummaryModelSettingsProps {
  refetchTrigger?: number; // Change this to trigger refetch
}

export function SummaryModelSettings({ refetchTrigger }: SummaryModelSettingsProps) {
  const t = useT();
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_SUMMARY_MODEL_CONFIG);
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free');
  const [cloudSummaryEnabled, setCloudSummaryEnabled] = useState<boolean>(true);

  const { isAutoSummary, toggleIsAutoSummary } = useConfig();

  // Load user plan and cloud summary preference
  useEffect(() => {
    getCachedMe().then(({ me }) => {
      if (me) setUserPlan(me.plan);
    });
    const stored = localStorage.getItem(CLOUD_SUMMARY_KEY);
    setCloudSummaryEnabled(stored === null ? true : stored === 'true');
  }, []);

  const handleCloudSummaryToggle = (checked: boolean) => {
    setCloudSummaryEnabled(checked);
    localStorage.setItem(CLOUD_SUMMARY_KEY, String(checked));
  };

  // Reusable fetch function
  const fetchModelConfig = useCallback(async () => {
    try {
      const data = await invoke('api_get_model_config') as any;
      if (data && data.provider !== null) {
        const normalized = normalizeCloudOnlySummaryConfig(data);
        // Fetch API key if not included and provider requires it
        if (summaryProviderRequiresOwnApiKey(normalized.provider) && !normalized.apiKey) {
          try {
            const apiKeyData = await invoke('api_get_api_key', {
              provider: normalized.provider
            }) as string;
            normalized.apiKey = apiKeyData;
          } catch (err) {
            console.error('Failed to fetch API key:', err);
          }
        }
        // Fetch Custom OpenAI config if that's the active provider
        if (normalized.provider === 'custom-openai') {
          try {
            const customConfig = (await invoke('api_get_custom_openai_config')) as any;
            if (customConfig) {
              normalized.customOpenAIDisplayName = customConfig.displayName || null;
              normalized.customOpenAIEndpoint = customConfig.endpoint || null;
              normalized.customOpenAIModel = customConfig.model || null;
              normalized.customOpenAIApiKey = customConfig.apiKey || null;
              normalized.maxTokens = customConfig.maxTokens || null;
              normalized.temperature = customConfig.temperature || null;
              normalized.topP = customConfig.topP || null;
              // For custom-openai, model field should match customOpenAIModel
              normalized.model = customConfig.model || normalized.model;
            }
          } catch (err) {
            console.error('Failed to fetch custom OpenAI config:', err);
          }
        }
        setModelConfig(normalized);
      }
    } catch (error) {
      console.error('Failed to fetch model config:', error);
      toast.error(t('settings.toast.modelSettingsLoadFailed'));
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchModelConfig();
  }, [fetchModelConfig]);

  // Refetch when trigger changes (optional external control)
  useEffect(() => {
    if (refetchTrigger !== undefined && refetchTrigger > 0) {
      fetchModelConfig();
    }
  }, [refetchTrigger, fetchModelConfig]);

  // Listen for model config updates from other components
  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<ModelConfig>('model-config-updated', (event) => {
        console.log('SummaryModelSettings received model-config-updated event:', event.payload);
        setModelConfig(normalizeCloudOnlySummaryConfig(event.payload));
      });

      return unlisten;
    };

    let cleanup: (() => void) | undefined;
    setupListener().then(fn => cleanup = fn);

    return () => {
      cleanup?.();
    };
  }, []);

  // Save handler
  const handleSaveModelConfig = async (config: ModelConfig) => {
    try {
      await invoke('api_save_model_config', {
        provider: config.provider,
        model: config.model,
        whisperModel: config.whisperModel,
        apiKey: config.apiKey,
        ollamaEndpoint: config.ollamaEndpoint,
      });

      setModelConfig(config);

      // Emit event to sync other components
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', config);

      toast.success(t('settings.toast.modelSettingsSaved'));
    } catch (error) {
      console.error('Error saving model config:', error);
      toast.error(t('settings.toast.modelSettingsSaveFailed'));
    }
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("settings.autoSummary.title")}</h3>
            <p className="text-sm text-gray-600">{t("settings.autoSummary.description")}</p>
          </div>
          <Switch checked={isAutoSummary} onCheckedChange={toggleIsAutoSummary} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("settings.cloudSummary.title")}</h3>
            <p className="text-sm text-gray-600">
              {userPlan === 'pro'
                ? t("settings.cloudSummary.description")
                : t("settings.cloudSummary.proOnly")}
            </p>
          </div>
          <Switch
            checked={userPlan === 'pro' && cloudSummaryEnabled}
            onCheckedChange={handleCloudSummaryToggle}
            disabled={userPlan !== 'pro'}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{t("settings.summaryModelConfig.title")}</h3>
        <p className="text-sm text-gray-600 mb-6">
          {t("settings.summaryModelConfig.description")}
        </p>

        <ModelSettingsModal
          modelConfig={modelConfig}
          setModelConfig={setModelConfig}
          onSave={handleSaveModelConfig}
          skipInitialFetch={true}
        />
      </div>
    </div>
  );
}
