/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Property, VerificationStatus, TransactionType, PropertyType } from "../types.js";
import { useCurrency } from "../currencyContext.js";
import {
  MapPin,
  Calendar,
  Share2,
  Bookmark,
  Shield,
  Eye,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  Calculator,
  Compass,
  AlertTriangle,
  Building,
  DollarSign,
  TrendingUp,
  Activity,
  Award,
  Download,
  CheckCircle,
  HelpCircle,
  MessageCircle,
  Phone,
  Check
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
  // Gallery State
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<"ALL" | "INTERIOR" | "EXTERIOR" | "FLOOR_PLAN">("ALL");
  const [view360, setView360] = useState(false);
  const [virtualPitch, setVirtualPitch] = useState(0); // For virtual tour rotation effect

  // Interactive Tools State
  const [downpaymentPercent, setDownpaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(4.25);
  const [loanTenure, setLoanTenure] = useState(25);
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
    isVerifiedAgent: boolean;
    hasAssignedAgent: boolean;
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
      const brochurePhone = agentInfo?.phone
        ? `+${agentInfo.phone.slice(0, 3)} ${agentInfo.phone.slice(3, 7)} ${agentInfo.phone.slice(7)}`
        : "+974 3333 4444";

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
      doc.text(`Contact: ${brochurePhone} | Email: licensing@nerou.io`, 25, footerY + 29);
      doc.text(
        agentInfo?.isVerifiedAgent ? "Verified Nerou Finder Certified Partner" : "Nerou Finder Certified Partner Network",
        25,
        footerY + 35
      );

      doc.save(`Brochure-${property.listingId}.pdf`);
    }).catch(err => {
      console.error("Failed to load jsPDF", err);
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleWhatsAppAction = async () => {
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
          message: `Visitor initiated WhatsApp inquiry for: ${property.title} (Listing ID: ${property.listingId}).`
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
    const shareUrl = `${window.location.origin}/properties/${property.id}`;

    // Format pre-filled message exactly as requested
    const messageText = isRtl
      ? `مرحباً، أنا مهتم بهذا العقار:\nالعقار: ${titleText}\nالموقع: ${locationText}\nالسعر: ${priceText}\nرقم الإعلان: ${property.listingId}\nالرابط: ${shareUrl}`
      : `Hello, I am interested in this property:\nProperty: ${titleText}\nLocation: ${locationText}\nPrice: ${priceText}\nProperty ID: ${property.listingId}\nLink: ${shareUrl}`;

    window.open(`https://wa.me/${contactNumber}?text=${encodeURIComponent(messageText)}`, "_blank");
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

  const currentImagesList = categorizedImages[activeCategory];
  const safeImageIndex = activeImageIndex >= currentImagesList.length ? 0 : activeImageIndex;
  const activeImage = currentImagesList[safeImageIndex] || images[0];

  // Price calculations
  const isRent = property.transactionType === TransactionType.FOR_RENT || property.transactionType === TransactionType.COMMERCIAL_LEASE;
  const currencySymbol = getCurrencySymbol(isRtl);
  const propertyPrice = convertPrice(property.price);

  // Mortgage calculation: M = P [ i(1+i)^n ] / [ (1+i)^n - 1 ]
  const principal = propertyPrice * (1 - downpaymentPercent / 100);
  const monthlyInterest = interestRate / 100 / 12;
  const numberOfPayments = loanTenure * 12;
  const estimatedMonthlyMortgage = principal > 0 && monthlyInterest > 0
    ? (principal * monthlyInterest * Math.pow(1 + monthlyInterest, numberOfPayments)) / (Math.pow(1 + monthlyInterest, numberOfPayments) - 1)
    : 0;

  // Investment Yield estimation (for sale)
  // Dynamic yield averages in Qatar based on area
  const getAverageYieldForArea = (district: string) => {
    const d = district.toLowerCase();
    if (d.includes("pearl")) return 8.2;
    if (d.includes("lusail")) return 7.8;
    if (d.includes("west bay")) return 7.5;
    if (d.includes("mushaireb")) return 7.2;
    return 6.5;
  };
  const averageYield = getAverageYieldForArea(property.district);
  const estimatedAnnualRent = propertyPrice * (averageYield / 100);
  const estimatedMonthlyRent = estimatedAnnualRent / 12;

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
      const sameLocation = p.district.toLowerCase() === property.district.toLowerCase() || p.city.toLowerCase() === property.city.toLowerCase();
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

        return p.propertyType === property.propertyType || p.city.toLowerCase() === property.city.toLowerCase();
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
        contactMethod: "INQUIRY"
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
      <div className="bg-[#FAF9F5] w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-[#E6E2DE] animate-in fade-in duration-300 relative flex flex-col max-h-[92vh] md:max-h-[96vh]">
        
        {/* TOP BAR / NAVIGATION */}
        <div className="bg-white border-b border-[#E6E2DE] px-4 py-3 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-bold text-[#6E6B66] hover:text-[#1A1918] cursor-pointer transition-colors"
          >
            <ChevronLeft size={16} className={isRtl ? "rotate-180" : ""} />
            <span>{isRtl ? "العودة للعقارات" : "Back to Listings"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleCompare(property.id)}
              className={`p-2 rounded-full border cursor-pointer transition-colors ${
                isCompared
                  ? "bg-[#BF9B30]/10 border-[#BF9B30] text-[#BF9B30]"
                  : "bg-white border-[#E6E2DE] text-[#6E6B66] hover:text-[#1A1918]"
              }`}
              title={isRtl ? "مقارنة العقار" : "Compare Property"}
            >
              <Activity size={15} />
            </button>
            <button
              onClick={() => onToggleSave(property.id)}
              className={`p-2 rounded-full border cursor-pointer transition-colors ${
                isSaved
                  ? "bg-rose-50 border-rose-300 text-rose-500"
                  : "bg-white border-[#E6E2DE] text-[#6E6B66] hover:text-[#1A1918]"
              }`}
              title={isRtl ? "حفظ العقار" : "Bookmark Property"}
            >
              <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-full border bg-white border-[#E6E2DE] text-[#6E6B66] hover:text-[#1A1918] cursor-pointer transition-colors"
              title={isRtl ? "مشاركة" : "Share"}
            >
              {copiedLink ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full border bg-white border-[#E6E2DE] text-[#6E6B66] hover:text-[#1A1918] cursor-pointer transition-colors"
            >
              <Maximize2 size={15} className="rotate-45" />
            </button>
          </div>
        </div>

        {/* MAIN BODY SCROLLABLE AREA */}
        <div className="overflow-y-auto flex-1 pb-16 md:pb-6">
          
          {/* HEADER HERO TITLE SECTION */}
          <div className="bg-white p-4 sm:p-6 border-b border-[#E6E2DE]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-[#1A1918] text-white text-[10px] font-bold uppercase tracking-wider rounded-sm">
                {isRtl
                  ? property.transactionType === TransactionType.FOR_RENT ? "للإيجار" : "للبيع"
                  : property.transactionType === TransactionType.FOR_RENT ? "FOR RENT" : "FOR SALE"}
              </span>
              <span className="px-2 py-0.5 bg-[#BF9B30]/10 text-[#BF9B30] text-[10px] font-bold uppercase rounded-sm">
                {property.propertyType}
              </span>
              {property.verificationStatus === VerificationStatus.APPROVED && (
                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold flex items-center gap-1 rounded-sm">
                  <Shield size={10} fill="currentColor" />
                  {isRtl ? "مؤكد ومعتمد" : "Verified Portal Listing"}
                </span>
              )}
              <span className="text-[10px] font-mono text-[#6E6B66] ml-auto">
                Ref: {property.listingId || `N-${property.id.substr(-5)}`}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif font-medium text-[#1A1918]">
              {isRtl ? property.titleAr || property.title : property.title}
            </h1>

            <div className="flex items-center gap-1 text-xs text-[#6E6B66] mt-2">
              <MapPin size={14} className="text-[#BF9B30]" />
              <span>
                {property.district}, {property.city}
              </span>
              <span className="mx-2">•</span>
              <span>{isRtl ? "رخصة الوكيل" : "Broker ID"}: {property.agentId}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
            
            {/* LEFT COLUMN: MULTIMEDIA & DEEP DETAILS */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* ADVANCED MEDIA GALLERY WITH TABS */}
              <div className="bg-white rounded-xl border border-[#E6E2DE] overflow-hidden shadow-sm relative">
                
                {/* Category Tags Overlay */}
                <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  {(["ALL", "INTERIOR", "EXTERIOR", "FLOOR_PLAN"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat);
                        setActiveImageIndex(0);
                        setView360(false);
                      }}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full cursor-pointer transition-all ${
                        activeCategory === cat && !view360
                          ? "bg-[#BF9B30] text-white shadow-md"
                          : "bg-white/90 backdrop-blur-xs text-[#1A1918] border border-[#E6E2DE] hover:bg-white"
                      }`}
                    >
                      {isRtl
                        ? cat === "ALL" ? "الكل" : cat === "INTERIOR" ? "الداخلية" : cat === "EXTERIOR" ? "الخارجية" : "مخطط الطابق"
                        : cat === "ALL" ? "All Media" : cat === "INTERIOR" ? "Interior" : cat === "EXTERIOR" ? "Exterior" : "Floor Plans"
                      }
                    </button>
                  ))}
                  <button
                    onClick={() => setView360(true)}
                    className={`px-3 py-1 text-[10px] font-bold rounded-full cursor-pointer transition-all flex items-center gap-1 ${
                      view360
                        ? "bg-[#BF9B30] text-white shadow-md"
                        : "bg-white/90 backdrop-blur-xs text-[#1A1918] border border-[#E6E2DE] hover:bg-white"
                    }`}
                  >
                    <Compass size={11} className="animate-spin-slow" />
                    <span>{isRtl ? "جولة افتراضية ٣٦٠°" : "360° Virtual Tour"}</span>
                  </button>
                </div>

                {/* Main Media Preview Box */}
                <div className="aspect-video w-full bg-slate-100 relative overflow-hidden group">
                  {view360 ? (
                    <div className="w-full h-full relative flex flex-col justify-center items-center bg-slate-900 text-white">
                      {/* Panoramic Mock Image with drag rotation slider */}
                      <img
                        src={activeImage}
                        alt="360 view"
                        className="w-full h-full object-cover opacity-50 select-none pointer-events-none transition-transform duration-200"
                        style={{ transform: `scale(1.1) translateX(${virtualPitch}px)` }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="p-3 bg-white/10 rounded-full border border-white/20 backdrop-blur-md">
                          <Compass size={32} className="text-[#BF9B30] animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold tracking-wider">{isRtl ? "معاينة بانورامية تفاعلية للمشروع" : "Interactive VR Panorama Experience"}</h4>
                        <p className="text-xs text-slate-300 max-w-md">{isRtl ? "استخدم شريط التمرير أدناه لتدوير المنظور واستعراض تفاصيل الغرف بالكامل" : "Move the controller below to simulate rotation inside the high-end premises"}</p>
                        
                        {/* Drag Simulator slider */}
                        <div className="w-64 space-y-1">
                          <input
                            type="range"
                            min="-200"
                            max="200"
                            value={virtualPitch}
                            onChange={(e) => setVirtualPitch(Number(e.target.value))}
                            className="w-full accent-[#BF9B30] cursor-ew-resize"
                          />
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{isRtl ? "يسار" : "Rotate Left"}</span>
                            <span>{isRtl ? "يمين" : "Rotate Right"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={activeImage}
                      alt={property.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
                    />
                  )}

                  {/* Navigation Arrows */}
                  {!view360 && currentImagesList.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImageIndex((prev) => (prev === 0 ? currentImagesList.length - 1 : prev - 1))}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 text-[#1A1918] border border-[#E6E2DE] hover:bg-white cursor-pointer"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setActiveImageIndex((prev) => (prev === currentImagesList.length - 1 ? 0 : prev + 1))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/85 text-[#1A1918] border border-[#E6E2DE] hover:bg-white cursor-pointer"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}

                  {/* Image counter indicator */}
                  <div className="absolute bottom-4 right-4 bg-black/70 text-white text-[10px] px-2.5 py-1 rounded font-bold">
                    {safeImageIndex + 1} / {currentImagesList.length}
                  </div>
                </div>

                {/* Media Thumbnail strip */}
                {currentImagesList.length > 1 && (
                  <div className="p-3 bg-[#FCFAF7] border-t border-[#E6E2DE] overflow-x-auto flex gap-2 scrollbar-none">
                    {currentImagesList.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setView360(false);
                          setActiveImageIndex(idx);
                        }}
                        className={`w-16 h-12 rounded overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                          activeImageIndex === idx && !view360
                            ? "border-[#BF9B30] scale-102 shadow-sm"
                            : "border-[#E6E2DE] opacity-75 hover:opacity-100"
                        }`}
                      >
                        <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DYNAMIC SMART MATCHING CARD */}
              <div className="bg-white p-5 rounded-xl border border-[#BF9B30]/30 shadow-sm space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1 bg-[#BF9B30]"></div>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#BF9B30]/10 rounded-lg text-[#BF9B30] shrink-0">
                    <Activity size={20} className="animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-serif text-sm font-semibold text-[#1A1918]">
                      {isRtl ? "مؤشر الذكاء الاصطناعي لمطابقة الميزانية" : "AI Market Budget Analysis"}
                    </h3>
                    <p className="text-xs text-[#6E6B66] leading-relaxed">
                      {isRtl 
                        ? `هذا العقار يطابق الميزانية العامة للحي في ${property.district} بنسبة ٩٧٪. متوسط سعر القدم المربع في المنطقة هو ${(property.price / (property.area || 1) * 0.09).toFixed(1)} ريال قطري، مما يجعله استثماراً ممتازاً بقيمة عادلة.`
                        : `This property aligns with average pricing guidelines in ${property.district} at 97% affinity. The square meter rate is calculated at QAR ${(property.price / (property.area || 1)).toFixed(0)} / SQM, which sits strictly within the optimal standard.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* MAIN DETAILS GRID (BEDS, BATHS, SIZE) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-[#E6E2DE] text-center space-y-1">
                  <span className="text-[10px] font-bold text-[#6E6B66] tracking-wider uppercase block">
                    {isRtl ? "المساحة الكلية" : "TOTAL SIZE"}
                  </span>
                  <strong className="text-lg text-[#1A1918] block">
                    {getAreaDisplay(property.area)}
                  </strong>
                  <button
                    onClick={() => setDisplayUnit((prev) => (prev === "SQM" ? "SQFT" : "SQM"))}
                    className="text-[10px] text-[#BF9B30] hover:underline font-bold"
                  >
                    {isRtl ? `التحويل لـ ${displayUnit === "SQM" ? "قدم مربع" : "متر مربع"}` : `Convert to ${displayUnit === "SQM" ? "SQFT" : "SQM"}`}
                  </button>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E6E2DE] text-center space-y-1">
                  <span className="text-[10px] font-bold text-[#6E6B66] tracking-wider uppercase block">
                    {isRtl ? "غرف النوم" : "BEDROOMS"}
                  </span>
                  <strong className="text-lg text-[#1A1918] block">
                    {property.bedrooms} {isRtl ? "غرف" : "Rooms"}
                  </strong>
                  <span className="text-[10px] text-[#6E6B66]">
                    {property.maidRoom ? `+ ${isRtl ? "غرفة خادمة" : "Maid Room"}` : isRtl ? "لا توجد غرفة خادمة" : "Standard"}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E6E2DE] text-center space-y-1">
                  <span className="text-[10px] font-bold text-[#6E6B66] tracking-wider uppercase block">
                    {isRtl ? "الحمامات" : "BATHROOMS"}
                  </span>
                  <strong className="text-lg text-[#1A1918] block">
                    {property.bathrooms} {isRtl ? "حمامات" : "Baths"}
                  </strong>
                  <span className="text-[10px] text-[#6E6B66]">
                    {isRtl ? `+ حمام ضيوف` : "Guest Toilets"}
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-[#E6E2DE] text-center space-y-1">
                  <span className="text-[10px] font-bold text-[#6E6B66] tracking-wider uppercase block">
                    {isRtl ? "حالة التأثيث" : "FURNISHED"}
                  </span>
                  <strong className="text-lg text-[#1A1918] block">
                    {property.furnished === "YES" ? (isRtl ? "مؤثث بالكامل" : "Fully Furnished") :
                     property.furnished === "NO" ? (isRtl ? "غير مؤثث" : "Unfurnished") : (isRtl ? "شبه مؤثث" : "Partly Furnished")}
                  </strong>
                  <span className="text-[10px] text-[#6E6B66]">
                    {isRtl ? "متاح فورا" : "Move-in Ready"}
                  </span>
                </div>
              </div>

              {/* OVERVIEW / DESCRIPTION */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-3">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2">
                  {isRtl ? "الوصف التفصيلي للعقار" : "Executive Property Overview"}
                </h3>
                <p className="text-xs text-[#6E6B66] leading-relaxed whitespace-pre-line">
                  {isRtl ? property.descriptionAr || property.description : property.description}
                </p>
              </div>

              {/* DEEP SPECIFICATIONS (BASED ON PROPERTY TYPE) */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-4">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2">
                  {isRtl ? "المواصفات الفنية المعتمدة" : "Professional Architectural Specs"}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs text-[#6E6B66]">
                  
                  {/* Common Rent/Sale specs */}
                  <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                    <span className="font-medium">{isRtl ? "معرف الإعلان في البوابة" : "Portal Reference ID"}</span>
                    <span className="text-[#1A1918] font-mono font-bold">{property.listingId || `N-${property.id.substr(-5)}`}</span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                    <span className="font-medium">{isRtl ? "الملكية" : "Ownership Type"}</span>
                    <span className="text-[#1A1918] font-bold">
                      {property.district.toLowerCase().includes("pearl") || property.district.toLowerCase().includes("lusail") || property.district.toLowerCase().includes("west bay")
                        ? (isRtl ? "تملك حر للأجانب" : "Freehold (Qatar Foreign Ownership)")
                        : (isRtl ? "حق منفعة / إيجار" : "Leasehold Status")}
                    </span>
                  </div>

                  {isRent && (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "مبلغ الوديعة / التأمين" : "Security Deposit Amount"}</span>
                        <span className="text-[#1A1918] font-bold">
                          {property.deposit ? `${property.deposit.toLocaleString()} ${currencySymbol}` : (isRtl ? "شهر واحد تأمين" : "1 Month Equivalent")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "رسوم الوكالة المعلنة" : "Listing Agency Fee"}</span>
                        <span className="text-[#1A1918] font-bold">
                          {property.commissions ? `${property.commissions.toLocaleString()} ${currencySymbol}` : (isRtl ? "نصف شهر" : "Half Month Rent")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "عدد الشيكات السنوية" : "Post-Dated Cheques Requirement"}</span>
                        <span className="text-[#1A1918] font-bold">
                          {property.cheques || "12 Cheques"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "فواتير كهرماء مشمولة؟" : "Electricity/Water Included (Kahramaa)"}</span>
                        <span className={`font-bold ${property.kahramaa ? "text-emerald-600" : "text-amber-600"}`}>
                          {property.kahramaa ? (isRtl ? "نعم، شاملة كلياً" : "Yes, Fully Covered") : (isRtl ? "لا، تدفع منفصلة" : "No, Paid Separately")}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "التبريد (مشمول)؟" : "District Cooling (Chiller Included)"}</span>
                        <span className={`font-bold ${property.cooling ? "text-emerald-600" : "text-[#BF9B30]"}`}>
                          {property.cooling ? (isRtl ? "مشمول بالكامل" : "Included") : (isRtl ? "يدفع بواسطة المستأجر" : "Excluding Qatar Cool")}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Size specifics */}
                  <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                    <span className="font-medium">{isRtl ? "مساحة البناء" : "Built-up Area (BUA)"}</span>
                    <span className="text-[#1A1918] font-bold">{getAreaDisplay(property.builtUpArea || property.area)}</span>
                  </div>

                  {/* APARTMENT / TOWNHOUSE SPECIFICS */}
                  {property.propertyType === PropertyType.APARTMENT && (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "رقم الطابق" : "Floor Level"}</span>
                        <span className="text-[#1A1918] font-bold">{property.floorNumber ? `${property.floorNumber} Floor` : (isRtl ? "طابق مرتفع" : "High Floor")}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "الإطلالة" : "Visual View Scenery"}</span>
                        <span className="text-[#1A1918] font-bold">{property.viewType || (isRtl ? "إطلالة بانورامية على البحر" : "Sea & Skyline View")}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "رسوم الخدمات السنوية" : "Service Maintenance Charges"}</span>
                        <span className="text-[#1A1918] font-bold">{property.serviceCharges ? `${property.serviceCharges} QAR/Year` : (isRtl ? "مشمولة كلياً" : "Fully Covered")}</span>
                      </div>
                    </>
                  )}

                  {/* VILLA SPECIFICS */}
                  {property.propertyType === PropertyType.VILLA && (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "تصنيف الفيلا" : "Villa Structural Type"}</span>
                        <span className="text-[#1A1918] font-bold">{property.villaType || (isRtl ? "فيلا مستقلة فاخرة" : "Standalone Residential Mansion")}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "المجلس الخارجي" : "Majlis Outdoor Pavilion"}</span>
                        <span className="text-emerald-600 font-bold">{property.majlis ? (isRtl ? "متوفر" : "Available") : (isRtl ? "غير متوفر" : "N/A")}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "المطبخ الخارجي" : "Separate Catering Kitchen"}</span>
                        <span className="text-emerald-600 font-bold">{property.outdoorKitchen ? (isRtl ? "موجود" : "Equipped Outside") : (isRtl ? "داخلي فقط" : "N/A")}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "بركة سباحة خاصة" : "Private Heated Swimming Pool"}</span>
                        <span className="text-[#BF9B30] font-bold">{property.privatePool ? (isRtl ? "موجودة" : "Private Pool") : (isRtl ? "لا توجد" : "N/A")}</span>
                      </div>
                    </>
                  )}

                  {/* COMMERCIAL SPECIFICS */}
                  {(property.propertyType === PropertyType.OFFICE || property.propertyType === PropertyType.RETAIL || property.propertyType === PropertyType.SHOP || property.propertyType === PropertyType.WAREHOUSE) && (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "درجة وتصنيف المكتب" : "Commercial Grade Class"}</span>
                        <span className="text-[#1A1918] font-bold">{property.officeGrade || "Grade A (Prime Office Space)"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "حالة التشطيب" : "Commercial Fitting Status"}</span>
                        <span className="text-[#1A1918] font-bold">{property.fittedStatus || "Fully Fitted & Handover Ready"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "الأنشطة المسموحة" : "Permitted License Activities"}</span>
                        <span className="text-[#1A1918] font-bold">{property.commercialLicense || "Multi-Corporate Usage License"}</span>
                      </div>
                    </>
                  )}

                  {/* OFF-PLAN PAYMENT INFORMATION */}
                  {property.transactionType === TransactionType.OFF_PLAN && (
                    <>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "المطور الإنشائي" : "Structural Master Developer"}</span>
                        <span className="text-[#BF9B30] font-bold">{property.developer || "Qatar Real Estate Development Group"}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-[#F2EDE8]">
                        <span className="font-medium">{isRtl ? "تاريخ تسليم المشروع" : "Expected Delivery Date"}</span>
                        <span className="text-[#1A1918] font-bold">{property.completionDate || "Q4 2027 Handover"}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Off-plan payment schedule visual */}
                {property.transactionType === TransactionType.OFF_PLAN && (
                  <div className="p-4 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg space-y-3">
                    <h4 className="font-serif text-xs font-bold text-[#1A1918] uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign size={13} className="text-[#BF9B30]" />
                      <span>{isRtl ? "شروط خطة الدفع الإنشائية" : "Master Project Installment Plan"}</span>
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 bg-white rounded border border-[#E6E2DE]">
                        <span className="block text-[#6E6B66] text-[10px]">{isRtl ? "عند الحجز" : "Reservation Downpay"}</span>
                        <strong className="text-[#1A1918] text-sm">10%</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-[#E6E2DE]">
                        <span className="block text-[#6E6B66] text-[10px]">{isRtl ? "خلال الإنشاء" : "Construction Stage"}</span>
                        <strong className="text-[#1A1918] text-sm">40%</strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-[#E6E2DE]">
                        <span className="block text-[#6E6B66] text-[10px]">{isRtl ? "عند التسليم" : "Handover Installment"}</span>
                        <strong className="text-[#1A1918] text-sm">50%</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* LISTING AMENITIES */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-3">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2">
                  {isRtl ? "المرافق والخدمات المتاحة" : "Exclusive Amenities & Conveniences"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {property.amenities.map((amenity, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-[#6E6B66]">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle size={12} fill="currentColor" className="text-white" />
                      </div>
                      <span className="font-medium text-[#1A1918]">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* INTERACTIVE FLOOR PLAN GALLERY */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-4">
                <div className="flex justify-between items-center border-b border-[#F2EDE8] pb-2">
                  <h3 className="font-serif text-lg font-medium text-[#1A1918]">
                    {isRtl ? "مخططات الطوابق الهندسية" : "Architectural Floor Plans"}
                  </h3>
                  <button
                    onClick={() => setIsFloorPlanFullscreen(true)}
                    className="text-xs font-bold text-[#BF9B30] hover:underline flex items-center gap-1 cursor-pointer"
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
                          ? "bg-[#1A1918] text-white border-[#1A1918]"
                          : "bg-[#FCFAF7] text-[#6E6B66] border-[#E6E2DE] hover:bg-white"
                      }`}
                    >
                      {isRtl ? (idx === 0 ? "الطابق الأرضي" : "الطابق الأول") : planName}
                    </button>
                  ))}
                </div>

                <div className="bg-stone-50 border border-[#E6E2DE] p-4 rounded-xl flex justify-center items-center relative overflow-hidden group">
                  <img
                    src={categorizedImages.FLOOR_PLAN[activeFloorPlanIndex] || categorizedImages.FLOOR_PLAN[0]}
                    alt="Floor Plan"
                    className="max-h-64 object-contain"
                  />
                  
                  {/* Download button */}
                  <a
                    href={categorizedImages.FLOOR_PLAN[activeFloorPlanIndex] || categorizedImages.FLOOR_PLAN[0]}
                    download={`floorplan-${property.listingId}.jpg`}
                    className="absolute bottom-3 right-3 p-2 bg-white/90 backdrop-blur-xs border border-[#E6E2DE] text-[#6E6B66] hover:text-[#1A1918] rounded-full shadow-sm hover:scale-105 transition-all"
                    title={isRtl ? "تحميل المخطط" : "Download High-Res PDF Schema"}
                  >
                    <Download size={15} />
                  </a>
                </div>
              </div>

              {/* LOCATION INTELLIGENCE & MAPS */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-4">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2">
                  {isRtl ? "تحليل الموقع والمرافق المجاورة" : "Location Intelligence & Transit Landmarks"}
                </h3>

                {/* Mock Privacy Map approximation */}
                <div className="relative w-full h-56 bg-slate-100 rounded-xl border border-[#E6E2DE] overflow-hidden">
                  <div className="absolute inset-0 bg-[#E5E3DF] flex items-center justify-center">
                    {/* SVG map background mock */}
                    <svg className="w-full h-full opacity-65" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M0,20 Q40,30 80,10 T100,50" fill="none" stroke="#FFFFFF" strokeWidth="2" />
                      <path d="M20,0 Q30,50 10,90 T80,100" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                      <rect x="35" y="45" width="30" height="15" rx="2" fill="#D3CFC9" />
                      <text x="38" y="54" fontSize="3" fill="#6E6B66" className="font-bold">West Bay</text>
                    </svg>

                    {/* Approximation Circle */}
                    <div className="absolute w-24 h-24 bg-[#BF9B30]/15 border-2 border-dashed border-[#BF9B30] rounded-full flex items-center justify-center animate-pulse">
                      <MapPin size={24} className="text-[#BF9B30]" />
                    </div>

                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 border border-[#E6E2DE] rounded text-[10px] text-[#6E6B66] font-bold">
                      📍 {property.district}, {property.city}
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-xs p-2 border border-[#E6E2DE] rounded text-[9px] text-[#6E6B66] text-center font-medium">
                      ⚠️ {isRtl ? "العنوان الدقيق مخفي لخصوصية البائع. الدائرة تمثل النطاق التقريبي للحي." : "Approximate area only to safeguard property owner's absolute privacy rights."}
                    </div>
                  </div>
                </div>

                {/* Nearby places structured data list */}
                <div className="space-y-2 text-xs">
                  <h4 className="font-bold text-[#1A1918] uppercase tracking-wider text-[10px]">{isRtl ? "مؤشر المسافات والمرافق الحيوية" : "Verified Commutes & Facilities"}</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg">
                      <span className="text-[10px] font-bold text-[#6E6B66] uppercase block mb-1">🏫 {isRtl ? "المدارس القريبة" : "SCHOOLS & CARE"}</span>
                      <p className="font-bold text-[#1A1918]">{isRtl ? "مدرسة قطر الدولية" : "Qatar International School"}</p>
                      <span className="text-[#6E6B66] text-[10px]">{isRtl ? "٤ دقائق بالسيارة (١.٨ كم)" : "4 min drive (1.8 km)"}</span>
                    </div>

                    <div className="p-3 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg">
                      <span className="text-[10px] font-bold text-[#6E6B66] uppercase block mb-1">🚇 {isRtl ? "محطات المترو" : "METRO ACCESS"}</span>
                      <p className="font-bold text-[#1A1918]">{isRtl ? "محطة مركز الدوحة للمعارض" : "DECC Metro Station"}</p>
                      <span className="text-[#6E6B66] text-[10px]">{isRtl ? "٨ دقائق سيراً (٦٥٠ متر)" : "8 min walk (650 m)"}</span>
                    </div>

                    <div className="p-3 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg">
                      <span className="text-[10px] font-bold text-[#6E6B66] uppercase block mb-1">🛍️ {isRtl ? "التسوق والترفيه" : "LIFESTYLE MALLS"}</span>
                      <p className="font-bold text-[#1A1918]">{isRtl ? "سيتي سنتر الدوحة" : "City Center Mall"}</p>
                      <span className="text-[#6E6B66] text-[10px]">{isRtl ? "٦ دقائق سيراً (٤٥٠ متر)" : "6 min walk (450 m)"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SAVED & PROPERTY HISTORY TREND */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-4">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2">
                  {isRtl ? "الشفافية وسجل المعاملات المحدث" : "Listing Freshness & Transaction Logs"}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
                  <div className="p-2 border border-[#F2EDE8] rounded bg-[#FCFAF7]">
                    <span className="text-[#6E6B66] block text-[10px]">{isRtl ? "تاريخ النشر الأولي" : "First Published"}</span>
                    <strong className="text-[#1A1918]">2026-07-05</strong>
                  </div>
                  <div className="p-2 border border-[#F2EDE8] rounded bg-[#FCFAF7]">
                    <span className="text-[#6E6B66] block text-[10px]">{isRtl ? "آخر تحديث للبيانات" : "Last Catalogued"}</span>
                    <strong className="text-[#1A1918]">{property.updatedDate ? property.updatedDate.split("T")[0] : "Today"}</strong>
                  </div>
                  <div className="p-2 border border-[#F2EDE8] rounded bg-[#FCFAF7]">
                    <span className="text-[#6E6B66] block text-[10px]">{isRtl ? "معدل الحفظ والاهتمام" : "Bookmark Inquiries"}</span>
                    <strong className="text-[#1A1918]">48 {isRtl ? "مستخدم" : "Users"}</strong>
                  </div>
                  <div className="p-2 border border-[#F2EDE8] rounded bg-[#FCFAF7]">
                    <span className="text-[#6E6B66] block text-[10px]">{isRtl ? "مستوى اكتمال البيانات" : "Quality Completeness"}</span>
                    <strong className="text-emerald-600 font-bold">{property.qualityScore || 95}%</strong>
                  </div>
                </div>

                {/* Price change timeline */}
                <div className="space-y-2">
                  <h4 className="font-bold text-[#1A1918] uppercase tracking-wider text-[10px]">{isRtl ? "سجل التغيرات السعرية" : "Price History Audits"}</h4>
                  <div className="relative border-l-2 border-[#E6E2DE] pl-4 ml-2 space-y-3">
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#BF9B30]"></div>
                      <span className="text-[10px] font-mono text-[#6E6B66] block">2026-07-20</span>
                      <span className="text-xs font-bold text-[#1A1918]">{formatPrice(property.price, isRtl)} </span>
                      <span className="text-[10px] text-emerald-600">({isRtl ? "السعر الحالي المحدث" : "Latest Certified Price"})</span>
                    </div>
                    {property.priceHistory && property.priceHistory.length > 1 && property.priceHistory.slice(0, -1).reverse().map((hist, idx) => (
                      <div className="relative" key={idx}>
                        <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#6E6B66]"></div>
                        <span className="text-[10px] font-mono text-[#6E6B66] block">{hist.date}</span>
                        <span className="text-xs text-[#6E6B66] line-through">{formatPrice(hist.price, isRtl)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* INVESTMENT YIELD AND MORTGAGE TOOLS */}
              <div className="bg-white p-6 rounded-xl border border-[#E6E2DE] space-y-6">
                <h3 className="font-serif text-lg font-medium text-[#1A1918] border-b border-[#F2EDE8] pb-2 flex items-center gap-2">
                  <Calculator size={18} className="text-[#BF9B30]" />
                  <span>{isRtl ? "أدوات التخطيط المالي والاستثماري" : "Interactive Financial Planning Suite"}</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Mortgage Calculator */}
                  <div className="space-y-4">
                    <h4 className="font-serif text-sm font-bold text-[#1A1918] flex items-center gap-1.5">
                      <DollarSign size={15} />
                      <span>{isRtl ? "حاسبة التمويل العقاري" : "Hypothecary Mortgage Estimator"}</span>
                    </h4>

                    <div className="space-y-3 text-xs text-[#6E6B66]">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>{isRtl ? "الدفعة الأولى (%)" : "Downpayment (%)"}</span>
                          <span className="font-bold text-[#1A1918]">{downpaymentPercent}% ({formatPrice((property.price * downpaymentPercent) / 100, isRtl)})</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="80"
                          value={downpaymentPercent}
                          onChange={(e) => setDownpaymentPercent(Number(e.target.value))}
                          className="w-full accent-[#BF9B30]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>{isRtl ? "معدل الفائدة السنوية (%)" : "Annual Interest Rate (%)"}</span>
                          <span className="font-bold text-[#1A1918]">{interestRate}%</span>
                        </div>
                        <input
                          type="range"
                          min="1.5"
                          max="10"
                          step="0.25"
                          value={interestRate}
                          onChange={(e) => setInterestRate(Number(e.target.value))}
                          className="w-full accent-[#BF9B30]"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>{isRtl ? "فترة التمويل (سنة)" : "Loan Tenure (Years)"}</span>
                          <span className="font-bold text-[#1A1918]">{loanTenure} {isRtl ? "سنة" : "Years"}</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="30"
                          value={loanTenure}
                          onChange={(e) => setLoanTenure(Number(e.target.value))}
                          className="w-full accent-[#BF9B30]"
                        />
                      </div>

                      <div className="p-3 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg text-center mt-2">
                        <span className="text-[10px] text-[#6E6B66] uppercase block mb-1">{isRtl ? "القسط الشهري المقدر" : "ESTIMATED MONTHLY INSTALLMENT"}</span>
                        <strong className="text-xl text-[#BF9B30]">{Math.round(estimatedMonthlyMortgage).toLocaleString()} QAR / {isRtl ? "شهر" : "Mo"}</strong>
                        <p className="text-[9px] text-[#6E6B66] mt-1">{isRtl ? "هذا الحساب مبدئي ويخضع لموافقة البنك" : "Calculated purely based on central banking baseline guidelines"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Investment ROI Estimation / Yield */}
                  <div className="space-y-4">
                    <h4 className="font-serif text-sm font-bold text-[#1A1918] flex items-center gap-1.5">
                      <TrendingUp size={15} />
                      <span>{isRtl ? "مؤشرات العائد على الاستثمار" : "Rental Yield & ROI Analytics"}</span>
                    </h4>

                    <div className="space-y-3 text-xs text-[#6E6B66]">
                      <div className="p-4 bg-white rounded-xl border border-[#E6E2DE] space-y-3">
                        <div className="flex justify-between border-b border-[#F2EDE8] pb-1.5">
                          <span>{isRtl ? "متوسط العائد الإيجاري في" : "Average Rental Yield in"} {property.district}</span>
                          <strong className="text-emerald-600">{averageYield}%</strong>
                        </div>
                        <div className="flex justify-between border-b border-[#F2EDE8] pb-1.5">
                          <span>{isRtl ? "الإيجار السنوي المقدر" : "Estimated Annual Income"}</span>
                          <strong className="text-[#1A1918]">{Math.round(estimatedAnnualRent).toLocaleString()} QAR</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>{isRtl ? "الإيجار الشهري المقابل" : "Corresponding Monthly Rent"}</span>
                          <strong className="text-[#1A1918]">{Math.round(estimatedMonthlyRent).toLocaleString()} QAR</strong>
                        </div>
                      </div>

                      <div className="p-3 bg-stone-50 border border-dashed border-[#E6E2DE] rounded-lg">
                        <p className="text-[10px] leading-relaxed italic text-[#6E6B66]">
                          💡 {isRtl 
                            ? `تعتبر منطقة ${property.district} من أكثر مناطق قطر طلباً للإيجار الفاخر، مما يحمي محفظتك العقارية ويرفع من فرصة زيادة رأس المال السنوية.` 
                            : `As a premium sector, ${property.district} maintains historic occupancy rates exceeding 88%, validating it as an absolute institutional hedge.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REPORT PROPERTY BUTTON */}
              <div className="flex justify-between items-center py-4 text-xs text-[#6E6B66]">
                <span>{isRtl ? "هل لاحظت بيانات خاطئة أو احتيالية؟" : "Spot incorrect parameters or misleading details?"}</span>
                <button
                  onClick={() => setReportModalOpen(true)}
                  className="px-3 py-1.5 border border-red-200 hover:border-red-500 bg-white hover:bg-red-50 text-red-600 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <AlertTriangle size={13} />
                  <span>{isRtl ? "الإبلاغ عن الإعلان" : "Report this Listing"}</span>
                </button>
              </div>

              {/* SIMILAR LISTINGS SECTION */}
              {finalSimilarListings.length > 0 && (
                <div className="pt-6 border-t border-[#E6E2DE] space-y-4">
                  <h4 className="font-serif text-base font-bold text-[#1A1918]">
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
                          className="bg-white rounded-xl border border-[#E6E2DE] hover:border-[#BF9B30] overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
                        >
                          <div className="relative h-28 overflow-hidden bg-stone-100">
                            <img
                              src={simImg}
                              alt={sim.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-2 right-2 bg-[#1A1918]/80 backdrop-blur-xs px-2 py-0.5 rounded text-[8px] text-white font-bold tracking-wider uppercase">
                              {isRtl
                                ? sim.propertyType === PropertyType.APARTMENT ? "شقة" : sim.propertyType === PropertyType.VILLA ? "فيلا" : "مكتب تجاري"
                                : sim.propertyType
                              }
                            </div>
                          </div>

                          <div className="p-3 flex-grow flex flex-col justify-between space-y-2">
                            <div>
                              <strong className="text-xs text-[#BF9B30] font-bold block">
                                {formatPrice(sim.price, isRtl)}
                                {isSimRent && <span className="text-[10px] text-[#6E6B66] font-normal"> / {sim.rentalPeriod || "YR"}</span>}
                              </strong>
                              <h5 className="font-bold text-[11px] text-[#1A1918] line-clamp-1 group-hover:text-[#BF9B30] transition-colors mt-0.5">
                                {isRtl ? sim.titleAr || sim.title : sim.title}
                              </h5>
                              <p className="text-[9px] text-[#6E6B66] line-clamp-1 flex items-center gap-1 mt-1">
                                <span className="w-1.5 h-1.5 bg-[#BF9B30] rounded-full"></span>
                                {sim.district}, {sim.city}
                              </p>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-[#6E6B66] border-t border-[#F2EDE8] pt-2 mt-1">
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
                <div className="hidden lg:block bg-[#1A1918] rounded-xl border border-[#33302a] shadow-sm p-5 space-y-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                    {isRtl ? "السعر الكلي المقدر" : "Asking Price"}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <strong className="font-serif text-3xl font-semibold text-[#BF9B30]">
                      {propertyPrice.toLocaleString()} {currencySymbol}
                    </strong>
                    {isRent && (
                      <span className="text-xs text-gray-400"> / {property.rentalPeriod || "YR"}</span>
                    )}
                  </div>
                  {property.serviceCharges != null && (
                    <p className="text-[10px] text-gray-500 pt-1">
                      {isRtl ? "+ رسوم الخدمة" : "+ Service Charges"}: {property.serviceCharges.toLocaleString()} {currencySymbol}
                    </p>
                  )}
                </div>

                {/* REPRESENTATIVE AGENCY CARD */}
                <div className="bg-white p-5 rounded-xl border border-[#E6E2DE] shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-50 border border-[#E6E2DE]">
                      <img
                        src={agentInfo?.agentPhotoUrl || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80"}
                        alt="Agent"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h4 className="font-serif text-sm font-semibold text-[#1A1918]">
                        {agentInfo?.agentName || agentInfo?.orgName || (isRtl ? "فريق نيرو فايندر" : "Nerou Finder Team")}
                      </h4>
                      {agentInfo?.isVerifiedAgent && (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                          <Award size={11} fill="currentColor" />
                          <span>{isRtl ? "مقدم إعلان معتمد" : "Certified Listing Provider"}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[#6E6B66]">
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
                    <a
                      href={`tel:+${agentInfo?.phone || "97433334444"}`}
                      className="px-3 py-2 bg-[#1A1918] hover:bg-[#BF9B30] text-white rounded-lg font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Phone size={14} />
                      <span>{isRtl ? "اتصال" : "Call"}</span>
                    </a>
                  </div>

                  {onViewAgentProfile && (agentInfo?.hasAssignedAgent || agentInfo?.orgName) && (
                    <button
                      onClick={onViewAgentProfile}
                      className="w-full px-3 py-2 bg-white hover:bg-[#BF9B30]/10 border border-[#E6E2DE] hover:border-[#BF9B30] text-[#1A1918] rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Award size={13} className="text-[#BF9B30]" />
                      <span>{isRtl ? "عرض الملف الشخصي والتقييمات" : "View Full Profile & Reviews"}</span>
                    </button>
                  )}
                </div>

                {/* SCHEDULE VIEWING INTERACTIVE FORM */}
                <div className="bg-white p-5 rounded-xl border border-[#E6E2DE] shadow-sm space-y-4">
                  <h3 className="font-serif text-sm font-semibold text-[#1A1918] border-b border-[#F2EDE8] pb-2">
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
                        <label className="text-[#6E6B66] font-medium">{isRtl ? "الاسم الكريم" : "Your Name"}</label>
                        <input
                          type="text"
                          required
                          value={bookingName}
                          onChange={(e) => setBookingName(e.target.value)}
                          placeholder="e.g. Jassem Al-Thani"
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg focus:outline-none focus:border-[#BF9B30] text-base md:text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[#6E6B66] font-medium">{isRtl ? "رقم الجوال (مع رمز البلد)" : "Contact Number"}</label>
                        <input
                          type="tel"
                          inputMode="tel"
                          required
                          value={bookingPhone}
                          onChange={(e) => setBookingPhone(e.target.value)}
                          placeholder="+974 5555 6666"
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg focus:outline-none focus:border-[#BF9B30] text-base md:text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[#6E6B66] font-medium">{isRtl ? "التاريخ المفضل" : "Preferred Date"}</label>
                        <input
                          type="date"
                          value={bookingDate}
                          onChange={(e) => setBookingDate(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg text-base md:text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[#6E6B66] font-medium">{isRtl ? "الفترة المفضلة" : "Slot"}</label>
                          <select
                            value={bookingTime}
                            onChange={(e) => setBookingTime(e.target.value)}
                            className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg text-base md:text-xs"
                          >
                            <option value="MORNING">AM (09:00 - 12:00)</option>
                            <option value="AFTERNOON">PM (12:00 - 16:00)</option>
                            <option value="EVENING">PM (16:00 - 19:00)</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="w-full py-2 bg-[#1A1918] hover:bg-[#BF9B30] text-white rounded-lg font-bold transition-colors cursor-pointer"
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
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E6E2DE] p-3 flex items-center justify-between lg:hidden shadow-lg shrink-0">
          <div className="space-y-0.5">
            <span className="text-[10px] text-[#6E6B66] font-medium block">{isRtl ? "السعر الكلي المقدر" : "ASKING PRICE"}</span>
            <strong className="text-[#BF9B30] text-lg font-bold">
              {propertyPrice.toLocaleString()} {currencySymbol}
              {isRent && <span className="text-xs text-[#6E6B66]"> / {property.rentalPeriod || "YR"}</span>}
            </strong>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleWhatsAppAction}
              className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center justify-center cursor-pointer"
            >
              <MessageCircle size={18} />
            </button>
            <a
              href={`tel:+${agentInfo?.phone || "97433334444"}`}
              className="px-4 py-2.5 bg-[#1A1918] text-white font-bold rounded-lg hover:bg-[#BF9B30] flex items-center gap-1"
            >
              <Phone size={14} />
              <span>{isRtl ? "اتصال" : "Call Agent"}</span>
            </a>
          </div>
        </div>

        {/* REPORT SUBMIT MODAL DIALOG */}
        {reportModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl border border-[#E6E2DE] shadow-2xl p-5 w-full max-w-md space-y-4 relative">
              <h4 className="font-serif text-lg font-bold text-[#1A1918] flex items-center gap-1.5">
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
                    <label className="text-[#6E6B66] font-medium">{isRtl ? "سبب الإبلاغ" : "Reporting Reason"}</label>
                    <select
                      required
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg focus:outline-none text-base md:text-xs"
                    >
                      <option value="">-- {isRtl ? "اختر السبب" : "Select violation type"} --</option>
                      <option value="fake_listing">{isRtl ? "عقار وهمي أو تم بيعه بالفعل" : "Fake or Sold / Unavailable listing"}</option>
                      <option value="incorrect_price">{isRtl ? "السعر خاطئ أو مضلل" : "Misleading price tag"}</option>
                      <option value="misleading">{isRtl ? "صور غير مطابقة للموقع" : "Irrelevant/misleading photo gallery"}</option>
                      <option value="other">{isRtl ? "أسباب أخرى للتظلم" : "Other discrepancies"}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#6E6B66] font-medium">{isRtl ? "مزيد من التفاصيل" : "Detailed Notes"}</label>
                    <textarea
                      rows={3}
                      required
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Specify what details are wrong..."
                      className="w-full px-3 py-2 bg-[#FCFAF7] border border-[#E6E2DE] rounded-lg text-base md:text-xs"
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setReportModalOpen(false)}
                      className="px-4 py-2 border border-[#E6E2DE] text-[#6E6B66] rounded-lg"
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
