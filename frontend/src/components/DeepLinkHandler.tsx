"use client";

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useRouter } from "next/navigation";

export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const open = (raw: string) => {
      try {
        const url = new URL(raw);
        if (url.protocol !== "siplinx:") return;
        if (url.hostname === "meeting") {
          const id = url.pathname.replace(/^\/+/, "");
          if (id) router.push(`/meeting-details?id=${encodeURIComponent(id)}`);
        }
      } catch {
        // Ignore malformed or untrusted URLs.
      }
    };

    const cleanups: Array<() => void> = [];
    void getCurrent().then((urls) => urls?.forEach((url) => open(url)));
    void onOpenUrl((urls) => urls.forEach((url) => open(url))).then((off) =>
      cleanups.push(off),
    );
    void listen<string>("deep-link-opened", (event) => open(event.payload)).then(
      (off) => cleanups.push(off),
    );
    return () => cleanups.forEach((off) => off());
  }, [router]);

  return null;
}
