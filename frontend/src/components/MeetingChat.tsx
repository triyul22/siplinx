"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Store } from "@tauri-apps/plugin-store";
import { AUTH_URL } from "@/config/auth";
import { getToken } from "@/lib/authClient";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";

type Message = {
  role: "user" | "assistant";
  text: string;
  quotes?: Array<{ time: string; text: string }>;
};

export function MeetingChat({
  meetingId,
  context,
  onEdit,
  onQuote,
}: {
  meetingId: string;
  context: () => Promise<string>;
  onEdit: (summary: string) => Promise<void>;
  onQuote: (time: string) => void;
}) {
  const { me } = useAuth();
  const { t, lang } = useI18n();

  // Счётчик оставшихся вопросов с корректным русским склонением.
  const remainingLabel = (n: number) => {
    if (lang === "ru") {
      const mod10 = n % 10;
      const mod100 = n % 100;
      let word = "вопросов";
      if (mod10 === 1 && mod100 !== 11) word = "вопрос";
      else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "вопроса";
      return `Осталось ${n} ${word} сегодня`;
    }
    return `${n} ${n === 1 ? "question" : "questions"} left today`;
  };
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [remaining, setRemaining] = useState(me?.chatRemaining ?? 4);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Store.load("meeting-chat.json", { autoSave: true, defaults: {} }).then(
      async (store) => {
        setMessages((await store.get<Message[]>(meetingId)) ?? []);
      },
    );
  }, [meetingId]);

  const persist = async (next: Message[]) => {
    const store = await Store.load("meeting-chat.json", { autoSave: true, defaults: {} });
    await store.set(meetingId, next);
    await store.save();
  };

  const send = async (preset?: string) => {
    const text = (preset ?? question).trim();
    if (!text || busy || remaining <= 0) return;
    setQuestion("");
    setBusy(true);
    const optimistic = [...messages, { role: "user" as const, text }];
    setMessages(optimistic);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ meeting_context: await context(), question: text }),
      });
      const data = await response.json();
      setRemaining(data.remaining ?? 0);
      if (response.status === 429) return;
      if (!response.ok) throw new Error(data.error ?? "chat_failed");
      if (data.action === "edit" && data.newSummary) await onEdit(data.newSummary);
      const next = [
        ...optimistic,
        {
          role: "assistant" as const,
          text: data.action === "edit" ? data.note : data.answer,
          quotes: data.quotes,
        },
      ];
      setMessages(next);
      await persist(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="shrink-0 border-t border-[#ececea] bg-white px-8 py-3">
      <div className="mx-auto max-w-[700px]">
        {!messages.length && (
          <div className="mb-2 flex flex-wrap gap-2">
            {[t("chat.decisions"), t("chat.commitments"), t("chat.shorten")].map((text) => (
              <button key={text} onClick={() => void send(text)} className="rounded-full border border-[#e4e2dd] bg-[#f7f6f3] px-3 py-1.5 text-xs text-[#6b6864]">{text}</button>
            ))}
          </div>
        )}
        {!!messages.length && (
          <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-sm">
            {messages.slice(-8).map((message, index) => (
              <div key={index} className={message.role === "user" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[85%] rounded-xl px-3 py-2 ${message.role === "user" ? "bg-[#232220] text-white" : "bg-[#f7f6f3]"}`}>{message.text}</span>
                {message.quotes?.map((quote) => <button key={quote.time} onClick={() => onQuote(quote.time)} title={quote.text} className="ml-1 rounded-full border px-2 py-0.5 text-[11px] text-[#6b6864]">{quote.time}</button>)}
              </div>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-2 rounded-xl border border-[#e4e2dd] bg-[#f7f6f3] px-3 py-2 ${remaining <= 0 ? "opacity-60" : ""}`}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} disabled={remaining <= 0} placeholder={remaining > 0 ? t("chat.placeholder") : t("chat.exhausted")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <button onClick={() => void send()} disabled={busy || remaining <= 0} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e0402d] text-white disabled:bg-[#d8d6d0]"><Send size={14} /></button>
        </div>
        <div className="mt-1 text-right text-[11.5px] text-[#9c9994]">{remainingLabel(remaining)}</div>
      </div>
    </section>
  );
}
