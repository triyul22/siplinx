# Siplinx AI: документация разработчика

Единый источник знаний о проекте. Написана так, чтобы разработчик (или ИИ-агент), получив баг или фичу, мог с первого раза найти нужный код, понять причину и не наступить на известные грабли.

**Дата актуальности: 13 июля 2026. Версия приложения: 0.3.33.**

## Как пользоваться

1. Начни с [01-overview.md](01-overview.md): что это за продукт, из чего состоит, что где живёт.
2. Найди свой симптом в таблице ниже и открой профильный документ.
3. **Перед любой правкой обязательно прочитай [06-known-issues.md](06-known-issues.md)**: там история всех багов с корневыми причинами и список хрупких мест. Половина «новых» багов - это рецидивы или соседи уже решённых.
4. Перед сборкой/релизом прочитай [05-release-ci.md](05-release-ci.md) и [07-dev-environment.md](07-dev-environment.md): локальная сборка на текущей dev-машине сломана, проверка идёт через CI.

## Карта документов

| Файл | Что внутри |
|---|---|
| [01-overview.md](01-overview.md) | Продукт, архитектура, инфраструктура, версии, где хранятся данные, два варианта билда |
| [02-desktop-rust.md](02-desktop-rust.md) | Rust-ядро (`frontend/src-tauri`): запись, транскрипция, саммари, аналитика, детект встреч |
| [03-desktop-ui.md](03-desktop-ui.md) | Next.js UI: контексты, auth/paywall, пилюля, настройки, события Tauri |
| [04-auth-service.md](04-auth-service.md) | Облачный сервис (Vercel): OAuth, Polar-биллинг, триалы, рефералка, email, чат, облачное саммари |
| [05-release-ci.md](05-release-ci.md) | GitHub Actions, рецепт релиза, апдейтер, подпись, trial/direct варианты |
| [06-known-issues.md](06-known-issues.md) | История решённых багов (симптом → корень → фикс), открытые баги, хрупкие места |
| [07-dev-environment.md](07-dev-environment.md) | Dev-машина, git-аккаунты, как проверять код без локальной сборки, доступ к прод-БД, харнессы |
| [08-user-scenarios-qa.md](08-user-scenarios-qa.md) | End-to-end пользовательские сценарии, P0/P1/P2 QA-матрица, что автоматизировать |

## Роутинг по симптомам

| Симптом | Куда смотреть |
|---|---|
| Не стартует / падает запись | [02](02-desktop-rust.md) §3-4 + [06](06-known-issues.md) (AVX-512, GPU TDR, гейт готовности модели) |
| Плохая/пустая транскрипция, не тот язык | [02](02-desktop-rust.md) §4 + [06](06-known-issues.md) (whisper-параметры, выбор Parakeet/Whisper) |
| Саммари плохое / на английском / не генерится | [02](02-desktop-rust.md) §5 + `docs/SUMMARY_LOGIC.md` + [04](04-auth-service.md) §7 (облачный путь) |
| Вход через Google не работает | [04](04-auth-service.md) §4 + [06](06-known-issues.md) (CORS-заголовки - первый подозреваемый!) |
| Пейволл/триал/подписка ведут себя странно | [04](04-auth-service.md) §5-6 + [03](03-desktop-ui.md) §4 |
| Нужно проверить релиз end-to-end | [08](08-user-scenarios-qa.md) (P0 smoke + полная матрица сценариев) |
| Апдейтер не видит версию / «не удалось скачать» | [05](05-release-ci.md) §4-5 + [06](06-known-issues.md) (коллизии версий, untagged-URL) |
| Пилюля/таймеры записи рассинхронены | [03](03-desktop-ui.md) §3 + [06](06-known-issues.md) (4 независимых таймера) |
| Событий нет в PostHog | [02](02-desktop-rust.md) §8 + [06](06-known-issues.md) (EU-эндпоинт, дроп до identify) |
| CI падает | [05](05-release-ci.md) §7 (Cargo.lock, macos-14, next/font, rust-cache key) |
| Эндпоинт auth-service отдаёт 404 в проде | [04](04-auth-service.md) §9: алиас `siplinx-ai.vercel.app` перевешивается вручную после каждого деплоя |
| Письма не уходят | [04](04-auth-service.md) §8 (cron только раз в сутки на Hobby-плане) |

## Пять фактов, которые надо знать всегда

1. **Источник версии - только `frontend/src-tauri/tauri.conf.json`** (`"version"`). `Cargo.toml` (0.3.0) и `package.json` (0.3.0) не бампаются и не используются в релизе.
2. **Никогда не пересобирать релиз с тем же номером версии.** Всегда бамп на новый уникальный номер (см. [05](05-release-ci.md) §5).
3. **После каждого `vercel deploy --prod` для auth-service вручную перевешивать алиас**: `vercel alias set <new-deployment-url> siplinx-ai.vercel.app`. Иначе прод-домен отдаёт старый код.
4. **Логи приложения на Windows**: `%LOCALAPPDATA%\com.siplinx.ai\logs\siplinx.log` (macOS: `~/Library/Logs/com.siplinx.ai/siplinx.log`). Это первый источник при любой диагностике.
5. **Локальная сборка Rust на dev-машине Юлии сломана** (линковка ort/MSVC). Проверка кода: `cargo check` + `tsc --noEmit` локально, полная сборка - через workflow `build-windows.yml` в CI (см. [07](07-dev-environment.md)).

## Памятка Codex: как собирать релизный билд

GitHub push сам сборку не запускает: все workflows ручные. Prod desktop build делается через manual dispatch `.github/workflows/release.yml`.

1. `cd C:\Users\Asus\Documents\personal_ai\projects\siplinxai`; проверить `git status`.
2. Бампнуть `frontend/src-tauri/tauri.conf.json` на новый уникальный `version`. Нельзя пересобирать тот же номер версии.
3. Проверки: из `frontend/` выполнить `.\node_modules\.bin\tsc.cmd --noEmit`; из корня выполнить `node .\scripts\qa-p0-contracts.js` и `git diff --check`.
4. Commit + push строго в текущую релизную ветку, например `codex/p0-user-flow-build-20260713`: `git add -- frontend/src-tauri/tauri.conf.json <другие файлы фикса>`; `git commit -m "..."`; `git push origin codex/p0-user-flow-build-20260713`.
5. Проверить, что remote-ветка на нужном commit: `git rev-parse HEAD` и `git ls-remote origin refs/heads/codex/p0-user-flow-build-20260713` должны совпасть.
6. Запустить release через GitHub API из PowerShell:
   `$credInput = "protocol=https`nhost=github.com`n`n"` → `$cred = $credInput | git credential fill` → `$token = (($cred | Where-Object { $_ -like 'password=*' } | Select-Object -First 1).Substring(9))`; затем `Invoke-WebRequest -Method Post -Uri "https://api.github.com/repos/aman-tiger/siplinxai/actions/workflows/release.yml/dispatches" -Headers @{ Authorization = "Bearer $token"; Accept = "application/vnd.github+json"; "X-GitHub-Api-Version" = "2022-11-28"; "User-Agent" = "Codex" } -Body (@{ ref = "codex/p0-user-flow-build-20260713" } | ConvertTo-Json -Compress) -ContentType "application/json" -UseBasicParsing`. Успех = HTTP `204`.
7. Найти run: `Invoke-RestMethod -Method Get -Uri "https://api.github.com/repos/aman-tiger/siplinxai/actions/workflows/release.yml/runs?branch=codex/p0-user-flow-build-20260713&per_page=5" -Headers $headers`.
8. После success проверить `https://github.com/aman-tiger/siplinxai/releases/latest/download/latest.json`: version новая, URL вида `releases/download/v<version>/...`, без `untagged`, ассеты trial/direct на месте.

## Смежные документы в репо

- `docs/SUMMARY_LOGIC.md`: детальная спека пайплайна саммари (промпты, параметры).
- `docs/DIARIZATION_PLAN.md`: план диаризации (не реализовано).
- `TZ-*.md` в корне: техзадания по фичам (биллинг, рефералка, email, UX, облачная транскрипция).
- `.github/workflows/WORKFLOWS_OVERVIEW.md`: обзор CI-воркфлоу.
- `AUTH_POLAR_SETUP.md`: первичная настройка auth + Polar (частично устарел).
- Корневой `CLAUDE.md`/`AGENTS.md`: наследие апстрима Meetily. **Частично устарели** (описывают FastAPI-бэкенд как обязательный и выгрузку модели после записи - оба утверждения больше не верны). При конфликте верить этой папке.
