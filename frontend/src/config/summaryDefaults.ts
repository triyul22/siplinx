import type { ModelConfig } from '@/services/configService';

export const CLOUD_SUMMARY_PROVIDER = 'siplinx-cloud' as const;
export const CLOUD_SUMMARY_MODEL = 'gpt-5.4-mini';
export const DEFAULT_SUMMARY_MODEL_CONFIG: ModelConfig = {
  provider: CLOUD_SUMMARY_PROVIDER,
  model: CLOUD_SUMMARY_MODEL,
  whisperModel: 'large-v3',
  apiKey: null,
  ollamaEndpoint: null,
};

const LEGACY_LOCAL_SUMMARY_PROVIDERS = new Set(['builtin-ai', 'ollama']);

export function isLegacyLocalSummaryProvider(provider?: string | null): boolean {
  return !!provider && LEGACY_LOCAL_SUMMARY_PROVIDERS.has(provider);
}

export function normalizeCloudOnlySummaryConfig(
  config?: Partial<ModelConfig> | null
): ModelConfig {
  if (!config?.provider || isLegacyLocalSummaryProvider(config.provider) || config.provider === CLOUD_SUMMARY_PROVIDER) {
    return {
      ...DEFAULT_SUMMARY_MODEL_CONFIG,
      whisperModel: config?.whisperModel || DEFAULT_SUMMARY_MODEL_CONFIG.whisperModel,
    };
  }

  return {
    ...DEFAULT_SUMMARY_MODEL_CONFIG,
    ...config,
    provider: config.provider as ModelConfig['provider'],
    model: config.model || DEFAULT_SUMMARY_MODEL_CONFIG.model,
    whisperModel: config.whisperModel || DEFAULT_SUMMARY_MODEL_CONFIG.whisperModel,
  };
}

export function summaryProviderRequiresOwnApiKey(provider?: string | null): boolean {
  return provider === 'claude' ||
    provider === 'groq' ||
    provider === 'openai' ||
    provider === 'openrouter';
}
