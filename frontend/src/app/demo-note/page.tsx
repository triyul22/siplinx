"use client";

import { ArrowLeft, Check, FileText, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/contexts/I18nContext";

export default function DemoNotePage() {
  const router = useRouter();
  const { lang, t } = useI18n();
  const ru = lang === "ru";

  return (
    <main className="flex h-screen flex-col bg-white text-[#232220]">
      <header className="border-b border-[#ececea] px-8 pt-6">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-sm text-[#6b6864] hover:text-[#232220]">
          <ArrowLeft size={16} /> {t("home.back")}
        </button>
        <div className="mx-auto mt-5 flex max-w-[760px] items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[25px] font-semibold tracking-[-0.025em]">{t("home.demoTitle")}</h1>
              <span className="rounded-full border border-[#f0e2c3] bg-[#fbf1de] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.03em] text-[#9c6b1f]">
                {t("home.demoBadge")}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#9c9994]">{ru ? "Сегодня · 32 мин" : "Today · 32 min"}</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="flex h-9 items-center gap-2 rounded-lg bg-[#e0402d] px-3 text-sm font-medium text-white hover:bg-[#c9351f]"
          >
            <Sparkles size={14} /> {t("home.demoRecordOwn")}
          </button>
        </div>
        <div className="mx-auto mt-4 flex max-w-[760px] items-center gap-2 rounded-lg border border-[#f0e2c3] bg-[#fbf1de] px-4 py-2.5 text-[13px] leading-snug text-[#8a6d1f]">
          <Sparkles size={15} className="shrink-0" />
          {t("home.demoBanner")}
        </div>
        <nav className="mx-auto mt-6 flex max-w-[760px] gap-6">
          <span className="border-b-2 border-[#e0402d] pb-3 text-sm font-semibold">{t("home.noteTab")}</span>
          <span className="pb-3 text-sm font-semibold text-[#9c9994]">{t("home.transcriptTab")}</span>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <article className="mx-auto max-w-[700px] text-[15px] leading-7">
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">{ru ? "Кратко" : "Summary"}</h2>
            <p className="text-[#4d4a46]">
              {ru
                ? "Команда согласовала сценарий первого релиза Telegram-бота, сроки тестирования и порядок сбора обратной связи."
                : "The team agreed on the first Telegram bot release scope, testing timeline, and feedback process."}
            </p>
          </section>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">{ru ? "Решения" : "Decisions"}</h2>
            <ul className="list-disc space-y-2 pl-5 text-[#4d4a46]">
              <li>{ru ? "Запустить закрытый тест в пятницу." : "Start the closed test on Friday."}</li>
              <li>{ru ? "Оставить три ключевых сценария в первой версии." : "Keep three core scenarios in the first version."}</li>
              <li>{ru ? "Собирать обратную связь через короткую форму." : "Collect feedback through a short form."}</li>
            </ul>
          </section>
          <section>
            <h2 className="mb-3 text-lg font-semibold">{ru ? "Задачи" : "Action items"}</h2>
            <div className="space-y-3">
              {[
                ru ? "Подготовить тестовую сборку — Василий" : "Prepare the test build — Vasily",
                ru ? "Собрать список тестировщиков — Анна" : "Prepare the tester list — Anna",
              ].map((item) => (
                <label key={item} className="flex items-start gap-3 rounded-lg bg-[#f7f6f3] px-4 py-3">
                  <span className="mt-1 flex h-4 w-4 items-center justify-center rounded border border-[#c9c6c0]"><Check size={11} className="opacity-0" /></span>
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </section>
        </article>
      </div>

      <div className="border-t border-[#ececea] bg-white px-8 py-4">
        <div className="mx-auto flex max-w-[700px] items-center gap-3 rounded-xl border border-[#e4e2dd] bg-[#f7f6f3] px-4 py-3 text-sm text-[#9c9994]">
          <FileText size={16} />
          {ru ? "Спросить о встрече…" : "Ask about this meeting…"}
        </div>
      </div>
    </main>
  );
}
