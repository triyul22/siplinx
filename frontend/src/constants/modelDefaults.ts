/**
 * Default model names for transcription engines.
 * IMPORTANT: Keep in sync with Rust constants in src-tauri/src/config.rs
 */

/** True when running in the Windows desktop webview (WebView2 UA contains "Windows NT"). */
export function isWindowsPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Windows/i.test(navigator.userAgent || '');
}

/**
 * Default Whisper model for transcription when no preference is configured. Platform-aware:
 * - macOS (Metal GPU): large-v3-q5_0 — full-decoder large-v3 accuracy on RU/KK, GPU-accelerated
 *   and real-time.
 * - Windows: GPU is forced off (loading Whisper via Vulkan crashes the driver — TDR), so Whisper
 *   runs on CPU. Benchmark on i7-10510U with audio_ctx scaling: medium ~12x slower than real
 *   time, small ~4-7x, base ~1.3-1.8x — only base-q5_1 keeps live transcription usable.
 * Keep in sync with DEFAULT_WHISPER_MODEL in src-tauri/src/config.rs.
 */
export const DEFAULT_WHISPER_MODEL = isWindowsPlatform() ? 'base-q5_1' : 'large-v3-q5_0';

/**
 * Default Parakeet model for transcription when no preference is configured.
 * This is the quantized version optimized for speed.
 */
export const DEFAULT_PARAKEET_MODEL = 'parakeet-tdt-0.6b-v3-int8';

/**
 * Model defaults by provider type
 */
export const MODEL_DEFAULTS = {
  whisper: DEFAULT_WHISPER_MODEL,
  localWhisper: DEFAULT_WHISPER_MODEL,
  parakeet: DEFAULT_PARAKEET_MODEL,
} as const;

/**
 * Whether the given system/app locale should default to Whisper for transcription.
 * Used by the language-based ("hybrid") transcription engine auto-selection.
 *
 * - Kazakh (kk): Parakeet v3 has no Kazakh, so always use local Whisper (~99 languages).
 * - Russian (ru): Parakeet v3 IS multilingual and transcribes Russian well. On GPU platforms
 *   (macOS/Metal) Whisper large-v3 is higher quality and still real-time, so we prefer it there.
 *   On Windows the GPU is forced off (Vulkan crashes the driver — TDR), so Whisper runs on CPU
 *   where only base-q5_1 keeps up, and base is garbage on Russian. There Parakeet v3 wins on both
 *   quality and speed (real-time on CPU), so RU on Windows does NOT need Whisper.
 * - Everything else: Parakeet is faster and just as accurate.
 */
export function localeNeedsWhisper(locale?: string | null): boolean {
  const l = (locale ?? '').toLowerCase();
  if (l.startsWith('kk')) return true;
  if (l.startsWith('ru')) return !isWindowsPlatform();
  return false;
}
