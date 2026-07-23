# Siplinx — email-секвенция (превью для согласования)

Одна автоматическая цепочка на 7-дневный триал. Провайдер: Resend. Отсчёт `T0` = момент выдачи авто-триала (`auto_trial_granted_at`). Cron проверяет «созревшие» письма раз в час. Каждое письмо: одна колонка, одна кнопка-CTA, футер с причиной и ссылкой отписки. Тон живой, от первого лица (Julia), без длинных тире.

Классы писем:
- **Сервисные** (1-4, paid_welcome): приходят всем, кто не отписался. Согласие не требуется.
- **Рекламные** (win-back 5-7): только тем, у кого `marketing_opt_in = true` (галочка при входе / тумблер в настройках).

---

## Таймлайн для НЕоплатившего юзера

### Вариант A. Юзер поставил галочку согласия (marketing_opt_in = true)

| День | Письмо | Класс | Тема (RU) |
|---|---|---|---|
| T0 + 15 мин | `trial_welcome` | сервисное | Ваши 7 дней Siplinx PRO активны |
| T0 + 2 дня | `trial_value` | сервисное | 3 приёма, чтобы выжать из Siplinx максимум |
| T0 + 5 дней | `trial_ending_2d` | сервисное | Осталось 2 дня PRO |
| T0 + 6.5 дней | `trial_last_day` | сервисное | Сегодня последний день PRO |
| T0 + 8 дней | `winback_1` | рекламное | Ваши заметки на месте |
| T0 + 12 дней | `winback_2` | рекламное | Ещё 7 дней PRO за наш счёт |
| T0 + 20 дней | `winback_3` | рекламное | Последнее письмо от нас |

Итого **7 писем** за 20 дней.

### Вариант B. Юзер НЕ поставил галочку (marketing_opt_in = false)

| День | Письмо | Отправляется? |
|---|---|---|
| T0 + 15 мин | `trial_welcome` | да (сервисное) |
| T0 + 2 дня | `trial_value` | да (сервисное) |
| T0 + 5 дней | `trial_ending_2d` | да (сервисное) |
| T0 + 6.5 дней | `trial_last_day` | да (сервисное) |
| T0 + 8 дней | `winback_1` | нет (нужен opt-in) |
| T0 + 12 дней | `winback_2` | нет (нужен opt-in) |
| T0 + 20 дней | `winback_3` | нет (нужен opt-in) |

Итого **4 письма**. Win-back не шлётся без согласия.

> Отписка в любой момент останавливает вообще всё (в т.ч. сервисные).

---

## Таймлайн для ОПЛАТИВШЕГО юзера

Пример: оплатил на 6-й день триала.

| День | Событие | Письмо |
|---|---|---|
| T0 + 15 мин | старт триала | `trial_welcome` |
| T0 + 2 дня | — | `trial_value` |
| T0 + 5 дней | — | `trial_ending_2d` |
| T0 + 6 дней | **оплата (status=active)** | `paid_welcome` |
| T0 + 6.5 дней | триал-письмо гасится | не шлётся |
| T0 + 8/12/20 дней | win-back гасится | не шлётся |

После перехода в `status=active` секвенция 1-7 останавливается, приходит только **`paid_welcome`**. Итого в примере **4 письма** (3 триальных до оплаты + paid_welcome). Если бы оплатил в первый час — пришло бы только `trial_welcome` (уже ушло) и `paid_welcome`.

> `paid_welcome` приходит при оплате в любой момент, в том числе если юзер вообще пропустил триал и купил сразу (direct-билд, $2/нед).

---

# Тексты писем (первое → последнее)

Ниже полный текст RU и EN. Кнопка ведёт в приложение (реальная оплата/промокод активируются внутри Siplinx). В каждом письме внизу: «Вы получили это письмо, потому что создали аккаунт Siplinx» + ссылка отписки.

## 1. `trial_welcome` — T0 + 15 минут (сервисное)

**RU · Тема:** Ваши 7 дней Siplinx PRO активны
**Превью:** Один шаг, чтобы получить первую заметку по встрече.

> Привет! Это Юлия из Siplinx.
>
> Ваш PRO включён на 7 дней: запись встреч, транскрипт и авто-заметки после остановки. Никаких карт и списаний, просто пользуйтесь.
>
> Один следующий шаг: запустите первую встречу (или импортируйте готовую запись). Через пару минут после остановки Siplinx сам соберёт саммари и решения по встрече. Это тот момент, ради которого всё и затевалось.
>
> Если что-то не заводится, ответьте на это письмо. Я читаю каждый ответ.

**CTA:** Записать первую встречу

**EN · Subject:** Your 7 days of Siplinx PRO are live
**Preview:** One step to get your first meeting notes.

> Hi, it's Julia from Siplinx.
>
> Your PRO is on for 7 days: meeting capture, transcript and auto-notes right after you stop. No card, no charge, just use it.
>
> One next step: start your first meeting (or import a recording you already have). A couple of minutes after you stop, Siplinx builds the summary and the decisions for you. That is the whole point.
>
> If anything does not work, just reply to this email. I read every reply.

**CTA:** Record your first meeting

---

## 2. `trial_value` — T0 + 2 дня (сервисное)

**RU · Тема:** 3 приёма, чтобы выжать из Siplinx максимум
**Превью:** Авто-заметки, шаблоны саммари и импорт файлов.

> Пара дней прошла, покажу, что обычно проходит мимо.
>
> Заметки после встречи собираются сами, как только вы остановили запись, вручную ничего запускать не надо. Ещё у каждого типа встречи свой шаблон саммари: созвон с клиентом, стендап, интервью. Выберите свой, и формат подстроится. И можно закинуть в Siplinx готовый аудио- или видеофайл, чтобы получить по нему транскрипт с заметками, даже если сама встреча прошла без нас.
>
> Попробуйте хоть что-то из этого сегодня, разница видна сразу.

**CTA:** Открыть Siplinx

**EN · Subject:** 3 tricks to get the most out of Siplinx
**Preview:** Auto-notes, summary templates and file import.

> A couple of days in, here is what usually slips past people.
>
> Notes are built for you the moment you stop recording, nothing to start by hand. Each meeting type also has its own summary template: client call, standup, interview. Pick yours and the format follows. And you can drop an existing audio or video file into Siplinx to get a transcript and notes from it, even if the meeting itself happened without us.
>
> Try any one of these today, the difference shows right away.

**CTA:** Open Siplinx

---

## 3. `trial_ending_2d` — T0 + 5 дней (сервисное)

**RU · Тема:** Осталось 2 дня PRO
**Превью:** Что сохранится и что стоит продолжить за $4 в неделю.

> Небольшое предупреждение: через 2 дня ваш триал заканчивается.
>
> Всё, что уже записано, останется с вами: встречи, транскрипты и заметки. Без PRO остановятся только новые записи и авто-саммари по ним.
>
> Продолжить стоит $4 в неделю, дешевле одного кофе. Взамен не придётся потом по памяти собирать, о чём договорились на встрече. Оформить можно прямо в приложении, карта спишется только когда триал закончится.

**CTA:** Продолжить за $4/нед

**EN · Subject:** 2 days of PRO left
**Preview:** What stays, and why $4 a week is worth it.

> A quick heads-up: your trial ends in 2 days.
>
> Everything you already recorded stays with you: meetings, transcripts and notes are safe. Without PRO, only new recordings and their auto-summaries stop.
>
> Keeping it is $4 a week, less than one coffee. In return you do not have to piece together later what was agreed in a meeting. You can set it up right in the app, and your card is only charged once the trial ends.

**CTA:** Continue for $4/wk

---

## 4. `trial_last_day` — T0 + 6.5 дней (сервисное)

**RU · Тема:** Сегодня последний день PRO
**Превью:** Оставить PRO можно за минуту.

> Коротко и по делу: сегодня последний день вашего триала.
>
> Если Siplinx оказался полезен, оставьте PRO за $4 в неделю, чтобы записи и авто-заметки продолжили работать. Если нет, ничего делать не нужно, всё уже сохранённое останется с вами.

**CTA:** Оставить PRO

**EN · Subject:** Last day of PRO
**Preview:** Keeping PRO takes a minute.

> Short and to the point: today is the last day of your trial.
>
> If Siplinx has been useful, keep PRO for $4 a week so recordings and auto-notes keep running. If not, you do not need to do anything, everything you already saved stays with you.

**CTA:** Keep PRO

---

## 5. `winback_1` — T0 + 8 дней (рекламное, только opt-in)

**RU · Тема:** Ваши заметки на месте
**Превью:** И вот что вернётся вместе с PRO.

> Триал закончился, но ваши встречи и заметки никуда не пропали, они ждут вас в приложении.
>
> С PRO вернётся то, чего сейчас не хватает: новые записи, транскрипт в реальном времени и авто-саммари после каждой встречи. Без этого следующий важный созвон снова придётся держать в голове.
>
> Если было полезно, вернуть PRO можно в один клик.

**CTA:** Вернуть PRO

**EN · Subject:** Your notes are still here
**Preview:** And here is what comes back with PRO.

> Your trial ended, but your meetings and notes did not go anywhere, they are waiting in the app.
>
> With PRO you get back what is missing right now: new recordings, live transcript and an auto-summary after every meeting. Without it, your next important call is back to living in your head.
>
> If it was useful, getting PRO back is one click.

**CTA:** Get PRO back

---

## 6. `winback_2` — T0 + 12 дней (рекламное, оффер промокода)

**RU · Тема:** Ещё 7 дней PRO за наш счёт
**Превью:** Промокод COMEBACK7 внутри.

> Похоже, семи дней не хватило, чтобы распробовать. Бывает.
>
> Держите ещё неделю PRO бесплатно, без карты: промокод COMEBACK7. Активируйте его в приложении в разделе подписки, и записи с авто-заметками снова включатся на 7 дней.
>
> В этот раз попробуйте прогнать через Siplinx хотя бы одну реальную рабочую встречу от начала до конца. Обычно именно тогда и щёлкает.

**CTA:** Активировать ещё 7 дней

**EN · Subject:** 7 more days of PRO on us
**Preview:** Promo code COMEBACK7 inside.

> Looks like seven days was not enough to really try it. Happens.
>
> Here is another week of PRO for free, no card: promo code COMEBACK7. Activate it in the app under subscription, and recordings with auto-notes switch back on for 7 days.
>
> This time, run at least one real work meeting through Siplinx from start to finish. That is usually the moment it clicks.

**CTA:** Activate 7 more days

> Требует завести промокод `COMEBACK7` заранее (env `TRIAL_CODE` многоразовый по умолчанию; при желании завести отдельный код под win-back).

---

## 7. `winback_3` — T0 + 20 дней (рекламное, последнее)

**RU · Тема:** Последнее письмо от нас
**Превью:** Одна причина вернуться, и мы больше не побеспокоим.

> Это последнее письмо, дальше не тревожу.
>
> Одна причина вернуться: после встречи вы открываете готовое саммари с решениями и задачами вместо того, чтобы по памяти восстанавливать, кто что обещал. Именно это Siplinx и делает за вас каждый раз.
>
> Если однажды снова понадобится, PRO ждёт в один клик. Спасибо, что попробовали.

**CTA:** Вернуть PRO

**EN · Subject:** Our last email
**Preview:** One reason to come back, then we are done.

> This is the last email, no more nudges after this.
>
> One reason to come back: after a meeting you open a ready summary with decisions and action items, instead of reconstructing from memory who promised what. That is what Siplinx does for you every time.
>
> If you ever need it again, PRO is one click away. Thanks for giving it a try.

**CTA:** Get PRO back

---

## 8. `paid_welcome` — при переходе в status=active (сервисное)

**RU · Тема:** Спасибо, PRO активен
**Превью:** Как всё устроено и как управлять подпиской.

> Спасибо, что остались с Siplinx PRO. Теперь записи, транскрипт и авто-заметки работают без ограничений.
>
> Пара честных моментов: подписка $4 в неделю, управлять и отменять можно в любой момент в настройках подписки, без писем и звонков. Отмена оставляет доступ до конца оплаченного периода.
>
> Если что-то идёт не так или есть идея, как сделать Siplinx лучше, просто ответьте на это письмо.

**CTA:** Открыть настройки подписки

**EN · Subject:** Thanks, PRO is active
**Preview:** How it works and how to manage your subscription.

> Thanks for staying with Siplinx PRO. Recordings, transcript and auto-notes now run without limits.
>
> A couple of honest notes: the subscription is $4 a week, and you can manage or cancel it anytime in subscription settings, no emails or calls needed. Cancelling keeps access until the end of the paid period.
>
> If something goes wrong or you have an idea to make Siplinx better, just reply to this email.

**CTA:** Open subscription settings
