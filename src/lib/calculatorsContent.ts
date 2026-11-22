// What each free calculator page says, in both languages. One source for the page people see and the
// page search engines read, so the two can never disagree.
//
// Rule for the wording: no figure that an authority or a bank can change (a lending cap, a fee, a rate,
// a typical yield). The calculators only do arithmetic on what the person types; anything about the
// rules says to confirm it with the bank or the authority.

import type { Lang } from "./seo.js";

export type CalcKey = "mortgage" | "yield" | "afford";

type L = { en: string; ar: string };

export interface CalcTool {
  key: CalcKey;
  path: string;
  tab: "CALC_MORTGAGE" | "CALC_YIELD" | "CALC_AFFORD";
  title: L;
  description: L;
  h1: L;
  intro: L;
  /** short name for menus and the tool switcher */
  label: L;
  steps: L[];
  faq: { q: L; a: L }[];
}

export const CALC_TOOLS: CalcTool[] = [
  {
    key: "mortgage",
    path: "/mortgage-calculator",
    tab: "CALC_MORTGAGE",
    label: { en: "Mortgage payment", ar: "القسط الشهري" },
    title: {
      en: "Mortgage Calculator for Qatar: Monthly Payment and Total Interest | Nerou Finder",
      ar: "حاسبة القرض العقاري في قطر: القسط الشهري وإجمالي الفوائد | نيرو فايندر"
    },
    description: {
      en: "Free mortgage calculator for property in Qatar. Enter the price, the down payment, the rate and the years to see the monthly payment, the total you will repay and the interest.",
      ar: "حاسبة مجانية للقرض العقاري في قطر. أدخل سعر العقار والدفعة الأولى والفائدة وعدد السنوات لتعرف القسط الشهري وإجمالي ما ستسدده وقيمة الفوائد."
    },
    h1: { en: "Mortgage calculator for Qatar", ar: "حاسبة القرض العقاري في قطر" },
    intro: {
      en: "Work out what a home loan would cost each month. Enter the property price, how much you pay up front, the rate your bank offers and the number of years. It shows the monthly payment, the total you repay and how much of that is interest.",
      ar: "اعرف كم سيكلّفك القرض العقاري كل شهر. أدخل سعر العقار والدفعة الأولى والفائدة التي يعرضها البنك وعدد السنوات، لتظهر لك قيمة القسط الشهري وإجمالي ما ستسدده وكم منه فوائد."
    },
    steps: [
      { en: "Enter the property price and the percentage you will pay up front.", ar: "أدخل سعر العقار ونسبة الدفعة الأولى التي ستدفعها." },
      { en: "Enter the yearly rate your bank quotes and the number of years.", ar: "أدخل الفائدة السنوية التي يعرضها البنك وعدد سنوات السداد." },
      { en: "Read the monthly payment, the total repaid and the interest. Change any number to compare offers.", ar: "اقرأ القسط الشهري وإجمالي المسدَّد والفوائد. غيّر أي رقم لتقارن بين العروض." }
    ],
    faq: [
      {
        q: { en: "How is the monthly mortgage payment calculated?", ar: "كيف يُحسب القسط الشهري للقرض العقاري؟" },
        a: { en: "The calculator uses the standard equal-instalment formula: the loan is repaid in the same amount every month, and each payment covers the interest on what is still owed plus part of the loan. Early payments are mostly interest; later ones are mostly the loan itself.", ar: "تستخدم الحاسبة المعادلة المعتادة للأقساط المتساوية: يُسدَّد القرض بمبلغ ثابت كل شهر، ويغطي كل قسط فائدة المتبقي من القرض وجزءاً من أصله. تكون الأقساط الأولى فوائد في معظمها، وتكون الأخيرة من أصل القرض في معظمها." }
      },
      {
        q: { en: "Is this the exact figure my bank will give me?", ar: "هل هذا هو الرقم الذي سيعطيني إياه البنك بالضبط؟" },
        a: { en: "No. It is an estimate from the numbers you enter. Banks can add fees and insurance, use a variable rate, or calculate the interest a little differently. Ask your bank for its current rate, the share of the price it will finance and its fees, then type them in here to compare.", ar: "لا، هو تقدير مبني على الأرقام التي تدخلها. قد يضيف البنك رسوماً وتأميناً أو يعتمد فائدة متغيرة أو يحسب الفائدة بطريقة مختلفة قليلاً. اسأل بنكك عن الفائدة الحالية ونسبة التمويل والرسوم، ثم أدخلها هنا للمقارنة." }
      },
      {
        q: { en: "How does a bigger down payment change the cost?", ar: "كيف تؤثر الدفعة الأولى الأكبر على التكلفة؟" },
        a: { en: "A bigger down payment means a smaller loan, so a lower monthly payment and less interest overall. Try a few percentages and compare the total interest.", ar: "كلما كبرت الدفعة الأولى صغر القرض، فينخفض القسط الشهري وتقل الفوائد الإجمالية. جرّب نسباً مختلفة وقارن إجمالي الفوائد." }
      },
      {
        q: { en: "Should I choose a longer or a shorter repayment period?", ar: "هل أختار مدة سداد أطول أم أقصر؟" },
        a: { en: "A longer period lowers each payment but you pay more interest in total. A shorter one raises the payment and saves interest. Compare both with the calculator and choose the payment you can keep up comfortably.", ar: "المدة الأطول تخفّض القسط لكنها ترفع إجمالي الفوائد، والمدة الأقصر ترفع القسط وتوفّر الفوائد. قارن بين الحالتين بالحاسبة واختر القسط الذي تستطيع الالتزام به براحة." }
      }
    ]
  },
  {
    key: "yield",
    path: "/rental-yield-calculator",
    tab: "CALC_YIELD",
    label: { en: "Rental yield", ar: "العائد الإيجاري" },
    title: {
      en: "Rental Yield Calculator for Qatar: Gross and Net Yield | Nerou Finder",
      ar: "حاسبة العائد الإيجاري في قطر: العائد الإجمالي والصافي | نيرو فايندر"
    },
    description: {
      en: "Free rental yield calculator for investors in Qatar. Enter the price and the monthly rent, with your yearly costs and empty months, to see the gross yield, the net yield and the payback time.",
      ar: "حاسبة مجانية للعائد الإيجاري للمستثمرين في قطر. أدخل سعر العقار والإيجار الشهري وتكاليفك السنوية وأشهر الشغور لتعرف العائد الإجمالي والعائد الصافي ومدة استرداد رأس المال."
    },
    h1: { en: "Rental yield calculator for Qatar", ar: "حاسبة العائد الإيجاري في قطر" },
    intro: {
      en: "See what a property earns compared with what it costs. Enter the purchase price and the monthly rent. Add your yearly costs and the months it may stand empty for the net yield, which is what you actually keep.",
      ar: "اعرف كم يدرّ العقار مقارنة بما يكلّفه. أدخل سعر الشراء والإيجار الشهري، وأضف تكاليفك السنوية والأشهر التي قد يبقى فيها خالياً لتحصل على العائد الصافي، وهو ما تحتفظ به فعلاً."
    },
    steps: [
      { en: "Enter the price you pay for the property and the monthly rent it earns.", ar: "أدخل سعر شراء العقار والإيجار الشهري الذي يحققه." },
      { en: "Add your yearly costs (service charges, maintenance, management) and the months it may stand empty.", ar: "أضف تكاليفك السنوية (رسوم الخدمة والصيانة والإدارة) وعدد الأشهر التي قد يبقى فيها خالياً." },
      { en: "Read the gross yield, the net yield and the years it takes to earn the price back.", ar: "اقرأ العائد الإجمالي والعائد الصافي وعدد السنوات اللازمة لاسترداد الثمن." }
    ],
    faq: [
      {
        q: { en: "What is the difference between gross and net rental yield?", ar: "ما الفرق بين العائد الإيجاري الإجمالي والصافي؟" },
        a: { en: "Gross yield is a full year's rent divided by the price. Net yield first takes away your yearly costs and the rent you lose while the property is empty. Adverts usually quote the gross figure; the net figure is closer to what you really earn.", ar: "العائد الإجمالي هو إيجار سنة كاملة مقسوماً على السعر. أما الصافي فيخصم أولاً تكاليفك السنوية والإيجار الذي تخسره في أشهر الشغور. الإعلانات تذكر عادةً الإجمالي، والصافي أقرب إلى ما تربحه فعلاً." }
      },
      {
        q: { en: "How is rental yield calculated?", ar: "كيف يُحسب العائد الإيجاري؟" },
        a: { en: "Gross yield = (monthly rent × 12) ÷ price × 100. Net yield = (rent received over the year − yearly costs) ÷ price × 100. Payback time = price ÷ net income per year.", ar: "العائد الإجمالي = (الإيجار الشهري × 12) ÷ السعر × 100. العائد الصافي = (الإيجار المقبوض خلال السنة − التكاليف السنوية) ÷ السعر × 100. مدة الاسترداد = السعر ÷ صافي الدخل السنوي." }
      },
      {
        q: { en: "What is a good rental yield?", ar: "ما هو العائد الإيجاري الجيد؟" },
        a: { en: "There is no single answer: it depends on the area, the type of property and what else you could do with the money. Compare the yield of several properties in the same area, and check the asking rent against the live listings in our price reports.", ar: "لا توجد إجابة واحدة، فهو يتوقف على المنطقة ونوع العقار وما يمكنك فعله بالمال بديلاً. قارن عائد عدة عقارات في المنطقة نفسها، وتحقق من الإيجار المطلوب بمقارنته بالعقارات المعروضة فعلاً في تقارير الأسعار لدينا." }
      },
      {
        q: { en: "Does the yield include the price rising or falling?", ar: "هل يشمل العائد ارتفاع السعر أو انخفاضه؟" },
        a: { en: "No. It only measures rental income against the price. A property can also gain or lose value, which this calculator does not predict.", ar: "لا، فهو يقيس دخل الإيجار مقابل السعر فقط. وقد يرتفع سعر العقار أو ينخفض، وهذا ما لا تتنبأ به الحاسبة." }
      }
    ]
  },
  {
    key: "afford",
    path: "/home-affordability-calculator",
    tab: "CALC_AFFORD",
    label: { en: "How much can I afford", ar: "كم أستطيع تحمّله" },
    title: {
      en: "How Much Property Can I Afford in Qatar? Affordability Calculator | Nerou Finder",
      ar: "كم عقاراً أستطيع تحمّل ثمنه في قطر؟ حاسبة القدرة الشرائية | نيرو فايندر"
    },
    description: {
      en: "Free home affordability calculator for Qatar. Enter your monthly income, the share you can put into repayments, your down payment, the rate and the years to see the property price you can afford.",
      ar: "حاسبة مجانية للقدرة الشرائية في قطر. أدخل دخلك الشهري والنسبة التي تستطيع تخصيصها للأقساط والدفعة الأولى والفائدة والسنوات لتعرف سعر العقار الذي تستطيع تحمّله."
    },
    h1: { en: "How much property can you afford in Qatar?", ar: "كم عقاراً تستطيع تحمّل ثمنه في قطر؟" },
    intro: {
      en: "Start from your income instead of the price. Enter what you earn each month, the share you are comfortable putting into loan repayments, your savings for the down payment, the bank's rate and the years. It shows the loan and the property price that fit.",
      ar: "ابدأ من دخلك لا من السعر. أدخل دخلك الشهري والنسبة التي ترتاح لتخصيصها لأقساط القرض ومدخراتك للدفعة الأولى وفائدة البنك وعدد السنوات، لتظهر لك قيمة القرض وسعر العقار المناسبان."
    },
    steps: [
      { en: "Enter your monthly income, the share of it you can put into repayments, and any debts you already pay each month.", ar: "أدخل دخلك الشهري والنسبة التي تستطيع تخصيصها للأقساط وأي التزامات تدفعها شهرياً." },
      { en: "Enter the cash you can pay up front, the yearly rate and the number of years.", ar: "أدخل المبلغ الذي تستطيع دفعه مقدماً والفائدة السنوية وعدد السنوات." },
      { en: "Read the largest loan that fits your budget and the property price it allows.", ar: "اقرأ أكبر قرض يناسب ميزانيتك وسعر العقار الذي يسمح به." }
    ],
    faq: [
      {
        q: { en: "How is the price I can afford worked out?", ar: "كيف يُحسب سعر العقار الذي أستطيع تحمّله؟" },
        a: { en: "Your monthly repayment budget is your income times the share you choose, minus your other monthly debts. The calculator finds the largest loan whose monthly payment fits that budget over the years you set, then adds your down payment to give the property price.", ar: "ميزانية القسط الشهرية = دخلك × النسبة التي تختارها − التزاماتك الشهرية الأخرى. ثم تجد الحاسبة أكبر قرض يناسب قسطه هذه الميزانية خلال السنوات التي تحددها، وتضيف إليه دفعتك الأولى لتعطيك سعر العقار." }
      },
      {
        q: { en: "What share of my income should go to repayments?", ar: "ما النسبة التي أخصصها من دخلي للأقساط؟" },
        a: { en: "That is your choice and your bank's. Banks apply their own limits on repayments compared with income, and these can change, so ask your bank for its current rule. Use a share you can keep up even if your costs rise.", ar: "هذا قرارك وقرار البنك. تضع البنوك حدوداً خاصة بها لنسبة الأقساط من الدخل وقد تتغير، فاسأل بنكك عن القاعدة الحالية. اختر نسبة تستطيع الالتزام بها حتى لو ارتفعت نفقاتك." }
      },
      {
        q: { en: "Does this include fees, insurance and registration costs?", ar: "هل تشمل الحاسبة الرسوم والتأمين وتكاليف التسجيل؟" },
        a: { en: "No. It works out the loan and the price only. Buying also involves fees and other costs that can change, so confirm them with the bank and the authority and keep some cash aside for them.", ar: "لا، فهي تحسب القرض والسعر فقط. للشراء رسوم وتكاليف أخرى قد تتغير، فتأكد منها مع البنك والجهة المختصة واحتفظ بمبلغ نقدي لها." }
      },
      {
        q: { en: "What next, once I know my budget?", ar: "ماذا أفعل بعد أن أعرف ميزانيتي؟" },
        a: { en: "Search listings up to that price on Nerou Finder, check a price you are offered with the free price check, and compare the monthly payment with the mortgage calculator.", ar: "ابحث عن العقارات حتى هذا السعر في نيرو فايندر، وتحقق من أي سعر يُعرض عليك بفحص السعر المجاني، وقارن القسط الشهري بحاسبة القرض العقاري." }
      }
    ]
  }
];

export const calcByKey = (key: CalcKey): CalcTool => CALC_TOOLS.find(t => t.key === key)!;
export const calcByPath = (path: string): CalcTool | undefined => CALC_TOOLS.find(t => t.path === path);
export const pick = (l: L, lang: Lang) => (lang === "ar" ? l.ar : l.en);
