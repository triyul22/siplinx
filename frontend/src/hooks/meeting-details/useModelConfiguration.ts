import { useState, useEffect, useCallback } from 'react';
import { ModelConfig } from '@/components/ModelSettingsModal';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import {
  DEFAULT_SUMMARY_MODEL_CONFIG,
  normalizeCloudOnlySummaryConfig,
  summaryProviderRequiresOwnApiKey,
} from '@/config/summaryDefaults';

interface UseModelConfigurationProps {
  serverAddress: string | null;
}

export function useModelConfiguration({ serverAddress }: UseModelConfigurationProps) {
  const [modelConfig, setModelConfig] = useState<ModelConfig>(DEFAULT_SUMMARY_MODEL_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string>('');

  // Fetch model configuration on mount and when serverAddress changes
  useEffect(() => {
    const fetchModelConfig = async () => {
      setIsLoading(true);
      try {
        console.log('🔄 Fetching model configuration from database...');
        const data = await invokeTauri('api_get_model_config', {}) as any;
        if (data && data.provider !== null) {
          const normalized = normalizeCloudOnlySummaryConfig(data);
          console.log('✅ Loaded model config from database:', {
            provider: normalized.provider,
            model: normalized.model,
            whisperModel: normalized.whisperModel,
            hasApiKey: !!normalized.apiKey,
            ollamaEndpoint: normalized.ollamaEndpoint || 'default'
          });
          // Fetch API key if not included and provider requires it
          if (summaryProviderRequiresOwnApiKey(normalized.provider) && !normalized.apiKey) {
            try {
              const apiKeyData = await invokeTauri('api_get_api_key', {
                provider: normalized.provider
              }) as string;
              normalized.apiKey = apiKeyData;
            } catch (err) {
              console.error('Failed to fetch API key:', err);
            }
          }

          // Fetch custom OpenAI config if provider is custom-openai
          if (normalized.provider === 'custom-openai') {
            try {
              const customConfig = await invokeTauri('api_get_custom_openai_config') as any;
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
                console.log('✅ Loaded custom OpenAI config:', {
                  displayName: customConfig.displayName,
                  endpoint: customConfig.endpoint,
                  model: customConfig.model,
                });
              }
            } catch (err) {
              console.error('Failed to fetch custom OpenAI config:', err);
            }
          }

          if (normalized.provider !== data.provider || normalized.model !== data.model) {
            await invokeTauri('api_save_model_config', {
              provider: normalized.provider,
              model: normalized.model,
              whisperModel: normalized.whisperModel,
              apiKey: null,
              ollamaEndpoint: normalized.ollamaEndpoint,
            });
          }

          setModelConfig(normalized);
        } else {
          console.warn('⚠️ No model config found in database, using defaults');
          setModelConfig(DEFAULT_SUMMARY_MODEL_CONFIG);
        }
      } catch (error) {
        console.error('❌ Failed to fetch model config:', error);
      } finally {
        setIsLoading(false);
        console.log('✅ Model configuration loading complete');
      }
    };

    fetchModelConfig();
  }, [serverAddress]);

  // Listen for model config updates from other components
  useEffect(() => {
    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<ModelConfig>('model-config-updated', (event) => {
        console.log('Meeting details received model-config-updated event:', event.payload);
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

  // Save model configuration
  const handleSaveModelConfig = useCallback(async (updatedConfig?: ModelConfig) => {
    try {
      const configToSave = updatedConfig || modelConfig;
      const payload = {
        provider: configToSave.provider,
        model: configToSave.model,
        whisperModel: configToSave.whisperModel,
        apiKey: configToSave.apiKey ?? null,
        ollamaEndpoint: configToSave.ollamaEndpoint ?? null
      };
      console.log('Saving model config with payload:', payload);

      // Track model configuration change
      if (updatedConfig && (
        updatedConfig.provider !== modelConfig.provider ||
        updatedConfig.model !== modelConfig.model
      )) {
        await Analytics.trackModelChanged(
          modelConfig.provider,
          modelConfig.model,
          updatedConfig.provider,
          updatedConfig.model
        );
      }

      await invokeTauri('api_save_model_config', {
        provider: payload.provider,
        model: payload.model,
        whisperModel: payload.whisperModel,
        apiKey: payload.apiKey,
        ollamaEndpoint: payload.ollamaEndpoint,
      });

      console.log('Save model config success');
      setModelConfig(payload);

      // Emit event to sync other components
      const { emit } = await import('@tauri-apps/api/event');
      await emit('model-config-updated', payload);

      toast.success("Summary settings Saved successfully");

      await Analytics.trackSettingsChanged('model_config', `${payload.provider}_${payload.model}`);
    } catch (error) {
      console.error('Failed to save model config:', error);
      toast.error("Failed to save summary settings", { description: String(error) });
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to save model config: Unknown error');
      }
    }
  }, [modelConfig]);

  return {
    modelConfig,
    setModelConfig,
    handleSaveModelConfig,
    isLoading,
  };
}
