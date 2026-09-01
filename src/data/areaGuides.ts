/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Hand-curated Doha area guide content (SEO landing pages - see AreaGuideView.tsx / server.ts's
// GET /api/areas & GET /api/areas/:slug and the /areas/:slug SPA-shell SEO route). This is a
// static dataset, not a persisted DB table - there is nothing here an admin edits at runtime,
// so it lives in source alongside the code that renders it, the same way DOHA_METRO_STATIONS
// lives in types.ts and DOHA_LANDMARKS lives in lib/nearbyPlaces.ts.
//
// Content is deliberately general/descriptive (well-known facts about each area's character,
// landmarks, and typical property types) rather than citing specific statistics, prices, school
// names, or amenity counts we can't verify - anything numeric (avg price/sqm, live listing
// count) is instead pulled live from GET /api/areas/:slug, which reuses the same
// computeMarketIndexGroups() aggregation as GET /api/market-index (see server.ts).
//
// `district` below is not a free label - it must exactly match the `name` of a real AREA/
// DISTRICT LocationItem in server-db.ts's DEFAULT_LOCATIONS, because that's the exact string
// AgentWorkspace.tsx writes into a new Property's `district` field when an agent picks that
// location from the listing form's dropdown (see AgentWorkspace.tsx's location-resolution
// logic around its property submit handler). Matching this exactly is what lets the live
// stats lookup and the "View listings" CTA's search pre-filter actually find real listings.
export interface AreaGuide {
  id: string;
  slug: string;
  district: string; // must match a DEFAULT_LOCATIONS AREA/DISTRICT `name` exactly
  cityLabel: string; // display-only context (e.g. "Doha Municipality") - never used for filtering
  cityLabelAr: string;
  title: string;
  titleAr: string;
  overview: string;
  overviewAr: string;
  highlights: string[];
  highlightsAr: string[];
}

export const AREA_GUIDES: AreaGuide[] = [
  {
    id: "guide-west-bay",
    slug: "west-bay",
    district: "West Bay",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "West Bay, Doha — Area Guide",
    titleAr: "دليل منطقة الخليج الغربي، الدوحة",
    overview:
      "West Bay is Doha's modern high-rise business and diplomatic district, hugging the northern curve of the Corniche just beyond the older city center. Its skyline of glass towers houses many of Qatar's corporate headquarters, government offices, and foreign embassies, alongside a cluster of five-star hotels and the Doha Exhibition and Convention Centre. Residentially, West Bay is dominated by high-rise apartment towers and serviced residences, making it a popular base for expatriate professionals who want a short commute to the business district and easy access to the waterfront promenade. The area sits within easy walking or driving distance of the Museum of Islamic Art, the Corniche's landscaped parks, and West Bay Lagoon's upscale villa communities just to its north. It is well served by the Doha Metro's Red Line, with several stations giving quick connections to Msheireb, the airport, and the wider city. Life here tends to be vertical and convenience-oriented: residents typically have access to building amenities like gyms, pools, and covered parking, and dining options range from hotel restaurants to casual cafes at street level. For anyone whose priority is proximity to Doha's commercial core and skyline views, West Bay remains one of the city's most recognizable addresses.",
    overviewAr:
      "الخليج الغربي هو الحي التجاري والدبلوماسي الحديث في الدوحة، ويمتد على طول الجزء الشمالي من الكورنيش، على مقربة من قلب المدينة القديم. تضم واجهته الزجاجية العديد من المقرات الرئيسية للشركات القطرية، والمكاتب الحكومية، والسفارات الأجنبية، إلى جانب مجموعة من الفنادق الفخمة ومركز الدوحة للمعارض والمؤتمرات. من الناحية السكنية، يغلب على المنطقة أبراج الشقق الشاهقة والوحدات السكنية المخدومة، ما يجعلها وجهة مفضلة للمهنيين الوافدين الباحثين عن قرب من الحي التجاري وسهولة الوصول إلى الواجهة البحرية. تقع المنطقة على مسافة قريبة سيراً أو بالسيارة من متحف الفن الإسلامي، والحدائق المطلة على الكورنيش، ومجتمعات الفلل الراقية في بحيرة الخليج الغربي المجاورة شمالاً. كما ترتبط المنطقة بخط المترو الأحمر عبر عدة محطات توفر وصولاً سريعاً إلى مشيرب والمطار وباقي أنحاء المدينة. تتميز الحياة هنا بطابعها العمودي والعملي، إذ يتمتع السكان عادة بمرافق داخل الأبراج كالصالات الرياضية وحمامات السباحة ومواقف مغطاة، مع خيارات متنوعة للطعام من مطاعم الفنادق إلى المقاهي على مستوى الشارع. لمن يبحث عن القرب من قلب الدوحة التجاري وإطلالات الأفق، يبقى الخليج الغربي من أبرز عناوين المدينة.",
    highlights: [
      "Doha's primary business & diplomatic high-rise district",
      "Directly on the Corniche waterfront promenade",
      "Doha Metro Red Line access (multiple stations)",
      "Mostly high-rise apartment towers & serviced residences",
      "Walking distance to the Museum of Islamic Art"
    ],
    highlightsAr: [
      "الحي التجاري والدبلوماسي الرئيسي في الدوحة بأبراجه الشاهقة",
      "يقع مباشرة على واجهة الكورنيش البحرية",
      "يخدمه خط المترو الأحمر عبر عدة محطات",
      "يغلب عليه أبراج الشقق السكنية والوحدات المخدومة",
      "على مسافة قريبة سيراً من متحف الفن الإسلامي"
    ]
  },
  {
    id: "guide-the-pearl-qatar",
    slug: "the-pearl",
    district: "The Pearl-Qatar",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "The Pearl-Qatar — Area Guide",
    titleAr: "دليل منطقة لؤلؤة قطر",
    overview:
      "The Pearl-Qatar is a man-made island development off the coast of West Bay Lagoon, built around a series of marinas and Mediterranean-inspired town squares. It's organized into distinct precincts - among them Porto Arabia, Viva Bahriya, Qanat Quartier, and Medina Centrale - each with its own architectural character, from marina-facing towers to Venice-style canal streets. The island is known for upscale, waterfront living: apartments, townhouses, and villas line pedestrian promenades lined with cafes, restaurants, and boutique retail, with private yacht berths available along much of the marina frontage. It attracts a mix of expatriate professionals and Qatari families drawn to its walkable, low-traffic streets and resort-style amenities. Because it was purpose-built as a single master-planned community, infrastructure - underground parking, landscaped walkways, retail at ground level - tends to be newer and more consistent than in older parts of Doha. The Pearl connects to the mainland via the Al Qassar Street bridge near West Bay, putting West Bay's business district and the Corniche within a short drive. For buyers or renters prioritizing a marina lifestyle, dining and retail on their doorstep, and a distinctly different streetscape from the rest of Doha, the Pearl-Qatar is one of the city's most established premium addresses.",
    overviewAr:
      "لؤلؤة قطر جزيرة اصطناعية قبالة سواحل بحيرة الخليج الغربي، صُممت حول سلسلة من المراسي والساحات ذات الطابع المتوسطي. تنقسم الجزيرة إلى أحياء متميزة أبرزها بورتو أرابيا وفيفا بحرية وقناة كارتييه ومدينا سنترال، ولكل منها طابعها المعماري الخاص، من الأبراج المطلة على المرسى إلى الشوارع ذات القنوات المائية المستوحاة من البندقية. تشتهر الجزيرة بأسلوب الحياة الراقي على الواجهة البحرية، حيث تصطف الشقق والتاون هاوس والفلل على ممرات مشاة تحيط بها المقاهي والمطاعم والمحال التجارية، مع مراسي خاصة لليخوت على امتداد واجهة المارينا. تجذب الجزيرة مزيجاً من المهنيين الوافدين والعائلات القطرية الباحثين عن شوارع هادئة يمكن التنقل فيها سيراً على الأقدام ومرافق بمستوى المنتجعات. ونظراً لكونها مجتمعاً مخططاً بالكامل منذ البداية، فإن بنيتها التحتية - من مواقف السيارات تحت الأرض إلى الممرات المشجرة والمحال التجارية على مستوى الأرض - تميل لأن تكون أحدث وأكثر انسجاماً مقارنة بأجزاء أخرى من الدوحة. تتصل اللؤلؤة بالبر الرئيسي عبر جسر قريب من الخليج الغربي، ما يجعل الحي التجاري والكورنيش على مسافة قريبة بالسيارة. لمن يبحث عن أسلوب حياة المارينا مع قرب المطاعم والمحال، تبقى لؤلؤة قطر من أبرز العناوين الراقية في المدينة.",
    highlights: [
      "Man-made marina island with distinct themed precincts",
      "Waterfront apartments, townhouses & villas with yacht berths",
      "Walkable promenades with cafes, dining & boutique retail",
      "Master-planned infrastructure & underground parking",
      "Short drive to West Bay and the Corniche"
    ],
    highlightsAr: [
      "جزيرة مرسى اصطناعية تضم أحياء متميزة بطابع خاص",
      "شقق وتاون هاوس وفلل على الواجهة البحرية مع مراسي لليخوت",
      "ممرات مشاة قابلة للتنقل سيراً بها مقاهي ومطاعم ومحال بوتيك",
      "بنية تحتية مخططة بالكامل مع مواقف تحت الأرض",
      "مسافة قصيرة بالسيارة إلى الخليج الغربي والكورنيش"
    ]
  },
  {
    id: "guide-lusail",
    slug: "lusail-city",
    district: "Lusail",
    cityLabel: "Al Daayen Municipality",
    cityLabelAr: "بلدية الظعاين",
    title: "Lusail — Area Guide",
    titleAr: "دليل مدينة لوسيل",
    overview:
      "Lusail is a purpose-built new city on Doha's northern coastline, planned from the ground up as a mixed-use urban center rather than growing organically like older parts of Qatar. It includes distinct sub-districts such as Marina District, Fox Hills, the Waterfront District, and Lusail Boulevard, each offering a mix of residential towers, townhouses, retail, and office space. The city gained global attention as host of Lusail Stadium, the venue for the 2022 FIFA World Cup final, and its Marina District and boulevard areas continue to develop as retail and entertainment hubs. A dedicated light rail system, the Lusail Tram, connects several districts within the city, complementing road links to central Doha a short drive south. Because Lusail was built as new infrastructure rather than retrofitted into an existing neighborhood, residents generally benefit from wider roads, underground utilities, and coordinated landscaping across the whole development. It has become a popular choice for young professionals and families looking for modern, newly built apartments and townhouses, often at a different price point and with different amenities than comparable units in older, more established Doha districts. With ongoing construction across several of its precincts, Lusail continues to expand as one of Qatar's most significant urban development projects.",
    overviewAr:
      "لوسيل مدينة جديدة مخططة بالكامل على الساحل الشمالي للدوحة، صُممت منذ البداية كمركز حضري متعدد الاستخدامات بدلاً من أن تنمو تدريجياً كما هو الحال في أحياء قطر الأقدم. تضم المدينة أحياءً فرعية متميزة مثل حي المارينا وفوكس هيلز والمنطقة البحرية وبوليفارد لوسيل، ويقدم كل منها مزيجاً من الأبراج السكنية والتاون هاوس والمحال التجارية والمساحات المكتبية. اكتسبت المدينة شهرة عالمية كونها موطن استاد لوسيل، الذي استضاف نهائي كأس العالم لكرة القدم 2022، وتواصل مناطق المارينا والبوليفارد فيها تطورها كمراكز للتجزئة والترفيه. ويربط ترام لوسيل، وهو نظام قطار خفيف مخصص، عدداً من أحياء المدينة، إلى جانب الطرق الرئيسية التي تصلها بوسط الدوحة على بعد مسافة قصيرة بالسيارة جنوباً. ولأن لوسيل بُنيت كبنية تحتية جديدة بالكامل بدلاً من إضافتها إلى حي قائم، يستفيد سكانها عموماً من طرق أوسع ومرافق تحت الأرض وتنسيق موحد للمساحات الخضراء في أنحاء المدينة. أصبحت لوسيل خياراً شائعاً بين المهنيين الشباب والعائلات الباحثين عن شقق وتاون هاوس حديثة البناء، غالباً بأسعار ومزايا مختلفة عن الوحدات المماثلة في أحياء الدوحة الأقدم. ومع استمرار أعمال البناء في عدد من أحيائها، تواصل لوسيل توسعها كواحدة من أبرز مشاريع التطوير الحضري في قطر.",
    highlights: [
      "Purpose-built new city with modern, coordinated infrastructure",
      "Sub-districts include Marina District, Fox Hills & Lusail Boulevard",
      "Home to Lusail Stadium (2022 FIFA World Cup final venue)",
      "Dedicated Lusail Tram light-rail network",
      "Mostly newly built apartments and townhouses"
    ],
    highlightsAr: [
      "مدينة جديدة مخططة بالكامل ببنية تحتية حديثة ومنسقة",
      "تضم أحياءً فرعية منها المارينا وفوكس هيلز وبوليفارد لوسيل",
      "موطن استاد لوسيل الذي استضاف نهائي كأس العالم 2022",
      "شبكة ترام لوسيل المخصصة للقطار الخفيف",
      "يغلب عليها الشقق والتاون هاوس حديثة البناء"
    ]
  },
  {
    id: "guide-al-sadd",
    slug: "al-sadd",
    district: "Al Sadd",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "Al Sadd, Doha — Area Guide",
    titleAr: "دليل منطقة السد، الدوحة",
    overview:
      "Al Sadd is an established, centrally located neighborhood in Doha, known for its mix of older and newer apartment buildings alongside a busy commercial strip. The area takes its name from Al Sadd Sports Club, one of Qatar's prominent football clubs, whose stadium anchors the district. Al Sadd Metro Station serves as a major interchange between the Red and Gold Lines, making the area one of the more transit-connected parts of the city. Its central position means residents are close to City Center Doha mall, numerous restaurants and cafes, and a wide range of everyday retail and services along its main roads. Compared to newer waterfront districts like West Bay or the Pearl, Al Sadd tends to offer more moderately priced apartment rentals, which has made it a long-standing draw for a broad mix of residents, from young professionals to families. Streets here carry a distinctly lived-in, city-center character rather than the master-planned feel of Doha's newer developments, with a dense concentration of shops, clinics, and small businesses interspersed among residential blocks. For anyone prioritizing central location, metro access, and everyday convenience over waterfront views, Al Sadd remains one of Doha's most practical and well-connected neighborhoods.",
    overviewAr:
      "السد حي راسخ ومتوسط الموقع في الدوحة، يُعرف بمزيج من المباني السكنية القديمة والحديثة إلى جانب شارع تجاري نشط. يحمل الحي اسمه من نادي السد الرياضي، أحد أبرز أندية كرة القدم في قطر، الذي يقع ملعبه في قلب المنطقة. وتُعد محطة مترو السد نقطة تحويل رئيسية بين الخطين الأحمر والذهبي، ما يجعل المنطقة من أكثر أجزاء المدينة ارتباطاً بشبكة النقل. وبفضل موقعه المركزي، يجد سكان الحي أنفسهم قريبين من مجمع سيتي سنتر الدوحة والعديد من المطاعم والمقاهي، إلى جانب مجموعة واسعة من المحال التجارية والخدمات اليومية على طول شوارعه الرئيسية. ومقارنة بالأحياء الساحلية الأحدث مثل الخليج الغربي أو اللؤلؤة، يميل السد إلى تقديم إيجارات شقق أكثر اعتدالاً، ما جعله وجهة طويلة الأمد لشريحة واسعة من السكان، من المهنيين الشباب إلى العائلات. وتحمل شوارع الحي طابعاً حضرياً مأهولاً مميزاً بدلاً من الطابع المخطط للمشاريع الحديثة في الدوحة، مع تركز كثيف للمحال والعيادات والمشاريع الصغيرة بين الكتل السكنية. لمن يضع الموقع المركزي وسهولة الوصول بالمترو والراحة اليومية في مقدمة أولوياته، يبقى السد من أكثر أحياء الدوحة عملية وارتباطاً بشبكة النقل.",
    highlights: [
      "Central Doha location with a busy commercial main strip",
      "Al Sadd Metro Station — Red/Gold Line interchange",
      "Home to Al Sadd Sports Club's stadium",
      "Close to City Center Doha mall",
      "Generally more moderately priced than waterfront districts"
    ],
    highlightsAr: [
      "موقع مركزي في الدوحة مع شارع تجاري رئيسي نشط",
      "محطة مترو السد نقطة تحويل بين الخطين الأحمر والذهبي",
      "موطن ملعب نادي السد الرياضي",
      "قريب من مجمع سيتي سنتر الدوحة",
      "إيجارات أكثر اعتدالاً عموماً مقارنة بالأحياء الساحلية"
    ]
  },
  {
    id: "guide-al-waab",
    slug: "al-waab",
    district: "Al Waab",
    cityLabel: "Al Rayyan Municipality",
    cityLabelAr: "بلدية الريان",
    title: "Al Waab, Doha — Area Guide",
    titleAr: "دليل منطقة الوعب، الدوحة",
    overview:
      "Al Waab is a residential area within Al Rayyan Municipality, known primarily for its villas, gated compounds, and townhouses rather than high-rise living. It has a quieter, more suburban character than central Doha, making it a popular choice for families looking for houses with private outdoor space and access to community amenities. The district is home to Villaggio Mall, one of Doha's well-known shopping and entertainment centers, as well as Aspire Park and the surrounding Aspire Zone sports complex, which includes Khalifa International Stadium. This combination of green space, retail, and sports facilities gives Al Waab a family-oriented identity distinct from Doha's commercial core. Compound living is common here, with many developments offering shared pools, playgrounds, and sometimes gyms within a secured, low-traffic setting - an arrangement often preferred by families with young children. The area is served by the Doha Metro's Green Line, with a station giving a direct connection toward the city center and other parts of the network. While it sits further from the waterfront districts, Al Waab's balance of villas, parks, and everyday amenities has made it a consistently popular residential choice for expatriate and local families alike.",
    overviewAr:
      "الوعب منطقة سكنية ضمن بلدية الريان، تشتهر بشكل أساسي بالفلل والمجمعات السكنية المغلقة والتاون هاوس بدلاً من الأبراج الشاهقة. تتميز المنطقة بطابع هادئ أقرب إلى الضواحي مقارنة بوسط الدوحة، ما يجعلها خياراً مفضلاً للعائلات الباحثة عن منازل ذات مساحات خارجية خاصة وقربها من المرافق المجتمعية. تضم المنطقة مجمع فيلاجيو، أحد أبرز مراكز التسوق والترفيه في الدوحة، إلى جانب حديقة أسباير ومجمع أسباير الرياضي المحيط بها الذي يشمل استاد خليفة الدولي. هذا المزيج من المساحات الخضراء والمحال التجارية والمرافق الرياضية يمنح الوعب هوية عائلية مميزة تختلف عن قلب الدوحة التجاري. يشيع السكن في المجمعات السكنية هنا، حيث تقدم العديد من المشاريع مسابح ومناطق ألعاب مشتركة وأحياناً صالات رياضية ضمن بيئة آمنة وهادئة الحركة، وهو ترتيب تفضله غالباً العائلات ذات الأطفال الصغار. تخدم المنطقة محطة على خط المترو الأخضر، ما يوفر اتصالاً مباشراً نحو وسط المدينة وباقي أجزاء الشبكة. ورغم بعدها نسبياً عن الأحياء الساحلية، فإن التوازن الذي تقدمه الوعب بين الفلل والحدائق والمرافق اليومية جعلها خياراً سكنياً ثابت الشعبية لدى العائلات الوافدة والمحلية على حد سواء.",
    highlights: [
      "Predominantly villas, gated compounds & townhouses",
      "Home to Villaggio Mall and Aspire Park",
      "Adjacent to Aspire Zone & Khalifa International Stadium",
      "Family-oriented, lower-traffic suburban character",
      "Served by a Doha Metro Green Line station"
    ],
    highlightsAr: [
      "يغلب عليها الفلل والمجمعات السكنية المغلقة والتاون هاوس",
      "موطن مجمع فيلاجيو وحديقة أسباير",
      "مجاورة لمجمع أسباير الرياضي واستاد خليفة الدولي",
      "طابع عائلي هادئ أقرب إلى الضواحي",
      "تخدمها محطة على خط المترو الأخضر"
    ]
  },
  {
    id: "guide-old-airport",
    slug: "old-airport",
    district: "Old Airport",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "Old Airport, Doha — Area Guide",
    titleAr: "دليل منطقة المطار القديم، الدوحة",
    overview:
      "Old Airport is a centrally located, long-established Doha neighborhood named after the former Doha International Airport site that once occupied the area. It's a predominantly residential district with a mix of low- and mid-rise apartment buildings and standalone villas, reflecting decades of steady development rather than a single master-planned scheme. Its central position places it within easy reach of Hamad Hospital, various government offices, and the main commercial corridors that connect to neighboring districts like Al Sadd and Bin Mahmoud. As one of Doha's more established communities, Old Airport has a settled, lived-in character, with long-time residents alongside newer arrivals, and a street-level mix of grocery stores, restaurants, and small businesses. In recent years the area has seen newer residential developments alongside its older housing stock, gradually diversifying the type and age of properties available. Rents here are generally positioned below the newer waterfront districts, which continues to make Old Airport an attractive, practical option for residents who want a central Doha location without the premium pricing of West Bay or the Pearl-Qatar. Its mix of accessibility, established infrastructure, and comparatively moderate pricing keeps it a consistently in-demand residential area.",
    overviewAr:
      "المطار القديم حي راسخ ومتوسط الموقع في الدوحة، سُمّي بهذا الاسم نسبة إلى موقع مطار الدوحة الدولي السابق الذي كان قائماً في المنطقة. وهو حي سكني في الغالب يضم مزيجاً من المباني السكنية المنخفضة والمتوسطة الارتفاع إلى جانب الفلل المستقلة، ما يعكس عقوداً من التطور التدريجي بدلاً من مخطط واحد شامل. يتيح موقعه المركزي سهولة الوصول إلى مستشفى حمد وعدد من المكاتب الحكومية والممرات التجارية الرئيسية التي تربطه بأحياء مجاورة مثل السد وبن محمود. وباعتباره أحد أكثر مجتمعات الدوحة استقراراً، يحمل المطار القديم طابعاً مأهولاً ومستقراً، حيث يتعايش سكان قدامى مع وافدين جدد، مع مزيج على مستوى الشارع من محال البقالة والمطاعم والمشاريع الصغيرة. وشهدت المنطقة في السنوات الأخيرة مشاريع سكنية أحدث إلى جانب المخزون السكني القديم، ما نوّع تدريجياً في نوع الوحدات المتاحة وعمرها. وتميل الإيجارات هنا لأن تكون أقل من الأحياء الساحلية الأحدث، ما يبقي المطار القديم خياراً عملياً وجذاباً لمن يبحث عن موقع مركزي في الدوحة دون الأسعار المرتفعة للخليج الغربي أو لؤلؤة قطر. ويجعل هذا المزيج من سهولة الوصول والبنية التحتية الراسخة والأسعار المعتدلة نسبياً هذا الحي مطلوباً باستمرار.",
    highlights: [
      "Central, long-established residential district",
      "Mix of low/mid-rise apartments and standalone villas",
      "Close to Hamad Hospital and government offices",
      "Neighbors Al Sadd and Bin Mahmoud",
      "Generally more moderately priced than waterfront areas"
    ],
    highlightsAr: [
      "حي سكني راسخ في موقع مركزي",
      "مزيج من الشقق المنخفضة والمتوسطة الارتفاع والفلل المستقلة",
      "قريب من مستشفى حمد والمكاتب الحكومية",
      "يجاور حيي السد وبن محمود",
      "أسعار أكثر اعتدالاً عموماً مقارنة بالأحياء الساحلية"
    ]
  },
  {
    id: "guide-msheireb-downtown",
    slug: "msheireb",
    district: "Msheireb Downtown",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "Msheireb Downtown, Doha — Area Guide",
    titleAr: "دليل مشيرب قلب الدوحة",
    overview:
      "Msheireb Downtown is a large-scale downtown regeneration project in the heart of old Doha, built on the site of the city's historic commercial center. It's frequently cited as one of the world's most ambitious sustainable urban regeneration developments, blending traditional Qatari architectural motifs - wind towers, shaded courtyards, mashrabiya screens - with modern building technology and pedestrian-first street design. The district sits directly adjacent to Souq Waqif and the Amiri Diwan, and includes a mix of residential buildings, retail, office space, and several museums housed in restored historic heritage houses. Streets are designed to be walkable and shaded, a deliberate contrast to the car-oriented layout of much of the rest of the city. Msheireb Metro Station, located within the district, functions as the central interchange connecting all three lines of the Doha Metro network, making it one of the most transit-accessible locations in Qatar. Because the entire district was developed as a single coordinated project, its residential offerings tend to be newer, architecturally distinctive, and positioned toward buyers and renters who value walkability, cultural proximity, and design over sheer scale. For anyone wanting to live within walking distance of Doha's historic core while still being close to modern amenities, Msheireb offers a distinctive alternative to both the older city fabric and the newer waterfront towers.",
    overviewAr:
      "مشيرب قلب الدوحة مشروع ضخم لإعادة تطوير وسط المدينة في قلب الدوحة القديمة، أُقيم على موقع المركز التجاري التاريخي للمدينة. ويُذكر غالباً كأحد أكثر مشاريع إعادة التطوير الحضري المستدام طموحاً في العالم، إذ يمزج بين العناصر المعمارية القطرية التقليدية - كأبراج الرياح والأفنية المظللة والمشربيات - وبين تقنيات البناء الحديثة وتصميم شوارع يراعي المشاة أولاً. يقع الحي مباشرة بجوار سوق واقف والديوان الأميري، ويضم مزيجاً من المباني السكنية والمحال التجارية والمساحات المكتبية إلى جانب عدد من المتاحف داخل بيوت تراثية تاريخية تم ترميمها. صُممت الشوارع لتكون قابلة للتنقل سيراً ومظللة، في تباين متعمد مع التصميم المعتمد على السيارات في معظم أجزاء المدينة الأخرى. وتُعد محطة مترو مشيرب، الواقعة داخل الحي، نقطة التحويل المركزية التي تربط الخطوط الثلاثة لشبكة مترو الدوحة، ما يجعلها من أكثر المواقع ارتباطاً بشبكة النقل في قطر. ولأن الحي بأكمله طُوّر كمشروع واحد منسق، فإن وحداته السكنية تميل لأن تكون أحدث وذات طابع معماري مميز، وتستهدف مشترين ومستأجرين يقدّرون إمكانية التنقل سيراً والقرب الثقافي والتصميم أكثر من المساحة وحدها. لمن يرغب في السكن على مسافة قريبة سيراً من قلب الدوحة التاريخي مع البقاء قريباً من المرافق الحديثة، يقدم مشيرب بديلاً مميزاً عن النسيج العمراني القديم وأبراج الواجهة البحرية الحديثة على حد سواء.",
    highlights: [
      "Large-scale downtown regeneration on Doha's historic center",
      "Traditional Qatari architecture blended with modern design",
      "Adjacent to Souq Waqif and the Amiri Diwan",
      "Msheireb Metro Station — interchange for all three lines",
      "Walkable, pedestrian-first street layout"
    ],
    highlightsAr: [
      "مشروع كبير لإعادة تطوير وسط الدوحة التاريخي",
      "عمارة قطرية تقليدية ممزوجة بتصميم حديث",
      "مجاور لسوق واقف والديوان الأميري",
      "محطة مترو مشيرب نقطة تحويل بين الخطوط الثلاثة",
      "تصميم شوارع يراعي المشاة ويسهل التنقل سيراً"
    ]
  },
  {
    id: "guide-bin-mahmoud",
    slug: "bin-mahmoud",
    district: "Bin Mahmoud",
    cityLabel: "Doha Municipality",
    cityLabelAr: "بلدية الدوحة",
    title: "Bin Mahmoud, Doha — Area Guide",
    titleAr: "دليل منطقة بن محمود، الدوحة",
    overview:
      "Bin Mahmoud is a centrally located, well-established residential district popular for its relatively affordable apartment living compared to Doha's waterfront areas. It sits close to Al Sadd and Al Nasr, within Doha's dense commercial belt, and is known for walkable streets lined with cafes, restaurants, bakeries, and everyday grocery stores. The district's apartment buildings span several eras of construction, giving it a varied streetscape rather than the uniform look of a single master-planned development. This mix, combined with its central location, has long made Bin Mahmoud a popular choice for expatriate singles, couples, and young families who prioritize convenience and a lively street-level atmosphere over waterfront views or resort-style amenities. The area is served by the Doha Metro's Green Line, with a dedicated Bin Mahmoud station providing a direct link toward the city center and beyond. Its proximity to major roads also makes commuting to West Bay, the industrial areas, and other parts of the city relatively straightforward. For residents who value being within easy reach of daily conveniences, dining, and transit without paying a premium for a waterfront address, Bin Mahmoud remains one of Doha's most practical and consistently occupied residential districts.",
    overviewAr:
      "بن محمود حي سكني راسخ ومتوسط الموقع، يحظى بشعبية بفضل إيجارات شققه المعتدلة نسبياً مقارنة بالأحياء الساحلية في الدوحة. يقع بالقرب من حيي السد والنصر، ضمن الحزام التجاري الكثيف في الدوحة، ويُعرف بشوارعه القابلة للتنقل سيراً والمليئة بالمقاهي والمطاعم والمخابز ومحال البقالة اليومية. تمتد مباني الحي السكنية عبر عدة حقب من البناء، ما يمنحه واجهة عمرانية متنوعة بدلاً من الطابع الموحد لمشروع مخطط بالكامل. وقد جعل هذا التنوع، إلى جانب موقعه المركزي، من بن محمود منذ فترة طويلة خياراً مفضلاً للوافدين العزاب والأزواج والعائلات الشابة الذين يقدّرون الراحة والحيوية على مستوى الشارع أكثر من الإطلالات البحرية أو مرافق المنتجعات. تخدم المنطقة محطة مخصصة على خط المترو الأخضر توفر اتصالاً مباشراً نحو وسط المدينة وما بعده. كما يجعل قربها من الطرق الرئيسية التنقل إلى الخليج الغربي والمناطق الصناعية وأجزاء أخرى من المدينة أمراً ميسوراً نسبياً. لمن يقدّر القرب من الخدمات اليومية والمطاعم ووسائل النقل دون دفع تكلفة إضافية مقابل عنوان ساحلي، يبقى بن محمود من أكثر أحياء الدوحة عملية وثباتاً في الإشغال السكني.",
    highlights: [
      "Central, walkable district near Al Sadd and Al Nasr",
      "Streets lined with cafes, restaurants & everyday retail",
      "Generally more affordable than waterfront districts",
      "Dedicated Doha Metro Green Line station",
      "Popular with expatriate singles, couples & young families"
    ],
    highlightsAr: [
      "حي مركزي قابل للتنقل سيراً بالقرب من السد والنصر",
      "شوارع مليئة بالمقاهي والمطاعم والمحال التجارية اليومية",
      "أسعار أكثر اعتدالاً عموماً مقارنة بالأحياء الساحلية",
      "محطة مخصصة على خط المترو الأخضر",
      "يحظى بشعبية لدى العزاب والأزواج والعائلات الشابة الوافدة"
    ]
  }
];

export function getAreaGuideBySlug(slug: string): AreaGuide | undefined {
  return AREA_GUIDES.find(g => g.slug === slug);
}
