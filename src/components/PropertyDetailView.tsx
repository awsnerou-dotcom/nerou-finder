/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Property,
  NearbyPlace,
  VerificationStatus,
  TransactionType,
  PropertyType,
  getAvailabilityStaleDays,
  AVAILABILITY_UNCONFIRMED_DAYS,
  isAvailabilityConfirmed,
  formatConfirmedDate
} from "../types.js";
import { useCurrency } from "../currencyContext.js";
import { buildSpecRows } from "../lib/propertySpecs.js";
import { AboutCard, SpecsCard, PaymentPlanCard, NearbyList, ListingRecordCard, InvestmentPlanner } from "./PropertyDetailSections.js";
import PropertyGallery, { GalleryGroup } from "./PropertyGallery.js";
import { getVideoEmbedUrl } from "../lib/video.js";
import { formatPhoneForDisplay } from "../lib/phone.js";
import {
  MapPin,
  Calendar,
  Share2,
  Bookmark,
  Shield,
  Eye,
  ChevronLeft,
  X,
  Maximize2,
  GitCompare,
  FileText,
  AlertTriangle,
  Building,
  Activity,
  TrendingUp,
  Award,
  Download,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  Phone,
  Check,
  Clock
} from "lucide-react";

interface PropertyDetailViewProps {
  property: Property;
  onClose: () => void;
  onToggleSave: (id: string) => void;
  isSaved: boolean;
  onToggleCompare: (id: string) => void;
  isCompared: boolean;
  isRtl: boolean;
  allProperties?: Property[];
  onSelectProperty?: (property: Property) => void;
  currentUser?: { fullName?: string; email?: string } | null;
  onViewAgentProfile?: () => void;
}

export default function PropertyDetailView({
  property,
  onClose,
  onToggleSave,
  isSaved,
  onToggleCompare,
  isCompared,
  isRtl,
  allProperties = [],
  onSelectProperty,
  currentUser,
  onViewAgentProfile,
}: PropertyDetailViewProps) {
  const { activeCurrency, formatPrice, convertPrice, getCurrencySymbol } = useCurrency();

  // Interactive Tools State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDetails, setReportDetails] = useState<string>("");
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState<string>("");

  // Booking Form State
  const [bookingName, setBookingName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [bookingSent, setBookingSent] = useState(false);
  const [bookingError, setBookingError] = useState<string>("");

  // Real per-property agent/agency identity (name, photo, phone) resolved from the server
  const [agentInfo, setAgentInfo] = useState<{
    agentName: string | null;
    agentPhotoUrl: string | null;
    orgName: string | null;
    phone: string;
    /** The number to dial for a phone call ("" when the agent has none on file). */
    callNumber?: string;
    isVerifiedAgent: boolean;
    hasAssignedAgent: boolean;
    verifiedBadgeLabel: string | null;
    verifiedBadgeLabelAr: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/properties/${property.id}/agent-info`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAgentInfo(data);
      })
      .catch((e) => console.error("Failed to fetch agent info:", e));
    return () => {
      cancelled = true;
    };
  }, [property.id]);

  // District Market Price Index context: how this listing's own QAR/sqm compares to the live
  // average for its district + RENT/SALE bucket (see server.ts's computeMarketIndexGroups(),
  // shared with GET /api/market-index and GET /api/areas/:slug). Left null - and the hint
  // stays hidden - whenever there isn't a same-bucket, non-low-confidence group to compare
  // against, rather than showing a shaky percentage off a handful of listings.
  const [marketContext, setMarketContext] = useState<{ diffPercent: number; avgPricePerSqm: number } | null>(null);
  useEffect(() => {
    setMarketContext(null);
    if (!property.district || !property.area || !property.price) return;
    let cancelled = false;
    fetch(`/api/market-index?district=${encodeURIComponent(property.district)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.groups) return;
        const bucket =
          property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE
            ? "RENT"
            : "SALE";
        const match = data.groups.find(
          (g: any) => g.transactionType === bucket && (g.district || "").toLowerCase() === (property.district || "").toLowerCase()
        );
        if (match?.avgPricePerSqm && !match.lowConfidence) {
          const ownPerSqm = property.price / property.area;
          const diffPercent = ((ownPerSqm - match.avgPricePerSqm) / match.avgPricePerSqm) * 100;
          setMarketContext({ diffPercent, avgPricePerSqm: match.avgPricePerSqm });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [property.id, property.district, property.transactionType, property.price, property.area]);

  // Structured data (schema.org RealEstateListing), mirroring what the server already injects
  // for the same URL in server.ts's GET /properties/:id route. That server copy is what search
  // engines see on first crawl; this client copy covers the case where a visitor arrives here
  // via in-app navigation (no full page load) instead of a direct/shared link, and covers
  // preview tools that do execute JS. Added/removed as this view mounts/unmounts so it never
  // lingers describing a property that's no longer open.
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "property-jsonld";
    const existing = document.getElementById("property-jsonld");
    if (existing) existing.remove();
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: property.title,
      description: property.description,
      url: `${window.location.origin}/properties/${property.id}`,
      image: property.images && property.images.length > 0 ? property.images : undefined,
      datePosted: property.createdDate,
      address: {
        "@type": "PostalAddress",
        addressLocality: property.district,
        addressRegion: property.city,
        addressCountry: "QA"
      },
      offers: {
        "@type": "Offer",
        price: property.price,
        priceCurrency: property.currency || "QAR",
        availability: "https://schema.org/InStock"
      },
      numberOfRooms: property.bedrooms,
      numberOfBathroomsTotal: property.bathrooms,
      floorSize: {
        "@type": "QuantitativeValue",
        value: property.area,
        unitCode: property.sizeUnit === "SQFT" ? "FTK" : "MTK"
      }
    });
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [property]);

  // "Recently viewed" trail for visitors - a lightweight, per-browser localStorage list (no
  // account or backend needed) that VisitorExperience.tsx surfaces on the marketplace so a
  // visitor can get back to properties they looked at earlier. Most-recent-first, de-duplicated
  // by id, capped so it can't grow without bound.
  useEffect(() => {
    try {
      const RECENTLY_VIEWED_KEY = "nerou_recently_viewed";
      const RECENTLY_VIEWED_MAX = 12;
      const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
      const list: { id: string; ts: number }[] = raw ? JSON.parse(raw) : [];
      const next = [{ id: property.id, ts: Date.now() }, ...list.filter(e => e.id !== property.id)]
        .slice(0, RECENTLY_VIEWED_MAX);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to update recently-viewed list:", e);
    }
  }, [property.id]);

  // Real, honest view count shown near the price panel - starts from the count already on
  // the property object (as seen in search results) and is bumped to the server's authoritative
  // total once this visit's own view finishes recording, so the visible number includes the
  // current visit rather than lagging one behind it.
  const [liveViewCount, setLiveViewCount] = useState(property.views || 0);

  // FIX 8: real view tracking - fires once per genuine mount of this detail view (not on
  // every re-render/state update), using a stable per-browser fingerprint for unique-view
  // dedup on the server side.
  useEffect(() => {
    let fingerprint = localStorage.getItem("nerou_visitor_fp");
    if (!fingerprint) {
      fingerprint = `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("nerou_visitor_fp", fingerprint);
    }
    fetch(`/api/properties/${property.id}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.views === "number") setLiveViewCount(data.views);
      })
      .catch((e) => console.error("Failed to record property view:", e));
    // Intentionally runs once per mount (property.id identity) - not re-fired by unrelated
    // re-renders, since this effect has no other dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property.id]);

  // Floor Plan State
  const [activeFloorPlanIndex, setActiveFloorPlanIndex] = useState(0);
  const [isFloorPlanFullscreen, setIsFloorPlanFullscreen] = useState(false);

  // Size unit conversion (SQM to SQFT)
  const [displayUnit, setDisplayUnit] = useState<"SQM" | "SQFT">("SQM");

  // Share action
  const [copiedLink, setCopiedLink] = useState(false);

  const handleDownloadBrochure = () => {
    import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const primaryColor = [26, 25, 24]; // #1A1918
      const goldColor = [191, 155, 48];  // #BF9B30
      const lightGray = [230, 226, 222]; // #E6E2DE
      const darkGray = [110, 107, 102]; // #6E6B66

      doc.setFont("helvetica", "normal");

      // Draw Top Accent
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, 210, 25, "F");

      doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.rect(0, 25, 210, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("NEROU FINDER", 15, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.text("QATAR'S PRESTIGIOUS REAL ESTATE CHANNEL", 110, 15);

      // Property title
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      const mainTitle = isRtl ? (property.titleAr || property.title) : property.title;
      doc.text(mainTitle.substring(0, 48), 15, 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const locationText = `${property.district}, ${property.city}, Qatar`;
      doc.text(`Location: ${locationText}`, 15, 49);

      // Price block
      doc.setFillColor(252, 251, 250);
      doc.rect(15, 55, 180, 18, "F");
      doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(15, 55, 180, 18, "S");

      doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.rect(15, 55, 2, 18, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("ASKING INVESTMENT VALUE", 22, 62);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
      const priceText = formatPrice(property.price, false);
      doc.text(priceText, 22, 69);

      // Specs
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("SPECIFICATIONS & DETAILS", 15, 87);

      doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.line(15, 90, 195, 90);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

      const specs = [
        { label: "Listing ID", val: property.listingId },
        { label: "Property Type", val: property.propertyType },
        { label: "Transaction", val: property.transactionType },
        { label: "Bedrooms", val: `${property.bedrooms} Beds` },
        { label: "Bathrooms", val: `${property.bathrooms} Baths` },
        { label: "Total Area", val: `${property.area} SQM` },
        { label: "Rera Permit", val: property.verificationStatus === "APPROVED" ? "Approved (RERA-2026)" : "Verified" },
        { label: "Completion", val: property.constructionStatus || "Ready to Move" }
      ];

      let yPos = 97;
      specs.forEach((spec, i) => {
        const col = i % 2;
        const xCoord = col === 0 ? 15 : 110;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`${spec.label}:`, xCoord, yPos);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text(String(spec.val), xCoord + 35, yPos);

        if (col === 1) yPos += 8;
      });

      // Description
      yPos += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("EXECUTIVE SUMMARY", 15, yPos);

      doc.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.line(15, yPos + 3, 195, yPos + 3);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      
      const descText = property.description || "An exclusive luxury residence catalogued by Nerou Finder. Impeccable finishes, floor-to-ceiling windows with skyline panoramas, and access to elite lifestyle amenities in Qatar's finest districts.";
      const splitDesc = doc.splitTextToSize(descText, 180);
      doc.text(splitDesc, 15, yPos + 10);

      // Contact block
      const footerY = 240;
      doc.setFillColor(252, 251, 250);
      doc.rect(15, footerY, 180, 40, "F");
      doc.setDrawColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.rect(15, footerY, 180, 40, "S");

      doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.rect(15, footerY, 4, 40, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("REPRESENTED BY AUTHORIZED BROKER", 25, footerY + 8);

      const brochureAgentName = agentInfo?.agentName || agentInfo?.orgName || "Nerou Finder Team";
      // Only a number that really belongs to this agent: a made-up fallback would send a client to a stranger.
      const brochurePhone = agentInfo?.callNumber ? formatPhoneForDisplay(agentInfo.callNumber) : "";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.text(brochureAgentName, 25, footerY + 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(
        agentInfo?.hasAssignedAgent ? "Licensed Agent - Nerou Finder Partner Network" : "Nerou Finder Partner Network",
        25,
        footerY + 23
      );
      // Only the phone is real/dynamic data here (agentInfo doesn't currently carry an email) -
      // a fabricated "licensing@..." address previously shown here would have misled a real
      // client trying to reach the agent, so this only ever shows contact info we actually have.
      if (brochurePhone) doc.text(`Contact: ${brochurePhone}`, 25, footerY + 29);
      doc.text(
        (agentInfo?.isVerifiedAgent && agentInfo.verifiedBadgeLabel) || "Nerou Finder Certified Partner Network",
        25,
        footerY + 35
      );

      doc.save(`Brochure-${property.listingId}.pdf`);
    }).catch(err => {
      console.error("Failed to load jsPDF", err);
    });
  };

  // The permalink for this specific listing. Not window.location.href - this app previously
  // never updated the address bar when opening a property (see VisitorExperience.tsx's deep-
  // link effects), so window.location.href was always just the site root regardless of which
  // property was open, and "Share" silently copied a useless link. VisitorExperience now keeps
  // the address bar in sync too, but building the URL directly here means this keeps working
  // even if this view is ever rendered somewhere that doesn't do that syncing.
  const shareLink = `${window.location.origin}/properties/${property.id}`;

  const handleShare = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Share the listing itself with a friend/family member - distinct from the sidebar's
  // "WhatsApp" button, which contacts the agent as a lead and is tracked as one.
  const handleShareViaWhatsApp = () => {
    const titleText = isRtl ? (property.titleAr || property.title) : property.title;
    const priceText = formatPrice(property.price, isRtl);
    const text = isRtl
      ? `شاهد هذا العقار على Nerou Finder:\n${titleText} - ${priceText}\n${shareLink}`
      : `Check out this property on Nerou Finder:\n${titleText} - ${priceText}\n${shareLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleWhatsAppAction = async () => {
    // Open the tab SYNCHRONOUSLY, before any `await` - popup blockers require window.open to
    // fire within the original click's "user gesture" window, which ends the moment this
    // function first suspends at an await. Opening a blank tab now and redirecting it once the
    // async work below finishes keeps it tied to the click instead of being silently blocked
    // (window.open's return value was never checked, so the failure was invisible before).
    const waTab = window.open("", "_blank");

    // 1. Fire Lead tracking POST
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          visitorName: "Anonymous Visitor (WhatsApp Link)",
          visitorPhone: "WhatsApp Inquiry Click",
          contactMethod: "WHATSAPP",
          message: `Visitor initiated WhatsApp inquiry for: ${property.title} (Listing ID: ${property.listingId}).`,
          // FIX 6: credit the ad campaign that brought this visitor in, if any (see App.tsx's
          // one-time ?campaignId= capture into sessionStorage).
          campaign: sessionStorage.getItem("attributionCampaignId") || undefined
        })
      });
    } catch (e) {
      console.error("Lead logging failed:", e);
    }

    // 2. Fetch the correct WhatsApp contact number for this property
    let contactNumber = "97433334444"; // default fallback
    try {
      const res = await fetch(`/api/properties/${property.id}/whatsapp-number`);
      if (res.ok) {
        const data = await res.json();
        if (data.whatsappNumber) {
          contactNumber = data.whatsappNumber;
        }
      }
    } catch (e) {
      console.error("Failed to fetch custom WhatsApp number, using fallback:", e);
    }

    const titleText = isRtl ? (property.titleAr || property.title) : property.title;
    const locationText = `${property.district || ""}, ${property.city || ""}`;
    const priceText = formatPrice(property.price, isRtl);

    // Format pre-filled message exactly as requested
    const messageText = isRtl
      ? `مرحباً، أنا مهتم بهذا العقار:\nالعقار: ${titleText}\nالموقع: ${locationText}\nالسعر: ${priceText}\nرقم الإعلان: ${property.listingId}\nالرابط: ${shareLink}`
      : `Hello, I am interested in this property:\nProperty: ${titleText}\nLocation: ${locationText}\nPrice: ${priceText}\nProperty ID: ${property.listingId}\nLink: ${shareLink}`;

    const waUrl = `https://wa.me/${contactNumber}?text=${encodeURIComponent(messageText)}`;
    if (waTab) {
      waTab.location.href = waUrl;
    } else {
      // Popup was blocked even with the synchronous open attempt (some browsers still block
      // it) - fall back to navigating the current tab so the action isn't silently a no-op.
      window.location.href = waUrl;
    }
  };

  // Divide images into categories for advanced media gallery
  const images = property.images || [];
  const imageCategories = property.imageCategories || [];

  const categorizedImages = {
    ALL: images,
    INTERIOR: images.filter((_, idx) => imageCategories[idx] === "INTERIOR"),
    EXTERIOR: images.filter((_, idx) => imageCategories[idx] === "EXTERIOR"),
    FLOOR_PLAN: images.filter((_, idx) => imageCategories[idx] === "FLOOR_PLAN")
  };

  // If a property doesn't have real category fields assigned, use the original mock fallback split
  if (!property.imageCategories || property.imageCategories.length === 0) {
    categorizedImages.INTERIOR = images.slice(0, Math.ceil(images.length / 2));
    categorizedImages.EXTERIOR = images.slice(Math.ceil(images.length / 2));
    categorizedImages.FLOOR_PLAN = property.floorPlans && property.floorPlans.length > 0
      ? property.floorPlans
      : ["https://images.unsplash.com/photo-1545464693-f1798a373343?auto=format&fit=crop&w=600&q=80"];
  }

  // Gallery tabs: only categories that really have photos are offered. (The fallback split above
  // is kept for the floor-plan section, but a made-up "interior/exterior" split or a stock
  // floor plan must not be presented as the listing's own photos.)
  const hasRealCategories = imageCategories.length > 0;
  const galleryGroups: GalleryGroup[] = [{ key: "ALL", label: isRtl ? "كل الصور" : "All photos", images }];
  if (hasRealCategories) {
    const interior = images.filter((_, i) => imageCategories[i] === "INTERIOR");
    const exterior = images.filter((_, i) => imageCategories[i] === "EXTERIOR");
    if (interior.length) galleryGroups.push({ key: "INTERIOR", label: isRtl ? "الداخلية" : "Interior", images: interior });
    if (exterior.length) galleryGroups.push({ key: "EXTERIOR", label: isRtl ? "الخارجية" : "Exterior", images: exterior });
  }
  const realFloorPlans = [
    ...(hasRealCategories ? images.filter((_, i) => imageCategories[i] === "FLOOR_PLAN") : []),
    ...(property.floorPlans || [])
  ].filter((u, i, arr) => arr.indexOf(u) === i);
  if (realFloorPlans.length) galleryGroups.push({ key: "FLOOR_PLAN", label: isRtl ? "مخطط الطابق" : "Floor plans", images: realFloorPlans });

  // Price calculations
  const isRent = property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE;
  const currencySymbol = getCurrencySymbol(isRtl);
  const propertyPrice = convertPrice(property.price);

  // Public trust signal: honest "confirmed available X days ago" freshness indicator, and
  // the "Availability Unconfirmed" badge once a listing crosses 21+ days without a fresh
  // confirm-available check (see getAvailabilityStaleDays()/AVAILABILITY_* in types.ts).
  const availabilityStaleDays = getAvailabilityStaleDays(property.lastConfirmedAvailableDate || property.createdDate);
  const isAvailabilityUnconfirmed = availabilityStaleDays >= AVAILABILITY_UNCONFIRMED_DAYS;
  const availabilityConfirmedText = isRtl
    ? availabilityStaleDays <= 0
      ? "تم تأكيد التوفر اليوم"
      : availabilityStaleDays === 1
        ? "تم تأكيد التوفر أمس"
        : `تم تأكيد التوفر منذ ${availabilityStaleDays} يوماً`
    : availabilityStaleDays <= 0
      ? "Availability confirmed today"
      : availabilityStaleDays === 1
        ? "Availability confirmed yesterday"
        : `Availability confirmed ${availabilityStaleDays} days ago`;

  // Places near the property: only what the agent entered (plus the metro station when they gave one).
  const nearbyForVisitors: NearbyPlace[] = [
    ...(property.metroStation && property.metroWalkingMinutes !== undefined && !(property.nearbyPlaces || []).some(p => p.type === "METRO")
      ? [{ type: "METRO" as const, name: property.metroStation, value: property.metroWalkingMinutes, unit: "WALK_MIN" as const }]
      : []),
    ...(property.nearbyPlaces || [])
  ];

  // SQM to SQFT calculation
  const getAreaDisplay = (areaSqm: number) => {
    if (displayUnit === "SQFT") {
      return `${Math.round(areaSqm * 10.7639).toLocaleString()} SQFT`;
    }
    return `${areaSqm.toLocaleString()} SQM`;
  };

  // Similar properties algorithm
  const similarProperties = (allProperties || [])
    .filter((p) => {
      // 1. Exclude current property
      if (p.id === property.id) return false;
      
      // 2. Must be approved/published
      if (p.verificationStatus !== VerificationStatus.APPROVED) return false;

      // 3. Strict transaction type match
      const isCurrentRent = property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE;
      const isTargetRent = p.transactionType === TransactionType.FOR_RENT || p.transactionType === TransactionType.COMMERCIAL_LEASE;
      if (isCurrentRent !== isTargetRent) return false;

      // 4. Property type match (e.g. APARTMENT vs APARTMENT, VILLA vs VILLA)
      if (p.propertyType !== property.propertyType) return false;

      // 5. Location matching (same district or city)
      const sameLocation = (p.district || "").toLowerCase() === (property.district || "").toLowerCase() || (p.city || "").toLowerCase() === (property.city || "").toLowerCase();
      if (!sameLocation) return false;

      // 6. Price range matching (±20% variance)
      const priceMin = property.price * 0.8;
      const priceMax = property.price * 1.2;
      return p.price >= priceMin && p.price <= priceMax;
    });

  // Intelligent fallback: if less than 3, relax criteria slightly to show helpful matches
  let finalSimilarListings = [...similarProperties];
  if (finalSimilarListings.length < 3) {
    const extraListings = (allProperties || [])
      .filter((p) => {
        if (p.id === property.id) return false;
        if (p.verificationStatus !== VerificationStatus.APPROVED) return false;
        if (finalSimilarListings.some((fl) => fl.id === p.id)) return false;

        const isCurrentRent = property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE;
        const isTargetRent = p.transactionType === TransactionType.FOR_RENT || p.transactionType === TransactionType.COMMERCIAL_LEASE;
        if (isCurrentRent !== isTargetRent) return false;

        return p.propertyType === property.propertyType || (p.city || "").toLowerCase() === (property.city || "").toLowerCase();
      })
      .slice(0, 3 - finalSimilarListings.length);
    finalSimilarListings = [...finalSimilarListings, ...extraListings];
  }
  // Cap at 3 for a beautiful responsive row
  finalSimilarListings = finalSimilarListings.slice(0, 3);

  // Handle lead submit
  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingName || !bookingPhone) return;
    setBookingError("");

    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        visitorName: bookingName,
        visitorPhone: bookingPhone,
        visitorEmail: bookingEmail,
        message: `I'd like to book a viewing for this listing on ${bookingDate || "any date"} at ${bookingTime || "any time"}.`,
        contactMethod: "INQUIRY",
        attribution: { campaign: sessionStorage.getItem("attributionCampaignId") || undefined }
      })
    })
    .then((res) => {
      if (!res.ok) throw new Error(`Booking request failed with status ${res.status}`);
      setBookingSent(true);
      setTimeout(() => setBookingSent(false), 5000);
    })
    .catch((err) => {
      console.error("Failed to submit booking request:", err);
      setBookingError(
        isRtl
          ? "تعذر إرسال طلب الحجز. يرجى المحاولة مرة أخرى."
          : "We couldn't send your booking request. Please try again."
      );
    });
  };

  const submitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) return;
    setReportError("");

    fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        reporterName: currentUser?.fullName || (isRtl ? "زائر مجهول" : "Anonymous Visitor"),
        reporterEmail: currentUser?.email || "anonymous@nerou.com",
        reason: reportReason,
        details: reportDetails
      })
    })
    .then((res) => {
      if (!res.ok) throw new Error(`Report submission failed with status ${res.status}`);
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setReportModalOpen(false);
        setReportReason("");
        setReportDetails("");
      }, 3000);
    })
    .catch((err) => {
      console.error("Failed to submit report:", err);
      setReportError(
        isRtl
          ? "تعذر إرسال البلاغ. يرجى المحاولة مرة أخرى."
          : "We couldn't submit your report. Please try again."
      );
    });
  };

  return (
    <div
      id="property-detail-container"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start p-2 sm:p-4 md:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="bg-[#FAF9F5] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in duration-300 relative flex flex-col max-h-[92vh] md:max-h-[96vh]">
        
        {/* TOP BAR / NAVIGATION */}
        <div className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-ink cursor-pointer transition-colors"
          >
            <ChevronLeft size={16} className={isRtl ? "rotate-180" : ""} />
            <span>{isRtl ? "العودة للعقارات" : "Back to Listings"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleCompare(property.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                isCompared
                  ? "bg-gold/10 border-gold text-gold"
                  : "bg-surface border-border text-ink hover:border-gold hover:text-gold"
              }`}
              title={isRtl ? "مقارنة العقار" : "Compare Property"}
            >
              <GitCompare size={15} />
              <span className="hidden sm:inline">{isRtl ? "قارن" : "Compare"}</span>
            </button>
            <button
              onClick={() => onToggleSave(property.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                isSaved
                  ? "bg-rose-50 border-rose-300 text-rose-500"
                  : "bg-surface border-border text-ink hover:border-gold hover:text-gold"
              }`}
              title={isRtl ? "حفظ العقار" : "Bookmark Property"}
            >
              <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
              <span className="hidden sm:inline">{isSaved ? (isRtl ? "محفوظ" : "Saved") : (isRtl ? "حفظ" : "Save")}</span>
            </button>
            <button
              onClick={handleShareViaWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border bg-surface border-border text-xs font-bold text-ink hover:border-gold hover:text-gold cursor-pointer transition-colors"
              title={isRtl ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
            >
              <MessageCircle size={15} />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border bg-surface border-border text-xs font-bold text-ink hover:border-gold hover:text-gold cursor-pointer transition-colors"
              title={isRtl ? "نسخ رابط العقار" : "Copy Link"}
            >
              {copiedLink ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
              <span className="hidden sm:inline">{copiedLink ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ الرابط" : "Copy link")}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full border bg-surface border-border text-ink hover:border-gold hover:text-gold cursor-pointer transition-colors"
              aria-label={isRtl ? "إغلاق" : "Close"}
              title={isRtl ? "إغلاق" : "Close"}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* MAIN BODY SCROLLABLE AREA */}
        <div className="overflow-y-auto flex-1 pb-16 md:pb-6">
          
          {/* HEADER HERO TITLE SECTION */}
          <div className="bg-surface p-4 sm:p-6 border-b border-border">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full bg-chrome text-white">
                {isRtl
                  ? property.transactionType === TransactionType.FOR_RENT ? "للإيجار" : "للبيع"
                  : property.transactionType === TransactionType.FOR_RENT ? "FOR RENT" : "FOR SALE"}
              </span>
              <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full bg-gold-soft text-gold-active border border-gold/25">
                {property.propertyType}
              </span>
              {property.verificationStatus === VerificationStatus.APPROVED && (
                <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full border border-gold/40 text-gold-active flex items-center gap-1.5">
                  <Shield size={11} fill="currentColor" />
                  {isRtl ? "قائمة موثّقة على المنصة" : "Verified Portal Listing"}
                </span>
              )}
              {/* Availability stated in both directions, matching the listing cards. */}
              {isAvailabilityConfirmed(property.lastConfirmedAvailableDate) ? (
                <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full bg-success-soft text-success flex items-center gap-1.5">
                  <CheckCircle size={11} />
                  {isRtl ? "مؤكّد متاح" : "Available"} ·{" "}
                  {formatConfirmedDate(property.lastConfirmedAvailableDate, isRtl)}
                </span>
              ) : isAvailabilityUnconfirmed ? (
                <span className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-full bg-warning-soft text-warning flex items-center gap-1.5">
                  <Clock size={11} />
                  {isRtl ? "بانتظار تأكيد التوفّر" : "Awaiting availability check"}
                </span>
              ) : null}
              <span className="text-[11px] font-mono text-ink-faint ms-auto">
                Ref: {property.listingId || `N-${property.id.substr(-5)}`}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-medium text-ink leading-[1.15]">
              {isRtl ? property.titleAr || property.title : property.title}
            </h1>

            <div className="flex items-center gap-1.5 text-sm text-ink-muted mt-3">
              <MapPin size={15} className="text-gold" />
              <span>
                {property.district}, {property.city}
              </span>
              <span className="mx-2">•</span>
              <span>{isRtl ? "رخصة الوكيل" : "Broker ID"}: {property.agentId}</span>
            </div>
          </div>

          {/* PHOTO GALLERY - full width, above the details (large hero + full-screen viewer) */}
          <div className="px-4 sm:px-6 pt-4 sm:pt-6">
            <PropertyGallery key={property.id} title={isRtl ? property.titleAr || property.title : property.title} isRtl={isRtl} groups={galleryGroups} videoEmbedUrl={getVideoEmbedUrl(property.videoUrl)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
            
            {/* LEFT COLUMN: MULTIMEDIA & DEEP DETAILS */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* How this price compares with the other live listings around it: real data, or nothing */}
              <MarketComparisonCard propertyId={property.id} isRtl={isRtl} formatPrice={formatPrice} />

              {/* MAIN DETAILS GRID (BEDS, BATHS, SIZE) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-surface p-5 rounded-2xl border border-border text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-ink-muted tracking-[0.14em] uppercase block">
                    {isRtl ? "المساحة الكلية" : "TOTAL SIZE"}
                  </span>
                  <strong className="font-serif text-xl font-medium text-ink block">
                    {getAreaDisplay(property.area)}
                  </strong>
                  <button
                    onClick={() => setDisplayUnit((prev) => (prev === "SQM" ? "SQFT" : "SQM"))}
                    className="text-[10px] text-gold hover:underline font-bold"
                  >
                    {isRtl ? `التحويل لـ ${displayUnit === "SQM" ? "قدم مربع" : "متر مربع"}` : `Convert to ${displayUnit === "SQM" ? "SQFT" : "SQM"}`}
                  </button>
                </div>

                <div className="bg-surface p-5 rounded-2xl border border-border text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-ink-muted tracking-[0.14em] uppercase block">
                    {isRtl ? "غرف النوم" : "BEDROOMS"}
                  </span>
                  <strong className="font-serif text-xl font-medium text-ink block">
                    {property.bedrooms} {isRtl ? "غرف" : "Rooms"}
                  </strong>
                  <span className="text-[10px] text-ink-muted">
                    {property.maidRoom ? `+ ${isRtl ? "غرفة خادمة" : "Maid Room"}` : isRtl ? "لا توجد غرفة خادمة" : "Standard"}
                  </span>
                </div>

                <div className="bg-surface p-5 rounded-2xl border border-border text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-ink-muted tracking-[0.14em] uppercase block">
                    {isRtl ? "الحمامات" : "BATHROOMS"}
                  </span>
                  <strong className="font-serif text-xl font-medium text-ink block">
                    {property.bathrooms} {isRtl ? "حمامات" : "Baths"}
                  </strong>
                  <span className="text-[10px] text-ink-muted">
                    {isRtl ? `+ حمام ضيوف` : "Guest Toilets"}
                  </span>
                </div>

                <div className="bg-surface p-5 rounded-2xl border border-border text-center space-y-1.5">
                  <span className="text-[10px] font-semibold text-ink-muted tracking-[0.14em] uppercase block">
                    {isRtl ? "حالة التأثيث" : "FURNISHED"}
                  </span>
                  <strong className="font-serif text-xl font-medium text-ink block">
                    {property.furnished === "YES" ? (isRtl ? "مؤثث بالكامل" : "Fully Furnished") :
                     property.furnished === "NO" ? (isRtl ? "غير مؤثث" : "Unfurnished") : (isRtl ? "شبه مؤثث" : "Partly Furnished")}
                  </strong>
                  <span className="text-[10px] text-ink-muted">
                    {isRtl ? "متاح فورا" : "Move-in Ready"}
                  </span>
                </div>
              </div>

              <AboutCard text={isRtl ? property.descriptionAr || property.description : property.description} isRtl={isRtl} />

              <SpecsCard rows={buildSpecRows(property, isRtl, { area: getAreaDisplay, money: (n) => formatPrice(n, isRtl) })} isRtl={isRtl} />

              {property.transactionType === TransactionType.OFF_PLAN && property.paymentPlan && (
                <PaymentPlanCard plan={property.paymentPlan} isRtl={isRtl} />
              )}

              {/* LISTING AMENITIES */}
              {(property.amenities || []).filter(a => a && a.trim()).length > 0 && (
                <div className="bg-surface p-6 sm:p-8 rounded-2xl border border-border">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="h-px w-8 bg-gold shrink-0" aria-hidden="true" />
                    <h3 className="font-serif text-xl font-medium text-ink">{isRtl ? "المرافق والخدمات" : "Amenities"}</h3>
                  </div>
                  <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3.5">
                    {property.amenities.filter(a => a && a.trim()).map((amenity, idx) => (
                      <li key={idx} className="flex items-center gap-2.5 text-sm text-ink">
                        <CheckCircle size={15} className="text-gold shrink-0" />
                        <span>{amenity.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* INTERACTIVE FLOOR PLAN GALLERY */}
              <div className="bg-surface p-6 rounded-xl border border-border space-y-4">
                <div className="flex justify-between items-center border-b border-surface-2 pb-2">
                  <h3 className="font-serif text-lg font-medium text-ink">
                    {isRtl ? "مخططات الطوابق الهندسية" : "Architectural Floor Plans"}
                  </h3>
                  <button
                    onClick={() => setIsFloorPlanFullscreen(true)}
                    className="text-xs font-bold text-gold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Maximize2 size={13} />
                    <span>{isRtl ? "ملء الشاشة" : "Interactive View"}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  {["Ground Floor", "First Floor"].map((planName, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveFloorPlanIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                        activeFloorPlanIndex === idx
                          ? "bg-chrome text-white border-ink"
                          : "bg-canvas text-ink-muted border-border hover:bg-surface"
                      }`}
                    >
                      {isRtl ? (idx === 0 ? "الطابق الأرضي" : "الطابق الأول") : planName}
                    </button>
                  ))}
                </div>

                <div className="bg-stone-50 border border-border p-4 rounded-xl flex justify-center items-center relative overflow-hidden group">
                  <img
                    src={categorizedImages.FLOOR_PLAN[activeFloorPlanIndex] || categorizedImages.FLOOR_PLAN[0]}
                    alt="Floor Plan"
                    className="max-h-64 object-contain"
                  />
                  
                  {/* Download button */}
                  <a
                    href={categorizedImages.FLOOR_PLAN[activeFloorPlanIndex] || categorizedImages.FLOOR_PLAN[0]}
                    download={`floorplan-${property.listingId}.jpg`}
                    className="absolute bottom-3 right-3 p-2 bg-white/90 backdrop-blur-xs border border-border text-gray-500 hover:text-gray-900 rounded-full shadow-sm hover:scale-105 transition-all"
                    title={isRtl ? "تحميل المخطط" : "Download High-Res PDF Schema"}
                  >
                    <Download size={15} />
                  </a>
                </div>
              </div>

              {/* LOCATION INTELLIGENCE & MAPS */}
              <div className="bg-surface p-6 rounded-xl border border-border space-y-4">
                <h3 className="font-serif text-xl font-medium text-ink border-b border-border pb-3">
                  {isRtl ? "الموقع" : "Location"}
                </h3>

                {/* Mock Privacy Map approximation */}
                <div className="relative w-full h-56 bg-slate-100 rounded-xl border border-border overflow-hidden">
                  <div className="absolute inset-0 bg-[#E5E3DF] flex items-center justify-center">
                    {/* SVG map background mock */}
                    <svg className="w-full h-full opacity-65" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M0,20 Q40,30 80,10 T100,50" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                      <path d="M20,0 Q30,50 10,90 T80,100" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                      <rect x="35" y="45" width="30" height="15" rx="2" fill="#D3CFC9" />
                    </svg>

                    {/* Approximation Circle */}
                    <div className="absolute w-24 h-24 bg-gold/15 border-2 border-dashed border-gold rounded-full flex items-center justify-center animate-pulse">
                      <MapPin size={24} className="text-gold" />
                    </div>

                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 border border-border rounded text-[10px] text-gray-500 font-bold flex items-center gap-1">
                      <MapPin size={11} className="text-gold" />
                      <span>{property.district}, {property.city}</span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-xs p-2 border border-border rounded text-[9px] text-gray-500 text-center font-medium flex items-center justify-center gap-1">
                      <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                      <span>{isRtl ? "العنوان الدقيق مخفي لخصوصية البائع. الدائرة تمثل النطاق التقريبي للحي." : "Approximate area only to safeguard property owner's absolute privacy rights."}</span>
                    </div>
                  </div>
                </div>

                <NearbyList places={nearbyForVisitors} isRtl={isRtl} />
              </div>

              <ListingRecordCard property={property} isRtl={isRtl} formatPrice={formatPrice} />

              {/* A financing and rental-return planner only makes sense for a purchase, so it is not drawn for rentals. */}
              {(property.transactionType === TransactionType.FOR_SALE ||
                property.transactionType === TransactionType.OFF_PLAN ||
                property.transactionType === TransactionType.COMMERCIAL_SALE ||
                property.transactionType === TransactionType.LAND_SALE) && (
                <InvestmentPlanner property={property} isRtl={isRtl} formatPrice={formatPrice} />
              )}

              {/* REPORT PROPERTY BUTTON */}
              <div className="flex justify-between items-center py-4 text-xs text-ink-muted">
                <span>{isRtl ? "هل لاحظت بيانات خاطئة أو احتيالية؟" : "Spot incorrect parameters or misleading details?"}</span>
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="px-3 py-1.5 border border-red-200 hover:border-red-500 bg-surface hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <AlertTriangle size={13} />
                  <span>{isRtl ? "الإبلاغ عن الإعلان" : "Report this Listing"}</span>
                </button>
              </div>

              {/* SIMILAR LISTINGS SECTION */}
              {finalSimilarListings.length > 0 && (
                <div className="pt-6 border-t border-border space-y-4">
                  <h4 className="font-serif text-base font-bold text-ink">
                    {isRtl ? "عقارات مشابهة قد تهمك" : "Similar Properties You Might Interest"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {finalSimilarListings.map((sim) => {
                      const simPrice = sim.price;
                      const isSimRent = sim.transactionType === TransactionType.FOR_RENT || sim.transactionType === TransactionType.COMMERCIAL_LEASE;
                      const fallbackImg = "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=600&q=80";
                      const simImg = sim.images && sim.images[0] ? sim.images[0] : fallbackImg;
                      
                      return (
                        <div
                          key={sim.id}
                          onClick={() => {
                            if (onSelectProperty) {
                              onSelectProperty(sim);
                              // Smooth scroll detail view container to top
                              const container = document.getElementById("property-detail-container");
                              if (container) {
                                container.scrollTo({ top: 0, behavior: "smooth" });
                              }
                            }
                          }}
                          className="bg-surface rounded-xl border border-border hover:border-gold overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
                        >
                          <div className="relative h-28 overflow-hidden bg-stone-100">
                            <img
                              src={simImg}
                              alt={sim.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-2 right-2 bg-chrome/80 backdrop-blur-xs px-2 py-0.5 rounded text-[8px] text-white font-bold tracking-wider uppercase">
                              {isRtl
                                ? sim.propertyType === PropertyType.APARTMENT ? "شقة" : sim.propertyType === PropertyType.VILLA ? "فيلا" : "مكتب تجاري"
                                : sim.propertyType
                              }
                            </div>
                          </div>

                          <div className="p-3 flex-grow flex flex-col justify-between space-y-2">
                            <div>
                              <strong className="text-xs text-gold font-bold block">
                                {formatPrice(sim.price, isRtl)}
                                {isSimRent && <span className="text-[10px] text-ink-muted font-normal"> / {sim.rentalPeriod || "YR"}</span>}
                              </strong>
                              <h5 className="font-bold text-[11px] text-ink line-clamp-1 group-hover:text-gold transition-colors mt-0.5">
                                {isRtl ? sim.titleAr || sim.title : sim.title}
                              </h5>
                              <p className="text-[9px] text-ink-muted line-clamp-1 flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 bg-gold rounded-full"></span>
                                {sim.district}, {sim.city}
                              </p>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-ink-muted border-t border-surface-2 pt-2 mt-1">
                              <span>{sim.bedrooms} {isRtl ? "غرف" : "Beds"}</span>
                              <span>•</span>
                              <span>{sim.bathrooms} {isRtl ? "حمامات" : "Baths"}</span>
                              <span>•</span>
                              <span>{sim.area} {isRtl ? "م٢" : "SQM"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* RIGHT COLUMN: STICKY LEAD CONVERSION CARD (DESKTOP) */}
            <div className="lg:col-span-4 relative">
              <div className="lg:sticky lg:top-4 space-y-4">

                {/* PRICE HERO CARD (desktop) - previously only visible in the mobile sticky bar */}
                <div className="hidden lg:block bg-chrome rounded-xl border border-chrome-hover shadow-sm p-5 space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                    {isRtl ? "السعر الكلي المقدر" : "Asking Price"}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <strong className="font-serif text-3xl font-semibold text-gold">
                      {propertyPrice.toLocaleString()} {currencySymbol}
                    </strong>
                    {isRent && (
                      <span className="text-xs text-gray-400"> / {property.rentalPeriod || "YR"}</span>
                    )}
                  </div>
                  {property.serviceCharges != null && (
                    <p className="text-[10px] text-ink-muted pt-1">
                      {isRtl ? "+ رسوم الخدمة" : "+ Service Charges"}: {property.serviceCharges.toLocaleString()} {currencySymbol}
                    </p>
                  )}
                  {/* Public trust signal: honest freshness indicator, computed from
                      lastConfirmedAvailableDate rather than fabricated. */}
                  <div className={`flex items-center gap-1 pt-2 mt-1 border-t border-chrome-hover text-[10px] ${isAvailabilityUnconfirmed ? "text-amber-400" : "text-gray-400"}`}>
                    <Clock size={11} />
                    <span>{availabilityConfirmedText}</span>
                  </div>
                  {/* Real view count - Property.views is the running total maintained by
                      POST /api/properties/:id/view (see the effect above that fires it on
                      mount). Never fabricated: a genuinely fresh listing honestly shows 0/1. */}
                  <div className="flex items-center gap-1 pt-1 text-[10px] text-gray-400">
                    <Eye size={11} />
                    <span>
                      {isRtl
                        ? `${liveViewCount.toLocaleString()} مشاهدة`
                        : `${liveViewCount.toLocaleString()} ${liveViewCount === 1 ? "view" : "views"}`}
                    </span>
                  </div>
                  {/* District Market Price Index context - real comparison against the live
                      QAR/sqm average for this district + transaction bucket, never fabricated
                      (see the effect above; stays hidden entirely when there's no confident
                      comparison group). */}
                  {marketContext && (
                    <div
                      className={`flex items-center gap-1 pt-1 text-[10px] ${
                        Math.abs(marketContext.diffPercent) < 1
                          ? "text-gray-400"
                          : marketContext.diffPercent > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      <Activity size={11} />
                      <span>
                        {Math.abs(marketContext.diffPercent) < 1
                          ? isRtl
                            ? `هذا السعر يتماشى مع متوسط سعر المتر المربع في ${property.district}`
                            : `In line with the average QAR/sqm for ${property.district}`
                          : isRtl
                          ? `هذا السعر ${Math.abs(Math.round(marketContext.diffPercent))}% ${marketContext.diffPercent > 0 ? "أعلى" : "أقل"} من متوسط سعر المتر المربع في ${property.district}`
                          : `${Math.abs(Math.round(marketContext.diffPercent))}% ${marketContext.diffPercent > 0 ? "above" : "below"} the average QAR/sqm for ${property.district}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* REPRESENTATIVE AGENCY CARD */}
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border border-border">
                      <img
                        src={agentInfo?.agentPhotoUrl || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80"}
                        alt="Agent"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-ink">
                        {agentInfo?.agentName || agentInfo?.orgName || (isRtl ? "فريق نيرو فايندر" : "Nerou Finder Team")}
                      </h4>
                      {agentInfo?.isVerifiedAgent && (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Award size={11} fill="currentColor" />
                          <span>{isRtl ? agentInfo.verifiedBadgeLabelAr : agentInfo.verifiedBadgeLabel}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-ink-muted">
                    <p>💼 <strong>{agentInfo?.orgName || "Nerou Finder Partner Network"}</strong></p>
                    <p>🌐 {isRtl ? "يتحدث: العربية، الإنجليزية" : "Languages: Arabic, English"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      onClick={handleWhatsAppAction}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer animate-pulse"
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp</span>
                    </button>
                    {agentInfo?.callNumber ? (
                      <a
                        href={`tel:+${agentInfo.callNumber}`}
                        className="px-3 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white rounded-lg font-bold flex items-center justify-center gap-1 transition-colors"
                      >
                        <Phone size={14} />
                        <span>{isRtl ? "اتصال" : "Call"}</span>
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        title={agentInfo ? (isRtl ? "لم يضف الوكيل رقم هاتف" : "The agent has not listed a phone number") : undefined}
                        className="px-3 py-2 bg-chrome/40 text-white/70 rounded-lg font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                      >
                        <Phone size={14} />
                        <span>{isRtl ? "اتصال" : "Call"}</span>
                      </span>
                    )}
                  </div>

                  {onViewAgentProfile && (agentInfo?.hasAssignedAgent || agentInfo?.orgName) && (
                    <button
                      onClick={onViewAgentProfile}
                      className="w-full px-3 py-2 bg-surface hover:bg-gold/10 border border-border hover:border-gold text-ink rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Award size={13} className="text-gold" />
                      <span>{isRtl ? "عرض الملف الشخصي والتقييمات" : "View Full Profile & Reviews"}</span>
                    </button>
                  )}
                </div>

                {/* SCHEDULE VIEWING INTERACTIVE FORM */}
                <div className="bg-surface p-5 rounded-xl border border-border shadow-sm space-y-4">
                  <h3 className="font-serif text-sm font-semibold text-ink border-b border-surface-2 pb-2">
                    {isRtl ? "جدولة موعد للمعاينة الفورية" : "Schedule a Private Viewing"}
                  </h3>

                  {bookingSent ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center space-y-2 text-xs">
                      <CheckCircle size={24} className="text-emerald-600 mx-auto" />
                      <h4 className="font-bold text-emerald-800">{isRtl ? "تم إرسال الطلب بنجاح!" : "Request Lodged Successfully"}</h4>
                      <p className="text-emerald-700">{isRtl ? "يقوم المستشار المالي بمراجعة التقويم وتأكيد الموعد عبر واتساب قريباً" : "Your representative will verify schedules and contact you on WhatsApp shortly."}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleBookingSubmit} className="space-y-3 text-xs">
                      {bookingError && (
                        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] font-medium">
                          {bookingError}
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-ink-muted font-medium">{isRtl ? "الاسم الكريم" : "Your Name"}</label>
                        <input
                          type="text"
                          required
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          placeholder="e.g. Jassem Al-Thani"
                          className="w-full px-3 py-2 bg-canvas border border-border rounded-lg focus:outline-none focus:border-gold text-base md:text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-ink-muted font-medium">{isRtl ? "رقم الجوال (مع رمز البلد)" : "Contact Number"}</label>
                        <input
                          type="tel"
                          inputMode="tel"
                          required
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          placeholder="+974 5555 6666"
                          className="w-full px-3 py-2 bg-canvas border border-border rounded-lg focus:outline-none focus:border-gold text-base md:text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-ink-muted font-medium">{isRtl ? "التاريخ المفضل" : "Preferred Date"}</label>
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-base md:text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-ink-muted font-medium">{isRtl ? "الفترة المفضلة" : "Slot"}</label>
                          <select
                            value={bookingTime}
                            onChange={(e) => setBookingTime(e.target.value)}
                            className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-base md:text-xs"
                          >
                            <option value="MORNING">AM (09:00 - 12:00)</option>
                            <option value="AFTERNOON">PM (12:00 - 16:00)</option>
                            <option value="EVENING">PM (16:00 - 19:00)</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="w-full py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white rounded-lg font-bold transition-colors cursor-pointer"
                          >
                            {isRtl ? "إرسال حجز" : "Book Now"}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* MOBILE STICKY CONVERSION BAR (FOOTER) */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border p-3 flex items-center justify-between lg:hidden shadow-lg shrink-0">
          <div className="space-y-0.5">
            <span className="text-[10px] text-ink-muted font-medium block">{isRtl ? "السعر الكلي المقدر" : "ASKING PRICE"}</span>
            <strong className="text-gold text-lg font-bold">
              {propertyPrice.toLocaleString()} {currencySymbol}
              {isRent && <span className="text-xs text-ink-muted"> / {property.rentalPeriod || "YR"}</span>}
            </strong>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleWhatsAppAction}
              className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center justify-center cursor-pointer"
            >
              <MessageCircle size={18} />
            </button>
            {agentInfo?.callNumber ? (
              <a
                href={`tel:+${agentInfo.callNumber}`}
                className="px-4 py-2.5 bg-chrome text-white font-bold rounded-lg hover:bg-gold hover:text-gold-ink flex items-center gap-1"
              >
                <Phone size={14} />
                <span>{isRtl ? "اتصال" : "Call Agent"}</span>
              </a>
            ) : (
              <span aria-disabled="true" className="px-4 py-2.5 bg-chrome/40 text-white/70 font-bold rounded-lg flex items-center gap-1 cursor-not-allowed">
                <Phone size={14} />
                <span>{isRtl ? "اتصال" : "Call Agent"}</span>
              </span>
            )}
          </div>
        </div>

        {/* REPORT SUBMIT MODAL DIALOG */}
        {reportModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex justify-center items-center p-4">
            <div className="bg-surface rounded-xl border border-border shadow-2xl p-5 w-full max-w-md space-y-4 relative">
              <h4 className="font-serif text-lg font-bold text-ink flex items-center gap-1.5">
                <AlertTriangle className="text-red-600" size={18} />
                <span>{isRtl ? "تقديم تقرير مخالفة عقارية" : "Report Misrepresentation Audit"}</span>
              </h4>

              {reportSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs space-y-1.5">
                  <CheckCircle size={20} className="text-emerald-600 mx-auto" />
                  <strong className="text-emerald-800">{isRtl ? "شكراً لمساهمتك!" : "Report Registered"}</strong>
                  <p className="text-emerald-700">{isRtl ? "يقوم فريق الجودة والامتثال بمراجعة إعلان العقار لاتخاذ الإجراءات اللازمة" : "Our listing quality compliance division will inspect details within 12 hours."}</p>
                </div>
              ) : (
                <form onSubmit={submitReport} className="space-y-3 text-xs">
                  {reportError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] font-medium">
                      {reportError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-ink-muted font-medium">{isRtl ? "سبب الإبلاغ" : "Reporting Reason"}</label>
                    <select
                      required
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 bg-canvas border border-border rounded-lg focus:outline-none text-base md:text-xs"
                    >
                      <option value="">-- {isRtl ? "اختر السبب" : "Select violation type"} --</option>
                      <option value="fake_listing">{isRtl ? "عقار وهمي أو تم بيعه بالفعل" : "Fake or Sold / Unavailable listing"}</option>
                      <option value="incorrect_price">{isRtl ? "السعر خاطئ أو مضلل" : "Misleading price tag"}</option>
                      <option value="misleading">{isRtl ? "صور غير مطابقة للموقع" : "Irrelevant/misleading photo gallery"}</option>
                      <option value="other">{isRtl ? "أسباب أخرى للتظلم" : "Other discrepancies"}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-ink-muted font-medium">{isRtl ? "مزيد من التفاصيل" : "Detailed Notes"}</label>
                    <textarea
                      rows={3}
                      required
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Specify what details are wrong..."
                      className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-base md:text-xs"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="px-4 py-2 border border-border text-ink-muted rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                    >
                      {isRtl ? "إرسال التقرير" : "Submit Report"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* FULLSCREEN FLOOR PLAN MODAL */}
        {isFloorPlanFullscreen && (
          <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-center items-center p-4">
            <button
              onClick={() => setIsFloorPlanFullscreen(false)}
              className="absolute top-6 right-6 text-white text-xs font-bold bg-white/10 px-3 py-2 border border-white/20 rounded-full hover:bg-white/20"
            >
              Close
            </button>
            <img
              src={categorizedImages.FLOOR_PLAN[activeFloorPlanIndex] || categorizedImages.FLOOR_PLAN[0]}
              alt="Fullscreen Plan"
              className="max-w-full max-h-[85vh] object-contain"
            />
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// "How this price compares": the listing's price per square metre against the median of the other live listings in
// the same district (GET /api/properties/:id/market-comparison). Everything shown comes from that data; when there
// are too few similar listings it says so instead of inventing a figure. Draws nothing until the answer arrives, and
// nothing at all if the request fails.
// ---------------------------------------------------------------------------------------------------------------
type ComparisonReply =
  | { comparable: false; deal: "RENT" | "SALE" | null; district: string; comparableCount: number; listingPricePerSqm: number | null }
  | {
      comparable: true; deal: "RENT" | "SALE"; district: string; city: string; propertyType: string;
      basis: "same-type" | "any-type"; comparableCount: number; listingPricePerSqm: number; medianPricePerSqm: number;
      differencePercent: number; position: "below" | "in-line" | "above"; lowConfidence: boolean; perMonth: boolean;
    };

function MarketComparisonCard({ propertyId, isRtl, formatPrice }: { propertyId: string; isRtl: boolean; formatPrice: (n: number, rtl: boolean) => string }) {
  const [data, setData] = useState<ComparisonReply | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/properties/${encodeURIComponent(propertyId)}/market-comparison`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d && typeof d.comparable === "boolean") setData(d); })
      .catch(() => { /* no comparison is better than a wrong one */ });
    return () => { cancelled = true; };
  }, [propertyId]);
  if (!data) return null;
  const t = (en: string, ar: string) => (isRtl ? ar : en);

  const shell = "bg-surface p-5 rounded-2xl border border-border space-y-4 relative overflow-hidden";
  const head = (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-gold-soft text-gold-active flex items-center justify-center shrink-0"><TrendingUp size={17} /></span>
      <h3 className="font-serif text-lg font-medium text-ink">{t("How this price compares", "كيف يقارن هذا السعر")}</h3>
    </div>
  );
  const perSqm = (n: number, month: boolean) => `${formatPrice(n, isRtl)} / ${t("sqm", "م²")}${month ? ` ${t("per month", "شهرياً")}` : ""}`;
  const source = t(
    "Calculated from the live listings on Nerou Finder. It is a comparison of advertised prices, not a valuation.",
    "محسوب من العقارات المعروضة حالياً على نيرو فايندر. هو مقارنة بالأسعار المعلنة وليس تقييماً للعقار."
  );

  if (!data.comparable) {
    return (
      <div className={shell}>
        {head}
        <p className="text-sm text-ink-muted leading-relaxed">
          {t(
            `There are not enough similar listings in ${data.district || "this area"} yet to compare this price fairly.`,
            `لا توجد حتى الآن عقارات مماثلة كافية في ${data.district || "هذه المنطقة"} لمقارنة هذا السعر بإنصاف.`
          )}
          {data.listingPricePerSqm !== null && (
            <> {t("This listing is", "سعر هذا العقار")} <strong className="text-ink font-semibold">{perSqm(data.listingPricePerSqm, data.deal === "RENT")}</strong>.</>
          )}
        </p>
        <p className="text-[11px] text-ink-faint">{source}</p>
      </div>
    );
  }

  const abs = Math.abs(data.differencePercent);
  const headline = data.position === "in-line"
    ? t("In line with the area median", "قريب من متوسط المنطقة")
    : data.position === "below"
      ? t(`${abs}% below the area median`, `أقل من متوسط المنطقة بنسبة ${abs}٪`)
      : t(`${abs}% above the area median`, `أعلى من متوسط المنطقة بنسبة ${abs}٪`);
  const tone = data.position === "below" ? "text-success" : data.position === "above" ? "text-warning" : "text-ink";
  const dot = data.position === "below" ? "bg-success" : data.position === "above" ? "bg-warning" : "bg-ink";
  // the median sits in the middle of the track; the listing's mark is placed by its price relative to it
  const ratio = data.listingPricePerSqm / data.medianPricePerSqm;
  const pos = Math.min(94, Math.max(6, (ratio / 2) * 100));
  const dealWord = data.deal === "RENT" ? t("for rent", "للإيجار") : t("for sale", "للبيع");
  const typeWord = data.basis === "same-type" ? `${String(data.propertyType).replace(/_/g, " ").toLowerCase()} ` : "";

  return (
    <div className={shell}>
      {head}
      <div className="space-y-1">
        <p className={`font-serif text-2xl font-medium ${tone}`}>{headline}</p>
        <p className="text-sm text-ink-muted">
          {t(
            `Compared with ${data.comparableCount} other live ${typeWord}listings ${dealWord} in ${data.district}.`,
            `مقارنة بـ ${data.comparableCount} عقارات معروضة أخرى ${dealWord} في ${data.district}.`
          )}
        </p>
      </div>

      <div className="space-y-2" aria-hidden="true">
        <div className="relative h-2 rounded-full bg-surface-2">
          <span className="absolute inset-y-0 start-1/2 w-px bg-ink-faint" />
          <span
            className={`absolute top-1/2 w-4 h-4 rounded-full border-2 border-surface shadow ${dot}`}
            style={{ [isRtl ? "right" : "left"]: `${pos}%`, transform: isRtl ? "translate(50%, -50%)" : "translate(-50%, -50%)" }}
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-ink-faint">
          <span>{t("Lower", "أقل")}</span><span>{t("Area median", "متوسط المنطقة")}</span><span>{t("Higher", "أعلى")}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-canvas border border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">{t("This listing", "هذا العقار")}</p>
          <p className="font-semibold text-ink tabular-nums">{perSqm(data.listingPricePerSqm, data.perMonth)}</p>
        </div>
        <div className="rounded-xl bg-canvas border border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">{t("Area median", "متوسط المنطقة")}</p>
          <p className="font-semibold text-ink tabular-nums">{perSqm(data.medianPricePerSqm, data.perMonth)}</p>
        </div>
      </div>

      {data.lowConfidence && (
        <p className="text-xs text-warning">{t("Based on only a few listings, so treat it as a rough guide.", "مبني على عدد قليل من العقارات، فاعتبره مؤشراً تقريبياً.")}</p>
      )}
      <p className="text-[11px] text-ink-faint">{source}</p>
    </div>
  );
}
