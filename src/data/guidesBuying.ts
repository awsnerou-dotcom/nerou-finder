// Guides for people who buy, own or invest, and for the agents who serve them. Laws, thresholds and procedures are described in
// general terms with a pointer to confirm the current rule: they change, and a guide that states an old figure as fact misleads.

import { L, type Guide } from "./guideTypes.js";

export const BUYING_GUIDES: Guide[] = [
  {
    slug: "buying-property-in-qatar-as-a-foreigner",
    category: "buying",
    title: L("Buying Property in Qatar as a Foreigner: What You Need to Know", "شراء العقار في قطر للأجانب: ما تحتاج إلى معرفته"),
    description: L(
      "How non-Qataris can own or hold property in Qatar: freehold and usufruct zones, what to check and the questions to ask before you pay.",
      "كيف يمكن لغير القطريين تملك العقار أو حيازته في قطر: مناطق التملك الحر وحق الانتفاع وما تتحقق منه وما تسأل عنه قبل الدفع."
    ),
    summary: L(
      "Non-Qataris can own property in Qatar, but only in designated zones, either as freehold (full ownership) or as usufruct (a long-term right of use). Confirm that the exact property is in a designated zone, check the title and the seller's right to sell, and take current advice on the rules, which are set by law and can change.",
      "يمكن لغير القطريين تملك العقار في قطر لكن في مناطق محددة فقط، إما تملكاً حراً (ملكية كاملة) أو حق انتفاع (حق استخدام طويل الأجل). تأكد أن العقار نفسه داخل منطقة محددة، وافحص سند الملكية وحق البائع في البيع، واحصل على مشورة حديثة بشأن القواعد التي يحددها القانون وقد تتغير."
    ),
    sections: [
      {
        h: L("Freehold and usufruct", "التملك الحر وحق الانتفاع"),
        list: [
          L("Freehold: full ownership of the property, which you can usually sell, rent or leave to your heirs under the rules that apply.", "التملك الحر: ملكية كاملة للعقار يمكنك عادة بيعه أو تأجيره أو توريثه وفق القواعد المطبقة."),
          L("Usufruct: the right to use and live in the property for a long fixed period, without owning the land.", "حق الانتفاع: حق استخدام العقار والسكن فيه لمدة طويلة محددة دون ملكية الأرض."),
          L("Both are available to non-Qataris only in designated zones, which the state defines and can change.", "كلاهما متاح لغير القطريين في مناطق محددة فقط تحددها الدولة وقد تغيّرها.")
        ]
      },
      {
        h: L("Check before you pay", "تحقق قبل أن تدفع"),
        list: [
          L("The exact address is inside a designated zone, confirmed with the seller or developer in writing and with the authority.", "العنوان بالتحديد داخل منطقة محددة، مؤكداً كتابةً من البائع أو المطوّر ومن الجهة المختصة."),
          L("The title: the seller is the registered owner, or has a valid authorisation to sell.", "سند الملكية: البائع هو المالك المسجل، أو لديه تفويض صالح بالبيع."),
          L("Any mortgage, debt or dispute attached to the property.", "أي رهن أو دين أو نزاع متعلق بالعقار."),
          L("The service charges, and who pays them, and what they cover.", "رسوم الخدمة ومن يدفعها وما تغطيه."),
          L("The total cost: price, registration and transfer fees, agent fee and any bank costs.", "التكلفة الكلية: السعر ورسوم التسجيل والنقل وعمولة الوسيط وأي تكاليف بنكية.")
        ]
      },
      {
        h: L("Residence and ownership", "الإقامة والتملك"),
        p: [L(
          "Owning property above a value set by the state can give the owner and the family a right to residence. The threshold and conditions are set by the authorities and have changed over time, so confirm the current ones with the Ministry of Interior before you base a purchase on them.",
          "تملك عقار تتجاوز قيمته حداً تحدده الدولة قد يمنح المالك وأسرته حق الإقامة. والحد والشروط تحددها الجهات المختصة وقد تغيّرت مع الوقت، فتأكد من الحالية لدى وزارة الداخلية قبل أن تبني الشراء عليها."
        )]
      },
      {
        h: L("Take advice", "استشر مختصاً"),
        p: [L(
          "This guide is general information and not legal advice. A lawyer who works on Qatari property can confirm the zone, the title and the contract. Use a licensed agent, and read how to choose one.",
          "هذا الدليل معلومات عامة وليس استشارة قانونية. ومحامٍ يعمل في العقارات القطرية يستطيع تأكيد المنطقة والسند والعقد. استعن بوسيط مرخّص، واقرأ كيف تختاره."
        )]
      }
    ],
    faq: [
      {
        q: L("Can a foreigner own land in Qatar?", "هل يستطيع الأجنبي تملك أرض في قطر؟"),
        a: L("Only where the law allows it, in designated zones and on the conditions it sets. Confirm the exact plot with the authority before you pay.", "فقط حيث يسمح القانون، في مناطق محددة وبالشروط التي يضعها. تأكد من القطعة بالتحديد لدى الجهة المختصة قبل الدفع.")
      },
      {
        q: L("Is usufruct the same as ownership?", "هل حق الانتفاع هو الملكية نفسها؟"),
        a: L("No. It is a right to use the property for a long fixed period. It does not give you ownership of the land, so read its term and conditions carefully.", "لا. هو حق استخدام العقار لمدة طويلة محددة، ولا يمنحك ملكية الأرض، فاقرأ مدته وشروطه بعناية.")
      },
      {
        q: L("Do I need to be in Qatar to buy?", "هل يجب أن أكون في قطر لأشتري؟"),
        a: L("Procedures can sometimes be handled through an authorised representative, but this depends on the case. Ask the agent and your lawyer what is possible for you.", "يمكن أحياناً إنجاز الإجراءات عبر ممثل مفوّض، لكن ذلك يعتمد على الحالة. اسأل الوسيط ومحاميك عمّا يمكن في حالتك.")
      }
    ],
    links: ["/", "/property-valuation", "/area-guides"],
    related: ["buying-process-in-qatar-step-by-step", "off-plan-property-in-qatar", "property-mortgage-in-qatar-basics"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "buying-process-in-qatar-step-by-step",
    category: "buying",
    title: L("The Property Buying Process in Qatar, Step by Step", "إجراءات شراء العقار في قطر خطوة بخطوة"),
    description: L(
      "The steps of buying a property in Qatar: budget, search, offer, checks, contract, payment and registration, with what to verify at each.",
      "خطوات شراء عقار في قطر: الميزانية والبحث والعرض والفحص والعقد والدفع والتسجيل، وما يجب التحقق منه في كل خطوة."
    ),
    summary: L(
      "Buying follows seven steps: set a budget including costs, search and compare, make an offer, check the title and the property, sign a written sale contract, pay through traceable channels and register the transfer with the competent authority. Do the checks before the money moves, not after.",
      "الشراء يتبع سبع خطوات: حدد الميزانية مع التكاليف، ابحث وقارن، قدّم عرضاً، افحص السند والعقار، وقّع عقد بيع مكتوباً، ادفع بقنوات يمكن تتبعها، وسجّل النقل لدى الجهة المختصة. أجرِ الفحوص قبل أن ينتقل المال لا بعده."
    ),
    sections: [
      {
        h: L("The seven steps", "الخطوات السبع"),
        list: [
          L("1. Budget: the price plus registration and transfer costs, agent fee, any bank costs and a reserve for repairs.", "1. الميزانية: السعر مع رسوم التسجيل والنقل وعمولة الوسيط وأي تكاليف بنكية واحتياطي للإصلاحات."),
          L("2. Search and compare: view several properties and compare the price per square metre with similar listings.", "2. البحث والمقارنة: عاين عدة عقارات وقارن سعر المتر المربع مع إعلانات مشابهة."),
          L("3. Offer: agree the price and conditions in writing, including the deadline and what happens to any deposit.", "3. العرض: اتفق على السعر والشروط كتابةً بما في ذلك المهلة وما يحدث لأي دفعة مقدمة."),
          L("4. Checks: the title, the seller's right to sell, any debt or mortgage, the service charges and the condition of the property.", "4. الفحوص: السند وحق البائع في البيع وأي دين أو رهن ورسوم الخدمة وحالة العقار."),
          L("5. Contract: a written sale contract that names the parties, the property, the price, the payment schedule and the handover date.", "5. العقد: عقد بيع مكتوب يذكر الأطراف والعقار والسعر وجدول الدفع وتاريخ التسليم."),
          L("6. Payment: pay through the bank, to the registered owner or the named account, and keep the proof.", "6. الدفع: ادفع عبر البنك إلى المالك المسجل أو الحساب المذكور واحتفظ بالإثبات."),
          L("7. Registration: the transfer is registered with the competent authority, which currently is the Ministry of Justice, and the new title is issued.", "7. التسجيل: يُسجَّل النقل لدى الجهة المختصة وهي حالياً وزارة العدل، ويصدر السند الجديد.")
        ]
      },
      {
        h: L("Where buyers lose money", "أين يخسر المشترون أموالهم"),
        list: [
          L("Paying a deposit before checking the title.", "دفع مقدّم قبل فحص السند."),
          L("Paying cash, or to an account that does not match the seller's name.", "الدفع نقداً أو إلى حساب لا يطابق اسم البائع."),
          L("An unwritten promise about repairs, furniture or fees.", "وعد غير مكتوب بشأن الإصلاحات أو الأثاث أو الرسوم."),
          L("Ignoring the service charges, which continue for as long as you own the property.", "تجاهل رسوم الخدمة التي تستمر طالما تملك العقار.")
        ]
      },
      {
        h: L("Get help where it counts", "استعن بمختص حيث يلزم"),
        p: [L(
          "Use a licensed agent, and a lawyer for the contract and the title if the amount is significant. Procedures and fees are set by the authorities and can change: confirm the current ones before you start.",
          "استعن بوسيط مرخّص ومحامٍ للعقد والسند إن كان المبلغ كبيراً. والإجراءات والرسوم تحددها الجهات المختصة وقد تتغير: تأكد من الحالية قبل أن تبدأ."
        )]
      }
    ],
    faq: [
      {
        q: L("How long does buying a property take?", "كم يستغرق شراء عقار؟"),
        a: L("It depends on the property and on how quickly the checks and payments are done. Ask the agent and the authority for the current timing instead of assuming.", "يعتمد على العقار وسرعة إنجاز الفحوص والدفعات. اسأل الوسيط والجهة المختصة عن المدة الحالية بدل الافتراض.")
      },
      {
        q: L("Should I pay a deposit to hold the property?", "هل أدفع مقدّماً لحجز العقار؟"),
        a: L("Only against a written agreement that states what happens to the deposit if the deal does not go ahead, and after you have checked that the seller can sell.", "فقط مقابل اتفاق مكتوب يبيّن ما يحدث للمقدّم إن لم تتم الصفقة، وبعد أن تتحقق أن البائع يستطيع البيع.")
      },
      {
        q: L("How do I know if the price is fair?", "كيف أعرف أن السعر عادل؟"),
        a: L("Compare it with similar live listings in the same area. The price check and valuation tools on Nerou Finder do this for you.", "قارنه بإعلانات حية مشابهة في المنطقة نفسها. أداتا فحص السعر والتقييم في نيرو فايندر تفعلان ذلك عنك.")
      }
    ],
    links: ["/price-check", "/property-valuation", "/"],
    related: ["buying-property-in-qatar-as-a-foreigner", "property-mortgage-in-qatar-basics", "how-to-choose-a-real-estate-agent-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "off-plan-property-in-qatar",
    category: "buying",
    title: L("Buying Off-Plan Property in Qatar: Benefits, Risks and Questions to Ask", "شراء العقار على المخطط في قطر: المزايا والمخاطر وأسئلة يجب طرحها"),
    description: L(
      "What off-plan means in Qatar, why buyers choose it, the risks of delay and change, and the questions to ask the developer before you pay.",
      "ماذا يعني الشراء على المخطط في قطر، ولماذا يختاره المشترون، ومخاطر التأخير والتغيير، وأسئلة تطرحها على المطوّر قبل الدفع."
    ),
    summary: L(
      "Off-plan means buying a property before it is built, usually with a payment plan and a lower entry price. The risks are delay, changes to the design and a developer that cannot finish, so check the developer's record, the contract's handover date and remedies, and how your payments are protected before you pay.",
      "الشراء على المخطط هو شراء عقار قبل بنائه، عادة بخطة دفع وسعر دخول أقل. والمخاطر هي التأخير وتغيير التصميم وعجز المطوّر عن الإكمال، فافحص سجل المطوّر وتاريخ التسليم وسبل الانتصاف في العقد وكيف تُحمى دفعاتك قبل أن تدفع."
    ),
    sections: [
      {
        h: L("Why people buy off-plan", "لماذا يشتري الناس على المخطط"),
        list: [
          L("A payment plan spreads the cost over the build.", "خطة الدفع توزع التكلفة على مدة البناء."),
          L("The entry price can be lower than a finished unit nearby.", "قد يكون سعر الدخول أقل من وحدة جاهزة قريبة."),
          L("A wider choice of floors, views and layouts early on.", "خيارات أوسع للطوابق والإطلالات والتصاميم في وقت مبكر."),
          L("A new building with modern specifications.", "مبنى جديد بمواصفات حديثة.")
        ]
      },
      {
        h: L("The risks", "المخاطر"),
        list: [
          L("Delay: the handover date can move.", "التأخير: قد يتأخر تاريخ التسليم."),
          L("Change: the final unit may differ from the brochure.", "التغيير: قد تختلف الوحدة النهائية عن الكتيّب."),
          L("The developer: if it cannot finish, your payments are at risk.", "المطوّر: إن عجز عن الإكمال فدفعاتك في خطر."),
          L("Market: the finished unit may be worth less than you paid.", "السوق: قد تكون الوحدة المنجزة أقل قيمة مما دفعت.")
        ]
      },
      {
        h: L("Questions to ask before you pay", "أسئلة قبل أن تدفع"),
        list: [
          L("What has this developer finished before, and can I visit those projects?", "ماذا أنجز هذا المطوّر من قبل، وهل أستطيع زيارة تلك المشاريع؟"),
          L("Is the project registered and the land owned by the developer?", "هل المشروع مسجل والأرض مملوكة للمطوّر؟"),
          L("Do my payments go into a protected account, and who releases them?", "هل تذهب دفعاتي إلى حساب محمي ومن يفرج عنها؟"),
          L("What does the contract say about delay and about the right to cancel and be refunded?", "ماذا يقول العقد عن التأخير وعن حق الإلغاء والاسترداد؟"),
          L("Is the zone open to non-Qatari owners, and as freehold or usufruct?", "هل المنطقة مفتوحة لغير القطريين وكتملك حر أم حق انتفاع؟"),
          L("What are the service charges once it is finished?", "ما رسوم الخدمة بعد الإنجاز؟")
        ]
      }
    ],
    faq: [
      {
        q: L("Is off-plan cheaper than a finished property?", "هل الشراء على المخطط أرخص من العقار الجاهز؟"),
        a: L("It often has a lower entry price, but compare it with finished units nearby and count the risk and the time you will wait.", "غالباً يكون سعر الدخول أقل، لكن قارنه بوحدات جاهزة قريبة واحسب المخاطرة ومدة الانتظار.")
      },
      {
        q: L("What if the project is delayed?", "ماذا لو تأخر المشروع؟"),
        a: L("What you can do is in the contract and in the rules that apply. Read the delay and refund clauses before you sign, and ask a lawyer if they are unclear.", "ما يمكنك فعله مذكور في العقد وفي القواعد المطبقة. اقرأ بنود التأخير والاسترداد قبل التوقيع واسأل محامياً إن لم تتضح.")
      },
      {
        q: L("Where can I find off-plan listings?", "أين أجد إعلانات على المخطط؟"),
        a: L("On Nerou Finder, choose Off-Plan in the search, or browse the new projects from verified developers.", "في نيرو فايندر اختر «على المخطط» في البحث، أو تصفح المشاريع الجديدة من مطورين موثّقين.")
      }
    ],
    links: ["/", "/area-guides"],
    related: ["buying-property-in-qatar-as-a-foreigner", "buying-process-in-qatar-step-by-step", "rental-yield-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "property-mortgage-in-qatar-basics",
    category: "buying",
    title: L("Property Finance in Qatar: Mortgage Basics for Buyers", "التمويل العقاري في قطر: أساسيات للمشترين"),
    description: L(
      "How a property mortgage works in Qatar: conventional and Islamic finance, what banks look at, the costs and how to compare offers.",
      "كيف يعمل التمويل العقاري في قطر: التمويل التقليدي والإسلامي، وما ينظر فيه البنك، والتكاليف، وكيف تقارن العروض."
    ),
    summary: L(
      "Banks and finance companies in Qatar offer conventional mortgages and Islamic home finance. They look at your income, your existing commitments and the property, and usually ask for a down payment. Compare offers on the total cost over the full term, not only the monthly instalment, and confirm what is available to you as a resident or non-resident.",
      "تقدم البنوك وشركات التمويل في قطر التمويل العقاري التقليدي والإسلامي. وتنظر في دخلك والتزاماتك القائمة والعقار، وتطلب عادة دفعة مقدمة. قارن العروض بالتكلفة الكلية على كامل المدة لا بالقسط الشهري فقط، وتأكد مما هو متاح لك كمقيم أو غير مقيم."
    ),
    sections: [
      {
        h: L("Conventional and Islamic finance", "التمويل التقليدي والإسلامي"),
        p: [L(
          "A conventional mortgage is a loan with interest. Islamic home finance reaches the same goal through structures such as a sale with deferred payment or a lease that ends in ownership. Both have a monthly instalment, a term and conditions. Ask each bank which structures it offers and how the profit or interest is calculated.",
          "الرهن التقليدي قرض بفائدة. والتمويل العقاري الإسلامي يحقق الهدف نفسه عبر صيغ مثل البيع بالأجل أو الإجارة المنتهية بالتمليك. وكلاهما فيه قسط شهري ومدة وشروط. اسأل كل بنك عن الصيغ التي يقدمها وكيف يُحسب الربح أو الفائدة."
        )]
      },
      {
        h: L("What a bank looks at", "ما ينظر فيه البنك"),
        list: [
          L("Your income and how stable it is, usually shown with salary statements and an employer letter.", "دخلك ومدى استقراره، ويُثبت عادة بكشوف الراتب وخطاب صاحب العمل."),
          L("Your existing loans and cards.", "قروضك وبطاقاتك القائمة."),
          L("The property: its value, its location and whether it is in a zone you may finance.", "العقار: قيمته وموقعه وهل هو في منطقة يمكن تمويلها."),
          L("Your down payment and the length of the term.", "دفعتك المقدمة ومدة التمويل.")
        ]
      },
      {
        h: L("Compare offers properly", "قارن العروض بشكل صحيح"),
        list: [
          L("The total you will pay over the full term, not only the instalment.", "إجمالي ما ستدفعه على كامل المدة لا القسط فقط."),
          L("Whether the rate is fixed or can change, and how.", "هل المعدل ثابت أم يتغير، وكيف."),
          L("Arrangement, valuation, insurance and early-settlement fees.", "رسوم الترتيب والتقييم والتأمين والسداد المبكر."),
          L("The down payment the bank requires and what is available to non-residents.", "الدفعة المقدمة التي يطلبها البنك وما هو متاح لغير المقيمين.")
        ]
      },
      {
        h: L("A note on figures", "ملاحظة عن الأرقام"),
        p: [L(
          "Rates, down payments and eligibility change with the bank, the market and the regulator. Ask two or three banks for a written offer rather than relying on a general figure. This guide is general information and not financial advice.",
          "المعدلات والدفعات المقدمة والأهلية تتغير بحسب البنك والسوق والجهة التنظيمية. اطلب عرضاً مكتوباً من بنكين أو ثلاثة بدل الاعتماد على رقم عام. هذا الدليل معلومات عامة وليس مشورة مالية."
        )]
      }
    ],
    faq: [
      {
        q: L("Can a non-resident get a mortgage in Qatar?", "هل يستطيع غير المقيم الحصول على تمويل عقاري في قطر؟"),
        a: L("It depends on the bank and the property. Ask the banks directly what they offer to non-residents.", "يعتمد على البنك والعقار. اسأل البنوك مباشرة عمّا تقدمه لغير المقيمين.")
      },
      {
        q: L("How much down payment do I need?", "كم أحتاج دفعة مقدمة؟"),
        a: L("It is set by each bank within the regulator's rules and can change, so ask for the current figure in writing.", "يحددها كل بنك ضمن قواعد الجهة التنظيمية وقد تتغير، فاطلب الرقم الحالي كتابةً.")
      },
      {
        q: L("Is Islamic finance cheaper than a conventional loan?", "هل التمويل الإسلامي أرخص من القرض التقليدي؟"),
        a: L("Not always. Compare the total cost of each offer over the full term.", "ليس دائماً. قارن التكلفة الكلية لكل عرض على كامل المدة.")
      }
    ],
    links: ["/property-valuation", "/price-check", "/"],
    related: ["buying-process-in-qatar-step-by-step", "rent-or-buy-in-qatar", "rental-yield-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "rent-or-buy-in-qatar",
    category: "buying",
    title: L("Rent or Buy in Qatar? A Simple Way to Decide", "إيجار أم شراء في قطر؟ طريقة بسيطة للقرار"),
    description: L(
      "How to decide between renting and buying a home in Qatar: how long you will stay, the price-to-rent ratio and the costs people forget.",
      "كيف تقرر بين الإيجار وشراء منزل في قطر: مدة بقائك ونسبة السعر إلى الإيجار والتكاليف التي ينساها الناس."
    ),
    summary: L(
      "Buying tends to make sense if you will stay for several years, can afford the down payment and costs without strain, and the price is low relative to the rent. Renting makes sense when your plans are uncertain. Work out the price-to-rent ratio and add the costs of owning before you decide.",
      "الشراء يكون منطقياً عادة إذا كنت ستبقى عدة سنوات، وتتحمل الدفعة المقدمة والتكاليف دون ضغط، والسعر منخفض نسبة إلى الإيجار. والإيجار منطقي عندما تكون خططك غير مؤكدة. احسب نسبة السعر إلى الإيجار وأضف تكاليف التملك قبل أن تقرر."
    ),
    sections: [
      {
        h: L("The price-to-rent ratio", "نسبة السعر إلى الإيجار"),
        p: [L(
          "Divide the price of a home by the rent for the same kind of home over a year. A home that costs QAR 1,000,000 and rents for QAR 6,500 a month (QAR 78,000 a year) has a ratio of about 12.8: it would take about 12.8 years of rent to equal the price. The lower the ratio, the more buying looks attractive compared with renting; the higher, the more renting does.",
          "اقسم سعر المنزل على إيجار منزل مماثل في السنة. منزل يكلف 1,000,000 ريال قطري ويُؤجَّر بـ 6,500 ريال شهرياً (78,000 في السنة) نسبته نحو 12.8: أي نحو 12.8 سنة من الإيجار لتساوي السعر. وكلما انخفضت النسبة بدا الشراء أجذب من الإيجار، وكلما ارتفعت بدا الإيجار أجذب."
        )]
      },
      {
        h: L("Costs people forget when buying", "تكاليف ينساها المشترون"),
        list: [
          L("Registration and transfer costs and the agent fee.", "رسوم التسجيل والنقل وعمولة الوسيط."),
          L("The down payment, which is money not working elsewhere.", "الدفعة المقدمة، وهي مال لا يعمل في مكان آخر."),
          L("Service charges, maintenance and insurance for as long as you own it.", "رسوم الخدمة والصيانة والتأمين طوال مدة التملك."),
          L("The cost of selling later, and the time it can take.", "تكلفة البيع لاحقاً والوقت الذي قد يستغرقه.")
        ]
      },
      {
        h: L("Questions that decide it", "أسئلة تحسم القرار"),
        list: [
          L("Will I stay at least three to five years?", "هل سأبقى ثلاث إلى خمس سنوات على الأقل؟"),
          L("Can I pay the down payment and costs and still keep an emergency reserve?", "هل أستطيع دفع المقدم والتكاليف مع الاحتفاظ باحتياطي للطوارئ؟"),
          L("Is the area I want open to my ownership, as freehold or usufruct?", "هل المنطقة التي أريدها مفتوحة لتملكي، حراً أو حق انتفاع؟"),
          L("Would a rented year first help me choose better?", "هل سنة إيجار أولى تساعدني على اختيار أفضل؟")
        ]
      }
    ],
    faq: [
      {
        q: L("Is buying always better than renting?", "هل الشراء أفضل دائماً من الإيجار؟"),
        a: L("No. It depends on how long you stay, the price relative to rent, and your finances. Calculate both before you decide.", "لا. يعتمد على مدة بقائك والسعر نسبة إلى الإيجار وأوضاعك المالية. احسب الاثنين قبل أن تقرر.")
      },
      {
        q: L("How do I find the rent for a similar home?", "كيف أجد إيجار منزل مماثل؟"),
        a: L("Use the average rent report for the area, or the price check with the details of the home you are considering.", "استخدم تقرير متوسط الإيجار للمنطقة، أو فحص السعر مع تفاصيل المنزل الذي تفكر فيه.")
      },
      {
        q: L("What if I will only stay a year or two?", "ماذا لو كنت سأبقى سنة أو سنتين فقط؟"),
        a: L("Renting is usually simpler, because the costs of buying and selling are spread over a short time.", "الإيجار عادة أبسط، لأن تكاليف الشراء والبيع تتوزع على مدة قصيرة.")
      }
    ],
    links: ["/price-check", "/property-valuation", "/"],
    related: ["property-mortgage-in-qatar-basics", "how-much-rent-can-you-afford-in-qatar", "rental-yield-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "rental-yield-in-qatar",
    category: "owners",
    title: L("Rental Yield in Qatar: How to Calculate It and What Is a Good Return", "العائد الإيجاري في قطر: كيف تحسبه وما العائد الجيد"),
    description: L(
      "How to calculate gross and net rental yield on a property in Qatar, with a worked example, the costs to include and how to compare areas.",
      "كيف تحسب العائد الإيجاري الإجمالي والصافي على عقار في قطر، مع مثال محسوب والتكاليف التي تدخل في الحساب وكيف تقارن المناطق."
    ),
    summary: L(
      "Gross yield is the annual rent divided by the price; net yield first subtracts the yearly costs of owning and letting the property. Compare areas with live prices and rents, and remember that a high yield can also mean higher risk, more empty months or a weaker area.",
      "العائد الإجمالي هو الإيجار السنوي مقسوماً على السعر؛ والعائد الصافي يخصم أولاً التكاليف السنوية لتملك العقار وتأجيره. قارن المناطق بالأسعار والإيجارات الحية، وتذكر أن العائد المرتفع قد يعني أيضاً مخاطرة أعلى وأشهراً فارغة أكثر أو منطقة أضعف."
    ),
    sections: [
      {
        h: L("The two formulas", "المعادلتان"),
        list: [
          L("Gross yield = annual rent ÷ purchase price × 100.", "العائد الإجمالي = الإيجار السنوي ÷ سعر الشراء × 100."),
          L("Net yield = (annual rent − yearly costs) ÷ purchase price × 100.", "العائد الصافي = (الإيجار السنوي − التكاليف السنوية) ÷ سعر الشراء × 100.")
        ],
        p: [L(
          "Example: a unit bought for QAR 1,000,000 and rented for QAR 6,500 a month earns QAR 78,000 a year, a gross yield of 7.8%. If service charges, maintenance, agent fees and an empty month cost QAR 12,000 a year, the net income is QAR 66,000 and the net yield is 6.6%.",
          "مثال: وحدة اشتُريت بـ 1,000,000 ريال وتُؤجَّر بـ 6,500 ريال شهرياً تحقق 78,000 ريال في السنة، أي عائداً إجمالياً 7.8%. وإذا كلفت رسوم الخدمة والصيانة وعمولة الوسيط وشهر فارغ 12,000 ريال في السنة فالدخل الصافي 66,000 والعائد الصافي 6.6%."
        )]
      },
      {
        h: L("Costs to include", "التكاليف التي تدخل في الحساب"),
        list: [
          L("Service charges and building fees.", "رسوم الخدمة ورسوم المبنى."),
          L("Maintenance and repairs between tenants.", "الصيانة والإصلاحات بين المستأجرين."),
          L("Agent or management fees.", "عمولة الوسيط أو الإدارة."),
          L("Empty months: assume at least one every year or two.", "الأشهر الفارغة: افترض شهراً على الأقل كل سنة أو سنتين."),
          L("Insurance and, if you borrowed, the finance cost.", "التأمين وتكلفة التمويل إن اقترضت.")
        ]
      },
      {
        h: L("Compare areas with real numbers", "قارن المناطق بأرقام حقيقية"),
        p: [L(
          "Use the live price and rent reports to see the typical price and rent in each area, then work out the yield for the same type of unit. Check that the rent you assume is the rent that comparable units actually achieve, not the highest one you saw.",
          "استخدم تقارير الأسعار والإيجارات الحية لترى السعر والإيجار المعتادين في كل منطقة ثم احسب العائد لنفس نوع الوحدة. وتأكد أن الإيجار الذي تفترضه هو ما تحققه وحدات مماثلة فعلاً لا أعلى ما رأيته."
        )]
      }
    ],
    faq: [
      {
        q: L("What is a good rental yield?", "ما العائد الإيجاري الجيد؟"),
        a: L("There is no single number. Compare the net yield with other places you could put the money, and with the risk of the area and the type of unit.", "لا يوجد رقم واحد. قارن العائد الصافي مع أماكن أخرى يمكنك وضع المال فيها ومع مخاطر المنطقة ونوع الوحدة.")
      },
      {
        q: L("Do the figures on Nerou Finder show achieved rents?", "هل أرقام نيرو فايندر تعرض إيجارات محققة؟"),
        a: L("They show the prices and rents of live listings, which are asking prices, not completed deals. Treat them as a guide and confirm with local agents.", "تعرض أسعار وإيجارات الإعلانات الحية، وهي أسعار معروضة لا صفقات مكتملة. اعتبرها مرشداً وتأكد مع الوسطاء المحليين.")
      },
      {
        q: L("Should I use gross or net yield?", "هل أستخدم العائد الإجمالي أم الصافي؟"),
        a: L("Use gross yield for a quick comparison between areas, and net yield for the real decision.", "استخدم الإجمالي للمقارنة السريعة بين المناطق، والصافي للقرار الفعلي.")
      }
    ],
    links: ["/property-valuation", "/price-check", "/area-guides"],
    related: ["rent-or-buy-in-qatar", "how-to-price-your-property-in-qatar", "off-plan-property-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "how-to-price-your-property-in-qatar",
    category: "owners",
    title: L("How to Price Your Property in Qatar to Rent or Sell It Faster", "كيف تسعّر عقارك في قطر ليُؤجَّر أو يُباع أسرع"),
    description: L(
      "How to set a realistic asking price for your property in Qatar: compare live listings, adjust for floor, view and condition, and test the market.",
      "كيف تضع سعراً واقعياً لعقارك في قطر: قارن بالإعلانات الحية وعدّل للطابق والإطلالة والحالة واختبر السوق."
    ),
    summary: L(
      "Price your property from comparable live listings in the same area, type and size, then adjust for floor, view, condition and what is included. A price that is too high costs you weeks of empty rent; one that is too low costs you money. Start at the figure the market supports and review it after two weeks of enquiries.",
      "سعّر عقارك من إعلانات حية مماثلة في المنطقة والنوع والمساحة نفسها، ثم عدّل للطابق والإطلالة والحالة وما هو مشمول. السعر المرتفع جداً يكلفك أسابيع من إيجار ضائع، والمنخفض جداً يكلفك مالاً. ابدأ بالرقم الذي يدعمه السوق وراجعه بعد أسبوعين من الاستفسارات."
    ),
    sections: [
      {
        h: L("A four-step method", "طريقة من أربع خطوات"),
        list: [
          L("1. Find five to ten comparable live listings: same area, same type, similar size and bedrooms.", "1. ابحث عن خمسة إلى عشرة إعلانات حية مماثلة: المنطقة والنوع والمساحة وعدد الغرف نفسها."),
          L("2. Work out the typical price per square metre of those listings.", "2. احسب سعر المتر المربع المعتاد لتلك الإعلانات."),
          L("3. Adjust: higher floor, better view or newer finish can justify more; an older building, no parking or a weaker view justify less.", "3. عدّل: طابق أعلى أو إطلالة أفضل أو تشطيب أحدث يبرر أكثر؛ ومبنى أقدم أو بلا موقف أو إطلالة أضعف يبرر أقل."),
          L("4. Check the result with the free valuation tool, which shows the range and the listings it is based on.", "4. تحقق من النتيجة بأداة التقييم المجانية التي تعرض المدى والإعلانات المبنية عليه.")
        ]
      },
      {
        h: L("Asking price is not the deal price", "السعر المعروض ليس سعر الصفقة"),
        p: [L(
          "The listings you compare are asking prices. Buyers and tenants often negotiate, so decide your lowest acceptable price in advance and leave a sensible gap, without padding the price so much that the listing is ignored.",
          "الإعلانات التي تقارنها أسعار معروضة. والمشترون والمستأجرون يفاوضون غالباً، فحدّد أدنى سعر تقبله مسبقاً واترك هامشاً معقولاً دون أن تضخم السعر حتى يُتجاهل الإعلان."
        )]
      },
      {
        h: L("Review after two weeks", "راجع بعد أسبوعين"),
        list: [
          L("Many views but no offers: the price may be slightly high, or the photos and description may be hiding the strengths.", "مشاهدات كثيرة بلا عروض: قد يكون السعر مرتفعاً قليلاً أو الصور والوصف تخفي المزايا."),
          L("Few views: check the title, photos and area first, before cutting the price.", "مشاهدات قليلة: افحص العنوان والصور والمنطقة أولاً قبل خفض السعر."),
          L("Several offers quickly: the price may be low. Keep the next one higher.", "عروض كثيرة بسرعة: قد يكون السعر منخفضاً. اجعل الذي يليه أعلى.")
        ]
      }
    ],
    faq: [
      {
        q: L("Should I ask for more and expect to negotiate?", "هل أطلب أكثر وأتوقع المفاوضة؟"),
        a: L("A small gap is normal. A large one makes people skip the listing, so stay close to what comparable homes ask.", "فارق صغير طبيعي. والكبير يجعل الناس يتجاوزون الإعلان، فابقَ قريباً مما تطلبه منازل مماثلة.")
      },
      {
        q: L("How often should I review the price?", "كل كم أراجع السعر؟"),
        a: L("After two weeks of enquiries, and again if the market changes or similar listings in your area drop.", "بعد أسبوعين من الاستفسارات، ومجدداً إذا تغير السوق أو انخفضت إعلانات مشابهة في منطقتك.")
      },
      {
        q: L("Where do I get an estimate for free?", "أين أحصل على تقدير مجاني؟"),
        a: L("Use the free valuation tool on Nerou Finder: it shows a range from the live listings around you.", "استخدم أداة التقييم المجانية في نيرو فايندر: تعرض مدى من الإعلانات الحية حولك.")
      }
    ],
    links: ["/property-valuation", "/price-check", "/plans-pricing"],
    related: ["rental-yield-in-qatar", "how-to-write-a-property-listing-that-gets-enquiries", "rent-or-buy-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "how-to-write-a-property-listing-that-gets-enquiries",
    category: "agents",
    title: L("How to Write a Property Listing That Gets Enquiries (For Qatar Agents)", "كيف تكتب إعلاناً عقارياً يجلب الاستفسارات (لوسطاء قطر)"),
    description: L(
      "A checklist for agents: the photos, title, description, price and location details that make a Qatar property listing get more enquiries.",
      "قائمة للوسطاء: الصور والعنوان والوصف والسعر وتفاصيل الموقع التي تجعل الإعلان العقاري في قطر يجلب استفسارات أكثر."
    ),
    summary: L(
      "A listing that gets enquiries has bright, true photos, a clear title with the area and the key fact, an accurate price, complete details and an exact location. Be honest about weak points, keep availability current and answer quickly: buyers and tenants compare many listings and contact the ones that are clear and recent.",
      "الإعلان الذي يجلب استفسارات فيه صور مضيئة وصادقة وعنوان واضح بالمنطقة والمعلومة الأهم وسعر دقيق وتفاصيل كاملة وموقع دقيق. كن صادقاً في نقاط الضعف وحدّث التوفر وأجب بسرعة: المشترون والمستأجرون يقارنون إعلانات كثيرة ويتصلون بالواضح والحديث منها."
    ),
    sections: [
      {
        h: L("The checklist", "قائمة الفحص"),
        list: [
          L("Photos: at least ten, in daylight, landscape, every room and the view, no filters and no watermarks of other sites.", "الصور: عشر على الأقل، بضوء النهار، بالعرض، كل غرفة والإطلالة، بلا فلاتر وبلا علامات مائية لمواقع أخرى."),
          L("Title: the type, the area and the key fact, for example \"2-bedroom apartment in Lusail, sea view\".", "العنوان: النوع والمنطقة والمعلومة الأهم، مثل «شقة غرفتين في لوسيل بإطلالة بحرية»."),
          L("Price: the real asking price, with the payment terms (monthly, yearly) and what is included.", "السعر: السعر الحقيقي المعروض مع شروط الدفع (شهري أو سنوي) وما هو مشمول."),
          L("Details: size, bedrooms, bathrooms, floor, parking, furnishing, year built, service charges, cooling.", "التفاصيل: المساحة والغرف والحمامات والطابق والمواقف والأثاث وسنة البناء ورسوم الخدمة والتبريد."),
          L("Location: the exact pin on the map, so buyers can see the real position and the area around it.", "الموقع: الدبوس الدقيق على الخريطة ليرى المشترون الموقع الحقيقي والمنطقة حوله."),
          L("Description: start with what the person gains, then facts, then how to arrange a viewing.", "الوصف: ابدأ بما سيكسبه الشخص ثم الحقائق ثم كيفية ترتيب المعاينة.")
        ]
      },
      {
        h: L("Add listings faster", "أضف الإعلانات أسرع"),
        p: [L(
          "On Nerou Finder you can paste an ad you already wrote, upload a file of listings, or connect a feed link, instead of retyping each one. Imports arrive as drafts so you can check them before they go live.",
          "في نيرو فايندر يمكنك لصق إعلان كتبته من قبل، أو رفع ملف إعلانات، أو ربط رابط تغذية، بدل إعادة كتابة كل إعلان. وتصل الإعلانات المستوردة كمسودات لتراجعها قبل أن تُنشر."
        )]
      },
      {
        h: L("Keep it fresh and honest", "حافظ على حداثته وصدقه"),
        list: [
          L("Remove or mark a unit as soon as it is taken: stale listings waste everyone's time and hurt your reputation.", "أزل الوحدة أو علّمها فور أخذها: الإعلانات القديمة تضيع وقت الجميع وتضر بسمعتك."),
          L("Say what is less than perfect: it filters out the wrong enquiries and builds trust.", "اذكر ما ليس مثالياً: يصفّي الاستفسارات غير المناسبة ويبني الثقة."),
          L("Answer within the hour when you can: speed is one of the few things you fully control.", "أجب خلال ساعة حين تستطيع: السرعة من القليل الذي تتحكم فيه تماماً.")
        ]
      }
    ],
    faq: [
      {
        q: L("How many photos should a listing have?", "كم صورة يجب أن يحتوي الإعلان؟"),
        a: L("At least ten clear photos covering every room and the view. More is fine if each one adds something.", "عشر صور واضحة على الأقل تغطي كل غرفة والإطلالة. والمزيد جيد إن أضافت كل صورة شيئاً.")
      },
      {
        q: L("Should I put the price in the listing?", "هل أضع السعر في الإعلان؟"),
        a: L("Yes. Listings without a price get fewer serious enquiries and more time-wasting ones.", "نعم. الإعلانات بلا سعر تجلب استفسارات جادة أقل وأخرى مضيعة للوقت أكثر.")
      },
      {
        q: L("Can I import my existing listings?", "هل أستطيع استيراد إعلاناتي الحالية؟"),
        a: L("Yes: paste an ad, upload a CSV, JSON or XML file, or connect a feed link, from My Listings in your dashboard.", "نعم: الصق إعلاناً أو ارفع ملف CSV أو JSON أو XML أو اربط رابط تغذية، من «إعلاناتي» في لوحتك.")
      }
    ],
    links: ["/plans-pricing", "/price-check", "/property-valuation"],
    related: ["get-more-property-leads-in-qatar-without-ads", "how-to-price-your-property-in-qatar", "how-to-choose-a-real-estate-agent-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "get-more-property-leads-in-qatar-without-ads",
    category: "agents",
    title: L("How Qatar Real Estate Agents Can Get More Leads Without Paid Ads", "كيف يحصل وسطاء العقار في قطر على عملاء أكثر دون إعلانات مدفوعة"),
    description: L(
      "Practical ways for property agents in Qatar to win more enquiries without ads: a complete verified profile, reviews, fast replies and fresh listings.",
      "طرق عملية لوسطاء العقار في قطر لجلب استفسارات أكثر دون إعلانات: ملف موثّق كامل وتقييمات وردود سريعة وإعلانات حديثة."
    ),
    summary: L(
      "Agents win leads without ads by being easy to trust and easy to reach: a verified, complete profile, real client reviews, fast replies, fresh and accurate listings, and a public page link you share everywhere. Each of these is free and compounds over time.",
      "يكسب الوسطاء العملاء دون إعلانات بأن يكونوا سهلي الثقة وسهلي الوصول: ملف موثّق وكامل وتقييمات عملاء حقيقية وردود سريعة وإعلانات حديثة ودقيقة ورابط صفحة عامة يشاركونه في كل مكان. وكل ذلك مجاني ويتراكم مع الوقت."
    ),
    sections: [
      {
        h: L("Build trust first", "ابنِ الثقة أولاً"),
        list: [
          L("Complete the verification: a verified badge tells visitors your documents were checked.", "أكمل التوثيق: شارة التوثيق تخبر الزوار أن وثائقك فُحصت."),
          L("Fill in your profile: a clear photo, a short bio, your languages and the areas you know.", "أكمل ملفك: صورة واضحة ونبذة قصيرة ولغاتك والمناطق التي تعرفها."),
          L("Ask happy clients for a review: a review link makes it a two-minute task, and only real clients can leave one.", "اطلب تقييماً من العملاء الراضين: رابط التقييم يجعله مهمة دقيقتين، والعملاء الحقيقيون فقط يستطيعون ترك تقييم.")
        ]
      },
      {
        h: L("Be fast and fresh", "كن سريعاً وحديثاً"),
        list: [
          L("Reply to enquiries quickly: agents who answer fast earn a reply-time badge once enough enquiries can be measured.", "أجب عن الاستفسارات بسرعة: الوسطاء السريعون يحصلون على شارة سرعة الرد عندما تتوفر استفسارات كافية للقياس."),
          L("Keep every listing current: remove what is taken and update prices.", "حافظ على كل إعلان حديثاً: أزل المأخوذ وحدّث الأسعار."),
          L("Follow up: use the Sales Desk to schedule follow-ups so no enquiry is forgotten.", "تابع: استخدم مكتب المبيعات لجدولة المتابعات حتى لا يُنسى أي استفسار.")
        ]
      },
      {
        h: L("Share your public page", "شارك صفحتك العامة"),
        p: [L(
          "Every agent has a public page with their listings and reviews. Put the link in your messaging app profile, your email signature and your social accounts, and share each listing by WhatsApp or as a picture from the share tool. People who find you through a link already trust a page that shows your record.",
          "لكل وسيط صفحة عامة بإعلاناته وتقييماته. ضع الرابط في ملفك على تطبيق المراسلة وتوقيع بريدك وحساباتك الاجتماعية، وشارك كل إعلان عبر واتساب أو كصورة من أداة المشاركة. ومن يصل إليك عبر رابط يثق عادة بصفحة تعرض سجلك."
        )]
      },
      {
        h: L("Give something useful away", "قدّم شيئاً مفيداً مجاناً"),
        p: [L(
          "Send clients to the free price check and valuation tools when they ask whether a price is fair. It answers their question honestly and shows you are on their side.",
          "أرسل العملاء إلى أداتي فحص السعر والتقييم المجانيتين حين يسألون هل السعر عادل. هذا يجيب سؤالهم بصدق ويُظهر أنك في صفّهم."
        )]
      }
    ],
    faq: [
      {
        q: L("How long before I see results?", "كم يستغرق ظهور النتائج؟"),
        a: L("Trust builds over weeks and months, not days. The habits above compound: each review, each fast reply and each fresh listing adds to the next.", "الثقة تُبنى بالأسابيع والأشهر لا بالأيام. والعادات أعلاه تتراكم: كل تقييم وكل رد سريع وكل إعلان حديث يضيف إلى ما بعده.")
      },
      {
        q: L("Do I need a paid plan to do this?", "هل أحتاج باقة مدفوعة لفعل ذلك؟"),
        a: L("The steps in this guide are free. See the plans page for what each plan includes and the free trial.", "الخطوات في هذا الدليل مجانية. اطلع على صفحة الباقات لمعرفة ما تتضمنه كل باقة والتجربة المجانية.")
      },
      {
        q: L("Can clients review me without a real enquiry?", "هل يستطيع العملاء تقييمي دون استفسار حقيقي؟"),
        a: L("Reviews are tied to a real enquiry on the platform, which keeps them trustworthy for everyone.", "التقييمات مرتبطة باستفسار حقيقي على المنصة، مما يبقيها موثوقة للجميع.")
      }
    ],
    links: ["/plans-pricing", "/price-check", "/property-valuation"],
    related: ["how-to-write-a-property-listing-that-gets-enquiries", "how-to-choose-a-real-estate-agent-qatar", "how-to-price-your-property-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  }
];
