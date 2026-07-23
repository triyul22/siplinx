import { NextRequest, NextResponse } from "next/server";
import { capture } from "@/lib/track";

export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["app_install_started", "app_install_completed"]);
const MAX_VALUE_LENGTH = 160;

type InstallEventPayload = {
  event?: unknown;
  platform?: unknown;
  installer?: unknown;
  install_id?: unknown;
  app_version?: unknown;
  variant?: unknown;
};

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_VALUE_LENGTH);
}

function fromQuery(req: NextRequest): InstallEventPayload {
  const p = req.nextUrl.searchParams;
  return {
    event: p.get("event"),
    platform: p.get("platform"),
    installer: p.get("installer"),
    install_id: p.get("install_id"),
    app_version: p.get("app_version"),
    variant: p.get("variant"),
  };
}

async function handle(req: NextRequest, payload: InstallEventPayload) {
  const event = clean(payload.event);
  if (!event || !ALLOWED_EVENTS.has(event)) {
    return NextResponse.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  const installId = clean(payload.install_id) ?? crypto.randomUUID();
  const platform = clean(payload.platform) ?? "win";
  const installer = clean(payload.installer) ?? "unknown";
  const appVersion = clean(payload.app_version);
  const variant = clean(payload.variant);

  await capture(event, `install_${installId}`, {
    source: "installer_ping",
    install_id: installId,
    platform,
    installer,
    app_version: appVersion,
    variant,
    user_agent: req.headers.get("user-agent") || undefined,
    $set: {
      last_install_platform: platform,
      last_install_installer: installer,
      last_install_app_version: appVersion,
      last_install_variant: variant,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  return handle(req, fromQuery(req));
}

export async function POST(req: NextRequest) {
  let payload: InstallEventPayload = {};
  try {
    payload = (await req.json()) as InstallEventPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  return handle(req, payload);
}
