/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Suspense, lazy } from "react";
import VisitorExperience from "./components/VisitorExperience.js";
import CinematicSkyline from "./components/CinematicSkyline.js";
import CookieConsent from "./components/CookieConsent.js";
import { trackEvent } from "./lib/analytics.js";
import { User, UserRole, Organization, OrganizationType, VerificationStatus, TransactionType, ApplicationStatus, AgentType, getEffectiveAgentType } from "./types.js";
import { useCurrency, CURRENCIES, CurrencyCode } from "./currencyContext.js";
import {
  Globe,
  UserCheck,
  Eye,
  ShieldCheck,
  Sparkles,
  Building2,
  LogIn,
  LogOut,
  UserPlus,
  LayoutDashboard,
  User as UserIcon,
  X,
  Check,
  ArrowRight,
  Menu
} from "lucide-react";

const AgentWorkspace = lazy(() => import("./components/AgentWorkspace.js"));
const AgencyWorkspace = lazy(() => import("./components/AgencyWorkspace.js"));
const DeveloperWorkspace = lazy(() => import("./components/DeveloperWorkspace.js"));
const ControlCenter = lazy(() => import("./components/ControlCenter.js"));
const OnboardingStatusView = lazy(() => import("./components/OnboardingStatusView.js"));

const DashboardLoader = ({ isRtl }: { isRtl: boolean }) => (
  <div className="text-center py-12 bg-white rounded-xl border border-[#e6e2de]">
    <div className="w-8 h-8 border-2 border-[#bf9b30] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
    <p className="text-sm text-[#6e6b66]">
      {isRtl ? "جاري تحميل لوحة التحكم..." : "Loading workspace environment..."}
    </p>
  </div>
);

export default function App() {
  const [isRtl, setIsRtl] = useState<boolean>(false);
  const { activeCurrency, setActiveCurrency } = useCurrency();
  const [viewMode, setViewMode] = useState<"MARKETPLACE" | "DASHBOARD">("MARKETPLACE");
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("nerou_user");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);

  // Footer navigation requests: the footer lives outside VisitorExperience (which owns the
  // marketplace's internal tab state), so we hand it a one-shot navigation request that
  // VisitorExperience consumes and clears.
  const [visitorNavRequest, setVisitorNavRequest] = useState<{ tab: string; transType?: string } | null>(null);
  const navigateFooter = (tab: string, transType?: string) => {
    setViewMode("MARKETPLACE");
    setVisitorNavRequest({ tab, transType });
  };

  // Authentication Modals states
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [isSignupOpen, setIsSignupOpen] = useState<boolean>(false);

  // Mobile nav drawer state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Transparent header (floats over the marketplace hero photo until the user scrolls past it)
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const heroTransparent = viewMode === "MARKETPLACE" && !isScrolled;

  // Keep the browser tab title in sync with which top-level view is active - previously the
  // whole SPA shared one static <title> from index.html regardless of marketplace vs.
  // dashboard, which showed up wrong in browser history/tab-switching and any share action.
  useEffect(() => {
    const base = "Nerou Finder";
    document.title = viewMode === "DASHBOARD"
      ? (isRtl ? `لوحة التحكم | ${base}` : `Dashboard | ${base}`)
      : (isRtl ? `${base} | السوق العقاري في قطر` : `${base} | Qatar Real Estate Marketplace`);
  }, [viewMode, isRtl]);

  // Form states
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [require2fa, setRequire2fa] = useState<boolean>(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState<string>("");
  const [twoFactorCode, setTwoFactorCode] = useState<string>("");

  // Sign up form states
  const [signupName, setSignupName] = useState<string>("");
  const [signupEmail, setSignupEmail] = useState<string>("");
  const [signupPassword, setSignupPassword] = useState<string>("");
  const [signupPhone, setSignupPhone] = useState<string>("");
  const [signupRole, setSignupRole] = useState<UserRole>(UserRole.AGENT);
  const [signupOrgName, setSignupOrgName] = useState<string>("");
  const [signupOrgType, setSignupOrgType] = useState<OrganizationType>(OrganizationType.AGENCY);
  const [signupSuccess, setSignupSuccess] = useState<boolean>(false);
  const [signupPlanId, setSignupPlanId] = useState<string>("plan-basic");

  // Load invitation token from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      fetch(`/api/invitations/${token}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("Invalid or expired invitation token.");
        })
        .then(data => {
          setSignupEmail(data.invitation.email);
          setSignupRole(UserRole.AGENT);
          sessionStorage.setItem("inviteToken", token);
          setIsSignupOpen(true);
        })
        .catch(err => {
          console.error("Invitation lookup failed:", err);
        });
    }
  }, []);

  // FIX 6: ad-lead attribution - capture ?campaignId= from a campaign's shareable link once
  // on initial load and persist it for the visitor's session, so a lead they eventually
  // submit (potentially after browsing several properties) can be credited to the campaign
  // that brought them in. Cleared from the visible URL so it doesn't linger in the bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campaignId = params.get("campaignId");
    if (campaignId) {
      sessionStorage.setItem("attributionCampaignId", campaignId);
      params.delete("campaignId");
      const newSearch = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
    }
  }, []);

  // Keep state sync notifications
  const [syncCount, setSyncCount] = useState<number>(0);
  const handleDatabaseRefresh = () => {
    setSyncCount(prev => prev + 1);
  };

  useEffect(() => {
    const saved = localStorage.getItem("nerou_user");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved user:", e);
      }
    }
  }, [syncCount]);

  useEffect(() => {
    // Sync direction based on RTL flag
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [isRtl]);

  // Read preset subscription plan from Plans page
  useEffect(() => {
    if (isSignupOpen) {
      const preset = sessionStorage.getItem("presetPlanId");
      if (preset) {
        if (preset === "plan-developer") {
          setSignupRole(UserRole.DEVELOPER_ADMIN);
          setSignupOrgType(OrganizationType.DEVELOPER);
        } else {
          setSignupRole(UserRole.AGENCY_ADMIN);
          setSignupOrgType(OrganizationType.AGENCY);
        }
        setSignupPlanId(preset);
      } else {
        setSignupPlanId("plan-basic");
      }
    }
  }, [isSignupOpen]);

  // Fetch Organization whenever currentUser changes
  useEffect(() => {
    if (currentUser?.orgId) {
      fetch("/api/organizations")
        .then(res => res.json())
        .then((orgs: Organization[]) => {
          const matched = orgs.find(o => o.id === currentUser.orgId);
          if (matched) {
            setCurrentOrg(matched);
          }
        })
        .catch(err => console.error("Error fetching user organization:", err));
    } else {
      setCurrentOrg(null);
    }
  }, [currentUser]);

  // Save/clean user session in localStorage
  const handleSetUser = (user: User | null, token?: string) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem("nerou_user", JSON.stringify(user));
      if (token) {
        localStorage.setItem("token", token);
      }
      setViewMode("DASHBOARD");
    } else {
      localStorage.removeItem("nerou_user");
      localStorage.removeItem("token");
      setViewMode("MARKETPLACE");
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      if (require2fa) {
        const res = await fetch("/api/auth/login-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: twoFactorUserId, code: twoFactorCode })
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || "Failed to verify 2FA code.");
        } else {
          handleSetUser(data.user, data.token);
          setIsLoginOpen(false);
          setLoginEmail("");
          setLoginPassword("");
          setRequire2fa(false);
          setTwoFactorUserId("");
          setTwoFactorCode("");
        }
      } else {
        if (!loginEmail) return;
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail, password: loginPassword })
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || "Failed to log in.");
        } else if (data.require2fa) {
          setRequire2fa(true);
          setTwoFactorUserId(data.userId);
        } else {
          handleSetUser(data.user, data.token);
          setIsLoginOpen(false);
          setLoginEmail("");
          setLoginPassword("");
        }
      }
    } catch (err) {
      setAuthError("Failed to connect to authentication services.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupName || !signupPassword) return;
    setAuthLoading(true);
    setAuthError("");
    try {
      const inviteToken = sessionStorage.getItem("inviteToken") || undefined;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          password: signupPassword,
          fullName: signupName,
          phone: signupPhone,
          role: signupRole,
          orgName: signupOrgName,
          orgType: signupOrgType,
          selectedPlanId: signupPlanId,
          inviteToken
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Failed to sign up.");
      } else {
        sessionStorage.removeItem("presetPlanId");
        sessionStorage.removeItem("inviteToken");
        setSignupSuccess(true);
        trackEvent("subscription_plan_requested", "saas", signupPlanId);
        setTimeout(() => {
          handleSetUser(data.user, data.token);
          setIsSignupOpen(false);
          setSignupSuccess(false);
          setSignupName("");
          setSignupEmail("");
          setSignupPassword("");
          setSignupPhone("");
          setSignupOrgName("");
        }, 1500);
      }
    } catch (err) {
      setAuthError("Failed to register new account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    handleSetUser(null);
  };

  // Determine which workspace interface to render based on user role
  const renderDashboard = () => {
    if (!currentUser) return null;

    // FIX3: onboarding approval-gate. Only AGENCY_ADMIN/DEVELOPER_ADMIN and INDEPENDENT_AGENT
    // signups are gated by applicationStatus - AGENCY_AGENT is ACTIVE from signup and governed
    // instead by their agency's live subscription (see AgentWorkspace's own banner for that).
    // CRITICAL: undefined applicationStatus always means grandfathered/active - never gate on it.
    const isGatedRole =
      currentUser.role === UserRole.AGENCY_ADMIN ||
      currentUser.role === UserRole.DEVELOPER_ADMIN ||
      (currentUser.role === UserRole.AGENT && getEffectiveAgentType(currentUser) === AgentType.INDEPENDENT_AGENT);
    const isGated = !!currentUser.applicationStatus && currentUser.applicationStatus !== ApplicationStatus.ACTIVE && isGatedRole;

    if (isGated) {
      return (
        <OnboardingStatusView
          user={currentUser}
          org={currentOrg}
          isRtl={isRtl}
        />
      );
    }

    switch (currentUser.role) {
      case UserRole.AGENT:
        return (
          <AgentWorkspace
            agent={currentUser}
            onRefreshAll={handleDatabaseRefresh}
            isRtl={isRtl}
          />
        );
      case UserRole.AGENCY_ADMIN:
        return currentOrg ? (
          <AgencyWorkspace
            agency={currentOrg}
            onRefreshAll={handleDatabaseRefresh}
            isRtl={isRtl}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-[#e6e2de]">
            <div className="w-8 h-8 border-2 border-[#bf9b30] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-[#6e6b66]">
              {isRtl ? "جاري تحميل بيانات المكتب..." : "Loading organization environment..."}
            </p>
          </div>
        );
      case UserRole.DEVELOPER_ADMIN:
        return currentOrg ? (
          <DeveloperWorkspace
            developer={currentOrg}
            onRefreshAll={handleDatabaseRefresh}
            isRtl={isRtl}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-[#e6e2de]">
            <div className="w-8 h-8 border-2 border-[#bf9b30] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-[#6e6b66]">
              {isRtl ? "جاري تحميل بيانات المطور..." : "Loading developer enterprise portal..."}
            </p>
          </div>
        );
      case UserRole.PLATFORM_ADMIN:
      case UserRole.SUPER_ADMIN:
        return (
          <ControlCenter
            onRefreshAll={handleDatabaseRefresh}
            isRtl={isRtl}
            currentUser={currentUser}
          />
        );
      default:
        return (
          <div className="text-center py-12 bg-white rounded-xl border border-[#e6e2de] max-w-md mx-auto space-y-4">
            <ShieldCheck size={48} className="mx-auto text-amber-500" />
            <h4 className="text-lg font-bold font-serif">
              {isRtl ? "حساب قيد الانتظار" : "Awaiting Verification"}
            </h4>
            <p className="text-xs text-[#6e6b66] leading-relaxed px-4">
              {isRtl
                ? "شكراً لتسجيلك! حسابك كمستخدم عادي أو شريك قيد المراجعة حالياً من قبل مدراء المنصة. ستتمكن من تصفح لوحة التحكم فور اعتماد ملفك."
                : "Thank you for registering. Your profile is currently being audited by the platform administrator. Once approved, your custom partner suite will be unlocked."}
            </p>
            <button
              onClick={() => setViewMode("MARKETPLACE")}
              className="px-4 py-2 bg-[#1c1a17] text-white text-xs font-bold rounded-lg uppercase tracking-wide hover:bg-[#33302a]"
            >
              {isRtl ? "العودة إلى المعرض" : "Back to Public Marketplace"}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#1a1918] font-sans flex flex-col justify-between">
      
      {/* Main Header: floats transparently over the marketplace hero photo at the top of the
          page, then transitions to its normal solid appearance once the user scrolls past it. */}
      <header
        className={`sticky top-0 z-40 transition-colors duration-300 backdrop-blur-sm ${
          heroTransparent
            ? "border-b border-transparent shadow-none"
            : "border-b border-[#e6e2de] shadow-[0_1px_0_0_rgba(191,155,48,0.18)]"
        }`}
        style={{ backgroundColor: heroTransparent ? "transparent" : "rgba(255,255,255,0.95)" }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">

          {/* Brand Logo + AI badge */}
          <div className="flex items-center gap-3">
            <div
              dir="ltr"
              className="flex items-center gap-2 select-none cursor-pointer"
              onClick={() => setViewMode("MARKETPLACE")}
            >
              <span className={`font-serif text-lg tracking-[0.2em] font-semibold transition-colors duration-300 ${heroTransparent ? "text-white" : "text-[#1a1918]"}`}>NEROU</span>
              <span className="font-serif text-lg tracking-wider text-[#bf9b30] font-bold">FINDER</span>
            </div>
            <div
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide transition-colors duration-300 ${
                heroTransparent
                  ? "bg-white/10 backdrop-blur-sm border border-white/30 text-white"
                  : "bg-gradient-to-r from-[#fdfcfb] to-[#f8f2e0] border border-[#bf9b30]/40 text-[#8c6d1d]"
              }`}
            >
              <Sparkles size={11} className="text-[#bf9b30] animate-pulse" />
              <span>{isRtl ? "الذكاء الاصطناعي نشط" : "AI-Powered Search"}</span>
            </div>
          </div>

          {/* Nav Controls (desktop) */}
          <div className="hidden md:flex items-center gap-2 md:gap-4">

            {/* View switcher for logged in users */}
            {currentUser && (
              <div className="flex items-center bg-[#fdfcfb] border border-[#e6e2de] rounded-lg p-0.5 shadow-xs">
                <button
                  onClick={() => setViewMode("MARKETPLACE")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "MARKETPLACE"
                      ? "bg-white text-[#1a1918] shadow-xs border border-[#e6e2de]"
                      : "text-[#6e6b66] hover:text-[#1a1918]"
                  }`}
                >
                  <Eye size={13} />
                  <span>{isRtl ? "المعرض" : "Marketplace"}</span>
                </button>
                <button
                  onClick={() => setViewMode("DASHBOARD")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === "DASHBOARD"
                      ? "bg-[#1c1a17] text-[#bf9b30] shadow-xs"
                      : "text-[#6e6b66] hover:text-[#1a1918]"
                  }`}
                >
                  <LayoutDashboard size={13} />
                  <span>{isRtl ? "لوحة التحكم" : "Dashboard"}</span>
                </button>
              </div>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setIsRtl(!isRtl)}
              className="p-2 bg-[#fdfcfb] border border-[#e6e2de] hover:bg-[#f2ede8] rounded-lg transition-colors cursor-pointer text-[#1c1a17] flex items-center gap-1.5 text-xs font-bold"
              title={isRtl ? "Switch to English" : "تحويل إلى العربية"}
            >
              <Globe size={14} />
              <span>{isRtl ? "English" : "العربية"}</span>
            </button>

            {/* Currency Selector */}
            <div className="flex items-center bg-[#fdfcfb] border border-[#e6e2de] rounded-lg p-0.5 shadow-xs">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const config = CURRENCIES[code];
                const active = activeCurrency === code;
                return (
                  <button
                    key={code}
                    onClick={() => setActiveCurrency(code)}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-[#1c1a17] text-[#bf9b30] shadow-xs"
                        : "text-[#6e6b66] hover:text-[#1a1918]"
                    }`}
                  >
                    {isRtl ? config.symbolAr : config.code}
                  </button>
                );
              })}
            </div>

            {/* Auth Buttons */}
            {!currentUser ? (
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => setIsLoginOpen(true)}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                    heroTransparent
                      ? "border border-white/40 hover:bg-white/10 text-white"
                      : "border border-[#e6e2de] hover:bg-[#f2ede8] text-[#1a1918]"
                  }`}
                >
                  <LogIn size={14} />
                  <span className="hidden sm:inline">{isRtl ? "تسجيل دخول" : "Log In"}</span>
                </button>
                <button
                  onClick={() => setIsSignupOpen(true)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-[#1c1a17] hover:bg-[#33302a] text-white rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span className="hidden sm:inline">{isRtl ? "شريك جديد" : "Sign Up"}</span>
                </button>
              </div>
            ) : (
              <div className={`flex items-center gap-3 border-l pl-3 transition-colors duration-300 ${heroTransparent ? "border-white/30" : "border-[#e6e2de]"}`}>
                <div className="hidden md:flex flex-col text-right leading-tight">
                  <span className={`text-xs font-bold transition-colors duration-300 ${heroTransparent ? "text-white" : "text-[#1c1a17]"}`}>{currentUser.fullName}</span>
                  <span className="text-[10px] font-semibold text-[#bf9b30] uppercase tracking-wider">
                    {currentUser.role.replace("_", " ")}
                  </span>
                </div>
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-8 h-8 rounded-full object-cover border border-[#bf9b30]"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-[#bf9b30] bg-[#bf9b30] text-black font-bold text-xs flex items-center justify-center">
                    {currentUser.fullName.charAt(0)}
                  </div>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                  title={isRtl ? "تسجيل الخروج" : "Log Out"}
                >
                  <LogOut size={15} />
                </button>
              </div>
            )}

          </div>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            className="md:hidden p-2.5 -mr-1 rtl:mr-0 rtl:-ml-1 bg-[#fdfcfb] border border-[#e6e2de] hover:bg-[#f2ede8] rounded-lg text-[#1c1a17] cursor-pointer transition-colors"
            aria-label={isRtl ? "فتح القائمة" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

        </div>

        {/* Mobile Nav Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-[#e6e2de] bg-white px-4 py-4 space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto">

            {/* View switcher for logged in users */}
            {currentUser && (
              <div className="flex items-center bg-[#fdfcfb] border border-[#e6e2de] rounded-lg p-1 shadow-xs">
                <button
                  onClick={() => { setViewMode("MARKETPLACE"); setIsMobileMenuOpen(false); }}
                  className={`flex-1 px-3 py-2.5 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    viewMode === "MARKETPLACE"
                      ? "bg-white text-[#1a1918] shadow-xs border border-[#e6e2de]"
                      : "text-[#6e6b66] hover:text-[#1a1918]"
                  }`}
                >
                  <Eye size={15} />
                  <span>{isRtl ? "المعرض" : "Marketplace"}</span>
                </button>
                <button
                  onClick={() => { setViewMode("DASHBOARD"); setIsMobileMenuOpen(false); }}
                  className={`flex-1 px-3 py-2.5 rounded-md text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    viewMode === "DASHBOARD"
                      ? "bg-[#1c1a17] text-[#bf9b30] shadow-xs"
                      : "text-[#6e6b66] hover:text-[#1a1918]"
                  }`}
                >
                  <LayoutDashboard size={15} />
                  <span>{isRtl ? "لوحة التحكم" : "Dashboard"}</span>
                </button>
              </div>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setIsRtl(!isRtl)}
              className="w-full p-3 bg-[#fdfcfb] border border-[#e6e2de] hover:bg-[#f2ede8] rounded-lg transition-colors cursor-pointer text-[#1c1a17] flex items-center justify-center gap-2 text-sm font-bold"
            >
              <Globe size={16} />
              <span>{isRtl ? "English" : "العربية"}</span>
            </button>

            {/* Currency Selector */}
            <div className="flex items-center bg-[#fdfcfb] border border-[#e6e2de] rounded-lg p-1 shadow-xs">
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
                const config = CURRENCIES[code];
                const active = activeCurrency === code;
                return (
                  <button
                    key={code}
                    onClick={() => setActiveCurrency(code)}
                    className={`flex-1 px-2 py-2.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-[#1c1a17] text-[#bf9b30] shadow-xs"
                        : "text-[#6e6b66] hover:text-[#1a1918]"
                    }`}
                  >
                    {isRtl ? config.symbolAr : config.code}
                  </button>
                );
              })}
            </div>

            {/* Auth Buttons / User info */}
            {!currentUser ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setIsLoginOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm font-bold border border-[#e6e2de] hover:bg-[#f2ede8] rounded-lg text-[#1a1918] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogIn size={16} />
                  <span>{isRtl ? "تسجيل دخول" : "Log In"}</span>
                </button>
                <button
                  onClick={() => { setIsSignupOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full px-3 py-3 text-sm font-bold bg-[#1c1a17] hover:bg-[#33302a] text-white rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <UserPlus size={16} />
                  <span>{isRtl ? "شريك جديد" : "Sign Up"}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 border-t border-[#e6e2de] pt-4">
                <div className="flex items-center gap-3 min-w-0">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-9 h-9 rounded-full object-cover border border-[#bf9b30] shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full border border-[#bf9b30] bg-[#bf9b30] text-black font-bold text-sm flex items-center justify-center shrink-0">
                      {currentUser.fullName.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col text-left rtl:text-right leading-tight min-w-0">
                    <span className="text-sm font-bold text-[#1c1a17] truncate">{currentUser.fullName}</span>
                    <span className="text-[10px] font-semibold text-[#bf9b30] uppercase tracking-wider truncate">
                      {currentUser.role.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                  className="p-3 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                  title={isRtl ? "تسجيل الخروج" : "Log Out"}
                >
                  <LogOut size={18} />
                </button>
              </div>
            )}

          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-8">
        {viewMode === "MARKETPLACE" ? (
          <VisitorExperience
            isRtl={isRtl}
            onLeadSubmitted={handleDatabaseRefresh}
            currentUser={currentUser}
            onLoginTrigger={() => setIsLoginOpen(true)}
            onSignupTrigger={() => setIsSignupOpen(true)}
            externalNavigation={visitorNavRequest}
            onExternalNavigationHandled={() => setVisitorNavRequest(null)}
          />
        ) : (
          <Suspense fallback={<DashboardLoader isRtl={isRtl} />}>
            {renderDashboard()}
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1c1a17] text-gray-300 mt-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1 space-y-3">
            <div dir="ltr" className="flex items-center gap-2">
              <span className="font-serif text-lg tracking-[0.2em] text-white font-semibold">NEROU</span>
              <span className="font-serif text-lg tracking-wider text-[#bf9b30] font-bold">FINDER</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              {isRtl
                ? "منصة اكتشاف العقارات الفاخرة الأولى في قطر، مدعومة بالذكاء الاصطناعي."
                : "Qatar's premier AI-powered luxury real estate discovery platform."}
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#bf9b30]">
              {isRtl ? "استكشف" : "Explore"}
            </h5>
            <div className="flex flex-col gap-2 text-xs">
              <button onClick={() => navigateFooter("MARKETPLACE", TransactionType.FOR_SALE)} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "شراء" : "Buy"}
              </button>
              <button onClick={() => navigateFooter("MARKETPLACE", TransactionType.FOR_RENT)} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "إيجار" : "Rent"}
              </button>
              <button onClick={() => navigateFooter("MARKETPLACE", TransactionType.OFF_PLAN)} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "على المخطط" : "Off-Plan"}
              </button>
              <button onClick={() => navigateFooter("PROJECTS")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "المشاريع الكبرى" : "Masterplans"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#bf9b30]">
              {isRtl ? "الشركة" : "Company"}
            </h5>
            <div className="flex flex-col gap-2 text-xs">
              <button onClick={() => navigateFooter("CAREERS")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "وظائف" : "Careers"}
              </button>
              <button onClick={() => navigateFooter("PRESS")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "الصحافة" : "Press"}
              </button>
              <button onClick={() => navigateFooter("PARTNERSHIPS")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "شراكات" : "Partnerships"}
              </button>
              <button onClick={() => navigateFooter("LEGAL")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "الوثائق القانونية" : "Legal Policies"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-[#bf9b30]">
              {isRtl ? "الدعم" : "Support"}
            </h5>
            <div className="flex flex-col gap-2 text-xs">
              <button onClick={() => navigateFooter("HELP_CENTER")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "مركز المساعدة" : "Help Center"}
              </button>
              <button onClick={() => navigateFooter("SUPPORT_TICKETS")} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "تذاكر الدعم" : "Support Desk"}
              </button>
              <button onClick={() => setIsSignupOpen(true)} className="text-left text-gray-400 hover:text-white transition-colors cursor-pointer">
                {isRtl ? "انضم كشريك" : "Become a Partner"}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-gray-500">
            <p>© 2026 Nerou Finder. {isRtl ? "جميع الحقوق محفوظة." : "All rights reserved."} Powered by Nerou Technology Services.</p>
            <p>{isRtl ? "الدوحة، لوسيل، اللؤلؤة قطر، الخليج الغربي" : "Doha • Lusail • Pearl Qatar • West Bay"}</p>
          </div>
        </div>
      </footer>

      {/* 1. LOGIN MODAL DIALOG */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-[#e6e2de] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">

            <button
              onClick={() => { setIsLoginOpen(false); setAuthError(""); }}
              className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 transition-colors cursor-pointer z-10"
            >
              <X size={15} />
            </button>

            <div className="bg-[#1c1a17] relative overflow-hidden text-center py-8 px-6 space-y-1.5">
              <CinematicSkyline />
              <div className="relative z-10">
                <span className="font-serif text-xl tracking-[0.2em] font-semibold text-white">NEROU</span>
                <span className="font-serif text-xl tracking-wider font-bold text-[#bf9b30] ml-1.5">FINDER</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#bf9b30] mt-1">
                  {isRtl ? "بوابة الشركاء" : "Partner Portal"}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {isRtl ? "سجل دخولك لإدارة محفظتك العقارية والعملاء" : "Access your active agency inventory, leads & workspace"}
                </p>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">

              {/* Error Box */}
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                  {authError}
                </div>
              )}

              {/* Real Input form */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {require2fa ? (
                  <div>
                    <label className="block text-[10px] font-bold text-[#bf9b30] uppercase mb-1 tracking-wider">
                      {isRtl ? "رمز التحقق الثنائي (2FA)" : "Two-Factor Verification Code"}
                    </label>
                    <p className="text-[11px] text-[#6e6b66] mb-2">
                      {isRtl 
                        ? "الرجاء إدخال الرمز المكون من 6 أرقام من تطبيق المصادقة الخاص بك."
                        : "Enter the 6-digit verification code from your authenticator application."}
                    </p>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 123456"
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-[#bf9b30] focus:outline-none rounded-lg text-center text-lg font-bold tracking-widest text-[#1a1918]"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                        {isRtl ? "البريد الإلكتروني" : "Email Address"}
                      </label>
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full px-3.5 py-2.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                        {isRtl ? "كلمة المرور" : "Password"}
                      </label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-sm"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-[#1c1a17] hover:bg-[#33302a] disabled:bg-[#a8a4a0] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {authLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <LogIn size={14} />
                      <span>{require2fa ? (isRtl ? "تأكيد وتسجيل الدخول" : "Verify & Log In") : (isRtl ? "دخول البوابة" : "Secure Log In")}</span>
                    </>
                  )}
                </button>
              </form>

              <div className="text-center">
                <button
                  onClick={() => { setIsLoginOpen(false); setIsSignupOpen(true); }}
                  className="text-xs text-[#bf9b30] hover:underline cursor-pointer"
                >
                  {isRtl ? "ليس لديك حساب شريك؟ أنشئ حسابك الآن" : "Don't have a partner account? Create one"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 2. SIGNUP/REGISTRATION MODAL DIALOG */}
      {isSignupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-[#e6e2de] w-full max-w-lg my-8 overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">

            <button
              onClick={() => { setIsSignupOpen(false); setAuthError(""); }}
              className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 transition-colors cursor-pointer z-10"
            >
              <X size={15} />
            </button>

            <div className="bg-[#1c1a17] relative overflow-hidden text-center py-8 px-6 space-y-1.5">
              <CinematicSkyline />
              <div className="relative z-10">
                <span className="font-serif text-xl tracking-[0.2em] font-semibold text-white">NEROU</span>
                <span className="font-serif text-xl tracking-wider font-bold text-[#bf9b30] ml-1.5">FINDER</span>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#bf9b30] mt-1">
                  {isRtl ? "تسجيل الشركاء" : "Partner Registration"}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {isRtl ? "انضم لأكبر منظومة عقارية متطورة في قطر والشرق الأوسط" : "Register and launch your agency or developer SaaS channel"}
                </p>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto">

              {signupSuccess ? (
                <div className="p-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                    <Check size={24} />
                  </div>
                  <h4 className="text-base font-bold text-emerald-800">
                    {isRtl ? "تم تسجيل الحساب بنجاح!" : "Account Registered Successfully!"}
                  </h4>
                  <p className="text-xs text-[#6e6b66]">
                    {isRtl ? "جاري تهيئة لوحة التحكم السحابية المخصصة لك..." : "Provisioning your custom SaaS environment..."}
                  </p>
                </div>
              ) : (
                <>
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
                      {authError}
                    </div>
                  )}

                  <form onSubmit={handleSignupSubmit} className="space-y-4">
                    
                    {/* Role selector */}
                    <div>
                      <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1.5">
                        {isRtl ? "نوع الشراكة / حساب المستفيد" : "Select Partner Account Type"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSignupRole(UserRole.AGENT)}
                          className={`p-2.5 border rounded-lg text-xs font-bold transition-all ${
                            signupRole === UserRole.AGENT
                              ? "border-[#bf9b30] bg-[#bf9b30]/10 text-[#1a1918]"
                              : "border-[#e6e2de] bg-white text-[#6e6b66] hover:border-[#bf9b30]"
                          }`}
                        >
                          {isRtl ? "وسيط عقاري مستقل" : "Independent Broker / Agent"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignupRole(UserRole.AGENCY_ADMIN)}
                          className={`p-2.5 border rounded-lg text-xs font-bold transition-all ${
                            signupRole === UserRole.AGENCY_ADMIN
                              ? "border-[#bf9b30] bg-[#bf9b30]/10 text-[#1a1918]"
                              : "border-[#e6e2de] bg-white text-[#6e6b66] hover:border-[#bf9b30]"
                          }`}
                        >
                          {isRtl ? "مدير شركة تسويق عقاري" : "Agency Office Admin"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignupRole(UserRole.DEVELOPER_ADMIN)}
                          className={`p-2.5 border rounded-lg text-xs font-bold transition-all col-span-2 ${
                            signupRole === UserRole.DEVELOPER_ADMIN
                              ? "border-[#bf9b30] bg-[#bf9b30]/10 text-[#1a1918]"
                              : "border-[#e6e2de] bg-white text-[#6e6b66] hover:border-[#bf9b30]"
                          }`}
                        >
                          {isRtl ? "مطور عقاري / مالك مشاريع" : "Property Developer (Project Hub)"}
                        </button>
                      </div>
                    </div>

                    {/* Conditional Organization Name input */}
                    {(signupRole === UserRole.AGENCY_ADMIN || signupRole === UserRole.DEVELOPER_ADMIN) && (
                      <div className="p-3 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg space-y-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#bf9b30] uppercase">
                          <Building2 size={12} />
                          <span>
                            {signupRole === UserRole.DEVELOPER_ADMIN
                              ? (isRtl ? "بيانات المطور" : "Developer Details")
                              : (isRtl ? "بيانات المكتب العقاري" : "Agency Details")}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">
                            {isRtl ? "اسم الشركة العقارية / المطور" : "Registered Enterprise Name"} *
                          </label>
                          <input
                            type="text"
                            required
                            value={signupOrgName}
                            onChange={(e) => setSignupOrgName(e.target.value)}
                            placeholder={signupRole === UserRole.DEVELOPER_ADMIN ? "e.g. Doha Sands Developers" : "e.g. Pearl Gates Real Estate"}
                            className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-base md:text-xs focus:outline-none focus:border-[#bf9b30]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Standard details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                          {isRtl ? "الاسم الكامل" : "Full Name"} *
                        </label>
                        <input
                          type="text"
                          required
                          value={signupName}
                          onChange={(e) => setSignupName(e.target.value)}
                          placeholder="Nasser Jassim"
                          className="w-full px-3 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                          {isRtl ? "رقم الهاتف" : "Phone Number"} *
                        </label>
                        <input
                          type="tel"
                          required
                          value={signupPhone}
                          onChange={(e) => setSignupPhone(e.target.value)}
                          placeholder="+974 5555 6666"
                          className="w-full px-3 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                        {isRtl ? "البريد الإلكتروني" : "Email Address"} *
                      </label>
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="nasser@example.qa"
                        className="w-full px-3 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#6e6b66] uppercase mb-1">
                        {isRtl ? "كلمة المرور (٨ أحرف على الأقل)" : "Create Password (min. 8 characters)"} *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-base md:text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full py-2.5 bg-[#1c1a17] hover:bg-[#33302a] disabled:bg-[#a8a4a0] text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <UserPlus size={14} />
                          <span>{isRtl ? "إنشاء حسابي وتفعيل الشراكة" : "Register and Onboard"}</span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              <div className="text-center pt-2">
                <button
                  onClick={() => { setIsSignupOpen(false); setIsLoginOpen(true); }}
                  className="text-xs text-[#bf9b30] hover:underline cursor-pointer"
                >
                  {isRtl ? "لديك حساب شريك بالفعل؟ سجل الدخول" : "Already have a partner account? Log in"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      <CookieConsent isRtl={isRtl} />
    </div>
  );
}
