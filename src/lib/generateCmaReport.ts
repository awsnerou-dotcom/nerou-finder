/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Property, TransactionType, User } from "../types.js";

// Shape returned by GET /api/market-index's `groups` array (see server.ts's
// computeMarketIndexGroups()) - duplicated here rather than imported since server.ts isn't
// part of the client bundle. Mirrors the identical local copy in MarketPriceIndex.tsx.
export interface MarketIndexGroup {
  district: string;
  city: string;
  transactionType: "RENT" | "SALE";
  listingCount: number;
  avgPricePerSqm: number | null;
  medianPrice: number | null;
  lowConfidence: boolean;
}

// Same coarse RENT/SALE bucketing as server.ts's getMarketIndexBucket() - duplicated
// client-side for the same reason MarketIndexGroup is: server.ts is never bundled into the
// client. Kept in exact sync with the server's switch (OFF_PLAN/COMMERCIAL_SALE/LAND_SALE all
// bucket as SALE, COMMERCIAL_LEASE buckets as RENT).
function getMarketIndexBucket(transactionType: TransactionType): "RENT" | "SALE" {
  return transactionType === TransactionType.FOR_RENT || transactionType === TransactionType.COMMERCIAL_LEASE
    ? "RENT"
    : "SALE";
}

// Beyond this absolute percentage difference from the district average price/sqm, the listing
// is called out as meaningfully above/below the market rather than "in line with" it. Chosen
// as a simple, defensible round number (agents can always read the exact percentage either
// way) rather than anything derived from a formal statistical test.
const PRICE_POSITIONING_NEUTRAL_BAND_PERCENT = 5;

interface PriceComparable extends Property {
  __pricePerSqm: number;
}

// Pure, side-effect-free PDF generator: every input is already-fetched data (the subject
// property, a set of comparable live listings, and the market-index groups for its district) -
// this module never calls fetch() itself. Mirrors the structure of PropertyDetailView.tsx's
// handleDownloadBrochure() (same jsPDF usage, same NEROU FINDER branding/colors/fonts) since a
// CMA report is a sibling document to the brochure, not a new visual language.
//
// Arabic-in-PDF limitation: jsPDF's built-in "helvetica" font (used throughout the existing
// brochure generator) has no Arabic glyphs, and the brochure generator never attempts Arabic
// text in the PDF itself for that reason (see its use of `isRtl ? property.titleAr ... :
// property.title` - even the Arabic branch there stays in the same non-Arabic-capable font,
// which is fine for it since Property.titleAr is often still transliterated/short; body copy
// stays English). Rather than inventing a new font-embedding solution here, this generator
// keeps 100% of the generated PDF's textual content in English regardless of `isRtl` - the
// caller (CmaReportButton.tsx) is still bilingual for the surrounding UI (button label, toast).
export async function generateCmaReportPdf(
  property: Property,
  comps: Property[],
  marketStats: MarketIndexGroup[],
  agent: Pick<User, "fullName"> & { orgName?: string },
  isRtl: boolean
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const primaryColor: [number, number, number] = [26, 25, 24]; // #1A1918
  const goldColor: [number, number, number] = [191, 155, 48]; // #BF9B30
  const lightGray: [number, number, number] = [230, 226, 222]; // #E6E2DE
  const darkGray: [number, number, number] = [110, 107, 102]; // #6E6B66
  const PAGE_WIDTH = 210;
  const MARGIN = 15;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  doc.setFont("helvetica", "normal");

  // ---------------------------------------------------------------------------
  // Header bar - identical to the brochure's (same wordmark, same colors/positions).
  // ---------------------------------------------------------------------------
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, PAGE_WIDTH, 25, "F");
  doc.setFillColor(...goldColor);
  doc.rect(0, 25, PAGE_WIDTH, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NEROU FINDER", MARGIN, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...goldColor);
  doc.text("COMPARATIVE MARKET ANALYSIS", 110, 15);

  // ---------------------------------------------------------------------------
  // Title block
  // ---------------------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text("CMA Report", MARGIN, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...darkGray);
  const subjectTitle = property.title.substring(0, 60);
  doc.text(`${subjectTitle}`, MARGIN, 49);
  doc.setFontSize(9);
  doc.text(
    `${property.district}, ${property.city}, Qatar  |  Ref: ${property.listingId || property.id.substr(-5)}  |  ${new Date().toLocaleDateString()}`,
    MARGIN,
    54.5
  );

  let yPos = 63;

  const sectionHeader = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text(title, MARGIN, yPos);
    doc.setDrawColor(...lightGray);
    doc.line(MARGIN, yPos + 3, PAGE_WIDTH - MARGIN, yPos + 3);
    yPos += 10;
  };

  // Two-column label:value grid, matching the brochure's "SPECIFICATIONS & DETAILS" layout
  // exactly (bold label in primaryColor, value in darkGray, 8mm row pitch, columns at 15/110).
  const specRows = (rows: { label: string; val: string }[]) => {
    doc.setFontSize(10);
    rows.forEach((row, i) => {
      const col = i % 2;
      const xCoord = col === 0 ? MARGIN : 110;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...primaryColor);
      doc.text(`${row.label}:`, xCoord, yPos);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...darkGray);
      doc.text(row.val, xCoord + 38, yPos);
      if (col === 1 || i === rows.length - 1) yPos += 8;
    });
    yPos += 4;
  };

  // Ensures the footer/whatever comes next has room; pushes to a fresh page instead of
  // overlapping the fixed-position footer block if a very long comps table runs long.
  const ensureSpace = (needed: number) => {
    if (yPos + needed > 275) {
      doc.addPage();
      yPos = 20;
    }
  };

  const pricePerSqm = property.area > 0 ? property.price / property.area : 0;
  const isRent = property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE;

  // ---------------------------------------------------------------------------
  // SUBJECT PROPERTY
  // ---------------------------------------------------------------------------
  sectionHeader("SUBJECT PROPERTY");
  specRows([
    { label: "Listing ID", val: property.listingId || property.id.substr(-5) },
    { label: "Property Type", val: String(property.propertyType) },
    { label: "Transaction", val: String(property.transactionType) },
    { label: "Bedrooms", val: `${property.bedrooms} Beds` },
    { label: "Bathrooms", val: `${property.bathrooms} Baths` },
    { label: "Total Area", val: `${property.area.toLocaleString()} SQM` },
    { label: "Asking Price", val: `${property.price.toLocaleString()} ${property.currency || "QAR"}${isRent ? ` / ${property.rentalPeriod || "YR"}` : ""}` },
    { label: "Price / SQM", val: `${pricePerSqm.toFixed(0)} ${property.currency || "QAR"}/sqm` }
  ]);

  // ---------------------------------------------------------------------------
  // MARKET OVERVIEW - looked up from the passed-in market-index groups for this property's
  // own district + RENT/SALE bucket (never fabricated when the group is missing or its stats
  // are null - see computeMarketIndexGroups()/MARKET_INDEX_MIN_SAMPLE in server.ts).
  // ---------------------------------------------------------------------------
  const bucket = getMarketIndexBucket(property.transactionType);
  const marketGroup = marketStats.find(
    g => g.transactionType === bucket && g.district.toLowerCase() === property.district.toLowerCase()
  );

  sectionHeader("MARKET OVERVIEW");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...darkGray);
  doc.text(
    `District: ${property.district}  |  Segment: ${bucket === "RENT" ? "Rental Market" : "Sales Market"}`,
    MARGIN,
    yPos
  );
  yPos += 8;

  if (!marketGroup || marketGroup.avgPricePerSqm == null) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkGray);
    doc.text(
      "Insufficient market data — not enough live listings in this district/segment to report a reliable average yet.",
      MARGIN,
      yPos
    );
    yPos += 10;
  } else {
    specRows([
      { label: "Avg. Price/SQM", val: `${marketGroup.avgPricePerSqm.toFixed(0)} ${property.currency || "QAR"}/sqm` },
      { label: "Median Price", val: marketGroup.medianPrice != null ? `${marketGroup.medianPrice.toLocaleString()} ${property.currency || "QAR"}` : "—" },
      { label: "Sample Size", val: `${marketGroup.listingCount} live listing${marketGroup.listingCount === 1 ? "" : "s"}` },
      { label: "Confidence", val: marketGroup.lowConfidence ? "Low (small sample)" : "Standard" }
    ]);
    if (marketGroup.lowConfidence) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...goldColor);
      doc.text(
        "Note: this district/segment currently has a small sample size — treat the average/median as indicative rather than definitive.",
        MARGIN,
        yPos
      );
      yPos += 7;
    }
  }

  // ---------------------------------------------------------------------------
  // PRICE POSITIONING
  // ---------------------------------------------------------------------------
  sectionHeader("PRICE POSITIONING");
  if (!marketGroup || marketGroup.avgPricePerSqm == null) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkGray);
    doc.text(
      "Positioning cannot be calculated without a district average — see Market Overview above.",
      MARGIN,
      yPos
    );
    yPos += 10;
  } else {
    const diffPercent = ((pricePerSqm - marketGroup.avgPricePerSqm) / marketGroup.avgPricePerSqm) * 100;
    const absDiff = Math.abs(diffPercent);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text(`Subject: ${pricePerSqm.toFixed(0)}/sqm`, MARGIN, yPos);
    doc.text(`District Avg: ${marketGroup.avgPricePerSqm.toFixed(0)}/sqm`, 80, yPos);
    doc.setTextColor(...(diffPercent >= 0 ? goldColor : darkGray));
    doc.text(`${diffPercent >= 0 ? "+" : ""}${diffPercent.toFixed(1)}%`, 155, yPos);
    yPos += 8;

    let interpretation: string;
    if (absDiff <= PRICE_POSITIONING_NEUTRAL_BAND_PERCENT) {
      interpretation = "This listing is priced within a competitive range — in line with the district average (within 5%).";
    } else if (diffPercent > 0) {
      interpretation = `Priced ${absDiff.toFixed(1)}% above the district average — consider justifying this with comparable premium features (view, finishes, amenities) when discussing with the owner.`;
    } else {
      interpretation = `Priced ${absDiff.toFixed(1)}% below the district average — there may be room to reprice upward without losing competitiveness.`;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...darkGray);
    const splitInterp = doc.splitTextToSize(interpretation, CONTENT_WIDTH);
    doc.text(splitInterp, MARGIN, yPos);
    yPos += splitInterp.length * 5 + 4;
  }

  // ---------------------------------------------------------------------------
  // COMPARABLE LISTINGS - sorted by closeness of price/sqm to the subject property, capped
  // at 6 rows. Fewer than 2 usable comps prints an explanatory note instead of a sparse table.
  // ---------------------------------------------------------------------------
  sectionHeader("COMPARABLE LISTINGS");

  const usableComps: PriceComparable[] = comps
    .filter(c => c.id !== property.id && c.area > 0 && c.price > 0)
    .map(c => ({ ...c, __pricePerSqm: c.price / c.area }))
    .sort((a, b) => Math.abs(a.__pricePerSqm - pricePerSqm) - Math.abs(b.__pricePerSqm - pricePerSqm))
    .slice(0, 6);

  if (usableComps.length < 2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...darkGray);
    doc.text(
      "Not enough comparable live listings were found in this district/segment to build a reliable comparison table.",
      MARGIN,
      yPos
    );
    yPos += 10;
  } else {
    ensureSpace(10 + usableComps.length * 7);

    const cols = [
      { key: "title", label: "Listing", x: MARGIN, w: 62 },
      { key: "beds", label: "Beds", x: 105, w: 12 },
      { key: "area", label: "Area", x: 120, w: 20 },
      { key: "price", label: "Price", x: 142, w: 30 },
      { key: "perSqm", label: "QAR/sqm", x: 172, w: 23 }
    ];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(...primaryColor);
    doc.rect(MARGIN, yPos - 4.5, CONTENT_WIDTH, 6, "F");
    cols.forEach(c => doc.text(c.label, c.x + 1, yPos));
    yPos += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    usableComps.forEach((c, i) => {
      if (i % 2 === 1) {
        doc.setFillColor(248, 247, 245);
        doc.rect(MARGIN, yPos - 4.2, CONTENT_WIDTH, 6, "F");
      }
      doc.setTextColor(...primaryColor);
      const compTitle = `${(c.title || c.listingId || c.id).toString().substring(0, 34)}`;
      doc.text(compTitle, cols[0].x + 1, yPos);
      doc.setTextColor(...darkGray);
      doc.text(String(c.bedrooms ?? "—"), cols[1].x + 1, yPos);
      doc.text(`${c.area.toLocaleString()}`, cols[2].x + 1, yPos);
      doc.text(`${c.price.toLocaleString()}`, cols[3].x + 1, yPos);
      doc.text(`${c.__pricePerSqm.toFixed(0)}`, cols[4].x + 1, yPos);
      yPos += 6;
    });
    yPos += 4;

    doc.setFontSize(7.5);
    doc.setTextColor(...darkGray);
    doc.text(
      `${usableComps.length} live comparable${usableComps.length === 1 ? "" : "s"} in ${property.district}, ${property.city}, sorted by closeness of price/sqm to the subject property.`,
      MARGIN,
      yPos
    );
    yPos += 8;
  }

  // ---------------------------------------------------------------------------
  // FOOTER - same visual language as the brochure's contact block ("REPRESENTED BY AUTHORIZED
  // BROKER"), adapted to "Prepared by" since this document isn't a public-facing brochure.
  // ---------------------------------------------------------------------------
  ensureSpace(40);
  const footerY = Math.max(yPos + 4, 245);
  doc.setFillColor(252, 251, 250);
  doc.rect(MARGIN, footerY, CONTENT_WIDTH, 32, "F");
  doc.setDrawColor(...goldColor);
  doc.rect(MARGIN, footerY, CONTENT_WIDTH, 32, "S");
  doc.setFillColor(...goldColor);
  doc.rect(MARGIN, footerY, 4, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text("PREPARED BY", MARGIN + 10, footerY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...goldColor);
  doc.text(agent.fullName || "Nerou Finder Partner", MARGIN + 10, footerY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text(
    agent.orgName ? `${agent.orgName} — Nerou Finder Partner Network` : "Nerou Finder Partner Network",
    MARGIN + 10,
    footerY + 23
  );
  doc.text(
    `Generated ${new Date().toLocaleDateString()}  |  For internal pricing guidance — not a formal appraisal.`,
    MARGIN + 10,
    footerY + 29
  );

  const dateSlug = new Date().toISOString().slice(0, 10);
  doc.save(`CMA-Report-${property.listingId || property.id}-${dateSlug}.pdf`);
}
