import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Все endpoints Better Auth + плагина Polar:
//   /api/auth/sign-in/social, /api/auth/callback/google,
//   /api/auth/polar/webhooks, checkout, portal и т.д.
export const { POST, GET } = toNextJsHandler(auth);
