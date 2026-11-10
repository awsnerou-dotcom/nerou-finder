import {
  KanbanSquare, UserPlus, BellRing, CalendarCheck, Handshake, ListChecks, FileSpreadsheet, Lock, ArrowRight, Sparkles,
} from "lucide-react";

// What the Sales Desk really does - every line below exists in the product today.
// Kept in one list so the home page and the Plans page can never disagree.
export interface DeskFeature {
  icon: typeof KanbanSquare;
  en: { title: string; body: string };
  ar: { title: string; body: string };
}

export const DESK_FEATURES: DeskFeature[] = [
  {
    icon: KanbanSquare,
    en: { title: "Sales pipeline board", body: "Every client on one board: New, Contacted, Viewing, Negotiating, Won. Move them with one click." },
    ar: { title: "لوحة مسار المبيعات", body: "كل عملائك في لوحة واحدة: جديد، تم التواصل، معاينة، تفاوض، تم البيع. انقلهم بضغطة." },
  },
  {
    icon: UserPlus,
    en: { title: "Add any client, even from outside", body: "Type a client in, or import your whole Excel/CSV list. Your own clients, in one place." },
    ar: { title: "أضف أي عميل حتى من خارج المنصة", body: "اكتب عميلاً جديداً أو استورد قائمتك كاملة من إكسل. عملاؤك كلهم في مكان واحد." },
  },
  {
    icon: BellRing,
    en: { title: "Follow-up reminders by email", body: "One daily summary tells you who to call today. Never forget a client again." },
    ar: { title: "تذكيرات المتابعة بالإيميل", body: "ملخص واحد يخبرك بمن تتصل به اليوم. لن تنسى عميلاً بعد الآن." },
  },
  {
    icon: CalendarCheck,
    en: { title: "Viewing schedule", body: "Book property viewings, and the client gets a reminder too, so fewer no-shows." },
    ar: { title: "جدول المعاينات", body: "احجز معاينات العقارات ويصل العميل تذكير أيضاً، فتقل المواعيد الضائعة." },
  },
  {
    icon: Handshake,
    en: { title: "Deals and commission ledger", body: "Record each deal and your commission. See what you earned this month at a glance." },
    ar: { title: "سجل الصفقات والعمولات", body: "سجّل كل صفقة وعمولتك. اعرف ما كسبته هذا الشهر بنظرة واحدة." },
  },
  {
    icon: ListChecks,
    en: { title: "Tasks and lease renewals", body: "Schedule your own reminders. Get warned before a client's lease ends so you renew it first." },
    ar: { title: "المهام وتجديد العقود", body: "جدول تذكيراتك. وننبّهك قبل انتهاء عقد عميل لتجدّده أنت أولاً." },
  },
  {
    icon: FileSpreadsheet,
    en: { title: "Excel reports", body: "Export clients, deals and viewings to Excel in one click, for your team or your manager." },
    ar: { title: "تقارير إكسل", body: "صدّر العملاء والصفقات والمعاينات إلى إكسل بضغطة، لفريقك أو مديرك." },
  },
  {
    icon: Lock,
    en: { title: "Your clients stay private", body: "Clients you add yourself are visible only to you (and your agency admin). Never emailed or shared by the platform." },
    ar: { title: "عملاؤك خصوصية تامة", body: "العملاء الذين تضيفهم بنفسك لا يراهم إلا أنت (ومدير مكتبك). لا نراسلهم ولا نشاركهم أبداً." },
  },
];

interface Props {
  isRtl: boolean;
  onStart?: () => void;
  onSeePlans?: () => void;
}

export default function SalesDeskShowcase({ isRtl, onStart, onSeePlans }: Props) {
  const tr = isRtl
    ? {
        badge: "للوسطاء والمكاتب والمطورين",
        title: "مكتبك العقاري كله في مكان واحد",
        sub: "ليست قائمة عقارات فقط. مع كل اشتراك تحصل على مكتب مبيعات كامل: عملاء، متابعات، معاينات، صفقات وعمولات.",
        cta: "ابدأ تجربة 60 يوماً مجاناً",
        plans: "شاهد الباقات",
        note: "مضمّنة في كل الباقات، بما فيها التجربة المجانية.",
      }
    : {
        badge: "For brokers, agencies and developers",
        title: "Your whole real-estate office in one place",
        sub: "More than a listing page. Every subscription includes a full sales desk: clients, follow-ups, viewings, deals and commission.",
        cta: "Start your 60-day free trial",
        plans: "See plans",
        note: "Included in every plan, including the free trial.",
      };

  return (
    <section
      aria-labelledby="sales-desk-showcase-title"
      className="rounded-2xl bg-chrome text-white overflow-hidden border border-gold/20"
      data-testid="sales-desk-showcase"
    >
      <div className="p-6 sm:p-10 space-y-8">
        <div className="max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gold">
            <Sparkles size={13} /> {tr.badge}
          </span>
          <h2 id="sales-desk-showcase-title" className="font-serif text-2xl sm:text-3xl font-bold leading-snug">{tr.title}</h2>
          <p className="text-sm text-gray-300 leading-relaxed">{tr.sub}</p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DESK_FEATURES.map((f) => {
            const Icon = f.icon;
            const c = isRtl ? f.ar : f.en;
            return (
              <li key={f.en.title} className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
                <Icon size={20} className="text-gold" />
                <h3 className="text-sm font-bold">{c.title}</h3>
                <p className="text-xs text-gray-300 leading-relaxed">{c.body}</p>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          {onStart && (
            <button
              type="button"
              onClick={onStart}
              className="px-5 py-3 bg-gold hover:bg-gold-hover text-black text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <span>{tr.cta}</span>
              <ArrowRight size={14} className={isRtl ? "rotate-180" : ""} />
            </button>
          )}
          {onSeePlans && (
            <button
              type="button"
              onClick={onSeePlans}
              className="px-5 py-3 border border-white/30 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer"
            >
              {tr.plans}
            </button>
          )}
          <span className="text-[11px] text-gray-400">{tr.note}</span>
        </div>
      </div>
    </section>
  );
}
