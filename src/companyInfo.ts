// The legal entity that operates Nerou Finder, as shown to visitors (footer, contact and
// partnership pages, the legal documents). Public-facing display only - transactional email
// sender/admin addresses are configured separately on the server.
export const COMPANY = {
  nameEn: "Nerou Technology Services Trading",
  nameAr: "نيرو تكنولوجي سيرفيسيس تريدنق",
  addressEn: "Al Muntazah Commercial Center, Tower B, Doha, Qatar",
  addressAr: "مركز المنتزه التجاري، البرج B، الدوحة، قطر",
  email: "info@neroutechnologyservices.com",
  // Commercial Registration (CR) number of the company that owns and operates the platform.
  crNumber: "209013"
} as const;

/** "Commercial Registration (CR) No. 209013" / "السجل التجاري رقم 209013" */
export const companyCrLabel = (isRtl: boolean) =>
  isRtl ? `السجل التجاري رقم ${COMPANY.crNumber}` : `Commercial Registration (CR) No. ${COMPANY.crNumber}`;
