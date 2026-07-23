//! WASAPI: перечисление активных аудио-сессий и получение PID процессов.
//!
//! Возвращает PID процессов, у которых сессия в состоянии Active, отдельно для
//! render (вывод) и capture (микрофон). Используется детектором встреч.

use windows::core::Interface;
use windows::Win32::Media::Audio::{
    eCapture, eConsole, eRender, AudioSessionStateActive, EDataFlow, IAudioSessionControl2,
    IAudioSessionEnumerator, IAudioSessionManager2, IMMDeviceEnumerator, MMDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// Возвращает `(render_active_pids, capture_active_pids)`.
///
/// Любая ошибка COM/WASAPI трактуется как «нет активных сессий» (пустой вектор),
/// чтобы детектор деградировал мягко, а не падал.
pub fn active_audio_session_pids() -> (Vec<u32>, Vec<u32>) {
    unsafe {
        // Поток вотчера дергает это многократно; CoInitializeEx на уже
        // инициализированном потоке вернёт S_FALSE/RPC_E_CHANGED_MODE — игнорируем.
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

        let render = collect_active_pids(eRender).unwrap_or_default();
        let capture = collect_active_pids(eCapture).unwrap_or_default();
        (render, capture)
    }
}

unsafe fn collect_active_pids(flow: EDataFlow) -> windows::core::Result<Vec<u32>> {
    let enumerator: IMMDeviceEnumerator =
        CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

    // Дефолтный endpoint для нужного направления. Если устройства нет
    // (например, нет микрофона) — вернётся ошибка, обработается выше.
    let device = enumerator.GetDefaultAudioEndpoint(flow, eConsole)?;

    let manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)?;
    let sessions: IAudioSessionEnumerator = manager.GetSessionEnumerator()?;
    let count = sessions.GetCount()?;

    let mut pids = Vec::new();
    for i in 0..count {
        let ctrl = sessions.GetSession(i)?;
        if ctrl.GetState()? != AudioSessionStateActive {
            continue;
        }
        let ctrl2: IAudioSessionControl2 = ctrl.cast()?;
        let pid = ctrl2.GetProcessId()?;
        if pid != 0 {
            pids.push(pid);
        }
    }
    Ok(pids)
}
