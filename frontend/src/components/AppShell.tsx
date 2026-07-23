"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Старый каркас (Sidebar + MainContent) остался только у легаси-роута /notes/[id],
  // до которого можно добраться лишь из самого старого сайдбара. Всё остальное — новый UX.
  if (pathname.startsWith("/notes")) {
    return (
      <div className="flex">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    );
  }

  return <main className="min-h-screen w-full">{children}</main>;
}
