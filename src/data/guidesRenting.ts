// Guides for people who rent, and for people settling in. Written to answer what people actually ask before they sign a lease in
// Qatar. Rules that change (thresholds, fees, procedures) are described in general terms and the reader is told to confirm them:
// nothing here is legal advice, and a guide that is wrong about a figure does more harm than one that says "check the current figure".

import { L, type Guide } from "./guideTypes.js";

export const RENTING_GUIDES: Guide[] = [
  {
    slug: "renting-an-apartment-in-qatar",
    category: "renting",
    title: L("How to Rent an Apartment in Qatar: A Step-by-Step Guide", "كيف تستأجر شقة في قطر: دليل خطوة بخطوة"),
    description: L(
      "How renting works in Qatar, from budget to handover: what it costs, what to check in the contract and what to do after you sign.",
      "كيف يتم الإيجار في قطر من الميزانية حتى الاستلام: التكاليف، وما يجب فحصه في العقد، وما تفعله بعد التوقيع."
    ),
    summary: L(
      "Renting in Qatar takes six steps: set a budget, shortlist areas, view the unit in person, agree the total price, sign a written and registered contract, then connect your utilities and record the condition of the unit. Never pay a deposit before you have seen the unit and read the contract.",
      "الإيجار في قطر يمر بست خطوات: حدّد ميزانيتك، اختر مناطق قليلة، عاين الوحدة بنفسك، اتفق على السعر الكلي، وقّع عقداً مكتوباً وموثّقاً، ثم وصّل الخدمات وسجّل حالة الوحدة. لا تدفع أي عربون قبل أن ترى الوحدة وتقرأ العقد."
    ),
    sections: [
      {
        h: L("1. Set the budget and the must-haves", "1. حدّد الميزانية وما لا تتنازل عنه"),
        p: [L(
          "Decide the monthly figure you can carry comfortably, then the few things that matter most: number of bedrooms, distance to work or school, furnished or not, and whether you need parking. A short list makes the search faster and the comparison fairer.",
          "حدّد المبلغ الشهري الذي تتحمله براحة، ثم القليل الذي يهمك فعلاً: عدد الغرف، والمسافة إلى العمل أو المدرسة، والأثاث، والحاجة إلى موقف سيارة. القائمة القصيرة تسرّع البحث وتجعل المقارنة عادلة."
        )]
      },
      {
        h: L("2. Search and view in person", "2. ابحث وعاين بنفسك"),
        list: [
          L("Compare at least three comparable units before you decide: the price check tool shows you what is fair in the same area.", "قارن ثلاث وحدات مشابهة على الأقل قبل أن تقرر: أداة فحص السعر تريك السعر العادل في المنطقة نفسها."),
          L("Visit at the time of day you will actually use the place: traffic, noise and parking look different at 8 a.m.", "زر العقار في الوقت الذي ستستخدمه فيه فعلاً: الزحام والضجيج والمواقف تختلف في الثامنة صباحاً."),
          L("Test the air conditioning, water pressure, taps, windows, lifts and phone signal.", "جرّب المكيّفات وضغط المياه والصنابير والنوافذ والمصاعد وتغطية الشبكة."),
          L("Ask what the building charges for: maintenance, parking, gym or pool access, cooling.", "اسأل عمّا يتقاضاه المبنى: الصيانة والمواقف والنادي أو المسبح والتبريد.")
        ]
      },
      {
        h: L("3. Agree the total price before you sign", "3. اتفق على السعر الكلي قبل التوقيع"),
        p: [L(
          "Ask for one total: rent, deposit, any agent or admin fee, and which utilities are included. Get it in writing, even as a message. Then ask for the contract itself, not a summary, and read it with the checklist in our guide to the rental contract.",
          "اطلب رقماً واحداً شاملاً: الإيجار والتأمين وأي رسوم وساطة أو إدارة، وما الخدمات المشمولة. احصل عليه كتابةً حتى لو برسالة. ثم اطلب العقد نفسه لا ملخصه، واقرأه بقائمة الفحص في دليل عقد الإيجار."
        )],
        list: [
          L("The deposit and the first payment are usually due at signing: agree the amounts and the refund terms first.", "التأمين والدفعة الأولى تُدفع عادة عند التوقيع: اتفق على المبالغ وشروط الاسترداد أولاً."),
          L("Pay by bank transfer or cheque to the owner or the company named in the contract, and keep the receipt.", "ادفع بتحويل بنكي أو شيك إلى المالك أو الشركة المذكورة في العقد، واحتفظ بالإيصال.")
        ]
      },
      {
        h: L("4. Register the contract", "4. وثّق العقد"),
        p: [L(
          "Tenancy contracts in Qatar are registered with the authorities through the electronic Tawtheeq system, and a registered contract is what utility companies and government offices normally ask for. Ask who will register it and when, and keep your copy. Procedures change, so confirm the current steps with the landlord or the relevant authority.",
          "عقود الإيجار في قطر تُوثَّق لدى الجهات المختصة عبر نظام «توثيق» الإلكتروني، والعقد الموثّق هو ما تطلبه عادة شركات الخدمات والدوائر الحكومية. اسأل من سيوثّقه ومتى، واحتفظ بنسختك. الإجراءات تتغير، فتأكد من الخطوات الحالية مع المؤجر أو الجهة المختصة."
        )]
      },
      {
        h: L("5. Move in the right way", "5. ادخل بالطريقة الصحيحة"),
        list: [
          L("Open your electricity and water account with Kahramaa and set up internet with a provider.", "افتح حساب الكهرباء والماء لدى «كهرماء» وركّب الإنترنت لدى مزوّد الخدمة."),
          L("Photograph every room and any damage on day one and send the photos to the landlord by message.", "صوّر كل غرفة وأي عيب في اليوم الأول وأرسل الصور إلى المؤجر برسالة."),
          L("Keep the contract, receipts and the photos in one folder until the deposit is back.", "احتفظ بالعقد والإيصالات والصور في مجلد واحد إلى أن يُردّ التأمين.")
        ]
      }
    ],
    faq: [
      {
        q: L("Do I need a residence permit to rent a home in Qatar?", "هل أحتاج إلى إقامة لاستئجار منزل في قطر؟"),
        a: L("Landlords usually ask for your ID or passport and, for residents, your Qatar ID. Requirements differ by landlord and building, so ask before you pay anything.", "يطلب المؤجرون عادة هويتك أو جواز سفرك، وللمقيمين البطاقة الشخصية القطرية. تختلف المتطلبات بين مؤجر وآخر، فاسأل قبل أن تدفع أي مبلغ.")
      },
      {
        q: L("How much deposit should I expect to pay?", "كم أتوقع أن أدفع تأميناً؟"),
        a: L("It is agreed between you and the landlord and is often a month or two of rent. Whatever the figure, write it into the contract with the conditions for getting it back.", "يُتفق عليه بينك وبين المؤجر وغالباً ما يكون إيجار شهر أو شهرين. أياً كان المبلغ، اكتبه في العقد مع شروط استرداده.")
      },
      {
        q: L("Can I rent a home before I arrive in Qatar?", "هل يمكنني استئجار منزل قبل وصولي إلى قطر؟"),
        a: L("It is safer to book a short stay first and view homes in person. Never send a deposit for a unit you have not seen, even if the photos look right.", "الأسلم أن تحجز إقامة قصيرة أولاً وتعاين المنازل بنفسك. لا ترسل تأميناً لوحدة لم تَرَها، حتى لو بدت الصور مناسبة.")
      }
    ],
    links: ["/price-check", "/", "/area-guides"],
    related: ["rental-contract-checklist-qatar", "how-much-rent-can-you-afford-in-qatar", "rental-scams-qatar", "moving-to-qatar-housing-checklist"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "rental-contract-checklist-qatar",
    category: "renting",
    title: L("Rental Contract Checklist for Qatar: 12 Things to Check Before You Sign", "قائمة فحص عقد الإيجار في قطر: 12 بنداً قبل أن توقّع"),
    description: L(
      "The 12 points to check in a Qatar tenancy contract: parties, unit, rent, term, deposit, utilities, repairs, notice and registration.",
      "12 نقطة تفحصها في عقد الإيجار في قطر: الأطراف والوحدة والإيجار والمدة والتأمين والخدمات والإصلاحات والإخطار والتوثيق."
    ),
    summary: L(
      "Before you sign, check that the contract names the real owner or an authorised agent, identifies the exact unit, states the rent and payment dates, the term and renewal, the deposit and how it is returned, who pays utilities and repairs, the notice period, and that it will be registered. Anything promised verbally should be in the text.",
      "قبل أن توقّع، تأكد أن العقد يذكر المالك الحقيقي أو وكيلاً مفوّضاً، ويحدد الوحدة بدقة، ويبيّن الإيجار ومواعيد الدفع والمدة والتجديد والتأمين وكيفية رده، ومن يدفع الخدمات والإصلاحات، ومدة الإخطار، وأن العقد سيُوثَّق. وكل ما وُعدت به شفهياً يجب أن يكون مكتوباً."
    ),
    sections: [
      {
        h: L("The twelve points", "النقاط الاثنتا عشرة"),
        list: [
          L("1. The landlord: the owner's name, or a signed authorisation if an agent or company signs for them.", "1. المؤجر: اسم المالك، أو تفويض موقّع إن كان وسيط أو شركة يوقّع نيابة عنه."),
          L("2. You: your full name and ID number exactly as on your documents, and the names of the people who will live there.", "2. أنت: اسمك الكامل ورقم هويتك كما في وثائقك، وأسماء من سيسكنون معك."),
          L("3. The unit: building, unit number, floor, street and zone, so there is no doubt which place it is.", "3. الوحدة: المبنى ورقم الوحدة والطابق والشارع والمنطقة، حتى لا يكون هناك شك في المكان."),
          L("4. The rent: amount, currency, how often and on which dates it is paid, and how (cheque, transfer).", "4. الإيجار: المبلغ والعملة وعدد الدفعات وتواريخها وطريقتها (شيك أو تحويل)."),
          L("5. The term: start date, end date and what happens at renewal, including whether the rent can change.", "5. المدة: تاريخ البداية والنهاية وما يحدث عند التجديد، وهل يمكن تغيير الإيجار."),
          L("6. The deposit: the amount, who holds it, and the conditions and deadline for returning it.", "6. التأمين: المبلغ ومن يحتفظ به وشروط ردّه وموعده."),
          L("7. What is included: electricity, water, cooling, internet, parking spaces, gym and pool, maintenance fees.", "7. ما هو مشمول: الكهرباء والماء والتبريد والإنترنت والمواقف والنادي والمسبح ورسوم الصيانة."),
          L("8. Repairs: who fixes what, and how quickly the landlord must act on an urgent fault.", "8. الإصلاحات: من يصلح ماذا، وخلال كم من الوقت يجب أن يتصرف المؤجر في العطل العاجل."),
          L("9. Use: whether sub-letting, a home office, pets or extra occupants are allowed.", "9. الاستخدام: هل يُسمح بالتأجير من الباطن أو العمل من المنزل أو الحيوانات الأليفة أو سكن أشخاص إضافيين."),
          L("10. Ending early: the notice period and any penalty, for you and for the landlord.", "10. الإنهاء المبكر: مدة الإخطار وأي غرامة، عليك وعلى المؤجر."),
          L("11. Handover: a list or photos of the condition on the day you move in, signed or sent by message.", "11. التسليم: قائمة أو صور بحالة الوحدة يوم دخولك، موقّعة أو مرسلة برسالة."),
          L("12. Registration: who registers the contract and when, and a copy for you.", "12. التوثيق: من يوثّق العقد ومتى، ونسخة لك.")
        ]
      },
      {
        h: L("If something is unclear", "إذا كان هناك ما لا يتضح"),
        p: [L(
          "Ask for the clause to be rewritten rather than explained. A promise made in conversation is hard to prove later; the same promise in the contract is easy. If you are unsure about a clause, ask a lawyer or the relevant authority before signing. This guide is general information and not legal advice.",
          "اطلب إعادة صياغة البند بدل شرحه. الوعد الشفهي يصعب إثباته لاحقاً، أما الوعد المكتوب في العقد فيسهل إثباته. وإن شككت في بند فاسأل محامياً أو الجهة المختصة قبل التوقيع. هذا الدليل معلومات عامة وليس استشارة قانونية."
        )]
      }
    ],
    faq: [
      {
        q: L("Should the contract be in Arabic or English?", "هل يجب أن يكون العقد بالعربية أم بالإنجليزية؟"),
        a: L("Ask for a copy you can read. If the contract is bilingual, check which language prevails if the two differ, and ask for that to be written in it.", "اطلب نسخة تفهمها. وإن كان العقد بلغتين فتحقق أي اللغتين تسود عند الاختلاف واطلب كتابة ذلك فيه.")
      },
      {
        q: L("Can the landlord raise the rent during the contract?", "هل يستطيع المؤجر رفع الإيجار أثناء مدة العقد؟"),
        a: L("The rent in the contract is what you agreed for the term. What happens at renewal should be written in the contract, and the rules on rent changes are set by law, so confirm the current ones.", "الإيجار المكتوب هو ما اتفقتما عليه للمدة كلها. وما يحدث عند التجديد يجب أن يُكتب في العقد، وقواعد تغيير الإيجار يحددها القانون، فتأكد من الحالية منها.")
      },
      {
        q: L("What should I do if the landlord will not return the deposit?", "ماذا أفعل إذا امتنع المؤجر عن رد التأمين؟"),
        a: L("Start with your handover photos and the contract terms and ask in writing. If that fails, the authorities that handle rental disputes can advise you on the next step.", "ابدأ بصور التسليم وشروط العقد واطلب كتابةً. فإن لم ينجح ذلك فالجهات التي تنظر في منازعات الإيجار تنصحك بالخطوة التالية.")
      }
    ],
    links: ["/price-check", "/"],
    related: ["renting-an-apartment-in-qatar", "rental-scams-qatar", "qatar-property-listing-terms-explained"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "rental-scams-qatar",
    category: "renting",
    title: L("Property Rental Scams in Qatar: How to Spot a Fake Listing", "احتيال الإيجار العقاري في قطر: كيف تكشف الإعلان المزيّف"),
    description: L(
      "The warning signs of a fake rental listing in Qatar and a simple routine to check an ad, an agent and a payment before you send money.",
      "علامات الإعلان المزيّف في قطر وطريقة بسيطة لفحص الإعلان والوسيط والدفع قبل أن ترسل أي مال."
    ),
    summary: L(
      "A fake listing usually has a price far below the market, asks for money before you can visit, and comes with a reason you cannot meet the owner. Compare the price with live listings, view the unit in person, check the agent's licence, and pay only against a contract, to the named owner or company.",
      "الإعلان المزيّف سعره عادة أقل بكثير من السوق، ويطلب مالاً قبل أن تزور الوحدة، ويأتي مع سبب يمنعك من لقاء المالك. قارن السعر بالإعلانات الحية، وعاين الوحدة بنفسك، وتحقق من رخصة الوسيط، ولا تدفع إلا مقابل عقد وإلى المالك أو الشركة المذكورة فيه."
    ),
    sections: [
      {
        h: L("Warning signs", "علامات الخطر"),
        list: [
          L("The price is far below similar homes in the area. Check it with the price check tool: a very big gap is a reason to ask why.", "السعر أقل بكثير من مثيلاته في المنطقة. افحصه بأداة فحص السعر: فرق كبير جداً سبب للسؤال عن السبب."),
          L("You are asked to transfer a deposit or a \"reservation fee\" before you have visited.", "يُطلب منك تحويل تأمين أو «رسوم حجز» قبل أن تزور العقار."),
          L("The owner is abroad, travelling or \"cannot meet\", and a friend or an unnamed person has the keys.", "المالك خارج البلاد أو مسافر أو «لا يستطيع اللقاء»، ومعه صديق أو شخص مجهول يحمل المفاتيح."),
          L("The photos are professional but the person cannot send a quick video of the unit today.", "الصور احترافية لكن صاحب الإعلان لا يستطيع إرسال فيديو سريع للوحدة اليوم."),
          L("The same photos appear in other ads with another price, another area or another phone number.", "الصور نفسها تظهر في إعلانات أخرى بسعر أو منطقة أو رقم هاتف مختلف."),
          L("Pressure: \"another person is paying today\" and a deadline of hours.", "ضغط: «شخص آخر سيدفع اليوم» ومهلة ساعات."),
          L("The payment goes to a personal account that does not match the name on the contract, or to a wallet or gift cards.", "الدفع يذهب إلى حساب شخصي لا يطابق الاسم في العقد، أو إلى محفظة أو بطاقات هدايا.")
        ]
      },
      {
        h: L("A five-minute routine before you pay", "روتين من خمس دقائق قبل أن تدفع"),
        list: [
          L("Search the listing's photos and text on the web to see whether they appear elsewhere.", "ابحث عن صور الإعلان ونصه في الإنترنت لترى هل يظهران في مكان آخر."),
          L("Ask for the agent's licence number and the owner's authorisation, and check them with the relevant authority.", "اطلب رقم رخصة الوسيط وتفويض المالك، وتحقق منهما لدى الجهة المختصة."),
          L("Visit in person, with the person who will sign. Meet at the property, not somewhere else.", "عاين بنفسك مع من سيوقّع. التقِ في العقار نفسه لا في مكان آخر."),
          L("Read the contract before you pay and check that the name on it matches the account you pay into.", "اقرأ العقد قبل الدفع وتأكد أن الاسم فيه يطابق الحساب الذي ستدفع إليه."),
          L("Pay by bank transfer or cheque, never in cash or by gift card, and keep the receipt.", "ادفع بتحويل بنكي أو شيك، لا نقداً ولا ببطاقات هدايا، واحتفظ بالإيصال.")
        ]
      },
      {
        h: L("If you think it is a scam", "إذا اشتبهت بالاحتيال"),
        p: [L(
          "Stop paying, keep the messages and the payment proof, and report it to the police and to your bank at once: a quick report gives the best chance of stopping a transfer. On Nerou Finder, every agent's licence is verified and each listing's availability is confirmed before it is published; if you see an ad here that does not look right, report it.",
          "توقف عن الدفع، واحتفظ بالرسائل وإثبات الدفع، وأبلغ الشرطة والبنك فوراً: البلاغ السريع يعطي أفضل فرصة لإيقاف التحويل. في نيرو فايندر تُوثَّق رخصة كل وسيط ويُتأكد من توفر كل عقار قبل نشره؛ وإن رأيت هنا إعلاناً لا يبدو سليماً فأبلغ عنه."
        )]
      }
    ],
    faq: [
      {
        q: L("Is it normal to pay a reservation fee before viewing?", "هل من الطبيعي دفع رسوم حجز قبل المعاينة؟"),
        a: L("No. Pay nothing before you have seen the unit and read the contract. A real owner or agent understands why you want to see it first.", "لا. لا تدفع شيئاً قبل أن ترى الوحدة وتقرأ العقد. المالك أو الوسيط الحقيقي يتفهم رغبتك في رؤيتها أولاً.")
      },
      {
        q: L("How can I tell if a price is too good to be true?", "كيف أعرف أن السعر أرخص من أن يكون حقيقياً؟"),
        a: L("Compare it with the live listings in the same area, size and type. Our price check does this and warns when a price is far below the market.", "قارنه بالإعلانات الحية في المنطقة والمساحة والنوع نفسها. فحص السعر لدينا يفعل ذلك وينبّه عندما يكون السعر أقل بكثير من السوق.")
      },
      {
        q: L("Should I trust an ad on social media?", "هل أثق بإعلان على وسائل التواصل؟"),
        a: L("It can be real, but the same checks apply, and more so: view in person, check the licence and the contract, and pay only to the named owner or company.", "قد يكون حقيقياً، لكن الفحوص نفسها تنطبق وبصرامة أكبر: عاين بنفسك وتحقق من الرخصة والعقد وادفع فقط للمالك أو الشركة المذكورة.")
      }
    ],
    links: ["/price-check", "/"],
    related: ["how-to-choose-a-real-estate-agent-qatar", "rental-contract-checklist-qatar", "renting-an-apartment-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "how-much-rent-can-you-afford-in-qatar",
    category: "renting",
    title: L("How Much Rent Can You Afford in Qatar?", "كم إيجاراً تستطيع تحمّله في قطر؟"),
    description: L(
      "A simple way to set your rent budget in Qatar: the share of income to aim for, the costs on top of rent and a worked example.",
      "طريقة بسيطة لتحديد ميزانية الإيجار في قطر: نسبة الدخل المناسبة والتكاليف الإضافية ومثال محسوب."
    ),
    summary: L(
      "A common rule of thumb is to keep rent at about a quarter to a third of your net monthly income, then check that the extra costs (utilities, cooling, internet, parking, transport) still fit. Compare any home you like with what is fair in the same area before you commit.",
      "قاعدة شائعة أن يبقى الإيجار بين ربع وثلث صافي دخلك الشهري تقريباً، ثم تتحقق أن التكاليف الإضافية (الخدمات والتبريد والإنترنت والمواقف والمواصلات) ما زالت مناسبة. وقارن أي منزل يعجبك بالسعر العادل في المنطقة نفسها قبل أن تلتزم."
    ),
    sections: [
      {
        h: L("The rule of thumb", "القاعدة التقريبية"),
        p: [L(
          "Take your net monthly income, after any deductions, and multiply by 0.25 and by 0.33. That range is a comfortable first target for the rent. If your employer pays a housing allowance, use the allowance as a guide, but remember that it only helps if the rent you choose fits what you actually receive.",
          "خذ صافي دخلك الشهري بعد الخصومات واضربه في 0.25 ثم في 0.33. هذا المدى هدف أول مريح للإيجار. وإن كان صاحب العمل يدفع بدل سكن فاعتمد عليه مرجعاً، مع الانتباه أنه يفيد فقط إذا كان الإيجار الذي تختاره يناسب ما تتسلمه فعلاً."
        ), L(
          "Worked example: with a net income of QAR 16,000 a month, the range is QAR 4,000 to about QAR 5,300 for rent.",
          "مثال محسوب: مع دخل صافٍ 16,000 ريال قطري شهرياً يكون المدى من 4,000 إلى نحو 5,300 ريال للإيجار."
        )]
      },
      {
        h: L("Costs on top of the rent", "تكاليف فوق الإيجار"),
        list: [
          L("Electricity and water: high in summer because of air conditioning.", "الكهرباء والماء: ترتفع صيفاً بسبب التكييف."),
          L("Cooling: in some developments, a separate district-cooling charge.", "التبريد: في بعض المشاريع رسم منفصل للتبريد المركزي."),
          L("Internet and phone.", "الإنترنت والهاتف."),
          L("Parking, if the building charges for extra spaces.", "المواقف إن كان المبنى يتقاضى رسوماً على المواقف الإضافية."),
          L("Transport: a cheaper area farther away can cost more once fuel and time are counted.", "المواصلات: منطقة أرخص وأبعد قد تكلف أكثر عند احتساب الوقود والوقت."),
          L("One-off costs: deposit, any agent fee, moving, furniture.", "تكاليف لمرة واحدة: التأمين وأي رسوم وساطة والنقل والأثاث.")
        ]
      },
      {
        h: L("Make the money go further", "اجعل مالك يذهب أبعد"),
        list: [
          L("Compare areas: the same budget buys different space in different places.", "قارن بين المناطق: الميزانية نفسها تشتري مساحات مختلفة في أماكن مختلفة."),
          L("Check the price against the live listings in the area before you negotiate.", "افحص السعر مقابل الإعلانات الحية في المنطقة قبل أن تفاوض."),
          L("Ask what is included: a slightly higher rent with utilities included can cost less overall.", "اسأل عمّا هو مشمول: إيجار أعلى قليلاً مع الخدمات قد يكلف أقل في المجموع."),
          L("Think about the length of the contract: a longer term can be a reason to ask for a better price.", "فكّر في مدة العقد: المدة الأطول سبب مشروع لطلب سعر أفضل.")
        ]
      }
    ],
    faq: [
      {
        q: L("Is 30% of my income too much for rent?", "هل 30% من دخلي كثير للإيجار؟"),
        a: L("It is within the usual range. What matters is what is left after the other costs and your savings, so test it against a real month of spending.", "هي ضمن المدى المعتاد. المهم ما يبقى بعد التكاليف الأخرى وادخارك، فاختبرها على إنفاق شهر حقيقي.")
      },
      {
        q: L("Does the rent figure usually include utilities?", "هل يشمل الإيجار المعلن الخدمات عادة؟"),
        a: L("It depends on the property. Some are inclusive and others are not, so ask for the total and have it written in the contract.", "يعتمد على العقار. بعضها شامل وبعضها لا، فاسأل عن المجموع واكتبه في العقد.")
      },
      {
        q: L("How do I know what a fair rent is?", "كيف أعرف الإيجار العادل؟"),
        a: L("Compare with live listings of the same type and size in the same area. The free price check on Nerou Finder does that comparison for you.", "قارن مع الإعلانات الحية من النوع والمساحة نفسيهما في المنطقة نفسها. فحص السعر المجاني في نيرو فايندر يجري المقارنة عنك.")
      }
    ],
    links: ["/price-check", "/area-guides", "/"],
    related: ["renting-an-apartment-in-qatar", "best-areas-to-live-in-doha", "rent-or-buy-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "apartment-villa-or-compound-in-qatar",
    category: "renting",
    title: L("Apartment, Villa or Compound in Qatar: Which Is Right for You?", "شقة أم فيلا أم مجمّع سكني في قطر: ما الأنسب لك؟"),
    description: L(
      "Compare apartments, standalone villas and compound homes in Qatar: space, privacy, facilities, running costs and who each one suits.",
      "قارن بين الشقق والفلل المستقلة والمنازل في المجمّعات السكنية في قطر: المساحة والخصوصية والمرافق والتكاليف ولمن يناسب كل نوع."
    ),
    summary: L(
      "Apartments are the simplest and best placed for work and the city; standalone villas give the most space and privacy; compounds sit between them, with a gated community and shared facilities. The right choice depends on household size, commute, budget and how much you want to look after yourself.",
      "الشقق هي الأبسط والأقرب للعمل والمدينة؛ والفلل المستقلة تعطي أكبر مساحة وخصوصية؛ والمجمّعات السكنية بين الاثنين بمجتمع مسوّر ومرافق مشتركة. والاختيار الصحيح يعتمد على حجم الأسرة والمسافة والميزانية ومقدار ما تريد أن تتولاه بنفسك."
    ),
    sections: [
      {
        h: L("Apartments", "الشقق"),
        p: [L(
          "Best for singles, couples and small families who want to be near offices, the metro and restaurants. Towers often come with a gym, pool and parking, and the building handles maintenance. You get less space and less privacy than a house, and rent per square metre is usually higher in prime towers.",
          "الأنسب للأفراد والأزواج والأسر الصغيرة الذين يريدون القرب من المكاتب والمترو والمطاعم. وغالباً تأتي الأبراج مع نادٍ ومسبح ومواقف، والمبنى يتولى الصيانة. تحصل على مساحة وخصوصية أقل من المنزل، وإيجار المتر المربع عادة أعلى في الأبراج الراقية."
        )]
      },
      {
        h: L("Standalone villas", "الفلل المستقلة"),
        p: [L(
          "Best for large families who want space, a garden and a car park at the door. You are responsible for more: maintenance, cooling bills for a large house and often a longer drive. Check the age of the building and the condition of the air conditioning before you sign.",
          "الأنسب للأسر الكبيرة التي تريد مساحة وحديقة وموقفاً عند الباب. أنت مسؤول عن أكثر: الصيانة وفواتير تبريد بيت كبير، وغالباً مسافة أطول بالسيارة. افحص عمر المبنى وحالة المكيّفات قبل التوقيع."
        )]
      },
      {
        h: L("Compound homes", "المنازل في المجمّعات السكنية"),
        p: [L(
          "A compound is a gated community of villas or townhouses with shared facilities such as a pool, gym and play areas. It suits families who want house-sized space with security and neighbours, and the service charge is often part of the rent. Rules differ between compounds, for example on visitors and pets, so read them first.",
          "المجمّع السكني مجتمع مسوّر من الفلل أو التاون هاوس بمرافق مشتركة كالمسبح والنادي وأماكن اللعب. يناسب الأسر التي تريد مساحة بيت مع الأمان والجيران، وغالباً تكون رسوم الخدمة جزءاً من الإيجار. وتختلف القواعد بين المجمّعات، مثل الزوار والحيوانات الأليفة، فاقرأها أولاً."
        )]
      },
      {
        h: L("A quick way to choose", "طريقة سريعة للاختيار"),
        list: [
          L("Short commute and low maintenance: apartment.", "مسافة قصيرة وصيانة أقل: شقة."),
          L("Most space and privacy, and you do not mind driving: villa.", "أكبر مساحة وخصوصية ولا تمانع القيادة: فيلا."),
          L("Family, security and shared facilities: compound.", "أسرة وأمان ومرافق مشتركة: مجمّع سكني."),
          L("Not sure: rent for a year in the type you prefer before you commit to buying.", "لست متأكداً: استأجر سنة من النوع الذي تفضله قبل أن تلتزم بالشراء.")
        ]
      }
    ],
    faq: [
      {
        q: L("Which costs less to run, an apartment or a villa?", "أيهما أقل تكلفة تشغيل، الشقة أم الفيلا؟"),
        a: L("A smaller home is usually cheaper to cool and maintain. A villa's larger space costs more to run, so compare the total monthly cost, not the rent alone.", "المنزل الأصغر أرخص عادة في التبريد والصيانة. ومساحة الفيلا الأكبر تكلف أكثر في التشغيل، فقارن التكلفة الشهرية الكلية لا الإيجار وحده.")
      },
      {
        q: L("Are compounds only for families?", "هل المجمّعات للعائلات فقط؟"),
        a: L("Many are, but rules differ by compound and landlord. Ask before you visit so you do not waste a trip.", "كثير منها كذلك، لكن القواعد تختلف حسب المجمّع والمؤجر. اسأل قبل الزيارة حتى لا تضيع رحلتك.")
      },
      {
        q: L("Can I find all three types on Nerou Finder?", "هل أجد الأنواع الثلاثة في نيرو فايندر؟"),
        a: L("Yes, search by property type and area. The listings are from verified agents and companies.", "نعم، ابحث بنوع العقار والمنطقة. والإعلانات من وسطاء وشركات موثّقة.")
      }
    ],
    links: ["/", "/area-guides", "/price-check"],
    related: ["best-areas-to-live-in-doha", "how-much-rent-can-you-afford-in-qatar", "qatar-property-listing-terms-explained"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "qatar-property-listing-terms-explained",
    category: "living",
    title: L("Qatar Property Listing Terms Explained: A Plain-Language Glossary", "مصطلحات الإعلانات العقارية في قطر: شرح مبسّط"),
    description: L(
      "What \"family only\", \"semi-furnished\", \"Qatar Cool\", freehold, usufruct, Tawtheeq and other terms in Qatar property ads really mean.",
      "ماذا تعني «للعائلات فقط» و«شبه مفروش» و«قطر كول» والتملك الحر وحق الانتفاع وتوثيق وغيرها في الإعلانات العقارية في قطر."
    ),
    summary: L(
      "Property ads in Qatar use a few terms that are not obvious to newcomers: who the home is let to, what \"furnished\" includes, how cooling is charged, and the difference between owning a property outright and holding a right to use it. When a term matters to you, ask what it means for that property and get it in writing.",
      "تستخدم الإعلانات العقارية في قطر مصطلحات قليلة لا تكون واضحة للقادمين الجدد: لمن يؤجَّر المنزل، وماذا يشمل «المفروش»، وكيف يُحتسب التبريد، والفرق بين تملك العقار تملكاً كاملاً وحيازة حق استخدامه. وحين يهمك مصطلح اسأل عن معناه لذلك العقار نفسه واحصل عليه كتابةً."
    ),
    sections: [
      {
        h: L("Terms you meet when renting", "مصطلحات تصادفها عند الإيجار"),
        list: [
          L("Family only / bachelors: some buildings and compounds let only to families, or only to single tenants. Rules differ, so ask the landlord.", "للعائلات فقط / للعزاب: بعض المباني والمجمّعات تؤجر للعائلات فقط أو للعزاب فقط. القواعد تختلف، فاسأل المؤجر."),
          L("Furnished, semi-furnished, unfurnished: \"semi\" usually means some items such as wardrobes, kitchen appliances or air conditioners. Always ask for a list.", "مفروش، شبه مفروش، غير مفروش: «شبه» تعني عادة بعض الأشياء كالخزائن وأجهزة المطبخ والمكيّفات. اطلب دائماً قائمة بها."),
          L("Maid's room: a small extra room, usually near the kitchen.", "غرفة خادمة: غرفة إضافية صغيرة، غالباً قرب المطبخ."),
          L("Qatar Cool / district cooling: central chilled-water cooling used in some developments, usually billed separately or in the service charge.", "قطر كول / التبريد المركزي: تبريد مركزي بالماء المثلج في بعض المشاريع، ويُحتسب عادة مستقلاً أو ضمن رسوم الخدمة."),
          L("Compound: a gated community of villas or townhouses with shared facilities.", "مجمّع سكني: مجتمع مسوّر من الفلل أو التاون هاوس بمرافق مشتركة."),
          L("Service charge: fees for maintaining shared areas, paid by the owner or the tenant depending on the contract.", "رسوم الخدمة: رسوم صيانة المناطق المشتركة، يدفعها المالك أو المستأجر حسب العقد."),
          L("BUA and plot area: BUA is the built-up area; the plot is the land. A villa's two figures can be very different.", "المساحة المبنية ومساحة الأرض: المبنية هي مساحة البناء، والأرض هي القطعة. وقد يختلف الرقمان كثيراً في الفيلا."),
          L("Tawtheeq: the electronic registration of tenancy contracts.", "توثيق: التسجيل الإلكتروني لعقود الإيجار.")
        ]
      },
      {
        h: L("Terms you meet when buying", "مصطلحات تصادفها عند الشراء"),
        list: [
          L("Freehold: full ownership of the property, available to non-Qataris only in designated zones.", "تملك حر: ملكية كاملة للعقار، متاحة لغير القطريين في مناطق محددة فقط."),
          L("Usufruct: the right to use and live in a property for a long fixed period, without owning the land.", "حق الانتفاع: حق استخدام العقار والسكن فيه لمدة طويلة محددة دون ملكية الأرض."),
          L("Off-plan: a property sold before it is built or finished.", "على المخطط: عقار يُباع قبل بنائه أو اكتماله."),
          L("Handover: the day the keys and the unit's condition are formally passed to you.", "التسليم: اليوم الذي تُسلَّم فيه المفاتيح وحالة الوحدة رسمياً.")
        ]
      }
    ],
    faq: [
      {
        q: L("What does \"semi-furnished\" include?", "ماذا يشمل «شبه مفروش»؟"),
        a: L("There is no single rule. It often covers kitchen appliances, wardrobes and air conditioners, but ask for the exact list and have it written in the contract.", "لا توجد قاعدة واحدة. غالباً يشمل أجهزة المطبخ والخزائن والمكيّفات، لكن اطلب القائمة بدقة واكتبها في العقد.")
      },
      {
        q: L("Is cooling included in the rent?", "هل التبريد مشمول في الإيجار؟"),
        a: L("In some developments it is, in others it is billed separately. Ask before you sign and compare the total monthly cost.", "في بعض المشاريع نعم وفي غيرها يُحتسب منفصلاً. اسأل قبل التوقيع وقارن التكلفة الشهرية الكلية.")
      },
      {
        q: L("Can foreigners own property in Qatar?", "هل يستطيع الأجانب تملك العقار في قطر؟"),
        a: L("Yes, in designated zones, either as freehold or as a long-term right of use. See our guide to buying property as a foreigner.", "نعم في مناطق محددة، إما تملكاً حراً أو بحق استخدام طويل الأجل. اطلع على دليل شراء العقار للأجانب.")
      }
    ],
    links: ["/", "/area-guides"],
    related: ["buying-property-in-qatar-as-a-foreigner", "rental-contract-checklist-qatar", "apartment-villa-or-compound-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "best-areas-to-live-in-doha",
    category: "living",
    title: L("Best Areas to Live in Doha: A Guide by Lifestyle", "أفضل مناطق السكن في الدوحة: دليل حسب أسلوب الحياة"),
    description: L(
      "Where to live in Doha for your lifestyle: West Bay, The Pearl, Lusail, Al Sadd, Msheireb and Al Waab compared in plain words.",
      "أين تسكن في الدوحة حسب أسلوب حياتك: مقارنة مبسّطة بين الخليج الغربي واللؤلؤة ولوسيل والسد ومشيرب والوعب."
    ),
    summary: L(
      "There is no single best area, only the best one for how you live. West Bay suits those who work in the towers, The Pearl a waterfront lifestyle, Lusail a new planned city, Al Sadd and Msheireb a central and connected life, and Al Waab families who want villas and compounds near Aspire. Start from your commute and budget, then visit at rush hour.",
      "لا توجد منطقة أفضل بإطلاق، بل الأفضل لطريقة عيشك. الخليج الغربي لمن يعمل في الأبراج، واللؤلؤة لأسلوب الحياة على الواجهة البحرية، ولوسيل لمدينة جديدة مخططة، والسد ومشيرب لحياة مركزية متصلة، والوعب للأسر التي تريد فللاً ومجمّعات قرب أسباير. ابدأ من مسافة عملك وميزانيتك ثم زر المنطقة وقت الذروة."
    ),
    sections: [
      {
        h: L("By lifestyle", "حسب أسلوب الحياة"),
        list: [
          L("Work in the towers and want a short commute: West Bay.", "تعمل في الأبراج وتريد مسافة قصيرة: الخليج الغربي."),
          L("A waterfront, marina and café lifestyle: The Pearl.", "أسلوب حياة على الواجهة البحرية والمارينا والمقاهي: اللؤلؤة."),
          L("A new, planned city with modern buildings and the tram: Lusail.", "مدينة جديدة مخططة بمبانٍ حديثة والترام: لوسيل."),
          L("Established, central and full of shops and restaurants: Al Sadd.", "حيّ راسخ ومركزي مليء بالمتاجر والمطاعم: السد."),
          L("A modern downtown with the metro at the door: Msheireb.", "وسط مدينة حديث والمترو عند الباب: مشيرب."),
          L("Villas and compounds near Aspire and schools: Al Waab.", "فلل ومجمّعات قرب أسباير والمدارس: الوعب.")
        ]
      },
      {
        h: L("How to compare areas properly", "كيف تقارن المناطق بشكل صحيح"),
        list: [
          L("Test the commute at the hours you will actually travel, not at midday.", "جرّب المسافة في الساعات التي ستسافر فيها فعلاً لا وقت الظهيرة."),
          L("Compare the rent per square metre, not only the rent: the price check shows the typical figure.", "قارن إيجار المتر المربع لا الإيجار وحده: فحص السعر يبيّن الرقم المعتاد."),
          L("Walk the area in the evening: noise, parking, lighting, shops and the walk to the metro or tram.", "امشِ في المنطقة مساءً: الضجيج والمواقف والإنارة والمتاجر والمسافة إلى المترو أو الترام."),
          L("Ask residents or the agent what the area is like in summer.", "اسأل السكان أو الوسيط كيف تبدو المنطقة صيفاً.")
        ]
      },
      {
        h: L("Read the full guide to each area", "اقرأ الدليل الكامل لكل منطقة"),
        p: [L(
          "Each area has its own guide with its character, landmarks and typical homes, alongside the live prices on Nerou Finder.",
          "لكل منطقة دليلها الخاص بطابعها ومعالمها ومنازلها المعتادة، إلى جانب الأسعار الحية في نيرو فايندر."
        )]
      }
    ],
    faq: [
      {
        q: L("Which area is best for families?", "ما أفضل منطقة للعائلات؟"),
        a: L("It depends on the schools and your commute. Many families look at villa and compound areas such as Al Waab, and at family-friendly towers elsewhere.", "يعتمد على المدارس ومسافة العمل. كثير من الأسر تنظر إلى مناطق الفلل والمجمّعات مثل الوعب، وإلى الأبراج المناسبة للعائلات في مناطق أخرى.")
      },
      {
        q: L("Which area is the cheapest?", "أي منطقة هي الأرخص؟"),
        a: L("Prices change with supply, so check the live figures for the area and type you want rather than a fixed ranking.", "الأسعار تتغير مع المعروض، فاطلع على الأرقام الحية للمنطقة والنوع الذي تريده بدل ترتيب ثابت.")
      },
      {
        q: L("Is it better to live close to the metro?", "هل الأفضل أن أسكن قرب المترو؟"),
        a: L("If you travel to areas the lines serve, yes. If you drive, parking and road access matter more.", "إن كنت تسافر إلى مناطق تخدمها الخطوط فنعم. وإن كنت تقود فالمواقف وسهولة الطرق أهم.")
      }
    ],
    links: ["/areas/west-bay", "/areas/the-pearl", "/areas/lusail-city", "/areas/al-sadd", "/areas/msheireb", "/areas/al-waab", "/area-guides"],
    related: ["apartment-villa-or-compound-in-qatar", "how-much-rent-can-you-afford-in-qatar", "moving-to-qatar-housing-checklist"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "moving-to-qatar-housing-checklist",
    category: "living",
    title: L("Moving to Qatar: A Housing Checklist for Your First Weeks", "الانتقال إلى قطر: قائمة السكن لأسابيعك الأولى"),
    description: L(
      "What to do about housing when you move to Qatar: temporary stay, finding a home, the contract, utilities and what to ask your employer.",
      "ماذا تفعل بشأن السكن عند الانتقال إلى قطر: الإقامة المؤقتة والبحث عن منزل والعقد والخدمات وما تسأل عنه صاحب العمل."
    ),
    summary: L(
      "Plan a short temporary stay, ask your employer what housing support you get, shortlist two or three areas by commute, view homes in person, sign a written contract and then set up electricity, water and internet. Do not rush the lease because you feel pressed: a short stay gives you time to choose well.",
      "خطّط لإقامة مؤقتة قصيرة، واسأل صاحب العمل عن دعم السكن الذي تحصل عليه، واختر منطقتين أو ثلاثاً حسب المسافة، وعاين المنازل بنفسك، ووقّع عقداً مكتوباً ثم فعّل الكهرباء والماء والإنترنت. لا تستعجل عقد الإيجار لأنك تشعر بالضغط: الإقامة القصيرة تمنحك وقتاً للاختيار الجيد."
    ),
    sections: [
      {
        h: L("Before you arrive", "قبل وصولك"),
        list: [
          L("Ask your employer whether there is a housing allowance or company housing, and what the limit is.", "اسأل صاحب العمل هل هناك بدل سكن أو سكن للشركة وما سقفه."),
          L("Book a short stay for the first weeks, such as a hotel apartment, so you can view homes in person.", "احجز إقامة قصيرة لأول الأسابيع، كشقة فندقية، لتعاين المنازل بنفسك."),
          L("Choose two or three areas by commute and school, using the area guides.", "اختر منطقتين أو ثلاثاً حسب مسافة العمل والمدرسة، مستعيناً بأدلة المناطق."),
          L("Set a rent budget with the afford-rent guide.", "حدّد ميزانية الإيجار بدليل «كم إيجاراً تتحمل».")
        ]
      },
      {
        h: L("In the first weeks", "في الأسابيع الأولى"),
        list: [
          L("View at least three homes in person and compare with live prices in the area.", "عاين ثلاثة منازل على الأقل بنفسك وقارنها بالأسعار الحية في المنطقة."),
          L("Read the contract with the checklist and have the contract registered.", "اقرأ العقد بقائمة الفحص وتأكد من توثيقه."),
          L("Open your electricity and water account with Kahramaa and order internet from a provider.", "افتح حساب الكهرباء والماء لدى «كهرماء» واطلب الإنترنت من مزوّد الخدمة."),
          L("Photograph the unit on day one and keep the photos with the contract.", "صوّر الوحدة في اليوم الأول واحتفظ بالصور مع العقد.")
        ]
      },
      {
        h: L("Things people forget", "أشياء ينساها الناس"),
        list: [
          L("Summer: check the air conditioning and the cooling bill before you sign.", "الصيف: افحص المكيّفات وفاتورة التبريد قبل التوقيع."),
          L("Pets: ask whether the building or compound allows them.", "الحيوانات الأليفة: اسأل هل يسمح بها المبنى أو المجمّع."),
          L("Visitors and parking rules, especially in compounds and towers.", "قواعد الزوار والمواقف، خاصة في المجمّعات والأبراج."),
          L("The notice period if your plans change in the first year.", "مدة الإخطار إذا تغيرت خططك في السنة الأولى.")
        ]
      }
    ],
    faq: [
      {
        q: L("How long should I stay in temporary housing?", "كم أبقى في السكن المؤقت؟"),
        a: L("Long enough to view several homes in person, often a few weeks. Rushing into a lease is the most common regret.", "مدة تكفي لمعاينة عدة منازل بنفسك، وغالباً بضعة أسابيع. الاستعجال في عقد الإيجار هو الندم الأكثر شيوعاً.")
      },
      {
        q: L("Should I choose a home before choosing a school?", "هل أختار المنزل قبل المدرسة؟"),
        a: L("If you have children, decide on the school first and look for homes within a reasonable commute of it.", "إن كان لديك أطفال فاحسم المدرسة أولاً وابحث عن منازل على مسافة معقولة منها.")
      },
      {
        q: L("Where can I find verified listings?", "أين أجد إعلانات موثّقة؟"),
        a: L("On Nerou Finder, agents' licences are verified and listing availability is confirmed before publishing.", "في نيرو فايندر تُوثَّق رخص الوسطاء ويُتأكد من توفر الإعلان قبل نشره.")
      }
    ],
    links: ["/", "/area-guides", "/price-check"],
    related: ["renting-an-apartment-in-qatar", "best-areas-to-live-in-doha", "how-much-rent-can-you-afford-in-qatar"],
    published: "2026-11-16",
    updated: "2026-11-16"
  },

  {
    slug: "how-to-choose-a-real-estate-agent-qatar",
    category: "living",
    title: L("How to Choose a Real Estate Agent in Qatar", "كيف تختار وسيطاً عقارياً في قطر"),
    description: L(
      "What to check before you work with a property agent in Qatar: licence, area knowledge, response time, fees in writing and reviews.",
      "ما الذي تفحصه قبل التعامل مع وسيط عقاري في قطر: الرخصة ومعرفة المنطقة وسرعة الرد والرسوم المكتوبة والتقييمات."
    ),
    summary: L(
      "A good agent is licensed, knows the area you want, answers quickly, puts fees in writing and shows you only what is really available. Ask for the licence number, check it, read real client reviews and never pay before you have seen the property and the contract.",
      "الوسيط الجيد مرخّص ويعرف المنطقة التي تريدها ويرد بسرعة ويكتب الرسوم ولا يعرض عليك إلا ما هو متاح فعلاً. اطلب رقم الرخصة وتحقق منه واقرأ تقييمات عملاء حقيقية ولا تدفع قبل أن ترى العقار والعقد."
    ),
    sections: [
      {
        h: L("Five checks", "خمسة فحوص"),
        list: [
          L("Licence: ask for the number and check it with the relevant authority.", "الرخصة: اطلب الرقم وتحقق منه لدى الجهة المختصة."),
          L("Knowledge: a good agent can tell you the usual price range in the area and why one unit costs more than another.", "المعرفة: الوسيط الجيد يعرف المدى المعتاد للسعر في المنطقة ولماذا تكلف وحدة أكثر من أخرى."),
          L("Response: how fast and how clearly they answer your first messages is how they will behave later.", "الرد: سرعة الرد ووضوحه على رسائلك الأولى هو سلوكهم لاحقاً."),
          L("Fees: ask what you pay and when, and get it in writing before you start.", "الرسوم: اسأل ما الذي تدفعه ومتى، واكتب ذلك قبل أن تبدأ."),
          L("Honesty: a real agent shows you units that are available and tells you the weak points of a property too.", "الصدق: الوسيط الحقيقي يعرض وحدات متاحة ويخبرك بنقاط ضعف العقار أيضاً.")
        ]
      },
      {
        h: L("What to look for on a profile", "ماذا تنظر في صفحة الوسيط"),
        list: [
          L("A verified badge: it means documents were checked by the platform.", "شارة التوثيق: تعني أن المنصة فحصت الوثائق."),
          L("Live listings that match what you want, with real photos.", "إعلانات حية تطابق ما تريد وبصور حقيقية."),
          L("Reviews from real clients, and how the agent replies.", "تقييمات من عملاء حقيقيين وكيف يرد الوسيط."),
          L("Reply-time badges, shown when an agent has enough answered enquiries to measure.", "شارات سرعة الرد، وتظهر عند وجود استفسارات مجابة كافية للقياس.")
        ]
      },
      {
        h: L("Red flags", "علامات الخطر"),
        list: [
          L("Asks for money before a viewing.", "يطلب مالاً قبل المعاينة."),
          L("Cannot give a licence number.", "لا يستطيع إعطاء رقم رخصة."),
          L("Shows only one unit and pushes you to decide today.", "يعرض وحدة واحدة فقط ويضغط عليك لتقرر اليوم."),
          L("Refuses to put fees or promises in writing.", "يرفض كتابة الرسوم أو الوعود.")
        ]
      }
    ],
    faq: [
      {
        q: L("Does the agent charge the tenant or the landlord?", "هل يتقاضى الوسيط من المستأجر أم من المؤجر؟"),
        a: L("It is agreed case by case. Ask before the first viewing so there is no surprise, and put it in writing.", "يُتفق عليه في كل حالة. اسأل قبل أول معاينة حتى لا تكون هناك مفاجأة، واكتبه.")
      },
      {
        q: L("Can I use more than one agent?", "هل أستطيع التعامل مع أكثر من وسيط؟"),
        a: L("Yes, unless you have signed an exclusive agreement. Read any agreement before you sign it.", "نعم، ما لم توقّع اتفاقية حصرية. اقرأ أي اتفاقية قبل توقيعها.")
      },
      {
        q: L("How do I check an agent on Nerou Finder?", "كيف أتحقق من وسيط في نيرو فايندر؟"),
        a: L("Open the agent's public page to see the verified badge, live listings, reviews and reply-time badge.", "افتح الصفحة العامة للوسيط لترى شارة التوثيق والإعلانات الحية والتقييمات وشارة سرعة الرد.")
      }
    ],
    links: ["/", "/price-check"],
    related: ["rental-scams-qatar", "renting-an-apartment-in-qatar", "buying-process-in-qatar-step-by-step"],
    published: "2026-11-16",
    updated: "2026-11-16"
  }
];
