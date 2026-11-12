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
  getVerifiedBadgeLabel,
  isAvailabilityConfirmed,
  formatConfirmedDate
} from "../types.js";
import { useCurrency } from "../currencyContext.js";
import { trackEvent, trackPageView } from "../lib/analytics.js";
import { getThumbnailUrl } from "../lib/image.js";
import FeaturedAgencies from "./FeaturedAgencies.js";
import {
  Search,
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Phone,
  MessageCircle,
  Calendar,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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
  GitCompare,
  Bell,
  Trash,
  Award,
  Map,
  List,
  Eye,
  LayoutGrid,
  Tag,
  KeyRound,
  HardHat,
  UserRound,
  Home as HomeIcon,
  Gem,
  LifeBuoy,
  Briefcase,
  Newspaper,
  Handshake,
  Scale
} from "lucide-react";

// Enterprise & Public Sub-Pages
import PhotoHero from "./PhotoHero.js";
import NerouAiMark from "./NerouAiMark.js";
import {
  DirectorySearch,
  PropertyDetailView,
  PropertyCompareView,
  InteractiveMap,
  ProfileReviewsSection,
  MarketPriceIndex,
  AreaGuidesView,
  AreaGuideView,
  ProjectsView,
  HelpCenterView,
  CareersView,
  SupportTicketsView,
  PressView,
  PartnershipsView,
  PlansPricingView,
  AiChat,
  preloadDirectorySearch
} from "./lazyViews.js";
import { STATIC_TAB_PATHS, staticTabForPath, type VisitorTab } from "../routes.js";
import { stripLang, withLang, parseLandingPath, slugify, TYPE_GROUPS } from "../lib/seo.js";
import { homeTitle, listingTitle } from "../lib/pageTitle.js";
import { LandingIntro, LandingFaq } from "./LandingSeoContent.js";
import CardImageSlideshow from "./CardImageSlideshow.js";
import SubscribersShowcase from "./SubscribersShowcase.js";
import LegalText from "./LegalText.js";
import { COMPANY, companyCrLabel } from "../companyInfo.js";

// The page path without the /ar language prefix: /ar/properties/x and /properties/x are the same page.
const appPath = () => stripLang(window.location.pathname).path;

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
  // which legal document is open on the Legal page (null = the first one)
  const [openLegalDoc, setOpenLegalDoc] = useState<string | null>(null);
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
  // Wires up GET /api/properties's existing `verifiedOnly` server-side filter, which had no
  // UI control anywhere in the marketplace despite being fully implemented server-side.
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);

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
  const [currentTab, setCurrentTab] = useState<VisitorTab>("MARKETPLACE");

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

  // Nerou Find AI opens as its own full-screen conversation (AiChat.tsx), from the hero button, the floating button or a link
  const [aiChat, setAiChat] = useState<{ prompt: string } | null>(null);
  const openAiChat = (prompt = "") => setAiChat({ prompt: prompt.trim() });

  // The choices (Buy, Rent, a page link...) sit at the top, but what they change appears below the hero, out
  // of sight. So after a choice the page glides down to the new content and the blocks rise into place one
  // after another, instead of leaving the visitor to wonder whether anything happened.
  const heroRef = React.useRef<HTMLDivElement>(null);
  const chipsRef = React.useRef<HTMLDivElement>(null);
  const STICKY_CLEARANCE = 132; // the 64px header plus the slim bar under it
  // Agents / Agencies / Developers show their list inside the hero: bring the choice row to the top so the list is in view
  const revealDirectory = React.useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = chipsRef.current;
      if (!el) return;
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - STICKY_CLEARANCE + 8), behavior: calm ? "auto" : "smooth" });
    }));
  }, []);
  const revealContent = React.useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const hero = heroRef.current;
      // on a phone the filters fill the screen, so go straight to the results; on a larger screen show the filters too
      const results = window.innerWidth < 768 ? document.querySelector<HTMLElement>("[data-results-anchor]") : null;
      const first = results || (hero?.nextElementSibling as HTMLElement | null);
      if (!hero || !first) return;
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const top = first.getBoundingClientRect().top + window.scrollY - STICKY_CLEARANCE; // keep clear of the header and the slim bar
      window.scrollTo({ top: Math.max(0, top), behavior: calm ? "auto" : "smooth" });
      if (calm) return;
      let block: HTMLElement | null = first;
      for (let i = 0; block && i < 5; i++, block = block.nextElementSibling as HTMLElement | null) {
        if (getComputedStyle(block).position === "fixed") continue;
        block.animate(
          [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "none" }],
          { duration: 560, delay: i * 90, easing: "cubic-bezier(0.22, 0.8, 0.22, 1)", fill: "backwards" }
        );
      }
    }));
  }, []);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  // Area Guide overlay state (see AreaGuideView.tsx / GET /api/areas/:slug) - mutually
  // exclusive with selectedProperty above; both are reconciled into a single /properties/:id
  // vs /areas/:slug vs "/" URL by the combined deep-link effects further down.
  const [selectedAreaGuideSlug, setSelectedAreaGuideSlug] = useState<string | null>(null);
  // "Recently viewed" strip - resolved from the id/timestamp trail PropertyDetailView.tsx
  // writes to localStorage on every property it opens. Re-read whenever the detail overlay
  // closes, so a property just viewed shows up in the strip immediately without a reload.
  const [recentlyViewedProperties, setRecentlyViewedProperties] = useState<Property[]>([]);
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
  // Real listing count + rating summary shown together at the top of the profile modal (the
  // closest thing this app has to a public agent/agency profile "page" - there's no client-side
  // routing anywhere in this app to give it a real shareable URL, so this enriches the existing
  // modal rather than inventing a routing subsystem). Rating/count reuses the same
  // GET /api/reviews/summary endpoint ProfileReviewsSection already calls further down.
  const [profileStatsSummary, setProfileStatsSummary] = useState<{ average: number; count: number } | null>(null);
  useEffect(() => {
    const targetType = selectedAgentProfile ? "AGENT" : selectedOrgProfile ? "AGENCY" : null;
    const targetId = selectedAgentProfile?.id || selectedOrgProfile?.id;
    if (!targetType || !targetId) {
      setProfileStatsSummary(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/reviews/summary?targetType=${targetType}&targetId=${targetId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data) setProfileStatsSummary(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAgentProfile, selectedOrgProfile]);

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

  // Resolve the "recently viewed" id trail (written by PropertyDetailView.tsx) into full
  // property records for the strip below. Re-runs whenever the detail overlay closes (covers
  // "just viewed one" without needing a reload) - a property that's since been unpublished or
  // deleted simply won't come back from the API and is silently skipped rather than shown broken.
  useEffect(() => {
    if (selectedProperty) return;
    let cancelled = false;
    try {
      const raw = localStorage.getItem("nerou_recently_viewed");
      const entries: { id: string; ts: number }[] = raw ? JSON.parse(raw) : [];
      if (entries.length === 0) {
        setRecentlyViewedProperties([]);
        return;
      }
      Promise.all(
        entries.map(e =>
          fetch(`/api/properties/${e.id}`)
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null)
        )
      ).then(results => {
        if (!cancelled) setRecentlyViewedProperties(results.filter((p): p is Property => !!p));
      });
    } catch (e) {
      console.error("Failed to load recently-viewed properties:", e);
    }
    return () => {
      cancelled = true;
    };
  }, [selectedProperty]);

  useEffect(() => {
    fetchProperties();
  }, [selectedMunicipality, selectedArea, propType, transType, minPrice, maxPrice, beds, verifiedOnly, debouncedSearchQuery, locations]);

  useEffect(() => {
    if (selectedProperty) {
      trackPageView(`/properties/${selectedProperty.id}`);
      trackEvent("view_property", "marketplace", selectedProperty.title);
    } else {
      trackPageView("/");
    }
  }, [selectedProperty]);

  // Real, working deep links for property pages. The server already builds the pieces that
  // promise these URLs work - sitemap.xml lists them, robots.txt allows crawling them, and the
  // GET /properties/:id route injects correct per-property Open Graph tags - but nothing on the
  // client ever read the URL back, so a search engine hit or a shared/copied link only ever
  // loaded the generic marketplace instead of the specific property. This closes that gap for
  // properties specifically (agent/agency profile modals remain deliberately un-routed, as
  // noted where profileStatsSummary is set up above - that's a separate, larger scope).
  const deepLinkConsumedRef = React.useRef(false);
  useEffect(() => {
    if (deepLinkConsumedRef.current) return;
    deepLinkConsumedRef.current = true;
    const match = appPath().match(/^\/properties\/([^/]+)\/?$/);
    if (!match) return;
    fetch(`/api/properties/${match[1]}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setSelectedProperty(data);
      })
      .catch(() => {});
  }, []);

  // Same deep-link pattern as above, for /areas/:slug (see AreaGuideView.tsx / GET
  // /api/areas/:slug). Area guide content is static/curated, so - unlike the property fetch
  // above - there's no 404 case worth distinguishing here: AreaGuideView itself renders a
  // "not found" state if the slug doesn't resolve.
  const areaGuideDeepLinkConsumedRef = React.useRef(false);
  useEffect(() => {
    if (areaGuideDeepLinkConsumedRef.current) return;
    areaGuideDeepLinkConsumedRef.current = true;
    const match = appPath().match(/^\/areas\/([^/]+)\/?$/);
    if (match) setSelectedAreaGuideSlug(match[1]);
  }, []);

  // Same deep-link pattern for the static full-page tabs (see STATIC_TAB_PATHS). Without
  // this, a direct hit on /plans-pricing rendered the marketplace and the sync effect below
  // then rewrote the address bar to "/", so the URL couldn't be refreshed or shared.
  const staticTabDeepLinkConsumedRef = React.useRef(false);
  useEffect(() => {
    if (staticTabDeepLinkConsumedRef.current) return;
    staticTabDeepLinkConsumedRef.current = true;
    const tab = staticTabForPath(appPath());
    if (tab) setCurrentTab(tab);
  }, []);

  // An SEO landing page such as /apartments-for-rent-in-lusail (or its /ar/ twin) is the marketplace
  // with that search already applied. The server has already sent the page's own title, text and
  // listings for search engines; this makes the live app show the same search to people.
  const landingPathRef = React.useRef<string | null>(null);
  if (landingPathRef.current === null) {
    landingPathRef.current = parseLandingPath(window.location.pathname) ? appPath() : "";
  }
  const landingConsumedRef = React.useRef(false);
  useEffect(() => {
    if (landingConsumedRef.current || !landingPathRef.current) return;
    const parsed = parseLandingPath(landingPathRef.current);
    if (!parsed) { landingConsumedRef.current = true; return; }
    const { spec } = parsed;
    let areaLoc: LocationItem | undefined;
    if (spec.area) {
      if (locations.length === 0) return; // wait for the location list, then apply
      areaLoc = locations.find(l => l.type !== "COUNTRY" && l.type !== "MUNICIPALITY" && slugify(l.name) === spec.area);
    }
    landingConsumedRef.current = true;
    setTransType(spec.tx === "rent" ? "FOR_RENT" : "FOR_SALE");
    if (spec.type) setPropType(TYPE_GROUPS.find(g => g.slug === spec.type)?.types[0] ?? "");
    if (areaLoc) {
      if (areaLoc.parentId) setSelectedMunicipality(areaLoc.parentId);
      setSelectedArea(areaLoc.id);
    }
  }, [locations]);

  // Keep the address bar in sync with whichever full-page overlay is open (property detail or
  // area guide - mutually exclusive in practice): push a real /properties/:id or /areas/:slug
  // URL while one is open (so the browser's own "copy link" / "share" and the Share button
  // below both grab a working link), and restore "/" when both are closed. Skipped on the very
  // first render after a deep link already put us at the right URL, so opening a shared link
  // doesn't push a redundant duplicate history entry. A single shared ref (rather than one per
  // overlay type) avoids the two ever fighting over the URL or double-pushing the same path.
  const lastSyncedPathRef = React.useRef<string | null>(
    appPath().match(/^\/properties\/[^/]+\/?$/) ||
    appPath().match(/^\/areas\/[^/]+\/?$/) ||
    staticTabForPath(appPath()) ||
    landingPathRef.current
      ? appPath()
      : null
  );
  useEffect(() => {
    // Overlays win over the tab underneath them: opening a listing from /plans-pricing
    // should show /properties/:id, and closing it returns to /plans-pricing rather than "/".
    const targetPath = selectedProperty
      ? `/properties/${selectedProperty.id}`
      : selectedAreaGuideSlug
      ? `/areas/${selectedAreaGuideSlug}`
      : STATIC_TAB_PATHS[currentTab] ?? (landingPathRef.current || "/");
    if (lastSyncedPathRef.current === targetPath) return;
    lastSyncedPathRef.current = targetPath;
    // the Arabic version of the site keeps its /ar prefix as you move around
    const fullPath = withLang(targetPath, isRtl ? "ar" : "en");
    if (window.location.pathname !== fullPath) {
      window.history.pushState(null, "", fullPath);
    }
  }, [selectedProperty, selectedAreaGuideSlug, currentTab, isRtl]);

  // Browser-tab title follows the open listing (the server wrote the right one for the first page
  // load; this covers opening a listing from inside the app).
  const titledPropertyRef = React.useRef(false);
  useEffect(() => {
    if (selectedProperty) {
      document.title = listingTitle(selectedProperty.title, isRtl);
      titledPropertyRef.current = true;
    } else if (titledPropertyRef.current) {
      titledPropertyRef.current = false;
      document.title = homeTitle(isRtl);
    }
  }, [selectedProperty, isRtl]);

  // Back/forward support for the above: e.g. Property A -> Property B -> Back should reopen A,
  // Area Guide X -> Property A -> Back should reopen Area Guide X, and either -> Back from the
  // first overlay should return to the marketplace list, not leave the app stuck.
  useEffect(() => {
    const onPopState = () => {
      const propMatch = appPath().match(/^\/properties\/([^/]+)\/?$/);
      const areaMatch = appPath().match(/^\/areas\/([^/]+)\/?$/);
      if (propMatch) {
        const id = propMatch[1];
        lastSyncedPathRef.current = `/properties/${id}`;
        setSelectedAreaGuideSlug(null);
        const known = properties.find(p => p.id === id);
        if (known) {
          setSelectedProperty(known);
        } else {
          fetch(`/api/properties/${id}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => { if (data) setSelectedProperty(data); })
            .catch(() => {});
        }
      } else if (areaMatch) {
        lastSyncedPathRef.current = `/areas/${areaMatch[1]}`;
        setSelectedProperty(null);
        setSelectedAreaGuideSlug(areaMatch[1]);
      } else {
        // Also restores the static tabs (see STATIC_TAB_PATHS): Back out of a listing opened
        // from /plans-pricing returns to the plans page, not the marketplace.
        const staticTab = staticTabForPath(appPath());
        lastSyncedPathRef.current = staticTab ? appPath() : (landingPathRef.current && appPath() === landingPathRef.current ? appPath() : "/");
        setSelectedProperty(null);
        setSelectedAreaGuideSlug(null);
        setCurrentTab(staticTab ?? "MARKETPLACE");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

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
      if (verifiedOnly) params.append("verifiedOnly", "true");

      const res = await fetch(`/api/properties?${params.toString()}`);
      const data = await res.json();
      // an error reply is an object, not a list: keep the page alive instead of crashing on it
      setProperties(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    // Only ever mutated via .push(), never reassigned.
    const parts: string[] = [];
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
    // Dial the listing's own agent (or agency). This used to be a hard-coded placeholder number
    // for EVERY listing; if the agent has no phone on file we say so instead of ringing a stranger.
    let callNumber = "";
    try {
      const res = await fetch(`/api/properties/${property.id}/agent-info`);
      if (res.ok) callNumber = (await res.json()).callNumber || "";
    } catch (e) {
      console.error("Failed to look up the agent's phone number:", e);
    }
    if (!callNumber) {
      alert(isRtl
        ? "لم يضف هذا الوكيل رقم هاتف لهذا العقار. تواصل معه عبر واتساب أو أرسل استفساراً."
        : "This agent has not listed a phone number. Contact them on WhatsApp or send an inquiry instead.");
      return;
    }
    // Count the click in the background - it must never delay the call.
    fetch("/api/leads", {
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
    })
      .then(() => {
        trackEvent("call_click", "marketplace", property.title);
        onLeadSubmitted();
      })
      .catch(e => console.error(e));
    window.location.href = `tel:+${callNumber}`;
  };

  const isFeatured = (propId: string) => {
    return campaigns.some(c => c.propertyId === propId && c.type === "FEATURED_LISTING" && c.status === "ACTIVE");
  };

  // Sort function
  // Memoized - this used to be a plain function called 3+ times per render (count badge,
  // empty-check, list render), each call re-filtering/re-sorting the full properties array
  // and scanning campaigns via isFeatured() inside the sort comparator.
  const sortedProperties = React.useMemo(() => {
    const list = [...properties];

    if (sortBy === "priceAsc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceDesc") {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === "areaDesc") {
      list.sort((a, b) => b.area - a.area);
    } else if (sortBy === "mostViewed") {
      list.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === "recentlyConfirmed") {
      // Most recently reconfirmed availability first - real signal from the freshness system
      // (falls back to createdDate for listings that never had an explicit confirm action).
      list.sort((a, b) => {
        const aDate = new Date(a.lastConfirmedAvailableDate || a.createdDate).getTime();
        const bDate = new Date(b.lastConfirmedAvailableDate || b.createdDate).getTime();
        return bDate - aDate;
      });
    }

    // Always sort featured listings first
    return list.sort((a, b) => {
      const aFeat = isFeatured(a.id);
      const bFeat = isFeatured(b.id);
      if (aFeat && !bFeat) return -1;
      if (!aFeat && bFeat) return 1;
      return 0;
    });
  }, [properties, sortBy, campaigns]);
  const getSortedProperties = () => sortedProperties;

  // Find municipality choices
  const municipalities = locations.filter(l => l.type === "MUNICIPALITY" && l.isActive);
  // Find area choices belonging to selected municipality
  const filteredAreas = locations.filter(l => l.parentId === selectedMunicipality && l.isActive);

  // Resolved display name for the currently-selected Area/District filter (if any) - passed to
  // MarketPriceIndex so its "selected district" mode matches whatever the visitor has actually
  // filtered to, using the exact same LocationItem lookup fetchProperties() uses above.
  const selectedDistrictName = selectedArea ? locations.find(l => l.id === selectedArea)?.name : undefined;

  const openAreaGuide = (slug: string) => {
    setSelectedProperty(null);
    setSelectedAreaGuideSlug(slug);
  };
  const closeAreaGuide = () => setSelectedAreaGuideSlug(null);

  // "View X listings in {area}" CTA (AreaGuideView.tsx): reuses the exact same Municipality ->
  // Area select-driven filter mechanism a manual user selection would produce, rather than
  // building a parallel filtering path. `districtName` must match a LocationItem.name exactly
  // (see src/data/areaGuides.ts's `district` field doc comment).
  const handleViewListingsInDistrict = (districtName: string) => {
    setSelectedAreaGuideSlug(null);
    setSelectedProperty(null);
    setCurrentTab("MARKETPLACE");
    setSearchMode("PROPERTIES");

    const matchedLocation = locations.find(l => l.name === districtName && (l.type === "AREA" || l.type === "DISTRICT"));
    if (matchedLocation) {
      // A DISTRICT-type location (e.g. a Pearl sub-precinct) sits one level below its AREA,
      // which itself sits under the MUNICIPALITY - the Area/District dropdown's own options are
      // filtered by `parentId === selectedMunicipality`, so a DISTRICT match needs its parent
      // AREA's municipality, not its own immediate parent.
      let municipalityId = matchedLocation.parentId;
      if (matchedLocation.type === "DISTRICT") {
        const parentArea = locations.find(l => l.id === matchedLocation.parentId);
        municipalityId = parentArea?.parentId;
      }
      setSelectedMunicipality(municipalityId || "");
      setSelectedArea(matchedLocation.id);
    } else {
      // Shouldn't happen for a curated guide's district, but fail safe rather than silently
      // no-oping: fall back to a plain keyword search on the district name.
      setSelectedMunicipality("");
      setSelectedArea("");
      setSearchQuery(districtName);
    }
  };

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
    // Says what was verified. A bare "Verified" next to "Availability Unconfirmed" on the
    // same card read as a direct contradiction, which is corrosive on a product whose whole
    // pitch is verification: the two badges describe different things (this listing passed
    // review / its availability hasn't been reconfirmed lately), and the label has to say so.
    // Note this field is the LISTING's verificationStatus, not the agent's - the agent badge
    // is a separate label (see getAgentVerificationLabel in types.ts).
    verified: isRtl ? "قائمة موثّقة" : "Verified listing",
    availabilityConfirmed: isRtl ? "مؤكّد متاح" : "Available",
    availabilityPending: isRtl ? "بانتظار تأكيد التوفّر" : "Awaiting availability check",
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

  // The places a visitor can go from the top of the home page. The hero shows them large; once the visitor has
  // scrolled past the hero a slim bar (below) keeps the same choices within reach.
    const onMarket = currentTab === "MARKETPLACE";
    const navPrimary: { key: string; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; active: boolean; go: () => void }[] = [
      { key: "browse", label: isRtl ? "تصفح" : "Browse", Icon: LayoutGrid, active: onMarket && !propType && !transType,
        go: () => { setCurrentTab("MARKETPLACE"); setPropType(""); setTransType(""); } },
      { key: "buy", label: isRtl ? "شراء" : "Buy", Icon: Tag, active: onMarket && transType === TransactionType.FOR_SALE,
        go: () => { setCurrentTab("MARKETPLACE"); setTransType(TransactionType.FOR_SALE); } },
      { key: "rent", label: isRtl ? "إيجار" : "Rent", Icon: KeyRound, active: onMarket && transType === TransactionType.FOR_RENT,
        go: () => { setCurrentTab("MARKETPLACE"); setTransType(TransactionType.FOR_RENT); } },
      { key: "offplan", label: isRtl ? "على المخطط" : "Off-Plan", Icon: HardHat, active: onMarket && transType === TransactionType.OFF_PLAN,
        go: () => { setCurrentTab("MARKETPLACE"); setTransType(TransactionType.OFF_PLAN); } },
      { key: "projects", label: isRtl ? "المشاريع الكبرى" : "Masterplans", Icon: Map, active: currentTab === "PROJECTS",
        go: () => setCurrentTab("PROJECTS") }
    ];
    const navSecondary: [string, string, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>][] = [
      ["PLANS", isRtl ? "الباقات" : "Plans", Gem],
      ["HELP_CENTER", isRtl ? "مركز المساعدة" : "Help Center", LifeBuoy],
      ["CAREERS", isRtl ? "وظائف" : "Careers", Briefcase],
      ["PRESS", isRtl ? "الصحافة" : "Press", Newspaper],
      ["PARTNERSHIPS", isRtl ? "شركاؤنا" : "Our Partners", Handshake],
      ["LEGAL", isRtl ? "الوثائق القانونية" : "Legal Policies", Scale]
    ];

  const [navMore, setNavMore] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(preloadDirectorySearch, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="space-y-8" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Unified luxury panel: category navigation + AI search share one continuous dark/gold
          surface. Pulled up by the header's height (-mt-24 = -6rem = -64px header + 32px main
          padding) so the photo extends behind the transparent floating header at the top of the
          page; pt-24 on the inner content below compensates so nothing is actually hidden.
          Full-bleed breakout so this dark hero panel spans the true viewport edge-to-edge
          instead of sitting inset inside <main>'s max-w-7xl/px-4 container, which previously
          left the page's light canvas background showing as a gap down both sides. Uses the
          standard left/right + negative-50vw-margin recipe (NOT left + translateX) - for a
          `position: relative` element, CSS resolves `left` in LTR but `right` in RTL when both
          are set (CSS2.1 9.4.3), so both must be present with matching negative margins for
          this to center correctly under both dir="ltr" and dir="rtl" (this component sets
          dir explicitly above). A left+translateX-only version broke specifically in RTL.
          html/body already have overflow-x: hidden (see index.css) so this can't introduce
          horizontal scroll. rounded-xl/border were dropped since a rounded, bordered edge makes
          no sense once it's flush against the browser window edge; the inner content below is
          re-wrapped in the original max-w-7xl container so the foreground (nav/search) still
          lines up with the rest of the page. */}
      <div ref={heroRef} className="bg-chrome shadow-sm relative overflow-hidden -mt-24 w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[clamp(600px,46vw,700px)]">
        <PhotoHero />
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <NerouAiMark size={160} strokeWidth={1.2} />
        </div>

        <div className="relative z-10 pt-32 max-w-7xl mx-auto px-4 md:px-6 flex flex-col min-h-[clamp(600px,46vw,700px)]">
          {/* The navigation lives in the bar fixed under the header (below): the hero keeps the headline, the AI button and the choice row. */}

          {currentTab === "MARKETPLACE" && (
            <div className="mt-auto text-white pt-10 pb-8 md:pb-12">
              {/* Search mode toggle - "Properties" keeps the existing filter/AI search
                  entirely unchanged; the other three switch to a separate agent/agency/
                  developer identity lookup (DirectorySearch.tsx), not a property search. */}
              <div ref={chipsRef} className="max-w-3xl flex flex-wrap gap-2 mb-5" role="tablist">
                {([
                  ["PROPERTIES", isRtl ? "العقارات" : "Properties", HomeIcon],
                  ["AGENT", isRtl ? "الوكلاء" : "Agents", UserRound],
                  ["AGENCY", isRtl ? "المكاتب العقارية" : "Agencies", Building2],
                  ["DEVELOPER", isRtl ? "المطورون" : "Developers", HardHat]
                ] as const).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    role="tab"
                    aria-selected={searchMode === mode}
                    onClick={() => { setSearchMode(mode); if (mode === "PROPERTIES") revealContent(); else revealDirectory(); }}
                    onMouseEnter={preloadDirectorySearch}
                    onFocus={preloadDirectorySearch}
                    onTouchStart={preloadDirectorySearch}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-sm border transition-all duration-200 cursor-pointer active:scale-95 ${isRtl ? "" : "tracking-wide"} ${
                      searchMode === mode
                        ? "nav-pop bg-white text-[#1a1714] border-transparent shadow-[0_4px_14px_rgba(0,0,0,0.38)]"
                        : "bg-black/30 text-white/85 border-white/15 hover:bg-white/15 hover:text-white hover:border-white/30"
                    }`}
                  >
                    <Icon size={14} strokeWidth={searchMode === mode ? 2.4 : 1.9} className={searchMode === mode ? "text-[#1a1714]" : "text-white/75"} />
                    {label}
                  </button>
                ))}
              </div>

              {searchMode !== "PROPERTIES" ? (
                <div key={searchMode} className="max-w-5xl min-h-[22rem] animate-in fade-in duration-300">
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
              <div key="headline" className="max-w-3xl space-y-5 animate-in fade-in duration-300">
                {/* The page's one H1: here on the home page, or in the landing block on a landing page. */}
                {React.createElement(
                  landingPathRef.current ? "h2" : "h1",
                  { className: "text-3xl md:text-5xl font-serif tracking-tight font-medium leading-[1.15] drop-shadow-[0_2px_20px_rgba(0,0,0,0.55)]" },
                  t.aiSubtitle
                )}
                <button
                  type="button"
                  onClick={() => openAiChat()}
                  className="group inline-flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-bold text-[#1a1714] bg-white shadow-[0_8px_28px_rgba(0,0,0,0.38)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.38)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                >
                  <span className="w-8 h-8 -ms-2 rounded-full bg-[#1a1714] text-white flex items-center justify-center transition-transform duration-300 group-hover:scale-105"><NerouAiMark size={17} strokeWidth={2.1} /></span>
                  <span>{t.aiTitle}</span>
                  {isRtl ? <ChevronLeft size={16} strokeWidth={2.6} /> : <ChevronRight size={16} strokeWidth={2.6} />}
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {currentTab === "MARKETPLACE" && searchMode === "PROPERTIES" && (
        <>
          {/* 2. Central Qatar Parent-Child Location & Property Type Filters */}
      {(
        <div className="space-y-3 mb-6">
          <div className="bg-surface p-4 rounded-xl border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">

            {/* Keyword search query */}
            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {isRtl ? "البحث النصي" : "Keyword"}
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-ink-inverse border border-border rounded-lg text-base md:text-sm focus:outline-none focus:border-gold text-ink"
                />
                <Search size={16} className={`absolute ${isRtl ? "right-3" : "left-3"} top-2.5 text-ink-muted`} />
              </div>
            </div>

            {/* Municipality Parent selector */}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {isRtl ? "البلدية" : "Municipality"}
              </label>
              <select
                value={selectedMunicipality}
                onChange={(e) => {
                  setSelectedMunicipality(e.target.value);
                  setSelectedArea(""); // Reset child
                }}
                className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg text-base md:text-sm focus:outline-none focus:border-gold text-ink"
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {isRtl ? "المنطقة / الحي" : "Area / District"}
              </label>
              <select
                value={selectedArea}
                disabled={!selectedMunicipality}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg text-base md:text-sm focus:outline-none focus:border-gold text-ink disabled:opacity-50"
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {isRtl ? "نوع العقار" : "Property Type"}
              </label>
              <select
                value={propType}
                onChange={(e) => setPropType(e.target.value)}
                className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg text-base md:text-sm focus:outline-none focus:border-gold text-ink"
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
              <label className="block text-xs font-medium text-ink-muted mb-1">
                {isRtl ? "المعاملة" : "Transaction"}
              </label>
              <select
                value={transType}
                onChange={(e) => setTransType(e.target.value)}
                className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg text-base md:text-sm focus:outline-none focus:border-gold text-ink"
              >
                <option value="">{isRtl ? "الكل" : "All"}</option>
                <option value={TransactionType.FOR_RENT}>{isRtl ? "للإيجار" : "For Rent"}</option>
                <option value={TransactionType.FOR_SALE}>{isRtl ? "للبيع" : "For Sale"}</option>
                <option value={TransactionType.OFF_PLAN}>{isRtl ? "على المخطط" : "Off-Plan"}</option>
              </select>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-canvas border border-border rounded-lg text-xs font-medium text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="accent-gold w-3.5 h-3.5 cursor-pointer"
              />
              <CheckCircle size={14} className="text-gold" />
              <span>{isRtl ? "العقارات الموثقة فقط" : "Verified Listings Only"}</span>
            </label>
            {currentUser ? (
              <button
                onClick={() => {
                  fetchSavedSearches();
                  setIsAlertsOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-canvas border border-border hover:bg-surface-2 rounded-lg text-xs font-medium text-ink cursor-pointer transition-colors"
              >
                <Bell size={14} className="text-gold" />
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
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-gold to-gold-active hover:opacity-95 text-white rounded-lg text-xs font-medium cursor-pointer transition-opacity"
            >
              <Bookmark size={14} />
              <span>{isRtl ? "حفظ هذا البحث للتنبيهات" : "Save Active Search"}</span>
            </button>
          </div>
        </div>
      )}

      {/* District Market Price Index - compact live pricing context for the current district
          filter (or a top-5-most-active-districts overview when none is selected). Shown
          alongside the filters rather than gated on aiSearchActive, since it's market context
          independent of whichever search mode produced the current results. */}
      <MarketPriceIndex isRtl={isRtl} selectedDistrict={selectedDistrictName} />

      {/* Featured Agencies - real agencies with live listings, same visibility gate as the
          Recently Viewed strip below (plain properties view only). */}
      {searchMode === "PROPERTIES" && (
        <FeaturedAgencies
          isRtl={isRtl}
          onSelectAgency={(agencyId) => {
            const org = organizations.find(o => o.id === agencyId);
            if (org) setSelectedOrgProfile(org);
          }}
        />
      )}

      {/* Recently Viewed strip - localStorage-only, no account needed. Only shown on the plain
          properties list (not mid-AI-search or on the agent/agency/developer directory tabs)
          so it doesn't compete with active search results for attention. */}
      {searchMode === "PROPERTIES" && recentlyViewedProperties.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-serif text-ink font-medium flex items-center gap-2">
            <Clock size={16} className="text-gold" />
            <span>{isRtl ? "شوهدت مؤخراً" : "Recently Viewed"}</span>
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {recentlyViewedProperties.map(rv => (
              <button
                key={rv.id}
                type="button"
                onClick={() => setSelectedProperty(rv)}
                className="flex items-center gap-2.5 shrink-0 w-64 p-2 bg-surface border border-border rounded-lg hover:border-gold transition-colors text-left rtl:text-right cursor-pointer"
              >
                <img
                  src={rv.images && getThumbnailUrl(rv.images[0])}
                  onError={(e) => { if (rv.images?.[0] && e.currentTarget.src !== rv.images[0]) e.currentTarget.src = rv.images[0]; }}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover shrink-0 bg-canvas"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ink truncate">{isRtl ? (rv.titleAr || rv.title) : rv.title}</p>
                  <p className="text-[11px] text-ink-muted truncate">{rv.district}, {rv.city}</p>
                  <p className="text-[11px] font-bold text-gold">{formatPrice(rv.price, isRtl)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* An SEO landing page: its heading and intro above the listings (the FAQ follows them) */}
      {landingPathRef.current && currentTab === "MARKETPLACE" && searchMode === "PROPERTIES" && (
        <LandingIntro path={landingPathRef.current} isRtl={isRtl} />
      )}

      {/* 3. Listings Section Header */}
      <div data-results-anchor className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h3 className="text-xl font-serif text-ink font-medium flex items-center gap-2">
            <span>{t.allProperties}</span>
            <span className="text-sm font-sans text-ink-muted bg-surface-2 px-2 py-0.5 rounded-full font-normal">
              {getSortedProperties().length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Toggle (List vs Map) */}
          <div className="flex bg-surface-2 p-1 rounded-lg border border-border">
            <button
              onClick={() => setViewFormat("LIST")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                viewFormat === "LIST"
                  ? "bg-surface text-gold shadow-xs"
                  : "text-ink-muted hover:text-ink"
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
                  ? "bg-surface text-gold shadow-xs"
                  : "text-ink-muted hover:text-ink"
              }`}
              title={isRtl ? "عرض الخريطة" : "Map View"}
            >
              <Map size={12} />
              <span className="hidden xs:inline">{isRtl ? "خريطة" : "Map"}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <ArrowUpDown size={14} />
            <span>{isRtl ? "ترتيب حسب:" : "Sort:"}</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 bg-surface border border-border rounded-lg text-xs focus:outline-none focus:border-gold text-ink"
          >
            <option value="default">{isRtl ? "الأحدث" : "Latest"}</option>
            <option value="priceAsc">{isRtl ? "السعر (من الأقل)" : "Price (Low to High)"}</option>
            <option value="priceDesc">{isRtl ? "السعر (من الأعلى)" : "Price (High to Low)"}</option>
            <option value="areaDesc">{isRtl ? "المساحة (الأكبر)" : "Area (Largest)"}</option>
            <option value="mostViewed">{isRtl ? "الأكثر مشاهدة" : "Most Viewed"}</option>
            <option value="recentlyConfirmed">{isRtl ? "الأحدث تأكيداً للتوفر" : "Recently Confirmed Available"}</option>
          </select>
        </div>
      </div>

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
        <div className="text-center py-20 bg-surface border border-border rounded-xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#faf6ea] border border-gold/30 flex items-center justify-center">
            <Info size={24} className="text-gold" />
          </div>
          <h4 className="font-serif text-lg text-ink mb-1">{t.noProperties}</h4>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
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
            const feat = isFeatured(property.id);

            return (
              <div
                key={property.id}
                data-listing-card
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
                className={`bg-surface rounded-xl border transition-all duration-300 overflow-hidden group cursor-pointer flex flex-col justify-between hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 ${
                  feat
                    ? "border-gold bg-gold/2 shadow-md hover:border-gold-hover ring-1 ring-gold/20"
                    : "border-border hover:border-gold shadow-sm"
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                    {/* the listing's photos change by themselves; they stop when the card is touched or hovered */}
                    <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500">
                      <CardImageSlideshow images={property.images} alt={property.title} />
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                    <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md text-white shadow-sm ${
                        property.transactionType === TransactionType.FOR_RENT ? "bg-blue-600" :
                        property.transactionType === TransactionType.FOR_SALE ? "bg-green-600" : "bg-gold"
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
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full shadow-md text-[10px] font-bold hover:scale-105 transition-transform cursor-pointer ${
                            comparedPropertyIds.includes(property.id)
                              ? "bg-gold text-gold-ink"
                              : "bg-white text-gray-900"
                          }`}
                          title={isRtl ? "مقارنة العقار" : "Compare Side-by-Side"}
                          aria-label={isRtl ? "مقارنة العقار" : "Compare property"}
                        >
                          <GitCompare size={13} />
                          <span>{isRtl ? "قارن" : "Compare"}</span>
                        </button>

                        <button
                          onClick={(e) => toggleSaveProperty(property.id, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white rounded-full shadow-md text-[10px] font-bold text-gray-900 hover:scale-105 transition-transform cursor-pointer"
                          aria-label={isRtl ? "حفظ العقار" : "Save property"}
                        >
                          <Bookmark
                            size={13}
                            className={savedPropertyIds.includes(property.id) ? "fill-gold text-gold" : "text-gray-900"}
                          />
                          <span>{savedPropertyIds.includes(property.id) ? (isRtl ? "محفوظ" : "Saved") : (isRtl ? "حفظ" : "Save")}</span>
                        </button>
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {property.verificationStatus === VerificationStatus.APPROVED && (
                          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-gray-900 flex items-center gap-1 shadow-xs border border-gold/30">
                            <CheckCircle size={12} className="text-gold" />
                            <span>{t.verified}</span>
                          </div>
                        )}
                        {/* Availability, stated in both directions. Only the negative half was
                            ever shown, so the platform's actual differentiator - that a listing
                            was confirmed still available, and when - was invisible unless you
                            found the "Recently Confirmed Available" sort option. Wording is
                            deliberately non-negating: "Awaiting availability check" describes a
                            step that hasn't happened yet, where "Availability Unconfirmed" read
                            as a verdict against a listing sitting next to a badge calling it
                            verified. */}
                        {isAvailabilityConfirmed(property.lastConfirmedAvailableDate) ? (
                          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-emerald-700 flex items-center gap-1 shadow-xs border border-emerald-300">
                            <CheckCircle size={12} />
                            <span>
                              {t.availabilityConfirmed} · {formatConfirmedDate(property.lastConfirmedAvailableDate, isRtl)}
                            </span>
                          </div>
                        ) : getAvailabilityStaleDays(property.lastConfirmedAvailableDate || property.createdDate) >= AVAILABILITY_UNCONFIRMED_DAYS ? (
                          <div className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 flex items-center gap-1 shadow-xs border border-amber-300">
                            <Clock size={12} />
                            <span>{t.availabilityPending}</span>
                          </div>
                        ) : null}
                      </div>

                      {feat && (
                        <div className="bg-gold text-black px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs border border-white ml-auto">
                          <Award size={12} className="shrink-0" />
                          <span>{isRtl ? "مميز" : "Featured"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                        <MapPin size={12} />
                        <span>{property.district}, {property.city}</span>
                      </div>
                      <h4 className="font-serif text-lg font-medium text-ink line-clamp-1 group-hover:text-gold transition-colors">
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
                            className="text-[10px] text-gold-active font-semibold truncate hover:text-gold hover:underline cursor-pointer text-left rtl:text-right"
                          >
                            {getVerifiedBadgeLabel(listingAgent, organizations.find(o => o.id === listingAgent.orgId)?.name, isRtl)}
                          </button>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-ink-muted border-y border-surface-2 py-2">
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
                      {/* Honest, real view count - sourced from Property.views (the running
                          total maintained by POST /api/properties/:id/view), never fabricated. */}
                      <div className="flex items-center gap-1 ml-auto" title={isRtl ? "عدد المشاهدات" : "View count"}>
                        <Eye size={13} />
                        <span>{property.views || 0}</span>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex items-center justify-between gap-2 border-t border-surface-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-ink-muted block uppercase tracking-wider">
                      {property.transactionType === TransactionType.FOR_RENT ? (isRtl ? "قيمة الإيجار" : "Rent Price") : (isRtl ? "القيمة الإجمالية" : "Total Cost")}
                    </span>
                    <span className="font-serif text-xl font-semibold text-ink">
                      {formatPrice(property.price, isRtl)}
                    </span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleWhatsAppAction(property); }}
                      className="p-2 bg-success-soft hover:bg-success/20 text-success rounded-full transition-colors cursor-pointer"
                      title={t.whatsappCTA}
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCallAction(property); }}
                      className="p-2 bg-gold-soft hover:bg-gold/25 text-gold-active rounded-full transition-colors cursor-pointer"
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

      {landingPathRef.current && currentTab === "MARKETPLACE" && searchMode === "PROPERTIES" && (
        <LandingFaq path={landingPathRef.current} isRtl={isRtl} />
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-chrome border border-gold/30 shadow-2xl rounded-full px-5 py-3 flex items-center gap-4 text-white animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gold text-black font-bold text-xs rounded-full flex items-center justify-center">
              {comparedPropertyIds.length}
            </div>
            <span className="text-xs font-bold font-serif tracking-wider">
              {isRtl ? "عقارات محددة للمقارنة" : "Properties Selected to Compare"}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-1.5 bg-gold hover:bg-gold-hover text-black font-bold text-[10px] uppercase rounded-full transition-colors cursor-pointer"
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

      {/* Area Guide detail overlay - full-page like PropertyDetailView above, but rendered
          unconditionally on currentTab/searchMode so a direct /areas/:slug deep link always
          works regardless of which tab the app happened to mount into. */}
      {selectedAreaGuideSlug && (
        <AreaGuideView
          isRtl={isRtl}
          slug={selectedAreaGuideSlug}
          onClose={closeAreaGuide}
          onViewListings={handleViewListingsInDistrict}
        />
      )}

      {currentTab === "PROJECTS" && <ProjectsView isRtl={isRtl} organizations={organizations} users={users} />}
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
      {currentTab === "PARTNERSHIPS" && (
        <div className="space-y-12">
          {/* Our partners: the companies that subscribed (added by a platform admin). Hidden while there are none. */}
          <SubscribersShowcase
            isRtl={isRtl}
            title={isRtl ? "شركاؤنا" : "Our partners"}
            subtitle={isRtl
              ? "شركات عقارية وشركات وساطة ومطورون اشتركوا في نيرو فايندر وينشرون عقاراتهم عليها."
              : "Real-estate companies, brokerages and developers that subscribed to Nerou Finder and publish their properties here."}
            onOpenCompany={(orgId) => {
              const org = organizations.find(o => o.id === orgId);
              if (org) setSelectedOrgProfile(org);
            }}
          />
          <PartnershipsView isRtl={isRtl} />
        </div>
      )}
      {currentTab === "AREA_GUIDES" && <AreaGuidesView isRtl={isRtl} onSelectGuide={openAreaGuide} />}
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
            <h2 className="text-2xl font-serif text-ink font-medium">
              {isRtl ? "الوثائق القانونية والامتثال الرقابي" : "Legal Documents & Privacy Regulations"}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              {isRtl
                ? "تصفح شروط الاستخدام وسياسة الخصوصية وباقي الوثائق، وفق قانون حماية خصوصية البيانات الشخصية رقم 13 لسنة 2016 بدولة قطر."
                : "Read the Terms of Use, the Privacy Policy and our other policies, in line with Qatar Law No. 13 of 2016 on Personal Data Privacy Protection."}
            </p>
            <p className="text-xs text-ink-muted mt-1.5">
              {isRtl ? "تملك المنصة وتشغّلها " : "Owned and operated by "}
              <span className="font-semibold text-ink">{isRtl ? COMPANY.nameAr : COMPANY.nameEn}</span>
              {" · "}{companyCrLabel(isRtl)}
            </p>
          </div>

          <div className="space-y-4">
            {legalDocs.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">
                {isRtl ? "لا توجد مستندات قانونية منشورة حالياً." : "No certified documents in repository currently."}
              </div>
            ) : (
              legalDocs.map((doc, index) => {
                // the first document (Terms of Use) is open; the others open when clicked. The text stays in the page either way.
                const open = openLegalDoc === null ? index === 0 : openLegalDoc === doc.id;
                return (
                  <div key={doc.id} id={doc.slug} className="bg-surface border border-border rounded-xl text-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenLegalDoc(open ? "" : doc.id)}
                      aria-expanded={open}
                      className="w-full flex justify-between items-start gap-3 p-5 text-start cursor-pointer hover:bg-surface-2 transition-colors"
                    >
                      <span>
                        <span className="block font-serif font-bold text-sm text-ink">{isRtl ? doc.titleAr : doc.title}</span>
                        <span className="text-[10px] text-ink-muted block font-mono mt-1">
                          {isRtl ? "الإصدار: " : "Version: "} {doc.version} • {isRtl ? "آخر تحديث: " : "Last updated: "} {doc.lastUpdated ? doc.lastUpdated.split("T")[0] : doc.effectiveDate}
                        </span>
                      </span>
                      <ChevronDown size={16} className={`shrink-0 mt-1 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    <div hidden={!open} className="px-5 pb-6 border-t border-surface-2 pt-4">
                      <LegalText text={isRtl ? doc.contentAr : doc.content} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. FULLY FUNCTIONAL AGENT PROFILE OVERLAY MODAL */}
      {selectedAgentProfile && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-canvas rounded-xl border border-border w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedAgentProfile(null)}
              className="absolute top-4 right-4 p-1.5 bg-surface hover:bg-surface-2 rounded-full border border-border text-ink cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              {/* Profile card Header */}
              <div className="flex items-start gap-4">
                <img
                  src={selectedAgentProfile.avatarUrl || "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&h=150&q=80"}
                  alt={selectedAgentProfile.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-gold"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-serif font-bold text-ink">{selectedAgentProfile.fullName}</h3>
                  </div>
                  <span className="text-[10px] bg-gold/10 text-gold px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider block w-max">
                    {selectedAgentProfile.role.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-ink-muted">
                    <Building2 size={12} />
                    <span>
                      {selectedAgentProfile.verificationStatus === VerificationStatus.APPROVED
                        ? getVerifiedBadgeLabel(selectedAgentProfile, organizations.find(o => o.id === selectedAgentProfile.orgId)?.name, isRtl)
                        : (organizations.find(o => o.id === selectedAgentProfile.orgId)?.name || (isRtl ? "وكيل مستقل" : "Independent Agent"))}
                    </span>
                  </div>
                </div>
              </div>

              {/* At-a-glance stats: real listing count + rating/review count together, so a
                  visitor doesn't have to scroll to the reviews section below to see them. */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-ink">
                  <Building2 size={13} className="text-gold" />
                  <span>{properties.filter(p => p.agentId === selectedAgentProfile.id).length}</span>
                  <span className="text-ink-muted font-medium">{isRtl ? "عقار نشط" : "active listings"}</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-ink">
                  <Award size={13} className="text-gold" />
                  <span>{profileStatsSummary && profileStatsSummary.count > 0 ? profileStatsSummary.average.toFixed(1) : "—"}</span>
                  <span className="text-ink-muted font-medium">
                    ({profileStatsSummary?.count || 0} {isRtl ? "تقييم" : "reviews"})
                  </span>
                </span>
              </div>

              {/* Contact methods */}
              <div className="bg-surface p-4 rounded-xl border border-border space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted font-medium">{isRtl ? "الهاتف المباشر" : "Direct Telephone"}</span>
                  <a href={`tel:${selectedAgentProfile.phone}`} className="font-bold text-ink hover:text-gold flex items-center gap-1">
                    <Phone size={12} />
                    <span>{selectedAgentProfile.phone}</span>
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-surface-2 pt-2.5">
                  <span className="text-ink-muted font-medium">{isRtl ? "البريد الإلكتروني" : "Direct Email"}</span>
                  <a href={`mailto:${selectedAgentProfile.email}`} className="font-bold text-ink hover:text-gold flex items-center gap-1">
                    <Mail size={12} />
                    <span>{selectedAgentProfile.email}</span>
                  </a>
                </div>
              </div>

              {/* Bio details */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                  {isRtl ? "نبذة تعريفية" : "Professional Profile"}
                </span>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {selectedAgentProfile.bio || "Registered broker partner serving the Qatar real estate market with professional solutions."}
                </p>
              </div>

              {/* Specialties / languages */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                    {isRtl ? "مناطق التخصص" : "Specialties"}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgentProfile.specialties?.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-surface border border-border rounded text-[10px] font-semibold text-ink-muted">
                        {s}
                      </span>
                    )) || <span className="text-[10px] text-gray-400">General Qatar</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                    {isRtl ? "اللغات" : "Languages"}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgentProfile.languages?.map((l, i) => (
                      <span key={i} className="px-2 py-0.5 bg-surface border border-border rounded text-[10px] font-semibold text-ink-muted">
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
              <div className="space-y-3 pt-3 border-t border-border">
                <span className="text-[10px] font-bold text-ink uppercase tracking-wider block">
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
                          className="p-2 bg-surface hover:bg-gold/5 border border-border hover:border-gold/50 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img
                              src={getThumbnailUrl(prop.images[0])}
                              onError={(e) => { if (e.currentTarget.src !== prop.images[0]) e.currentTarget.src = prop.images[0]; }}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                            <span className="font-medium text-ink truncate">{isRtl ? prop.titleAr : prop.title}</span>
                          </div>
                          <span className="font-bold text-gold flex-shrink-0">{formatPrice(prop.price, isRtl)}</span>
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
          <div className="bg-canvas rounded-xl border border-border w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedOrgProfile(null)}
              className="absolute top-4 right-4 p-1.5 bg-surface hover:bg-surface-2 rounded-full border border-border text-ink cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              {/* Profile Card Header */}
              <div className="flex items-start gap-4">
                <img
                  src={selectedOrgProfile.logoUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=150&h=150&q=80"}
                  alt={selectedOrgProfile.name}
                  className="w-16 h-16 rounded-lg object-cover border border-border"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-lg font-serif font-bold text-ink">
                      {isRtl && selectedOrgProfile.nameAr ? selectedOrgProfile.nameAr : selectedOrgProfile.name}
                    </h3>
                    {selectedOrgProfile.verificationStatus === VerificationStatus.APPROVED && (
                      <span className="p-0.5 bg-gold-soft text-gold-active border border-gold/30 rounded-md" title="Accredited Partner">
                        <CheckCircle size={12} className="fill-gold text-white" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] bg-neutral-100 text-neutral-800 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider block w-max">
                    {selectedOrgProfile.type}
                  </span>
                  <div className="text-xs text-gold font-semibold">
                    {
                      // Was a plan-premium/else binary that mislabeled every other plan
                      // (including plan-basic) as "Master Developer SaaS Tier" - covers all
                      // real plan ids now, with a generic fallback for any future/unknown one.
                      {
                        "plan-basic": "Standard SaaS Tier",
                        "plan-premium": "Enterprise SaaS Tier",
                        "plan-developer": "Master Developer SaaS Tier",
                        "plan-trial": "Free Trial Tier"
                      }[selectedOrgProfile.subscriptionPlanId] || "SaaS Tier"
                    }
                  </div>
                </div>
              </div>

              {/* At-a-glance stats: real listing count + rating/review count together. */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-ink">
                  <Building2 size={13} className="text-gold" />
                  <span>{properties.filter(p => p.orgId === selectedOrgProfile.id).length}</span>
                  <span className="text-ink-muted font-medium">{isRtl ? "عقار نشط" : "active listings"}</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-ink">
                  <Award size={13} className="text-gold" />
                  <span>{profileStatsSummary && profileStatsSummary.count > 0 ? profileStatsSummary.average.toFixed(1) : "—"}</span>
                  <span className="text-ink-muted font-medium">
                    ({profileStatsSummary?.count || 0} {isRtl ? "تقييم" : "reviews"})
                  </span>
                </span>
              </div>

              {/* Contact methods */}
              <div className="bg-surface p-4 rounded-xl border border-border space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted font-medium">{isRtl ? "هاتف المكتب الرئيسي" : "Main HQ Telephone"}</span>
                  <a href={`tel:${selectedOrgProfile.phone}`} className="font-bold text-ink hover:text-gold flex items-center gap-1">
                    <Phone size={12} />
                    <span>{selectedOrgProfile.phone}</span>
                  </a>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-surface-2 pt-2.5">
                  <span className="text-ink-muted font-medium">{isRtl ? "البريد الإلكتروني للعمليات" : "Corporate Operations Email"}</span>
                  <a href={`mailto:${selectedOrgProfile.email}`} className="font-bold text-ink hover:text-gold flex items-center gap-1">
                    <Mail size={12} />
                    <span>{selectedOrgProfile.email}</span>
                  </a>
                </div>
                {selectedOrgProfile.website && (
                  <div className="flex items-center justify-between text-xs border-t border-surface-2 pt-2.5">
                    <span className="text-ink-muted font-medium">{isRtl ? "الموقع الإلكتروني" : "Official Website"}</span>
                    <a href={selectedOrgProfile.website} target="_blank" rel="noreferrer" className="font-bold text-gold hover:underline flex items-center gap-1">
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
              <div className="space-y-3 pt-3 border-t border-border">
                <span className="text-[10px] font-bold text-ink uppercase tracking-wider block">
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
                          className="p-2 bg-surface hover:bg-gold/5 border border-border hover:border-gold/50 rounded-lg cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <img
                              src={getThumbnailUrl(prop.images[0])}
                              onError={(e) => { if (e.currentTarget.src !== prop.images[0]) e.currentTarget.src = prop.images[0]; }}
                              alt=""
                              className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                            <span className="font-medium text-ink truncate">{isRtl ? prop.titleAr : prop.title}</span>
                          </div>
                          <span className="font-bold text-gold flex-shrink-0">{formatPrice(prop.price, isRtl)}</span>
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
            <div className="w-screen max-w-md bg-canvas border-l border-border shadow-2xl flex flex-col">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-ink flex items-center gap-2">
                  <Bell size={18} className="text-gold" />
                  <span>{isRtl ? "تنبيهاتي وعمليات البحث المحفوظة" : "My Saved Searches & Alerts"}</span>
                </h3>
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  className="p-1 rounded-full border border-border hover:bg-surface-2 text-ink cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {savedSearches.length === 0 ? (
                  <div className="text-center py-12 text-ink-muted space-y-2">
                    <Bell size={32} className="mx-auto text-gray-300" />
                    <p className="text-sm font-medium">{isRtl ? "لا توجد عمليات بحث محفوظة" : "No saved searches yet"}</p>
                    <p className="text-xs text-gray-400">{isRtl ? "احفظ بحثك لتلقي تنبيهات بالوحدات الجديدة المطابقة" : "Save active filters to receive updates on matching listings"}</p>
                    <button
                      type="button"
                      onClick={() => setIsAlertsOpen(false)}
                      className="mt-2 px-4 py-1.5 bg-gold hover:bg-gold-hover text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      {isRtl ? "تصفح العقارات" : "Browse Properties"}
                    </button>
                  </div>
                ) : (
                  savedSearches.map((search) => {
                    const filters = typeof search.filters === 'string' ? JSON.parse(search.filters) : search.filters;
                    return (
                      <div key={search.id} className="p-4 bg-surface rounded-xl border border-border shadow-2xs hover:shadow-xs transition-all space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-ink">{search.name}</h4>
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
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              {isRtl ? "البلدية: " : "Muni: "}
                              {locations.find(l => l.id === filters.selectedMunicipality)?.name || filters.selectedMunicipality}
                            </span>
                          )}
                          {filters.selectedArea && (
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              {isRtl ? "المنطقة: " : "Area: "}
                              {locations.find(l => l.id === filters.selectedArea)?.name || filters.selectedArea}
                            </span>
                          )}
                          {filters.propType && (
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              {filters.propType}
                            </span>
                          )}
                          {filters.transType && (
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              {filters.transType === "FOR_RENT" ? (isRtl ? "إيجار" : "Rent") : (isRtl ? "بيع" : "Sale")}
                            </span>
                          )}
                          {filters.maxPrice && (
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              &lt; {Number(filters.maxPrice).toLocaleString()} QAR
                            </span>
                          )}
                          {filters.searchQuery && (
                            <span className="px-1.5 py-0.5 bg-surface-2 rounded text-[10px] text-ink-muted">
                              "{filters.searchQuery}"
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-surface-2 text-xs">
                          {search.newMatchesCount > 0 ? (
                            <button
                              onClick={() => handleResetSearchCounter(search.id)}
                              className="text-xs text-gold hover:underline font-semibold cursor-pointer"
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
          <div className="bg-canvas rounded-xl border border-border w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsSaveSearchModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-surface hover:bg-surface-2 rounded-full border border-border text-ink cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="p-6 space-y-4">
              <h3 className="text-lg font-serif font-bold text-ink">
                {isRtl ? "حفظ كبحث منبه ومطابقة ذكية" : "Save Active Filters as Alert Search"}
              </h3>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-ink-muted uppercase tracking-wider">
                  {isRtl ? "اسم التنبيه المخصص" : "Alert Name"}
                </label>
                <input
                  type="text"
                  value={customSearchName}
                  onChange={(e) => setCustomSearchName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-gold text-ink"
                  placeholder={isRtl ? "أدخل اسماً مخصصاً لهذا البحث" : "Enter a descriptive name"}
                />
              </div>

              <div className="bg-surface p-3 rounded-lg border border-border space-y-1.5 text-xs text-ink-muted">
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
                  className="flex-1 py-2 border border-border text-ink-muted rounded-lg text-sm hover:bg-surface-2 cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={handleConfirmSaveSearch}
                  className="flex-1 py-2 bg-gradient-to-r from-gold to-gold-active text-white font-bold rounded-lg text-sm hover:opacity-90 cursor-pointer"
                >
                  {isRtl ? "حفظ التنبيه" : "Save Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Page-level overlays: present on every tab of the public site, not only on the listings */}
      {/* Nerou Find AI: the full-screen assistant. Opening a listing from it closes it; the conversation is kept. */}
      {aiChat && (
        <AiChat
          isRtl={isRtl}
          initialPrompt={aiChat.prompt}
          onClose={() => setAiChat(null)}
          onOpenProperty={(p) => { setAiChat(null); setSelectedProperty(p); }}
        />
      )}

      {/* The site's navigation: always on screen, fixed under the header, on every tab */}
      {(
        <div style={{ marginTop: 0 }} className="fixed top-16 inset-x-0 z-30">
          <div className="bg-[#14110f]/90 backdrop-blur-md border-b border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-2 flex items-center gap-2">
              <nav aria-label={isRtl ? "التنقل السريع" : "Quick navigation"} className="grid grid-cols-6 sm:flex items-center gap-1 flex-1 min-w-0">
                {navPrimary.map(({ key, label, Icon, active, go }) => (
                  <button
                    key={key}
                    onClick={() => { go(); setNavMore(false); revealContent(); }}
                    aria-current={active ? "page" : undefined}
                    className={`group flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[12.5px] leading-tight text-center font-semibold sm:whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                      active ? "bg-white text-[#1a1714]" : "text-white/85 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon size={15} strokeWidth={active ? 2.4 : 1.9} className={active ? "text-[#1a1714]" : "text-white/75 group-hover:text-white"} />
                    <span>{label}</span>
                  </button>
                ))}
                <span className="hidden 2xl:block w-px h-6 bg-white/15 mx-1" aria-hidden="true" />
                {navSecondary.map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => { setCurrentTab(key as typeof currentTab); setNavMore(false); revealContent(); }}
                    aria-current={currentTab === key ? "page" : undefined}
                    className={`hidden 2xl:flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                      currentTab === key ? "bg-white text-[#1a1714]" : "text-white/85 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <Icon size={14} strokeWidth={currentTab === key ? 2.4 : 1.9} className={currentTab === key ? "text-[#1a1714]" : "text-white/75"} />
                    <span>{label}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setCurrentTab("SUPPORT_TICKETS"); setNavMore(false); revealContent(); }}
                  aria-current={currentTab === "SUPPORT_TICKETS" ? "page" : undefined}
                  className={`hidden 2xl:flex ms-auto items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${
                    currentTab === "SUPPORT_TICKETS" ? "bg-white text-[#1a1714]" : "text-white/85 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span>{isRtl ? "تذاكر الدعم" : "My Support Desk"}</span>
                </button>
                <button
                  onClick={() => setNavMore(v => !v)}
                  aria-expanded={navMore}
                  aria-label={isRtl ? "المزيد" : "More"}
                  className={`2xl:hidden group flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 px-1 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[12.5px] leading-tight font-semibold transition-all duration-200 cursor-pointer active:scale-95 ${
                    navMore || navSecondary.some(([k]) => k === currentTab) ? "bg-white/15 text-white" : "text-white/85 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <ChevronDown size={15} className={`transition-transform duration-300 ${navMore ? "rotate-180" : ""}`} />
                  <span>{isRtl ? "المزيد" : "More"}</span>
                </button>
              </nav>
            </div>
            {navMore && (
              <div className="2xl:hidden border-t border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap gap-2">
                  {navSecondary.map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => { setCurrentTab(key as typeof currentTab); setNavMore(false); revealContent(); }}
                      aria-current={currentTab === key ? "page" : undefined}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[12.5px] font-semibold whitespace-nowrap border transition-all duration-200 cursor-pointer active:scale-95 ${
                        currentTab === key ? "bg-white text-[#1a1714] border-transparent" : "bg-white/10 text-white/90 border-white/15 hover:bg-white/20"
                      }`}
                    >
                      <Icon size={14} strokeWidth={1.9} className={currentTab === key ? "text-[#1a1714]" : "text-white/75"} />
                      <span>{label}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => { setCurrentTab("SUPPORT_TICKETS"); setNavMore(false); revealContent(); }}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[12.5px] font-semibold whitespace-nowrap border bg-white/10 text-white/90 border-white/15 hover:bg-white/20 transition-all duration-200 cursor-pointer active:scale-95"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                    <span>{isRtl ? "تذاكر الدعم" : "My Support Desk"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* A floating way into Nerou Find AI from anywhere on the public site */}
      {!aiChat && (
        <button
          type="button"
          onClick={() => openAiChat()}
          aria-label={isRtl ? "اسأل مساعد نيرو الذكي" : "Ask Nerou AI"}
          className="group fixed z-40 bottom-5 end-5 flex items-center gap-2.5 h-14 min-w-14 justify-center sm:ps-4 sm:pe-5 rounded-full text-white bg-[#1a1714] ring-1 ring-[#bf9b30]/55 border border-white/15 shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:ring-[#bf9b30] hover:-translate-y-1 active:translate-y-0 transition-all duration-200 cursor-pointer"
        >
          <span className="relative flex">
            <NerouAiMark size={24} strokeWidth={2.2} className="transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute -top-1 -end-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#bf9b30] opacity-70 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#bf9b30]" />
            </span>
          </span>
          <span className="hidden sm:inline text-sm font-bold whitespace-nowrap">{isRtl ? "اسأل نيرو AI" : "Ask Nerou AI"}</span>
        </button>
      )}
    </div>
  );
}
