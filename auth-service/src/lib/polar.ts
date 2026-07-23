import { Polar } from "@polar-sh/sdk";

// SDK-клиент Polar. Используется и плагином Better Auth, и нашими billing-роутами.
export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: (process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox",
});
