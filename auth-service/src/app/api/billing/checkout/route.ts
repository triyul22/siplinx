import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasUsedAutoTrial } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

const POLAR_API =
  process.env.POLAR_SERVER === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";

/**
 * Десктоп вызывает с Authorization: Bearer <token> (fetch), получает { url }
 * и сам открывает url в системном браузере. Так не зависим от cookie в браузере.
 *
 * ?plan=monthly | yearly
 *
 * Зовём Polar REST напрямую (не через SDK): имя поля external-id в SDK
 * нестабильно между версиями и молча отбрасывалось, из-за чего клиент не
 * привязывался к нашему user.id (вебхук приходил без external_id → план не
 * обновлялся). Snake_case customer_external_id проверен на боевом API.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const plan = new URL(req.url).searchParams.get("plan") ?? "monthly";

  // Выбор продукта + опциональный триал по плану. Два тарифа:
  //  - monthly: $2/неделю, БЕЗ триала, списание сразу (POLAR_PRODUCT_ID_MONTHLY).
  //  - trial7:  7-дневный триал Polar с обязательной картой, затем $4/неделю
  //             (POLAR_PRODUCT_ID_TRIAL7). NB: это ПЛАТНЫЙ триал через Polar,
  //             не путать с бесплатным промокодом "Trial7" из /api/trial/redeem.
  const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? "7") || 7;
  let productId: string | undefined;
  let trial: { interval: "day"; count: number } | null = null;
  if (plan === "yearly") {
    productId = process.env.POLAR_PRODUCT_ID_YEARLY;
  } else if (plan === "trial7") {
    productId = process.env.POLAR_PRODUCT_ID_TRIAL7;
    // If the user already received our no-card auto-trial, do not grant a
    // second Polar trial. The same trial7 product then starts billing now.
    if (!(await hasUsedAutoTrial(session.user.id))) {
      trial = { interval: "day", count: TRIAL_DAYS };
    }
  } else {
    productId = process.env.POLAR_PRODUCT_ID_MONTHLY;
  }

  // План недоступен, если для него не задан ID продукта (напр. trial7/годовой не заведён).
  if (!productId) {
    return NextResponse.json({ error: `plan "${plan}" unavailable` }, { status: 400 });
  }

  const successUrl = new URL("/success", req.url).toString();

  const r = await fetch(`${POLAR_API}/v1/checkouts/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      products: [productId],
      success_url: successUrl,
      // Привязка Polar-клиента к нашему пользователю — ключ для вебхуков.
      customer_external_id: session.user.id,
      customer_email: session.user.email ?? undefined,
      // Polar соберёт карту, но не спишет до конца триала (поля snake_case).
      ...(trial ? { trial_interval: trial.interval, trial_interval_count: trial.count } : {}),
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: "checkout_failed", detail }, { status: 502 });
  }

  const checkout = await r.json();
  return NextResponse.json({ url: checkout.url });
}
