//! Tauri-команды управления детектором встреч.

use tauri::{AppHandle, Runtime, State};

use super::MeetingDetectorState;

/// Запускает фоновый вотчер (идемпотентно). Фронтенд зовёт это при входе в main app.
#[tauri::command]
pub async fn start_meeting_detection<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, MeetingDetectorState>,
) -> Result<(), String> {
    state.start(app);
    Ok(())
}

/// Останавливает вотчер.
#[tauri::command]
pub async fn stop_meeting_detection(
    state: State<'_, MeetingDetectorState>,
) -> Result<(), String> {
    state.stop();
    Ok(())
}

/// Текущее состояние: идёт ли обнаруженная встреча.
#[tauri::command]
pub async fn get_meeting_detection_active(
    state: State<'_, MeetingDetectorState>,
) -> Result<bool, String> {
    Ok(state.is_active())
}
