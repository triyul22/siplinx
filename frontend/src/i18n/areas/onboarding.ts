// Область: онбординг (приветствие, разрешения, загрузка моделей, обзор).
import type { Dict } from "../types";

export const en: Dict = {
  // Welcome step
  "onboarding.welcome.title": "Welcome to Siplinx AI",
  "onboarding.welcome.description": "Record. Transcribe. Summarize. All on your device.",
  "onboarding.welcome.feature.privacy": "Your data never leaves your device",
  "onboarding.welcome.feature.summaries": "Intelligent summaries & insights",
  "onboarding.welcome.feature.offline": "Works offline, no cloud required",
  "onboarding.welcome.cta": "Get Started",
  "onboarding.welcome.time": "Takes less than 3 minutes",

  // Setup overview step
  "onboarding.setup.title": "Setup Overview",
  "onboarding.setup.description":
    "Siplinx AI requires that you download the Transcription & Summarization AI models for the software to work.",
  "onboarding.setup.step": "Step {number} :  {title}",
  "onboarding.setup.step.transcription": "Download Transcription Engine",
  "onboarding.setup.step.summarization": "Download Summarization Engine",
  "onboarding.setup.summarization.tooltip":
    "You can also select external AI providers like OpenAI, Claude, or Ollama for summary generation in settings.",
  "onboarding.setup.cta": "Let's Go",

  // Download progress step
  "onboarding.download.title": "Getting your AI ready…",
  "onboarding.download.description":
    "Your AI models are loading in the background. You can start exploring Siplinx AI right now.",
  "onboarding.download.allSet": "You're all set",
  "onboarding.download.allSetBody": "AI is ready. Enjoy Siplinx AI!",
  "onboarding.download.transcriptionEngine": "Transcription Engine",
  "onboarding.download.summaryEngine": "Summary Engine",
  "onboarding.download.status.waiting": "Waiting...",
  "onboarding.download.status.failed": "Failed",
  "onboarding.download.progress": "{downloaded} MB / {total} MB",
  "onboarding.download.speed": "{speed} MB/s",
  "onboarding.download.error.title": "Download Error",
  "onboarding.download.tryAgain": "Try Again",
  "onboarding.download.continueInfo.title": "You can continue while this finishes",
  "onboarding.download.continueInfo.body": "Download will continue in the background.",
  "onboarding.download.continue": "Continue",

  // Download toasts / errors
  "onboarding.download.toast.retryFailed.title": "Download retry failed",
  "onboarding.download.toast.retryFailed.body": "Please check your connection and try again.",
  "onboarding.download.toast.summaryRetryFailed.title": "Summary model download retry failed",
  "onboarding.download.toast.summaryRetryFailed.body": "Please check your connection and try again.",
  "onboarding.download.error.retryFailed": "Retry failed",
  "onboarding.download.toast.engineRequired.title": "Transcription engine required",
  "onboarding.download.toast.engineRequired.body": "Please retry the download before continuing.",
  "onboarding.download.toast.background.title": "Downloads will continue in the background",
  "onboarding.download.toast.background.body":
    "You can start using the app. Recording will be available once speech recognition is ready.",
  "onboarding.download.toast.setupFailed.title": "Failed to complete setup",
  "onboarding.download.toast.setupFailed.body": "Please try again.",

  // Permissions step
  "onboarding.permissions.title": "Grant Permissions",
  "onboarding.permissions.description":
    "Siplinx AI needs access to your microphone and system audio to record meetings",
  "onboarding.permissions.microphone.title": "Microphone",
  "onboarding.permissions.microphone.description":
    "Required to capture your voice during meetings",
  "onboarding.permissions.systemAudio.title": "System Audio",
  "onboarding.permissions.systemAudio.description":
    "Click Enable to grant Audio Capture permission",
  "onboarding.permissions.finish": "Finish Setup",
  "onboarding.permissions.later": "I'll do this later",
  "onboarding.permissions.warning":
    "Recording won't work without permissions. You can grant them later in settings.",
  "onboarding.permissions.alert.microphone":
    "Please enable microphone access in System Preferences > Security & Privacy > Microphone",
  "onboarding.permissions.alert.systemAudio":
    "Please enable Audio Capture in System Settings → Privacy & Security → Audio Capture",

  // Permission row (shared)
  "onboarding.permissionRow.checking": "Checking...",
  "onboarding.permissionRow.openSettings": "Open Settings",
  "onboarding.permissionRow.enable": "Enable",
  "onboarding.permissionRow.accessGranted": "Access Granted",
  "onboarding.permissionRow.accessDenied": "Access Denied - Please grant in System Settings",
};

export const ru: Dict = {
  // Welcome step
  "onboarding.welcome.title": "Добро пожаловать в Siplinx AI",
  "onboarding.welcome.description": "Записывайте. Расшифровывайте. Резюмируйте. Всё на вашем устройстве.",
  "onboarding.welcome.feature.privacy": "Ваши данные не покидают устройство",
  "onboarding.welcome.feature.summaries": "Умные резюме и инсайты",
  "onboarding.welcome.feature.offline": "Работает офлайн, облако не нужно",
  "onboarding.welcome.cta": "Начать",
  "onboarding.welcome.time": "Займёт меньше 3 минут",

  // Setup overview step
  "onboarding.setup.title": "Обзор настройки",
  "onboarding.setup.description":
    "Чтобы Siplinx AI работал, нужно скачать ИИ-модели для транскрипции и резюмирования.",
  "onboarding.setup.step": "Шаг {number} :  {title}",
  "onboarding.setup.step.transcription": "Скачать движок транскрипции",
  "onboarding.setup.step.summarization": "Скачать движок резюмирования",
  "onboarding.setup.summarization.tooltip":
    "В настройках вы также можете выбрать внешних ИИ-провайдеров, например OpenAI, Claude или Ollama, для генерации резюме.",
  "onboarding.setup.cta": "Поехали",

  // Download progress step
  "onboarding.download.title": "Готовим ИИ в фоне…",
  "onboarding.download.description":
    "Модели загружаются в фоне. Вы уже можете начать работу с Siplinx AI.",
  "onboarding.download.allSet": "Всё готово",
  "onboarding.download.allSetBody": "ИИ готов к работе. Наслаждайтесь Siplinx AI!",
  "onboarding.download.transcriptionEngine": "Движок транскрипции",
  "onboarding.download.summaryEngine": "Движок резюмирования",
  "onboarding.download.status.waiting": "Ожидание...",
  "onboarding.download.status.failed": "Ошибка",
  "onboarding.download.progress": "{downloaded} МБ / {total} МБ",
  "onboarding.download.speed": "{speed} МБ/с",
  "onboarding.download.error.title": "Ошибка загрузки",
  "onboarding.download.tryAgain": "Повторить",
  "onboarding.download.continueInfo.title": "Можно продолжить, пока загрузка идёт",
  "onboarding.download.continueInfo.body": "Загрузка продолжится в фоне.",
  "onboarding.download.continue": "Продолжить",

  // Download toasts / errors
  "onboarding.download.toast.retryFailed.title": "Не удалось повторить загрузку",
  "onboarding.download.toast.retryFailed.body": "Проверьте подключение и попробуйте снова.",
  "onboarding.download.toast.summaryRetryFailed.title": "Не удалось повторить загрузку модели резюмирования",
  "onboarding.download.toast.summaryRetryFailed.body": "Проверьте подключение и попробуйте снова.",
  "onboarding.download.error.retryFailed": "Повтор не удался",
  "onboarding.download.toast.engineRequired.title": "Нужен движок транскрипции",
  "onboarding.download.toast.engineRequired.body": "Перед продолжением повторите загрузку.",
  "onboarding.download.toast.background.title": "Загрузка продолжится в фоне",
  "onboarding.download.toast.background.body":
    "Вы можете начать пользоваться приложением. Запись станет доступна, как только будет готово распознавание речи.",
  "onboarding.download.toast.setupFailed.title": "Не удалось завершить настройку",
  "onboarding.download.toast.setupFailed.body": "Попробуйте ещё раз.",

  // Permissions step
  "onboarding.permissions.title": "Выдайте разрешения",
  "onboarding.permissions.description":
    "Siplinx AI нужен доступ к микрофону и системному звуку, чтобы записывать встречи",
  "onboarding.permissions.microphone.title": "Микрофон",
  "onboarding.permissions.microphone.description":
    "Нужен, чтобы захватывать ваш голос во время встреч",
  "onboarding.permissions.systemAudio.title": "Системный звук",
  "onboarding.permissions.systemAudio.description":
    "Нажмите «Включить», чтобы выдать разрешение на захват звука",
  "onboarding.permissions.finish": "Завершить настройку",
  "onboarding.permissions.later": "Сделаю это позже",
  "onboarding.permissions.warning":
    "Без разрешений запись не работает. Вы можете выдать их позже в настройках.",
  "onboarding.permissions.alert.microphone":
    "Включите доступ к микрофону в «Системные настройки» > «Защита и безопасность» > «Микрофон»",
  "onboarding.permissions.alert.systemAudio":
    "Включите захват звука в «Системные настройки» → «Конфиденциальность и безопасность» → «Захват звука»",

  // Permission row (shared)
  "onboarding.permissionRow.checking": "Проверка...",
  "onboarding.permissionRow.openSettings": "Открыть настройки",
  "onboarding.permissionRow.enable": "Включить",
  "onboarding.permissionRow.accessGranted": "Доступ предоставлен",
  "onboarding.permissionRow.accessDenied": "Доступ запрещён - выдайте его в системных настройках",
};
