import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const POLAR_API =
  process.env.POLAR_SERVER === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";

/**
 * "Manage subscription". Десктоп вызывает с Bearer-токеном, получает { url }
 * и открывает Polar Customer Portal в браузере.
 *
 * Зовём Polar REST напрямую (не через SDK) — по той же причине, что и checkout:
 * имена полей в SDK нестабильны между версиями. customerSessions.create с
 * customerExternalId падал SDKValidationError на проде (баг «Управлять
 * подпиской виснет», июль 2026). REST-поле: external_customer_id.
 */
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const r = await fetch(`${POLAR_API}/v1/customer-sessions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ external_customer_id: session.user.id }),
  });

  if (!r.ok) {
    const detail = await r.text();
    console.error(`[portal] polar customer-session failed: ${r.status} ${detail.slice(0, 500)}`);
    // 404 у Polar = для юзера нет customer (напр., наш триал без карты):
    // отдадим клиенту осмысленный код, там покажут человеческую ошибку.
    return NextResponse.json(
      { error: r.status === 404 ? "no_customer" : "portal_failed" },
      { status: 502 }
    );
  }

  const data = (await r.json()) as { customer_portal_url?: string };
  if (!data.customer_portal_url) {
    console.error("[portal] polar response without customer_portal_url");
    return NextResponse.json({ error: "portal_failed" }, { status: 502 });
  }

  return NextResponse.json({ url: data.customer_portal_url });
}
