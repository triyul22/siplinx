/**
 * Тексты секвенции (RU + EN). Одна автоматическая цепочка на 7-дневный триал:
 * welcome -> ценность -> окончание триала -> последний день -> win-back x3 +
 * paid_welcome при оплате. Тон: живой, от первого лица (Julia), без канцелярита,
 * без длинных тире. 100-200 слов, одна кнопка-CTA.
 *
 * Классы писем (юридическая рамка):
 *  - marketing:false = сервисные/lifecycle (1-4, paid_welcome). Приходят всем
 *    неотписавшимся, согласие не требуется.
 *  - marketing:true  = рекламные (win-back 5-7). Только marketing_opt_in=true.
 */

export type CtaKind =
  | "app"              // открыть приложение
  | "checkout_trial7"  // продолжить за $4/нед (пейволл в приложении)
  | "redeem_comeback"  // вернуть PRO / активировать ещё 7 дней
  | "portal";          // управление подпиской

export type Lang = "ru" | "en";

export type LocalizedCopy = {
  subject: string;
  /** Preheader (превью-строка в инбоксе). */
  preview: string;
  /** Абзацы тела письма. */
  body: string[];
  cta: string;
};

export type EmailTemplate = {
  key: string;
  /** true = рекламное письмо (нужен marketing_opt_in). */
  marketing: boolean;
  ctaKind: CtaKind;
  ru: LocalizedCopy;
  en: LocalizedCopy;
};

export const TEMPLATES: EmailTemplate[] = [
  // 1. trial_welcome — T0 + 15 мин
  {
    key: "trial_welcome",
    marketing: false,
    ctaKind: "app",
    ru: {
      subject: "Ваши 7 дней Siplinx PRO активны",
      preview: "Один шаг, чтобы получить первую заметку по встрече.",
      body: [
        "Привет! Это Юлия из Siplinx.",
        "Ваш PRO включён на 7 дней: запись встреч, транскрипт и авто-заметки после остановки. Никаких карт и списаний, просто пользуйтесь.",
        "Один следующий шаг: запустите первую встречу (или импортируйте готовую запись). Через пару минут после остановки Siplinx сам соберёт саммари и решения по встрече. Это тот момент, ради которого всё и затевалось.",
        "Если что-то не заводится, ответьте на это письмо. Я читаю каждый ответ.",
      ],
      cta: "Записать первую встречу",
    },
    en: {
      subject: "Your 7 days of Siplinx PRO are live",
      preview: "One step to get your first meeting notes.",
      body: [
        "Hi, it's Julia from Siplinx.",
        "Your PRO is on for 7 days: meeting capture, transcript and auto-notes right after you stop. No card, no charge, just use it.",
        "One next step: start your first meeting (or import a recording you already have). A couple of minutes after you stop, Siplinx builds the summary and the decisions for you. That is the whole point.",
        "If anything does not work, just reply to this email. I read every reply.",
      ],
      cta: "Record your first meeting",
    },
  },

  // 2. trial_value — T0 + 2 дня
  {
    key: "trial_value",
    marketing: false,
    ctaKind: "app",
    ru: {
      subject: "3 приёма, чтобы выжать из Siplinx максимум",
      preview: "Авто-заметки, шаблоны саммари и импорт файлов.",
      body: [
        "Пара дней прошла, покажу, что обычно проходит мимо.",
        "Заметки после встречи собираются сами, как только вы остановили запись, вручную ничего запускать не надо. Ещё у каждого типа встречи свой шаблон саммари: созвон с клиентом, стендап, интервью. Выберите свой, и формат подстроится. И можно закинуть в Siplinx готовый аудио- или видеофайл, чтобы получить по нему транскрипт с заметками, даже если сама встреча прошла без нас.",
        "Попробуйте хоть что-то из этого сегодня, разница видна сразу.",
      ],
      cta: "Открыть Siplinx",
    },
    en: {
      subject: "3 tricks to get the most out of Siplinx",
      preview: "Auto-notes, summary templates and file import.",
      body: [
        "A couple of days in, here is what usually slips past people.",
        "Notes are built for you the moment you stop recording, nothing to start by hand. Each meeting type also has its own summary template: client call, standup, interview. Pick yours and the format follows. And you can drop an existing audio or video file into Siplinx to get a transcript and notes from it, even if the meeting itself happened without us.",
        "Try any one of these today, the difference shows right away.",
      ],
      cta: "Open Siplinx",
    },
  },

  // 3. trial_ending_2d — T0 + 5 дней
  {
    key: "trial_ending_2d",
    marketing: false,
    ctaKind: "checkout_trial7",
    ru: {
      subject: "Осталось 2 дня PRO",
      preview: "Что сохранится и что стоит продолжить за $4 в неделю.",
      body: [
        "Небольшое предупреждение: через 2 дня ваш триал заканчивается.",
        "Всё, что уже записано, останется с вами: встречи, транскрипты и заметки. Без PRO остановятся только новые записи и авто-саммари по ним.",
        "Продолжить стоит $4 в неделю, дешевле одного кофе. Взамен не придётся потом по памяти собирать, о чём договорились на встрече. Оформить можно прямо в приложении, карта спишется только когда триал закончится.",
      ],
      cta: "Продолжить за $4/нед",
    },
    en: {
      subject: "2 days of PRO left",
      preview: "What stays, and why $4 a week is worth it.",
      body: [
        "A quick heads-up: your trial ends in 2 days.",
        "Everything you already recorded stays with you: meetings, transcripts and notes are safe. Without PRO, only new recordings and their auto-summaries stop.",
        "Keeping it is $4 a week, less than one coffee. In return you do not have to piece together later what was agreed in a meeting. You can set it up right in the app, and your card is only charged once the trial ends.",
      ],
      cta: "Continue for $4/wk",
    },
  },

  // 4. trial_last_day — T0 + 6.5 дней
  {
    key: "trial_last_day",
    marketing: false,
    ctaKind: "checkout_trial7",
    ru: {
      subject: "Сегодня последний день PRO",
      preview: "Оставить PRO можно за минуту.",
      body: [
        "Коротко и по делу: сегодня последний день вашего триала.",
        "Если Siplinx оказался полезен, оставьте PRO за $4 в неделю, чтобы записи и авто-заметки продолжили работать. Если нет, ничего делать не нужно, всё уже сохранённое останется с вами.",
      ],
      cta: "Оставить PRO",
    },
    en: {
      subject: "Last day of PRO",
      preview: "Keeping PRO takes a minute.",
      body: [
        "Short and to the point: today is the last day of your trial.",
        "If Siplinx has been useful, keep PRO for $4 a week so recordings and auto-notes keep running. If not, you do not need to do anything, everything you already saved stays with you.",
      ],
      cta: "Keep PRO",
    },
  },

  // 5. winback_1 — T0 + 8 дней (реклама, только opt-in)
  {
    key: "winback_1",
    marketing: true,
    ctaKind: "redeem_comeback",
    ru: {
      subject: "Ваши заметки на месте",
      preview: "И вот что вернётся вместе с PRO.",
      body: [
        "Триал закончился, но ваши встречи и заметки никуда не пропали, они ждут вас в приложении.",
        "С PRO вернётся то, чего сейчас не хватает: новые записи, транскрипт в реальном времени и авто-саммари после каждой встречи. Без этого следующий важный созвон снова придётся держать в голове.",
        "Если было полезно, вернуть PRO можно в один клик.",
      ],
      cta: "Вернуть PRO",
    },
    en: {
      subject: "Your notes are still here",
      preview: "And here is what comes back with PRO.",
      body: [
        "Your trial ended, but your meetings and notes did not go anywhere, they are waiting in the app.",
        "With PRO you get back what is missing right now: new recordings, live transcript and an auto-summary after every meeting. Without it, your next important call is back to living in your head.",
        "If it was useful, getting PRO back is one click.",
      ],
      cta: "Get PRO back",
    },
  },

  // 6. winback_2 — T0 + 12 дней (оффер: промокод ещё 7 дней)
  {
    key: "winback_2",
    marketing: true,
    ctaKind: "redeem_comeback",
    ru: {
      subject: "Ещё 7 дней PRO за наш счёт",
      preview: "Промокод COMEBACK7 внутри.",
      body: [
        "Похоже, семи дней не хватило, чтобы распробовать. Бывает.",
        "Держите ещё неделю PRO бесплатно, без карты: промокод COMEBACK7. Активируйте его в приложении в разделе подписки, и записи с авто-заметками снова включатся на 7 дней.",
        "В этот раз попробуйте прогнать через Siplinx хотя бы одну реальную рабочую встречу от начала до конца. Обычно именно тогда и щёлкает.",
      ],
      cta: "Активировать ещё 7 дней",
    },
    en: {
      subject: "7 more days of PRO on us",
      preview: "Promo code COMEBACK7 inside.",
      body: [
        "Looks like seven days was not enough to really try it. Happens.",
        "Here is another week of PRO for free, no card: promo code COMEBACK7. Activate it in the app under subscription, and recordings with auto-notes switch back on for 7 days.",
        "This time, run at least one real work meeting through Siplinx from start to finish. That is usually the moment it clicks.",
      ],
      cta: "Activate 7 more days",
    },
  },

  // 7. winback_3 — T0 + 20 дней (последнее)
  {
    key: "winback_3",
    marketing: true,
    ctaKind: "redeem_comeback",
    ru: {
      subject: "Последнее письмо от нас",
      preview: "Одна причина вернуться, и мы больше не побеспокоим.",
      body: [
        "Это последнее письмо, дальше не тревожу.",
        "Одна причина вернуться: после встречи вы открываете готовое саммари с решениями и задачами вместо того, чтобы по памяти восстанавливать, кто что обещал. Именно это Siplinx и делает за вас каждый раз.",
        "Если однажды снова понадобится, PRO ждёт в один клик. Спасибо, что попробовали.",
      ],
      cta: "Вернуть PRO",
    },
    en: {
      subject: "Our last email",
      preview: "One reason to come back, then we are done.",
      body: [
        "This is the last email, no more nudges after this.",
        "One reason to come back: after a meeting you open a ready summary with decisions and action items, instead of reconstructing from memory who promised what. That is what Siplinx does for you every time.",
        "If you ever need it again, PRO is one click away. Thanks for giving it a try.",
      ],
      cta: "Get PRO back",
    },
  },

  // 8. paid_welcome — при переходе в status=active
  {
    key: "paid_welcome",
    marketing: false,
    ctaKind: "portal",
    ru: {
      subject: "Спасибо, PRO активен",
      preview: "Как всё устроено и как управлять подпиской.",
      body: [
        "Спасибо, что остались с Siplinx PRO. Теперь записи, транскрипт и авто-заметки работают без ограничений.",
        "Пара честных моментов: подписка $4 в неделю, управлять и отменять можно в любой момент в настройках подписки, без писем и звонков. Отмена оставляет доступ до конца оплаченного периода.",
        "Если что-то идёт не так или есть идея, как сделать Siplinx лучше, просто ответьте на это письмо.",
      ],
      cta: "Открыть настройки подписки",
    },
    en: {
      subject: "Thanks, PRO is active",
      preview: "How it works and how to manage your subscription.",
      body: [
        "Thanks for staying with Siplinx PRO. Recordings, transcript and auto-notes now run without limits.",
        "A couple of honest notes: the subscription is $4 a week, and you can manage or cancel it anytime in subscription settings, no emails or calls needed. Cancelling keeps access until the end of the paid period.",
        "If something goes wrong or you have an idea to make Siplinx better, just reply to this email.",
      ],
      cta: "Open subscription settings",
    },
  },
];

export function getTemplate(key: string): EmailTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

/** locale начинается с 'ru' -> RU, иначе EN. */
export function pickLang(locale: string | null | undefined): Lang {
  return (locale ?? "").toLowerCase().startsWith("ru") ? "ru" : "en";
}
