# 08. Пользовательские сценарии и QA-матрица

Дата: 13 июля 2026. Цель документа - единая карта end-to-end сценариев, которые
надо прогонять перед релизом и при расследовании багов. Это living checklist:
после каждого нового бага добавлять сюда сценарий, ожидаемый результат и уровень
автоматизации.

## Как читать

Уровни:

- **P0 smoke** - прогонять перед каждым релизом.
- **P1 regression** - прогонять при изменении затронутого домена.
- **P2 edge** - прогонять перед крупным релизом или если баг похож на сценарий.

Тип проверки:

- **Auto** - можно покрыть локальным unit/contract тестом.
- **Harness** - нужен скрипт/мок внешнего сервиса или подготовленная БД.
- **Manual** - нужен установленный desktop, macOS/Windows, реальные разрешения или Polar.

Источники истины: логи desktop (`siplinx.log`), `auth-service` Vercel logs,
Postgres `user_entitlement`, PostHog Activity, UI toasts.

## P0 Smoke Перед Релизом

Перед ручным P0-прогоном запустить быстрые контрактные проверки:

```powershell
node scripts/qa-p0-contracts.js
```

| ID | Сценарий | Платформа | Ожидаемый результат |
|---|---|---|---|
| P0-AUTH-01 | Новый юзер: install → Google login → auto-trial | macOS + Windows | Login завершается, `/api/me` возвращает `plan=pro,status=trialing,managedByPolar=false` |
| P0-BILL-01 | Trial user нажимает "Оплатить сейчас" | web/auth-service | Polar checkout не показывает второй 7-day trial после auto-trial |
| P0-REC-01 | Первая запись 30-60с → Stop | macOS + Windows | Stop не зависает, встреча появляется в SQLite/sidebar, IndexedDB draft помечен saved |
| P0-REC-02 | 4-я запись за день на no-card trial | desktop | Старт блокируется paywall-тостом, первые 3 записи разрешены |
| P0-SUM-01 | PRO + cloud summary ON + локальная Gemma отсутствует | desktop + auth-service | Саммари идёт через OpenAI cloud; нет ошибок `Built-in AI model not available` / `Ollama is not installed` |
| P0-SUM-02 | Cloud summary падает/402/503 | desktop | Есть понятная cloud-ошибка без silent local fallback и без запроса Ollama/Gemma |
| P0-LIFE-01 | macOS: свернуть/закрыть окно → открыть из Dock/tray | macOS | Главное окно возвращается, запись/статус не теряются |
| P0-RECOV-01 | Принудительно закрыть во время записи → открыть → Recover | macOS + Windows | Recovery показывает draft, восстанавливает transcript, не зацикливается |
| P0-UPD-01 | Check updates на текущей версии | Windows + macOS | Нет 404/untagged URL, latest.json указывает на текущий релиз |

## Auth И Billing

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| AUTH-01 | P0 | Первый вход нового trial-user | Очистить `auth.json`, новый Google account, открыть app, login | Deep-link возвращает токен, `/api/me` CORS preflight успешен, auto-trial выдан один раз | Manual/Harness |
| AUTH-02 | P1 | Старый юзер с cached session при network error | Отключить сеть после успешного `/api/me` | До 7 дней app открывается offline, `offline=true`; после истечения просит login | Harness |
| AUTH-03 | P1 | Token revoked/401 | Подменить/удалить сессию server-side | Клиент чистит session и показывает LoginScreen | Harness |
| AUTH-04 | P0 | CORS custom headers | OPTIONS `/api/me` с `Authorization,X-Billing-Mode,X-Locale` | `Access-Control-Allow-Headers` содержит все 3 кастомных заголовка | Auto |
| AUTH-05 | P0 | Закрыть неверный браузер во время Google login | Нажать login, закрыть открывшийся браузер/окно OAuth | Desktop остаётся на LoginScreen, при возврате фокуса попытка отменяется автоматически, можно сразу попробовать снова | Manual/Auto |
| AUTH-06 | P0 | Browser fallback после успешного OAuth | Уже вошедший Google/better-auth user проходит `/app/start` → `/app/complete` | Браузер показывает `Готово` + `Открыть Siplinx AI`, не остаётся бесконечно на `Входим...` | Manual/Auto |
| BILL-01 | P0 | Trial build фиксирует `user_source=trial` | `/api/me` с `X-Billing-Mode: trial` | `user_entitlement.user_source='trial'`, повторный direct-заголовок не меняет | Auto/Harness |
| BILL-02 | P0 | Direct build не получает auto-trial | `/api/me` direct → `/api/trial/auto` | `{ok:false,code:not_eligible}` | Auto/Harness |
| BILL-03 | P0 | Auto-trial строго 1 раз | Дважды вызвать `/api/trial/auto` | Первый `ok:true`, второй `already_used` | Auto/Harness |
| BILL-04 | P0 | Ранняя покупка во время no-card trial | Settings → Account → Buy now | Открывается `trial7` checkout без второго Polar trial; webhook переводит в `managedByPolar=true` | Manual |
| BILL-05 | P0 | Покупка после истечения no-card trial | Форсировать expired, нажать CTA на paywall | Checkout не содержит нового Polar trial, UI не обещает второй trial | Manual/Harness |
| BILL-06 | P1 | Polar webhook active | Симулировать `customer.state_changed` active/trialing | `plan=pro`, `managedByPolar=true`, portal доступен | Harness |
| BILL-07 | P1 | Portal without Polar customer | No-card trial user жмёт manage/buy paths | Portal не показывается; Buy now показывается | Manual |
| BILL-08 | P1 | Checkout REST error | Убрать product env или замокать 502 | UI сбрасывает busy, показывает ошибку/не зависает | Harness |
| BILL-09 | P1 | Paywall periodic re-check | Истёкший юзер оставляет app открытым | Нужен будущий фикс: re-check on focus/timer, сейчас известная дыра | Manual |

## Trial Usage Limit

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| TRIAL-01 | P0 | 1-3 встречи в день | No-card trial, старт/стоп 3 раза | Все 3 старта разрешены, счётчик `billing-usage.json` растёт | Manual |
| TRIAL-02 | P0 | 4-я встреча в тот же день | Нажать start после 3 успешных стартов | Старт блокируется до readiness/model checks, toast предлагает PRO | Manual/Auto |
| TRIAL-03 | P1 | Новый календарный день | Изменить дату/очистить day key | Лимит снова 3 встречи | Harness |
| TRIAL-04 | P1 | Paid Polar user | `managedByPolar=true` | Лимита встреч нет | Harness |
| TRIAL-05 | P2 | Offline no-card trial | Отключить сеть | Локальный лимит всё равно применяется | Manual |

Примечание: текущий лимит desktop-local и защищает UX/стоимость мягко. Если нужна
жёсткая защита от переустановки/очистки store, нужен серверный endpoint usage с
offline policy.

## Onboarding И Модели

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| MOD-01 | P0 | Первый запуск без моделей | Новый app data dir | Onboarding/фоновые загрузки стартуют, start recording блокируется понятным toast | Manual |
| MOD-02 | P0 | Parakeet скачан | Windows/RU default | Provider `parakeet`, запись стартует без Whisper | Manual |
| MOD-03 | P0 | macOS/RU default | macOS | Provider `localWhisper`, model `large-v3-q5_0`, Metal path | Manual |
| MOD-04 | P1 | Kazakh locale | Выбрать kk | Provider Whisper, не Parakeet | Manual |
| MOD-05 | P1 | Model downloading during start | Начать запись при downloading status | Start blocked, download toast, нет мёртвой кнопки | Harness |
| MOD-06 | P1 | Corrupted STT model | Подложить битый файл | Model manager показывает corrupted, start blocked | Harness |
| MOD-07 | P1 | Summary Gemma missing, PRO cloud ON | Удалить Gemma, cloud ON | Cloud summary bypasses local readiness | Manual/Harness |
| MOD-08 | P1 | Summary Gemma missing, cloud OFF/free | Удалить Gemma, cloud OFF | Понятный toast + model settings open | Manual |

## Recording Lifecycle

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| REC-01 | P0 | Start/Stop happy path | 30-60с речи → Stop | `recording-started`, transcripts visible, `recording-stopped`, SQLite save | Manual |
| REC-02 | P0 | Stop from tray | Start → tray stop | Rust stop + frontend post-processing both run, meeting saved | Manual |
| REC-03 | P1 | Stop from pill | Start via pill → stop via pill | Same as REC-01, no duplicate stop | Manual |
| REC-04 | P1 | Pause/resume | Start → pause 10с → resume → stop | Duration/activeDuration sensible, transcript resumes | Manual |
| REC-05 | P1 | Duplicate stop | Click stop + tray stop quickly | Guard prevents duplicate save, no poisoned state | Manual |
| REC-06 | P1 | Mic missing | Unplug/deny mic | Start fails with mic-specific error, no ghost recording | Manual |
| REC-07 | P1 | System audio missing | No loopback/system device | Mic-only recording continues with warning | Manual |
| REC-08 | P1 | Bluetooth disconnect | AirPods disconnect mid-recording | Device event/reconnect UX, no crash | Manual |
| REC-09 | P1 | Long meeting stop | 30+ min or synthetic queue | Stop progress visible, no premature save before chunks finish | Harness |
| REC-10 | P2 | Empty/no-speech recording | Silence 30с | Meeting saves or clearly says no transcript; no crash | Manual |
| REC-11 | P2 | Page navigation during recording | Start → open note/settings → stop from tray | Global post-processing saves meeting | Manual |

Known risk: Rust `get_transcription_status` is currently a stub, while frontend
stop-flow uses it to decide whether transcription is done. For weak machines and
slow local models, this is a high-priority regression target.

## Recovery

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| RECOV-01 | P0 | Crash during active recording | Kill app after transcripts appear | Startup shows recovery dialog after 15с threshold | Manual |
| RECOV-02 | P0 | Recover transcript-only | Draft with transcripts, no checkpoints | Saves to SQLite, toast says no audio, draft removed from recoverable list | Harness |
| RECOV-03 | P0 | Recover with checkpoints | Draft has `.checkpoints/*.mp4` | FFmpeg merges audio.mp4, SQLite save, checkpoints cleanup | Manual/Harness |
| RECOV-04 | P1 | Recover failure | Corrupt checkpoint or DB save error | Error toast, draft remains recoverable, user can retry/delete | Harness |
| RECOV-05 | P1 | Saved draft cleanup | Successful stop/save | `savedToSQLite=true`; after 24h cleanup removes IndexedDB draft | Harness |
| RECOV-06 | P1 | Reopen after stop but before frontend save | Close app immediately when Rust stop finishes | Either save completes or recovery can restore once, no duplicate/loop | Manual |

## Summary И Chat

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| SUM-01 | P0 | Cloud summary happy path | PRO + cloud ON + RU transcript | `/api/summary` OpenAI, Russian Markdown, без local fallback | Manual/Harness |
| SUM-02 | P0 | Cloud unavailable error | Remove OpenAI key/mock 503 | Summary fails clearly, `cloud_fallback` is not set, no Ollama/Gemma requirement | Harness |
| SUM-03 | P0 | Cloud PRO check | Free/expired user calls `/api/summary` | 402 `pro_required` | Auto |
| SUM-04 | P1 | Local BuiltIn happy path | Cloud OFF + Gemma ready | Extract/merge/compose, Russian prompt for Cyrillic | Manual/Harness |
| SUM-05 | P1 | BuiltIn model corrupted | Corrupt Gemma | UI blocks before generation with actionable model settings | Manual |
| SUM-06 | P1 | Long transcript | > local chunk threshold | Chunking works, no empty summary | Harness |
| SUM-07 | P1 | Cancel summary | Start → cancel | DB status cancelled, previous summary restored | Manual |
| SUM-08 | P1 | Regenerate failure | Existing summary + forced failure | Previous summary restored | Harness |
| CHAT-01 | P1 | Chat happy path | PRO meeting chat question | OpenAI answer returned, usage decremented | Manual |
| CHAT-02 | P1 | Chat daily limit | 5th chat request | 429 with visible UI error (currently missing catch is known bug) | Harness |

## Import, Retranscription, Meeting Details

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| IMP-01 | P1 | Import supported audio/video | Pick file | Transcription job, meeting created, summary available | Manual |
| IMP-02 | P1 | Import oversized/invalid file | Pick invalid/huge file | Validation error, no partial meeting | Manual |
| IMP-03 | P1 | Cancel import | Start import → cancel | Job stops, no stuck progress | Manual |
| RET-01 | P1 | Retranscribe existing meeting | Change language/model → retranscribe | Old meeting updated or clear failure, no data loss | Manual |
| RET-02 | P2 | Retranscribe while recording | Active recording + retranscribe | Blocked or queued safely | Manual |
| MD-01 | P1 | Rename/delete meeting | Rename, delete, reopen | Sidebar and details stay consistent | Manual |
| MD-02 | P1 | Copy transcript/summary | Click copy buttons | Clipboard content has relative timestamps/Markdown | Manual |

## macOS / Windows App Lifecycle

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| LIFE-01 | P0 | macOS minimize/dock reopen idle | Minimize/Cmd+H/close red button → Dock | Window shows and focuses | Manual |
| LIFE-02 | P0 | macOS minimize during recording | Start → minimize/Cmd+H → reopen | Recording state synced, stop button available | Manual |
| LIFE-03 | P0 | macOS close during stop processing | Stop → close window during processing | Either close is prevented or recovery path succeeds | Manual |
| LIFE-04 | P1 | macOS permissions | Deny/grant mic and screen recording | Clear onboarding/settings guidance, restart required if OS requires | Manual |
| LIFE-05 | P1 | Windows tray reopen | Hide/minimize → tray Open Main Window | Window shows/focuses | Manual |
| LIFE-06 | P1 | Single instance deep-link | App open → login deep-link | Existing window focuses and receives `deep-link-opened` | Manual |
| LIFE-07 | P2 | Autostart | OS login with `--autostart` | App stays hidden in tray, no surprise window | Manual |

## Settings, Updates, Analytics, Privacy

| ID | Уровень | Сценарий | Шаги | Ожидаемый результат | Тип |
|---|---|---|---|---|---|
| SET-01 | P1 | Change STT provider while idle | Settings → provider/model | Config saved, migrations not rerun incorrectly | Manual |
| SET-02 | P1 | Change STT provider while recording | Change during active recording | Save waits until `recording-stopped` | Manual |
| SET-03 | P1 | Cloud summary toggle | Toggle ON/OFF | ON routes PRO builtin to cloud; OFF requires local model | Manual |
| SET-04 | P1 | Language switch | ru/en | All visible strings switch; no missing keys | Manual/Auto |
| UPD-01 | P0 | latest.json contract | Fetch latest.json | URLs deterministic `releases/download/vX.Y.Z`, no `untagged` | Auto |
| UPD-02 | P1 | Update dialog download | Old version → update | Download/install succeeds or actionable error | Manual |
| ANA-01 | P1 | Analytics identify before events | Fresh app login | Events after identify show in EU PostHog | Manual |
| ANA-02 | P1 | Disable analytics | Toggle off | No further PostHog events, app still works | Manual |
| PRIV-01 | P1 | Local data paths | Open DB/models/logs folders | No secrets in logs, auth token still known TODO | Manual |

## Разбор Текущих Примеров

1. **Cloud AI не сработал, Built-in AI model not available**
   Вероятный корень: UI проверял локальную модель до выбора cloud path.
   Тесты: P0-SUM-01, MOD-07, SUM-01.

2. **Покупка показывает второй 7-day trial**
   Корень в текущем продукте: `trial7` checkout всегда добавлял Polar trial.
   Тесты: P0-BILL-01, BILL-04, BILL-05.

3. **Нужен лимит 3 встречи/день на trial**
   Реализован как desktop-local soft limit; нужен серверный hard limit, если это
   должно переживать переустановку и чистку store. Тесты: TRIAL-01..05.

4. **macOS свернули, потом не открылось**
   Нужен live-прогон LIFE-01..03. Подозрения: нет явного macOS activate handler,
   тяжёлые модели могут замедлять event loop/stop-flow.

5. **Восстановленные встречи появились и не восстановились**
   Вероятный класс: Rust остановил запись, но frontend save/markMeetingSaved не
   завершился; либо recovery падает на folder path/checkpoints/saveMeeting.
   Тесты: RECOV-01..06.

## Минимальный Набор Тестовых Аккаунтов

- `trial_new_*`: новый Google account, `user_source=trial`, без Polar customer.
- `direct_new_*`: direct build/source, auto-trial forbidden.
- `trial_expired_*`: `auto_trial_granted_at` задан, status expired/free.
- `polar_active_*`: active paid Polar customer.
- `polar_trialing_*`: Polar-managed trialing subscription.
- `free_expired_*`: no active entitlement.

## Что Автоматизировать Первым

1. Auth-service contract tests: CORS headers, `/api/trial/auto`, checkout payload
   with/without `auto_trial_granted_at`, `/api/summary` 401/402/400.
2. Frontend unit tests around `getCloudSummaryToken`/summary provider
   selection and trial limit store.
3. Rust/integration harness for stop-flow: non-stub transcription status and
   delayed transcript queue.
4. Playwright/Tauri smoke on built apps for P0 scenarios on macOS + Windows.
