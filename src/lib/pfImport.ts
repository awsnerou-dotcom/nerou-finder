// Moving listings across from Property Finder's own system (PF Expert): the agency exports its own listings there and uploads
// the file here. The same steps are shown in the "Add your listings" box and in the subscriber guide, so they live in one place.
// The PF Expert menu names come from Property Finder's help centre ("Export Listings"); we link nothing and copy nothing from them.

import { IMPORT_MAX_ROWS } from "./listingImport.js";
import type { GuideStep } from "./guide.js";

export const PF_IMPORT_STEPS: GuideStep[] = [
  {
    title: { en: "Open your listings in PF Expert", ar: "افتح عقاراتك في PF Expert" },
    body: { en: "Sign in with the admin account and open “Properties”.", ar: "ادخل بحساب المدير وافتح «Properties»." }
  },
  {
    title: { en: "Select the listings and export them", ar: "حدد العقارات وصدّرها" },
    body: { en: `Select up to ${IMPORT_MAX_ROWS} listings, press the three dots, then “Export Results”.`, ar: `حدد حتى ${IMPORT_MAX_ROWS} عقار، واضغط النقاط الثلاث ثم «Export Results».` }
  },
  {
    title: { en: "Download the file", ar: "حمّل الملف" },
    body: { en: "It arrives in “Notifications” in PF Expert. It can take a while for a large export.", ar: "يصلك في «Notifications» داخل PF Expert، وقد يتأخر إن كان عدد العقارات كبيراً." }
  },
  {
    title: { en: "Save it as CSV UTF-8", ar: "احفظه بصيغة CSV UTF-8" },
    body: { en: "Open it in Excel and choose “Save As”, then “CSV UTF-8”, so Arabic letters stay correct.", ar: "افتحه في Excel واختر «حفظ باسم» ثم «CSV UTF-8» لتبقى الحروف العربية سليمة." }
  },
  {
    title: { en: "Upload it here", ar: "ارفعه هنا" },
    body: { en: "In “Add your listings” press “Upload a file” and choose the saved file. Agencies reach it from Listings, then “Add a listing”.", ar: "في «أضف عقاراتك» اضغط «ارفع ملفاً» واختر الملف المحفوظ. والمكتب يصل إليها من «العقارات المدرجة» ثم «إضافة عقار»." }
  },
  {
    title: { en: "Check the preview, then save or publish", ar: "راجع المعاينة ثم احفظ أو انشر" },
    body: { en: "Save as drafts first, check prices and areas, add any missing photos and the map pin, then publish.", ar: "احفظها مسودات أولاً، وراجع الأسعار والمناطق، وأضف الصور الناقصة وموقع الخريطة، ثم انشر." }
  }
];
