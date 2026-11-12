/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Bath, Bed, Maximize2, MapPin, RotateCcw, SquarePen, X, Building2, Home, KeyRound, HardHat, ChevronRight, ChevronLeft } from "lucide-react";
import NerouAiMark from "./NerouAiMark.js";
import { Property, TransactionType } from "../types.js";
import { useCurrency } from "../currencyContext.js";
import { getThumbnailUrl } from "../lib/image.js";

// "Nerou Find AI": the property search as a conversation, in a full-screen assistant like the chat
// apps people already know. The visitor asks in their own words, the assistant answers and shows the
// matching live listings right inside the conversation. It talks to POST /api/ai/search, which only
// ever returns listings that exist on the platform. The conversation survives closing and reopening
// (until "New chat" or a page reload), so a visitor can open a listing and come back to it.

interface Match { property: Property; why: string }
interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  matches?: Match[];
  failed?: string; // the question to ask again
}
interface Saved { messages: Msg[]; conversationId: string }

let saved: Saved | null = null;
const newConversationId = () => `conv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
const newId = () => `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export default function AiChat({ isRtl, initialPrompt, onClose, onOpenProperty }: {
  isRtl: boolean;
  initialPrompt?: string;
  onClose: () => void;
  onOpenProperty: (p: Property) => void;
}) {
  const t = useCallback((en: string, ar: string) => (isRtl ? ar : en), [isRtl]);
  const { formatPrice } = useCurrency();
  const [messages, setMessages] = useState<Msg[]>(() => saved?.messages ?? []);
  const [conversationId, setConversationId] = useState(() => saved?.conversationId ?? newConversationId());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const startedRef = useRef(false);

  useEffect(() => { saved = { messages, conversationId }; }, [messages, conversationId]);

  // the page behind stays put while the assistant is open; Esc closes it
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const grow = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  };

  const ask = useCallback(async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    setInput("");
    requestAnimationFrame(grow);
    setMessages(m => [...m, { id: newId(), role: "user", text: question }]);
    setBusy(true);
    setSlow(false);
    const slowTimer = setTimeout(() => setSlow(true), 10_000);
    const abort = new AbortController();
    const giveUp = setTimeout(() => abort.abort(), 70_000);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: question, conversationId }),
        signal: abort.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "failed");

      const found: { propertyId: string; whyMatchEn: string; whyMatchAr: string }[] = Array.isArray(data.matches) ? data.matches.slice(0, 6) : [];
      // the assistant names listings by id: fetch the live record of each to draw its card
      const cards = (await Promise.all(found.map(async f => {
        try {
          const r = await fetch(`/api/properties/${encodeURIComponent(f.propertyId)}`);
          if (!r.ok) return null;
          return { property: (await r.json()) as Property, why: isRtl ? f.whyMatchAr : f.whyMatchEn } as Match;
        } catch { return null; }
      }))).filter((x): x is Match => !!x && !!x.property?.id);

      const reply = String((isRtl ? data.replyAr : data.replyEn) || "").trim();
      const text = reply || (cards.length > 0
        ? t(`I found ${cards.length} ${cards.length === 1 ? "listing" : "listings"} that fit your request.`, `وجدت ${cards.length} ${cards.length === 1 ? "عقاراً" : "عقارات"} تناسب طلبك.`)
        : t("I could not find a listing that fits that exactly. Try a different area, a wider budget or fewer requirements.", "لم أجد عقاراً يطابق طلبك تماماً. جرّب منطقة أخرى أو ميزانية أوسع أو شروطاً أقل."));
      setMessages(m => [...m, { id: newId(), role: "assistant", text, matches: cards }]);
    } catch {
      setMessages(m => [...m, {
        id: newId(), role: "assistant", failed: question,
        text: t("Sorry, I could not complete that search just now. Please try again in a moment.", "عذراً، تعذّر إكمال البحث الآن. يرجى المحاولة بعد قليل.")
      }]);
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(giveUp);
      setSlow(false);
      setBusy(false);
      boxRef.current?.focus();
    }
  }, [busy, conversationId, isRtl, t]);

  // a question typed on the home page opens the assistant already asking it
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialPrompt && initialPrompt.trim()) ask(initialPrompt);
    else boxRef.current?.focus();
  }, [initialPrompt, ask]);

  const newChat = () => {
    setMessages([]);
    setConversationId(newConversationId());
    setInput("");
    saved = null;
    requestAnimationFrame(() => boxRef.current?.focus());
  };

  const starters: [React.ComponentType<{ size?: number; className?: string }>, string][] = [
    [Building2, t("2-bedroom apartment in Lusail under 12,000 QAR", "شقة غرفتين في لوسيل بأقل من 12,000 ريال")],
    [Home, t("Family villa for sale in Al Rayyan", "فيلا عائلية للبيع في الريان")],
    [KeyRound, t("Furnished studio to rent near the Doha Metro", "استوديو مفروش للإيجار قرب مترو الدوحة")],
    [HardHat, t("Off-plan investment on The Pearl", "استثمار على المخطط في اللؤلؤة")]
  ];
  const followUps = [
    t("Show cheaper options", "أرني خيارات أرخص"),
    t("With more bedrooms", "بغرف نوم أكثر"),
    t("In a different area", "في منطقة أخرى")
  ];
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");

  const badge = (p: Property) =>
    p.transactionType === TransactionType.FOR_SALE ? t("Buy", "للبيع")
      : p.transactionType === TransactionType.FOR_RENT ? t("Rent", "للإيجار") : t("Off-Plan", "على المخطط");
  const period = (p: Property) =>
    p.transactionType !== TransactionType.FOR_RENT ? "" :
      ({ YEARLY: t("/ year", "/ سنة"), WEEKLY: t("/ week", "/ أسبوع"), DAILY: t("/ day", "/ يوم") } as Record<string, string>)[p.rentalPeriod || ""] || t("/ month", "/ شهر");

  const gold = "bg-[linear-gradient(180deg,#e3c964_0%,#bf9b30_100%)]";

  return (
    <div role="dialog" aria-modal="true" aria-label="Nerou Find AI" dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-[150] flex flex-col bg-[#0f0d0b] text-white font-sans animate-in fade-in duration-200">
      {/* soft gold glow, purely decorative */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(191,155,48,0.16),transparent)]" />

      {/* top bar */}
      <header className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-black/30 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-9 h-9 shrink-0 rounded-xl ${gold} flex items-center justify-center shadow-[0_4px_16px_rgba(191,155,48,0.45)]`}>
            <NerouAiMark size={20} strokeWidth={2.1} className="text-black" />
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-serif text-base font-semibold truncate">Nerou Find AI</p>
            <p className="text-[11px] text-white/55 truncate">{t("Property search assistant for Qatar", "مساعد البحث العقاري في قطر")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={newChat} disabled={messages.length === 0 && !busy}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white/85 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer">
            <SquarePen size={15} />
            <span className="hidden sm:inline">{t("New chat", "محادثة جديدة")}</span>
          </button>
          <button onClick={onClose} aria-label={t("Close", "إغلاق")}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* the conversation */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-7">
          {messages.length === 0 && (
            <div className="pt-6 sm:pt-12 text-center space-y-8">
              <div className="space-y-4">
                <span className={`mx-auto w-16 h-16 rounded-2xl ${gold} flex items-center justify-center shadow-[0_10px_40px_rgba(191,155,48,0.45)]`}>
                  <NerouAiMark size={34} strokeWidth={2} className="text-black" />
                </span>
                <h2 className="text-2xl sm:text-4xl font-serif font-medium leading-tight">
                  {t("What kind of property are you looking for?", "ما نوع العقار الذي تبحث عنه؟")}
                </h2>
                <p className="text-sm text-white/60 max-w-lg mx-auto leading-relaxed">
                  {t("Describe it in your own words: area, budget, bedrooms, rent or buy. I search the verified live listings and show you the best matches here.",
                    "صِفه بكلماتك: المنطقة والميزانية وعدد الغرف وإيجار أو شراء. أبحث في العقارات الموثّقة المتاحة وأعرض لك أفضل النتائج هنا.")}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-start">
                {starters.map(([Icon, label]) => (
                  <button key={label} onClick={() => ask(label)}
                    className="group flex items-start gap-3 p-4 rounded-2xl bg-white/[0.05] border border-white/15 hover:bg-white/[0.09] hover:border-gold/60 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer">
                    <Icon size={18} className="text-gold mt-0.5 shrink-0 transition-transform group-hover:scale-110" />
                    <span className="flex-1 text-sm text-white/90 leading-snug">{label}</span>
                    {isRtl
                      ? <ChevronLeft size={16} className="text-white/30 mt-0.5 shrink-0 transition-all group-hover:text-gold group-hover:-translate-x-0.5" />
                      : <ChevronRight size={16} className="text-white/30 mt-0.5 shrink-0 transition-all group-hover:text-gold group-hover:translate-x-0.5" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] px-4 py-3 rounded-2xl rounded-ee-md bg-white/10 border border-white/10 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className={`w-8 h-8 shrink-0 rounded-lg ${gold} flex items-center justify-center mt-0.5`}><NerouAiMark size={17} strokeWidth={2.1} className="text-black" /></span>
              <div className="min-w-0 flex-1 space-y-4">
                <p className="text-[15px] leading-relaxed text-white/95 whitespace-pre-wrap break-words">{m.text}</p>
                {m.failed && (
                  <button onClick={() => ask(m.failed!)} disabled={busy}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 text-xs font-semibold hover:bg-white/10 disabled:opacity-50 cursor-pointer">
                    <RotateCcw size={13} />{t("Try again", "حاول مرة أخرى")}
                  </button>
                )}
                {m.matches && m.matches.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {m.matches.map(({ property: p, why }) => (
                      <article key={p.id} className="group flex flex-col rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-gold/60 transition-colors">
                        <button onClick={() => onOpenProperty(p)} className="relative block aspect-[16/10] overflow-hidden bg-black/40 cursor-pointer" aria-label={p.title}>
                          {p.images?.[0] && <img src={getThumbnailUrl(p.images[0])} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                          <span className={`absolute top-3 ${isRtl ? "right-3" : "left-3"} px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${gold} text-black`}>{badge(p)}</span>
                        </button>
                        <div className="p-4 flex flex-col gap-2.5 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-serif text-[15px] font-medium leading-snug line-clamp-2">{isRtl && p.titleAr ? p.titleAr : p.title}</h3>
                            <p className="text-gold font-bold text-sm whitespace-nowrap">{formatPrice(p.price, isRtl)}<span className="text-[10px] font-medium text-white/50"> {period(p)}</span></p>
                          </div>
                          <p className="flex items-center gap-1.5 text-xs text-white/60"><MapPin size={12} className="shrink-0" />{[p.district, p.city].filter(Boolean).join(", ")}</p>
                          <div className="flex items-center gap-4 text-xs text-white/75">
                            {p.bedrooms > 0 && <span className="flex items-center gap-1.5"><Bed size={13} className="text-gold" />{p.bedrooms}</span>}
                            {p.bathrooms > 0 && <span className="flex items-center gap-1.5"><Bath size={13} className="text-gold" />{p.bathrooms}</span>}
                            <span className="flex items-center gap-1.5"><Maximize2 size={13} className="text-gold" />{p.area} {p.sizeUnit === "SQFT" ? t("sqft", "قدم²") : "m²"}</span>
                          </div>
                          {why && (
                            <p className="text-xs text-white/65 leading-relaxed border-s-2 border-gold/70 ps-3">{why}</p>
                          )}
                          <button onClick={() => onOpenProperty(p)}
                            className="mt-auto pt-1 self-start text-xs font-semibold text-gold hover:underline cursor-pointer">
                            {t("View details", "عرض التفاصيل")} {isRtl ? "←" : "→"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {m.id === lastAssistant?.id && !busy && !m.failed && m.matches && m.matches.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {followUps.map(f => (
                      <button key={f} onClick={() => ask(f)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-white/15 text-white/80 hover:text-white hover:border-gold/60 hover:bg-white/5 transition-colors cursor-pointer">{f}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex gap-3" role="status" aria-live="polite">
              <span className={`w-8 h-8 shrink-0 rounded-lg ${gold} flex items-center justify-center mt-0.5`}><NerouAiMark size={17} strokeWidth={2.1} className="text-black animate-pulse" /></span>
              <div className="flex items-center gap-3 pt-1.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
                <span className="text-xs text-white/55">{slow
                  ? t("Still searching, this is taking a little longer than usual...", "ما زلت أبحث، الأمر يستغرق وقتاً أطول قليلاً من المعتاد...")
                  : t("Searching the live listings...", "جارٍ البحث في العقارات المتاحة...")}</span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </main>

      {/* composer */}
      <footer className="relative z-10 px-4 sm:px-6 pt-2 pb-4 bg-gradient-to-t from-[#0f0d0b] via-[#0f0d0b] to-transparent">
        <form onSubmit={e => { e.preventDefault(); ask(input); }} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 p-2 ps-4 rounded-3xl bg-white/[0.07] backdrop-blur-md border border-white/15 focus-within:border-gold/70 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors">
            <textarea
              ref={boxRef}
              value={input}
              rows={1}
              onChange={e => { setInput(e.target.value); grow(); }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(input); } }}
              placeholder={t("Describe the property you want...", "صف العقار الذي تبحث عنه...")}
              aria-label={t("Your message", "رسالتك")}
              maxLength={1000}
              className="flex-1 bg-transparent resize-none outline-none py-2.5 text-[15px] leading-relaxed placeholder:text-white/40 max-h-40 overflow-y-hidden"
            />
            <button type="submit" disabled={!input.trim() || busy} aria-label={t("Send", "إرسال")}
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center transition-all ${input.trim() && !busy ? `${gold} text-black shadow-[0_4px_14px_rgba(191,155,48,0.5)] cursor-pointer hover:scale-105` : "bg-white/10 text-white/35"}`}>
              <ArrowUp size={18} strokeWidth={2.6} />
            </button>
          </div>
          <p className="text-[11px] text-white/40 text-center mt-2.5 leading-relaxed">
            {t("Nerou Find AI searches the verified listings on the platform. Nerou does not negotiate, act as a broker or take commission. Check the details with the advertiser.",
              "يبحث Nerou Find AI في العقارات الموثّقة على المنصة. نيرو لا تتفاوض ولا تتوسط ولا تتقاضى عمولة. تحقق من التفاصيل مع المعلن.")}
          </p>
        </form>
      </footer>
    </div>
  );
}
