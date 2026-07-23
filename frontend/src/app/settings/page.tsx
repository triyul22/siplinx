"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { openSettings } from "@/components/SettingsModal";

/**
 * Настройки живут в модалке (SettingsModal), отдельного экрана больше нет.
 * Роут оставлен для старых точек входа: уводим на дом и открываем модалку.
 */
export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
    openSettings();
  }, [router]);

  return null;
}
