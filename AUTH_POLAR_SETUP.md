# Авторизация Google + подписка Polar — интеграция

Документ связывает две части: облачный `auth-service/` и изменения в десктопе (`frontend/`).
Модель: **вход через Google обязателен для использования приложения**, **подписка Polar открывает PRO-фичи**.

## Архитектура

```
Desktop (Tauri)  ──HTTPS──>  auth-service (Next.js + Better Auth)  ──>  Google OAuth
   │  loopback 127.0.0.1                 │
   │  (приём токена)                     └──>  Polar (checkout, подписки, webhooks, portal)
   └─ хранит bearer-токен, ходит в /api/me, гейтит PRO
```

Почему облачный слой: подписка требует серверной истины и мгновенного отзыва доступа;
секреты Google/Polar не должны попадать в десктоп. Подробности — `auth-service/README.md`.

---

## Что нужно от тебя (ключи и аккаунты)

Полный чек-лист и куда вставлять — в **`auth-service/README.md`** → «Что нужно от тебя».
Кратко:

1. **Postgres** (Neon/Supabase) → `DATABASE_URL`
2. **Google OAuth** (Web client) → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - redirect URI: `https://<домен>/api/auth/callback/google`
3. **Polar** (организация, продукт-подписка с ценами мес/год, sandbox)
   → `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_ID_MONTHLY/YEARLY`
   - webhook: `https://<домен>/api/auth/polar/webhooks`, событие `customer.state_changed`
4. **Секрет сервиса** `BETTER_AUTH_SECRET`
5. **Домен сервиса** (напр. `auth.siplinx.ai`) — прописать в:
   - `auth-service` env (`BETTER_AUTH_URL`, `NEXT_PUBLIC_AUTH_URL`)
   - десктоп: `frontend/.env` → `NEXT_PUBLIC_AUTH_URL` (сборка)
   - CSP: `frontend/src-tauri/tauri.conf.json` (заменить плейсхолдер `https://auth.siplinx.ai`)

---

## Запуск

### 1. Облачный сервис
```bash
cd auth-service
npm install
cp .env.example .env.local   # заполнить
npm run auth:migrate         # создать таблицы Better Auth
npm run dev                  # http://localhost:3210
```
Деплой — на Vercel (см. `auth-service/README.md`).

### 2. Десктоп
```bash
cd frontend
pnpm install                 # подтянет @fabianlars/tauri-plugin-oauth и @tauri-apps/plugin-opener
# указать адрес сервиса для сборки фронта:
echo "NEXT_PUBLIC_AUTH_URL=http://localhost:3210" > .env
pnpm run tauri:dev
```

> Десктоп собирается тяжёлым тулчейном (Rust + whisper/CUDA). Сборку/прогон делаем
> на dev-машине — в этом окружении Tauri не компилировался.

---

## Изменения в коде

### auth-service/ (новый)
- `src/lib/auth.ts` — Better Auth: Google + bearer + плагин Polar (checkout/portal/webhooks)
- `src/lib/entitlements.ts` — таблица `user_entitlement`, план из вебхуков
- `src/app/api/auth/[...all]/route.ts` — все endpoints Better Auth + Polar
- `src/app/api/me/route.ts` — профиль + план по Bearer-токену
- `src/app/api/billing/{checkout,portal}/route.ts` — ссылки Polar (Bearer → JSON `{url}`)
- `src/app/desktop/{start,complete}` — мост логина для десктопа (loopback)

### frontend/ (десктоп)
- `src/config/auth.ts` — `AUTH_URL`, диапазон loopback-портов, offline-грейс
- `src/lib/authClient.ts` — OAuth-флоу, хранение токена, fetch `/api/me`, checkout/portal
- `src/contexts/AuthContext.tsx` — состояние входа + план + offline-грейс (`useAuth`, `usePro`)
- `src/components/auth/LoginScreen.tsx` — экран входа
- `src/components/auth/AuthGate.tsx` — гейт регистрации (обёрнут в `layout.tsx`)
- `src/components/auth/ProGate.tsx` — `ProGate`, `UpgradeButton`, `ManageSubscriptionButton`
- `src/app/layout.tsx` — подключены `AuthProvider` + `AuthGate`
- `src-tauri/Cargo.toml`, `src/lib.rs` — плагины `tauri-plugin-oauth`, `tauri-plugin-opener`
- `src-tauri/tauri.conf.json` — CSP (домен сервиса) + permissions `oauth:default`, `opener:default`

---

## Как гейтить PRO-фичи (для разработки)

Оборачивай платный UI:
```tsx
import { ProGate } from "@/components/auth/ProGate";

<ProGate feature="Экспорт в PDF">
  <ExportPdfButton />
</ProGate>
```
Или программно: `const isPro = usePro();`

> ⚠️ Репозиторий MIT/open-source: клиентский гейт обходится пересборкой форка.
> По-настоящему защищены только PRO-фичи с серверным компонентом. Для чисто
> локальных фич гейт — «честный замок». Решить, что из PRO завязать на сервер.

---

## План проверки (Polar sandbox)

1. `auth-service` локально, туннель для вебхуков (untun/ngrok), `POLAR_SERVER=sandbox`.
2. Десктоп `tauri:dev` → экран входа → Google → попадаем в приложение (план `free`).
3. `ProGate` показывает апселл. Нажать «Оформить PRO» → Polar sandbox checkout.
4. Оплата тестовой картой → вебхук `customer.state_changed` → лог сервиса.
5. Десктоп опрашивает `/api/me` → план `pro`, апселл исчезает.
6. Polar portal → отменить → дождаться вебхука → план откатывается в `free`.
7. Edge: выход/повторный вход, оффлайн-запуск (грейс), отзыв токена.

> После первого вебхука сверь форму payload (лог `onPayload`) с маппингом в
> `src/lib/entitlements.ts` и сигнатуры `checkouts.create`/`customerSessions.create`.

## TODO / упрочнение
- Хранение токена перенести с `plugin-store` на OS keychain (`keyring`) или Stronghold.
- Сузить CORS (`CORS_ALLOW_ORIGIN`) и `trustedOrigins` под реальные origin десктопа.
- Google OAuth consent screen → verification перед публичным релизом.

---

## Сборка десктопа на Windows — заметки (build ОТЛОЖЕН)

Авторизация на сервере готова и проверена (прод: https://siplinx-ai.vercel.app).
Сборку самого десктопа отложили: упёрлись в нативный тулчейн whisper. Что выяснили
(чтобы возобновить быстро, лучше в CI):

**Нужный тулчейн (Windows):**
- Rust (rustup, stable-msvc), Visual Studio 2019+ C++ («Desktop development with C++»).
- CMake, **LLVM 17 или 18** — НЕ новее. На LLVM 22 bindgen у `whisper-rs-sys 0.11.1`
  генерит opaque-структуру `whisper_full_params` (только `_address`) → 71 ошибка в `whisper-rs`.
- **Vulkan SDK** — обязателен: в `frontend/src-tauri/Cargo.toml` (Windows-секция)
  у `whisper-rs` жёстко включён feature `vulkan`. Задать `VULKAN_SDK`.

**Сайдкары** (`frontend/src-tauri/binaries/`):
- `ffmpeg-<triple>.exe` — качается build-скриптом автоматически.
- `llama-helper-<triple>.exe` — НЕ авто: собрать `cargo build` в `llama-helper/` и скопировать
  (см. `frontend/dev-gpu.bat`). Без него tauri падает: «resource path … doesn't exist».

**Грабли с патчем:**
- `[patch.crates-io]` лежит в `frontend/src-tauri/Cargo.toml`, но Cargo его ИГНОРИРУЕТ
  (патч обязан быть в корне воркспейса `Cargo.toml`).
- В патче `esaxx-rs` указывает на форк `thewh1teagle/esaxx-rs` ветка `feat/dynamic-msvc-link` —
  **репозиторий удалён (404)**. Нужен другой способ починить линковку esaxx-rs на MSVC
  (новая версия с crates.io / иной форк / фича). Это следующий вероятный блокер.

**Рекомендация:** собирать через GitHub Actions (`tauri-apps/tauri-action`) на `windows-latest`
+ шаг установки Vulkan SDK + закреплённый LLVM 17/18. Это же сразу даёт скачиваемые
установщики Win+Mac для распространения (кнопка «Скачать» на сайте → GitHub Releases).
