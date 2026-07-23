//! Этап 0 (TZ-ru-transcription-windows.md): gate-валидация Parakeet v3 на русской речи.
//!
//! Прогоняет реальный аудиофайл через тот же `ParakeetModel`, что использует приложение,
//! в обход live-пайплайна (VAD/чанкинг), чтобы измерить качество и RTF самой модели.
//! Игнорируется в обычном `cargo test`, т.к. требует локальную модель и аудиофайл.
//!
//! Запуск:
//!   PARAKEET_VALIDATION_AUDIO="C:\path\to\audio.mp4" cargo test --test parakeet_ru_validation -- --ignored --nocapture
//!
//! Опционально:
//!   PARAKEET_VALIDATION_MODEL_DIR - путь к папке модели (дефолт: %APPDATA%\com.siplinx.ai\models\parakeet\parakeet-tdt-0.6b-v3-int8)
//!   PARAKEET_VALIDATION_MAX_SECONDS - обрезать клип до N секунд (дефолт: 60)

use app_lib::audio::decoder::decode_audio_file;
use app_lib::parakeet_engine::ParakeetModel;
use std::path::{Path, PathBuf};
use std::time::Instant;

fn default_model_dir() -> PathBuf {
    dirs::data_dir()
        .expect("no platform data dir")
        .join("com.siplinx.ai")
        .join("models")
        .join("parakeet")
        .join("parakeet-tdt-0.6b-v3-int8")
}

#[test]
#[ignore]
fn validate_parakeet_v3_russian() {
    let audio_path = std::env::var("PARAKEET_VALIDATION_AUDIO")
        .expect("set PARAKEET_VALIDATION_AUDIO to a file with Russian speech (mp4/wav/etc)");
    let model_dir = std::env::var("PARAKEET_VALIDATION_MODEL_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| default_model_dir());
    let max_seconds: f32 = std::env::var("PARAKEET_VALIDATION_MAX_SECONDS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(60.0);

    assert!(
        model_dir.exists(),
        "model dir not found: {} (set PARAKEET_VALIDATION_MODEL_DIR)",
        model_dir.display()
    );

    let decoded =
        decode_audio_file(Path::new(&audio_path)).expect("failed to decode audio file");
    let mut samples = decoded.to_whisper_format(); // 16kHz mono f32, same conversion the app uses
    let max_samples = (max_seconds * 16000.0) as usize;
    if samples.len() > max_samples {
        samples.truncate(max_samples);
    }
    let clip_duration_secs = samples.len() as f32 / 16000.0;

    let mut model = ParakeetModel::new(&model_dir, true).expect("failed to load Parakeet model");

    let start = Instant::now();
    let result = model
        .transcribe_samples(samples)
        .expect("transcription failed");
    let elapsed_secs = start.elapsed().as_secs_f32();
    let rtf = elapsed_secs / clip_duration_secs;

    println!("=== Parakeet v3 RU validation ===");
    println!("audio: {audio_path} ({clip_duration_secs:.1}s clip)");
    println!("elapsed: {elapsed_secs:.1}s, RTF: {rtf:.2}");
    println!("text: {}", result.text);

    assert!(!result.text.trim().is_empty(), "empty transcription");
}
