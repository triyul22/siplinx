#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

fn main() {
    // Логгер регистрирует tauri-plugin-log внутри app_lib::run()
    // (файл в AppData/logs + stdout). env_logger больше не инициализируем:
    // два глобальных логгера = паника.
    app_lib::run();
}
