# Siplinx AI — auth-service

Тонкий облачный сервис: **Google-авторизация (Better Auth)** + **подписка Polar** для десктопного приложения Siplinx AI.

Десктоп общается только с этим сервисом. Секреты Google и Polar живут здесь, в приложение они не попадают.

```
Desktop (Tauri) ──HTTPS──> auth-service ──> Google OAuth
                                 │
                                 └────────> Polar (checkout, подписки, webhooks, portal)
```

---

## Что нужно от тебя (создать аккаунты и ключи)

Заполнить `.env.local` (скопируй из `.env.example`). По шагам:

### 1. Postgres
- Заведи БД на **Neon** (neon.tech, free tier ок) / Vercel Postgres / Supabase.
- Скопируй connection string → `DATABASE_URL` (со `?sslmode=require`).

### 2. Google OAuth
- console.cloud.google.com → новый проект.
- **APIs & Services → OAuth consent screen**: External, заполни name/email, добавь scope `email`, `profile`. Пока в режиме Testing добавь себя в Test users.
- **APIs & Services → Credentials → Create credentials → OAuth client ID**:
  - Application type: **Web application**
  - Authorized redirect URIs:
    - `http://localhost:3210/api/auth/callback/google` (dev)
    - `https://<твой-домен>/api/auth/callback/google` (prod)
- Скопируй Client ID/Secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

### 3. Polar
- polar.sh → создай организацию. Включи **Sandbox** для тестов (sandbox.polar.sh).
- **Products → New**: продукт «Siplinx AI PRO», тип **Subscription**, добавь две цены — месяц и год. Скопируй два Product ID → `POLAR_PRODUCT_ID_MONTHLY`, `POLAR_PRODUCT_ID_YEARLY`.
- **Settings → API Tokens**: создай Organization Access Token → `POLAR_ACCESS_TOKEN`.
- **Settings → Webhooks → Add endpoint**:
  - URL: `https://<твой-домен>/api/auth/polar/webhooks` (для локалки используй туннель, см. ниже)
  - События: как минимум `customer.state_changed` (плюс можно `order.paid`, `subscription.*`).
  - Скопируй signing secret → `POLAR_WEBHOOK_SECRET`.
- `POLAR_SERVER=sandbox` пока тестируем, потом `production`.

### 4. Секрет сервиса
- `BETTER_AUTH_SECRET` = `openssl rand -base64 32` (или любой 32+ символьный).

---

## Запуск локально

```bash
cd auth-service
npm install
cp .env.example .env.local   # заполнить значения

# создать таблицы Better Auth в Postgres:
npm run auth:generate        # сгенерит SQL/схему
npm run auth:migrate         # применит к БД

npm run dev                  # http://localhost:3210
```

Таблица `user_entitlement` (план подписки) создаётся автоматически при первом вебхуке/запросе.

### Вебхуки на локалке
Polar должен достучаться до твоей машины. Подними туннель:
```bash
npx untun@latest tunnel http://localhost:3210
# или cloudflared / ngrok — полученный https-URL вставь в Webhook endpoint Polar
```

---

## Деплой (прод)

Рекомендую **Vercel**:
1. Запушить `auth-service/` (или весь репо, указав root = `auth-service`).
2. В Vercel → Project → Settings → Environment Variables вставить всё из `.env.local`
   (кроме dev-URL — `BETTER_AUTH_URL`/`NEXT_PUBLIC_AUTH_URL` = прод-домен).
3. Обновить redirect URI в Google и webhook URL в Polar на прод-домен.
4. `POLAR_SERVER=production`, прод-токен Polar, прод-продукты.

---

## Endpoints

| Путь | Назначение |
|------|------------|
| `/api/auth/*` | Better Auth (Google sign-in, сессия, bearer) |
| `/api/auth/polar/webhooks` | приём вебхуков Polar → обновляет план |
| `/api/me` | `Authorization: Bearer <token>` → `{ user, plan, status, currentPeriodEnd }` |
| `/api/billing/checkout?plan=monthly\|yearly` | открыть в браузере → Polar checkout |
| `/api/billing/portal` | открыть в браузере → Polar customer portal |
| `/desktop/start?port=&state=` | старт OAuth для десктопа |
| `/desktop/complete` | возврат токена на loopback десктопа |

---

## Проверка вебхука (важно)

Форма payload `customer.state_changed` зависит от версии Polar. После первого
вебхука в sandbox посмотри лог (`onPayload` печатает сырой payload) и при
необходимости поправь маппинг полей в `src/lib/entitlements.ts`
(`externalId`, `activeSubscriptions[].status`, `current_period_end`).

То же про сигнатуры `checkouts.create` / `customerSessions.create` в
`src/app/api/billing/*` — сверь с твоей версией `@polar-sh/sdk`.
