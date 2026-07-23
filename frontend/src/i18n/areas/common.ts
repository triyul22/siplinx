// Область: общие/авторизация (логин, пейволл, PRO-гейт, промокод, язык).
// Уже используется компонентами auth/*. Ключи неймспейснуты по областям,
// чтобы при слиянии словарей не было коллизий.
import type { Dict } from "../types";

export const en: Dict = {
  // Язык / выбор языка
  "lang.label": "Language",

  // Экран входа
  "login.subtitle":
    "Sign in to use the app. Recording and transcription still run locally on your device.",
  "login.signIn": "Sign in with Google",
  "login.opening": "Opening browser…",
  "login.returnedWithoutAuth": "Sign-in was not completed. Try again.",
  "login.hint":
    "Sign-in opens in your system browser. Return to the app after signing in.",
  "login.marketingOptIn":
    "Send me product tips and special offers. Unsubscribe anytime.",

  // Пейволл
  "paywall.subtitle":
    "To use the app, subscribe to PRO or activate a promo code for a free period.",
  "paywall.trial7": "7 days free, then $4/week",
  "paywall.monthly": "Get PRO for $2/week",
  "paywall.cardNote":
    "The 7-day trial requires a card. Billing starts after the trial; cancel anytime.",
  "paywall.cardNote.trialUsed": "Billed weekly. Cancel anytime.",
  "paywall.orPromo": "or activate a promo code",
  "paywall.refresh": "Already paid — refresh",
  "paywall.logout": "Sign out ({email})",
  "paywall.trial7Cta": "Get PRO for $4/week",
  "paywall.trialEnded.subtitle":
    "Your 7 free days are over. Subscribe to keep using the app.",
  "paywall.cardNote.direct": "Billed weekly. Cancel anytime.",

  // Авто-триал / бейдж триала
  "trial.grantedToast": "You have 7 days free",
  "trial.badge": "Trial · {days}d left",
  "trial.endingToast": "Trial ends {date}",
  "trial.modal.title": "Siplinx AI PRO trial",
  "trial.modal.text":
    "Free access ends {date}. Subscribe to keep using the app after the trial.",

  // Карточка «Аккаунт» в настройках
  "account.title": "Account",
  "account.planFree": "Plan: Free",
  "account.planProLabel": "PRO",
  "account.planProUntil": "Paid through {date} (inclusive)",
  "account.planTrialLabel": "Trial",
  "account.planTrialUntil": "Available through {date} (inclusive)",
  "account.planDatePending": "End date is not available yet",
  "account.signOut": "Sign out",
  "account.buyNow": "Buy now",
  "account.emailPrefs": "Emails with tips and offers",
  "account.emailPrefsHint": "Occasional product tips and special offers.",

  // PRO-гейт / кнопки
  "pro.upgrade": "Get PRO",
  "pro.busy": "Waiting for payment…",
  "pro.manage": "Manage subscription",
  "pro.manageError": "Could not open subscription settings. Try again in a minute.",
  "pro.featureLocked": "{feature} — PRO feature",
  "pro.featureLockedGeneric": "PRO feature",
  "pro.unlock": "Subscribe to Siplinx AI PRO to unlock.",
  "pro.orPromoLong": "or activate a promo code for a free period",

  // Поле промокода
  "promo.placeholder": "Promo code",
  "promo.activate": "Activate",
  "promo.activating": "Activating…",
  "promo.success": "Promo code activated — unlocking PRO…",
  "promo.err.invalid_code": "Invalid promo code",
  "promo.err.already_pro": "You already have an active PRO subscription",
  "promo.err.unauthorized": "Session expired, please sign in again",
  "promo.err.network": "No connection to the server",
  "promo.err.server": "Server error",

  // Общие кнопки/слова (переиспользуемые)
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.close": "Close",
  "common.confirm": "Confirm",
  "common.back": "Back",
  "common.next": "Next",
  "common.continue": "Continue",
  "common.retry": "Retry",
  "common.loading": "Loading…",
};

export const ru: Dict = {
  "lang.label": "Язык",

  "login.subtitle":
    "Войдите, чтобы пользоваться приложением. Запись и транскрипция по-прежнему выполняются локально на вашем устройстве.",
  "login.signIn": "Войти через Google",
  "login.opening": "Открываем браузер…",
  "login.returnedWithoutAuth": "Вход не завершён. Попробуйте снова.",
  "login.hint":
    "Вход откроется в системном браузере. После входа вернитесь в приложение.",
  "login.marketingOptIn":
    "Присылать советы по продукту и специальные предложения. Отписаться можно в любой момент.",

  "paywall.subtitle":
    "Чтобы пользоваться приложением, оформите подписку PRO или активируйте промокод на бесплатный период.",
  "paywall.trial7": "7 дней бесплатно, потом $4/неделю",
  "paywall.monthly": "Оформить PRO за $2/неделю",
  "paywall.cardNote":
    "Для триала на 7 дней нужна карта. Списание начнётся после триала, отменить можно в любой момент.",
  "paywall.cardNote.trialUsed": "Оплата раз в неделю. Отменить можно в любой момент.",
  "paywall.orPromo": "или активируйте промокод",
  "paywall.refresh": "Я уже оплатил — обновить",
  "paywall.logout": "Выйти ({email})",
  "paywall.trial7Cta": "Оформить PRO за $4/неделю",
  "paywall.trialEnded.subtitle":
    "7 бесплатных дней закончились. Оформите подписку, чтобы продолжить пользоваться приложением.",
  "paywall.cardNote.direct": "Оплата раз в неделю. Отменить можно в любой момент.",

  "trial.grantedToast": "Вам доступно 7 дней бесплатно",
  "trial.badge": "Триал · осталось {days} дн.",
  "trial.endingToast": "Триал заканчивается {date}",
  "trial.modal.title": "Триал Siplinx AI PRO",
  "trial.modal.text":
    "Бесплатный доступ закончится {date}. Оформите подписку, чтобы пользоваться приложением после триала.",

  "account.title": "Аккаунт",
  "account.planFree": "План: Free",
  "account.planProLabel": "PRO",
  "account.planProUntil": "Оплачено до {date} включительно",
  "account.planTrialLabel": "Пробный период",
  "account.planTrialUntil": "Доступен до {date} включительно",
  "account.planDatePending": "Дата окончания подписки пока недоступна",
  "account.signOut": "Выйти",
  "account.buyNow": "Оплатить сейчас",
  "account.emailPrefs": "Письма с советами и предложениями",
  "account.emailPrefsHint": "Иногда советы по продукту и специальные предложения.",

  "pro.upgrade": "Оформить PRO",
  "pro.busy": "Ждём оплату…",
  "pro.manage": "Управлять подпиской",
  "pro.manageError": "Не удалось открыть настройки подписки. Попробуйте ещё раз через минуту.",
  "pro.featureLocked": "{feature} — функция PRO",
  "pro.featureLockedGeneric": "Функция PRO",
  "pro.unlock": "Оформите подписку Siplinx AI PRO, чтобы разблокировать.",
  "pro.orPromoLong": "или активируйте промокод на бесплатный период",

  "promo.placeholder": "Промокод",
  "promo.activate": "Активировать",
  "promo.activating": "Активируем…",
  "promo.success": "Промокод активирован — открываем PRO…",
  "promo.err.invalid_code": "Неверный промокод",
  "promo.err.already_pro": "У вас уже активна PRO-подписка",
  "promo.err.unauthorized": "Сессия истекла, войдите заново",
  "promo.err.network": "Нет связи с сервером",
  "promo.err.server": "Ошибка сервера",

  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.delete": "Удалить",
  "common.close": "Закрыть",
  "common.confirm": "Подтвердить",
  "common.back": "Назад",
  "common.next": "Далее",
  "common.continue": "Продолжить",
  "common.retry": "Повторить",
  "common.loading": "Загрузка…",
};
