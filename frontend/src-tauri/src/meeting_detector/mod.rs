//! Автодетект встречи по активной аудио-сессии.
//!
//! Фоновый поток раз в ~3с проверяет, есть ли активная аудио-сессия у известных
//! приложений-звонилок, и эмитит во фронтенд событие `meeting-detected`
//! (и `meeting-ended`, когда встреча закончилась). Фронтенд показывает плашку
//! «Записать встречу?».
//!
//! Сигнал «активная аудио-сессия» (а не просто запущенный процесс) важен: Zoom и
//! Teams часто висят в трее, и детект по факту запуска давал бы ложные срабатывания.
//!
//! Windows: перечисляем WASAPI-сессии (render + capture), берём PID активных,
//! сопоставляем с именем процесса. Десктоп-звонилка с активной сессией → встреча;
//! браузер с активным **микрофоном** (capture) → встреча в браузере (Google Meet,
//! веб-Телемост, веб-Zoom). Требование микрофона для браузера отсекает YouTube/музыку.
//!
//! macOS/Linux: пока no-op (фича не срабатывает) — расширим позже.

pub mod commands;

#[cfg(target_os = "windows")]
mod windows_audio;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

/// Сколько подряд опросов должно подтвердить наличие/отсутствие встречи перед
/// тем как эмитить событие (антидребезг: гасит короткие звуки уведомлений и т.п.).
const STREAK_THRESHOLD: u8 = 2;
const POLL_INTERVAL: Duration = Duration::from_secs(3);

#[derive(Clone, Serialize)]
struct MeetingPayload {
    app: String,
}

/// Состояние детектора, живёт в Tauri-managed state.
#[derive(Default)]
pub struct MeetingDetectorState {
    running: Arc<AtomicBool>,
    active: Arc<AtomicBool>,
}

impl MeetingDetectorState {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            active: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Запускает фоновый поток-вотчер (идемпотентно: повторный вызов игнорируется).
    pub fn start<R: Runtime>(&self, app: AppHandle<R>) {
        if self.running.swap(true, Ordering::SeqCst) {
            return; // уже работает
        }
        let running = self.running.clone();
        let active = self.active.clone();
        std::thread::spawn(move || run_loop(app, running, active));
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_active(&self) -> bool {
        self.active.load(Ordering::Relaxed)
    }
}

fn run_loop<R: Runtime>(app: AppHandle<R>, running: Arc<AtomicBool>, active: Arc<AtomicBool>) {
    let mut sys = sysinfo::System::new();
    let mut on_streak: u8 = 0;
    let mut off_streak: u8 = 0;

    log::info!("[meeting_detector] watcher started");

    while running.load(Ordering::Relaxed) {
        match detect_meeting(&mut sys) {
            Some(label) => {
                off_streak = 0;
                if !active.load(Ordering::Relaxed) {
                    on_streak = on_streak.saturating_add(1);
                    if on_streak >= STREAK_THRESHOLD {
                        active.store(true, Ordering::Relaxed);
                        log::info!("[meeting_detector] meeting detected: {}", label);
                        let _ = app.emit("meeting-detected", MeetingPayload { app: label });
                        warm_up_transcription_model(&app);
                    }
                }
            }
            None => {
                on_streak = 0;
                if active.load(Ordering::Relaxed) {
                    off_streak = off_streak.saturating_add(1);
                    if off_streak >= STREAK_THRESHOLD {
                        active.store(false, Ordering::Relaxed);
                        log::info!("[meeting_detector] meeting ended");
                        let _ = app.emit("meeting-ended", ());
                    }
                }
            }
        }

        std::thread::sleep(POLL_INTERVAL);
    }

    active.store(false, Ordering::Relaxed);
    log::info!("[meeting_detector] watcher stopped");
}

/// Прогрев модели транскрипции в фоне, пока юзер решает, записывать ли встречу.
/// К моменту клика «Записать» модель уже в памяти, и старт записи не платит
/// 3-6 секунд за её загрузку с диска. Гонка с реальным стартом записи закрыта
/// мьютексом внутри validate_transcription_model_ready; повторный вызов при
/// уже загруженной модели возвращается мгновенно.
fn warm_up_transcription_model<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match crate::audio::transcription::validate_transcription_model_ready(&app).await {
            Ok(()) => log::info!("[meeting_detector] transcription model warmed up"),
            // Не критично: модель ещё качается или провайдер облачный —
            // старт записи проведёт собственную валидацию как раньше.
            Err(e) => log::info!("[meeting_detector] model warm-up skipped: {}", e),
        }
    });
}

/// Десктоп-приложения для звонков: подстроки имени процесса (lowercase).
const DESKTOP_MEETING_APPS: &[(&str, &str)] = &[
    ("zoom", "Zoom"),
    ("teams", "Microsoft Teams"),
    ("telemost", "Яндекс Телемост"),
    ("webex", "Webex"),
    ("skype", "Skype"),
    ("discord", "Discord"),
    ("slack", "Slack"),
    ("whereby", "Whereby"),
    ("gotomeeting", "GoToMeeting"),
    ("bluejeans", "BlueJeans"),
];

/// Браузеры: подстроки имени процесса (lowercase). Yandex Browser = `browser.exe`.
const BROWSERS: &[&str] = &[
    "chrome", "msedge", "firefox", "yandex", "browser", "brave", "opera", "vivaldi", "chromium",
];

#[cfg(target_os = "windows")]
fn detect_meeting(sys: &mut sysinfo::System) -> Option<String> {
    let (render_pids, capture_pids) = windows_audio::active_audio_session_pids();
    if render_pids.is_empty() && capture_pids.is_empty() {
        return None;
    }

    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    // 1) Десктоп-звонилка с активной сессией (render или capture).
    for pid in render_pids.iter().chain(capture_pids.iter()) {
        if let Some(name) = proc_name(sys, *pid) {
            for (needle, label) in DESKTOP_MEETING_APPS {
                if name.contains(needle) {
                    return Some((*label).to_string());
                }
            }
        }
    }

    // 2) Браузер с активным микрофоном (capture) → встреча в браузере.
    for pid in capture_pids.iter() {
        if let Some(name) = proc_name(sys, *pid) {
            if BROWSERS.iter().any(|b| name.contains(b)) {
                return Some("Google Meet / Телемост".to_string());
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn proc_name(sys: &sysinfo::System, pid: u32) -> Option<String> {
    sys.process(sysinfo::Pid::from(pid as usize))
        .map(|p| p.name().to_string_lossy().to_lowercase())
}

/// macOS/Linux: пока не реализовано (нужен CoreAudio / PulseAudio). No-op.
#[cfg(not(target_os = "windows"))]
fn detect_meeting(_sys: &mut sysinfo::System) -> Option<String> {
    None
}
