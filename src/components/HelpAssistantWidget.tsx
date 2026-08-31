/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, LifeBuoy } from "lucide-react";
import { User } from "../types.js";
import { Button } from "./ui/index.js";

interface HelpAssistantWidgetProps {
  isRtl: boolean;
  currentUser?: User | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  grounded?: boolean;
}

// Floating "Nerou Assistant" help chatbot - visible across the public site and all four
// subscriber workspaces. Every answer is grounded strictly in the real Help Center articles
// via POST /api/help-assistant (see server.ts) - this component is just the chat UI, all
// retrieval/grounding/fallback logic lives server-side.
export default function HelpAssistantWidget({ isRtl, currentUser }: HelpAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const conversationIdRef = useRef<string>(`help-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const greeting = isRtl
    ? "أهلاً! أنا مساعد نيرو. اسألني عن أي ميزة في منصة نيرو فايندر."
    : "Hi! I'm the Nerou Assistant. Ask me anything about how Nerou Finder works.";

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setMessages(prev => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/help-assistant", {
        method: "POST",
        headers,
        body: JSON.stringify({ question, conversationId: conversationIdRef.current })
      });
      const data = await res.json();

      if (res.ok) {
        setMessages(prev => [...prev, { role: "assistant", text: data.answer, grounded: data.grounded }]);
      } else {
        setError(data.error || (isRtl ? "تعذر الوصول إلى المساعد حالياً." : "The assistant is unavailable right now."));
      }
    } catch (err) {
      setError(isRtl ? "خطأ في الاتصال بالشبكة." : "Network error reaching the assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 z-40" style={{ [isRtl ? "left" : "right"]: "1.25rem" } as React.CSSProperties} dir={isRtl ? "rtl" : "ltr"}>
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-2.5rem)] max-w-sm h-[28rem] max-h-[70vh] bg-surface border border-border rounded-2xl shadow-modal flex flex-col overflow-hidden animate-modal-in">
          <div className="bg-chrome text-white px-4 py-3 flex items-center justify-between shrink-0 border-b border-chrome-hover">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={16} className="text-gold shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-serif font-semibold truncate">{isRtl ? "مساعد نيرو" : "Nerou Assistant"}</p>
                <p className="text-[10px] text-gray-400 truncate">{isRtl ? "إجابات من مركز المساعدة فقط" : "Answers grounded in Help Center"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={isRtl ? "إغلاق" : "Close"}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer text-gray-300 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 text-xs bg-canvas">
            <div className="flex">
              <div className="max-w-[85%] bg-surface border border-border rounded-xl rounded-bl-sm px-3 py-2 text-ink leading-relaxed">
                {greeting}
              </div>
            </div>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 leading-relaxed whitespace-pre-wrap rounded-xl ${
                    m.role === "user"
                      ? "bg-gold text-gold-ink rounded-br-sm"
                      : "bg-surface border border-border text-ink rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5 text-ink-muted">
                  <Loader2 size={12} className="animate-spin" />
                  <span>{isRtl ? "جاري الكتابة..." : "Thinking..."}</span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-danger-soft border border-danger/30 text-danger rounded-xl px-3 py-2">
                  {error}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-2.5 border-t border-border flex items-center gap-2 shrink-0 bg-surface">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRtl ? "اكتب سؤالك هنا..." : "Type your question..."}
              className="flex-1 min-w-0 px-3 py-2 bg-canvas border border-border rounded-lg text-xs focus:outline-none focus:border-gold text-ink"
            />
            <Button type="submit" size="sm" disabled={loading || !input.trim()} aria-label={isRtl ? "إرسال" : "Send"}>
              <Send size={14} />
            </Button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        aria-label={isRtl ? "مساعد نيرو" : "Nerou Assistant"}
        aria-expanded={isOpen}
        className="w-14 h-14 rounded-full bg-chrome hover:bg-chrome-hover text-gold shadow-modal border border-gold/40 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
      >
        {isOpen ? <X size={22} /> : <LifeBuoy size={22} />}
      </button>
    </div>
  );
}
