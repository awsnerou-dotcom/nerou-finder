import type { TourStep } from "./OnboardingTour.js";
import { requestDeskTab } from "../lib/tour.js";
import type { DeskTabId } from "../lib/tour.js";

// The Sales Desk part of the guided tour, shared by the agent, agency and developer workspaces.
// `tabSelector` is the data-tour of that workspace's own "Sales Desk" tab button; `openDesk` makes
// the workspace show the desk. Admins (agency/developer) see the team wording.
export function salesDeskTourSteps(opts: { isRtl: boolean; isAdmin: boolean; tabSelector: string; openDesk: () => void }): TourStep[] {
  const { isRtl, isAdmin, tabSelector, openDesk } = opts;
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const inDesk = (tab: DeskTabId) => () => { openDesk(); requestDeskTab(tab); };

  return [
    {
      selector: tabSelector,
      title: t("Sales Desk", "مكتب المبيعات"),
      body: isAdmin
        ? t("Your whole team's clients, viewings and deals in one place. Let's take a quick look.", "عملاء فريقك ومعايناته وصفقاته في مكان واحد. لنلقِ نظرة سريعة.")
        : t("Your clients, viewings and deals in one place. Let's take a quick look.", "عملاؤك ومعايناتك وصفقاتك في مكان واحد. لنلقِ نظرة سريعة."),
    },
    {
      selector: "desk-clients",
      title: t("Add any client", "أضف أي عميل"),
      body: t(
        "Type in a client from anywhere, or import your whole Excel/CSV list. Clients you add yourself stay private" + (isAdmin ? " to the agent who added them and you." : " to you."),
        "اكتب أي عميل من أي مصدر، أو استورد قائمتك كاملة من إكسل. العملاء الذين تضيفهم بنفسك يبقون خاصين" + (isAdmin ? " بالوكيل الذي أضافهم وبك." : " بك وحدك.")
      ),
      onEnter: inDesk("pipeline"),
    },
    {
      selector: "desk-tab-pipeline",
      title: t("Pipeline board", "لوحة المسار"),
      body: isAdmin
        ? t("Every client, from every agent, from New to Won. Move them along with one click.", "كل عملاء كل الوكلاء، من جديد حتى تم البيع. انقلهم بضغطة.")
        : t("Every client from New to Won. Move them along with one click.", "كل عملائك من جديد حتى تم البيع. انقلهم بضغطة."),
      onEnter: inDesk("pipeline"),
    },
    {
      selector: "desk-reminders",
      title: t("Email reminders", "تذكيرات بالإيميل"),
      body: t(
        "One daily email lists who to follow up with. Turn it off here if you prefer.",
        "إيميل يومي واحد يسرد من تتابعه اليوم. أوقفه من هنا إن شئت."
      ),
      onEnter: inDesk("followups"),
    },
    {
      selector: "desk-tab-viewings",
      title: t("Viewing schedule", "جدول المعاينات"),
      body: t("Book viewings here. You and the client both get a reminder.", "احجز المعاينات هنا. يصلك أنت والعميل تذكير."),
      onEnter: inDesk("viewings"),
    },
    {
      selector: "desk-tab-tasks",
      title: t("Tasks and lease renewals", "المهام وتجديد العقود"),
      body: t(
        "Set your own reminders, and get warned before a client's lease ends so you can renew it first.",
        "جدول تذكيراتك الخاصة، وننبّهك قبل انتهاء عقد عميل لتجدّده أنت أولاً."
      ),
      onEnter: inDesk("tasks"),
    },
    {
      selector: "desk-tab-deals",
      title: t("Deals and commission", "الصفقات والعمولات"),
      body: t("Record each closed deal and your commission, and see your month at a glance.", "سجّل كل صفقة وعمولتك، واعرف حصيلة شهرك بنظرة."),
      onEnter: inDesk("deals"),
    },
    {
      selector: "desk-tab-reports",
      title: t("Excel reports", "تقارير إكسل"),
      body: isAdmin
        ? t("Export clients, deals and viewings for your whole team to Excel in one click.", "صدّر عملاء فريقك وصفقاته ومعايناته إلى إكسل بضغطة.")
        : t("Export your clients, deals and viewings to Excel in one click.", "صدّر عملاءك وصفقاتك ومعايناتك إلى إكسل بضغطة."),
      onEnter: inDesk("reports"),
    },
  ];
}
