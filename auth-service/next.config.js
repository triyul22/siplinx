/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Сервис вызывается из десктопа (Tauri webview). CORS-заголовки для API.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ALLOW_ORIGIN || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          // ЛЮБОЙ кастомный заголовок десктопа обязан быть в этом списке, иначе
          // CORS-preflight из Tauri-вебвью режет запрос → fetchMe падает
          // (network-error) → вход не завершается. Так уже ломалось дважды:
          // X-Billing-Mode (июль, коммит c0d05bb) и X-Locale (добавлен клиентом
          // в cb28acc, попал в релизы 0.3.32+ без записи здесь).
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Billing-Mode, X-Locale" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
