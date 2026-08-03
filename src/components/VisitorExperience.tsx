/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Property,
  PropertyType,
  TransactionType,
  VerificationStatus,
  Lead,
  LocationItem,
  User,
  Organization,
  getAvailabilityStaleDays,
  AVAILABILITY_UNCONFIRMED_DAYS,
  getVerifiedBadgeLabel
} from "../types.js";
import { useCurrency } from "../currencyContext.js";
import { trackEvent, trackPageView } from "../lib/analytics.js";
import DirectorySearch from "./DirectorySearch.js";
import {
  Search,
  Sparkles,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Phone,
  MessageCircle,
  Calendar,
  Bookmark,
  ChevronRight,
  Info,
  Clock,
  ArrowUpDown,
  CheckCircle,
  Globe,
  Share2,
  Building2,
  User as UserIcon,
  X,
  Mail,
  ExternalLink,
  ShieldAlert,
  Activity,
  Bell,
  Trash,
  Award,
  Map,
  List
} from "lucide-react";
import PropertyDetailView from "./PropertyDetailView.js";
import PropertyCompareView from "./PropertyCompareView.js";
import InteractiveMap from "./InteractiveMap.js";
import ProfileReviewsSection from "./ProfileReviewsSection.js";

// Enterprise & Public Sub-Pages
import ProjectsView from "./ProjectsView.js";
import HelpCenterView from "./HelpCenterView.js";
import CareersView from "./CareersView.js";
import SupportTicketsView from "./SupportTicketsView.js";
import PressView from "./PressView.js";
import PartnershipsView from "./PartnershipsView.js";
import PlansPricingView from "./PlansPricingView.js";
import PhotoHero from "./PhotoHero.js";

interface VisitorExperienceProps {
  isRtl: boolean;
  onLeadSubmitted: () => void;
  currentUser?: any;
  onLoginTrigger?: () => void;
  onSignupTrigger?: () => void;
  // One-shot navigation request from outside this component (e.g. the site footer in App.tsx,
  // which sits outside VisitorExperience and doesn't otherwise have access to its tab state).
  externalNavigation?: { tab: string; transType?: string; directoryMode?: "AGENT" | "AGENCY" | "DEVELOPER" } | null;
  onExternalNavigationHandled?: () => void;
}

export default function VisitorExperience({
  isRtl,
  onLeadSubmitted,
  currentUser,
  onLoginTrigger,
  onSignupTrigger,
  externalNavigation,
  onExternalNavigationHandled
}: VisitorExperienceProps) {
  const { formatPrice } = useCurrency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [legalDocs, setLegalDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Custom Filter States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [propType, setPropType] = useState<string>("");
  const [transType, setTransType] = useState<string>("");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [beds, setBeds] = useState<string>("");

  // DB taxonomy lists
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Search mode: "PROPERTIES" keeps the existing filter/AI search entirely unchanged; the
  // other three switch to a separate identity/directory lookup (see DirectorySearch.tsx) for
  // finding an agent/agency/developer directly by name rather than finding listings.
  const [searchMode, setSearchMode] = useState<"PROPERTIES" | "AGENT" | "AGENCY" | "DEVELOPER">("PROPERTIES");

  // Public Sub-Pages Tab state
  const [currentTab, setCurrentTab] = useState<
    | "MARKETPLACE"
    | "PROJECTS"
    | "HELP_CENTER"
    | "CAREERS"
    | "PRESS"
    | "PARTNERSHIPS"
    | "SUPPORT_TICKETS"
    | "LEGAL"
    | "PLANS"
  >("MARKETPLACE");

  // Consume one-shot navigation requests coming from outside this component (the App.tsx footer).
  useEffect(() => {
    if (externalNavigation) {
      setCurrentTab(externalNavigation.tab as any);
      if (externalNavigation.transType) {
        setTransType(externalNavigation.transType);
      } else if (externalNavigation.tab === "MARKETPLACE") {
        setPropType("");
        setTransType("");
      }
      setSearchMode(externalNavigation.directoryMode || "PROPERTIES");
      if (onExternalNavigationHandled) onExternalNavigationHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalNavigation]);

  // AI Search state
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResults, setAiResults] = useState<{ propertyId: string; whyMatchEn: string; whyMatchAr: string }[]>([]);
  const [aiError, setAiError] = useState<string>("");
  const [aiSearchActive, setAiSearchActive] = useState<boolean>(false);
  const [aiConversationId, setAiConversationId] = useState<string>(() => `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "model"; text: string }[]>([]);

  // Detail overlay state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [viewFormat, setViewFormat] = useState<"LIST" | "MAP">("LIST");
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);
  const [comparedPropertyIds, setComparedPropertyIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);

  // Saved Searches & Alerts States
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [isSaveSearchModalOpen, setIsSaveSearchModalOpen] = useState<boolean>(false);
  const [customSearchName, setCustomSearchName] = useState<string>("");

  
  // In-depth representative profiles modals
  const [selectedAgentProfile, setSelectedAgentProfile] = useState<User | null>(null);
  const [selectedOrgProfile, setSelectedOrgProfile] = useState<Organization | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<string>("default");

  // Debounced separately from `searchQuery` itself so the input stays instantly responsive
  // while typing, but a network request only fires 400ms after the user pauses - previously
  // every keystroke triggered its own /api/properties request (request storms + result
  // flicker while typing).
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchQuery(searchQuery), 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    fetchTaxonomyData();
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [selectedMunicipality, selectedArea, propType, transType, minPrice, maxPrice, beds, debouncedSearchQuery, locations]);

  useEffect(() => {
    if (selectedProperty) {
      trackPageView(`/properties/${selectedProperty.id}`);
      trackEvent("view_property", "marketplace", selectedProperty.title);
    } else {
      trackPageView("/");
    }
  }, [selectedProperty]);

  const fetchTaxonomyData = async () => {
    try {
      const locRes = await fetch("/api/locations");
      const locData = await locRes.json();
      setLocations(locData);

      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();
      setUsers(usersData);

      const orgsRes = await fetch("/api/organizations");
      const orgsData = await orgsRes.json();
      setOrganizations(orgsData);

      try {
        const campRes = await fetch("/api/campaigns");
        if (campRes.ok) {
          const campData = await campRes.json();
          setCampaigns(campData);
        }
      } catch (e) {
        console.error("Error loading active campaigns:", e);
      }

      try {
        const legalRes = await fetch("/api/legal");
        if (legalRes.ok) {
          const legalData = await legalRes.json();
          setLegalDocs(legalData.filter((doc: any) => doc.status === "PUBLISHED"));
        }
      } catch (e) {
        console.error("Error loading published legal docs", e);
      }
    } catch (e) {
      console.error("Error loading centralized taxonomy", e);
    }
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // If municipality is chosen, translate to database city filter
      if (selectedMunicipality) {
        const muni = locations.find(l => l.id === selectedMunicipality);
        if (muni) params.append("city", muni.name);
      }
      
      // If area is chosen, translate to database district filter
      if (selectedArea) {
        const area = locations.find(l => l.id === selectedArea);
        if (area) params.append("district", area.name);
      }

      if (propType) params.append("propertyType", propType);
      if (transType) params.append("transactionType", transType);
      if (minPrice) params.append("minPrice", minPrice);
      if (maxPrice) params.append("maxPrice", maxPrice);
      if (beds) params.append("bedrooms", beds);
      if (debouncedSearchQuery) params.append("searchQuery", debouncedSearchQuery);

      const res = await fetch(`/api/properties?${params.toString()}`);
      const data = await res.json();
      setProperties(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const promptToSend = aiPrompt.trim();
    if (!promptToSend) return;
    
    setAiLoading(true);
    setAiError("");
    setAiSearchActive(true);
    
    // Add user prompt to chat history logs
    setAiHistory(prev => [...prev, { role: "user", text: promptToSend }]);
    setAiPrompt(""); // clear input box immediately for superb UX

    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToSend,
          conversationId: aiConversationId
        })
      });
      const data = await res.json();
      if (data.error) {
        setAiError(data.error);
        setAiResults([]);
        setAiHistory(prev => [...prev, { role: "model", text: isRtl ? "عذراً، فشل المساعد الذكي في معالجة هذا الطلب." : "Apologies, the AI assistant encountered an error processing this request." }]);
      } else {
        const matches = data.matches || [];
        setAiResults(matches);
        
        // Build cohesive and professional conversational assistant response
        let answer = "";
        if (matches.length > 0) {
          const sampleMatch = matches[0];
          const explanation = isRtl ? sampleMatch.whyMatchAr : sampleMatch.whyMatchEn;
          answer = isRtl 
            ? `لقد وجدت ${matches.length} عقارات تطابق طلبك تماماً! إليك السبب الرئيسي: ${explanation}`
            : `I have discovered ${matches.length} matches tailored to your request! Key highlight: ${explanation}`;
        } else {
          answer = isRtl
            ? "لم أجد عقارات تطابق هذه المواصفات بدقة في قاعدة البيانات حالياً. هل ترغب في تصفح بدائل أخرى أو تفاصيل تصفية مختلفة؟"
            : "I did not find matching listings with those precise criteria in our active catalog. Would you like to check other areas or adjust your preferences?";
        }
        setAiHistory(prev => [...prev, { role: "model", text: answer }]);
      }
    } catch (err: any) {
      setAiError("Failed to connect to AI search helper.");
      setAiHistory(prev => [...prev, { role: "model", text: isRtl ? "فشل الاتصال بخدمات البحث الذكي." : "Failed to connect to AI search helper." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAiSearch = () => {
    setAiPrompt("");
    setAiResults([]);
    setAiSearchActive(false);
    setAiError("");
    setAiHistory([]);
    setAiConversationId(`conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    fetchProperties();
  };

  const fetchSavedSearches = async () => {
    const token = localStorage.getItem("token");
    if (!token || !currentUser) return;
    try {
      const res = await fetch("/api/saved-searches", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSavedProperties = async () => {
    const token = localStorage.getItem("token");
    if (!token || !currentUser) {
      setSavedPropertyIds([]);
      return;
    }
    try {
      const res = await fetch("/api/saved-properties", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const ids = data.map((item: any) => item.propertyId);
        setSavedPropertyIds(ids);
      }
    } catch (err) {
      console.error("Error loading saved properties:", err);
    }
  };

  useEffect(() => {
    fetchSavedProperties();
    fetchSavedSearches();
  }, [currentUser]);

  const handleToggleSavePropertyBackend = async (id: string) => {
    const token = localStorage.getItem("token");
    if (!currentUser || !token) {
      if (onLoginTrigger) onLoginTrigger();
      return;
    }

    if (savedPropertyIds.includes(id)) {
      setSavedPropertyIds(savedPropertyIds.filter(pid => pid !== id));
      try {
        await fetch(`/api/saved-properties/property/${id}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (err) {
        console.error("Error removing saved property:", err);
      }
    } else {
      setSavedPropertyIds([...savedPropertyIds, id]);
      try {
        await fetch("/api/saved-properties", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ propertyId: id })
        });
      } catch (err) {
        console.error("Error saving property:", err);
      }
    }
  };

  const toggleSaveProperty = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleToggleSavePropertyBackend(id);
  };

  const getAutoSearchName = () => {
    let parts = [];
    if (beds) parts.push(`${beds} Bed`);
    if (propType) parts.push(propType);
    else parts.push(isRtl ? "عقار" : "Property");
    if (transType) {
      if (transType === "FOR_RENT") parts.push(isRtl ? "للإيجار" : "For Rent");
      else if (transType === "FOR_SALE") parts.push(isRtl ? "للبيع" : "For Sale");
      else parts.push(isRtl ? "على المخطط" : "Off-Plan");
    }
    if (selectedMunicipality) {
      const muni = locations.find(l => l.id === selectedMunicipality);
      if (muni) parts.push((isRtl ? "في " : "in ") + (isRtl ? muni.nameAr : muni.name));
    }
    if (maxPrice) parts.push((isRtl ? "أقل من " : "under ") + Number(maxPrice).toLocaleString() + " QAR");
    if (searchQuery) parts.push((isRtl ? `بكلمة "${searchQuery}"` : `matching "${searchQuery}"`));

    return parts.join(" ") || (isRtl ? "كل العقارات" : "All Properties Search");
  };

  const handleSaveSearchClick = () => {
    if (!currentUser) {
      if (onLoginTrigger) onLoginTrigger();
      return;
    }
    setCustomSearchName(getAutoSearchName());
    setIsSaveSearchModalOpen(true);
  };

  const handleConfirmSaveSearch = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const filters = {
      searchQuery,
      selectedMunicipality,
      selectedArea,
      propType,
      transType,
      minPrice,
      maxPrice,
      beds
    };

    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: customSearchName || getAutoSearchName(),
          filters
        })
      });

      if (res.ok) {
        setIsSaveSearchModalOpen(false);
        fetchSavedSearches();
        alert(isRtl ? "تم حفظ البحث بنجاح وسوف تتلقى تنبيهات عند إضافة عقارات مطابقة!" : "Search saved successfully! You will receive alerts when matching properties are added.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSavedSearch = async (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/saved-searches/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchSavedSearches();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSearchCounter = async (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`/api/saved-searches/${id}/reset`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchSavedSearches();
      }
    } catch (err) {
      console.error(err);
    }
  };



  const handleWhatsAppAction = async (property: Property) => {
    // Open the tab SYNCHRONOUSLY, before any `await` - popup blockers require window.open to
    // fire within the original click's "user gesture" window, which ends the moment this
    // function first suspends at an await. Opening a blank tab now and redirecting it once the
    // async work below finishes keeps it tied to the click instead of being silently blocked
    // (window.open's return value was never checked, so the failure was invisible before).
    const waTab = window.open("", "_blank");

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          visitorName: "Anonymous Visitor (WhatsApp)",
          visitorPhone: "WhatsApp Event",
          contactMethod: "WHATSAPP",
          message: `Visitor clicked WhatsApp for property ${property.listingId}`,
          campaign: sessionStorage.getItem("attributionCampaignId") || undefined
        })
      });
      trackEvent("whatsapp_click", "marketplace", property.title);
      onLeadSubmitted();
    } catch (e) {
      console.error("Lead logging failed:", e);
    }

    // Fetch the correct WhatsApp contact number for this property
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

    const waUrl = `https://wa.me/${contactNumber}?text=${encodeURIComponent(messageText)}`;
    if (waTab) {
      waTab.location.href = waUrl;
    } else {
      // Popup was blocked even with the synchronous open attempt (some browsers still block
      // it) - fall back to navigating the current tab so the action isn't silently a no-op.
      window.location.href = waUrl;
    }
  };

  const handleCallAction = async (property: Property) => {
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          visitorName: "Anonymous Visitor (Phone Link)",
          visitorPhone: "Call Event",
          contactMethod: "CALL",
          message: `Visitor initiated a call for property ${property.listingId}`,
          campaign: sessionStorage.getItem("attributionCampaignId") || undefined
        })
      });
      trackEvent("call_click", "marketplace", property.title);
      onLeadSubmitted();
    } catch (e) {
      console.error(e);
    }
    window.location.href = "tel:+97444448888";
  };

  const isFeatured = (propId: string) => {
    return campaigns.some(c => c.propertyId === propId && c.type === "FEATURED_LISTING" && c.status === "ACTIVE");
  };

  // Sort function
  // Memoized - this used to be a plain function called 3+ times per render (count badge,
  // empty-check, list render), each call re-filtering/re-sorting the full properties array
  // and scanning campaigns via isFeatured() inside the sort comparator.
  const sortedProperties = React.useMemo(() => {
    let list = [...properties];

    // If AI Search is active, prioritize recommended properties
    if (aiSearchActive && aiResults.length > 0) {
      const matchIds = aiResults.map(r => r.propertyId);
      list = list.filter(p => matchIds.includes(p.id));
    }

    if (sortBy === "priceAsc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceDesc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "areaDesc") {
      list.sort((a, b) => b.area - a.area);
    }

    // Always sort featured listings first
    return list.sort((a, b) => {
      const aFeat = isFeatured(a.id);
      const bFeat = isFeatured(b.id);
      if (aFeat && !bFeat) return -1;
      if (!aFeat && bFeat) return 1;
      return 0;
    });
  }, [properties, aiSearchActive, aiResults, sortBy, campaigns]);
  const getSortedProperties = () => sortedProperties;

  // Find municipality choices
  const municipalities = locations.filter(l => l.type === "MUNICIPALITY" && l.isActive);
  // Find area choices belonging to selected municipality
  const filteredAreas = locations.filter(l => l.parentId === selectedMunicipality && l.isActive);

  // Find responsible agent and org for current property
  const responsibleAgent = selectedProperty ? users.find(u => u.id === selectedProperty.agentId) : null;
  const responsibleOrg = selectedProperty ? organizations.find(o => o.id === selectedProperty.orgId) : null;

  const t = {
    searchPlaceholder: isRtl ? "ابحث عن منطقة، مجمع، أو مبنى عقاري..." : "Search by area, tower, or community...",
    aiTitle: isRtl ? "البحث بذكاء نيرو فايند" : "Search with Nerou Find AI",
    aiSubtitle: isRtl ? "محرك الاكتشاف الذكي التفاعلي لمنصة نيرو فايندر" : "Discover your next property with the Nerou Find intelligence engine",
    aiPlaceholder: isRtl ? "مثال: شقة غرفتين في لوسيل بإطلالة بحرية بأقل من ١٢,٠٠٠ ريال قطري..." : "e.g. Find me a 2-bedroom in Lusail with a sea view under 12,000 QAR...",
    allProperties: isRtl ? "العقارات المتاحة" : "Available Properties",
    noProperties: isRtl ? "لم يتم العثور على عقارات مطابقة للبحث." : "No properties found matching your search.",
    verified: isRtl ? "موثق" : "Verified",
    viewDetails: isRtl ? "عرض التفاصيل" : "View Details",
    whatsappCTA: isRtl ? "واتساب" : "WhatsApp",
    callCTA: isRtl ? "اتصال" : "Call",
    inquiryCTA: isRtl ? "إرسال استفسار" : "Send Inquiry",
    beds: isRtl ? "غرف" : "Beds",
    baths: isRtl ? "حمامات" : "Baths",
    sqm: isRtl ? "متر مربع" : "Sqm",
    whyMatchHeader: isRtl ? "لماذا يناسبك هذا العقار؟" : "Why this match?",
    detailsTitle: isRtl ? "تفاصيل العقار" : "Property Details",
    specs: isRtl ? "المواصفات الأساسية" : "Core Specifications",
    amenities: isRtl ? "المرافق والخدمات" : "Amenities & Facilities",
    scheduleViewing: isRtl ? "جدولة موعد للمعاينة" : "Schedule a Viewing",
    nameLabel: isRtl ? "الاسم الكامل" : "Full Name",
    phoneLabel: isRtl ? "رقم الهاتف" : "Phone Number",
    langPref: isRtl ? "اللغة المفضلة" : "Preferred Language",
    messageLabel: isRtl ? "الرسالة" : "Your Message",
    submitForm: isRtl ? "تأكيد الطلب" : "Confirm Inquiry",
    priceHistory: isRtl ? "سجل الأسعار" : "Price History",
    aiErrorMsg: isRtl ? "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي نيرو فايند. الرجاء المحاولة مجددًا." : "Nerou Find AI is currently offline or starting up."
  };

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Unified luxury panel: category navigation + AI search share one continuous dark/gold
          surface. Pulled up by the header's height (-mt-24 = -6rem = -64px header + 32px main
          padding) so the photo extends behind the transparent floating header at the top of the
          page; pt-24 on the inner content below compensates so nothing is actually hidden. */}
      <div className="bg-[#1c1a17] rounded-xl border border-[#33302a] shadow-sm relative overflow-hidden -mt-24">
        <PhotoHero />
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles size={160} />
        </div>

        <div className="relative z-10 pt-24">
          {/* Premium Multi-Tab Sub-Navigation Menu */}
          <div className="p-2 flex flex-wrap gap-1 items-center justify-between text-xs font-bold">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => {
                  setCurrentTab("MARKETPLACE");
                  clearAiSearch();
                  setPropType("");
                  setTransType("");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "MARKETPLACE" && !propType && !transType
                    ? "bg-[#bf9b30] text-black"
                    : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "العقارات المتاحة" : "Browse Properties"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("MARKETPLACE");
                  setTransType(TransactionType.FOR_SALE);
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "MARKETPLACE" && transType === TransactionType.FOR_SALE
                    ? "bg-[#bf9b30] text-black"
                    : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "شراء" : "Buy"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("MARKETPLACE");
                  setTransType(TransactionType.FOR_RENT);
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "MARKETPLACE" && transType === TransactionType.FOR_RENT
                    ? "bg-[#bf9b30] text-black"
                    : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "إيجار" : "Rent"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("MARKETPLACE");
                  setTransType(TransactionType.OFF_PLAN);
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "MARKETPLACE" && transType === TransactionType.OFF_PLAN
                    ? "bg-[#bf9b30] text-black"
                    : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "على المخطط" : "Off-Plan"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("PROJECTS");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "PROJECTS" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "المشاريع الكبرى" : "Masterplans"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("PLANS");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "PLANS" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "الأسعار والخطط" : "Plans & Pricing"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("HELP_CENTER");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "HELP_CENTER" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "مركز المساعدة" : "Help Center"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("CAREERS");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "CAREERS" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "وظائف" : "Careers"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("PRESS");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "PRESS" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "الصحافة" : "Press"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("PARTNERSHIPS");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "PARTNERSHIPS" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "شراكات" : "Partnerships"}
              </button>

              <button
                onClick={() => {
                  setCurrentTab("LEGAL");
                }}
                className={`px-3 py-2 rounded-lg transition-all cursor-pointer ${
                  currentTab === "LEGAL" ? "bg-[#bf9b30] text-black" : "hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                {isRtl ? "الوثائق القانونية" : "Legal Policies"}
              </button>
            </div>

            <div>
              <button
                onClick={() => {
                  setCurrentTab("SUPPORT_TICKETS");
                }}
                className={`px-3 py-2 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentTab === "SUPPORT_TICKETS"
                    ? "bg-red-500/15 text-red-300 border-red-500/40"
                    : "border-white/15 hover:bg-white/10 text-gray-300 hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                <span>{isRtl ? "تذاكر الدعم" : "My Support Desk"}</span>
              </button>
            </div>
          </div>

          {currentTab === "MARKETPLACE" && (
            <div className="border-t border-white/10 text-white p-6 md:p-8">
              {/* Search mode toggle - "Properties" keeps the existing filter/AI search
                  entirely unchanged; the other three switch to a separate agent/agency/
                  developer identity lookup (DirectorySearch.tsx), not a property search. */}
              <div className="max-w-3xl flex flex-wrap gap-2 mb-5" role="tablist">
                {([
                  ["PROPERTIES", isRtl ? "العقارات" : "Properties"],
                  ["AGENT", isRtl ? "الوكلاء" : "Agents"],
                  ["AGENCY", isRtl ? "المكاتب العقارية" : "Agencies"],
                  ["DEVELOPER", isRtl ? "المطورون" : "Developers"]
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    role="tab"
                    aria-selected={searchMode === mode}
                    onClick={() => setSearchMode(mode)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer ${
                      searchMode === mode
                        ? "bg-[#bf9b30] text-black"
                        : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {searchMode !== "PROPERTIES" ? (
                <div className="max-w-5xl">
                  <DirectorySearch
                    type={searchMode}
                    isRtl={isRtl}
                    onSelect={(type, id) => {
                      if (type === "AGENT") {
                        const agent = users.find((u) => u.id === id);
                        if (agent) setSelectedAgentProfile(agent);
                      } else {
                        const org = organizations.find((o) => o.id === id);
                        if (org) setSelectedOrgProfile(org);
                      }
                    }}
                  />
                </div>
              ) : (
              <div className="max-w-3xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#bf9b30] text-black text-xs font-semibold uppercase tracking-wider rounded-full">
                  <Sparkles size={14} />
                  <span>{t.aiTitle}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-serif tracking-tight font-medium">
                  {t.aiSubtitle}
                </h2>

                {/* Conversational Chat History Logs */}
                {aiHistory.length > 0 && (
                  <div className="bg-[#24211e] rounded-xl border border-[#3d3934] p-4 max-h-64 overflow-y-auto space-y-3 scrollbar-thin text-left">
                    {aiHistory.map((chat, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${chat.role === "user" ? "items-end" : "items-start"} space-y-1`}
                      >
                        <span className="text-[10px] font-bold text-[#8c847a] uppercase tracking-wide">
                          {chat.role === "user" ? (isRtl ? "أنت" : "You") : (isRtl ? "مساعد نيرو الذكي" : "Nerou AI Assistant")}
                        </span>
                        <div
                          className={`px-3 py-2 rounded-lg text-xs md:text-sm max-w-[85%] leading-relaxed ${
                            chat.role === "user"
                              ? "bg-[#bf9b30] text-black font-medium rounded-tr-none"
                              : "bg-[#2d2925] text-[#eae5df] border border-[#423d37] rounded-tl-none"
                          }`}
                        >
                          {chat.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAiSearch} className="flex flex-col md:flex-row gap-2 mt-4">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={t.aiPlaceholder}
                    className="flex-1 px-4 py-3 bg-[#2c2925] text-white rounded-lg border border-[#44403a] placeholder-gray-400 focus:outline-none focus:border-[#bf9b30] font-sans text-base"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading}
                    className="px-6 py-3 bg-[#bf9b30] hover:bg-[#a68628] disabled:bg-gray-600 text-black font-semibold rounded-lg transition-colors text-sm md:text-base flex items-center justify-center gap-2"
                  >
                    {aiLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        <span>{isRtl ? "جاري البحث..." : "Searching..."}</span>
                      </>
                    ) : (
                      <>
                        <Search size={18} />
                        <span>{isRtl ? "ابحث بالذكاء الاصطناعي" : "AI Match"}</span>
                      </>
                    )}
                  </button>
                </form>

                {aiSearchActive && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={clearAiSearch}
                      className="text-xs text-[#bf9b30] hover:underline cursor-pointer"
                    >
                      {isRtl ? "إلغاء البحث الذكي والعودة للعرض التقليدي" : "Reset & show all properties"}
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {currentTab === "MARKETPLACE" && searchMode === "PROPERTIES" && (
        <>
          {/* 2. Central Qatar Parent-Child Location & Property Type Filters */}
      {!aiSearchActive && (
        <div className="space-y-3 mb-6">
          <div className="bg-white p-4 rounded-xl border border-[#e6e2de] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">

            {/* Keyword search query */}
            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-xs font-medium text-[#6e6b66] mb-1">
                {isRtl ? "البحث النصي" : "Keyword"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-base md:text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
                />
                <Search size={16} className={`absolute ${isRtl ? "right-3" : "left-3"} top-2.5 text-[#a8a4a0]`} />
              </div>
            </div>

            {/* Municipality Parent selector */}
            <div>
              <label className="block text-xs font-medium text-[#6e6b66] mb-1">
                {isRtl ? "البلدية" : "Municipality"}
              </label>
              <select
                value={selectedMunicipality}
                onChange={(e) => {
                  setSelectedMunicipality(e.target.value);
                  setSelectedArea(""); // Reset child
                }}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-base md:text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
              >
                <option value="">{isRtl ? "كل البلديات" : "All Municipalities"}</option>
                {municipalities.map(muni => (
                  <option key={muni.id} value={muni.id}>
                    {isRtl ? muni.nameAr : muni.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Child selector */}
            <div>
              <label className="block text-xs font-medium text-[#6e6b66] mb-1">
                {isRtl ? "المنطقة / الحي" : "Area / District"}
              </label>
              <select
                value={selectedArea}
                disabled={!selectedMunicipality}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-base md:text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918] disabled:opacity-50"
              >
                <option value="">{isRtl ? "كل المناطق" : "All Areas"}</option>
                {filteredAreas.map(area => (
                  <option key={area.id} value={area.id}>
                    {isRtl ? area.nameAr : area.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Configurable Property Type taxonomy */}
            <div>
              <label className="block text-xs font-medium text-[#6e6b66] mb-1">
                {isRtl ? "نوع العقار" : "Property Type"}
              </label>
              <select
                value={propType}
                onChange={(e) => setPropType(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-base md:text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
              >
                <option value="">{isRtl ? "جميع الأنواع" : "All Types"}</option>
                <option value={PropertyType.APARTMENT}>{isRtl ? "شقة سكنية" : "Apartment"}</option>
                <option value={PropertyType.VILLA}>{isRtl ? "فيلا مستقلة" : "Villa"}</option>
                <option value={PropertyType.TOWNHOUSE}>{isRtl ? "تاونهاوس" : "Townhouse"}</option>
                <option value={PropertyType.PENTHOUSE}>{isRtl ? "بنتهاوس فخم" : "Penthouse"}</option>
                <option value={PropertyType.COMPOUND}>{isRtl ? "مجمع فلل" : "Compound"}</option>
                <option value={PropertyType.STUDIO}>{isRtl ? "استوديو" : "Studio"}</option>
                <option value={PropertyType.ROOM}>{isRtl ? "غرفة مستقلة" : "Room"}</option>
                <option value={PropertyType.OFFICE}>{isRtl ? "مكتب إداري" : "Office"}</option>
                <option value={PropertyType.RETAIL}>{isRtl ? "معرض تجاري" : "Retail"}</option>
                <option value={PropertyType.SHOP}>{isRtl ? "محل تجاري" : "Shop"}</option>
                <option value={PropertyType.WAREHOUSE}>{isRtl ? "مخزن / مستودع" : "Warehouse"}</option>
                <option value={PropertyType.BUILDING}>{isRtl ? "عمارة كاملة" : "Building"}</option>
                <option value={PropertyType.LAND}>{isRtl ? "أرض فضاء" : "Land"}</option>
                <option value={PropertyType.HOTEL_APARTMENT}>{isRtl ? "شقة فندقية" : "Hotel Apartment"}</option>
                <option value={PropertyType.CHALET}>{isRtl ? "شاليه" : "Chalet"}</option>
                <option value={PropertyType.FARM}>{isRtl ? "مزرعة" : "Farm"}</option>
                <option value={PropertyType.OTHER}>{isRtl ? "نوع آخر" : "Other"}</option>
              </select>
            </div>

            {/* Transaction Type */}
            <div>
              <label className="block text-xs font-medium text-[#6e6b66] mb-1">
                {isRtl ? "المعاملة" : "Transaction"}
              </label>
              <select
                value={transType}
                onChange={(e) => setTransType(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-base md:text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
              >
                <option value="">{isRtl ? "الكل" : "All"}</option>
                <option value={TransactionType.FOR_RENT}>{isRtl ? "للإيجار" : "For Rent"}</option>
                <option value={TransactionType.FOR_SALE}>{isRtl ? "للبيع" : "For Sale"}</option>
                <option value={TransactionType.OFF_PLAN}>{isRtl ? "على المخطط" : "Off-Plan"}</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {currentUser ? (
              <button
                onClick={() => {
                  fetchSavedSearches();
                  setIsAlertsOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#fcfbf9] border border-[#e6e2de] hover:bg-[#f5f2ee] rounded-lg text-xs font-medium text-[#1a1918] cursor-pointer transition-colors"
              >
                <Bell size={14} className="text-[#bf9b30]" />
                <span>{isRtl ? "تنبيهاتي وعمليات البحث المحفوظة" : "My Saved Searches & Alerts"}</span>
                {savedSearches.some(s => s.newMatchesCount > 0) && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                )}
              </button>
            ) : (
              <div />
            )}
            <button
              onClick={handleSaveSearchClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-[#bf9b30] to-[#8c6d1d] hover:opacity-95 text-white rounded-lg text-xs font-medium cursor-pointer transition-opacity"
            >
              <Bookmark size={14} />
              <span>{isRtl ? "حفظ هذا البحث للتنبيهات" : "Save Active Search"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Listings Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e6e2de] pb-4">
        <div>
          <h3 className="text-xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
            <span>{aiSearchActive ? (isRtl ? "نتائج الاكتشاف الذكي نيرو فايند" : "Nerou Find AI Discovery Matches") : t.allProperties}</span>
            <span className="text-sm font-sans text-[#6e6b66] bg-[#f2ede8] px-2 py-0.5 rounded-full font-normal">
              {getSortedProperties().length}
            </span>
          </h3>
          {aiSearchActive && (
            <p className="text-xs text-[#6e6b66] mt-1">
              {isRtl ? "تمت التصفية والمطابقة بالذكاء الاصطناعي نيرو فايند مع توضيح أسباب التوافق" : "Live data discovered and scored via server-side Nerou Find AI"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle (List vs Map) */}
          <div className="flex bg-[#f2ede8] p-1 rounded-lg border border-[#e6e2de]">
            <button
              onClick={() => setViewFormat("LIST")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewFormat === "LIST"
                  ? "bg-white text-[#bf9b30] shadow-xs"
                  : "text-[#6e6b66] hover:text-[#1a1918]"
              }`}
              title={isRtl ? "عرض القائمة" : "List View"}
            >
              <List size={12} />
              <span className="hidden xs:inline">{isRtl ? "قائمة" : "List"}</span>
            </button>
            <button
              onClick={() => setViewFormat("MAP")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewFormat === "MAP"
                  ? "bg-white text-[#bf9b30] shadow-xs"
                  : "text-[#6e6b66] hover:text-[#1a1918]"
              }`}
              title={isRtl ? "عرض الخريطة" : "Map View"}
            >
              <Map size={12} />
              <span className="hidden xs:inline">{isRtl ? "خريطة" : "Map"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-[#6e6b66]">
            <ArrowUpDown size={14} />
            <span>{isRtl ? "ترتيب حسب:" : "Sort:"}</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-xs focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
          >
            <option value="default">{isRtl ? "الأحدث" : "Latest"}</option>
            <option value="priceAsc">{isRtl ? "السعر (من الأقل)" : "Price (Low to High)"}</option>
            <option value="priceDesc">{isRtl ? "السعر (من الأعلى)" : "Price (High to Low)"}</option>
            <option value="areaDesc">{isRtl ? "المساحة (الأكبر)" : "Area (Largest)"}</option>
          </select>
        </div>
      </div>

      {/* AI Error Display */}
      {aiError && (
        <div className="p-4 bg-red-50 text-red-800 rounded-lg border border-red-200 text-sm flex gap-3 items-center">
          <Info size={18} />
          <span>{t.aiErrorMsg} (Error details: {aiError})</span>
        </div>
      )}

      {/* 4. Listings Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse space-y-4">
              <div className="bg-gray-200 h-56 rounded-xl w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : getSortedProperties().length === 0 ? (
        <div className="text-center py-20 bg-white border border-[#e6e2de] rounded-xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#faf6ea] border border-[#bf9b30]/30 flex items-center justify-center">
            <Info size={24} className="text-[#bf9b30]" />
          </div>
          <h4 className="font-serif text-lg text-[#1a1918] mb-1">{t.noProperties}</h4>
          <p className="text-xs text-[#6e6b66] max-w-sm mx-auto">
            {isRtl
              ? "جرّب تعديل معايير البحث أو تصفح جميع الفئات لاكتشاف فرص جديدة."
              : "Try adjusting your search filters or browse all categories to discover new opportunities."}
          </p>
        </div>
      ) : viewFormat === "MAP" ? (
        <InteractiveMap
          properties={getSortedProperties()}
          onPropertyClick={setSelectedProperty}
          isRtl={isRtl}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getSortedProperties().map((property) => {
            const aiMatchInfo = aiResults.find(r => r.propertyId === property.id);
            const feat = isFeatured(property.id);

            return (
              <div
                key={property.id}
                onClick={() => setSelectedProperty(property)}
                role="button"
                tabIndex={0}
                aria-label={isRtl ? property.titleAr || property.title : property.title}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedProperty(property);
                  }
                }}
                className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden group cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#bf9b30] focus-visible:outline-offset-2 ${
                  feat
                    ? "border-[#bf9b30] bg-[#bf9b30]/2 shadow-md hover:border-[#967923] ring-1 ring-[#bf9b30]/20"
                    : "border-[#e6e2de] hover:border-[#bf9b30] shadow-sm"
                }`}
              >
                <div>
                  <div className="relative h-52 overflow-hidden bg-gray-100">
                    <img
                      src={property.images[0]}
                      alt={property.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md text-white ${
                        property.transactionType === TransactionType.FOR_RENT ? "bg-blue-600" :
                        property.transactionType === TransactionType.FOR_SALE ? "bg-green-600" : "bg-[#bf9b30]"
                      }`}>
                        {property.transactionType === TransactionType.FOR_RENT ? (isRtl ? "إيجار" : "Rent") :
                         property.transactionType === TransactionType.FOR_SALE ? (isRtl ? "بيع" : "Buy") : (isRtl ? "على المخطط" : "Off-Plan")}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (comparedPropertyIds.includes(property.id)) {
                              setComparedPropertyIds(comparedPropertyIds.filter(cid => cid !== property.id));
                            } else {
                              if (comparedPropertyIds.length >= 4) {
                                alert(isRtl ? "يمكنك مقارنة ٤ عقارات كحد أقصى جنباً إلى جنب" : "You can compare up to 4 properties side-by-side.");
                                return;
                              }
                              setComparedPropertyIds([...comparedPropertyIds, property.id]);
                            }
                          }}
                          className={`p-2 rounded-full shadow-sm hover:scale-110 transition-transform cursor-pointer ${
                            comparedPropertyIds.includes(property.id)
                              ? "bg-[#bf9b30] text-white"
                              : "bg-white text-[#6e6b66]"
                          }`}
                          title={isRtl ? "مقارنة العقار" : "Compare Side-by-Side"}
                        >
                          <Activity size={15} />
                        </button>

                        <button
                          onClick={(e) => toggleSaveProperty(property.id, e)}
                          className="p-2 bg-white rounded-full shadow-sm hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Bookmark
                            size={15}
                            className={savedPropertyIds.includes(property.id) ? "fill-[#bf9b30] text-[#bf9b30]" : "text-[#6e6b66]"}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {property.verificationStatus === VerificationStatus.APPROVED && (
                          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-[#1a1918] flex items-center gap-1 shadow-xs border border-[#bf9b30]/30">
                            <CheckCircle size={12} className="text-[#bf9b30]" />
                            <span>{t.verified}</span>
                          </div>
                        )}
                        {/* Honest, non-alarming freshness signal: shown once a listing has
                            gone 21+ days without its availability being reconfirmed (see
                            getAvailabilityStaleDays()/AVAILABILITY_UNCONFIRMED_DAYS). */}
                        {getAvailabilityStaleDays(property.lastConfirmedAvailableDate || property.createdDate) >= AVAILABILITY_UNCONFIRMED_DAYS && (
                          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 flex items-center gap-1 shadow-xs border border-amber-300">
                            <Clock size={12} />
                            <span>{isRtl ? "التوفر غير مؤكد" : "Availability Unconfirmed"}</span>
                          </div>
                        )}
                      </div>

                      {feat && (
                        <div className="bg-[#bf9b30] text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs border border-white ml-auto">
                          <Award size={12} className="shrink-0" />
                          <span>{isRtl ? "مميز" : "Featured"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-[#6e6b66]">
                        <MapPin size={12} />
                        <span>{property.district}, {property.city}</span>
                      </div>
                      <h4 className="font-serif text-lg font-medium text-[#1a1918] line-clamp-1 group-hover:text-[#bf9b30] transition-colors">
                        {isRtl ? property.titleAr : property.title}
                      </h4>
                      {/* FIX 4: verified badge on search-result cards too, showing the agent's
                          actual company rather than a generic "Nerou" claim. Clickable so the
                          agent's name/company on the card links straight to their public profile
                          (directory search Fix 4) without leaving the results grid. */}
                      {(() => {
                        const listingAgent = users.find(u => u.id === property.agentId);
                        if (!listingAgent || listingAgent.verificationStatus !== VerificationStatus.APPROVED) return null;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgentProfile(listingAgent);
                            }}
                            className="text-[10px] text-[#8c6d1d] font-semibold truncate hover:text-[#bf9b30] hover:underline cursor-pointer text-left rtl:text-right"
                          >
                            {getVerifiedBadgeLabel(listingAgent, organizations.find(o => o.id === listingAgent.orgId)?.name, isRtl)}
                          </button>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[#6e6b66] border-y border-[#f2ede8] py-2">
                      <div className="flex items-center gap-1">
                        <Bed size={13} />
                        <span>{property.bedrooms} {t.beds}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Bath size={13} />
                        <span>{property.bathrooms} {t.baths}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Maximize2 size={13} />
                        <span>{property.area} {t.sqm}</span>
                      </div>
                    </div>

                    {aiMatchInfo && (
                      <div className="bg-[#f9f8f6] p-3 rounded-lg border-l-2 border-[#bf9b30] space-y-1 mt-2 animate-in fade-in duration-300">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#bf9b30] uppercase">
                          <Sparkles size={11} />
                          <span>{t.whyMatchHeader}</span>
                        </div>
                        <p className="text-xs text-[#6e6b66] leading-relaxed">
                          {isRtl ? aiMatchInfo.whyMatchAr : aiMatchInfo.whyMatchEn}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2 border-t border-[#f2ede8]">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-[#6e6b66] block uppercase tracking-wider">
                      {property.transactionType === TransactionType.FOR_RENT ? (isRtl ? "قيمة الإيجار" : "Rent Price") : (isRtl ? "القيمة الإجمالية" : "Total Cost")}
                    </span>
                    <span className="font-serif text-xl font-semibold text-[#1c1a17]">
                      {formatPrice(property.price, isRtl)}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppAction(property); }}
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-full transition-colors cursor-pointer"
                      title={t.whatsappCTA}
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCallAction(property); }}
                      className="p-2 bg-[#fdf6e8] hover:bg-[#f8ecc9] text-[#8c6d1d] rounded-full transition-colors cursor-pointer"
                      title={t.callCTA}
                    >
                      <Phone size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Detailed Property Overlay Modal Drawer */}
      {selectedProperty && (
        <PropertyDetailView
          property={selectedProperty}
          allProperties={properties}
          onSelectProperty={(p) => setSelectedProperty(p)}
          onClose={() => setSelectedProperty(null)}
          onToggleSave={handleToggleSavePropertyBackend}
          isSaved={savedPropertyIds.includes(selectedProperty.id)}
          onToggleCompare={(id) => {
            if (comparedPropertyIds.includes(id)) {
              setComparedPropertyIds(comparedPropertyIds.filter((cid) => cid !== id));
            } else {
              if (comparedPropertyIds.length >= 4) {
                alert(isRtl ? "يمكنك مقارنة ٤ عقارات كحد أقصى جنباً إلى جنب" : "You can compare up to 4 properties side-by-side.");
                return;
              }
              setComparedPropertyIds([...comparedPropertyIds, id]);
            }
          }}
          isCompared={comparedPropertyIds.includes(selectedProperty.id)}
          isRtl={isRtl}
          currentUser={currentUser}
          onViewAgentProfile={() => {
            if (responsibleAgent) {
              setSelectedAgentProfile(responsibleAgent);
            } else if (responsibleOrg) {
              setSelectedOrgProfile(responsibleOrg);
            }
          }}
        />
      )}

      {/* Floating comparison status & triggers */}
      {comparedPropertyIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#1A1918] border border-[#BF9B30]/30 shadow-2xl rounded-full px-5 py-3 flex items-center gap-4 text-white animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#BF9B30] text-black font-bold text-xs rounded-full flex items-center justify-center">
              {comparedPropertyIds.length}
            </div>
            <span className="text-xs font-bold font-serif tracking-wider">
              {isRtl ? "عقارات محددة للمقارنة" : "Properties Selected to Compare"}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-1.5 bg-[#BF9B30] hover:bg-[#A68628] text-black font-bold text-[10px] uppercase rounded-full transition-colors cursor-pointer"
            >
              {isRtl ? "قارن الآن" : "Compare Now"}
            </button>
            <button
              onClick={() => setComparedPropertyIds([])}
              className="text-[10px] text-gray-400 hover:text-white underline cursor-pointer"
            >
              {isRtl ? "تصفية" : "Clear All"}
            </button>
          </div>
        </div>
      )}

      {/* Comparison Modal Side-by-Side overlay */}
      {isCompareModalOpen && (
        <PropertyCompareView
          properties={properties.filter(p => comparedPropertyIds.includes(p.id))}
          onRemoveFromCompare={(id) => setComparedPropertyIds(comparedPropertyIds.filter(cid => cid !== id))}
          onClose={() => setIsCompareModalOpen(false)}
          isRtl={isRtl}
        />
      )}
        </>
      )}

      {currentTab === "PROJECTS" && <ProjectsView isRtl={isRtl} organizations={organizations} />}
      {currentTab === "PLANS" && (
        <PlansPricingView
          isRtl={isRtl}
          onSelectPlan={(planId) => {
            sessionStorage.setItem("presetPlanId", planId);
            if (onSignupTrigger) onSignupTrigger();
          }}
        />
      )}
      {currentTab === "HELP_CENTER" && <HelpCenterView isRtl={isRtl} />}
      {currentTab === "CAREERS" && <CareersView isRtl={isRtl} />}
      {currentTab === "PRESS" && <PressView isRtl={isRtl} />}
      {currentTab === "PARTNERSHIPS" && <PartnershipsView isRtl={isRtl} />}
      {currentTab === "SUPPORT_TICKETS" && (
        <SupportTicketsView
          isRtl={isRtl}
          currentUser={currentUser}
          onLoginTrigger={onLoginTrigger}
          onSignupTrigger={onSignupTrigger}
        />
      )}
      {currentTab === "LEGAL" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h2 className="text-2xl font-serif text-[#1a1918] font-medium">
              {isRtl ? "الوثائق القانونية والامتثال الرقابي" : "Legal Documents & Privacy Regulations"}
            </h2>
            <p className="text-xs text-[#6e6b66] mt-1">
              {isRtl
                ? "تصفح مستندات وشروط الاستخدام وسياسة الخصوصية المعتمدة وفقاً لقانون حماية الخصوصية رقم ١٣ لعام ٢٠١٦ بدولة قطر."
                : "Review active terms of service, developer guidelines, and privacy regulations under Law No. 13 of 2016."}
            </p>
          </div>

          <div className="space-y-4">
            {legalDocs.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#6e6b66] border border-dashed border-[#e6e2de] rounded-xl bg-white p-8">
                {isRtl ? "لا توجد مستندات قانونية منشورة حالياً." : "No certified documents in repository currently."}
              </div>
            ) : (
              legalDocs.map((doc) => (
                <div key={doc.id} className="p-6 bg-white border border-[#e6e2de] rounded-xl space-y-4 text-xs">
                  <div className="flex justify-between items-start border-b border-[#f2ede8] pb-3">
                    <div>
                      <h3 className="font-serif font-bold text-sm text-[#1a1918]">{isRtl ? doc.titleAr : doc.title}</h3>
                      <span className="text-[10px] text-[#6e6b66] block font-mono mt-1">
                        {isRtl ? "الإصدار: " : "Version: "} {doc.version} • {isRtl ? "آخر تحديث: " : "Last updated: "} {doc.lastUpdated ? doc.lastUpdated.split("T")[0] : doc.effectiveDate}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase rounded">
                      {isRtl ? "معتمد وموثق" : "Certified & Valid"}
                    </span>
                  </div>
                  <p className="leading-relaxed text-[#6e6b66] whitespace-pre-wrap font-sans">
                    {isRtl ? doc.contentAr : doc.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 6. FULLY FUNCTIONAL AGENT PROFILE OVERLAY MODAL */}
      {selectedAgentProfile && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcfbfa] rounded-xl border border-[#e6e2de] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedAgentProfile(null)}
              className="absolute top-4 right-4 p-1.5 bg-white hover:bg-gray-100 rounded-full border border-[#e6e2de] text-[#1a1918] cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              {/* Profile card Header */}
              <div className="flex items-start gap-4">
                <img
                  src={selectedAgentProfile.avatarUrl || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80"}
                  alt={selectedAgentProfile.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#bf9b30]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-serif font-bold text-[#1c1a17]">{selectedAgentProfile.fullName}</h3>
                  </div>
                  <span className="text-[10px] bg-[#bf9b30]/10 text-[#bf9b30] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider block w-max">
                    {selectedAgentProfile.role.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-[#6e6b66]">
                    <Building2 size={12} />
                    <span>
                      {selectedAgentProfile.verificationStatus === VerificationStatus.APPROVED
                        ? getVerifiedBadgeLabel(selectedAgentProfile, organizations.find(o => o.id === selectedAgentProfile.orgId)?.name, isRtl)
                        : (organizations.find(o => o.id === selectedAgentProfile.orgId)?.name || (isRtl ? "وكيل مستقل" : "Independent Agent"))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact methods */}
              <div className="bg-white p-4 rounded-xl border border-[#e6e2de] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e6b66] font-medium">{isRtl ? "الهاتف المباشر" : "Direct Telephone"}</span>
                  <a href={`tel:${selectedAgentProfile.phone}`} className="font-bold text-[#1c1a17] hover:text-[#bf9b30] flex items-center gap-1">
                    <Phone size={12} />
                    <span>{selectedAgentProfile.phone}</span>
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-[#f2ede8] pt-2.5">
                  <span className="text-[#6e6b66] font-medium">{isRtl ? "البريد الإلكتروني" : "Direct Email"}</span>
                  <a href={`mailto:${selectedAgentProfile.email}`} className="font-bold text-[#1c1a17] hover:text-[#bf9b30] flex items-center gap-1">
                    <Mail size={12} />
                    <span>{selectedAgentProfile.email}</span>
                  </a>
                </div>
              </div>

              {/* Bio details */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#6e6b66] uppercase tracking-wider block">
                  {isRtl ? "نبذة تعريفية" : "Professional Profile"}
                </span>
                <p className="text-xs text-[#6e6b66] leading-relaxed">
                  {selectedAgentProfile.bio || "Registered broker partner serving the Qatar real estate market with professional solutions."}
                </p>
              </div>

              {/* Specialties / languages */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#6e6b66] uppercase tracking-wider block">
                    {isRtl ? "مناطق التخصص" : "Specialties"}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgentProfile.specialties?.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-[#e6e2de] rounded text-[10px] font-semibold text-[#6e6b66]">
                        {s}
                      </span>
                    )) || <span className="text-[10px] text-gray-400">General Qatar</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#6e6b66] uppercase tracking-wider block">
                    {isRtl ? "اللغات" : "Languages"}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgentProfile.languages?.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-[#e6e2de] rounded text-[10px] font-semibold text-[#6e6b66]">
                        {l}
                      </span>
                    )) || <span className="text-[10px] text-gray-400">English, Arabic</span>}
                  </div>
                </div>
              </div>

              <ProfileReviewsSection
                targetType="AGENT"
                targetId={selectedAgentProfile.id}
                currentUser={currentUser}
                isRtl={isRtl}
              />

              {/* Other Listings managed by this Agent */}
              <div className="space-y-3 pt-3 border-t border-[#e6e2de]">
                <span className="text-[10px] font-bold text-[#1c1a17] uppercase tracking-wider block">
                  {isRtl ? "العقارات التي يديرها هذا المستشار" : "Active Listings Under Management"}
                </span>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {properties.filter(p => p.agentId === selectedAgentProfile.id).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No other properties listed currently.</p>
                  ) : (
                    properties
                      .filter(p => p.agentId === selectedAgentProfile.id)
                      .map(prop => (
                        <div
                          key={prop.id}
                          onClick={() => { setSelectedProperty(prop); setSelectedAgentProfile(null); }}
                          className="p-2 bg-white hover:bg-[#bf9b30]/5 border border-[#e6e2de] hover:border-[#bf9b30]/50 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img src={prop.images[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            <span className="font-medium text-[#1c1a17] truncate">{isRtl ? prop.titleAr : prop.title}</span>
                          </div>
                          <span className="font-bold text-[#bf9b30] flex-shrink-0">{formatPrice(prop.price, isRtl)}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 7. FULLY FUNCTIONAL AGENCY/DEVELOPER PROFILE OVERLAY MODAL */}
      {selectedOrgProfile && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcfbfa] rounded-xl border border-[#e6e2de] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedOrgProfile(null)}
              className="absolute top-4 right-4 p-1.5 bg-white hover:bg-gray-100 rounded-full border border-[#e6e2de] text-[#1a1918] cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              {/* Profile Card Header */}
              <div className="flex items-start gap-4">
                <img
                  src={selectedOrgProfile.logoUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=150&h=150&q=80"}
                  alt={selectedOrgProfile.name}
                  className="w-16 h-16 rounded-lg object-cover border border-[#e6e2de]"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-serif font-bold text-[#1c1a17]">
                      {isRtl && selectedOrgProfile.nameAr ? selectedOrgProfile.nameAr : selectedOrgProfile.name}
                    </h3>
                    {selectedOrgProfile.verificationStatus === VerificationStatus.APPROVED && (
                      <span className="p-0.5 bg-amber-50 text-[#bf9b30] border border-[#bf9b30]/30 rounded-md" title="Accredited Partner">
                        <CheckCircle size={12} className="fill-[#bf9b30] text-white" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] bg-neutral-100 text-neutral-800 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider block w-max">
                    {selectedOrgProfile.type}
                  </span>
                  <div className="text-xs text-[#bf9b30] font-semibold">
                    {selectedOrgProfile.subscriptionPlanId === "plan-premium" ? "Enterprise SaaS Tier" : "Master Developer SaaS Tier"}
                  </div>
                </div>
              </div>

              {/* Contact methods */}
              <div className="bg-white p-4 rounded-xl border border-[#e6e2de] space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e6b66] font-medium">{isRtl ? "هاتف المكتب الرئيسي" : "Main HQ Telephone"}</span>
                  <a href={`tel:${selectedOrgProfile.phone}`} className="font-bold text-[#1c1a17] hover:text-[#bf9b30] flex items-center gap-1">
                    <Phone size={12} />
                    <span>{selectedOrgProfile.phone}</span>
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-[#f2ede8] pt-2.5">
                  <span className="text-[#6e6b66] font-medium">{isRtl ? "البريد الإلكتروني للعمليات" : "Corporate Operations Email"}</span>
                  <a href={`mailto:${selectedOrgProfile.email}`} className="font-bold text-[#1c1a17] hover:text-[#bf9b30] flex items-center gap-1">
                    <Mail size={12} />
                    <span>{selectedOrgProfile.email}</span>
                  </a>
                </div>
                {selectedOrgProfile.website && (
                  <div className="flex items-center justify-between text-xs border-t border-[#f2ede8] pt-2.5">
                    <span className="text-[#6e6b66] font-medium">{isRtl ? "الموقع الإلكتروني" : "Official Website"}</span>
                    <a href={selectedOrgProfile.website} target="_blank" rel="noreferrer" className="font-bold text-[#bf9b30] hover:underline flex items-center gap-1">
                      <ExternalLink size={12} />
                      <span>Visit Site</span>
                    </a>
                  </div>
                )}
              </div>

              <ProfileReviewsSection
                targetType="AGENCY"
                targetId={selectedOrgProfile.id}
                currentUser={currentUser}
                isRtl={isRtl}
              />

              {/* Other Listings catalogued by this Enterprise */}
              <div className="space-y-3 pt-3 border-t border-[#e6e2de]">
                <span className="text-[10px] font-bold text-[#1c1a17] uppercase tracking-wider block">
                  {selectedOrgProfile.type === "DEVELOPER"
                    ? (isRtl ? "المشاريع والوحدات العقارية الحالية" : "Active Real Estate Project Inventory")
                    : (isRtl ? "العقارات المدرجة من قبل هذا المكتب" : "Active Agency Portfolio")}
                </span>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {properties.filter(p => p.orgId === selectedOrgProfile.id).length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No other properties catalogued currently.</p>
                  ) : (
                    properties
                      .filter(p => p.orgId === selectedOrgProfile.id)
                      .map(prop => (
                        <div
                          key={prop.id}
                          onClick={() => { setSelectedProperty(prop); setSelectedOrgProfile(null); }}
                          className="p-2 bg-white hover:bg-[#bf9b30]/5 border border-[#e6e2de] hover:border-[#bf9b30]/50 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img src={prop.images[0]} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            <span className="font-medium text-[#1c1a17] truncate">{isRtl ? prop.titleAr : prop.title}</span>
                          </div>
                          <span className="font-bold text-[#bf9b30] flex-shrink-0">{formatPrice(prop.price, isRtl)}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Saved Searches Drawer */}
      {isAlertsOpen && (
        <div className="fixed inset-0 z-[55] overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={() => setIsAlertsOpen(false)} />
          <div className={`fixed inset-y-0 ${isRtl ? "left-0" : "right-0"} pl-10 max-w-full flex`}>
            <div className="w-screen max-w-md bg-[#fcfbfa] border-l border-[#e6e2de] shadow-2xl flex flex-col">
              <div className="p-6 border-b border-[#e6e2de] flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-[#1a1918] flex items-center gap-2">
                  <Bell size={18} className="text-[#bf9b30]" />
                  <span>{isRtl ? "تنبيهاتي وعمليات البحث المحفوظة" : "My Saved Searches & Alerts"}</span>
                </h3>
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  className="p-1 rounded-full border border-[#e6e2de] hover:bg-gray-100 text-[#1a1918] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {savedSearches.length === 0 ? (
                  <div className="text-center py-12 text-[#6e6b66] space-y-2">
                    <Bell size={32} className="mx-auto text-gray-300" />
                    <p className="text-sm font-medium">{isRtl ? "لا توجد عمليات بحث محفوظة" : "No saved searches yet"}</p>
                    <p className="text-xs text-gray-400">{isRtl ? "احفظ بحثك لتلقي تنبيهات بالوحدات الجديدة المطابقة" : "Save active filters to receive updates on matching listings"}</p>
                  </div>
                ) : (
                  savedSearches.map((search) => {
                    const filters = typeof search.filters === 'string' ? JSON.parse(search.filters) : search.filters;
                    return (
                      <div key={search.id} className="p-4 bg-white rounded-xl border border-[#e6e2de] shadow-2xs hover:shadow-xs transition-all space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-[#1c1a17]">{search.name}</h4>
                            <p className="text-[10px] text-gray-400">
                              {new Date(search.createdDate).toLocaleDateString()}
                            </p>
                          </div>
                          {search.newMatchesCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 animate-pulse">
                              {search.newMatchesCount} {isRtl ? "جديد" : "new"}
                            </span>
                          )}
                        </div>

                        {/* Filter criteria list */}
                        <div className="flex flex-wrap gap-1">
                          {filters.selectedMunicipality && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              {isRtl ? "البلدية: " : "Muni: "}
                              {locations.find(l => l.id === filters.selectedMunicipality)?.name || filters.selectedMunicipality}
                            </span>
                          )}
                          {filters.selectedArea && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              {isRtl ? "المنطقة: " : "Area: "}
                              {locations.find(l => l.id === filters.selectedArea)?.name || filters.selectedArea}
                            </span>
                          )}
                          {filters.propType && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              {filters.propType}
                            </span>
                          )}
                          {filters.transType && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              {filters.transType === "FOR_RENT" ? (isRtl ? "إيجار" : "Rent") : (isRtl ? "بيع" : "Sale")}
                            </span>
                          )}
                          {filters.maxPrice && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              &lt; {Number(filters.maxPrice).toLocaleString()} QAR
                            </span>
                          )}
                          {filters.searchQuery && (
                            <span className="px-1.5 py-0.5 bg-[#f5f2ee] rounded text-[10px] text-[#6e6b66]">
                              "{filters.searchQuery}"
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#f2ede8] text-xs">
                          {search.newMatchesCount > 0 ? (
                            <button
                              onClick={() => handleResetSearchCounter(search.id)}
                              className="text-xs text-[#bf9b30] hover:underline font-semibold cursor-pointer"
                            >
                              {isRtl ? "تصفير العداد / مقروء" : "Reset Match Counter"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              {isRtl ? "لا توجد مطابقات جديدة" : "Up to date"}
                            </span>
                          )}

                          <button
                            onClick={() => handleDeleteSavedSearch(search.id)}
                            className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer font-medium"
                          >
                            <Trash size={12} />
                            <span>{isRtl ? "حذف" : "Delete"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Search Confirmation Modal */}
      {isSaveSearchModalOpen && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#fcfbfa] rounded-xl border border-[#e6e2de] w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSaveSearchModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-white hover:bg-gray-100 rounded-full border border-[#e6e2de] text-[#1a1918] cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 space-y-4">
              <h3 className="text-lg font-serif font-bold text-[#1c1a17]">
                {isRtl ? "حفظ كبحث منبه ومطابقة ذكية" : "Save Active Filters as Alert Search"}
              </h3>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-[#6e6b66] uppercase tracking-wider">
                  {isRtl ? "اسم التنبيه المخصص" : "Alert Name"}
                </label>
                <input
                  type="text"
                  value={customSearchName}
                  onChange={(e) => setCustomSearchName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg text-sm focus:outline-none focus:border-[#bf9b30] text-[#1a1918]"
                  placeholder={isRtl ? "أدخل اسماً مخصصاً لهذا البحث" : "Enter a descriptive name"}
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-[#e6e2de] space-y-1.5 text-xs text-[#6e6b66]">
                <p className="font-bold">{isRtl ? "معايير التصفية التي سيتم مراقبتها:" : "Active filters being monitored:"}</p>
                <ul className="list-disc list-inside space-y-0.5 opacity-80 pl-1">
                  {selectedMunicipality && (
                    <li>
                      {isRtl ? "البلدية: " : "Municipality: "}
                      {locations.find(l => l.id === selectedMunicipality)?.name || selectedMunicipality}
                    </li>
                  )}
                  {selectedArea && (
                    <li>
                      {isRtl ? "المنطقة: " : "Area: "}
                      {locations.find(l => l.id === selectedArea)?.name || selectedArea}
                    </li>
                  )}
                  {propType && <li>{isRtl ? "النوع: " : "Type: "} {propType}</li>}
                  {transType && <li>{isRtl ? "المعاملة: " : "Transaction: "} {transType}</li>}
                  {maxPrice && <li>{isRtl ? "السعر الأقصى: " : "Max Price: "} {Number(maxPrice).toLocaleString()} QAR</li>}
                  {searchQuery && <li>{isRtl ? "كلمة البحث: " : "Keyword: "} "{searchQuery}"</li>}
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsSaveSearchModalOpen(false)}
                  className="flex-1 py-2 border border-[#e6e2de] text-[#6e6b66] rounded-lg text-sm hover:bg-[#f2ede8] cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={handleConfirmSaveSearch}
                  className="flex-1 py-2 bg-gradient-to-r from-[#bf9b30] to-[#8c6d1d] text-white font-bold rounded-lg text-sm hover:opacity-90 cursor-pointer"
                >
                  {isRtl ? "حفظ التنبيه" : "Save Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
