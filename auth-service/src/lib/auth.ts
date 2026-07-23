import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { polar, checkout, portal, webhooks } from "@polar-sh/better-auth";
import { pool } from "./db";
import { polarClient } from "./polar";
import {
  polarEventType,
  upsertEntitlementFromCustomerState,
  upsertEntitlementFromOrderPaid,
  upsertEntitlementFromSubscriptionState,
} from "./entitlements";
import { handleOrderPaid, handleOrderRefunded } from "./referrals";

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // Десктоп (Tauri webview) обращается к API с этих origin. Плюс loopback при логине.
  // Лендинг (siplinx.com) — веб-вход через /web/start: better-auth редиректит
  // обратно на callbackURL только если его origin здесь в белом списке.
  trustedOrigins: [
    "http://localhost:3118",
    "http://127.0.0.1:3118",
    "tauri://localhost",
    "https://tauri.localhost",
    "http://tauri.localhost",
    "https://siplinx.com",
    "https://www.siplinx.com",
  ],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  plugins: [
    // bearer: токен сессии можно слать в Authorization: Bearer <token>.
    // Десктоп хранит этот токен и ходит с ним в /api/me.
    bearer(),

    // Polar подключаем ТОЛЬКО если задан POLAR_ACCESS_TOKEN.
    // Так можно запустить сейчас только авторизацию (Google), а оплату
    // добавить позже — просто вписав ключи Polar в .env, без правок кода.
    ...(process.env.POLAR_ACCESS_TOKEN
      ? [
          polar({
            client: polarClient,
            // При регистрации создаём Polar-клиента с externalId = user.id,
            // чтобы вебхуки можно было сопоставить с нашим пользователем.
            createCustomerOnSignUp: true,
            use: [
              checkout({
                // Включаем только те планы, для которых задан ID продукта в Polar.
                // Сейчас заведён только месячный; годовой подключится сам, как
                // только появится POLAR_PRODUCT_ID_YEARLY (без правок кода).
                products: [
                  process.env.POLAR_PRODUCT_ID_MONTHLY
                    ? { productId: process.env.POLAR_PRODUCT_ID_MONTHLY, slug: "pro-monthly" }
                    : null,
                  process.env.POLAR_PRODUCT_ID_YEARLY
                    ? { productId: process.env.POLAR_PRODUCT_ID_YEARLY, slug: "pro-yearly" }
                    : null,
                ].filter(Boolean) as { productId: string; slug: string }[],
                successUrl: "/success?checkout_id={CHECKOUT_ID}",
                authenticatedUsersOnly: true,
              }),
              portal(),
              webhooks({
                secret: process.env.POLAR_WEBHOOK_SECRET as string,
                // Единый источник истины: при любом изменении состояния клиента
                // (оформил / продлил / отменил / отозвали) пересчитываем план.
                onCustomerStateChanged: async (payload) => {
                  await upsertEntitlementFromCustomerState(payload);
                },
                // Рефералка: комиссия партнёру с каждого реального списания
                // (только trial7-продукт). Хендлеры сами глотают свои ошибки —
                // иначе Polar посчитает доставку неуспешной и будет ретраить.
                onOrderPaid: async (payload) => {
                  await upsertEntitlementFromOrderPaid(payload);
                  await handleOrderPaid(payload);
                },
                onOrderRefunded: async (payload) => {
                  await handleOrderRefunded(payload);
                },
                // На этапе sandbox логируем сырой payload, чтобы свериться с формой.
                onPayload: async (payload) => {
                  if (polarEventType(payload).startsWith("subscription.")) {
                    await upsertEntitlementFromSubscriptionState(payload);
                  }
                  if (process.env.POLAR_SERVER !== "production") {
                    console.log("[polar webhook]", JSON.stringify(payload).slice(0, 1000));
                  }
                },
              }),
            ],
          }),
        ]
      : []),
  ],
});
