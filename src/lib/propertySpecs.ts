// The "Specifications" list on a listing page. A row exists only when the agent actually provided that fact: a missing
// fact is left out, never replaced by a made-up default (the old list said "Sea & Skyline View", "12 Cheques",
// "Grade A" and a guessed ownership type for listings that had none of that). Pure function, unit tested.

import type { Property } from "../types.js";

export interface SpecRow {
  label: string;
  value: string;
  tone?: "good" | "warn";
}

const TYPE_TEXT: Record<string, [string, string]> = {
  APARTMENT: ["Apartment", "شقة سكنية"], VILLA: ["Villa", "فيلا مستقلة"], TOWNHOUSE: ["Townhouse", "تاونهاوس"],
  PENTHOUSE: ["Penthouse", "بنتهاوس"], COMPOUND: ["Compound", "مجمع فلل"], STUDIO: ["Studio", "استوديو"],
  ROOM: ["Room", "غرفة مستقلة"], OFFICE: ["Office", "مكتب إداري"], RETAIL: ["Retail", "معرض تجاري"],
  SHOP: ["Shop", "محل تجاري"], WAREHOUSE: ["Warehouse", "مخزن / مستودع"], BUILDING: ["Building", "عمارة كاملة"],
  LAND: ["Land", "أرض فضاء"], HOTEL_APARTMENT: ["Hotel apartment", "شقة فندقية"], CHALET: ["Chalet", "شاليه"],
  FARM: ["Farm", "مزرعة"], OTHER: ["Other", "نوع آخر"]
};

export function propertyTypeLabel(type: string, isRtl: boolean): string {
  const t = TYPE_TEXT[type];
  if (t) return isRtl ? t[1] : t[0];
  const words = String(type || "").replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface SpecFormat {
  area: (sqm: number) => string;
  money: (qar: number) => string;
}

const has = (v: unknown) => v !== undefined && v !== null && v !== "" && !(typeof v === "number" && Number.isNaN(v));

export function buildSpecRows(p: Property, isRtl: boolean, fmt: SpecFormat): SpecRow[] {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const yesNo = (b: boolean) => (b ? t("Yes", "نعم") : t("No", "لا"));
  const rows: SpecRow[] = [];
  const add = (label: string, value: string, tone?: SpecRow["tone"]) => rows.push({ label, value, ...(tone ? { tone } : {}) });

  add(t("Reference", "الرقم المرجعي"), p.listingId || `N-${String(p.id).slice(-5)}`);
  add(t("Property type", "نوع العقار"), propertyTypeLabel(p.propertyType, isRtl));

  if (has(p.tenureType)) {
    add(t("Ownership", "الملكية"),
      p.tenureType === "FREEHOLD" ? t("Freehold", "تملك حر")
        : p.tenureType === "USUFRUCT" ? t("Usufruct", "حق الانتفاع")
        : t("Local ownership only", "تملك للمواطنين فقط"));
  }
  if (has(p.completionYear)) add(t("Completion year", "سنة الإنجاز"), String(p.completionYear));
  if (has(p.furnishingStatus)) {
    add(t("Furnishing", "التأثيث"),
      p.furnishingStatus === "FULLY_FURNISHED" ? t("Fully furnished", "مؤثث بالكامل")
        : p.furnishingStatus === "SEMI_FURNISHED" ? t("Semi furnished", "مؤثث جزئياً")
        : t("Unfurnished", "غير مؤثث"));
  }
  if (has(p.builtUpArea)) add(t("Built-up area", "مساحة البناء"), fmt.area(p.builtUpArea as number));
  if (has(p.plotArea)) add(t("Plot area", "مساحة الأرض"), fmt.area(p.plotArea as number));
  if (has(p.grossArea)) add(t("Gross area", "المساحة الإجمالية"), fmt.area(p.grossArea as number));
  if (has(p.floorNumber)) add(t("Floor", "الطابق"), String(p.floorNumber));
  if (has(p.viewType)) add(t("View", "الإطلالة"), String(p.viewType));
  if (has(p.villaType)) add(t("Villa type", "تصنيف الفيلا"), String(p.villaType));
  if (typeof p.majlis === "boolean") add(t("Majlis", "المجلس"), yesNo(p.majlis));
  if (typeof p.outdoorKitchen === "boolean") add(t("Outdoor kitchen", "المطبخ الخارجي"), yesNo(p.outdoorKitchen));
  if (typeof p.privatePool === "boolean") add(t("Private pool", "مسبح خاص"), yesNo(p.privatePool));
  if (has(p.officeGrade)) add(t("Grade", "الدرجة"), String(p.officeGrade));
  if (has(p.fittedStatus)) add(t("Fit-out", "حالة التشطيب"), String(p.fittedStatus));
  if (has(p.commercialLicense)) add(t("Permitted activities", "الأنشطة المسموحة"), String(p.commercialLicense));
  if (has(p.roadAccess)) add(t("Road access", "الوصول بالطريق"), String(p.roadAccess));
  if (typeof p.utilitiesConnected === "boolean") add(t("Utilities connected", "الخدمات متصلة"), yesNo(p.utilitiesConnected));

  if (has(p.metroStation)) {
    add(t("Nearest metro", "أقرب محطة مترو"),
      has(p.metroWalkingMinutes) ? `${p.metroStation} (${p.metroWalkingMinutes} ${t("min walk", "دقيقة مشي")})` : String(p.metroStation));
  }
  if (has(p.utilitiesIncluded)) {
    add(t("Utilities included", "المرافق مشمولة"),
      p.utilitiesIncluded === "YES" ? t("Yes", "نعم") : p.utilitiesIncluded === "PARTIAL" ? t("Partly", "جزئياً") : t("No", "لا"),
      p.utilitiesIncluded === "YES" ? "good" : p.utilitiesIncluded === "NO" ? "warn" : undefined);
  }
  if (has(p.parkingType)) {
    const kind = p.parkingType === "COVERED" ? t("Covered", "مغطى") : p.parkingType === "UNCOVERED" ? t("Uncovered", "مكشوف") : p.parkingType === "GARAGE" ? t("Garage", "كراج") : t("None", "لا يوجد");
    add(t("Parking", "مواقف السيارات"), has(p.parkingSpaces) ? `${kind} (${p.parkingSpaces})` : kind);
  } else if (has(p.parkingSpaces)) {
    add(t("Parking spaces", "عدد المواقف"), String(p.parkingSpaces));
  } else if (p.parking === true) {
    add(t("Parking", "مواقف السيارات"), t("Available", "متوفرة"));
  }

  const rent = p.transactionType === "FOR_RENT" || p.transactionType === "COMMERCIAL_LEASE";
  if (rent) {
    if (has(p.deposit)) add(t("Security deposit", "مبلغ التأمين"), fmt.money(p.deposit as number));
    if (has(p.commissions)) add(t("Agency fee", "رسوم الوكالة"), fmt.money(p.commissions as number));
    if (has(p.cheques)) add(t("Cheques", "عدد الشيكات"), String(p.cheques));
    if (has(p.contractLength)) add(t("Contract length", "مدة العقد"), String(p.contractLength));
    if (typeof p.kahramaa === "boolean") add(t("Electricity & water", "الكهرباء والماء"), p.kahramaa ? t("Included", "مشمولة") : t("Paid separately", "تدفع منفصلة"), p.kahramaa ? "good" : undefined);
    if (typeof p.cooling === "boolean") add(t("Cooling", "التبريد"), p.cooling ? t("Included", "مشمول") : t("Paid by tenant", "على المستأجر"), p.cooling ? "good" : undefined);
  }
  if (has(p.serviceCharges)) add(t("Service charges", "رسوم الخدمات"), `${fmt.money(p.serviceCharges as number)} ${t("/ year", "/ سنة")}`);

  if (p.transactionType === "OFF_PLAN") {
    if (has(p.developer)) add(t("Developer", "المطور"), String(p.developer));
    if (has(p.constructionStatus)) add(t("Construction status", "حالة الإنشاء"), String(p.constructionStatus));
    if (has(p.completionDate)) add(t("Expected delivery", "موعد التسليم المتوقع"), String(p.completionDate));
  }
  return rows;
}
