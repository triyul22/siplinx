// Область: главный экран записи, контролы, устройства, аудио.
import type { Dict } from "../types";

export const en: Dict = {
  "recording.autoNotesHint": "Recording. Notes will be prepared automatically when you stop.",
  // Status overlays
  "recording.finalizingTranscription": "Finalizing transcription...",
  "recording.savingTranscript": "Saving transcript...",

  // Transcript panel
  "recording.copyTranscript": "Copy Transcript",
  "recording.copy": "Copy",
  "recording.language": "Language",

  // Recording controls
  "recording.processingRecording": "Processing recording...",
  "recording.startRecording": "Start recording",
  "recording.resumeRecording": "Resume recording",
  "recording.pauseRecording": "Pause recording",
  "recording.stopRecording": "Stop recording",
  "recording.pausing": "Pausing...",
  "recording.resuming": "Resuming...",
  "recording.stopping": "Stopping...",
  "recording.validatingSpeech": "Validating speech recognition...",
  "recording.closeAlert": "Close alert",
  "recording.initFailed":
    "Failed to initialize recording. Please check the console for details.",
  "recording.pauseFailed":
    "Failed to pause recording. Please check the console for details.",
  "recording.resumeFailed":
    "Failed to resume recording. Please check the console for details.",
  // Device errors
  "recording.err.micTitle": "Microphone Not Available",
  "recording.err.micMessage":
    "Unable to access your microphone. Please check that:\n• Your microphone is connected\n• The app has microphone permissions\n• No other app is using the microphone",
  "recording.err.systemTitle": "System Audio Not Available",
  "recording.err.systemMessage":
    "Unable to capture system audio. Please check that:\n• A virtual audio device (like BlackHole) is installed\n• The app has screen recording permissions (macOS)\n• System audio is properly configured",
  "recording.err.permissionTitle": "Permission Required",
  "recording.err.permissionMessage":
    "Recording permissions are required. Please:\n• Grant microphone access in System Settings\n• Grant screen recording access for system audio (macOS)\n• Restart the app after granting permissions",
  "recording.err.genericTitle": "Recording Failed",
  "recording.err.genericMessage":
    "Unable to start recording. Please check your audio device settings and try again.",
  "recording.trialLimitTitle": "Daily trial limit reached",
  "recording.trialLimitDesc":
    "Trial includes {limit} meetings per day. Upgrade to keep recording today.",

  // Recording status bar
  "recording.paused": "Paused",
  "recording.recording": "Recording",
  "recording.draftBadge": "Draft",

  // Audio backend selector
  "recording.systemAudioBackend": "System Audio Backend",
  "recording.captureMethods": "Audio Capture Methods:",
  "recording.tryBackends":
    "Try different backends to find which works best for your system.",
  "recording.backendLoadFailed": "Failed to load backend options",
  "recording.backendChangeFailed": "Failed to change backend. Please try again.",
  "recording.active": "Active",
  "recording.disabled": "Disabled",
  "recording.backendNote1": "• Backend selection only affects system audio capture",
  "recording.backendNote2": "• Microphone always uses the default method",
  "recording.backendNote3": "• Changes apply to new recording sessions",

  // Audio level meter
  "recording.statusActive": "Active",
  "recording.statusInactive": "Inactive",
  "recording.deviceStatus": "{device} - {status}",

  // Device selection
  "recording.audioDevices": "Audio Devices",
  "recording.devicesLoadFailed":
    "Failed to load audio devices. Please check your system audio settings.",
  "recording.noMicToMonitor": "No microphone devices found to monitor",
  "recording.monitoringStartFailed": "Failed to start audio level monitoring",
  "recording.microphone": "Microphone",
  "recording.selectMicrophone": "Select Microphone",
  "recording.defaultMicrophone": "Default Microphone",
  "recording.noMicDevices": "No microphone devices found",
  "recording.micLevels": "Microphone Levels:",
  "recording.systemAudio": "System Audio",
  "recording.selectSystemAudio": "Select System Audio",
  "recording.defaultSystemAudio": "Default System Audio",
  "recording.noSystemDevices": "No system audio devices found",
  "recording.stopTest": "Stop Test",
  "recording.testMic": "Test Mic",
  "recording.noMicToTest": "No microphones available to test",
  "recording.infoMic": "Records your voice and ambient sound",
  "recording.infoSystem": "Records computer audio (music, calls, etc.)",
  "recording.infoLevels": "Green = good, Yellow = loud, Red = too loud",
  "recording.tipLabel": "Tip",
  "recording.tipTestMic": 'Click "Test Mic" to check if your microphone is working',

  // Compliance notification
  "recording.recordingNotice": "Recording Notice",
  "recording.informParticipants": "Inform participants about recording.",
  "recording.usComplianceRequired": "US compliance required",
  "recording.later": "Later",
  "recording.done": "Done",

  // Bluetooth playback warning
  "recording.bluetoothDetected": "Bluetooth Playback Detected",
  "recording.bluetoothBody1": "You're using",
  "recording.bluetoothBody2":
    " for playback. Recordings may sound distorted or sped up through Bluetooth devices. For accurate review, please use",
  "recording.bluetoothComputerSpeakers": "computer speakers",
  "recording.bluetoothOr": "or",
  "recording.bluetoothWiredHeadphones": "wired headphones",
  "recording.bluetoothLearnWhy": "Learn why this happens →",
  "recording.dismissWarning": "Dismiss warning",

  // Confidence indicator
  "recording.confidenceHigh": "High confidence",
  "recording.confidenceGood": "Good confidence",
  "recording.confidenceMedium": "Medium confidence",
  "recording.confidenceLow": "Low confidence",
  "recording.confidenceTitle": "{percent}% confidence - {label}",
  "recording.confidenceAria": "Transcription confidence: {percent}%",

  // Chunk progress display
  "recording.processingProgress": "Processing Progress",
  "recording.calculating": "Calculating...",
  "recording.pause": "Pause",
  "recording.resume": "Resume",
  "recording.cancel": "Cancel",
  "recording.chunksCompleted": "{completed} of {total} chunks completed",
  "recording.completed": "Completed",
  "recording.processing": "Processing",
  "recording.pending": "Pending",
  "recording.failed": "Failed",
  "recording.estimatedRemaining": "Estimated time remaining: {time}",
  "recording.recentChunks": "Recent Chunks ({shown} of {total})",
  "recording.chunkLabel": "Chunk {id}",
  "recording.chunkError": "Error: {message}",
  "recording.processingCompleteAll":
    "Processing completed! All {total} chunks have been transcribed.",
  "recording.chunksShort": "{completed} / {total} chunks",
  "recording.processingShort": "({count} processing)",

  // Console toggle
  "recording.developerConsole": "Developer Console",
  "recording.toggleConsole": "Toggle Console",
  "recording.consoleDescription":
    "Show or hide the developer console window. On Windows, this controls the console window. On macOS, this opens Terminal with app logs.",

  // Recovery (page.tsx) toasts
  "recording.meetingRecovered": "Meeting recovered successfully!",
  "recording.recoveredWithAudio": "Transcripts and audio recovered",
  "recording.recoveredNoAudio": "Transcripts recovered (no audio available)",
  "recording.viewMeeting": "View Meeting",
  "recording.recoverFailed": "Failed to recover meeting",
  "recording.unknownError": "Unknown error occurred",

  // Recording stop (useRecordingStop.ts) toasts
  "recording.savedTitle": "Meeting saved",
  "recording.savedDesc": "You'll find it in the list on the left.",
  "recording.saveFailed": "Failed to save meeting",
};

export const ru: Dict = {
  "recording.autoNotesHint": "Идёт запись. Заметки соберутся автоматически после остановки.",
  // Status overlays
  "recording.finalizingTranscription": "Завершаем транскрипцию...",
  "recording.savingTranscript": "Сохраняем транскрипцию...",

  // Transcript panel
  "recording.copyTranscript": "Скопировать транскрипцию",
  "recording.copy": "Копировать",
  "recording.language": "Язык",

  // Recording controls
  "recording.processingRecording": "Обрабатываем запись...",
  "recording.startRecording": "Начать запись",
  "recording.resumeRecording": "Продолжить запись",
  "recording.pauseRecording": "Пауза",
  "recording.stopRecording": "Остановить запись",
  "recording.pausing": "Ставим на паузу...",
  "recording.resuming": "Возобновляем...",
  "recording.stopping": "Останавливаем...",
  "recording.validatingSpeech": "Проверяем распознавание речи...",
  "recording.closeAlert": "Закрыть уведомление",
  "recording.initFailed":
    "Не удалось инициализировать запись. Подробности смотрите в консоли.",
  "recording.pauseFailed":
    "Не удалось поставить запись на паузу. Подробности смотрите в консоли.",
  "recording.resumeFailed":
    "Не удалось возобновить запись. Подробности смотрите в консоли.",
  // Device errors
  "recording.err.micTitle": "Микрофон недоступен",
  "recording.err.micMessage":
    "Не удаётся получить доступ к микрофону. Проверьте, что:\n• Микрофон подключён\n• У приложения есть разрешение на микрофон\n• Микрофон не занят другим приложением",
  "recording.err.systemTitle": "Системный звук недоступен",
  "recording.err.systemMessage":
    "Не удаётся захватить системный звук. Проверьте, что:\n• Установлено виртуальное аудиоустройство (например, BlackHole)\n• У приложения есть разрешение на запись экрана (macOS)\n• Системный звук настроен правильно",
  "recording.err.permissionTitle": "Нужно разрешение",
  "recording.err.permissionMessage":
    "Для записи нужны разрешения. Пожалуйста:\n• Дайте доступ к микрофону в системных настройках\n• Дайте доступ к записи экрана для системного звука (macOS)\n• Перезапустите приложение после выдачи разрешений",
  "recording.err.genericTitle": "Не удалось начать запись",
  "recording.err.genericMessage":
    "Не удаётся начать запись. Проверьте настройки аудиоустройств и попробуйте снова.",
  "recording.trialLimitTitle": "Дневной лимит триала исчерпан",
  "recording.trialLimitDesc":
    "В триале доступно {limit} встречи в день. Оформите PRO, чтобы продолжить запись сегодня.",

  // Recording status bar
  "recording.paused": "Пауза",
  "recording.recording": "Запись",
  "recording.draftBadge": "Черновик",

  // Audio backend selector
  "recording.systemAudioBackend": "Бэкенд системного звука",
  "recording.captureMethods": "Способы захвата звука:",
  "recording.tryBackends":
    "Попробуйте разные бэкенды, чтобы найти подходящий для вашей системы.",
  "recording.backendLoadFailed": "Не удалось загрузить варианты бэкенда",
  "recording.backendChangeFailed":
    "Не удалось сменить бэкенд. Попробуйте ещё раз.",
  "recording.active": "Активен",
  "recording.disabled": "Отключён",
  "recording.backendNote1": "• Выбор бэкенда влияет только на захват системного звука",
  "recording.backendNote2": "• Микрофон всегда использует способ по умолчанию",
  "recording.backendNote3": "• Изменения применяются к новым сессиям записи",

  // Audio level meter
  "recording.statusActive": "Активно",
  "recording.statusInactive": "Неактивно",
  "recording.deviceStatus": "{device} - {status}",

  // Device selection
  "recording.audioDevices": "Аудиоустройства",
  "recording.devicesLoadFailed":
    "Не удалось загрузить аудиоустройства. Проверьте системные настройки звука.",
  "recording.noMicToMonitor": "Не найдено микрофонов для мониторинга",
  "recording.monitoringStartFailed": "Не удалось запустить мониторинг уровня звука",
  "recording.microphone": "Микрофон",
  "recording.selectMicrophone": "Выберите микрофон",
  "recording.defaultMicrophone": "Микрофон по умолчанию",
  "recording.noMicDevices": "Микрофоны не найдены",
  "recording.micLevels": "Уровни микрофона:",
  "recording.systemAudio": "Системный звук",
  "recording.selectSystemAudio": "Выберите системный звук",
  "recording.defaultSystemAudio": "Системный звук по умолчанию",
  "recording.noSystemDevices": "Устройства системного звука не найдены",
  "recording.stopTest": "Остановить тест",
  "recording.testMic": "Проверить микрофон",
  "recording.noMicToTest": "Нет микрофонов для проверки",
  "recording.infoMic": "Записывает ваш голос и окружающий звук",
  "recording.infoSystem": "Записывает звук компьютера (музыка, звонки и т.д.)",
  "recording.infoLevels": "Зелёный = норма, жёлтый = громко, красный = слишком громко",
  "recording.tipLabel": "Совет",
  "recording.tipTestMic":
    'Нажмите «Проверить микрофон», чтобы убедиться, что он работает',

  // Compliance notification
  "recording.recordingNotice": "Уведомление о записи",
  "recording.informParticipants": "Предупредите участников о записи.",
  "recording.usComplianceRequired": "Требуется для соответствия законам США",
  "recording.later": "Позже",
  "recording.done": "Готово",

  // Bluetooth playback warning
  "recording.bluetoothDetected": "Обнаружено воспроизведение через Bluetooth",
  "recording.bluetoothBody1": "Для воспроизведения используется",
  "recording.bluetoothBody2":
    ". Через Bluetooth-устройства записи могут звучать искажённо или ускоренно. Для точной проверки используйте",
  "recording.bluetoothComputerSpeakers": "колонки компьютера",
  "recording.bluetoothOr": "или",
  "recording.bluetoothWiredHeadphones": "проводные наушники",
  "recording.bluetoothLearnWhy": "Почему так происходит →",
  "recording.dismissWarning": "Закрыть предупреждение",

  // Confidence indicator
  "recording.confidenceHigh": "Высокая уверенность",
  "recording.confidenceGood": "Хорошая уверенность",
  "recording.confidenceMedium": "Средняя уверенность",
  "recording.confidenceLow": "Низкая уверенность",
  "recording.confidenceTitle": "Уверенность {percent}% - {label}",
  "recording.confidenceAria": "Уверенность транскрипции: {percent}%",

  // Chunk progress display
  "recording.processingProgress": "Ход обработки",
  "recording.calculating": "Вычисляем...",
  "recording.pause": "Пауза",
  "recording.resume": "Продолжить",
  "recording.cancel": "Отмена",
  "recording.chunksCompleted": "Обработано {completed} из {total} фрагментов",
  "recording.completed": "Готово",
  "recording.processing": "В обработке",
  "recording.pending": "В очереди",
  "recording.failed": "Ошибки",
  "recording.estimatedRemaining": "Осталось примерно: {time}",
  "recording.recentChunks": "Последние фрагменты ({shown} из {total})",
  "recording.chunkLabel": "Фрагмент {id}",
  "recording.chunkError": "Ошибка: {message}",
  "recording.processingCompleteAll":
    "Обработка завершена! Все {total} фрагментов транскрибированы.",
  "recording.chunksShort": "{completed} / {total} фрагментов",
  "recording.processingShort": "({count} в обработке)",

  // Console toggle
  "recording.developerConsole": "Консоль разработчика",
  "recording.toggleConsole": "Переключить консоль",
  "recording.consoleDescription":
    "Показать или скрыть окно консоли разработчика. В Windows это управляет окном консоли. В macOS это открывает Terminal с логами приложения.",

  // Recovery (page.tsx) toasts
  "recording.meetingRecovered": "Встреча успешно восстановлена!",
  "recording.recoveredWithAudio": "Транскрипция и аудио восстановлены",
  "recording.recoveredNoAudio": "Транскрипция восстановлена (аудио недоступно)",
  "recording.viewMeeting": "Открыть встречу",
  "recording.recoverFailed": "Не удалось восстановить встречу",
  "recording.unknownError": "Произошла неизвестная ошибка",

  // Recording stop (useRecordingStop.ts) toasts
  "recording.savedTitle": "Встреча сохранена",
  "recording.savedDesc": "Запись появилась в списке «Мои встречи» слева.",
  "recording.saveFailed": "Не удалось сохранить встречу",
};
