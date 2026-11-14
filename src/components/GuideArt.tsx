/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BadgeCheck, Banknote, BarChart3, BellRing, Briefcase, Building, CalendarClock, Camera, Check, ClipboardPaste, Copy, CreditCard, FileSpreadsheet,
  FileText, Gift, Inbox, LayoutDashboard, Link2, Mail, MapPin, Megaphone, MessageCircle, PenLine, Phone, Receipt, Rocket, Search, Send, ShieldCheck,
  Sparkles, Star, Sun, Upload, UserCircle, Users, Video, Zap
} from "lucide-react";
import type { GuideAccent, GuideLang } from "../lib/guide.js";

// The pictures of the guide. Each one is a small drawn copy of the real screen with numbered gold dots that match the numbered
// steps next to it. They are drawn in code, not photographed, so they always carry the current look and read in either language.
// A dot is attached to the thing it points at (not placed by coordinates), so it stays on it in both directions of writing.

const W = 560;
const H = 315;

type T = (en: string, ar: string) => string;
type Icon = React.ComponentType<{ size?: number; strokeWidth?: number }>;

const BG: Record<GuideAccent, string> = {
  indigo: "from-indigo-50 to-indigo-200",
  emerald: "from-emerald-50 to-emerald-200",
  amber: "from-amber-50 to-amber-200",
  sky: "from-sky-50 to-sky-200",
  teal: "from-teal-50 to-teal-200",
  violet: "from-violet-50 to-violet-200",
  rose: "from-rose-50 to-rose-200",
  fuchsia: "from-fuchsia-50 to-fuchsia-200",
  gold: "from-amber-50 to-yellow-200"
};

// ---- building blocks --------------------------------------------------------------------------------------------

/** The numbered gold dot, hung on the top corner of whatever it sits in. */
function Dot({ n }: { n: number }) {
  return (
    <span className="absolute z-30 -top-2.5 -end-2.5 w-[22px] h-[22px] rounded-full bg-gold text-gold-ink text-[12px] font-bold leading-[22px] text-center shadow-md ring-2 ring-white">
      {n}
    </span>
  );
}

type PinProps = { pin?: number };

/** A wrapper that only adds a dot: for things that are not a Card, a Button... of their own. */
function Pin({ n, className = "", children }: { n: number; className?: string; children: React.ReactNode }) {
  return <div className={`relative ${className}`}>{children}<Dot n={n} /></div>;
}

function Bar({ w = 60, h = 6, tone = "bg-slate-200", className = "" }: { w?: number | string; h?: number; tone?: string; className?: string }) {
  return <span style={{ width: w, height: h }} className={`block rounded-full shrink-0 ${tone} ${className}`} />;
}

function Chip({ children, tone = "bg-slate-100 text-slate-600", className = "", pin }: { children: React.ReactNode; tone?: string; className?: string } & PinProps) {
  return <span className={`relative inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold leading-none whitespace-nowrap ${tone} ${className}`}>{children}{pin ? <Dot n={pin} /> : null}</span>;
}

function Btn({ children, tone = "bg-gold text-gold-ink", className = "", pin }: { children: React.ReactNode; tone?: string; className?: string } & PinProps) {
  return <span className={`relative inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap shadow-sm ${tone} ${className}`}>{children}{pin ? <Dot n={pin} /> : null}</span>;
}

function Tile({ icon: Icon, tone = "bg-sky-100 text-sky-700", size = 28 }: { icon: Icon; tone?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={`rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.25} />
    </span>
  );
}

function Face({ tone = "bg-indigo-300", size = 22 }: { tone?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={`rounded-full shrink-0 flex items-end justify-center overflow-hidden ${tone}`}>
      <span style={{ width: size * 0.5, height: size * 0.5 }} className="rounded-full bg-white/70 translate-y-[28%]" />
    </span>
  );
}

function Card({ children, className = "", pin }: { children: React.ReactNode; className?: string } & PinProps) {
  return <div className={`relative rounded-xl bg-white border border-slate-200 shadow-sm ${className}`}>{children}{pin ? <Dot n={pin} /> : null}</div>;
}

const NAV: { icon: Icon; tone: string }[] = [
  { icon: LayoutDashboard, tone: "bg-indigo-400/30 text-indigo-200" },
  { icon: Inbox, tone: "bg-emerald-400/30 text-emerald-200" },
  { icon: Briefcase, tone: "bg-amber-400/30 text-amber-200" },
  { icon: Building, tone: "bg-sky-400/30 text-sky-200" },
  { icon: ShieldCheck, tone: "bg-teal-400/30 text-teal-200" },
  { icon: Star, tone: "bg-rose-400/30 text-rose-200" },
  { icon: UserCircle, tone: "bg-fuchsia-400/30 text-fuchsia-200" }
];

/**
 * The dashboard frame: a dark side menu with one section lit (`active`) and the page.
 * `pins` hangs a dot on menu items (index in the menu -> number); `activeIcon` swaps the lit item's icon for the section's own.
 */
function Shell({ active, activeIcon, pins = {}, children }: { active: number; activeIcon?: Icon; pins?: Record<number, number>; children: React.ReactNode }) {
  return (
    <div className="absolute inset-[14px] rounded-2xl bg-slate-50 border border-slate-200 shadow-xl overflow-hidden flex">
      <div className="w-[64px] shrink-0 bg-gradient-to-b from-[#0f1c33] to-[#16243d] p-2 flex flex-col gap-1.5 items-center">
        <span className="w-8 h-8 rounded-lg bg-gold text-gold-ink font-bold text-[13px] flex items-center justify-center mb-1">N</span>
        {NAV.map((n, i) => {
          const I = i === active && activeIcon ? activeIcon : n.icon;
          return (
            <span key={i} className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${n.tone} ${i === active ? "ring-2 ring-gold bg-white/20" : ""}`}>
              <I size={17} strokeWidth={2.25} />
              {pins[i] ? <Dot n={pins[i]} /> : null}
            </span>
          );
        })}
      </div>
      <div className="flex-1 min-w-0 relative p-3.5">{children}</div>
    </div>
  );
}

function Title({ icon, tone, children }: { icon: Icon; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Tile icon={icon} tone={tone} size={30} />
      <span className="font-serif text-[15px] font-semibold text-slate-800">{children}</span>
    </div>
  );
}

function Strip({ items }: { items: { icon: Icon; tone: string; v: string; l: string }[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(i => (
        <Card key={i.l} className="p-1.5 flex items-center gap-1.5">
          <Tile icon={i.icon} tone={i.tone} size={24} />
          <span className="min-w-0">
            <span className="block font-serif text-[14px] font-semibold text-slate-800 leading-none">{i.v}</span>
            <span className="block text-[8.5px] text-slate-500 mt-0.5 truncate">{i.l}</span>
          </span>
        </Card>
      ))}
    </div>
  );
}

const Toggle = ({ on = true }: { on?: boolean }) => (
  <span className={`w-8 h-[18px] rounded-full relative shrink-0 ${on ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white ${on ? "end-[2px]" : "start-[2px]"}`} /></span>
);

const Field = ({ children, dir }: { children?: React.ReactNode; dir?: "ltr" }) => (
  <span dir={dir} className="block h-[22px] rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[8.5px] leading-[22px] text-slate-400 truncate">{children}</span>
);

// ---- the pictures -----------------------------------------------------------------------------------------------

function Dashboard({ t }: { t: T }) {
  return (
    <Shell active={0} pins={{ 1: 4 }}>
      <Pin n={1} className="rounded-xl bg-gradient-to-br from-[#0f1c33] to-[#1d2f50] p-3 flex items-center justify-between">
        <div>
          <Bar w={50} h={5} tone="bg-gold" />
          <p className="font-serif text-white text-[14px] mt-1.5">{t("Good morning, Sara", "صباح الخير، سارة")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white relative"><BellRing size={14} /><span className="absolute -top-0.5 -end-0.5 w-3 h-3 rounded-full bg-gold" /></span>
          <Btn>+ {t("New property", "عقار جديد")}</Btn>
        </div>
      </Pin>
      <Card pin={2} className="mt-2.5 p-2.5">
        <p className="font-serif text-[11px] font-semibold text-slate-800 mb-1.5">{t("Needs your attention", "ما يحتاج انتباهك")}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 p-1.5"><Tile icon={AlertTriangle} tone="bg-rose-500 text-white" size={20} /><span className="text-[9px] font-medium text-slate-700">{t("2 enquiries are waiting for your reply", "استفساران ينتظران ردك")}</span></div>
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 p-1.5"><Tile icon={Camera} tone="bg-amber-500 text-white" size={20} /><span className="text-[9px] font-medium text-slate-700">{t("1 listing has no photos", "عقار واحد بلا صور")}</span></div>
        </div>
      </Card>
      <Pin n={3} className="grid grid-cols-3 gap-1.5 mt-2.5">
        {[{ i: Inbox, c: "bg-emerald-100 text-emerald-700", l: t("Reply to enquiries", "الرد على الاستفسارات") }, { i: Building, c: "bg-sky-100 text-sky-700", l: t("My listings", "عقاراتي") }, { i: UserCircle, c: "bg-fuchsia-100 text-fuchsia-700", l: t("Improve my profile", "حسّن ملفي") }].map(a => (
          <Card key={a.l} className="p-1.5 flex items-center gap-1.5"><Tile icon={a.i} tone={a.c} size={26} /><span className="text-[9px] font-semibold text-slate-700 leading-tight">{a.l}</span></Card>
        ))}
      </Pin>
    </Shell>
  );
}

function Verify({ t }: { t: T }) {
  const rows = [
    { n: t("Commercial registration", "السجل التجاري"), s: "ok" },
    { n: t("Real estate licence", "رخصة الوساطة العقارية"), s: "wait" },
    { n: t("Authorization letter", "خطاب التفويض"), s: "up" }
  ];
  return (
    <Shell active={4} pins={{ 4: 1 }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2"><Tile icon={ShieldCheck} tone="bg-teal-100 text-teal-700" size={30} /><span className="font-serif text-[15px] font-semibold text-slate-800">{t("Verification", "التوثيق")}</span></div>
        <Chip pin={4} tone="bg-emerald-100 text-emerald-700"><BadgeCheck size={11} />{t("Verified", "موثّق")}</Chip>
      </div>
      <div className="space-y-1.5">
        {rows.map(r => (
          <Card key={r.n} className="p-2 flex items-center gap-2">
            <Tile icon={FileText} tone="bg-slate-100 text-slate-500" size={26} />
            <span className="flex-1 text-[10px] font-semibold text-slate-700">{r.n}</span>
            {r.s === "ok" && <Chip tone="bg-emerald-100 text-emerald-700"><Check size={10} />{t("Approved", "معتمد")}</Chip>}
            {r.s === "wait" && <Chip pin={3} tone="bg-amber-100 text-amber-700">{t("In review", "قيد المراجعة")}</Chip>}
            {r.s === "up" && <Btn pin={2}><Upload size={10} />{t("Upload", "رفع")}</Btn>}
          </Card>
        ))}
      </div>
      <p className="text-[9px] text-slate-500 mt-2">{t("Clear photo or PDF. You see the status of each document.", "صورة واضحة أو PDF. ترى حالة كل مستند.")}</p>
    </Shell>
  );
}

function Profile({ t }: { t: T }) {
  return (
    <Shell active={6} pins={{ 6: 1 }}>
      <Title icon={UserCircle} tone="bg-fuchsia-100 text-fuchsia-700">{t("My profile", "الحساب")}</Title>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <Pin n={2} className="w-[70px] h-[70px] rounded-2xl bg-gradient-to-br from-indigo-300 to-fuchsia-300 ring-2 ring-gold">
            <span className="absolute inset-0 rounded-2xl overflow-hidden flex items-end justify-center"><span className="w-9 h-9 rounded-full bg-white/70 translate-y-2" /></span>
            <span className="absolute bottom-1 end-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center"><Camera size={11} className="text-gold-ink" /></span>
          </Pin>
          <Bar w={50} />
        </div>
        <Card className="flex-1 p-2.5 space-y-2">
          <p className="text-[9px] font-bold text-slate-500">{t("About me", "نبذة عني")}</p>
          <Pin n={3} className="space-y-1"><Bar w="95%" /><Bar w="88%" /><Bar w="60%" /></Pin>
          <Pin n={4} className="flex items-center gap-1 flex-wrap">
            <Chip tone="bg-sky-100 text-sky-700">{t("English", "الإنجليزية")}</Chip>
            <Chip tone="bg-sky-100 text-sky-700">{t("Arabic", "العربية")}</Chip>
            <Chip tone="bg-emerald-100 text-emerald-700"><MessageCircle size={10} />WhatsApp</Chip>
          </Pin>
          <Btn pin={5} className="mt-0.5"><Check size={10} />{t("Save", "حفظ")}</Btn>
        </Card>
      </div>
    </Shell>
  );
}

function Hub({ t }: { t: T }) {
  const cards = [
    { i: ClipboardPaste, c: "bg-amber-100 text-amber-700", a: t("Paste an ad", "الصق إعلاناً"), b: t("One listing, from WhatsApp", "عقار واحد من واتساب") },
    { i: FileSpreadsheet, c: "bg-teal-100 text-teal-700", a: t("Upload a file", "ارفع ملفاً"), b: t("Many at once (CSV, XML)", "كثيرة معاً (CSV، XML)") },
    { i: Link2, c: "bg-violet-100 text-violet-700", a: t("Connect your feed", "اربط خلاصتك"), b: t("Updates on its own", "تتحدّث وحدها") },
    { i: PenLine, c: "bg-sky-100 text-sky-700", a: t("Fill the form", "املأ النموذج"), b: t("Step by step", "خطوة بخطوة") }
  ];
  return (
    <Shell active={3} pins={{ 3: 1 }}>
      <Title icon={Building} tone="bg-sky-100 text-sky-700">{t("Add your listings", "أضف عقاراتك")}</Title>
      <div className="grid grid-cols-2 gap-2.5">
        {cards.map((c, i) => (
          <Card key={c.a} pin={i + 2} className="p-2.5 flex items-center gap-2">
            <Tile icon={c.i} tone={c.c} size={34} />
            <span><span className="block text-[10.5px] font-bold text-slate-800 leading-tight">{c.a}</span><span className="block text-[8.5px] text-slate-500 leading-tight mt-0.5">{c.b}</span></span>
          </Card>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 flex items-center justify-between"><span className="text-[9.5px] font-semibold text-emerald-800">{t("5 drafts are complete", "5 مسودات مكتملة")}</span><Btn tone="bg-emerald-600 text-white">{t("Publish them all", "انشرها كلها")}</Btn></div>
    </Shell>
  );
}

function Wizard({ t }: { t: T }) {
  const steps = [t("Type", "النوع"), t("Location", "الموقع"), t("Details", "المواصفات"), t("Photos", "الصور"), t("Review", "المراجعة")];
  return (
    <Shell active={3}>
      <div className="flex items-center justify-between px-1 mb-4 mt-1">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <span className={`relative w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center ${i < 1 ? "bg-gold text-gold-ink" : i === 1 ? "bg-chrome text-white ring-2 ring-gold" : "bg-slate-200 text-slate-500"}`}>{i < 1 ? <Check size={12} /> : i + 1}<Dot n={i + 1} /></span>
              <span className="text-[8.5px] font-semibold text-slate-600">{s}</span>
            </div>
            {i < steps.length - 1 && <span className={`h-px flex-1 -mt-4 mx-1 ${i < 1 ? "bg-gold" : "bg-slate-200"}`} />}
          </React.Fragment>
        ))}
      </div>
      <Card className="p-2 flex gap-2">
        <div className="w-[170px] h-[120px] rounded-lg bg-gradient-to-br from-emerald-100 to-sky-200 relative overflow-hidden">
          <span className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
          <MapPin size={26} className="absolute top-[34%] start-[44%] text-rose-500 drop-shadow" fill="currentColor" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <p className="text-[9px] font-bold text-slate-500">{t("Municipality", "البلدية")}</p><Bar w="90%" h={9} tone="bg-slate-100" />
          <p className="text-[9px] font-bold text-slate-500">{t("Area", "المنطقة")}</p><Bar w="75%" h={9} tone="bg-slate-100" />
          <Btn tone="bg-chrome text-white" className="mt-1">{t("Next", "التالي")}</Btn>
        </div>
      </Card>
    </Shell>
  );
}

function ImportFile({ t }: { t: T }) {
  return (
    <Shell active={3}>
      <div className="flex items-center justify-between mb-2"><span className="font-serif text-[14px] font-semibold text-slate-800">{t("Upload a file", "ارفع ملفاً")}</span><Btn pin={1} tone="bg-white text-slate-700 border border-slate-200"><FileSpreadsheet size={10} />{t("Template", "النموذج")}</Btn></div>
      <div className="flex gap-2.5">
        <Card pin={2} className="flex-1 p-2.5 !border-dashed !border-2 !border-teal-300 bg-teal-50/60 flex flex-col items-center justify-center gap-1.5 h-[126px]">
          <Tile icon={Upload} tone="bg-teal-100 text-teal-700" size={32} />
          <span className="text-[10px] font-bold text-slate-700">listings.csv</span>
          <Chip tone="bg-emerald-100 text-emerald-700"><Check size={9} />UTF-8</Chip>
        </Card>
        <Card pin={3} className="flex-1 p-2.5 h-[126px]">
          <p className="text-[9px] font-bold text-slate-500 mb-1">{t("Preview", "المعاينة")}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]"><span className="text-slate-600">{t("Will be added", "ستُضاف")}</span><b className="text-emerald-700">12</b></div>
            <div className="flex justify-between text-[10px]"><span className="text-slate-600">{t("Updated", "ستُحدَّث")}</span><b className="text-sky-700">3</b></div>
            <div className="flex justify-between text-[10px]"><span className="text-slate-600">{t("Skipped", "متخطّاة")}</span><b className="text-rose-600">2</b></div>
          </div>
          <div className="flex gap-1 mt-2"><Btn tone="bg-slate-100 text-slate-700">{t("Drafts", "مسودات")}</Btn><Btn pin={4}>{t("Publish", "نشر")}</Btn></div>
        </Card>
      </div>
      <Card pin={5} className="mt-3 p-2 flex items-center gap-2"><Tile icon={Link2} tone="bg-violet-100 text-violet-700" size={24} /><span className="text-[9px] text-slate-500 flex-1 truncate" dir="ltr">https://your-crm.com/feed.xml</span><Chip tone="bg-violet-100 text-violet-700">{t("every 6 h", "كل 6 ساعات")}</Chip></Card>
    </Shell>
  );
}

function Paste({ t }: { t: T }) {
  const f = [t("Rent", "إيجار"), t("Apartment", "شقة"), "QAR 6,500", t("2 beds", "غرفتان"), t("The Pearl", "اللؤلؤة")];
  return (
    <Shell active={3}>
      <Title icon={ClipboardPaste} tone="bg-amber-100 text-amber-700">{t("Paste an ad", "الصق إعلاناً")}</Title>
      <Card pin={1} className="p-2 h-[64px]">
        <p className="text-[9.5px] text-slate-600 leading-snug">{t("2BR apartment in The Pearl for rent 6500 per month, furnished, sea view…", "شقة غرفتين في اللؤلؤة للإيجار 6500 شهرياً مفروشة إطلالة بحرية…")}</p>
      </Card>
      <div className="mt-2 flex items-center gap-2"><Btn pin={2}><Sparkles size={10} />{t("Read my ad", "اقرأ إعلاني")}</Btn><span className="text-[8.5px] text-slate-400">{t("Phone numbers are removed", "تُحذف أرقام الهاتف")}</span></div>
      <Card pin={3} className="mt-2.5 p-2">
        <p className="text-[9px] font-bold text-slate-500 mb-1">{t("What we found", "ما وجدناه")}</p>
        <div className="flex flex-wrap gap-1">{f.map(x => <Chip key={x} tone="bg-emerald-50 text-emerald-700 border border-emerald-200">{x}</Chip>)}<Chip tone="bg-slate-100 text-slate-400">{t("Size: add it", "المساحة: أضفها")}</Chip></div>
      </Card>
      <Btn pin={4} tone="bg-chrome text-white" className="mt-2.5">{t("Continue: add photos and publish", "تابع: أضف الصور وانشر")}</Btn>
    </Shell>
  );
}

function Quality({ t }: { t: T }) {
  return (
    <Shell active={3}>
      <div className="grid grid-cols-3 gap-2.5">
        <Card pin={1} className="col-span-2 p-1.5">
          <div className="h-[100px] rounded-lg bg-gradient-to-br from-sky-200 via-sky-100 to-amber-100 relative overflow-hidden"><Sun size={22} className="absolute top-2 end-2 text-amber-400" /><Building size={46} className="absolute bottom-0 start-6 text-white/80" /><Chip tone="bg-chrome text-white" className="absolute bottom-1.5 start-1.5">{t("Cover", "الغلاف")}</Chip></div>
          <div className="flex gap-1 mt-1"><span className="h-6 flex-1 rounded bg-sky-100" /><span className="h-6 flex-1 rounded bg-amber-100" /><span className="h-6 flex-1 rounded bg-emerald-100" /><span className="h-6 flex-1 rounded bg-slate-100 flex items-center justify-center"><Camera size={11} className="text-slate-400" /></span></div>
        </Card>
        <div className="space-y-2.5">
          <Card pin={2} className="h-[62px] bg-gradient-to-br from-emerald-100 to-sky-100 relative"><MapPin size={22} className="absolute top-3 start-[40%] text-rose-500" fill="currentColor" /></Card>
          <Card pin={3} className="h-[58px] flex items-center justify-center"><span className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center"><Video size={16} /></span></Card>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <Card pin={4} className="p-2"><p className="text-[9px] font-bold text-slate-500 mb-1">{t("Price vs market", "السعر مقابل السوق")}</p><div className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-400 relative"><span className="absolute -top-1 start-[48%] w-3 h-4 rounded bg-slate-800" /></div><Chip tone="bg-emerald-100 text-emerald-700" className="mt-1.5">{t("Fair price", "سعر عادل")}</Chip></Card>
        <Card pin={5} className="p-2 flex items-center justify-between"><span className="text-[9.5px] font-semibold text-slate-700">{t("Still available?", "ما زال متاحاً؟")}</span><Toggle /></Card>
      </div>
    </Shell>
  );
}

function AgencyListings({ t }: { t: T }) {
  const rows = [
    { n: t("Marina 2BR sea view", "شقة غرفتين مارينا"), c: "bg-emerald-100 text-emerald-700", s: t("Live", "منشور") },
    { n: t("West Bay office", "مكتب الخليج الغربي"), c: "bg-amber-100 text-amber-700", s: t("Draft", "مسودة"), pin: 4 },
    { n: t("Lusail villa", "فيلا لوسيل"), c: "bg-emerald-100 text-emerald-700", s: t("Live", "منشور") }
  ];
  return (
    <Shell active={3}>
      <Pin n={1}><Strip items={[{ icon: Building, tone: "bg-sky-100 text-sky-700", v: "24", l: t("Total", "الإجمالي") }, { icon: Check, tone: "bg-emerald-100 text-emerald-700", v: "19", l: t("Live", "منشورة") }, { icon: AlertTriangle, tone: "bg-amber-100 text-amber-700", v: "5", l: t("Not live", "غير منشورة") }, { icon: Users, tone: "bg-violet-100 text-violet-700", v: "6", l: t("Agents", "وسطاء") }]} /></Pin>
      <Card pin={2} className="mt-2.5 px-2 py-1.5 flex items-center gap-1.5"><Search size={12} className="text-slate-400" /><span className="text-[9px] text-slate-400">{t("Search title, area or agent…", "ابحث بالعنوان أو المنطقة أو الوسيط…")}</span></Card>
      <div className="mt-2 space-y-1.5">
        {rows.map((r, i) => (
          <Card key={r.n} pin={i === 0 ? 3 : undefined} className="p-1.5 flex items-center gap-2"><span className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-200 to-sky-100 shrink-0" /><span className="flex-1 min-w-0"><span className="block text-[10px] font-bold text-slate-800 truncate">{r.n}</span><span className="flex items-center gap-1 mt-0.5"><Face size={12} /><Bar w={34} h={4} /></span></span><Chip pin={r.pin} tone={r.c}>{r.s}</Chip><PenLine size={12} className="text-slate-400" /></Card>
        ))}
      </div>
    </Shell>
  );
}

function Leads({ t }: { t: T }) {
  const rows = [
    { n: t("Khalid A.", "خالد ع."), s: t("New", "جديد"), c: "bg-rose-100 text-rose-700" },
    { n: t("Maha S.", "مها س."), s: t("Contacted", "تم التواصل"), c: "bg-sky-100 text-sky-700" },
    { n: t("Omar R.", "عمر ر."), s: t("Viewing", "معاينة"), c: "bg-emerald-100 text-emerald-700" }
  ];
  return (
    <Shell active={1} pins={{ 1: 1 }}>
      <Title icon={Inbox} tone="bg-emerald-100 text-emerald-700">{t("Leads", "العملاء المحتملون")}</Title>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <Card key={r.n} className="p-2">
            <div className="flex items-center gap-2"><Face tone={["bg-rose-300", "bg-sky-300", "bg-emerald-300"][i]} size={24} /><span className="flex-1 text-[10.5px] font-bold text-slate-800">{r.n}</span><Chip tone={r.c}>{r.s}</Chip></div>
            {i === 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <Btn pin={2} tone="bg-emerald-500 text-white"><MessageCircle size={10} />WhatsApp</Btn>
                <Btn tone="bg-sky-500 text-white"><Phone size={10} /></Btn>
                <Btn tone="bg-slate-200 text-slate-700"><Mail size={10} /></Btn>
                <Pin n={3} className="flex-1 h-6 rounded-lg bg-slate-50 border border-slate-200 px-1.5 flex items-center text-[8.5px] text-slate-400">{t("Add a note…", "أضف ملاحظة…")}</Pin>
                <Btn pin={4} tone="bg-slate-100 text-slate-600">{t("Archive", "أرشفة")}</Btn>
              </div>
            )}
          </Card>
        ))}
      </div>
    </Shell>
  );
}

function AgencyLeads({ t }: { t: T }) {
  return (
    <Shell active={1} pins={{ 2: 4 }}>
      <Pin n={1}><Strip items={[{ icon: Inbox, tone: "bg-emerald-100 text-emerald-700", v: "31", l: t("Total", "الإجمالي") }, { icon: BellRing, tone: "bg-rose-100 text-rose-700", v: "4", l: t("Waiting", "منتظر") }, { icon: Users, tone: "bg-violet-100 text-violet-700", v: "2", l: t("Unassigned", "غير موزَّع") }]} /></Pin>
      <Pin n={2} className="flex gap-1.5 mt-3 w-fit"><Chip tone="bg-chrome text-white">{t("All", "الكل")}</Chip><Chip tone="bg-white text-slate-600 border border-slate-200">{t("Unassigned", "غير موزَّع")}</Chip><Chip tone="bg-white text-slate-600 border border-slate-200">{t("Waiting", "منتظر")}</Chip></Pin>
      <Card className="mt-2.5 p-2.5">
        <div className="flex items-center gap-2"><Face tone="bg-rose-300" size={26} /><span className="flex-1"><span className="block text-[10.5px] font-bold text-slate-800">{t("Khalid A.", "خالد ع.")}</span><span className="block text-[8.5px] text-slate-500">{t("Asked about Marina 2BR", "سأل عن شقة المارينا")}</span></span><Chip tone="bg-rose-100 text-rose-700">{t("Waiting 3h", "ينتظر 3 ساعات")}</Chip></div>
        <div className="flex items-center gap-1.5 mt-2.5"><span className="text-[9px] font-bold text-slate-500">{t("Assign to", "عيّن إلى")}</span><Pin n={3} className="flex-1 h-7 rounded-lg border border-slate-200 bg-slate-50 px-1.5 flex items-center gap-1.5"><Face tone="bg-indigo-300" size={16} /><Bar w={50} /></Pin><Btn tone="bg-chrome text-white">{t("Move", "نقل")}</Btn></div>
      </Card>
    </Shell>
  );
}

function Pipeline({ t }: { t: T }) {
  const cols = [
    { h: t("New", "جديد"), c: "bg-slate-400", n: 3 },
    { h: t("Contacted", "تم التواصل"), c: "bg-sky-500", n: 2 },
    { h: t("Viewing", "معاينة"), c: "bg-amber-500", n: 2 },
    { h: t("Negotiation", "تفاوض"), c: "bg-emerald-500", n: 1 }
  ];
  return (
    <Shell active={2}>
      <div className="flex items-center justify-between mb-2"><span className="font-serif text-[14px] font-semibold text-slate-800">{t("Sales Desk", "مكتب المبيعات")}</span><div className="flex gap-1"><Btn tone="bg-white text-slate-700 border border-slate-200"><Upload size={10} />{t("Import", "استيراد")}</Btn><Btn pin={1}><Users size={10} />{t("Add client", "إضافة عميل")}</Btn></div></div>
      <Pin n={5}><Strip items={[{ icon: Users, tone: "bg-indigo-100 text-indigo-700", v: "8", l: t("Open clients", "عملاء مفتوحون") }, { icon: BellRing, tone: "bg-rose-100 text-rose-700", v: "3", l: t("Follow-ups due", "متابعات") }, { icon: CalendarClock, tone: "bg-sky-100 text-sky-700", v: "2", l: t("Viewings", "معاينات") }, { icon: Banknote, tone: "bg-emerald-100 text-emerald-700", v: "18k", l: t("Commission", "عمولات") }]} /></Pin>
      <Pin n={2} className="grid grid-cols-4 gap-1.5 mt-3">
        {cols.map((c, ci) => (
          <div key={c.h} className="rounded-lg bg-slate-100 p-1">
            <div className="flex items-center gap-1 mb-1"><span className={`w-1.5 h-1.5 rounded-full ${c.c}`} /><span className="text-[8.5px] font-bold text-slate-600 truncate">{c.h}</span></div>
            <div className="space-y-1.5">{Array.from({ length: c.n }).map((_, i) => <Card key={i} pin={ci === 1 && i === 0 ? 3 : ci === 2 && i === 0 ? 4 : undefined} className={`p-1 ${ci === 1 && i === 0 ? "!ring-2 ring-gold" : ""}`}><Bar w="80%" h={5} tone="bg-slate-300" /><Bar w="50%" h={4} className="mt-1" /></Card>)}</div>
          </div>
        ))}
      </Pin>
    </Shell>
  );
}

function FollowUps({ t }: { t: T }) {
  const tomorrow = <Chip tone="bg-slate-100 text-slate-600">{t("Tomorrow", "غداً")}</Chip>;
  return (
    <Shell active={2}>
      <div className="flex items-center justify-between mb-2.5"><span className="font-serif text-[14px] font-semibold text-slate-800">{t("Follow-ups", "المتابعات")}</span>
        <Pin n={4} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-semibold text-slate-600"><BellRing size={11} className="text-gold-active" />{t("Reminder emails", "إيميلات التذكير")}<Toggle /></Pin></div>
      <div className="flex gap-2.5">
        <div className="flex-1 space-y-1.5">
          <p className="text-[9px] font-bold text-rose-600">{t("Overdue", "متأخرة")}</p>
          <Card pin={1} className="p-1.5 flex items-center gap-1.5"><Face tone="bg-rose-300" size={20} /><Bar w={44} h={5} tone="bg-slate-300" /><span className="flex-1" /><Chip className="bg-slate-100 text-slate-600">{t("Set date", "حدّد موعداً")}</Chip></Card>
          <p className="text-[9px] font-bold text-amber-600">{t("Today", "اليوم")}</p>
          <Card pin={2} className="p-1.5 flex items-center gap-1.5"><Face tone="bg-sky-300" size={20} /><Bar w={40} h={5} tone="bg-slate-300" /><span className="flex-1" />{tomorrow}</Card>
          <Card className="p-1.5 flex items-center gap-1.5"><Face tone="bg-emerald-300" size={20} /><Bar w={52} h={5} tone="bg-slate-300" /><span className="flex-1" />{tomorrow}</Card>
        </div>
        <Card pin={3} className="w-[150px] p-2">
          <p className="text-[9px] font-bold text-slate-500 mb-1">{t("Viewings", "المعاينات")}</p>
          <div className="rounded-lg bg-sky-50 border border-sky-200 p-1.5"><div className="flex items-center gap-1 text-[9.5px] font-bold text-sky-800"><CalendarClock size={11} />{t("Thu 5:30 pm", "الخميس 5:30 م")}</div><Bar w={70} h={4} className="mt-1" /><div className="flex gap-1 mt-1.5"><Chip tone="bg-emerald-100 text-emerald-700">{t("Done", "تمت")}</Chip><Chip tone="bg-slate-100 text-slate-600">{t("Move", "تأجيل")}</Chip></div></div>
        </Card>
      </div>
    </Shell>
  );
}

function Deals({ t }: { t: T }) {
  return (
    <Shell active={2}>
      <div className="flex gap-2.5">
        <Card pin={1} className="flex-1 p-2.5">
          <p className="text-[9px] font-bold text-slate-500 mb-1">{t("Tasks & renewals", "المهام والتجديدات")}</p>
          {[{ h: t("Today", "اليوم"), c: "text-amber-600" }, { h: t("Next 7 days", "7 أيام"), c: "text-slate-700" }].map(g => (
            <div key={g.h} className="mb-1.5"><p className={`text-[8.5px] font-bold ${g.c}`}>{g.h}</p><div className="flex items-center gap-1.5 mt-0.5"><span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" /><Bar w={70} h={5} tone="bg-slate-300" /></div><div className="flex items-center gap-1.5 mt-1"><span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" /><Bar w={52} h={5} tone="bg-slate-300" /></div></div>
          ))}
        </Card>
        <div className="w-[190px] space-y-2.5">
          <Card pin={2} className="p-2.5"><p className="text-[9px] font-bold text-slate-500">{t("Deal closed", "صفقة مغلقة")}</p><p className="font-serif text-[18px] font-bold text-emerald-700 mt-0.5">QAR 12,000</p><div className="flex gap-1 mt-1"><Chip tone="bg-amber-100 text-amber-700">{t("Expected", "متوقعة")}</Chip><Chip pin={3} tone="bg-rose-50 text-rose-600">{t("Lost: price", "خسارة: السعر")}</Chip></div></Card>
          <Btn pin={4} tone="bg-white text-slate-700 border border-slate-200 w-full"><BarChart3 size={11} />{t("Download report", "تحميل التقرير")}</Btn>
        </div>
      </div>
    </Shell>
  );
}

function PublicPage({ t }: { t: T }) {
  return (
    <Shell active={0}>
      <div className="flex gap-2.5">
        <Card pin={1} className="flex-1 p-2.5">
          <p className="text-[9px] font-bold text-slate-500 mb-1">{t("Your public page", "صفحتك العامة")}</p>
          <div className="flex items-center gap-2 mb-1.5"><Face tone="bg-indigo-300" size={34} /><span><span className="block text-[11px] font-bold text-slate-800">{t("Sara Al-Thani", "سارة آل ثاني")}</span><Chip tone="bg-emerald-100 text-emerald-700"><BadgeCheck size={9} />{t("Verified", "موثّقة")}</Chip></span></div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-1.5 py-1"><span className="flex-1 text-[8.5px] text-slate-500 truncate" dir="ltr">neroufinder.com/agents/sara-2f9</span><Copy size={11} className="text-slate-500" /></div>
          <div className="flex gap-1 mt-2"><Btn pin={2} tone="bg-emerald-500 text-white"><MessageCircle size={10} />WhatsApp</Btn><Btn pin={3} tone="bg-slate-100 text-slate-700"><Send size={10} />{t("Share listing", "مشاركة عقار")}</Btn></div>
          <Pin n={4} className="flex items-end gap-1 mt-2.5 h-8">{[10, 16, 12, 22, 18, 28, 24].map((h, i) => <span key={i} style={{ height: h }} className="flex-1 rounded-t bg-gold/80" />)}</Pin>
        </Card>
        <div className="w-[130px] rounded-2xl bg-slate-800 p-1.5 shadow-lg self-start"><div className="rounded-xl bg-[#e7efe3] min-h-[150px] p-2"><div className="rounded-lg bg-white p-1.5 shadow-sm"><p className="text-[8.5px] text-slate-700 leading-snug">{t("Sara on Nerou Finder:", "سارة على نيرو فايندر:")}</p><p className="text-[8px] text-sky-600 mt-0.5" dir="ltr">neroufinder.com/…</p></div></div></div>
      </div>
    </Shell>
  );
}

function Reviews({ t }: { t: T }) {
  return (
    <Shell active={5} pins={{ 5: 1 }}>
      <div className="flex gap-2.5">
        <Card className="flex-1 p-2.5">
          <p className="text-[9px] font-bold text-slate-500 mb-2">{t("Ask for a review", "اطلب تقييماً")}</p>
          {[t("Khalid A.", "خالد ع."), t("Maha S.", "مها س."), t("Omar R.", "عمر ر.")].map((n, i) => (
            <div key={n} className="flex items-center gap-1.5 mb-2"><Face size={18} tone="bg-sky-300" /><span className="flex-1 text-[9.5px] font-semibold text-slate-700">{n}</span><Btn pin={i === 0 ? 2 : undefined} tone="bg-emerald-500 text-white"><Send size={9} />{t("Send", "إرسال")}</Btn></div>
          ))}
        </Card>
        <Card className="flex-1 p-2.5">
          <div className="flex gap-0.5 text-amber-400">{[0, 1, 2, 3, 4].map(i => <Star key={i} size={12} fill="currentColor" />)}</div>
          <p className="text-[9px] text-slate-600 mt-1 leading-snug">{t("Quick, honest and helpful. Found us the right flat.", "سريعة وصادقة ومفيدة. وجدت لنا الشقة المناسبة.")}</p>
          <div className="mt-1.5 rounded-lg bg-slate-50 border border-slate-200 p-1.5"><Bar w="90%" h={4} /><Bar w="60%" h={4} className="mt-1" /></div>
          <Btn pin={3} className="mt-2">{t("Reply", "ردّ")}</Btn>
        </Card>
      </div>
    </Shell>
  );
}

function PriceCheck({ t }: { t: T }) {
  return (
    <div className="absolute inset-[14px] rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
      <div className="h-[30px] bg-chrome flex items-center px-3 gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" /><span className="w-2 h-2 rounded-full bg-amber-400" /><span className="w-2 h-2 rounded-full bg-emerald-400" /><Pin n={1} className="mx-auto text-[9px] text-gray-300 rounded bg-white/10 px-3 py-0.5"><span dir="ltr">neroufinder.com/price-check</span></Pin></div>
      <div className="p-3.5 flex gap-4">
        <Pin n={2} className="w-[170px] space-y-1.5 h-fit">
          <p className="font-serif text-[13px] font-semibold text-slate-800">{t("Is this price fair?", "هل السعر عادل؟")}</p>
          {[t("Rent / Sale", "إيجار / بيع"), t("Area", "المنطقة"), t("Size and rooms", "المساحة والغرف"), t("Price", "السعر")].map(l => <div key={l}><p className="text-[8px] font-bold text-slate-500">{l}</p><span className="block h-5 rounded-md border border-slate-200 bg-slate-50" /></div>)}
        </Pin>
        <div className="flex-1 flex flex-col items-center">
          <svg viewBox="0 0 160 90" className="w-[170px]"><path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" /><path d="M15 80 A65 65 0 0 1 60 22" fill="none" stroke="#38bdf8" strokeWidth="14" strokeLinecap="round" /><path d="M60 22 A65 65 0 0 1 100 22" fill="none" stroke="#34d399" strokeWidth="14" /><path d="M100 22 A65 65 0 0 1 145 80" fill="none" stroke="#fb7185" strokeWidth="14" strokeLinecap="round" /><line x1="80" y1="80" x2="84" y2="30" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" /><circle cx="80" cy="80" r="6" fill="#0f172a" /></svg>
          <Chip pin={3} tone="bg-emerald-100 text-emerald-700" className="!text-[11px] !px-3 !py-1.5 -mt-1">{t("A fair price", "سعر عادل")}</Chip>
          <div className="flex gap-1.5 mt-3"><Btn pin={4} tone="bg-emerald-500 text-white"><Send size={10} />{t("Share", "مشاركة")}</Btn><Btn tone="bg-slate-100 text-slate-700"><Camera size={10} />{t("Picture", "صورة")}</Btn></div>
        </div>
      </div>
    </div>
  );
}

function Boost({ t }: { t: T }) {
  return (
    <Shell active={3} pins={{ 3: 1 }}>
      <Card className="p-2.5">
        <div className="flex gap-2"><span className="w-[84px] h-[58px] rounded-lg bg-gradient-to-br from-sky-200 to-amber-100 shrink-0" /><span className="flex-1"><span className="block text-[10.5px] font-bold text-slate-800">{t("Marina 2BR sea view", "شقة غرفتين مارينا")}</span><Bar w={80} h={5} className="mt-1.5" /><Chip tone="bg-emerald-100 text-emerald-700" className="mt-1.5">{t("Live", "منشور")}</Chip></span></div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <Btn pin={2} tone="bg-sky-500 text-white"><Zap size={10} />{t("Bump · 49 QAR", "رفع · 49 ر.ق")}</Btn>
          <Btn tone="bg-amber-500 text-white"><Rocket size={10} />{t("Featured · 299 QAR/wk", "مميز · 299 ر.ق/أسبوع")}</Btn>
        </div>
      </Card>
      <Pin n={3} className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 flex items-start gap-1.5"><AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" /><span className="text-[9px] text-amber-900 leading-snug">{t("This listing has no photos. Fix it first, then boost.", "هذا العقار بلا صور. أصلحه أولاً ثم ارفعه.")}</span></Pin>
      <Pin n={4} className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 p-2"><Gift size={13} className="text-emerald-700" /><span className="text-[9px] font-semibold text-emerald-800">{t("2 free boost credits: used automatically", "رصيدان مجانيان: يُستخدمان تلقائياً")}</span></Pin>
    </Shell>
  );
}

function Campaigns({ t }: { t: T }) {
  return (
    <Shell active={5} activeIcon={Megaphone}>
      <div className="grid grid-cols-2 gap-2.5">
        <Card pin={1} className="p-2.5"><p className="text-[9px] font-bold text-slate-500 mb-1.5">{t("Instant boosts", "الرفع الفوري")}</p>{[0, 1, 2].map(i => <div key={i} className="flex items-center gap-1.5 mb-1.5"><span className="w-6 h-6 rounded bg-sky-100" /><Bar w={44} h={5} tone="bg-slate-300" /><span className="flex-1" /><Btn tone="bg-sky-500 text-white"><Zap size={9} /></Btn></div>)}</Card>
        <Card pin={2} className="p-2.5 !bg-gradient-to-br from-violet-50 to-white"><p className="flex items-center gap-1 text-[9px] font-bold text-violet-700 mb-1.5"><Sparkles size={11} />{t("Recommended to boost", "موصى برفعه")}</p><div className="rounded-lg bg-white border border-violet-200 p-1.5"><Bar w="80%" h={5} tone="bg-slate-300" /><p className="text-[8.5px] text-slate-500 mt-1 leading-snug">{t("Good photos, fair price, few views", "صور جيدة وسعر عادل ومشاهدات قليلة")}</p></div></Card>
        <Card pin={3} className="p-2.5"><p className="text-[9px] font-bold text-slate-500 mb-1">{t("Launch a promotion", "أطلق ترويجاً")}</p><div className="space-y-1.5"><Field>{t("Budget (QAR)", "الميزانية (ر.ق)")}</Field><Btn tone="bg-chrome text-white">{t("Launch", "إطلاق")}</Btn></div></Card>
        <Card pin={4} className="p-2.5"><p className="text-[9px] font-bold text-slate-500 mb-1.5">{t("Ad ledger", "سجل الإعلانات")}</p><Chip tone="bg-slate-100 text-slate-700">{t("This month: 1,240 QAR", "هذا الشهر: 1,240 ر.ق")}</Chip></Card>
      </div>
    </Shell>
  );
}

function Cma({ t }: { t: T }) {
  return (
    <Shell active={3} pins={{ 3: 1 }}>
      <div className="flex gap-3 items-start">
        <Card className="flex-1 p-2.5">
          <div className="flex gap-2"><span className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-200 to-amber-100 shrink-0" /><span className="flex-1"><span className="block text-[10px] font-bold text-slate-800">{t("Marina 2BR sea view", "شقة غرفتين مارينا")}</span><Bar w={60} h={5} className="mt-1" /></span></div>
          <div className="flex gap-1.5 mt-2.5 flex-wrap"><Btn tone="bg-emerald-500 text-white"><Send size={9} />{t("Share", "مشاركة")}</Btn><Btn pin={2} tone="bg-indigo-600 text-white"><FileText size={9} />{t("CMA Report", "تقرير تحليل السوق")}</Btn></div>
        </Card>
        <Card pin={3} className="w-[158px] p-2 rotate-[-2deg] !border-slate-300 shadow-lg">
          <div className="flex items-center justify-between"><span className="text-[8px] font-bold text-chrome">PDF</span><Bar w={30} h={4} tone="bg-gold" /></div>
          <p className="font-serif text-[9.5px] font-semibold text-slate-800 mt-1">{t("Market analysis", "تحليل السوق")}</p>
          {[70, 90, 55, 80].map((w, i) => <div key={i} className="flex items-center gap-1 mt-1"><Bar w={26} h={4} /><span style={{ width: `${w}%` }} className={`h-2 rounded ${i === 1 ? "bg-gold" : "bg-sky-300"}`} /></div>)}
          <div className="mt-2 flex items-center gap-1"><Face size={14} /><Bar w={44} h={4} /></div>
        </Card>
      </div>
    </Shell>
  );
}

function Referral({ t }: { t: T }) {
  return (
    <Shell active={0}>
      <Card pin={1} className="p-3 !bg-gradient-to-br from-emerald-50 to-white">
        <div className="flex items-center gap-2"><Tile icon={Gift} tone="bg-emerald-500 text-white" size={32} /><span className="font-serif text-[14px] font-semibold text-slate-800">{t("Invite & Earn", "ادعُ واربح")}</span></div>
        <div className="flex items-center gap-1.5 mt-3"><span className="flex-1 rounded-lg bg-white border border-slate-200 px-2 py-1.5 text-[9px] text-slate-500 truncate" dir="ltr">neroufinder.com/?ref=SARA24</span><Btn pin={2} tone="bg-chrome text-white"><Copy size={10} />{t("Copy link", "نسخ الرابط")}</Btn></div>
        <Pin n={3} className="flex items-center gap-5 mt-3.5 w-fit"><span><b className="font-serif text-[20px] text-slate-800">3</b><span className="block text-[8.5px] text-slate-500">{t("successful referrals", "إحالات ناجحة")}</span></span><span><b className="font-serif text-[20px] text-emerald-700">2</b><span className="block text-[8.5px] text-slate-500">{t("free boost credits", "أرصدة رفع مجانية")}</span></span></Pin>
      </Card>
    </Shell>
  );
}

function Team({ t }: { t: T }) {
  const agents = [t("Sara", "سارة"), t("Yousef", "يوسف"), t("Noor", "نور")];
  return (
    <Shell active={1} activeIcon={Users} pins={{ 1: 1 }}>
      <div className="flex gap-2.5">
        <Card pin={4} className="flex-1 p-2.5">
          <p className="text-[9px] font-bold text-slate-500 mb-2 flex items-center justify-between"><span>{t("Active brokers", "المستشارون الفعالون")}</span><span className="text-[8px] text-slate-400">{t("Sort: conversion", "الترتيب: التحويل")}</span></p>
          {agents.map((a, i) => <div key={a} className="flex items-center gap-1.5 mb-2"><Face size={20} tone={["bg-indigo-300", "bg-rose-300", "bg-emerald-300"][i]} /><span className="w-10 text-[9.5px] font-semibold text-slate-700">{a}</span><span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><span style={{ width: `${[78, 54, 31][i]}%` }} className="block h-full bg-gold" /></span><span className="text-[8.5px] font-bold text-slate-600 w-7 text-end">{[78, 54, 31][i]}%</span></div>)}
        </Card>
        <Card pin={2} className="w-[160px] p-2.5">
          <p className="text-[9px] font-bold text-slate-500 mb-1">{t("Invite agent", "دعوة وسيط")}</p>
          <Field>{t("Name", "الاسم")}</Field>
          <div className="mt-1"><Field dir="ltr">name@email.com</Field></div>
          <Btn className="mt-2 w-full"><Mail size={10} />{t("Send invitation", "إرسال الدعوة")}</Btn>
          <Chip pin={3} tone="bg-amber-100 text-amber-700" className="mt-2">{t("1 pending", "دعوة معلّقة")}</Chip>
        </Card>
      </div>
    </Shell>
  );
}

function Plan({ t }: { t: T }) {
  return (
    <Shell active={5} activeIcon={CreditCard} pins={{ 5: 1 }}>
      <Title icon={CreditCard} tone="bg-violet-100 text-violet-700">{t("Subscription", "الاشتراك")}</Title>
      <Card className="p-3 space-y-2.5">
        <div className="flex justify-between items-center text-[10px]"><span className="text-slate-500">{t("Current plan", "الخطة الحالية")}</span><b className="text-slate-800">{t("Professional", "احترافي")}</b></div>
        <div className="flex justify-between items-center text-[10px]"><span className="text-slate-500">{t("Status", "الحالة")}</span><Chip pin={2} tone="bg-emerald-100 text-emerald-700"><Check size={9} />{t("Active", "فعّال")}</Chip></div>
        <div className="flex justify-between items-center text-[10px]"><span className="text-slate-500">{t("Expires", "ينتهي")}</span><Pin n={3}><b className="text-slate-800" dir="ltr">31 Dec 2026</b></Pin></div>
        <p className="text-[8.5px] text-slate-400 border-t border-slate-100 pt-2 leading-snug">{t("The team activates and renews your plan after confirming payment.", "يفعّل الفريق خطتك ويجددها بعد تأكيد الدفع.")}</p>
      </Card>
    </Shell>
  );
}

function Billing({ t }: { t: T }) {
  return (
    <Shell active={5} activeIcon={Receipt} pins={{ 5: 1 }}>
      <Title icon={Receipt} tone="bg-teal-100 text-teal-700">{t("Billing", "الاشتراك والفواتير")}</Title>
      <Pin n={2} className="grid grid-cols-3 gap-1.5">
        {[{ l: t("Total", "الإجمالي"), v: "1,240" }, { l: t("Settled", "مسوّى"), v: "900" }, { l: t("Outstanding", "متبقٍ"), v: "340" }].map((x, i) => <Card key={x.l} className="p-2"><p className="text-[8.5px] text-slate-500">{x.l}</p><p className={`font-serif text-[16px] font-bold ${i === 2 ? "text-rose-600" : "text-slate-800"}`}>{x.v}</p></Card>)}
      </Pin>
      <Card pin={3} className="mt-3 p-2.5"><p className="text-[9px] font-bold text-slate-500 mb-1.5">{t("Payment history", "سجل المدفوعات")}</p>{[0, 1, 2].map(i => <div key={i} className="flex items-center gap-2 mb-1.5"><Bar w={40} h={5} /><Bar w={70} h={5} tone="bg-slate-300" /><span className="flex-1" /><Chip tone="bg-emerald-100 text-emerald-700">{t("Paid", "مدفوع")}</Chip></div>)}</Card>
    </Shell>
  );
}

const SCENES: Record<string, (p: { t: T }) => React.ReactElement> = {
  dashboard: Dashboard,
  verify: Verify,
  profile: Profile,
  "add-listings": Hub,
  "listing-form": Wizard,
  "import-file": ImportFile,
  "paste-ad": Paste,
  "listing-quality": Quality,
  "agency-listings": AgencyListings,
  leads: Leads,
  "agency-leads": AgencyLeads,
  pipeline: Pipeline,
  "follow-ups": FollowUps,
  deals: Deals,
  "public-page": PublicPage,
  reviews: Reviews,
  "price-check": PriceCheck,
  boost: Boost,
  campaigns: Campaigns,
  cma: Cma,
  referral: Referral,
  team: Team,
  plan: Plan,
  billing: Billing
};

export const GUIDE_ART_IDS = Object.keys(SCENES);

// The picture is drawn on a fixed 560 x 315 canvas and scaled to whatever room it has (a small card or the wide article).
function useFitScale(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { if (el.clientWidth > 0) setScale(el.clientWidth / W); };
    measure();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, scale];
}

export default function GuideArt({ id, lang, accent, className = "" }: { id: string; lang: GuideLang; accent: GuideAccent; className?: string }) {
  const [ref, scale] = useFitScale();
  const Scene = SCENES[id];
  const ar = lang === "ar";
  const t: T = (en, arText) => (ar ? arText : en);
  return (
    <div ref={ref} className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${BG[accent]} ${className}`} style={{ aspectRatio: `${W} / ${H}` }} role="img" aria-label={t("An illustration of this screen with numbered steps", "رسم توضيحي لهذه الشاشة بخطوات مرقّمة")}>
      <div
        dir={ar ? "rtl" : "ltr"}
        lang={lang}
        aria-hidden
        className="absolute top-0 select-none pointer-events-none"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: ar ? "top right" : "top left", [ar ? "right" : "left"]: 0 }}
      >
        <span className="absolute -top-10 -end-10 w-44 h-44 rounded-full bg-white/40 blur-2xl" />
        {Scene ? <Scene t={t} /> : null}
      </div>
    </div>
  );
}
