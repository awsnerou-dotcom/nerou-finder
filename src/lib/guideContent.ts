import type { GuideArticle, Persona } from "./guide.js";

// Every article of the subscriber guide, in English and Arabic. Written from what the workspaces really do today:
// when a feature changes, change its article here (tests fail if a language or a "take me there" target is missing).

const I: Persona = "independent";
const AA: Persona = "agencyAgent";
const AD: Persona = "agencyAdmin";
const ALL: Persona[] = [I, AA, AD];
const AGENT: Persona[] = [I, AA];

export const GUIDE_ARTICLES: GuideArticle[] = [
  // ------------------------------------------------------------------------------------------------ getting started
  {
    id: "dashboard",
    category: "start",
    audience: ALL,
    accent: "indigo",
    minutes: 2,
    title: { en: "Your dashboard in two minutes", ar: "لوحتك في دقيقتين" },
    summary: { en: "What the numbers mean and where to press first.", ar: "ماذا تعني الأرقام وأين تضغط أولاً." },
    why: {
      en: "The dashboard tells you what needs you today. Opening it each morning is the fastest way to never lose an enquiry.",
      ar: "اللوحة تقول لك ما يحتاجك اليوم. افتحها كل صباح فلا يضيع عليك أي استفسار."
    },
    steps: [
      { title: { en: "Read the welcome band", ar: "اقرأ الشريط العلوي" }, body: { en: "It greets you and holds the bell for new enquiries and the main button (new property, or invite an agent).", ar: "يرحّب بك، وفيه جرس الاستفسارات الجديدة والزر الرئيسي (عقار جديد، أو دعوة وسيط)." } },
      { title: { en: "Check “Needs your attention”", ar: "راجع «ما يحتاج انتباهك»" }, body: { en: "Each line says what is waiting (an unanswered enquiry, a missing document, a listing without photos). Press a line to land on the page where it is fixed.", ar: "كل سطر يقول ما ينتظرك (استفسار بلا رد، مستند ناقص، عقار بلا صور). اضغط السطر لتصل إلى الصفحة التي تحل فيها المشكلة." } },
      { title: { en: "Use the big shortcuts", ar: "استعمل الاختصارات الكبيرة" }, body: { en: "The coloured tiles open the things you do every day in one press.", ar: "المربعات الملوّنة تفتح ما تفعله كل يوم بضغطة واحدة." } },
      { title: { en: "Move around with the side menu", ar: "تنقّل بالقائمة الجانبية" }, body: { en: "Each section has its own colour and icon. On a phone the menu is the row of icons at the top. The small arrow at the bottom shrinks the menu.", ar: "لكل قسم لونه وأيقونته. وفي الهاتف القائمة هي صف الأيقونات في الأعلى. والسهم الصغير في أسفلها يصغّر القائمة." } }
    ],
    tips: [
      { en: "A gold number on a menu item is how many things are waiting there.", ar: "الرقم الذهبي بجانب قسم يعني كم شيئاً ينتظرك فيه." },
      { en: "You can replay the guided tour any time from Profile / Settings.", ar: "تستطيع إعادة الجولة التعريفية في أي وقت من «الحساب» أو «الإعدادات»." }
    ],
    goTo: { agent: "dashboard", agency: "dashboard" },
    related: ["verify", "leads"]
  },
  {
    id: "verify",
    category: "start",
    audience: ALL,
    accent: "teal",
    minutes: 3,
    title: { en: "Get verified", ar: "وثّق حسابك" },
    summary: { en: "Upload your documents once. Verified accounts are shown first.", ar: "ارفع مستنداتك مرة واحدة. الحسابات الموثقة تظهر أولاً." },
    why: {
      en: "Clients trust a verified badge, and verified agents and agencies are shown first. An independent agent also needs an approved Authorization Letter before listings can go live.",
      ar: "العميل يثق بشارة التوثيق، والموثّقون يظهرون أولاً. والوسيط المستقل يحتاج أيضاً خطاب تفويض معتمداً قبل أن تُنشر عقاراته."
    },
    steps: [
      { title: { en: "Open Verification", ar: "افتح «التوثيق»" }, body: { en: "It is in the side menu, under Account. A banner on the dashboard can also take you there.", ar: "تجدها في القائمة الجانبية تحت «الحساب»، وقد توصلك إليها أيضاً لافتة في الصفحة الرئيسية." } },
      { title: { en: "Upload each required document", ar: "ارفع كل مستند مطلوب" }, body: { en: "Use a clear photo or a PDF. Every document shows its own status: waiting, approved or needs a new copy.", ar: "استعمل صورة واضحة أو ملف PDF. يظهر لكل مستند حالته: بانتظار المراجعة، أو معتمد، أو يحتاج نسخة جديدة." } },
      { title: { en: "Wait for the review", ar: "انتظر المراجعة" }, body: { en: "The team reviews what you sent. If something is unclear you will see what to fix right on the document.", ar: "يراجع الفريق ما أرسلته. وإن كان شيء غير واضح تراه مكتوباً على المستند نفسه." } },
      { title: { en: "See your badge", ar: "شاهد شارتك" }, body: { en: "Once approved, “Verified” appears under your name here and on your public page.", ar: "بعد الاعتماد تظهر شارة «موثّق» تحت اسمك هنا وفي صفحتك العامة." } }
    ],
    tips: [
      { en: "Upload documents that are valid, not expiring this month.", ar: "ارفع مستندات سارية وليست على وشك الانتهاء." }
    ],
    goTo: { agent: "verification", agency: "verification" },
    related: ["profile", "add-listings"]
  },
  {
    id: "profile",
    category: "start",
    audience: ALL,
    accent: "fuchsia",
    minutes: 3,
    title: { en: "A profile clients trust", ar: "ملف شخصي يثق به العملاء" },
    summary: { en: "Photo, bio, languages and WhatsApp: the first thing a client sees.", ar: "الصورة والنبذة واللغات وواتساب: أول ما يراه العميل." },
    why: {
      en: "Before calling, a client looks at who you are. A real photo and a short bio turn a stranger into someone worth calling.",
      ar: "قبل أن يتصل العميل ينظر من أنت. صورة حقيقية ونبذة قصيرة تحوّل الغريب إلى شخص يستحق الاتصال."
    },
    steps: [
      { title: { en: "Open My Profile (or Settings)", ar: "افتح «الحساب» (أو «الإعدادات»)" }, body: { en: "Agents find it as My Profile, agencies as Settings.", ar: "الوسيط يجدها باسم «الحساب»، والمكتب باسم «الإعدادات»." } },
      { title: { en: "Add a clear photo or logo", ar: "أضف صورة أو شعاراً واضحاً" }, body: { en: "A face for an agent, the logo for an agency. It appears on your cards and your public page.", ar: "وجه الوسيط أو شعار المكتب. يظهر في بطاقاتك وفي صفحتك العامة." } },
      { title: { en: "Write a short bio in both languages", ar: "اكتب نبذة قصيرة باللغتين" }, body: { en: "Two or three lines: your areas, your experience, how you work. If you leave the Arabic empty it mirrors the English.", ar: "سطران أو ثلاثة: مناطقك وخبرتك وطريقة عملك. وإن تركت العربية فارغة تُنسخ من الإنجليزية." } },
      { title: { en: "List the languages you speak and your WhatsApp", ar: "اذكر اللغات التي تتكلمها ورقم واتساب" }, body: { en: "Clients filter by language and prefer to reach you on WhatsApp.", ar: "العملاء يصفّون بحسب اللغة ويفضلون مراسلتك على واتساب." } },
      { title: { en: "Save", ar: "احفظ" }, body: { en: "Your public page updates at once.", ar: "تتحدّث صفحتك العامة فوراً." } }
    ],
    tips: [
      { en: "A real photo makes a profile feel like a real person.", ar: "الصورة الحقيقية تجعل الملف يبدو شخصاً حقيقياً." },
      { en: "Write like you speak. Short and warm beats long and formal.", ar: "اكتب كما تتكلم. القصير الودود أفضل من الطويل الرسمي." }
    ],
    goTo: { agent: "profile", agency: "profile" },
    related: ["public-page", "reviews"]
  },

  // ------------------------------------------------------------------------------------------------------- listings
  {
    id: "add-listings",
    category: "listings",
    audience: AGENT,
    accent: "sky",
    minutes: 3,
    title: { en: "Four ways to add listings", ar: "أربع طرق لإضافة العقارات" },
    summary: { en: "Paste an ad, upload a file, connect a feed link or fill the form. Pick what fits how you work.", ar: "الصق إعلاناً، أو ارفع ملفاً، أو اربط رابط خلاصة، أو املأ النموذج. اختر ما يناسب طريقتك." },
    why: {
      en: "More live listings means more visits and more enquiries. You do not have to retype what you already have somewhere else.",
      ar: "كلما زادت العقارات المنشورة زادت الزيارات والاستفسارات. ولا حاجة لإعادة كتابة ما عندك في مكان آخر."
    },
    steps: [
      { title: { en: "Open My Listings", ar: "افتح «عقاراتي»" }, body: { en: "The “Add your listings” box is at the top, with four cards.", ar: "مربع «أضف عقاراتك» في الأعلى وفيه أربع بطاقات." } },
      { title: { en: "Paste an ad", ar: "الصق إعلاناً" }, body: { en: "One property from a WhatsApp message or a post. It fills the form for you.", ar: "عقار واحد من رسالة واتساب أو منشور. تملأ الأداة النموذج عنك." } },
      { title: { en: "Upload a file", ar: "ارفع ملفاً" }, body: { en: "Many properties at once from a spreadsheet saved as CSV, or a JSON or XML file.", ar: "عقارات كثيرة معاً من جدول محفوظ بصيغة CSV، أو ملف JSON أو XML." } },
      { title: { en: "Connect your feed link", ar: "اربط رابط خلاصتك" }, body: { en: "Paste the link of the system that already feeds other portals. It is read again every six hours.", ar: "الصق رابط النظام الذي يغذّي المواقع الأخرى. يُقرأ من جديد كل ست ساعات." } },
      { title: { en: "Or fill the form", ar: "أو املأ النموذج" }, body: { en: "The step-by-step form, best for one careful listing.", ar: "النموذج خطوة بخطوة، الأفضل لعقار واحد بعناية." } }
    ],
    tips: [
      { en: "Imports are saved as drafts first, so nothing goes live by surprise.", ar: "الاستيراد يُحفظ مسودات أولاً، فلا ينشر شيء دون علمك." },
      { en: "A green “Publish them all” bar appears when drafts are complete.", ar: "يظهر شريط أخضر «انشرها كلها» عندما تكتمل المسودات." }
    ],
    goTo: { agent: "properties" },
    related: ["paste-ad", "import-file", "listing-form"]
  },
  {
    id: "listing-form",
    category: "listings",
    audience: AGENT,
    accent: "sky",
    minutes: 4,
    title: { en: "Publish a listing step by step", ar: "انشر عقاراً خطوة بخطوة" },
    summary: { en: "Five short steps: type, location, details, photos, description.", ar: "خمس خطوات قصيرة: النوع والموقع والمواصفات والصور والوصف." },
    why: {
      en: "A complete listing ranks better and gets trusted. The form guides you so nothing important is forgotten.",
      ar: "العقار المكتمل يظهر أفضل ويكسب الثقة. النموذج يرشدك فلا يُنسى شيء مهم."
    },
    steps: [
      { title: { en: "Type & Purpose", ar: "النوع والغرض" }, body: { en: "A clear title, the property type, and sale or rent.", ar: "عنوان واضح، ونوع العقار، وبيع أو إيجار." } },
      { title: { en: "Location", ar: "الموقع" }, body: { en: "Choose the municipality and the area, then drop the pin on the map. An exact pin is what buyers look for first.", ar: "اختر البلدية والمنطقة ثم ضع الدبوس على الخريطة. الدبوس الدقيق أول ما يبحث عنه المشتري." } },
      { title: { en: "Specifications", ar: "المواصفات" }, body: { en: "Size, bedrooms, bathrooms, furnishing and the price. You can add nearby places such as metro stations.", ar: "المساحة والغرف والحمامات والتأثيث والسعر. ويمكنك إضافة أماكن قريبة مثل محطات المترو." } },
      { title: { en: "Photos", ar: "الصور" }, body: { en: "Upload bright, sharp photos. The first one is the cover. A video link or a virtual tour link can be added too.", ar: "ارفع صوراً مضيئة وواضحة. الأولى هي الغلاف. ويمكن إضافة رابط فيديو أو جولة افتراضية." } },
      { title: { en: "Description & Review", ar: "الوصف والمراجعة" }, body: { en: "Describe it, check everything, then publish or save as a draft.", ar: "صف العقار وراجع كل شيء ثم انشر أو احفظ مسودة." } }
    ],
    tips: [
      { en: "Leave halfway? Your progress is kept on this device as a draft.", ar: "إن غادرت في المنتصف فتقدمك محفوظ على جهازك كمسودة." },
      { en: "Never put a phone number in the description. Enquiries reach you through the platform.", ar: "لا تضع رقم هاتف في الوصف. الاستفسارات تصلك عبر المنصة." }
    ],
    goTo: { agent: "properties" },
    related: ["listing-quality", "boost"]
  },
  {
    id: "import-file",
    category: "listings",
    audience: AGENT,
    accent: "teal",
    minutes: 4,
    title: { en: "Upload a file or connect a feed", ar: "ارفع ملفاً أو اربط خلاصة" },
    summary: { en: "Bring many listings in at once and keep them updated automatically.", ar: "أدخل عقارات كثيرة دفعة واحدة وأبقها محدّثة تلقائياً." },
    why: {
      en: "If your listings already live in a spreadsheet or a CRM, this takes minutes instead of days.",
      ar: "إن كانت عقاراتك في جدول أو نظام إدارة عملاء، فهذا يوفّر أياماً ويتم في دقائق."
    },
    steps: [
      { title: { en: "Download the template", ar: "نزّل النموذج الجاهز" }, body: { en: "In “Upload a file”, press the template button and fill it in Excel or Sheets.", ar: "في «ارفع ملفاً» اضغط زر النموذج واملأه في إكسل أو شيتس." } },
      { title: { en: "Save it as CSV UTF-8", ar: "احفظه بصيغة CSV UTF-8" }, body: { en: "Excel files (.xlsx) cannot be read directly. Use Save As → CSV UTF-8 so Arabic letters stay correct.", ar: "ملفات إكسل (.xlsx) لا تُقرأ مباشرة. استعمل «حفظ باسم» ثم CSV UTF-8 لتبقى الحروف العربية سليمة." } },
      { title: { en: "Drop the file and read the preview", ar: "أسقط الملف واقرأ المعاينة" }, body: { en: "Before anything is saved you see how many will be added, updated and skipped, and the reason for every skipped row.", ar: "قبل حفظ أي شيء ترى كم سيُضاف وكم سيُحدَّث وكم سيُتخطّى، وسبب كل صف متخطّى." } },
      { title: { en: "Save as drafts or publish", ar: "احفظ مسودات أو انشر" }, body: { en: "Drafts are the safe default. Complete listings can be published straight away; the rest stay drafts marked “needs details”.", ar: "المسودات هي الخيار الآمن. العقارات المكتملة تُنشر فوراً، والباقي يبقى مسودة بعلامة «يحتاج تفاصيل»." } },
      { title: { en: "Or paste your feed link", ar: "أو الصق رابط الخلاصة" }, body: { en: "In “Connect your feed link”, paste the https link. It is read at once and again every six hours; new listings are added and changed ones updated.", ar: "في «اربط رابط خلاصتك» الصق رابط https. يُقرأ فوراً ثم كل ست ساعات؛ الجديد يُضاف والمتغيّر يُحدَّث." } }
    ],
    tips: [
      { en: "Up to 200 rows per upload. Send the rest in a second file.", ar: "حتى 200 صف في المرة. أرسل الباقي في ملف ثانٍ." },
      { en: "A listing removed from your feed is not paused automatically. You stay in control.", ar: "العقار المحذوف من خلاصتك لا يُوقَف تلقائياً. القرار لك." },
      { en: "Photos load in the background and get the platform watermark.", ar: "الصور تُحمَّل في الخلفية وتُوضع عليها العلامة المائية للمنصة." }
    ],
    goTo: { agent: "properties" },
    related: ["add-listings", "paste-ad"]
  },
  {
    id: "paste-ad",
    category: "listings",
    audience: AGENT,
    accent: "amber",
    minutes: 1,
    title: { en: "Paste an ad from WhatsApp", ar: "الصق إعلاناً من واتساب" },
    summary: { en: "Turn a message into a listing in a few seconds.", ar: "حوّل رسالة إلى عقار في ثوانٍ." },
    why: {
      en: "Most agents already write their ads in a message. Paste it and the platform reads the price, size, rooms and area for you.",
      ar: "أغلب الوسطاء يكتبون إعلاناتهم في رسالة. الصقها فتقرأ المنصة السعر والمساحة والغرف والمنطقة."
    },
    steps: [
      { title: { en: "Copy your ad", ar: "انسخ إعلانك" }, body: { en: "From WhatsApp, a post or a note. Arabic or English.", ar: "من واتساب أو منشور أو ملاحظة. عربي أو إنجليزي." } },
      { title: { en: "Paste it and press “Read my ad”", ar: "الصقه واضغط «اقرأ إعلاني»" }, body: { en: "The tool shows what it found, field by field. Anything it cannot find stays empty for you.", ar: "تعرض الأداة ما وجدته حقلاً حقلاً. وما لا تجده يبقى فارغاً لتملأه أنت." } },
      { title: { en: "Press “Continue: add photos and publish”", ar: "اضغط «تابع: أضف الصور وانشر»" }, body: { en: "The form opens already filled in.", ar: "يفتح النموذج وقد امتلأ." } },
      { title: { en: "Add photos and the map pin, then publish", ar: "أضف الصور والدبوس ثم انشر" }, body: { en: "These two cannot be guessed from text, so they are yours to add.", ar: "هذان لا يُستنتجان من النص، فهما عليك." } }
    ],
    tips: [
      { en: "Phone numbers inside the text are removed automatically.", ar: "أرقام الهاتف داخل النص تُحذف تلقائياً." },
      { en: "Check the price and area it picked before publishing.", ar: "راجع السعر والمنطقة اللذين اختارتهما الأداة قبل النشر." }
    ],
    goTo: { agent: "properties" },
    related: ["add-listings", "listing-form"]
  },
  {
    id: "listing-quality",
    category: "listings",
    audience: AGENT,
    accent: "violet",
    minutes: 3,
    title: { en: "Make a listing stand out", ar: "اجعل عقارك يلفت النظر" },
    summary: { en: "Photos, pin, video and a fair price: what makes people call.", ar: "الصور والدبوس والفيديو وسعر عادل: ما يجعل الناس يتصلون." },
    why: {
      en: "Two listings in the same street get very different attention. The difference is almost always photos, pin and price.",
      ar: "عقاران في الشارع نفسه ينالان انتباهاً مختلفاً جداً. والفرق غالباً في الصور والدبوس والسعر."
    },
    steps: [
      { title: { en: "Photos first", ar: "الصور أولاً" }, body: { en: "Daylight, straight angles, tidy rooms. Put the best photo first; it is the cover everywhere.", ar: "ضوء النهار وزوايا مستقيمة وغرف مرتبة. ضع أفضل صورة أولاً فهي الغلاف في كل مكان." } },
      { title: { en: "Exact map pin", ar: "دبوس دقيق على الخريطة" }, body: { en: "A pin on the real building lets people check the neighbourhood and the commute.", ar: "الدبوس على المبنى الحقيقي يتيح للناس فحص الحي والطريق." } },
      { title: { en: "Video or virtual tour", ar: "فيديو أو جولة افتراضية" }, body: { en: "Paste a video link or a 360° tour link in the form. It saves wasted viewings.", ar: "الصق رابط فيديو أو جولة 360° في النموذج. توفر معاينات لا فائدة منها." } },
      { title: { en: "Check the price against the market", ar: "قارن السعر بالسوق" }, body: { en: "Use the “Is this price fair?” tool. A fair price brings calls; a high one brings views and silence.", ar: "استعمل أداة «هل السعر عادل؟». السعر العادل يجلب الاتصالات، والمرتفع يجلب مشاهدات وصمتاً." } },
      { title: { en: "Keep it current", ar: "أبقه محدّثاً" }, body: { en: "When a property is gone, pause it. Clients stop trusting agents whose listings are always taken.", ar: "إذا انتهى العقار أوقفه. العملاء يفقدون الثقة بمن عقاراته دائماً «مأخوذة»." } }
    ],
    tips: [
      { en: "“Listing performance” on each card shows views and enquiries so you can see what works.", ar: "«أداء العقار» في كل بطاقة يعرض المشاهدات والاستفسارات لتعرف ما ينجح." }
    ],
    goTo: { agent: "properties" },
    related: ["price-check", "boost", "cma"]
  },
  {
    id: "agency-listings",
    category: "listings",
    audience: [AD],
    accent: "sky",
    minutes: 2,
    title: { en: "All your agency's listings", ar: "كل عقارات مكتبك" },
    summary: { en: "See, search and manage what every agent has published.", ar: "شاهد وابحث وأدر ما نشره كل وسيط." },
    why: {
      en: "One screen for the whole office: what is live, what is not, and who owns what.",
      ar: "شاشة واحدة للمكتب كله: ما هو منشور وما ليس منشوراً ولمن كل عقار."
    },
    steps: [
      { title: { en: "Open Listings", ar: "افتح «العقارات المدرجة»" }, body: { en: "The strip at the top counts total, live and not-live listings and your agents.", ar: "الشريط في الأعلى يعدّ الإجمالي والمنشور وغير المنشور والوسطاء." } },
      { title: { en: "Search", ar: "ابحث" }, body: { en: "By title, reference number, area or agent name.", ar: "بالعنوان أو الرقم المرجعي أو المنطقة أو اسم الوسيط." } },
      { title: { en: "Act on a listing", ar: "تصرّف في العقار" }, body: { en: "Edit it, open its performance, or remove it.", ar: "عدّله أو افتح أداءه أو احذفه." } },
      { title: { en: "Chase the “not live” ones", ar: "تابع «غير المنشورة»" }, body: { en: "Drafts and paused listings earn nothing. Ask the agent what is missing.", ar: "المسودات والموقوفة لا تجلب شيئاً. اسأل الوسيط عمّا ينقص." } }
    ],
    tips: [
      { en: "Your agents add listings from their own workspace; you see them here instantly.", ar: "وسطاؤك يضيفون عقاراتهم من مساحتهم وتراها هنا فوراً." }
    ],
    goTo: { agency: "listings" },
    related: ["team", "campaigns"]
  },

  // ----------------------------------------------------------------------------------------------- clients & sales
  {
    id: "leads",
    category: "clients",
    audience: AGENT,
    accent: "emerald",
    minutes: 3,
    title: { en: "Answer enquiries fast", ar: "ردّ على الاستفسارات بسرعة" },
    summary: { en: "Every enquiry in one list, with a clear status and a note history.", ar: "كل استفسار في قائمة واحدة بحالة واضحة وسجل ملاحظات." },
    why: {
      en: "The first agent to reply often wins the client. This page is built so you reply in one tap.",
      ar: "أول وسيط يردّ كثيراً ما يكسب العميل. هذه الصفحة مبنية لترد بضغطة واحدة."
    },
    steps: [
      { title: { en: "Open Leads", ar: "افتح «العملاء المحتملون»" }, body: { en: "New enquiries are on top. A gold number on the menu counts the ones still waiting for you.", ar: "الاستفسارات الجديدة في الأعلى. والرقم الذهبي في القائمة يعدّ ما ينتظر ردك." } },
      { title: { en: "Reply by WhatsApp, call or email", ar: "ردّ بواتساب أو اتصال أو بريد" }, body: { en: "Each card has the buttons. Reply, then set the status so you remember where it stands.", ar: "في كل بطاقة الأزرار. ردّ ثم غيّر الحالة لتتذكر موقفها." } },
      { title: { en: "Write a note", ar: "اكتب ملاحظة" }, body: { en: "Budget, preferred area, when they can view. Notes stay on the enquiry.", ar: "الميزانية والمنطقة المفضلة وموعد المعاينة. تبقى الملاحظات على الاستفسار." } },
      { title: { en: "Archive what is finished", ar: "أرشف ما انتهى" }, body: { en: "Archived enquiries leave the list but can be reopened any time.", ar: "المؤرشف يغادر القائمة ويمكن إعادة فتحه متى شئت." } }
    ],
    tips: [
      { en: "Reply within the first hour if you can. A client who waits a day often calls someone else.", ar: "ردّ في الساعة الأولى إن استطعت. العميل الذي ينتظر يوماً كثيراً ما يتصل بغيرك." },
      { en: "Serious clients deserve the Sales Desk: move them into your pipeline.", ar: "العميل الجاد يستحق «مكتب المبيعات»: ضعه في مسار البيع." }
    ],
    goTo: { agent: "leads" },
    related: ["pipeline", "follow-ups"]
  },
  {
    id: "agency-leads",
    category: "clients",
    audience: [AD],
    accent: "emerald",
    minutes: 2,
    title: { en: "Oversee and reassign leads", ar: "راقب العملاء وأعد توزيعهم" },
    summary: { en: "See every enquiry of the office and move it to the right agent.", ar: "شاهد كل استفسارات المكتب وانقلها للوسيط المناسب." },
    why: {
      en: "An enquiry that sits unanswered is a lost sale. You can see them all and hand them to whoever can answer now.",
      ar: "الاستفسار الذي ينتظر بلا رد صفقة ضائعة. ترى الجميع وتسلّمه لمن يستطيع الرد الآن."
    },
    steps: [
      { title: { en: "Open Leads", ar: "افتح «إدارة العملاء»" }, body: { en: "The strip shows total, waiting and unassigned enquiries.", ar: "الشريط يعرض الإجمالي والمنتظر وغير الموزَّع." } },
      { title: { en: "Filter", ar: "صفِّ" }, body: { en: "All, Unassigned, or Waiting (nobody has replied yet).", ar: "الكل أو غير الموزَّع أو المنتظر (لم يردّ عليه أحد بعد)." } },
      { title: { en: "Reassign", ar: "أعد التعيين" }, body: { en: "Pick another agent on the card. The client is moved and the agent sees it at once.", ar: "اختر وسيطاً آخر في البطاقة. ينتقل العميل ويراه الوسيط فوراً." } },
      { title: { en: "Look at the Sales Desk for the full picture", ar: "راجع «مكتب المبيعات» للصورة الكاملة" }, body: { en: "As admin you see every agent's pipeline there.", ar: "بصفتك مديراً ترى مسار كل وسيط هناك." } }
    ],
    tips: [
      { en: "Check “Waiting” first thing every morning.", ar: "افتح «المنتظر» أول شيء كل صباح." }
    ],
    goTo: { agency: "leads" },
    related: ["pipeline", "team"]
  },
  {
    id: "pipeline",
    category: "clients",
    audience: ALL,
    accent: "amber",
    minutes: 3,
    title: { en: "Sales Desk: the pipeline", ar: "مكتب المبيعات: مسار البيع" },
    summary: { en: "Every client in a stage, from first contact to closed deal.", ar: "كل عميل في مرحلة، من أول تواصل حتى الصفقة." },
    why: {
      en: "A pipeline shows who is hot, who is cold and who you forgot. It replaces the notebook and the memory.",
      ar: "المسار يريك من ساخن ومن بارد ومن نسيته. يحل محل الدفتر والذاكرة."
    },
    steps: [
      { title: { en: "Add clients", ar: "أضف العملاء" }, body: { en: "“Add client” for one, or “Import list” to bring a whole contact list in.", ar: "«إضافة عميل» لواحد، أو «استيراد قائمة» لقائمة كاملة." } },
      { title: { en: "Open the Pipeline tab", ar: "افتح تبويب «مسار البيع»" }, body: { en: "Clients sit in columns by stage. Search or filter by source at the top.", ar: "العملاء في أعمدة بحسب المرحلة. ابحث أو صفِّ بالمصدر من الأعلى." } },
      { title: { en: "Move a client forward", ar: "حرّك العميل للأمام" }, body: { en: "Move a card to the next stage as the conversation advances.", ar: "انقل البطاقة للمرحلة التالية كلما تقدمت المحادثة." } },
      { title: { en: "Open a client", ar: "افتح العميل" }, body: { en: "Notes, history, follow-up date and viewings in one place.", ar: "الملاحظات والسجل وموعد المتابعة والمعاينات في مكان واحد." } },
      { title: { en: "Read the strip at the top", ar: "اقرأ الشريط في الأعلى" }, body: { en: "Open clients, follow-ups due, viewings this week and expected commission, each one opens its tab.", ar: "العملاء المفتوحون والمتابعات المستحقة ومعاينات الأسبوع والعمولة المتوقعة، وكل رقم يفتح تبويبه." } }
    ],
    tips: [
      { en: "Agency admins see every agent's clients and can tell who is falling behind.", ar: "مدير المكتب يرى عملاء كل وسيط ويعرف من يتأخر." }
    ],
    goTo: { agent: "salesdesk", agency: "salesdesk" },
    related: ["follow-ups", "deals"]
  },
  {
    id: "follow-ups",
    category: "clients",
    audience: ALL,
    accent: "rose",
    minutes: 2,
    title: { en: "Follow-ups and viewings", ar: "المتابعات والمعاينات" },
    summary: { en: "Never forget to call back, and never miss a viewing.", ar: "لا تنسَ الاتصال مجدداً ولا تفوّت معاينة." },
    why: {
      en: "Many deals are only closed after several contacts. The desk remembers for you and can email you each morning.",
      ar: "كثير من الصفقات لا تُغلق إلا بعد عدة اتصالات. المكتب يتذكر عنك ويراسلك كل صباح."
    },
    steps: [
      { title: { en: "Set a follow-up date", ar: "حدّد موعد متابعة" }, body: { en: "On any client, pick the day you will call again.", ar: "على أي عميل اختر اليوم الذي ستتصل فيه مجدداً." } },
      { title: { en: "Work the Follow-ups tab", ar: "اعمل من تبويب «المتابعات»" }, body: { en: "Overdue first, then today. Reschedule with one tap.", ar: "المتأخر أولاً ثم اليوم. أعد الجدولة بضغطة واحدة." } },
      { title: { en: "Schedule a viewing", ar: "جدول معاينة" }, body: { en: "From the Viewings tab or from a client card. Mark it done, cancelled or moved.", ar: "من تبويب «المعاينات» أو من بطاقة العميل. حدّدها منجزة أو ملغاة أو مؤجلة." } },
      { title: { en: "Turn on reminder emails", ar: "فعّل إيميلات التذكير" }, body: { en: "The switch at the top of the desk sends a daily email with that day's follow-ups and viewings.", ar: "المفتاح أعلى المكتب يرسل إيميلاً يومياً بمتابعات ومعاينات اليوم." } }
    ],
    tips: [
      { en: "End every call by setting the next follow-up date. It takes five seconds.", ar: "اختم كل مكالمة بتحديد موعد المتابعة التالي. يأخذ خمس ثوانٍ." }
    ],
    goTo: { agent: "salesdesk", agency: "salesdesk" },
    related: ["pipeline", "deals"]
  },
  {
    id: "deals",
    category: "clients",
    audience: ALL,
    accent: "emerald",
    minutes: 3,
    title: { en: "Tasks, deals and commission", ar: "المهام والصفقات والعمولة" },
    summary: { en: "Track your to-dos, closed deals, what you are owed and download reports.", ar: "تابع مهامك وصفقاتك وما لك من عمولة وحمّل التقارير." },
    why: {
      en: "Knowing what you will earn this month, and what is waiting to be paid, is half of running a business.",
      ar: "معرفة ما ستكسبه هذا الشهر وما ينتظر الدفع نصف إدارة العمل."
    },
    steps: [
      { title: { en: "Tasks & renewals", ar: "المهام والتجديدات" }, body: { en: "Your to-do list grouped as Overdue, Today, Next 7 days and Later, with renewals that are coming up. Snooze or mark done.", ar: "قائمة مهامك مقسمة إلى متأخرة واليوم والأيام السبعة القادمة ولاحقاً، مع التجديدات القريبة. أجّل أو أنجز." } },
      { title: { en: "Deals & commission", ar: "الصفقات والعمولات" }, body: { en: "Record a deal when it closes, with its commission. See what is expected and what is received.", ar: "سجّل الصفقة عند إغلاقها مع عمولتها. وانظر المتوقع والمستلم." } },
      { title: { en: "Lost deals", ar: "الصفقات الخاسرة" }, body: { en: "If a client goes elsewhere, mark it lost and say why. Patterns teach you what to change.", ar: "إذا ذهب العميل لغيرك فسجّلها خاسرة مع السبب. الأنماط تعلّمك ما تغيّره." } },
      { title: { en: "Reports", ar: "التقارير" }, body: { en: "Download your numbers as a file to keep or share.", ar: "حمّل أرقامك كملف لتحتفظ به أو تشاركه." } }
    ],
    tips: [
      { en: "Record the commission the day the deal closes, not at month end.", ar: "سجّل العمولة يوم إغلاق الصفقة لا آخر الشهر." }
    ],
    goTo: { agent: "salesdesk", agency: "salesdesk" },
    related: ["pipeline", "follow-ups"]
  },

  // ----------------------------------------------------------------------------------------------------------- growth
  {
    id: "public-page",
    category: "growth",
    audience: ALL,
    accent: "gold",
    minutes: 2,
    title: { en: "Your public page and WhatsApp kit", ar: "صفحتك العامة وأدوات واتساب" },
    summary: { en: "A page with your own link, ready to send to any client.", ar: "صفحة برابطك الخاص جاهزة لإرسالها لأي عميل." },
    why: {
      en: "One link that shows your photo, your badge, your listings and your reviews. Send it instead of a long introduction.",
      ar: "رابط واحد يعرض صورتك وشارتك وعقاراتك وتقييماتك. أرسله بدل التعريف الطويل."
    },
    steps: [
      { title: { en: "Find “Your public page” on the dashboard", ar: "ابحث عن «صفحتك العامة» في اللوحة" }, body: { en: "It shows your link and who has visited.", ar: "تعرض رابطك ومن زاره." } },
      { title: { en: "Copy the link or send it on WhatsApp", ar: "انسخ الرابط أو أرسله بواتساب" }, body: { en: "A ready message is prepared for you.", ar: "تُجهَّز لك رسالة جاهزة." } },
      { title: { en: "Share one listing", ar: "شارك عقاراً واحداً" }, body: { en: "On each listing card, “Share” gives a link, a WhatsApp message and a picture card. Visits from your shares are counted.", ar: "في كل بطاقة عقار يعطيك «مشاركة» رابطاً ورسالة واتساب وصورة. وتُحسب الزيارات القادمة من مشاركاتك." } },
      { title: { en: "Watch the numbers", ar: "تابع الأرقام" }, body: { en: "Profile visits and share visits over the last days tell you which channel brings people.", ar: "زيارات الملف وزيارات المشاركات في الأيام الأخيرة تخبرك أي قناة تجلب الناس." } }
    ],
    tips: [
      { en: "Put your link in your WhatsApp status and your Instagram bio.", ar: "ضع رابطك في حالة واتساب وفي نبذة إنستغرام." },
      { en: "Your page is public once you have a live listing or your account is verified.", ar: "تصبح صفحتك عامة عندما يكون لديك عقار منشور أو يُوثَّق حسابك." }
    ],
    goTo: { agent: "dashboard", agency: "dashboard" },
    related: ["reviews", "profile"]
  },
  {
    id: "reviews",
    category: "growth",
    audience: AGENT,
    accent: "rose",
    minutes: 2,
    title: { en: "Collect reviews and reply", ar: "اجمع التقييمات وردّ عليها" },
    summary: { en: "Ask happy clients for a review in one tap, and answer publicly.", ar: "اطلب من العميل الراضي تقييماً بضغطة، وردّ علناً." },
    why: {
      en: "Reviews are the strongest proof you have. Five honest reviews change how a stranger sees you.",
      ar: "التقييمات أقوى دليل عندك. خمسة تقييمات صادقة تغيّر نظرة الغريب إليك."
    },
    steps: [
      { title: { en: "Open Reviews", ar: "افتح «التقييمات»" }, body: { en: "The “Ask for a review” box lists the clients you spoke with.", ar: "مربع «اطلب تقييماً» يعرض العملاء الذين تواصلت معهم." } },
      { title: { en: "Send the request", ar: "أرسل الطلب" }, body: { en: "A ready WhatsApp message with your review link opens for the client.", ar: "تُفتح رسالة واتساب جاهزة برابط التقييم للعميل." } },
      { title: { en: "Reply to every review", ar: "ردّ على كل تقييم" }, body: { en: "Thank good ones. Answer a bad one calmly and with facts: everyone reads the reply.", ar: "اشكر الجيد. وردّ على السيئ بهدوء وبالوقائع: الكل يقرأ الرد." } }
    ],
    tips: [
      { en: "Ask right after a successful viewing or signing, while the feeling is fresh.", ar: "اطلب مباشرة بعد معاينة ناجحة أو توقيع، والشعور ما زال حاضراً." },
      { en: "Ask only clients you really worked with. Honest reviews are the ones that convince.", ar: "اطلب فقط من عملاء تعاملت معهم فعلاً. التقييمات الصادقة هي التي تقنع." }
    ],
    goTo: { agent: "reviews" },
    related: ["public-page", "profile"]
  },
  {
    id: "price-check",
    category: "growth",
    audience: ALL,
    accent: "violet",
    minutes: 2,
    title: { en: "“Is this price fair?” tool", ar: "أداة «هل السعر عادل؟»" },
    summary: { en: "Compare a price with the market and show the owner the proof.", ar: "قارن سعراً بالسوق وأرِ المالك الدليل." },
    why: {
      en: "Owners often ask for too much. A neutral verdict from live listings is easier to accept than your opinion.",
      ar: "المالك كثيراً ما يطلب أكثر من اللازم. حكم محايد من العقارات الحية أسهل قبولاً من رأيك."
    },
    steps: [
      { title: { en: "Open “Is this price fair?”", ar: "افتح «هل السعر عادل؟»" }, body: { en: "It is in the main site menu, and the same tool is public for visitors.", ar: "موجودة في قائمة الموقع الرئيسية، والأداة نفسها متاحة للزوار." } },
      { title: { en: "Enter the details", ar: "أدخل التفاصيل" }, body: { en: "Sale or rent, property type, area, size, bedrooms and the price.", ar: "بيع أو إيجار ونوع العقار والمنطقة والمساحة والغرف والسعر." } },
      { title: { en: "Read the verdict", ar: "اقرأ الحكم" }, body: { en: "A gauge shows whether the price is fair, high, low or suspiciously low, with similar listings under it.", ar: "مؤشر يبيّن إن كان السعر عادلاً أو مرتفعاً أو منخفضاً أو منخفضاً بشكل مريب، مع عقارات مشابهة تحته." } },
      { title: { en: "Share it", ar: "شاركه" }, body: { en: "Send the result as a picture or a link to the owner on WhatsApp.", ar: "أرسل النتيجة كصورة أو رابط للمالك على واتساب." } }
    ],
    tips: [
      { en: "If it says “not enough data”, that area has too few live listings yet. Adding yours helps everyone.", ar: "إذا قالت «بيانات غير كافية» فمنطقتك فيها عقارات حية قليلة بعد. إضافة عقاراتك تفيد الجميع." }
    ],
    goTo: {},
    link: { path: "/price-check", label: { en: "Open the price check", ar: "افتح أداة فحص السعر" } },
    related: ["listing-quality", "cma"]
  },
  {
    id: "boost",
    category: "growth",
    audience: [I],
    accent: "amber",
    minutes: 2,
    title: { en: "Boost a listing", ar: "ارفع إعلاناً" },
    summary: { en: "Two ways to put one listing in front of more people.", ar: "طريقتان لوضع عقار أمام ناس أكثر." },
    why: {
      en: "When one listing matters (an owner is waiting, a deadline is near), a boost brings it to the top.",
      ar: "حين يهمك عقار بعينه (مالك ينتظر أو موعد يقترب) يضعه الرفع في الصدارة."
    },
    steps: [
      { title: { en: "Open My Listings", ar: "افتح «عقاراتي»" }, body: { en: "Each published listing has Bump and Featured buttons.", ar: "كل عقار منشور فيه زرا «رفع» و«مميز»." } },
      { title: { en: "Choose Bump or Featured", ar: "اختر «رفع» أو «مميز»" }, body: { en: "Bump refreshes the listing's position once (49 QAR). Featured highlights it (299 QAR per week).", ar: "«الرفع» يجدّد ترتيب العقار مرة واحدة (49 ر.ق). و«المميز» يُبرزه (299 ر.ق في الأسبوع)." } },
      { title: { en: "Read the warning if there is one", ar: "اقرأ التحذير إن ظهر" }, body: { en: "If the listing is weak (no photos, no pin) the platform tells you. Fix it first, then boost.", ar: "إن كان العقار ضعيفاً (بلا صور أو دبوس) تنبّهك المنصة. أصلحه أولاً ثم ارفعه." } },
      { title: { en: "Use free credits", ar: "استعمل الأرصدة المجانية" }, body: { en: "Credits you earn from referrals are used automatically before you pay.", ar: "الأرصدة التي تكسبها من الإحالات تُستخدم تلقائياً قبل أن تدفع." } }
    ],
    tips: [
      { en: "Boosting a weak listing wastes money. Photos and price first.", ar: "رفع عقار ضعيف يضيّع المال. الصور والسعر أولاً." }
    ],
    goTo: { agent: "properties" },
    related: ["listing-quality", "referral"]
  },
  {
    id: "campaigns",
    category: "growth",
    audience: [AD],
    accent: "rose",
    minutes: 3,
    title: { en: "Ad campaigns for your agency", ar: "الحملات الإعلانية لمكتبك" },
    summary: { en: "Boost listings instantly, get smart suggestions, launch a promotion.", ar: "ارفع العقارات فوراً، وخذ اقتراحات ذكية، وأطلق ترويجاً." },
    why: {
      en: "Spend where it works: the tool suggests which listings deserve a boost and your spending is tracked in one ledger.",
      ar: "أنفق حيث ينفع: الأداة تقترح العقارات التي تستحق الرفع وإنفاقك مسجَّل في سجل واحد."
    },
    steps: [
      { title: { en: "Instant boosts", ar: "الرفع الفوري" }, body: { en: "Each listing of the agency has boost buttons. No approval needed. Needs an active subscription.", ar: "لكل عقار في المكتب أزرار رفع. لا حاجة لموافقة. يتطلب اشتراكاً فعالاً." } },
      { title: { en: "Read the smart recommendations", ar: "اقرأ التوصيات الذكية" }, body: { en: "“Recommended to boost” points at listings with good potential and tells you why.", ar: "«موصى برفعه» يشير إلى عقارات ذات إمكانات جيدة ويقول السبب." } },
      { title: { en: "Launch a promotion", ar: "أطلق ترويجاً" }, body: { en: "Choose a listing, a budget in QAR and the period. Track its results afterwards.", ar: "اختر عقاراً وميزانية بالريال وفترة. وتابع نتائجه بعد ذلك." } },
      { title: { en: "Check the ledger", ar: "راجع السجل" }, body: { en: "Billing shows every ad charge for the month and what has been settled.", ar: "«الاشتراك والفواتير» تعرض كل رسوم الإعلانات للشهر وما سُوّي منها." } }
    ],
    tips: [
      { en: "Boost listings that already have good photos and a fair price.", ar: "ارفع العقارات التي لها صور جيدة وسعر عادل." }
    ],
    goTo: { agency: "campaigns" },
    related: ["billing", "agency-listings"]
  },
  {
    id: "cma",
    category: "growth",
    audience: AGENT,
    accent: "indigo",
    minutes: 2,
    title: { en: "Market analysis report (PDF)", ar: "تقرير تحليل السوق (PDF)" },
    summary: { en: "A professional report to win an owner's listing.", ar: "تقرير احترافي لتكسب عقار المالك." },
    why: {
      en: "When you meet a new owner, a report comparing their property to the market shows you are serious, with numbers.",
      ar: "عند لقاء مالك جديد، تقرير يقارن عقاره بالسوق يريه أنك جاد وبالأرقام."
    },
    steps: [
      { title: { en: "Open My Listings", ar: "افتح «عقاراتي»" }, body: { en: "Find the listing, or add it as a draft first.", ar: "اختر العقار أو أضفه كمسودة أولاً." } },
      { title: { en: "Press “CMA Report”", ar: "اضغط «تقرير تحليل السوق»" }, body: { en: "The platform compares it with similar listings around it.", ar: "تقارنه المنصة بعقارات مشابهة حوله." } },
      { title: { en: "Download and send", ar: "حمّل وأرسل" }, body: { en: "A PDF with your name and your agency, ready for the owner.", ar: "ملف PDF باسمك واسم مكتبك جاهز للمالك." } }
    ],
    tips: [
      { en: "Pair it with the price check: report for depth, verdict picture for a quick message.", ar: "اجمعه مع أداة السعر: التقرير للتفاصيل وصورة الحكم لرسالة سريعة." }
    ],
    goTo: { agent: "properties" },
    related: ["price-check", "listing-quality"]
  },
  {
    id: "referral",
    category: "growth",
    audience: AGENT,
    accent: "teal",
    minutes: 1,
    title: { en: "Invite colleagues and earn", ar: "ادعُ زملاءك واربح" },
    summary: { en: "Every successful invitation earns you a free boost.", ar: "كل دعوة ناجحة تكسبك رفعاً مجانياً." },
    why: {
      en: "A bigger platform brings more clients to everyone, and each colleague who joins earns you free boost credits.",
      ar: "منصة أكبر تجلب عملاء أكثر للجميع، وكل زميل ينضم يكسبك أرصدة رفع مجانية."
    },
    steps: [
      { title: { en: "Find “Invite & Earn”", ar: "ابحث عن «ادعُ واربح»" }, body: { en: "On your dashboard.", ar: "في لوحتك." } },
      { title: { en: "Copy your link or code", ar: "انسخ رابطك أو كودك" }, body: { en: "Send it to a colleague you trust.", ar: "أرسله لزميل تثق به." } },
      { title: { en: "Watch the counter", ar: "تابع العدّاد" }, body: { en: "It shows successful referrals and the free credits you have.", ar: "يعرض الإحالات الناجحة والأرصدة المجانية التي لديك." } }
    ],
    tips: [
      { en: "Invite people who actually have listings, not just any contact.", ar: "ادعُ من لديهم عقارات فعلاً لا أي جهة اتصال." }
    ],
    goTo: { agent: "dashboard" },
    related: ["boost", "public-page"]
  },

  // -------------------------------------------------------------------------------------------------------- the team
  {
    id: "team",
    category: "team",
    audience: [AD],
    accent: "violet",
    minutes: 3,
    title: { en: "Invite and manage your agents", ar: "ادعُ وسطاءك وأدرهم" },
    summary: { en: "Bring your brokers in, see how each one performs.", ar: "أدخل وسطاءك وشاهد أداء كل واحد." },
    why: {
      en: "Your agents work under your agency's name and subscription. You see their listings and leads and can tell who is doing well.",
      ar: "وسطاؤك يعملون باسم مكتبك واشتراكه. ترى عقاراتهم وعملاءهم وتعرف من يتفوق."
    },
    steps: [
      { title: { en: "Open Agents Team", ar: "افتح «فريق العمل»" }, body: { en: "The list of your active brokers is on the left, the invite form beside it.", ar: "قائمة وسطائك الفعالين على اليسار ونموذج الدعوة بجانبها." } },
      { title: { en: "Invite by email", ar: "ادعُ بالبريد" }, body: { en: "Enter the broker's name and email. They get an invitation to join your workspace.", ar: "أدخل اسم الوسيط وبريده. تصله دعوة للانضمام إلى مساحة مكتبك." } },
      { title: { en: "Watch pending invitations", ar: "تابع الدعوات المعلّقة" }, body: { en: "A gold number on the menu counts invitations not answered yet.", ar: "الرقم الذهبي في القائمة يعدّ الدعوات التي لم يُرد عليها." } },
      { title: { en: "Compare agents", ar: "قارن الوسطاء" }, body: { en: "Sort by name, listings, leads or conversion to see who needs help and who deserves praise.", ar: "رتّب بالاسم أو العقارات أو العملاء أو التحويل لتعرف من يحتاج مساعدة ومن يستحق الثناء." } }
    ],
    tips: [
      { en: "Ask each new agent to complete their profile and verification on day one.", ar: "اطلب من كل وسيط جديد إكمال ملفه وتوثيقه في اليوم الأول." }
    ],
    goTo: { agency: "team" },
    related: ["agency-leads", "agency-listings"]
  },

  // ---------------------------------------------------------------------------------------------------- plan & billing
  {
    id: "plan",
    category: "account",
    audience: [I],
    accent: "violet",
    minutes: 1,
    title: { en: "Your subscription", ar: "اشتراكك" },
    summary: { en: "Your plan, its status and when it renews.", ar: "خطتك وحالتها وموعد تجديدها." },
    why: {
      en: "An active subscription keeps your listings live. Knowing the renewal date avoids an unpleasant surprise.",
      ar: "الاشتراك الفعال يبقي عقاراتك منشورة. ومعرفة موعد التجديد تجنبك مفاجأة غير سارة."
    },
    steps: [
      { title: { en: "Open Subscription", ar: "افتح «الاشتراك»" }, body: { en: "Under Account in the menu.", ar: "تحت «الحساب» في القائمة." } },
      { title: { en: "Read plan, status and expiry", ar: "اقرأ الخطة والحالة والانتهاء" }, body: { en: "Active, pending approval, suspended or cancelled, with the expiry date.", ar: "فعّال أو بانتظار الموافقة أو موقوف أو ملغى، مع تاريخ الانتهاء." } },
      { title: { en: "Renewal", ar: "التجديد" }, body: { en: "The Nerou Finder team activates and renews your plan after contacting you and confirming payment. There is no self-service payment here.", ar: "فريق نيرو فايندر يفعّل خطتك ويجددها بعد التواصل معك وتأكيد الدفع. لا يوجد دفع ذاتي هنا." } }
    ],
    tips: [
      { en: "A banner on the dashboard warns you before the plan expires.", ar: "لافتة في اللوحة تنبهك قبل انتهاء الخطة." }
    ],
    goTo: { agent: "subscription" },
    related: ["dashboard"]
  },
  {
    id: "billing",
    category: "account",
    audience: [AD],
    accent: "teal",
    minutes: 2,
    title: { en: "Billing and ad charges", ar: "الفواتير ورسوم الإعلانات" },
    summary: { en: "Your plan, ad spending for the month and the payment history.", ar: "خطتك وإنفاق الإعلانات في الشهر وسجل المدفوعات." },
    why: {
      en: "One page to know what the agency owes, what it has paid and what each boost cost.",
      ar: "صفحة واحدة لمعرفة ما على المكتب وما دفعه وكم كلّف كل رفع."
    },
    steps: [
      { title: { en: "Open Billing", ar: "افتح «الاشتراك والفواتير»" }, body: { en: "Under Account in the menu.", ar: "تحت «الحساب» في القائمة." } },
      { title: { en: "Ad billing summary", ar: "ملخص فوترة الإعلانات" }, body: { en: "Total, settled and outstanding for the current month.", ar: "الإجمالي والمسوّى والمتبقي للشهر الحالي." } },
      { title: { en: "Plan and invoices", ar: "الخطة والفواتير" }, body: { en: "Your subscription plan, its status and the payment history below.", ar: "خطة اشتراكك وحالتها وسجل المدفوعات تحتها." } }
    ],
    tips: [
      { en: "A renewal banner shows on the dashboard when the plan is close to ending.", ar: "تظهر لافتة تجديد في اللوحة عندما تقترب الخطة من الانتهاء." }
    ],
    goTo: { agency: "subscription" },
    related: ["campaigns", "team"]
  }
];
