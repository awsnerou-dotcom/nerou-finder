// The Terms of Use and Privacy Policy of Nerou Finder (English and Arabic), and the rule for replacing
// the older short versions that were seeded earlier.
//
// Formatting used by the Legal page: a blank line starts a paragraph; a line that begins "1. " ... "20. "
// is a heading; a line that begins "- " is a bullet.
//
// These texts describe what the platform really does. They were drafted carefully but are NOT a
// substitute for review by a qualified Qatari lawyer (see legalReviewStatus on each document).

import type { LegalDocument } from "../types.js";
import { COMPANY } from "../companyInfo.js";

export const LEGAL_DOC_DATE = "2026-11-11";
const ENTITY_EN = `${COMPANY.nameEn} ("Nerou", "we", "us")`;
const ENTITY_AR = `${COMPANY.nameAr} («نيرو» أو «نحن»)`;
const IDENT_EN = `Commercial Registration (CR) No. ${COMPANY.crNumber}, ${COMPANY.addressEn}`;
const IDENT_AR = `السجل التجاري رقم ${COMPANY.crNumber}، ${COMPANY.addressAr}`;

// ---------------------------------------------------------------------------------------------
// Terms of Use
// ---------------------------------------------------------------------------------------------
export const TERMS_EN = [
  `Terms of Use of Nerou Finder`,
  `Last updated: 11 November 2026`,
  ``,
  `1. Who we are`,
  `Nerou Finder (the "Platform") is owned and operated by ${ENTITY_EN}, ${IDENT_EN}. Contact: ${COMPANY.email}.`,
  `By visiting the Platform, creating an account or using any of its features you agree to these Terms of Use. If you do not agree, please do not use the Platform.`,
  ``,
  `2. What Nerou Finder is - and what it is not`,
  `Nerou Finder is an online platform dedicated to displaying properties, so that advertisers can reach the people who are interested in them and so that interested people can contact those advertisers directly.`,
  `Nerou:`,
  `- does not negotiate prices, terms or conditions on behalf of anyone;`,
  `- does not mediate, and does not act as a broker, agent, intermediary or representative of any advertiser, owner, seller, landlord, buyer, tenant or investor;`,
  `- does not take part in viewings, offers, contracts, handovers or payments between advertisers and interested people, and does not receive, hold or transfer money for any transaction;`,
  `- does not charge or receive any brokerage commission, finder's fee or share of the value of any sale, lease or other transaction that follows contact that began on the Platform;`,
  `- is not the owner, seller, lessor, developer or landlord of the listed properties, and is not a party to any agreement between users.`,
  `Any negotiation, agreement or payment is solely between the advertiser and the interested person, and each of them is responsible for it.`,
  `Nerou earns its revenue only from the fees that advertisers pay to use the Platform (subscriptions and optional promotion features, described in the Platform & SaaS Terms and the Advertising Policy). These fees do not depend on whether any transaction takes place.`,
  ``,
  `3. Who may use the Platform`,
  `You must be at least 18 years old and legally capable of entering into this agreement. Advertiser accounts (brokers, agencies and developers) may be opened only by people authorised to act for the business who hold the licences that Qatari law requires for the activity, as set out in the Listing Provider Terms.`,
  ``,
  `4. Accounts`,
  `- Give accurate information and keep it up to date.`,
  `- Keep your password secret. You are responsible for everything done through your account; tell us at once if you suspect it has been used without your permission.`,
  `- We may ask for identity, licence or business documents before an advertiser account is activated, and at any time afterwards.`,
  ``,
  `5. If you are looking for a property`,
  `- Listings are published by advertisers, not by Nerou. We check advertisers' documents and ask them to keep availability current, but this is a screening measure, not a guarantee. Nerou does not guarantee that any listing is accurate, complete, available or correctly priced, or that any advertiser is reliable.`,
  `- Before you pay, sign or commit to anything, check the property, the owner's title, the advertiser's licence and the contract with the competent authorities or a licensed professional. Nerou never asks you to pay for a property, a deposit or a fee through the Platform; pay only against proper documents and in accordance with Qatari law.`,
  `- When you send an inquiry, request a viewing, or press Call or WhatsApp on a listing, the details you provide are passed to that advertiser, who will contact you. Nerou takes no part in what follows.`,
  `- Search results, comparisons and AI-assisted suggestions are for information only (see the AI Disclaimer).`,
  ``,
  `6. If you advertise on the Platform`,
  `- List only what you are entitled to list, truthfully and in line with the Listing Provider Terms: one unit, one listing; accurate price, size and photos that you own or have permission to use; mark a property unavailable as soon as it is let or sold.`,
  `- Do not mislead, discriminate or advertise anything unlawful.`,
  `- Answer inquiries promptly and use the details people give you only to answer them. No spam, and no sharing of inquirers' details with others (Qatar Law No. 13 of 2016 on Personal Data Privacy Protection).`,
  `- Comply with Qatari law, including the rules on real-estate brokerage and advertising.`,
  `- You alone are responsible for your negotiations, contracts, fees, commissions and taxes with your customers. If you charge your customers a commission or a fee, that is between you and them; Nerou has no share in it and no responsibility for it.`,
  ``,
  `7. Fees`,
  `Searching and contacting advertisers is free. Advertisers pay Platform fees according to their plan and any optional promotion they choose, on the terms of the Platform & SaaS Terms. These fees are for using the Platform, never for any deal.`,
  ``,
  `8. Sales Desk and advertisers' own client lists`,
  `The Sales Desk is a set of tools that lets an advertiser manage its own clients, follow-ups, viewings and records. The information an advertiser enters belongs to that advertiser, who is responsible for having the right to hold it. Nerou does not contact those clients. Commission figures recorded there are the advertiser's own records and do not mean that Nerou receives or handles any commission.`,
  ``,
  `9. Content you post`,
  `You keep your rights in the content you post (listings, photos, reviews, messages). You give Nerou a non-exclusive licence to display, store and reproduce it on the Platform and in our promotion of the Platform, for as long as it is posted. You promise that it is lawful, accurate and does not infringe anyone's rights. Reviews must be honest and based on real experience.`,
  ``,
  `10. What is not allowed`,
  `- Fraudulent, misleading or duplicate listings, or listings of properties you may not advertise.`,
  `- Impersonating anyone, or sharing or selling accounts or credentials.`,
  `- Copying or extracting data from the Platform in bulk (scraping), or overloading or attacking it.`,
  `- Spam, harassment, hate speech, or content contrary to Qatari law or public morals.`,
  `- Using the Platform to collect people's details for any purpose other than responding to their inquiry.`,
  ``,
  `11. Moderation`,
  `We may review, flag, pause or remove a listing or content, and suspend or close an account, if we believe these Terms or the law have been breached, if a listing appears out of date, or to protect users. Where reasonable we will tell you why. Anyone can report a listing from the Platform.`,
  ``,
  `12. Intellectual property`,
  `The Platform, its software, design, name and logo belong to Nerou or its licensors. We give you a limited, personal, revocable licence to use it as intended. Advertisers' photos and descriptions remain theirs.`,
  ``,
  `13. Third-party services and links`,
  `The Platform may use or link to services we do not control (for example maps, messaging apps and AI services). We are not responsible for them or for their terms.`,
  ``,
  `14. No warranty`,
  `The Platform is provided "as is" and "as available". We do not promise that it will be uninterrupted or error-free. Nothing on the Platform is financial, investment, legal or valuation advice.`,
  ``,
  `15. Limitation of liability`,
  `To the maximum extent permitted by Qatari law, Nerou is not liable for the dealings between users, for inaccurate, outdated or misleading listings, for losses arising from relying on a listing or on contact with an advertiser, or for indirect or consequential loss. Nothing in these Terms excludes liability that cannot be excluded by law.`,
  ``,
  `16. Indemnity`,
  `An advertiser will compensate Nerou for losses and claims arising from that advertiser's listings, content, dealings with customers, or breach of these Terms or the law.`,
  ``,
  `17. Suspension and termination`,
  `You may stop using the Platform and close your account at any time. We may suspend or end access as described in clause 11. Clauses that by their nature should continue (for example 9, 15, 16 and 19) will continue.`,
  ``,
  `18. Changes`,
  `We may update these Terms. The current version and its date are always shown on this page, and we will give notice of important changes on the Platform. Continuing to use the Platform after a change means you accept it.`,
  ``,
  `19. Governing law and disputes`,
  `These Terms are governed by the laws of the State of Qatar. We encourage you to contact us first so that we can try to resolve any complaint amicably. Any dispute that cannot be resolved that way falls under the jurisdiction of the competent courts in Doha, Qatar.`,
  ``,
  `20. Contact`,
  `${COMPANY.nameEn}, ${IDENT_EN}. Email: ${COMPANY.email}.`
].join("\n");

export const TERMS_AR = [
  `شروط استخدام منصة نيرو فايندر`,
  `آخر تحديث: 11 نوفمبر 2026`,
  ``,
  `1. من نحن`,
  `منصة نيرو فايندر («المنصة») مملوكة ومُشغَّلة من قبل ${ENTITY_AR}، ${IDENT_AR}. للتواصل: ${COMPANY.email}.`,
  `بزيارتك للمنصة أو إنشائك حسابًا أو استخدامك لأي من خدماتها فإنك توافق على شروط الاستخدام هذه. وإن لم توافق عليها فيرجى عدم استخدام المنصة.`,
  ``,
  `2. ما هي نيرو فايندر وما ليست عليه`,
  `نيرو فايندر منصة إلكترونية تُعنى بعرض العقارات، لتمكين المعلنين من الوصول إلى المهتمين بها، وتمكين المهتمين من التواصل المباشر مع المعلنين.`,
  `وعليه فإن «نيرو»:`,
  `- لا تتفاوض على الأسعار أو الشروط أو الأحكام نيابةً عن أي طرف؛`,
  `- لا تتوسط، ولا تعمل كوسيط أو سمسار أو وكيل أو ممثل لأي معلن أو مالك أو بائع أو مؤجر أو مشترٍ أو مستأجر أو مستثمر؛`,
  `- لا تشارك في المعاينات أو العروض أو العقود أو التسليم أو المدفوعات بين المعلنين والمهتمين، ولا تستلم أو تحتفظ بأو تحوّل أموالًا في أي صفقة؛`,
  `- لا تتقاضى ولا تستلم أي عمولة وساطة أو أجر سعي أو نسبة من قيمة أي بيع أو إيجار أو صفقة تنشأ عن تواصل بدأ عبر المنصة؛`,
  `- ليست مالكة أو بائعة أو مؤجرة أو مطورة للعقارات المعروضة، وليست طرفًا في أي اتفاق بين المستخدمين.`,
  `أي تفاوض أو اتفاق أو دفع يتم حصرًا بين المعلن والمهتم، ويتحمل كل منهما مسؤوليته.`,
  `تحصل «نيرو» على إيراداتها فقط من الرسوم التي يدفعها المعلنون لاستخدام المنصة (الاشتراكات وخدمات الترويج الاختيارية الموضحة في شروط المنصة والخدمة السحابية وسياسة الإعلانات)، ولا ترتبط هذه الرسوم بإتمام أي صفقة من عدمه.`,
  ``,
  `3. من يحق له استخدام المنصة`,
  `يجب ألا يقل عمرك عن 18 عامًا وأن تتمتع بالأهلية القانونية للتعاقد. ولا يجوز فتح حسابات المعلنين (الوسطاء والمكاتب والمطورين) إلا لمن يملك صلاحية التصرف باسم المنشأة ويحمل التراخيص التي يشترطها القانون القطري للنشاط، كما هو موضح في شروط مقدمي العقارات.`,
  ``,
  `4. الحسابات`,
  `- قدّم معلومات صحيحة وحافظ على تحديثها.`,
  `- حافظ على سرية كلمة المرور. أنت مسؤول عن كل ما يتم عبر حسابك، وأبلغنا فورًا إن اشتبهت باستخدامه دون إذنك.`,
  `- يجوز أن نطلب مستندات هوية أو ترخيص أو سجل تجاري قبل تفعيل حساب المعلن، وفي أي وقت بعد ذلك.`,
  ``,
  `5. إن كنت تبحث عن عقار`,
  `- الإعلانات ينشرها المعلنون لا «نيرو». نراجع مستندات المعلنين ونطلب منهم تحديث توفر العقارات، لكن ذلك إجراء فحص وليس ضمانًا. ولا تضمن «نيرو» أن أي إعلان دقيق أو كامل أو متاح أو مسعّر بشكل صحيح، ولا أن أي معلن جدير بالثقة.`,
  `- قبل أن تدفع أو توقّع أو تلتزم بأي شيء، تحقق من العقار وملكية المالك وترخيص المعلن والعقد لدى الجهات المختصة أو لدى مختص مرخّص. ولا تطلب «نيرو» منك أبدًا دفع ثمن عقار أو عربون أو رسوم عبر المنصة؛ ادفع فقط مقابل مستندات سليمة ووفق القانون القطري.`,
  `- عند إرسالك استفسارًا أو طلب معاينة أو ضغطك على الاتصال أو واتساب في إعلان، تُرسل البيانات التي تقدمها إلى ذلك المعلن ليتواصل معك. ولا تشارك «نيرو» في ما يلي ذلك.`,
  `- نتائج البحث والمقارنات والاقتراحات المدعومة بالذكاء الاصطناعي للاسترشاد فقط (راجع إخلاء مسؤولية الذكاء الاصطناعي).`,
  ``,
  `6. إن كنت تعلن في المنصة`,
  `- لا تعلن إلا عمّا يحق لك الإعلان عنه، بصدق ووفق شروط مقدمي العقارات: وحدة واحدة، إعلان واحد؛ سعر ومساحة دقيقان وصور تملكها أو مأذون لك باستخدامها؛ وعلّم العقار غير متاح فور تأجيره أو بيعه.`,
  `- لا تضلل ولا تميّز ولا تعلن عن أي شيء مخالف للقانون.`,
  `- ردّ على الاستفسارات بسرعة ولا تستخدم بيانات المستفسرين إلا للرد عليهم. ويُمنع إرسال الرسائل المزعجة أو مشاركة بيانات المستفسرين مع غيرك (القانون القطري رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية).`,
  `- التزم بالقانون القطري، ومنه الأحكام المنظمة للوساطة العقارية والإعلان.`,
  `- أنت وحدك المسؤول عن تفاوضك وعقودك ورسومك وعمولاتك وضرائبك مع عملائك. وإن تقاضيت من عملائك عمولة أو أجرًا فهذا بينك وبينهم، ولا نصيب لـ«نيرو» فيه ولا مسؤولية عنه.`,
  ``,
  `7. الرسوم`,
  `البحث والتواصل مع المعلنين مجاني. ويدفع المعلنون رسوم المنصة بحسب باقتهم وأي ترويج اختياري يختارونه، وفق شروط المنصة والخدمة السحابية. وهذه الرسوم مقابل استخدام المنصة، وليست أبدًا مقابل أي صفقة.`,
  ``,
  `8. مكتب المبيعات وقوائم العملاء الخاصة بالمعلنين`,
  `مكتب المبيعات أدوات تتيح للمعلن إدارة عملائه ومتابعاته ومعايناته وسجلاته. والمعلومات التي يدخلها المعلن ملك له وهو المسؤول عن أحقيته في حيازتها. ولا تتواصل «نيرو» مع هؤلاء العملاء. وأرقام العمولات المسجلة فيه سجلات خاصة بالمعلن ولا تعني أن «نيرو» تتلقى أو تتولى أي عمولة.`,
  ``,
  `9. المحتوى الذي تنشره`,
  `تحتفظ بحقوقك في المحتوى الذي تنشره (الإعلانات والصور والتقييمات والرسائل). وتمنح «نيرو» ترخيصًا غير حصري لعرضه وتخزينه ونسخه في المنصة وفي الترويج لها طوال مدة نشره. وتتعهد بأنه مشروع ودقيق ولا ينتهك حقوق أحد. ويجب أن تكون التقييمات صادقة ومبنية على تجربة حقيقية.`,
  ``,
  `10. المحظورات`,
  `- الإعلانات الاحتيالية أو المضللة أو المكررة، أو الإعلان عن عقارات لا يحق لك الإعلان عنها.`,
  `- انتحال شخصية الغير، أو مشاركة الحسابات أو بياناتها أو بيعها.`,
  `- نسخ بيانات المنصة أو استخراجها بكميات كبيرة، أو إثقالها أو مهاجمتها.`,
  `- الرسائل المزعجة والمضايقة وخطاب الكراهية والمحتوى المخالف للقانون القطري أو الآداب العامة.`,
  `- استخدام المنصة لجمع بيانات الناس لأي غرض غير الرد على استفسارهم.`,
  ``,
  `11. الإشراف`,
  `يجوز لنا مراجعة إعلان أو محتوى أو تمييزه أو إيقافه أو إزالته، وتعليق حساب أو إغلاقه، إذا رأينا أن هذه الشروط أو القانون قد خولفا، أو أن الإعلان لم يعد محدّثًا، أو لحماية المستخدمين. وسنبيّن لك السبب متى كان ذلك معقولًا. ويمكن لأي شخص الإبلاغ عن أي إعلان من المنصة.`,
  ``,
  `12. الملكية الفكرية`,
  `المنصة وبرمجياتها وتصميمها واسمها وشعارها ملك لـ«نيرو» أو لمرخّصيها. ونمنحك ترخيصًا محدودًا شخصيًا قابلًا للإلغاء لاستخدامها بالشكل المقصود. وتبقى صور المعلنين ووصفهم ملكًا لهم.`,
  ``,
  `13. الخدمات والروابط الخارجية`,
  `قد تستخدم المنصة أو تربط بخدمات لا نتحكم بها (مثل الخرائط وتطبيقات المراسلة وخدمات الذكاء الاصطناعي). ولا نتحمل مسؤولية عنها ولا عن شروطها.`,
  ``,
  `14. غياب الضمان`,
  `تُقدَّم المنصة «كما هي» و«حسب توفرها». ولا نعد بأنها ستعمل دون انقطاع أو أخطاء. ولا يُعد أي شيء في المنصة نصيحة مالية أو استثمارية أو قانونية أو تقييمًا عقاريًا.`,
  ``,
  `15. حدود المسؤولية`,
  `إلى أقصى حد يسمح به القانون القطري، لا تتحمل «نيرو» المسؤولية عن التعاملات بين المستخدمين، ولا عن الإعلانات غير الدقيقة أو القديمة أو المضللة، ولا عن الخسائر الناشئة عن الاعتماد على إعلان أو عن التواصل مع معلن، ولا عن الخسائر غير المباشرة أو التبعية. ولا يستبعد أي نص هنا مسؤولية لا يجوز استبعادها قانونًا.`,
  ``,
  `16. التعويض`,
  `يعوّض المعلن «نيرو» عن الخسائر والمطالبات الناشئة عن إعلاناته ومحتواه وتعاملاته مع عملائه أو مخالفته لهذه الشروط أو للقانون.`,
  ``,
  `17. التعليق والإنهاء`,
  `يحق لك التوقف عن استخدام المنصة وإغلاق حسابك في أي وقت. ويجوز لنا تعليق الوصول أو إنهاؤه وفق البند 11. وتبقى سارية البنود التي تقتضي طبيعتها استمرارها (مثل 9 و15 و16 و19).`,
  ``,
  `18. التعديلات`,
  `يجوز لنا تحديث هذه الشروط. وتظهر النسخة الحالية وتاريخها دائمًا في هذه الصفحة، وسنُشعر بالتغييرات المهمة عبر المنصة. ويعني استمرارك في استخدام المنصة بعد التعديل قبولك له.`,
  ``,
  `19. القانون الواجب التطبيق وتسوية النزاعات`,
  `تخضع هذه الشروط لقوانين دولة قطر. ونشجعك على التواصل معنا أولًا لمحاولة حل أي شكوى وديًا. وأي نزاع لا يُحل بهذه الطريقة يخضع لاختصاص المحاكم المختصة في الدوحة، دولة قطر.`,
  ``,
  `20. التواصل`,
  `${COMPANY.nameAr}، ${IDENT_AR}. البريد الإلكتروني: ${COMPANY.email}.`
].join("\n");

// ---------------------------------------------------------------------------------------------
// Privacy Policy
// ---------------------------------------------------------------------------------------------
export const PRIVACY_EN = [
  `Privacy Policy of Nerou Finder`,
  `Last updated: 11 November 2026`,
  ``,
  `1. Who is responsible for your data`,
  `${ENTITY_EN}, ${IDENT_EN}, owns and operates Nerou Finder and is responsible for the personal data described here. We process it in line with Qatar Law No. 13 of 2016 on Personal Data Privacy Protection. Contact: ${COMPANY.email}.`,
  ``,
  `2. Our role in short`,
  `Nerou Finder displays properties so that advertisers can reach interested people and interested people can contact advertisers directly. We do not negotiate, mediate or take commissions (see the Terms of Use). Because of that, we collect only the data needed to run the Platform and to pass your inquiry to the advertiser you chose.`,
  ``,
  `3. The data we collect`,
  `- Your account: name, email, phone or WhatsApp number, your password (kept only in protected, scrambled form), your role, and anything you add to your profile (photo, short bio, languages, specialities, company details).`,
  `- When you contact an advertiser: your name, phone, email, WhatsApp number, your message, a preferred viewing date and time, and the listing concerned.`,
  `- When you press Call or WhatsApp on a listing: we record that a click happened on that listing so the advertiser can see interest. The click itself does not give us your number.`,
  `- How you use the Platform: your searches and filters, saved searches and alerts, saved and compared properties, listings you open, reviews you write and support tickets you send.`,
  `- AI search: the text you type into AI search is sent to an AI service provider so that it can suggest matching properties. Please do not put sensitive personal information in it.`,
  `- If you advertise: identity and licence documents (for example Qatar ID, passport, commercial registration, trade licence, brokerage permit, authorisation letters), business details, your team members, subscription and billing records, your listings and photos.`,
  `- Technical data and cookies: browser and device type, language, pages viewed and approximate times, and cookies according to the choices you make in the cookie consent (see the Cookie Policy).`,
  `We do not knowingly collect sensitive categories of data. Please do not include them in messages.`,
  ``,
  `4. Why we use it`,
  `- To run the Platform: accounts, listings, searches, saved items, and passing your inquiry or viewing request to the advertiser you chose.`,
  `- To verify advertisers and keep listings trustworthy.`,
  `- To send you emails and notices about your account, your inquiries, viewing reminders and alerts you asked for.`,
  `- To keep the Platform secure and prevent fraud and abuse.`,
  `- To understand how the Platform is used and improve it (non-essential analytics only with your consent).`,
  `- To comply with the law.`,
  `We do not sell your personal data.`,
  ``,
  `5. Who receives your data`,
  `- The advertiser you contact receives the details you submit and then deals with you directly. From that point the advertiser is responsible for how it uses your details and must follow the law.`,
  `- Service providers that help us run the Platform, only as needed and under confidentiality duties: cloud hosting and database, email delivery, analytics (only if you consented), the AI service used for AI search, and maps and media services.`,
  `- Authorities, when the law requires it.`,
  `- A buyer or successor of our business, if the business is ever transferred, under the same protections.`,
  `Public profiles: an advertiser's business profile (name, photo, bio, languages, specialities, business contact details, listings and reviews) is public by design, because advertisers use the Platform to be found.`,
  `Verification documents: documents that advertisers upload to prove their identity and licences are kept in a private area, never in the public pages. Only the person who uploaded them, the administrator of their organisation and authorised Nerou compliance staff can open them.`,
  ``,
  `6. Advertisers' private client lists (Sales Desk)`,
  `If you are an advertiser who uses the Sales Desk, the clients and notes you enter are your own data: you are responsible for having the right to hold and use them. We store them on your behalf. They are visible only to you (and to your agency's administrator where you belong to an agency). Nerou staff do not use them for any purpose of their own, we never contact those clients, and you can delete them at any time.`,
  ``,
  `7. Cookies`,
  `We use essential cookies to keep you signed in and the Platform secure, and, only if you agree, functional and analytics cookies. You can change your choice at any time from the cookie consent manager. Details are in the Cookie Policy.`,
  ``,
  `8. Where your data is processed`,
  `Our providers' servers may be located outside Qatar. When your data is processed outside Qatar we take steps to make sure it stays protected, as the law requires.`,
  ``,
  `9. How long we keep it`,
  `We keep personal data only as long as needed for the purposes above and as the law requires. Account data is kept while your account is active and for a period afterwards where the law or a legitimate dispute requires it, and is then deleted or made anonymous. Verification documents are kept while the advertiser account is active and afterwards only as long as required.`,
  ``,
  `10. Security`,
  `We protect data with encrypted connections (TLS), access controls, a private store for verification documents, and abuse limits on sensitive actions. No system is completely secure; if a breach affects you we will notify you and the authorities as the law requires.`,
  ``,
  `11. Your rights`,
  `Under Qatar Law No. 13 of 2016 you may ask to access your personal data, correct it, restrict or object to its use, withdraw a consent you gave, or ask us to delete it. You can also delete your account. Write to ${COMPANY.email}; we may need to verify your identity, and we will answer within a reasonable period. If you are not satisfied you may complain to the competent authority in Qatar.`,
  ``,
  `12. Children`,
  `The Platform is not for people under 18, and we do not knowingly collect their data.`,
  ``,
  `13. Other websites`,
  `Advertisers' websites and other services we link to have their own privacy practices, which we do not control.`,
  ``,
  `14. Changes`,
  `We may update this policy. The current version and its date are always shown on this page, and we will give notice of important changes on the Platform.`,
  ``,
  `15. Contact`,
  `${COMPANY.nameEn}, ${IDENT_EN}. Email: ${COMPANY.email}.`
].join("\n");

export const PRIVACY_AR = [
  `سياسة الخصوصية لمنصة نيرو فايندر`,
  `آخر تحديث: 11 نوفمبر 2026`,
  ``,
  `1. الجهة المسؤولة عن بياناتك`,
  `${ENTITY_AR}، ${IDENT_AR}، تمتلك منصة نيرو فايندر وتشغّلها وهي المسؤولة عن البيانات الشخصية الموضحة هنا. ونعالجها وفق القانون القطري رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية. للتواصل: ${COMPANY.email}.`,
  ``,
  `2. دورنا باختصار`,
  `تعرض نيرو فايندر العقارات ليصل المعلنون إلى المهتمين وليتواصل المهتمون مع المعلنين مباشرة. ونحن لا نتفاوض ولا نتوسط ولا نتقاضى عمولات (راجع شروط الاستخدام). ولذلك لا نجمع إلا البيانات اللازمة لتشغيل المنصة ولإيصال استفسارك إلى المعلن الذي اخترته.`,
  ``,
  `3. البيانات التي نجمعها`,
  `- حسابك: الاسم والبريد الإلكتروني ورقم الهاتف أو واتساب وكلمة المرور (تُحفظ بصيغة محمية مشفّرة فقط) ودورك، وما تضيفه إلى ملفك (صورة ونبذة ولغات وتخصصات وبيانات الشركة).`,
  `- عند تواصلك مع معلن: اسمك وهاتفك وبريدك ورقم واتساب ورسالتك وموعد المعاينة المفضل والإعلان المعني.`,
  `- عند ضغطك على الاتصال أو واتساب في إعلان: نسجّل أن ضغطة حدثت على ذلك الإعلان ليرى المعلن الاهتمام. والضغطة وحدها لا تعطينا رقمك.`,
  `- طريقة استخدامك للمنصة: عمليات البحث والتصفية، وعمليات البحث المحفوظة والتنبيهات، والعقارات المحفوظة والمقارَنة، والإعلانات التي تفتحها، والتقييمات التي تكتبها، وتذاكر الدعم التي ترسلها.`,
  `- البحث بالذكاء الاصطناعي: النص الذي تكتبه في البحث الذكي يُرسل إلى مزوّد خدمة ذكاء اصطناعي ليقترح عقارات مناسبة. يرجى عدم كتابة معلومات شخصية حساسة فيه.`,
  `- إن كنت تعلن: مستندات الهوية والترخيص (مثل البطاقة الشخصية وجواز السفر والسجل التجاري والرخصة التجارية وتصريح الوساطة وخطابات التفويض)، وبيانات المنشأة، وأعضاء فريقك، وسجلات الاشتراك والفوترة، وإعلاناتك وصورك.`,
  `- البيانات التقنية وملفات الارتباط: نوع المتصفح والجهاز واللغة والصفحات المعروضة وأوقاتها التقريبية، وملفات الارتباط بحسب اختياراتك في إدارة الموافقة (راجع سياسة ملفات الارتباط).`,
  `لا نجمع عن علم فئات البيانات الحساسة. يرجى عدم إدراجها في الرسائل.`,
  ``,
  `4. لماذا نستخدمها`,
  `- لتشغيل المنصة: الحسابات والإعلانات والبحث والمحفوظات، وإيصال استفسارك أو طلب المعاينة إلى المعلن الذي اخترته.`,
  `- للتحقق من المعلنين والحفاظ على موثوقية الإعلانات.`,
  `- لإرسال رسائل وإشعارات عن حسابك واستفساراتك وتذكيرات المعاينات والتنبيهات التي طلبتها.`,
  `- لحماية المنصة ومنع الاحتيال وإساءة الاستخدام.`,
  `- لفهم طريقة استخدام المنصة وتحسينها (التحليلات غير الأساسية بموافقتك فقط).`,
  `- للالتزام بالقانون.`,
  `ولا نبيع بياناتك الشخصية.`,
  ``,
  `5. من يستلم بياناتك`,
  `- المعلن الذي تتواصل معه يستلم البيانات التي ترسلها ثم يتعامل معك مباشرة. ومنذ تلك اللحظة يكون المعلن مسؤولًا عن طريقة استخدامه لبياناتك وعليه الالتزام بالقانون.`,
  `- مزوّدو الخدمات الذين يساعدوننا في التشغيل، بالقدر اللازم وبواجب السرية: الاستضافة السحابية وقاعدة البيانات، وإرسال البريد الإلكتروني، والتحليلات (بموافقتك فقط)، وخدمة الذكاء الاصطناعي المستخدمة في البحث الذكي، وخدمات الخرائط والوسائط.`,
  `- الجهات الرسمية، عندما يوجب القانون ذلك.`,
  `- مشترٍ لأعمالنا أو خلف لها، إن انتقلت الأعمال يومًا، وبنفس الحمايات.`,
  `الملفات العامة: الملف التجاري للمعلن (الاسم والصورة والنبذة واللغات والتخصصات وبيانات التواصل التجارية والإعلانات والتقييمات) عام بطبيعته، لأن المعلنين يستخدمون المنصة ليُعثر عليهم.`,
  `مستندات التوثيق: المستندات التي يرفعها المعلنون لإثبات هويتهم وتراخيصهم تُحفظ في منطقة خاصة وليس في الصفحات العامة أبدًا. ولا يفتحها إلا من رفعها ومدير منشأته وفريق الامتثال المخوّل في «نيرو».`,
  ``,
  `6. قوائم العملاء الخاصة بالمعلنين (مكتب المبيعات)`,
  `إن كنت معلنًا تستخدم مكتب المبيعات، فالعملاء والملاحظات التي تدخلها بياناتك أنت، وأنت مسؤول عن أحقيتك في حيازتها واستخدامها. ونحن نخزّنها نيابةً عنك. ولا يراها إلا أنت (ومدير مكتبك إن كنت تتبع مكتبًا). ولا يستخدمها موظفو «نيرو» لأي غرض خاص بهم، ولا نتواصل مع هؤلاء العملاء أبدًا، ويمكنك حذفهم في أي وقت.`,
  ``,
  `7. ملفات الارتباط`,
  `نستخدم ملفات ارتباط أساسية لإبقائك مسجّلًا ولحماية المنصة، ولا نستخدم الوظيفية والتحليلية إلا بموافقتك. ويمكنك تغيير اختيارك في أي وقت من إدارة الموافقة. التفاصيل في سياسة ملفات الارتباط.`,
  ``,
  `8. أين تُعالج بياناتك`,
  `قد تقع خوادم مزودينا خارج قطر. وعند معالجة بياناتك خارج قطر نتخذ الإجراءات التي تضمن بقاءها محمية، كما يشترط القانون.`,
  ``,
  `9. مدة الاحتفاظ بها`,
  `لا نحتفظ بالبيانات الشخصية إلا للمدة اللازمة للأغراض أعلاه وبحسب ما يوجبه القانون. وتُحفظ بيانات الحساب ما دام حسابك فعالًا ولمدة بعد ذلك حيث يقتضي القانون أو نزاع مشروع، ثم تُحذف أو تُجهَّل هويتها. وتُحفظ مستندات التوثيق ما دام حساب المعلن فعالًا، وبعد ذلك للمدة المطلوبة فقط.`,
  ``,
  `10. الأمان`,
  `نحمي البيانات باتصالات مشفرة (TLS) وضوابط للوصول ومخزن خاص لمستندات التوثيق وحدود لمنع إساءة استخدام الإجراءات الحساسة. ولا يوجد نظام آمن بالكامل؛ وإن أثّر خرق على بياناتك فسنُبلغك والجهات المختصة كما يوجب القانون.`,
  ``,
  `11. حقوقك`,
  `بموجب القانون القطري رقم 13 لسنة 2016 يحق لك طلب الاطلاع على بياناتك الشخصية وتصحيحها وتقييد استخدامها أو الاعتراض عليه وسحب أي موافقة منحتها أو طلب حذفها. ويمكنك أيضًا حذف حسابك. راسلنا على ${COMPANY.email}؛ وقد نحتاج إلى التحقق من هويتك، وسنرد خلال مدة معقولة. وإن لم تقتنع فيحق لك تقديم شكوى إلى الجهة المختصة في قطر.`,
  ``,
  `12. الأطفال`,
  `المنصة ليست لمن هم دون 18 عامًا، ولا نجمع بياناتهم عن علم.`,
  ``,
  `13. المواقع الأخرى`,
  `لمواقع المعلنين والخدمات الأخرى التي نربط بها ممارسات خصوصية خاصة بها لا نتحكم بها.`,
  ``,
  `14. التعديلات`,
  `يجوز لنا تحديث هذه السياسة. وتظهر النسخة الحالية وتاريخها دائمًا في هذه الصفحة، وسنُشعر بالتغييرات المهمة عبر المنصة.`,
  ``,
  `15. التواصل`,
  `${COMPANY.nameAr}، ${IDENT_AR}. البريد الإلكتروني: ${COMPANY.email}.`
].join("\n");

// ---------------------------------------------------------------------------------------------
// The documents, and replacing the older seeded versions
// ---------------------------------------------------------------------------------------------
export const NEW_LEGAL_DOCUMENTS: Record<"terms-of-use" | "privacy-policy", Pick<LegalDocument, "content" | "contentAr" | "version" | "effectiveDate" | "lastUpdated" | "author" | "legalReviewStatus">> = {
  "terms-of-use": {
    content: TERMS_EN, contentAr: TERMS_AR, version: "2.0.0",
    effectiveDate: LEGAL_DOC_DATE, lastUpdated: LEGAL_DOC_DATE, author: COMPANY.nameEn,
    // drafted with care, but not yet reviewed by a Qatari lawyer
    legalReviewStatus: "PENDING"
  },
  "privacy-policy": {
    content: PRIVACY_EN, contentAr: PRIVACY_AR, version: "2.0.0",
    effectiveDate: LEGAL_DOC_DATE, lastUpdated: LEGAL_DOC_DATE, author: COMPANY.nameEn,
    legalReviewStatus: "PENDING"
  }
};

/** The short versions seeded first. A stored document still carrying exactly these has never been edited by an admin. */
const OLD_SEEDS: Record<string, { version: string; lastUpdated: string }> = {
  "terms-of-use": { version: "1.2.0", lastUpdated: "2026-07-20" },
  "privacy-policy": { version: "1.5.0", lastUpdated: "2026-07-20" }
};

/**
 * Replaces the old short Terms of Use / Privacy Policy with the full versions - but only where the stored
 * document is still the untouched first seed. A document an admin has edited in the Legal CMS (its version
 * or date changed) is never overwritten. Returns how many were replaced.
 */
export function upgradeSeededLegalDocuments(docs: LegalDocument[]): number {
  let n = 0;
  for (const doc of docs) {
    const old = OLD_SEEDS[doc.slug];
    const next = NEW_LEGAL_DOCUMENTS[doc.slug as keyof typeof NEW_LEGAL_DOCUMENTS];
    if (!old || !next) continue;
    if (doc.version === old.version && doc.lastUpdated === old.lastUpdated) {
      Object.assign(doc, next);
      n += 1;
    }
  }
  return n;
}
