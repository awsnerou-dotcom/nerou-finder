/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  AuditLog,
  Property,
  Organization,
  Lead,
  SupportReport,
  AdCampaign,
  SystemHealthStatus,
  User,
  VerificationStatus,
  SubscriptionPlan,
  UserRole,
  LegalDocument,
  HelpArticle,
  SupportTicket,
  JobListing,
  PressRelease,
  PartnershipRequest,
  LocationItem,
  ApplicationStatus,
  AgentType,
  getEffectiveAgentType,
  ListingStatus,
  LeadStatus,
  ViewingRequest,
  Review
} from "../types.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import {
  ShieldAlert,
  Users,
  Building2,
  PhoneCall,
  CalendarRange,
  Zap,
  Activity,
  CheckCircle,
  XCircle,
  FileText,
  Compass,
  DollarSign,
  Cpu,
  RefreshCw,
  FolderTree,
  Sliders,
  Bell,
  Scale,
  HelpCircle,
  AlertOctagon,
  Briefcase,
  Award,
  Send,
  Plus,
  Mail,
  Trash2,
  Star,
  ChevronRight,
  Layers,
  ClipboardList,
  TrendingUp,
  Clock
} from "lucide-react";

interface ControlCenterProps {
  onRefreshAll: () => void;
  isRtl: boolean;
  currentUser: User;
}

export default function ControlCenter({ onRefreshAll, isRtl, currentUser }: ControlCenterProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    | "overview"
    | "verifications"
    | "leads"
    | "campaigns"
    | "ai"
    | "health"
    | "subscription"
    | "legal_cms"
    | "help_articles"
    | "support_tickets"
    | "partnerships"
    | "careers"
    | "press"
    | "email_logs"
    | "reviews"
    | "locations"
    | "ad_billing"
    | "applications"
    | "listings"
    | "users"
    | "viewing_requests"
  >("overview");

  // Collapsible sidebar navigation: which grouped sections are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ overview_group: true });
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Database lists
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [reports, setReports] = useState<SupportReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  
  // Extended database lists
  const [legalDocs, setLegalDocs] = useState<LegalDocument[]>([]);
  const [helpArticles, setHelpArticles] = useState<HelpArticle[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [partnerships, setPartnerships] = useState<PartnershipRequest[]>([]);
  const [careers, setCareers] = useState<JobListing[]>([]);
  const [press, setPress] = useState<PressRelease[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [verificationDocs, setVerificationDocs] = useState<any[]>([]);
  const [rejectingDocId, setRejectingDocId] = useState<string>("");
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState<string>("");
  const [adCharges, setAdCharges] = useState<any[]>([]);
  // Post-Campaign ROI Report: which org+billingPeriod ledger groups have their per-charge
  // breakdown expanded (each charge now carries a live-computed roiSummary from the server).
  const [expandedLedgerGroups, setExpandedLedgerGroups] = useState<Set<string>>(new Set());
  const [adBoostCaps, setAdBoostCaps] = useState<Record<string, number>>({});
  const [capDrafts, setCapDrafts] = useState<Record<string, string>>({});
  const [viewings, setViewings] = useState<ViewingRequest[]>([]);
  // FIX 10: reviews moderation filters
  const [reviewRatingFilter, setReviewRatingFilter] = useState<string>("");
  const [reviewSearch, setReviewSearch] = useState<string>("");
  const [reviewReportedOnly, setReviewReportedOnly] = useState<boolean>(false);
  const [listingSearch, setListingSearch] = useState<string>("");
  const [flagReasonDraft, setFlagReasonDraft] = useState<Record<string, string>>({});
  
  // Developer Outbound SMTP Email Mock Queue states
  const [emails, setEmails] = useState<any[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
  const [emailLogsLoading, setEmailLogsLoading] = useState<boolean>(false);

  // Press edit state variables
  const [isEditingPress, setIsEditingPress] = useState<boolean>(false);
  const [selectedPress, setSelectedPress] = useState<PressRelease | null>(null);
  const [pressTitle, setPressTitle] = useState<string>("");
  const [pressTitleAr, setPressTitleAr] = useState<string>("");
  const [pressDate, setPressDate] = useState<string>("");
  const [pressSummary, setPressSummary] = useState<string>("");
  const [pressSummaryAr, setPressSummaryAr] = useState<string>("");
  const [pressContent, setPressContent] = useState<string>("");
  const [pressContentAr, setPressContentAr] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);

  // 2FA Security settings state
  const [adminUser, setAdminUser] = useState<any>(() => {
    const saved = localStorage.getItem("nerou_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [show2faSetup, setShow2faSetup] = useState<boolean>(false);
  const [tfaSecret, setTfaSecret] = useState<string>("");
  const [tfaQrCode, setTfaQrCode] = useState<string>("");
  const [tfaCode, setTfaCode] = useState<string>("");
  const [tfaLoading, setTfaLoading] = useState<boolean>(false);
  const [tfaError, setTfaError] = useState<string>("");
  const [showDisable2faConfirm, setShowDisable2faConfirm] = useState<boolean>(false);
  const [disable2faPassword, setDisable2faPassword] = useState<string>("");

  // Search filter
  const [userSearch, setUserSearch] = useState<string>("");

  // Toast notifications (replaces window.alert for better visual UX and sandbox iframe compliance)
  const [toastMessage, setToastMessage] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<{ type: "REVIEW" | "PROPERTY" | "LEAD"; id: string } | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);

  // Plan Form State
  const [isAddingPlan, setIsAddingPlan] = useState<boolean>(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planName, setPlanName] = useState<string>("");
  const [planPriceMonthly, setPlanPriceMonthly] = useState<string>("");
  const [planPriceYearly, setPlanPriceYearly] = useState<string>("");
  const [planPropertyLimit, setPlanPropertyLimit] = useState<string>("");
  const [planAgentLimit, setPlanAgentLimit] = useState<string>("");
  const [planAiLimit, setPlanAiLimit] = useState<string>("");
  const [planAnalyticsAccess, setPlanAnalyticsAccess] = useState<boolean>(true);
  const [planFeaturedListingsLimit, setPlanFeaturedListingsLimit] = useState<string>("");

  // Org Manual Override state
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [subStartDate, setSubStartDate] = useState<string>("");
  const [subExpiryDate, setSubExpiryDate] = useState<string>("");
  const [subStatus, setSubStatus] = useState<"ACTIVE" | "SUSPENDED" | "CANCELLED" | "PENDING_APPROVAL">("ACTIVE");
  const [subNotes, setSubNotes] = useState<string>("");
  const [subActivationMethod, setSubActivationMethod] = useState<"MANUAL" | "BANK_TRANSFER" | "INVOICE" | "OTHER">("MANUAL");

  // New Applications (FIX3 onboarding pipeline) - inline "Confirm Payment" form state
  const [confirmingAppId, setConfirmingAppId] = useState<string>("");
  const [appPlanId, setAppPlanId] = useState<string>("");
  const [appExpiryDate, setAppExpiryDate] = useState<string>("");
  const [appActivationMethod, setAppActivationMethod] = useState<"MANUAL" | "BANK_TRANSFER" | "INVOICE" | "OTHER">("MANUAL");
  const [appNotes, setAppNotes] = useState<string>("");

  // Legal CMS edit states
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocument | null>(null);
  const [isEditingLegalDoc, setIsEditingLegalDoc] = useState<boolean>(false);
  const [legalSlug, setLegalSlug] = useState<string>("");
  const [legalTitle, setLegalTitle] = useState<string>("");
  const [legalTitleAr, setLegalTitleAr] = useState<string>("");
  const [legalContent, setLegalContent] = useState<string>("");
  const [legalContentAr, setLegalContentAr] = useState<string>("");
  const [legalVersion, setLegalVersion] = useState<string>("1.0.0");
  const [legalStatus, setLegalStatus] = useState<"DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED">("DRAFT");
  const [legalReview, setLegalReview] = useState<"PENDING" | "APPROVED" | "REVISION_REQUIRED">("PENDING");

  // Help Article edit states
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [isEditingArticle, setIsEditingArticle] = useState<boolean>(false);
  const [artCategory, setArtCategory] = useState<"VISITORS" | "AGENTS" | "AGENCIES" | "DEVELOPERS" | "SUBSCRIPTIONS" | "SECURITY">("VISITORS");
  const [artTitle, setArtTitle] = useState<string>("");
  const [artTitleAr, setArtTitleAr] = useState<string>("");
  const [artContent, setArtContent] = useState<string>("");
  const [artContentAr, setArtContentAr] = useState<string>("");
  const [artPublished, setArtPublished] = useState<boolean>(true);

  // Ticket support state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState<string>("");

  // Careers edit state
  const [isEditingJob, setIsEditingJob] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [jobTitleAr, setJobTitleAr] = useState<string>("");
  const [jobDept, setJobDept] = useState<string>("");
  const [jobDeptAr, setJobDeptAr] = useState<string>("");
  const [jobLoc, setJobLoc] = useState<string>("");
  const [jobLocAr, setJobLocAr] = useState<string>("");
  const [jobType, setJobType] = useState<string>("");
  const [jobTypeAr, setJobTypeAr] = useState<string>("");
  const [jobDesc, setJobDesc] = useState<string>("");
  const [jobDescAr, setJobDescAr] = useState<string>("");
  const [jobReqs, setJobReqs] = useState<string>("");
  const [jobReqsAr, setJobReqsAr] = useState<string>("");

  // AI Configuration States
  const [aiName, setAiName] = useState<string>("Nerou Find");
  const [aiDescription, setAiDescription] = useState<string>("");
  const [aiPersonality, setAiPersonality] = useState<string>("");
  const [aiRules, setAiRules] = useState<string>("");
  const [restrictedTopics, setRestrictedTopics] = useState<string>("");
  const [aiDisclaimers, setAiDisclaimers] = useState<string>("");
  const [aiModel, setAiModel] = useState<string>("gemini-3.6-flash");
  const [aiTemperature, setAiTemperature] = useState<number>(0.1);
  const [aiMaxTokens, setAiMaxTokens] = useState<number>(1000);
  const [isSavingAiConfig, setIsSavingAiConfig] = useState<boolean>(false);
  const [whatsappDefaultNumber, setWhatsappDefaultNumber] = useState<string>("97433334444");
  const [watermarkText, setWatermarkText] = useState<string>("Nerou Finder");
  const [watermarkLogoType, setWatermarkLogoType] = useState<string>("gold_diamond");

  useEffect(() => {
    fetchControlContext();
  }, []);

  const fetchEmailLogs = async () => {
    setEmailLogsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const authHeader = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch("/api/admin/emails", { headers: authHeader });
      if (res.ok) {
        const data = await res.json();
        setEmails(data || []);
      }
    } catch (err) {
      console.error("Error fetching mock email logs:", err);
    } finally {
      setEmailLogsLoading(false);
    }
  };

  const handleClearEmailLogs = async () => {
    try {
      const token = localStorage.getItem("token") || "";
      const authHeader = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch("/api/admin/emails/clear", {
        method: "POST",
        headers: authHeader
      });
      if (res.ok) {
        showToast(isRtl ? "تم مسح سجلات البريد الصادر المحاكية بنجاح!" : "Outbound mock SMTP log queue cleared successfully!");
        setEmails([]);
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error("Error clearing mock email logs:", err);
    }
  };

  useEffect(() => {
    if (activeSubTab === "email_logs") {
      fetchEmailLogs();
    }
  }, [activeSubTab]);

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAiConfig(true);
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          aiName,
          aiDescription,
          aiPersonality,
          aiRules,
          restrictedTopics,
          disclaimers: aiDisclaimers,
          whatsappDefaultNumber,
          watermarkText,
          watermarkLogoType,
          modelConfiguration: {
            model: aiModel,
            temperature: aiTemperature,
            maxTokens: aiMaxTokens
          }
        })
      });
      if (res.ok) {
        setToastMessage(isRtl ? "تم حفظ إعدادات محرك نيرو فايند بنجاح!" : "Nerou Find AI Search engine configuration saved successfully!");
        setTimeout(() => setToastMessage(""), 4000);
      } else {
        setToastMessage(isRtl ? "فشل حفظ الإعدادات العقارية للذكاء الاصطناعي." : "Failed to save AI configuration.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage(isRtl ? "خطأ في الاتصال بالسيرفر لحفظ الإعدادات." : "Connection error with server.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  const [isAddingLocation, setIsAddingLocation] = useState<boolean>(false);
  const [newLocName, setNewLocName] = useState<string>("");
  const [newLocNameAr, setNewLocNameAr] = useState<string>("");
  const [newLocType, setNewLocType] = useState<"MUNICIPALITY" | "AREA" | "DISTRICT">("AREA");
  const [newLocParentId, setNewLocParentId] = useState<string>("");
  const [newLocLatitude, setNewLocLatitude] = useState<string>("");
  const [newLocLongitude, setNewLocLongitude] = useState<string>("");

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName || !newLocNameAr) {
      setToastMessage(isRtl ? "يرجى تعبئة الحقول المطلوبة!" : "Please fill in all required fields!");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }
    try {
      const token = localStorage.getItem("token") || "";
      const authHeader = token ? { "Authorization": `Bearer ${token}` } : {};
      const res = await fetch("/api/admin/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          name: newLocName,
          nameAr: newLocNameAr,
          type: newLocType,
          parentId: newLocParentId || undefined,
          latitude: newLocLatitude ? parseFloat(newLocLatitude) : undefined,
          longitude: newLocLongitude ? parseFloat(newLocLongitude) : undefined,
          isActive: true
        })
      });
      if (res.ok) {
        setToastMessage(isRtl ? "تم حفظ المنطقة الجديدة بنجاح!" : "New location saved successfully!");
        setTimeout(() => setToastMessage(""), 4000);
        setNewLocName("");
        setNewLocNameAr("");
        setNewLocLatitude("");
        setNewLocLongitude("");
        setNewLocParentId("");
        setIsAddingLocation(false);
        await fetchControlContext();
      } else {
        setToastMessage(isRtl ? "فشل حفظ المنطقة العقارية." : "Failed to save location.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error("Error saving location:", err);
      setToastMessage(isRtl ? "حدث خطأ أثناء حفظ المنطقة." : "An error occurred while saving the location.");
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const fetchControlContext = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || "";
      const authHeader = token ? { "Authorization": `Bearer ${token}` } : {};

      // Parallel fetches for rapid loading
      const [
        usersRes,
        propRes,
        orgRes,
        leadsRes,
        campRes,
        repRes,
        auditRes,
        healthRes,
        plansRes,
        legalRes,
        helpRes,
        ticketsRes,
        partnersRes,
        careersRes,
        pressRes,
        reviewsRes,
        locationsRes,
        verificationDocsRes,
        adChargesRes,
        viewingsRes
      ] = await Promise.all([
        fetch("/api/users", { headers: authHeader }),
        // includeAllStatuses: the public /api/properties endpoint defaults to PUBLISHED-only
        // (FIX 1) - admin needs full visibility (draft/pending/flagged/suspended too).
        fetch("/api/properties?includeAllStatuses=true", { headers: authHeader }),
        fetch("/api/organizations", { headers: authHeader }),
        fetch("/api/leads", { headers: authHeader }),
        fetch("/api/campaigns", { headers: authHeader }),
        fetch("/api/reports", { headers: authHeader }),
        fetch("/api/admin/audits", { headers: authHeader }),
        fetch("/api/health", { headers: authHeader }),
        fetch("/api/plans", { headers: authHeader }),
        fetch("/api/legal", { headers: authHeader }),
        fetch("/api/help", { headers: authHeader }),
        fetch("/api/admin/support/tickets", { headers: authHeader }),
        fetch("/api/admin/partnerships", { headers: authHeader }),
        fetch("/api/careers", { headers: authHeader }),
        fetch("/api/press", { headers: authHeader }),
        fetch("/api/admin/reviews", { headers: authHeader }),
        fetch("/api/locations", { headers: authHeader }),
        fetch("/api/admin/verification-documents", { headers: authHeader }),
        fetch("/api/ad-charges", { headers: authHeader }),
        fetch("/api/viewings", { headers: authHeader })
      ]);

      const [
        usersData,
        propData,
        orgData,
        leadsData,
        campData,
        repData,
        auditData,
        healthData,
        plansData,
        legalData,
        helpData,
        ticketsData,
        partnersData,
        careersData,
        pressData,
        reviewsData,
        locationsData,
        verificationDocsData,
        adChargesData,
        viewingsData
      ] = await Promise.all([
        usersRes.ok ? usersRes.json() : Promise.resolve([]),
        propRes.ok ? propRes.json() : Promise.resolve([]),
        orgRes.ok ? orgRes.json() : Promise.resolve([]),
        leadsRes.ok ? leadsRes.json() : Promise.resolve([]),
        campRes.ok ? campRes.json() : Promise.resolve([]),
        repRes.ok ? repRes.json() : Promise.resolve([]),
        auditRes.ok ? auditRes.json() : Promise.resolve([]),
        healthRes.ok ? healthRes.json() : Promise.resolve({ systemHealth: null }),
        plansRes.ok ? plansRes.json() : Promise.resolve([]),
        legalRes.ok ? legalRes.json() : Promise.resolve([]),
        helpRes.ok ? helpRes.json() : Promise.resolve([]),
        ticketsRes.ok ? ticketsRes.json() : Promise.resolve([]),
        partnersRes.ok ? partnersRes.json() : Promise.resolve([]),
        careersRes.ok ? careersRes.json() : Promise.resolve([]),
        pressRes.ok ? pressRes.json() : Promise.resolve([]),
        reviewsRes.ok ? reviewsRes.json() : Promise.resolve([]),
        locationsRes.ok ? locationsRes.json() : Promise.resolve([]),
        verificationDocsRes.ok ? verificationDocsRes.json() : Promise.resolve([]),
        adChargesRes.ok ? adChargesRes.json() : Promise.resolve([]),
        viewingsRes.ok ? viewingsRes.json() : Promise.resolve([])
      ]);

      setUsers(usersData);
      setProperties(propData);
      setOrganizations(orgData);
      setLeads(leadsData);
      setCampaigns(campData);
      setReports(repData);
      setAuditLogs(auditData);
      setHealth(healthData.systemHealth || null);
      setPlans(plansData || []);
      setLegalDocs(legalData || []);
      setHelpArticles(helpData || []);
      setTickets(ticketsData || []);
      setPartnerships(partnersData || []);
      setCareers(careersData || []);
      setPress(pressData || []);
      setReviews(reviewsData || []);
      setLocations(locationsData || []);
      setVerificationDocs(verificationDocsData || []);
      setAdCharges(adChargesData || []);
      setViewings(viewingsData || []);

      // Load AI Config
      try {
        const aiConfigRes = await fetch("/api/admin/ai-config", { headers: authHeader });
        if (aiConfigRes.ok) {
          const aiConfigData = await aiConfigRes.json();
          setAiName(aiConfigData.aiName || "Nerou Find");
          setAiDescription(aiConfigData.aiDescription || "");
          setAiPersonality(aiConfigData.aiPersonality || "");
          setAiRules(aiConfigData.aiRules || "");
          setRestrictedTopics(aiConfigData.restrictedTopics || "");
          setAiDisclaimers(aiConfigData.disclaimers || "");
          setAiModel(aiConfigData.modelConfiguration?.model || "gemini-3.6-flash");
          setAiTemperature(aiConfigData.modelConfiguration?.temperature ?? 0.1);
          setAiMaxTokens(aiConfigData.modelConfiguration?.maxTokens ?? 1000);
          setWhatsappDefaultNumber(aiConfigData.whatsappDefaultNumber || "97433334444");
          setWatermarkText(aiConfigData.watermarkText || "Nerou Finder");
          setWatermarkLogoType(aiConfigData.watermarkLogoType || "gold_diamond");
          setAdBoostCaps(aiConfigData.adBoostCaps || {});
        }
      } catch (err) {
        console.error("Failed to fetch AI configuration inside context load:", err);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleModerateReview = async (reviewId: string, status: "APPROVED" | "REJECTED") => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(isRtl ? "تمت معالجة التقييم بنجاح!" : "Review moderated successfully!");
        setReviews(reviews.map(r => r.id === reviewId ? { ...r, status } : r));
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update review status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReview = (reviewId: string) => {
    setPendingDelete({ type: "REVIEW", id: reviewId });
  };

  const executeDeleteReview = async (reviewId: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast(isRtl ? "تم حذف التقييم بنجاح." : "Review deleted successfully.");
        setReviews(reviews.filter(r => r.id !== reviewId));
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to delete review.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete review.");
    }
  };

  const handleStart2faSetup = async () => {
    setTfaLoading(true);
    setTfaError("");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Failed to generate 2FA credentials.");
      } else {
        setTfaSecret(data.secret);
        setTfaQrCode(data.qrCodeUrl);
        setShow2faSetup(true);
      }
    } catch (err) {
      setTfaError("Failed to communicate with authentication servers.");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleEnable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tfaCode) return;
    setTfaLoading(true);
    setTfaError("");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ secret: tfaSecret, code: tfaCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Failed to enable Two-Factor Authentication.");
      } else {
        showToast(isRtl ? "تم تفعيل التحقق الثنائي (2FA) للمشرف بنجاح!" : "Two-Factor Authentication successfully enabled for Admin!");
        
        // Update local state and storage
        const updatedUser = { ...adminUser, twoFactorEnabled: true };
        setAdminUser(updatedUser);
        localStorage.setItem("nerou_user", JSON.stringify(updatedUser));

        setShow2faSetup(false);
        setTfaSecret("");
        setTfaQrCode("");
        setTfaCode("");
      }
    } catch (err) {
      setTfaError("Failed to enable Two-Factor Authentication.");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    setTfaLoading(true);
    setTfaError("");
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ password: disable2faPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        setTfaError(data.error || "Failed to disable Two-Factor Authentication.");
      } else {
        showToast(isRtl ? "تم إيقاف التحقق الثنائي بنجاح." : "Two-Factor Authentication disabled successfully.");

        // Update local state and storage
        const updatedUser = { ...adminUser, twoFactorEnabled: false };
        setAdminUser(updatedUser);
        localStorage.setItem("nerou_user", JSON.stringify(updatedUser));

        setShow2faSetup(false);
        setTfaSecret("");
        setTfaQrCode("");
        setTfaCode("");
        setShowDisable2faConfirm(false);
        setDisable2faPassword("");
      }
    } catch (err) {
      setTfaError("Failed to communicate with authentication servers.");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleVerifyProperty = async (propertyId: string, status: VerificationStatus) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/properties/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          propertyId,
          status,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "Failed to update property verification status.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update property verification status.");
    }
  };

  // FIX 3: after-the-fact "flag for review" - lighter-weight than suspending, doesn't unpublish.
  const handleFlagProperty = async (propertyId: string, reason?: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/properties/${propertyId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setFlagReasonDraft(prev => ({ ...prev, [propertyId]: "" }));
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "Failed to update flag status.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update flag status.");
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    setPendingDelete({ type: "PROPERTY", id: propertyId });
  };

  const executeDeleteProperty = async (propertyId: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast(isRtl ? "تم حذف العقار بنجاح." : "Property deleted successfully.");
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to delete property.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete property.");
    }
  };

  const handleDeleteLead = (leadId: string) => {
    setPendingDelete({ type: "LEAD", id: leadId });
  };

  const executeDeleteLead = async (leadId: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        showToast(isRtl ? "تم حذف السجل بنجاح." : "Lead deleted successfully.");
        setLeads(leads.filter(l => l.id !== leadId));
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to delete lead.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to delete lead.");
    }
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    setDeletingPending(true);
    try {
      if (pendingDelete.type === "REVIEW") await executeDeleteReview(pendingDelete.id);
      else if (pendingDelete.type === "PROPERTY") await executeDeleteProperty(pendingDelete.id);
      else await executeDeleteLead(pendingDelete.id);
    } finally {
      setDeletingPending(false);
      setPendingDelete(null);
    }
  };

  const pendingDeleteTitle = pendingDelete?.type === "REVIEW"
    ? (isRtl ? "هل تريد حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this review? This cannot be undone.")
    : pendingDelete?.type === "PROPERTY"
    ? (isRtl ? "هل تريد حذف هذا العقار؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this property? This cannot be undone.")
    : (isRtl ? "هل تريد حذف هذا العميل المحتمل؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this lead? This cannot be undone.");

  const handleVerifyOrg = async (orgId: string, status: VerificationStatus) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/verify-org", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          status,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        fetchControlContext();
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyUser = async (userId: string, status: VerificationStatus) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/verify-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          status,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        fetchControlContext();
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewDocument = async (documentId: string, status: "APPROVED" | "REJECTED", rejectionReason?: string) => {
    if (status === "REJECTED" && !rejectionReason?.trim()) {
      showToast(isRtl ? "سبب الرفض مطلوب." : "A rejection reason is required.");
      return;
    }
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/verification-documents/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId,
          status,
          rejectionReason,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        showToast(status === "APPROVED" ? (isRtl ? "تم اعتماد المستند!" : "Document approved!") : (isRtl ? "تم رفض المستند." : "Document rejected."));
        setRejectingDocId("");
        setRejectionReasonDraft("");
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to review document.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSettleBillingPeriod = async (orgId: string, billingPeriod: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/ad-charges/settle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          billingPeriod,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        showToast(isRtl ? "تم تسوية فترة الفوترة بنجاح!" : "Billing period settled successfully!");
        fetchControlContext();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to settle billing period.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveBoostCap = async (planId: string) => {
    const value = parseInt(capDrafts[planId], 10);
    if (isNaN(value) || value < 0) {
      showToast(isRtl ? "قيمة الحد الأقصى غير صالحة." : "Invalid cap value.");
      return;
    }
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/ad-boost-caps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ caps: { [planId]: value } })
      });
      if (res.ok) {
        const data = await res.json();
        setAdBoostCaps(data.adBoostCaps || {});
        showToast(isRtl ? "تم تحديث الحد الأقصى الشهري!" : "Monthly cap updated!");
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update cap.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewCampaign = async (campaignId: string, status: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/campaigns/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          campaignId,
          status,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: "PLATFORM_ADMIN"
        })
      });
      if (res.ok) {
        fetchControlContext();
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateHealth = async (provider: string, status: string) => {
    try {
      const payload: any = {
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: "PLATFORM_ADMIN"
      };
      payload[provider] = status;

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/health/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchControlContext();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planPriceMonthly || !planPriceYearly) return;

    try {
      const payload = {
        id: editingPlan?.id,
        name: planName,
        priceMonthly: Number(planPriceMonthly),
        priceYearly: Number(planPriceYearly),
        propertyLimit: Number(planPropertyLimit || 50),
        agentLimit: Number(planAgentLimit || 5),
        aiLimit: Number(planAiLimit || 100),
        analyticsAccess: planAnalyticsAccess,
        featuredListingsLimit: Number(planFeaturedListingsLimit || 5),
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: "PLATFORM_ADMIN"
      };

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isRtl ? "تم حفظ الخطة التمويلية بنجاح!" : "Subscription plan catalogued successfully!");
        setIsAddingPlan(false);
        setEditingPlan(null);
        setPlanName("");
        setPlanPriceMonthly("");
        setPlanPriceYearly("");
        setPlanPropertyLimit("");
        setPlanAgentLimit("");
        setPlanAiLimit("");
        setPlanFeaturedListingsLimit("");
        fetchControlContext();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOverrideSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !selectedPlanId) return;

    try {
      const payload = {
        orgId: selectedOrgId,
        planId: selectedPlanId,
        startDate: subStartDate || new Date().toISOString().split("T")[0],
        expiryDate: subExpiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
        status: subStatus,
        notes: subNotes,
        activationMethod: subActivationMethod,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: "PLATFORM_ADMIN"
      };

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/organizations/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isRtl ? "تمت معالجة وتحديث تفعيل الاشتراك بنجاح!" : "SaaS subscription parameters manually configured!");
        fetchControlContext();
        onRefreshAll();
        // Reset override fields
        setSubNotes("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // New Applications pipeline (FIX3): move a PENDING_APPROVAL applicant to AWAITING_PAYMENT.
  const handleMoveToAwaitingPayment = async (userId: string) => {
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/admin/users/${userId}/application-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: "AWAITING_PAYMENT" })
      });
      if (res.ok) {
        showToast(isRtl ? "تم نقل الطلب إلى انتظار الدفع." : "Application moved to Awaiting Payment.");
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to update application status.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to update application status.");
    }
  };

  // New Applications pipeline (FIX3): confirm subscription payment for an AWAITING_PAYMENT
  // applicant - routes to the Organization endpoint if they have an org (AGENCY_ADMIN /
  // DEVELOPER_ADMIN), or the User endpoint if not (INDEPENDENT_AGENT).
  const handleConfirmApplicationPayment = async (app: User) => {
    if (!appPlanId || !appExpiryDate) {
      showToast(isRtl ? "يرجى اختيار الخطة وتاريخ الانتهاء." : "Please select a plan and expiry date.");
      return;
    }
    try {
      const token = localStorage.getItem("token") || "";
      const endpoint = app.orgId
        ? "/api/admin/organizations/subscription"
        : `/api/admin/users/${app.id}/subscription`;
      const payload: any = {
        planId: appPlanId,
        startDate: new Date().toISOString().split("T")[0],
        expiryDate: appExpiryDate,
        status: "ACTIVE",
        notes: appNotes,
        activationMethod: appActivationMethod,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: "PLATFORM_ADMIN"
      };
      if (app.orgId) payload.orgId = app.orgId;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isRtl ? "تم تأكيد الدفع وتفعيل الاشتراك بنجاح!" : "Payment confirmed and subscription activated!");
        setConfirmingAppId("");
        setAppPlanId("");
        setAppExpiryDate("");
        setAppNotes("");
        setAppActivationMethod("MANUAL");
        fetchControlContext();
        onRefreshAll();
      } else {
        const d = await res.json();
        showToast(d.error || "Failed to confirm subscription payment.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to confirm subscription payment.");
    }
  };

  const handleSavePress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pressTitle || !pressContent) return;

    try {
      const payload = {
        id: selectedPress?.id || null,
        title: pressTitle,
        titleAr: pressTitleAr || pressTitle,
        date: pressDate || new Date().toISOString().split("T")[0],
        summary: pressSummary || pressContent.slice(0, 150) + "...",
        summaryAr: pressSummaryAr || (pressContentAr ? pressContentAr.slice(0, 150) + "..." : ""),
        content: pressContent,
        contentAr: pressContentAr || pressContent,
        actorId: currentUser.id,
        actorName: currentUser.fullName,
        actorRole: "PLATFORM_ADMIN"
      };

      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/admin/press", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(isRtl ? "تم حفظ وتحديث البيان الصحفي المعتمد!" : "Corporate press release synchronized successfully!");
        setIsEditingPress(false);
        setSelectedPress(null);
        setPressTitle("");
        setPressTitleAr("");
        setPressDate("");
        setPressSummary("");
        setPressSummaryAr("");
        setPressContent("");
        setPressContentAr("");
        fetchControlContext();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Aggregated Counters
  // FIX 3: new listings no longer sit in a PENDING verification queue - admin moderation is
  // now after-the-fact (flag/suspend/delete a live listing), surfaced on the "listings" tab.
  const flaggedProperties = properties.filter(p => p.flaggedForReview);
  const filteredListings = properties.filter(p => {
    if (!listingSearch.trim()) return true;
    const q = listingSearch.trim().toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.listingId?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q);
  });
  const pendingOrgs = organizations.filter(o => o.verificationStatus === VerificationStatus.PENDING);
  const pendingUsers = users.filter(u => u.verificationStatus === VerificationStatus.PENDING);
  const pendingCampaigns = campaigns.filter(c => c.status === "PENDING_REVIEW");
  const pendingDocuments = verificationDocs.filter(d => d.status === "PENDING");
  // FIX3: onboarding pipeline applicants - undefined applicationStatus means grandfathered/active,
  // so it must never show up here; only users explicitly sitting at a non-ACTIVE status do.
  const pendingApplications = users.filter(u => u.applicationStatus && u.applicationStatus !== ApplicationStatus.ACTIVE);

  // Group submitted verification documents by applicant (AGENT user or AGENCY/DEVELOPER org)
  const documentApplicantGroups: { key: string; applicantName: string; applicantEmail: string; context: string; docs: any[] }[] = [];
  verificationDocs.forEach(d => {
    const key = `${d.context}:${d.userId || d.orgId}`;
    let group = documentApplicantGroups.find(g => g.key === key);
    if (!group) {
      group = { key, applicantName: d.applicantName, applicantEmail: d.applicantEmail, context: d.context, docs: [] };
      documentApplicantGroups.push(group);
    }
    group.docs.push(d);
  });

  // Real MRR: only ACTIVE-subscription orgs, priced from the actual SubscriptionPlan record
  // rather than a hardcoded per-plan-id price map.
  const totalSaaSMonthlyRevenue = organizations
    .filter(org => org.subscriptionStatus === "ACTIVE")
    .reduce((acc, org) => {
      const plan = plans.find(p => p.id === org.subscriptionPlanId);
      return acc + (plan ? plan.priceMonthly : 0);
    }, 0);

  const totalAdvertisingRevenue = campaigns.reduce((acc, c) => acc + c.budget, 0);

  // ---------------------------------------------------------------------
  // Overview dashboard KPI computations (Part A)
  // ---------------------------------------------------------------------
  const nowDate = new Date();
  const currentMonthIdx = nowDate.getMonth();
  const currentYearNum = nowDate.getFullYear();

  // 1. Total users by type
  const independentAgentsList = users.filter(u => u.role === UserRole.AGENT && getEffectiveAgentType(u) === AgentType.INDEPENDENT_AGENT);
  const agencyAgentsCount = users.filter(u => u.role === UserRole.AGENT && getEffectiveAgentType(u) === AgentType.AGENCY_AGENT).length;
  const agenciesCount = users.filter(u => u.role === UserRole.AGENCY_ADMIN).length;
  const developersCount = users.filter(u => u.role === UserRole.DEVELOPER_ADMIN).length;
  const registeredUsersCount = users.filter(u => u.role === UserRole.REGISTERED).length;
  const usersByType: { label: { en: string; ar: string }; count: number }[] = [
    { label: { en: "Independent Agents", ar: "وكلاء مستقلون" }, count: independentAgentsList.length },
    { label: { en: "Agency Agents", ar: "وكلاء الشركات" }, count: agencyAgentsCount },
    { label: { en: "Agencies", ar: "المكاتب العقارية" }, count: agenciesCount },
    { label: { en: "Developers", ar: "شركات التطوير" }, count: developersCount },
    { label: { en: "Registered Buyers/Tenants", ar: "المستخدمون المسجلون" }, count: registeredUsersCount }
  ];

  // 2. Pending applications by stage
  const applicationStageOrder: ApplicationStatus[] = [
    ApplicationStatus.PENDING_APPROVAL,
    ApplicationStatus.AWAITING_PAYMENT,
    ApplicationStatus.AWAITING_DOCUMENTS,
    ApplicationStatus.UNDER_VERIFICATION
  ];
  const applicationsByStage = applicationStageOrder.map(stage => ({
    stage,
    count: pendingApplications.filter(u => u.applicationStatus === stage).length
  }));

  // 3. Active vs expired subscriptions (orgs + independent agents, each own field)
  const orgsActiveSubs = organizations.filter(o => o.subscriptionStatus === "ACTIVE").length;
  const orgsInactiveSubs = organizations.length - orgsActiveSubs;
  const orgsExpiredSubs = organizations.filter(o => o.subscriptionExpiry && new Date(o.subscriptionExpiry) < nowDate).length;
  const indAgentsActiveSubs = independentAgentsList.filter(u => u.subscriptionStatus === "ACTIVE").length;
  const indAgentsInactiveSubs = independentAgentsList.length - indAgentsActiveSubs;
  const indAgentsExpiredSubs = independentAgentsList.filter(u => u.subscriptionExpiry && new Date(u.subscriptionExpiry) < nowDate).length;

  // 4. Total listings by status - driven off the real ListingStatus enum, not guessed values
  const listingStatusCounts = Object.values(ListingStatus).map(status => ({
    status,
    count: properties.filter(p => p.listingStatus === status).length
  }));

  // 5. Leads this month + conversion rate (LeadStatus.CONVERTED is the real "won" status)
  const leadsThisMonth = leads.filter(l => {
    const d = new Date(l.createdDate);
    return d.getFullYear() === currentYearNum && d.getMonth() === currentMonthIdx;
  });
  const convertedLeadsThisMonth = leadsThisMonth.filter(l => l.status === LeadStatus.CONVERTED).length;
  const leadConversionRateThisMonth = leadsThisMonth.length > 0 ? Math.round((convertedLeadsThisMonth / leadsThisMonth.length) * 100) : 0;

  // 6. Current-period ad billing total, computed client-side from the already-fetched adCharges
  // (GET /api/ad-charges returns the full ledger to a PLATFORM_ADMIN caller with no orgId filter).
  const currentBillingPeriod = `${currentYearNum}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
  const currentPeriodAdCharges = adCharges.filter((c: any) => c.billingPeriod === currentBillingPeriod);
  const currentPeriodAdTotal = currentPeriodAdCharges.reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdSettled = currentPeriodAdCharges.filter((c: any) => c.settled).reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdUnsettled = currentPeriodAdTotal - currentPeriodAdSettled;

  // 7. Recent activity feed - interesting action types only (real logAudit(...) action strings
  // from server.ts), sorted newest first, capped at 15.
  const INTERESTING_AUDIT_ACTIONS = new Set([
    "USER_SIGNUP", "REGISTER_ORGANIZATION", "CREATE_PROPERTY", "APPROVE_PROPERTY", "REJECT_PROPERTY",
    "VERIFY_ORGANIZATION", "VERIFY_USER", "UPDATE_APPLICATION_STATUS", "REVIEW_VERIFICATION_DOCUMENT",
    "ACTIVATE_AD_BOOST", "UPGRADE_SUBSCRIPTION", "MANUAL_MANAGE_SUBSCRIPTION", "CONFIRM_AGENT_SUBSCRIPTION"
  ]);
  const recentActivityFeed = [...auditLogs]
    .filter(log => INTERESTING_AUDIT_ACTIONS.has(log.action))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  // Grouped, collapsible sidebar navigation config (FIX 2) - every existing tab remains reachable,
  // just organized into sections instead of one flat button row. Content behind each tab is unchanged.
  const navGroups: { id: string; label: { en: string; ar: string }; icon: any; tabs: { id: string; label: { en: string; ar: string }; badge?: number }[] }[] = [
    {
      id: "overview_group",
      label: { en: "Overview", ar: "نظرة عامة" },
      icon: Compass,
      tabs: [{ id: "overview", label: { en: "Oversight", ar: "لوحة التشغيل" } }]
    },
    {
      id: "verification_group",
      label: { en: "Verification & Compliance", ar: "التوثيق والامتثال" },
      icon: ShieldAlert,
      tabs: [
        {
          id: "verifications",
          label: { en: "Verifications Queue", ar: "طلبات التوثيق" },
          badge: pendingOrgs.length + pendingUsers.length + pendingDocuments.length
        },
        {
          id: "applications",
          label: { en: "New Applications", ar: "طلبات الانضمام الجديدة" },
          badge: pendingApplications.length
        }
      ]
    },
    {
      id: "listings_group",
      label: { en: "Listings & Locations", ar: "العقارات والمناطق" },
      icon: FolderTree,
      tabs: [
        {
          id: "listings",
          label: { en: "Listing Moderation", ar: "إدارة الإعلانات" },
          badge: flaggedProperties.length
        },
        { id: "locations", label: { en: "Location Hierarchy", ar: "إدارة المناطق" } }
      ]
    },
    {
      id: "users_group",
      label: { en: "Users", ar: "المستخدمون" },
      icon: Users,
      tabs: [{ id: "users", label: { en: "All Users", ar: "كل المستخدمين" } }]
    },
    {
      id: "leads_group",
      label: { en: "Leads & Communication", ar: "العملاء والتواصل" },
      icon: PhoneCall,
      tabs: [
        { id: "leads", label: { en: "Platform Inquiries", ar: "مراقبة الاتصالات" } },
        { id: "viewing_requests", label: { en: "Viewing Requests", ar: "طلبات المعاينة" } },
        {
          id: "support_tickets",
          label: { en: "Support Tickets", ar: "تذاكر الدعم" },
          badge: tickets.filter(t => t.status === "OPEN").length
        }
      ]
    },
    {
      id: "monetization_group",
      label: { en: "Monetization", ar: "الإيرادات" },
      icon: DollarSign,
      tabs: [
        { id: "subscription", label: { en: "SaaS Subscriptions", ar: "الاشتراكات SaaS" } },
        { id: "campaigns", label: { en: "Ad Approval", ar: "مراجعة الترويج" } },
        { id: "ad_billing", label: { en: "Ad Billing Ledger", ar: "دفتر إعلانات الترويج" } }
      ]
    },
    {
      id: "trust_group",
      label: { en: "Trust & Safety", ar: "الثقة والأمان" },
      icon: Award,
      tabs: [
        { id: "reviews", label: { en: "Reviews Moderation", ar: "مراجعة التقييمات" } },
        { id: "health", label: { en: "System Health", ar: "مزودو الخدمات" } }
      ]
    },
    {
      id: "ai_group",
      label: { en: "AI & Analytics", ar: "الذكاء الاصطناعي" },
      icon: Cpu,
      tabs: [{ id: "ai", label: { en: "AI Analytics", ar: "خادم الذكاء الاصطناعي" } }]
    },
    {
      id: "content_group",
      label: { en: "Content & Legal", ar: "المحتوى والشؤون القانونية" },
      icon: Scale,
      tabs: [
        { id: "legal_cms", label: { en: "Legal CMS", ar: "سياسات CMS" } },
        { id: "help_articles", label: { en: "Help Desk", ar: "المساعدة" } },
        { id: "careers", label: { en: "Careers CMS", ar: "الوظائف والتوظيف" } },
        { id: "press", label: { en: "Press CMS", ar: "الصحافة والإعلام" } },
        { id: "partnerships", label: { en: "Partner Requests", ar: "شراكات الشركات" } }
      ]
    },
    {
      id: "settings_group",
      label: { en: "Settings", ar: "الإعدادات" },
      icon: Sliders,
      tabs: [{ id: "email_logs", label: { en: "Email Logs", ar: "سجلات البريد" } }]
    }
  ];

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Control Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e6e2de] pb-4">
        <div>
          <h2 className="text-2xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
            <ShieldAlert className="text-[#bf9b30]" size={26} />
            <span>{isRtl ? "منصة التحكم وإدارة التشغيل المركزي" : "Platform Central Control Center"}</span>
          </h2>
          <p className="text-xs text-[#6e6b66] mt-0.5">
            {isRtl ? "مستوى الصلاحيات: مشرف عمليات رئيسي • تشغيل كامل لبلدان الخليج" : "Authorization tier: Operations Superuser • Regional cluster oversight (Qatar, GCC)"}
          </p>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1918] text-white px-5 py-3 rounded-xl border border-[#bf9b30] shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom duration-300">
          <span className="w-2 h-2 bg-[#bf9b30] rounded-full animate-ping"></span>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        title={pendingDeleteTitle}
        tone="danger"
        loading={deletingPending}
        isRtl={isRtl}
      />

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Collapsible grouped sidebar navigation (FIX 2) */}
        <aside className="w-full lg:w-64 lg:shrink-0">
          <nav className="bg-[#f2ede8] rounded-xl p-2 space-y-1 text-xs font-medium lg:sticky lg:top-4">
            {navGroups.map(group => {
              const isExpanded = !!expandedGroups[group.id];
              const groupHasActive = group.tabs.some(t => t.id === activeSubTab);
              const GroupIcon = group.icon;
              const groupBadgeTotal = group.tabs.reduce((sum, t) => sum + (t.badge || 0), 0);
              return (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${groupHasActive ? "text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon size={14} className={groupHasActive ? "text-[#bf9b30]" : ""} />
                      {isRtl ? group.label.ar : group.label.en}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {groupBadgeTotal > 0 && (
                        <span className="bg-[#bf9b30] text-black text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                          {groupBadgeTotal}
                        </span>
                      )}
                      <ChevronRight size={12} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="pl-4 pr-1 pb-1 space-y-0.5">
                      {group.tabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveSubTab(tab.id as any)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeSubTab === tab.id ? "bg-white text-[#1a1918] shadow-sm" : "text-[#6e6b66] hover:text-[#1a1918] hover:bg-white/50"}`}
                        >
                          <span>{isRtl ? tab.label.ar : tab.label.en}</span>
                          {!!tab.badge && (
                            <span className="bg-[#bf9b30] text-black text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Active tab content */}
        <div className="flex-1 min-w-0">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-xs text-[#6e6b66] gap-2">
          <RefreshCw size={24} className="animate-spin text-[#bf9b30]" />
          <span>Syncing regional data servers...</span>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* OVERVIEW SUB-TAB */}
          {activeSubTab === "overview" && (
            <div className="space-y-6">
              {/* Financial Dashboard summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#1c1a17] text-white p-5 rounded-xl border border-[#33302a]">
                  <span className="text-[10px] text-gray-400 block uppercase tracking-wider mb-1">{isRtl ? "إيرادات SaaS الجارية" : "SaaS MRR (Qatar Market)"}</span>
                  <h3 className="text-2xl font-serif font-bold text-[#bf9b30] flex items-center gap-1">
                    <DollarSign size={20} />
                    <span>{totalSaaSMonthlyRevenue.toLocaleString()} QAR</span>
                  </h3>
                  <p className="text-[9px] text-gray-400 mt-2">Aggregated from active subscriptions</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#e6e2de]">
                  <span className="text-[10px] text-[#6e6b66] block uppercase tracking-wider mb-1">{isRtl ? "عائدات الترويج والإعلانات" : "Boosted Ad Revenue"}</span>
                  <h3 className="text-2xl font-serif font-bold text-[#1a1918] flex items-center gap-1">
                    <DollarSign size={20} className="text-[#6e6b66]" />
                    <span>{totalAdvertisingRevenue.toLocaleString()} QAR</span>
                  </h3>
                  <p className="text-[9px] text-[#6e6b66] mt-2">{campaigns.filter(c => c.status === "ACTIVE").length} {isRtl ? "حملة نشطة من" : "active campaigns of"} {campaigns.length}</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#e6e2de]">
                  <span className="text-[10px] text-[#6e6b66] block uppercase tracking-wider mb-1">{isRtl ? "إجمالي العقارات بالمنصة" : "Total Platform Listings"}</span>
                  <h3 className="text-2xl font-serif font-bold text-[#1a1918]">{properties.length}</h3>
                  <p className="text-[9px] text-[#6e6b66] mt-2">
                    {properties.filter(p => p.verificationStatus === VerificationStatus.APPROVED).length} verified & published
                    {" • "}{properties.reduce((sum, p) => sum + (p.views || 0), 0).toLocaleString()} {isRtl ? "مشاهدة إجمالية" : "total views"}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-[#e6e2de]">
                  <span className="text-[10px] text-[#6e6b66] block uppercase tracking-wider mb-1">{isRtl ? "قنوات التواصل المسجلة" : "Capturing Client Leads"}</span>
                  <h3 className="text-2xl font-serif font-bold text-[#1a1918]">{leads.length}</h3>
                  <p className="text-[9px] text-emerald-600 font-bold mt-2">
                    {leads.length > 0 ? `${Math.round((leads.filter(l => l.agentId).length / leads.length) * 100)}% ${isRtl ? "موجهة لوكيل" : "routed to an agent"}` : (isRtl ? "لا يوجد عملاء محتملون بعد" : "No leads yet")}
                  </p>
                </div>
              </div>

              {/* Users by type + Listings by status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                      <Users size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "إجمالي المستخدمين حسب النوع" : "Total Users by Type"}</span>
                    </h4>
                  </div>
                  <div className="divide-y divide-[#f2ede8]">
                    {usersByType.map(row => (
                      <div key={row.label.en} className="p-3 flex items-center justify-between">
                        <span className="text-[#6e6b66]">{isRtl ? row.label.ar : row.label.en}</span>
                        <span className="font-bold text-[#1a1918]">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                      <Layers size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "إجمالي العقارات حسب الحالة" : "Total Listings by Status"}</span>
                    </h4>
                  </div>
                  <div className="divide-y divide-[#f2ede8]">
                    {listingStatusCounts.map(row => (
                      <div key={row.status} className="p-3 flex items-center justify-between">
                        <span className="text-[#6e6b66]">{row.status.replace(/_/g, " ")}</span>
                        <span className="font-bold text-[#1a1918]">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pending applications by stage + Active vs expired subscriptions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                      <ClipboardList size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "الطلبات المعلقة حسب المرحلة" : "Pending Applications by Stage"}</span>
                    </h4>
                  </div>
                  <div className="divide-y divide-[#f2ede8]">
                    {applicationsByStage.map(row => (
                      <div key={row.stage} className="p-3 flex items-center justify-between">
                        <span className="text-[#6e6b66]">{row.stage.replace(/_/g, " ")}</span>
                        <span className="font-bold text-[#1a1918]">{row.count}</span>
                      </div>
                    ))}
                    {pendingApplications.length === 0 && (
                      <p className="p-4 text-center text-[#6e6b66]">{isRtl ? "لا توجد طلبات معلقة." : "No pending applications."}</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                      <CalendarRange size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "الاشتراكات النشطة مقابل المنتهية" : "Active vs Expired Subscriptions"}</span>
                    </h4>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg">
                      <p className="text-[10px] text-[#6e6b66] uppercase tracking-wider">{isRtl ? "المؤسسات" : "Organizations"}</p>
                      <p className="mt-1"><span className="font-bold text-emerald-700">{orgsActiveSubs}</span> {isRtl ? "نشط" : "active"} / <span className="font-bold text-[#1a1918]">{orgsInactiveSubs}</span> {isRtl ? "غير نشط" : "inactive"}</p>
                      <p className="text-[10px] text-red-600 mt-1">{orgsExpiredSubs} {isRtl ? "منتهي فعليًا" : "past expiry date"}</p>
                    </div>
                    <div className="p-3 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg">
                      <p className="text-[10px] text-[#6e6b66] uppercase tracking-wider">{isRtl ? "الوكلاء المستقلون" : "Independent Agents"}</p>
                      <p className="mt-1"><span className="font-bold text-emerald-700">{indAgentsActiveSubs}</span> {isRtl ? "نشط" : "active"} / <span className="font-bold text-[#1a1918]">{indAgentsInactiveSubs}</span> {isRtl ? "غير نشط" : "inactive"}</p>
                      <p className="text-[10px] text-red-600 mt-1">{indAgentsExpiredSubs} {isRtl ? "منتهي فعليًا" : "past expiry date"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leads this month + conversion rate, Current-period ad billing total */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                <div className="bg-white rounded-xl border border-[#e6e2de] p-4 space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-[#bf9b30]" />
                    <span>{isRtl ? "العملاء المحتملون هذا الشهر ومعدل التحويل" : "Leads This Month & Conversion Rate"}</span>
                  </h4>
                  <div className="flex items-center gap-6 pt-1">
                    <div>
                      <p className="text-2xl font-serif font-bold text-[#1a1918]">{leadsThisMonth.length}</p>
                      <p className="text-[10px] text-[#6e6b66]">{isRtl ? "عميل محتمل هذا الشهر" : "leads this month"}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-serif font-bold text-[#bf9b30]">{leadConversionRateThisMonth}%</p>
                      <p className="text-[10px] text-[#6e6b66]">{isRtl ? "معدل التحويل (تم الفوز)" : "conversion rate (CONVERTED)"}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-[#e6e2de] p-4 space-y-2">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                    <DollarSign size={14} className="text-[#bf9b30]" />
                    <span>{isRtl ? "فوترة الإعلانات للفترة الحالية" : "Current-Period Ad Billing"}</span>
                  </h4>
                  <div className="flex items-center gap-6 pt-1">
                    <div>
                      <p className="text-2xl font-serif font-bold text-[#1a1918]">{currentPeriodAdTotal.toLocaleString()} QAR</p>
                      <p className="text-[10px] text-[#6e6b66]">{currentBillingPeriod} {isRtl ? "الإجمالي" : "total"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-emerald-700 font-bold">{currentPeriodAdSettled.toLocaleString()} QAR {isRtl ? "مسواة" : "settled"}</p>
                      <p className="text-[11px] text-amber-700 font-bold">{currentPeriodAdUnsettled.toLocaleString()} QAR {isRtl ? "غير مسواة" : "unsettled"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent activity feed */}
              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center justify-between">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                    <Clock size={14} className="text-[#bf9b30]" />
                    <span>{isRtl ? "أحدث النشاطات على المنصة" : "Recent Platform Activity"}</span>
                  </h4>
                  <span className="text-[10px] text-[#6e6b66]">{isRtl ? "آخر 15 حدثًا" : "Last 15 events"}</span>
                </div>
                <div className="divide-y divide-[#f2ede8] max-h-72 overflow-y-auto">
                  {recentActivityFeed.length === 0 ? (
                    <p className="p-6 text-center text-[#6e6b66]">{isRtl ? "لا توجد نشاطات بعد." : "No activity recorded yet."}</p>
                  ) : (
                    recentActivityFeed.map(log => (
                      <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-[#fcfbfa]">
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#1a1918]">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-[#6e6b66]">{isRtl ? "منفذ العملية:" : "Actor:"} {log.actorName} ({log.actorRole})</p>
                        </div>
                        <span className="text-[10px] text-[#a8a4a0] shrink-0">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ADMIN SECURITY PORTAL (Two-Factor Authentication Setup) */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-[#f2ede8] pb-3">
                  <div>
                    <h4 className="font-serif text-sm font-bold text-[#1a1918] flex items-center gap-1.5">
                      <CheckCircle size={16} className="text-[#bf9b30]" />
                      <span>{isRtl ? "المصادقة الثنائية المعززة لحساب المشرف" : "Multi-Factor Authentication (MFA) Security Control"}</span>
                    </h4>
                    <p className="text-[11px] text-[#6e6b66] mt-0.5">
                      {isRtl 
                        ? "قم بتأمين حساب المشرف الخاص بك عن طريق تفعيل المصادقة الثنائية (TOTP 2FA) لحماية البيانات الحساسة." 
                        : "Reinforce platform control nodes by provisioning a cryptographic TOTP authenticator device."}
                    </p>
                  </div>
                  {!show2faSetup && (
                    <div className="shrink-0">
                      {adminUser?.twoFactorEnabled ? (
                        <button
                          onClick={() => setShowDisable2faConfirm(true)}
                          disabled={tfaLoading}
                          className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {isRtl ? "إيقاف المصادقة الثنائية" : "Disable TOTP 2FA"}
                        </button>
                      ) : (
                        <button
                          onClick={handleStart2faSetup}
                          disabled={tfaLoading}
                          className="px-3.5 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] hover:text-[#1a1918] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {isRtl ? "تفعيل المصادقة الثنائية" : "Configure TOTP 2FA"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {tfaError && (
                  <div className="p-3 bg-red-50 text-red-800 border border-red-100 rounded-lg text-xs">
                    {tfaError}
                  </div>
                )}

                {showDisable2faConfirm && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl space-y-3">
                    <p className="text-xs text-red-800 font-bold">
                      {isRtl ? "أدخل كلمة المرور الحالية لتأكيد إيقاف المصادقة الثنائية." : "Enter your current password to confirm disabling Two-Factor Authentication."}
                    </p>
                    <input
                      type="password"
                      value={disable2faPassword}
                      onChange={(e) => setDisable2faPassword(e.target.value)}
                      placeholder={isRtl ? "كلمة المرور" : "Password"}
                      className="w-full px-3 py-2 border border-red-200 rounded-lg text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDisable2fa}
                        disabled={tfaLoading || !disable2faPassword}
                        className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {isRtl ? "تأكيد الإيقاف" : "Confirm Disable"}
                      </button>
                      <button
                        onClick={() => { setShowDisable2faConfirm(false); setDisable2faPassword(""); setTfaError(""); }}
                        className="px-3.5 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        {isRtl ? "إلغاء" : "Cancel"}
                      </button>
                    </div>
                  </div>
                )}

                {show2faSetup && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-[#fdfcfb] rounded-xl border border-[#e6e2de] items-center">
                    <div className="flex justify-center bg-white p-3 rounded-lg border border-[#e6e2de]">
                      <img src={tfaQrCode} alt="TOTP QR Code" className="w-40 h-40 object-contain" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <h5 className="font-bold text-xs text-[#1a1918]">{isRtl ? "تعليمات الإعداد السريع" : "Quick Enrollment Instructions"}</h5>
                      <ol className="list-decimal list-inside text-[11px] text-[#6e6b66] space-y-1 leading-relaxed">
                        <li>{isRtl ? "افتح تطبيق Google Authenticator أو 1Password." : "Open your preferred mobile verification app (Google Authenticator, Duo, etc.)."}</li>
                        <li>{isRtl ? "قم بمسح رمز الاستجابة السريعة (QR Code) الظاهر على اليسار." : "Scan the visual QR matrix on the left side of this secure card."}</li>
                        <li>{isRtl ? "أدخل الرمز المكون من 6 أرقام لتأكيد المزامنة." : "Type the temporary 6-digit synchronization code in the field below to verify."}</li>
                      </ol>
                      
                      <form onSubmit={handleEnable2fa} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          pattern="[0-9]{6}"
                          value={tfaCode}
                          onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ""))}
                          placeholder="e.g. 123456"
                          className="px-3 py-2 bg-white border border-[#e6e2de] focus:border-[#bf9b30] focus:outline-none rounded-lg text-xs font-bold tracking-widest text-center"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={tfaLoading}
                            className="px-3.5 py-2 bg-[#1a1918] hover:bg-[#bf9b30] hover:text-[#1a1918] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex-grow sm:flex-grow-0"
                          >
                            {isRtl ? "تأكيد وتفعيل" : "Verify & Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShow2faSetup(false); setTfaSecret(""); setTfaQrCode(""); setTfaCode(""); }}
                            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-[#e6e2de] text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {isRtl ? "إلغاء" : "Cancel"}
                          </button>
                        </div>
                      </form>
                      <div className="text-[10px] text-gray-400">
                        <span>Secret Key: </span>
                        <code className="bg-[#f2ede8] px-1 py-0.5 rounded text-gray-600 font-mono select-all">{tfaSecret}</code>
                      </div>
                    </div>
                  </div>
                )}

                {!show2faSetup && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#6e6b66]">{isRtl ? "الحالة الحالية للأمان:" : "Node Security Status:"}</span>
                    {adminUser?.twoFactorEnabled ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        {isRtl ? "مفعل ومحمي" : "ENABLED & SECURE"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                        {isRtl ? "غير مفعل (يوصى بالتفعيل)" : "DISABLED (VULNERABLE)"}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* DATABASE MANAGEMENT & BACKUPS */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                <div>
                  <h4 className="font-serif text-sm font-bold text-[#1a1918] flex items-center gap-1.5">
                    <FolderTree size={16} className="text-[#bf9b30]" />
                    <span>{isRtl ? "إدارة قاعدة البيانات والنسخ الاحتياطي" : "Database Management & Backup Operations"}</span>
                  </h4>
                  <p className="text-[11px] text-[#6e6b66] mt-0.5">
                    {isRtl 
                      ? "قم بتنزيل نسخة احتياطية كاملة بصيغة JSON لجميع الجداول والبيانات الأساسية على جهازك كإجراء وقائي إضافي." 
                      : "Generate and download an application-level manual snapshot backup of all core relational tables to keep a secure local copy."}
                  </p>
                </div>
                <div>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("token") || "";
                        const res = await fetch("/api/admin/export", {
                          headers: {
                            "Authorization": `Bearer ${token}`
                          }
                        });
                        if (!res.ok) {
                          throw new Error(isRtl ? "فشل استخراج البيانات" : "Failed to download backup");
                        }
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `nerou_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                        showToast(isRtl ? "تم تحميل النسخة الاحتياطية بنجاح!" : "Database backup generated and downloaded successfully!");
                      } catch (err: any) {
                        console.error(err);
                        showToast(err.message || "An error occurred during database export");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#bf9b30] hover:bg-[#967923] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>{isRtl ? "تحميل نسخة JSON الاحتياطية" : "Download JSON Database Export"}</span>
                  </button>
                </div>
              </div>

              {/* Audit logs & Recent reports queue */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
                {/* Audit Logs */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex justify-between items-center">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "سجل تدقيق العمليات والعمليات الأمنية" : "Cryptographic Immutable Audit Logs"}</h4>
                    <span className="px-2 py-0.5 bg-[#f2ede8] rounded text-[10px] text-[#6e6b66]">Live Stream</span>
                  </div>
                  <div className="divide-y divide-[#f2ede8] max-h-72 overflow-y-auto">
                    {auditLogs.map(log => (
                      <div key={log.id} className="p-3 flex items-start justify-between gap-4 hover:bg-[#fcfbfa]">
                        <div className="space-y-0.5">
                          <p className="font-bold text-[#1a1918]">{log.action}</p>
                          <p className="text-[10px] text-[#6e6b66]">{isRtl ? "منفذ العملية:" : "Actor:"} {log.actorName} ({log.actorRole}) • Target: {log.targetType} ({log.targetId})</p>
                        </div>
                        <span className="text-[10px] text-[#a8a4a0] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Abuse Reports */}
                <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                  <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "بلاغات إساءة الاستخدام والأسعار الوهمية" : "Moderation & Spam Queue"}</h4>
                  </div>
                  <div className="divide-y divide-[#f2ede8]">
                    {reports.length === 0 ? (
                      <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد أي بلاغات حاليًا." : "No listings reports submitted."}</p>
                    ) : (
                      reports.map(report => (
                        <div key={report.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-red-700 uppercase tracking-wider text-[10px] bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              {report.reason}
                            </span>
                            <span className="text-[10px] text-[#6e6b66]">{report.reporterName}</span>
                          </div>
                          <p className="text-[#6e6b66] leading-relaxed italic">"{report.details}"</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VERIFICATIONS SUB-TAB */}
          {activeSubTab === "verifications" && (
            <div className="space-y-6 text-xs">
              {/* Organization queue */}
              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "توثيق شركات التطوير والمكاتب العقارية" : "Pending Tenant Organization Approvals"}</h4>
                </div>
                <div className="divide-y divide-[#f2ede8]">
                  {pendingOrgs.length === 0 ? (
                    <p className="p-6 text-center text-[#6e6b66]">{isRtl ? "كل الشركات والمطورين موثقين." : "All agencies and developers verify status verified."}</p>
                  ) : (
                    pendingOrgs.map(org => (
                      <div key={org.id} className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-[#1a1918]">{org.name}</p>
                          <p className="text-[#6e6b66]">{org.email} | Type: {org.type}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerifyOrg(org.id, VerificationStatus.APPROVED)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleVerifyOrg(org.id, VerificationStatus.REJECTED)}
                            className="px-3 py-1 bg-red-600 text-white rounded font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Per-document verification review (FIX 1: Document Verification System) */}
              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918]">
                    {isRtl ? "مراجعة مستندات التوثيق" : "Document Verification Review"}
                  </h4>
                  <p className="text-[10px] text-[#6e6b66] mt-0.5">
                    {isRtl
                      ? "يصبح الحساب موثقًا بالكامل فقط عند اعتماد جميع المستندات المطلوبة."
                      : "An account becomes fully VERIFIED only once every required document for its role is APPROVED."}
                  </p>
                </div>
                <div className="divide-y divide-[#f2ede8]">
                  {documentApplicantGroups.length === 0 ? (
                    <p className="p-8 text-center text-[#6e6b66]">
                      {isRtl ? "لا توجد مستندات مقدمة بعد." : "No documents have been submitted yet."}
                    </p>
                  ) : (
                    documentApplicantGroups.map(group => (
                      <div key={group.key} className="p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#1a1918]">{group.applicantName}</span>
                          <span className="text-[10px] bg-[#f2ede8] text-[#6e6b66] px-1.5 py-0.5 rounded">{group.context}</span>
                          <span className="text-[10px] text-[#6e6b66]">{group.applicantEmail}</span>
                        </div>
                        <div className="space-y-2">
                          {group.docs.map((doc: any) => (
                            <div key={doc.id} className="p-3 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg space-y-2">
                              <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                  <p className="font-semibold text-[#1a1918]">{doc.documentType.replace(/_/g, " ")}</p>
                                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#bf9b30] underline">
                                    {isRtl ? "عرض المستند" : "View document"}
                                  </a>
                                  {doc.expiryDate && (
                                    <span className="text-[10px] text-[#6e6b66] ml-2">
                                      {isRtl ? "ينتهي في: " : "Expires: "}{new Date(doc.expiryDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    doc.status === "APPROVED"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : doc.status === "REJECTED"
                                      ? "bg-rose-50 text-rose-700"
                                      : doc.status === "EXPIRED"
                                      ? "bg-orange-50 text-orange-700"
                                      : "bg-amber-50 text-amber-700"
                                  }`}
                                >
                                  {doc.status}
                                </span>
                              </div>

                              {doc.status === "REJECTED" && doc.rejectionReason && (
                                <p className="text-[10px] text-rose-700">
                                  <strong>{isRtl ? "سبب الرفض: " : "Reason: "}</strong>{doc.rejectionReason}
                                </p>
                              )}

                              {(doc.status === "PENDING" || doc.status === "EXPIRED") && (
                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  <button
                                    onClick={() => handleReviewDocument(doc.id, "APPROVED")}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer"
                                  >
                                    {isRtl ? "اعتماد" : "Approve"}
                                  </button>
                                  {rejectingDocId === doc.id ? (
                                    <>
                                      <input
                                        type="text"
                                        value={rejectionReasonDraft}
                                        onChange={(e) => setRejectionReasonDraft(e.target.value)}
                                        placeholder={isRtl ? "سبب الرفض (مطلوب)" : "Rejection reason (required)"}
                                        className="px-2 py-1 bg-white border border-[#e6e2de] rounded text-[10px] w-56"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleReviewDocument(doc.id, "REJECTED", rejectionReasonDraft)}
                                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
                                      >
                                        {isRtl ? "تأكيد الرفض" : "Confirm Reject"}
                                      </button>
                                      <button
                                        onClick={() => { setRejectingDocId(""); setRejectionReasonDraft(""); }}
                                        className="px-2 py-1 text-[#6e6b66] hover:text-[#1a1918] cursor-pointer"
                                      >
                                        {isRtl ? "إلغاء" : "Cancel"}
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => { setRejectingDocId(doc.id); setRejectionReasonDraft(""); }}
                                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer"
                                    >
                                      {isRtl ? "رفض" : "Reject"}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* NEW APPLICATIONS SUB-TAB (FIX3: onboarding approval-gate pipeline) */}
          {activeSubTab === "applications" && (
            <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
              <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center justify-between">
                <h4 className="font-serif text-sm font-semibold text-[#1a1918]">
                  {isRtl ? "طلبات الانضمام الجديدة" : "New Applications Pipeline"}
                </h4>
                <span className="text-[10px] text-[#6e6b66]">
                  {pendingApplications.length} {isRtl ? "قيد المعالجة" : "in progress"}
                </span>
              </div>
              {pendingApplications.length === 0 ? (
                <p className="p-8 text-center text-[#6e6b66] text-xs">
                  {isRtl ? "لا توجد طلبات انضمام قيد الانتظار حالياً." : "No pending applications right now."}
                </p>
              ) : (
                <div className="divide-y divide-[#f2ede8] text-xs">
                  {pendingApplications.map(app => {
                    const appOrg = organizations.find(o => o.id === app.orgId);
                    const effType = app.role === UserRole.AGENT ? getEffectiveAgentType(app) : undefined;
                    const isConfirming = confirmingAppId === app.id;
                    return (
                      <div key={app.id} className="p-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#1a1918]">{app.fullName}</span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#f2ede8] text-[#6e6b66]">
                                {app.role}{effType ? ` / ${effType}` : ""}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                                {app.applicationStatus}
                              </span>
                            </div>
                            <p className="text-[#6e6b66]">{app.email}{appOrg ? ` • ${appOrg.name}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {app.applicationStatus === ApplicationStatus.PENDING_APPROVAL && (
                              <button
                                onClick={() => handleMoveToAwaitingPayment(app.id)}
                                className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer"
                              >
                                {isRtl ? "نقل إلى انتظار الدفع" : "Move to Awaiting Payment"}
                              </button>
                            )}
                            {app.applicationStatus === ApplicationStatus.AWAITING_PAYMENT && (
                              <button
                                onClick={() => {
                                  if (isConfirming) {
                                    setConfirmingAppId("");
                                    return;
                                  }
                                  setConfirmingAppId(app.id);
                                  setAppPlanId((appOrg ? appOrg.subscriptionPlanId : app.subscriptionPlanId) || "");
                                  setAppExpiryDate(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0]);
                                  setAppActivationMethod("MANUAL");
                                  setAppNotes("");
                                }}
                                className="px-3 py-1.5 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] text-[#1a1918] font-semibold rounded-lg cursor-pointer"
                              >
                                {isConfirming ? (isRtl ? "إغلاق النموذج" : "Close Form") : (isRtl ? "تأكيد الدفع" : "Confirm Payment")}
                              </button>
                            )}
                            {(app.applicationStatus === ApplicationStatus.AWAITING_DOCUMENTS || app.applicationStatus === ApplicationStatus.UNDER_VERIFICATION) && (
                              <span className="text-[10px] text-[#6e6b66] italic">
                                {isRtl ? "راجع المستندات من طابور التوثيق" : "Review documents in Verifications Queue"}
                              </span>
                            )}
                          </div>
                        </div>

                        {isConfirming && app.applicationStatus === ApplicationStatus.AWAITING_PAYMENT && (
                          <div className="bg-[#fbfaf8] border border-[#e6e2de] rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "الخطة" : "Plan"}</label>
                              <select
                                value={appPlanId}
                                onChange={(e) => setAppPlanId(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg text-xs"
                              >
                                <option value="">-- {isRtl ? "اختر خطة" : "Select Plan"} --</option>
                                {plans.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.priceMonthly} QAR/mo)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "تاريخ الانتهاء" : "Expiry Date"}</label>
                              <input
                                type="date"
                                value={appExpiryDate}
                                onChange={(e) => setAppExpiryDate(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "طريقة الدفع" : "Activation Method"}</label>
                              <select
                                value={appActivationMethod}
                                onChange={(e) => setAppActivationMethod(e.target.value as any)}
                                className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg text-xs"
                              >
                                <option value="MANUAL">MANUAL</option>
                                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                                <option value="INVOICE">INVOICE</option>
                                <option value="OTHER">OTHER</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "ملاحظات" : "Notes"}</label>
                              <input
                                type="text"
                                value={appNotes}
                                onChange={(e) => setAppNotes(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg text-xs"
                              />
                            </div>
                            <div className="md:col-span-2 flex justify-end">
                              <button
                                onClick={() => handleConfirmApplicationPayment(app)}
                                className="px-4 py-2 bg-[#1a1918] hover:bg-[#bf9b30] text-white font-bold rounded-lg cursor-pointer"
                              >
                                {isRtl ? "تأكيد وتفعيل الاشتراك" : "Confirm & Activate Subscription"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LISTINGS SUB-TAB (FIX 3: after-the-fact moderation, replaces the old pre-publish approval queue) */}
          {activeSubTab === "listings" && (
            <div className="space-y-6 text-xs">
              {flaggedProperties.length > 0 && (
                <div className="bg-white rounded-xl border border-amber-300 overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-200">
                    <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "الإعلانات المميّزة للمراجعة" : "Flagged for Review"}</h4>
                  </div>
                  <div className="divide-y divide-[#f2ede8]">
                    {flaggedProperties.map(prop => (
                      <div key={prop.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div>
                          <p className="font-bold text-[#1a1918]">{prop.title} <span className="text-[10px] text-[#6e6b66]">ID: {prop.listingId}</span></p>
                          <p className="text-[#6e6b66]">{isRtl ? "السبب: " : "Reason: "}{prop.flagReason} — {prop.flaggedDate && new Date(prop.flaggedDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleFlagProperty(prop.id, undefined)} className="px-3 py-1.5 bg-[#1c1a17] hover:bg-[#bf9b30] text-white rounded font-semibold cursor-pointer">
                            {isRtl ? "إلغاء العلامة" : "Clear Flag"}
                          </button>
                          <button onClick={() => handleVerifyProperty(prop.id, VerificationStatus.REJECTED)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer">
                            {isRtl ? "تعليق" : "Suspend"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "جميع الإعلانات" : "All Listings"}</h4>
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    placeholder={isRtl ? "بحث بالعنوان أو رقم الإعلان أو المدينة" : "Search title, listing ID, or city"}
                    className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-[11px] min-w-[220px]"
                  />
                </div>
                <div className="divide-y divide-[#f2ede8] max-h-[600px] overflow-y-auto">
                  {filteredListings.length === 0 ? (
                    <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد نتائج." : "No listings match your search."}</p>
                  ) : (
                    filteredListings.map(prop => (
                      <div key={prop.id} className="p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#1a1918]">{prop.title}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f2ede8] text-[#6e6b66]">{prop.listingStatus}</span>
                            {prop.flaggedForReview && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">{isRtl ? "مُعلّم" : "Flagged"}</span>}
                          </div>
                          <p className="text-[#6e6b66]">{prop.district}, {prop.city} • {prop.price?.toLocaleString()} QAR • {isRtl ? "المشاهدات" : "Views"}: {prop.views || 0}</p>
                        </div>
                        <div className="flex gap-2 flex-wrap items-center">
                          {!prop.flaggedForReview ? (
                            <>
                              <input
                                type="text"
                                value={flagReasonDraft[prop.id] || ""}
                                onChange={(e) => setFlagReasonDraft(prev => ({ ...prev, [prop.id]: e.target.value }))}
                                placeholder={isRtl ? "سبب العلامة" : "Flag reason"}
                                className="px-2 py-1 bg-white border border-[#e6e2de] rounded text-[10px] w-32"
                              />
                              <button
                                disabled={!flagReasonDraft[prop.id]}
                                onClick={() => handleFlagProperty(prop.id, flagReasonDraft[prop.id])}
                                className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded font-semibold cursor-pointer"
                              >
                                {isRtl ? "علّم" : "Flag"}
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleFlagProperty(prop.id, undefined)} className="px-2.5 py-1.5 bg-[#1c1a17] hover:bg-[#bf9b30] text-white rounded font-semibold cursor-pointer">
                              {isRtl ? "إلغاء العلامة" : "Clear Flag"}
                            </button>
                          )}
                          {prop.listingStatus === ListingStatus.SUSPENDED ? (
                            <button onClick={() => handleVerifyProperty(prop.id, VerificationStatus.APPROVED)} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold cursor-pointer">
                              {isRtl ? "استعادة" : "Restore"}
                            </button>
                          ) : (
                            <button onClick={() => handleVerifyProperty(prop.id, VerificationStatus.REJECTED)} className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold cursor-pointer">
                              {isRtl ? "تعليق" : "Suspend"}
                            </button>
                          )}
                          <button onClick={() => handleDeleteProperty(prop.id)} className="px-2.5 py-1.5 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] text-[#1a1918] rounded font-semibold cursor-pointer" title={isRtl ? "حذف" : "Delete"}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* USERS SUB-TAB (FIX 5) */}
          {activeSubTab === "users" && (
            <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
              <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center justify-between gap-3 flex-wrap">
                <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "كل المستخدمين" : "All Users"}</h4>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={isRtl ? "بحث بالاسم أو البريد الإلكتروني" : "Search name or email"}
                  className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-[11px] min-w-[220px]"
                />
              </div>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#fbfaf8] sticky top-0">
                    <tr className="text-[10px] text-[#6e6b66] uppercase">
                      <th className="p-3">{isRtl ? "الاسم" : "Full Name"}</th>
                      <th className="p-3">{isRtl ? "البريد" : "Email"}</th>
                      <th className="p-3">{isRtl ? "الجوال" : "Mobile"}</th>
                      <th className="p-3">{isRtl ? "الشركة" : "Company"}</th>
                      <th className="p-3">{isRtl ? "الدور" : "Role"}</th>
                      <th className="p-3">{isRtl ? "حالة الحساب" : "Account Status"}</th>
                      <th className="p-3">{isRtl ? "حالة التوثيق" : "Verification"}</th>
                      <th className="p-3">{isRtl ? "تاريخ التسجيل" : "Registered"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2ede8]">
                    {users
                      .filter(u => {
                        if (!userSearch.trim()) return true;
                        const q = userSearch.trim().toLowerCase();
                        return u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                      })
                      .map(u => {
                        const org = organizations.find(o => o.id === u.orgId);
                        const effType = u.role === UserRole.AGENT ? getEffectiveAgentType(u) : undefined;
                        const company = org?.name || u.affiliatedAgencyName || "—";
                        return (
                          <tr key={u.id}>
                            <td className="p-3 font-bold text-[#1a1918]">{u.fullName}</td>
                            <td className="p-3 text-[#6e6b66]">{u.email}</td>
                            <td className="p-3 text-[#6e6b66]">{u.phone || "—"}</td>
                            <td className="p-3 text-[#6e6b66]">{company}</td>
                            <td className="p-3">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f2ede8] text-[#6e6b66]">
                                {u.role}{effType ? ` / ${effType}` : ""}
                              </span>
                            </td>
                            <td className="p-3 text-[#6e6b66]">{u.applicationStatus || "ACTIVE"}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${u.verificationStatus === VerificationStatus.APPROVED ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                {u.verificationStatus}
                              </span>
                            </td>
                            <td className="p-3 text-[#6e6b66]">{u.createdDate ? new Date(u.createdDate).toLocaleDateString() : "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEWING REQUESTS SUB-TAB (FIX 7) */}
          {activeSubTab === "viewing_requests" && (
            <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
              <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "طلبات معاينة العقارات" : "Property Viewing Requests"}</h4>
              </div>
              <div className="divide-y divide-[#f2ede8]">
                {viewings.length === 0 ? (
                  <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد طلبات معاينة حالياً." : "No viewing requests yet."}</p>
                ) : (
                  viewings.map(v => {
                    const relatedLead = leads.find(l => l.id === v.leadId);
                    const prop = properties.find(p => p.id === v.propertyId);
                    const agentUser = users.find(u => u.id === v.agentId);
                    return (
                      <div key={v.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#1a1918]">{relatedLead?.visitorName || (isRtl ? "زائر غير معروف" : "Unknown visitor")}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#f2ede8] text-[#6e6b66]">{v.status}</span>
                          </div>
                          <p className="text-[#6e6b66]">
                            {relatedLead?.visitorPhone || "—"} {relatedLead?.visitorEmail ? `• ${relatedLead.visitorEmail}` : ""}
                          </p>
                          <p className="text-[#6e6b66]">
                            {isRtl ? "العقار: " : "Property: "}{prop?.title || v.propertyId} • {isRtl ? "الوكيل: " : "Agent: "}{agentUser?.fullName || v.agentId}
                          </p>
                          <p className="text-[#6e6b66]">
                            {isRtl ? "الموعد المفضل: " : "Preferred: "}{v.preferredDate} {v.preferredTimeSlot} {v.notes ? `• "${v.notes}"` : ""}
                          </p>
                          <p className="text-[10px] text-[#a8a4a0]">{isRtl ? "أُرسل في " : "Submitted "}{new Date(v.createdDate).toLocaleString()}</p>
                        </div>
                        <select
                          value={v.status}
                          onChange={async (e) => {
                            const token = localStorage.getItem("token") || "";
                            const res = await fetch("/api/viewings/status", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                              body: JSON.stringify({ viewingId: v.id, status: e.target.value })
                            });
                            if (res.ok) fetchControlContext();
                          }}
                          className="px-2 py-1.5 bg-white border border-[#e6e2de] rounded text-[10px] font-semibold"
                        >
                          {["REQUESTED", "CONFIRMED", "RESCHEDULED", "COMPLETED", "CANCELLED"].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* LEADS SUB-TAB */}
          {activeSubTab === "leads" && (
            <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
              <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "مراقبة قنوات الاتصالات وتوجيه الصفقات" : "Platform Unified Inquiries & Lead Router Monitor"}</h4>
              </div>
              <div className="divide-y divide-[#f2ede8]">
                {leads.map(lead => (
                  <div key={lead.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1a1918]">{lead.visitorName}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase rounded">
                          {lead.contactMethod}
                        </span>
                      </div>
                      <p className="text-[#6e6b66]">{lead.visitorPhone} | {lead.visitorEmail || "No Email"}</p>
                      <p className="italic text-gray-500">"{lead.message}"</p>
                    </div>

                    <div className="text-right text-[11px] text-[#6e6b66] space-y-0.5 shrink-0">
                      <p>UTM Source: <strong className="text-[#1a1918]">{lead.attribution?.utmSource || "Direct Website"}</strong></p>
                      <p>Routed Broker ID: <strong className="text-[#1a1918]">{lead.agentId || "Fallback platform pool"}</strong></p>
                    </div>

                    <button
                      onClick={() => handleDeleteLead(lead.id)}
                      className="px-3 py-1.5 bg-[#1c1a17] hover:bg-[#33302a] text-white rounded font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                      title={isRtl ? "حذف السجل" : "Delete Lead"}
                    >
                      <Trash2 size={14} />
                      <span>{isRtl ? "حذف" : "Delete"}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMPAIGNS TAB */}
          {activeSubTab === "campaigns" && (
            <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
              <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "طلبات ترويج وتمييز الإعلانات" : "Boosted Ad Campaigns Approval Center"}</h4>
              </div>
              <div className="divide-y divide-[#f2ede8]">
                {pendingCampaigns.length === 0 ? (
                  <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد حملات إعلانية معلقة." : "No ad campaigns pending administrative reviews."}</p>
                ) : (
                  pendingCampaigns.map(camp => (
                    <div key={camp.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[#1a1918] uppercase">{camp.type}</p>
                        <p className="text-[#6e6b66]">Agency ID: {camp.orgId} | Budget: {camp.budget} QAR | Target End Date: {camp.endDate}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReviewCampaign(camp.id, "ACTIVE")}
                          className="px-3 py-1 bg-emerald-600 text-white rounded font-semibold cursor-pointer"
                        >
                          Approve Ad
                        </button>
                        <button
                          onClick={() => handleReviewCampaign(camp.id, "REJECTED")}
                          className="px-3 py-1 bg-red-600 text-white rounded font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* AD BILLING LEDGER TAB (FIX 3: Self-Service Ad Boosts) */}
          {activeSubTab === "ad_billing" && (
            <div className="space-y-6 text-xs">
              {/* Monthly self-service boost caps per plan */}
              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918]">
                    {isRtl ? "الحد الأقصى الشهري للرفع الذاتي حسب الباقة" : "Monthly Self-Service Boost Cap per Plan"}
                  </h4>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map(plan => (
                    <div key={plan.id} className="p-3 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg space-y-2">
                      <p className="font-bold text-[#1a1918]">{plan.name}</p>
                      <p className="text-[#6e6b66]">
                        {isRtl ? "الحالي: " : "Current: "}
                        <strong>{adBoostCaps[plan.id] ?? "—"}</strong> {isRtl ? "رفعة/شهر" : "boosts/mo"}
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder={String(adBoostCaps[plan.id] ?? "")}
                          value={capDrafts[plan.id] ?? ""}
                          onChange={(e) => setCapDrafts(prev => ({ ...prev, [plan.id]: e.target.value }))}
                          className="w-20 px-2 py-1 bg-white border border-[#e6e2de] rounded"
                        />
                        <button
                          onClick={() => handleSaveBoostCap(plan.id)}
                          className="px-3 py-1 bg-[#1a1918] hover:bg-[#bf9b30] text-white rounded font-semibold cursor-pointer"
                        >
                          {isRtl ? "حفظ" : "Save"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Running per-org billing ledger */}
              <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "دفتر إعلانات الترويج الذاتي" : "Ad Billing Ledger"}</h4>
                  <p className="text-[10px] text-[#6e6b66] mt-0.5">
                    {isRtl
                      ? "لا يمكن للمؤسسة تفعيل رفعات جديدة إذا كانت فترة سابقة غير مسواة."
                      : "Organizations with an unsettled prior period are blocked from further self-service activations until resolved."}
                  </p>
                </div>
                <div className="divide-y divide-[#f2ede8]">
                  {(() => {
                    const groups = new Map<string, { orgId: string; billingPeriod: string; total: number; count: number; settled: boolean; charges: any[] }>();
                    adCharges.forEach((c: any) => {
                      const key = `${c.orgId}:${c.billingPeriod}`;
                      const existing = groups.get(key);
                      if (existing) {
                        existing.total += c.amount;
                        existing.count += 1;
                        existing.settled = existing.settled && c.settled;
                        existing.charges.push(c);
                      } else {
                        groups.set(key, { orgId: c.orgId, billingPeriod: c.billingPeriod, total: c.amount, count: 1, settled: c.settled, charges: [c] });
                      }
                    });
                    const sorted = Array.from(groups.values()).sort((a, b) => {
                      if (a.settled !== b.settled) return a.settled ? 1 : -1;
                      return b.billingPeriod.localeCompare(a.billingPeriod);
                    });

                    if (sorted.length === 0) {
                      return <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد رسوم إعلانية مسجلة بعد." : "No ad boost charges recorded yet."}</p>;
                    }

                    return sorted.map(group => {
                      const org = organizations.find(o => o.id === group.orgId);
                      const groupKey = `${group.orgId}:${group.billingPeriod}`;
                      const isExpanded = expandedLedgerGroups.has(groupKey);
                      return (
                        <div key={groupKey} className="p-4 space-y-3">
                          <div className="flex justify-between items-center gap-3 flex-wrap">
                            <div>
                              <p className="font-bold text-[#1a1918]">{org?.name || group.orgId}</p>
                              <p className="text-[#6e6b66]">
                                {isRtl ? "الفترة: " : "Period: "}{group.billingPeriod} • {group.count} {isRtl ? "رفعة" : "boost(s)"} • <strong>{group.total.toLocaleString()} QAR</strong>
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setExpandedLedgerGroups(prev => {
                                    const next = new Set(prev);
                                    if (next.has(groupKey)) next.delete(groupKey);
                                    else next.add(groupKey);
                                    return next;
                                  });
                                }}
                                className="px-2 py-1 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] text-[#1a1918] rounded font-semibold cursor-pointer"
                              >
                                {isExpanded
                                  ? (isRtl ? "إخفاء التفاصيل" : "Hide breakdown")
                                  : (isRtl ? "عرض تفاصيل كل رفعة (ROI)" : "Show per-boost ROI")}
                              </button>
                              {group.settled ? (
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                                  {isRtl ? "مسواة" : "Settled"}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSettleBillingPeriod(group.orgId, group.billingPeriod)}
                                  className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] text-white rounded font-semibold cursor-pointer"
                                >
                                  {isRtl ? "وضع علامة كمسواة" : "Mark as Settled"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Post-Campaign ROI Report: per-charge breakdown (views before/during
                              the boost, leads generated during it, and cost-per-lead) - computed
                              live server-side from Property.viewsByDay and Lead.createdDate, see
                              computeAdChargeRoi() in server.ts / GET /api/ad-charges. */}
                          {isExpanded && (
                            <div className="rounded-lg border border-[#e6e2de] divide-y divide-[#f2ede8] overflow-hidden">
                              {group.charges.map((c: any) => {
                                const prop = properties.find(p => p.id === c.propertyId);
                                const roi = c.roiSummary || { viewsBefore: 0, viewsDuring: 0, leadsGenerated: 0, costPerLead: null };
                                return (
                                  <div key={c.id} className="p-3 bg-[#fdfcfb] flex flex-wrap justify-between items-center gap-2">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-[#1a1918] truncate">
                                        {prop ? (isRtl ? prop.titleAr || prop.title : prop.title) : c.propertyId}
                                        <span className="text-[#a9a49d] font-normal"> • {c.type} • {c.amount.toLocaleString()} QAR</span>
                                      </p>
                                      <p className="text-[#6e6b66]">
                                        {isRtl
                                          ? `المشاهدات قبل الرفع (٧ أيام): ${roi.viewsBefore} • أثناء الرفع: ${roi.viewsDuring} • العملاء المحتملون: ${roi.leadsGenerated}`
                                          : `Views 7d before boost: ${roi.viewsBefore} • during boost: ${roi.viewsDuring} • leads: ${roi.leadsGenerated}`}
                                      </p>
                                    </div>
                                    <span className={`px-2 py-1 rounded font-bold shrink-0 ${roi.costPerLead !== null ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                                      {roi.costPerLead !== null
                                        ? (isRtl ? `${roi.costPerLead.toLocaleString()} ر.ق / عميل محتمل` : `${roi.costPerLead.toLocaleString()} QAR / lead`)
                                        : (isRtl ? "لا يوجد عملاء محتملون بعد" : "No leads yet")}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* AI ANALYTICS & CONFIGURATION TAB */}
          {activeSubTab === "ai" && (
            <div className="space-y-6 text-xs" dir={isRtl ? "rtl" : "ltr"}>
              {/* Header */}
              <div className="bg-white p-5 rounded-xl border border-[#e6e2de] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#1a1918] flex items-center gap-2">
                    <Cpu className="text-[#bf9b30]" size={18} />
                    <span>{isRtl ? "مركز إدارة وتحليلات الذكاء الاصطناعي نيرو فايند" : "Nerou Find AI Management & Analytics Center"}</span>
                  </h3>
                  <p className="text-xs text-[#6e6b66] mt-1">
                    {isRtl ? "تخصيص سلوك محرك البحث، القوانين المتبعة، التحقق من التوافق ومراقبة تكلفة واستهلاك التوكن لنموذج Gemini." : "Customize search personality, enforce business constraints, optimize prompt variables and monitor real-time Gemini LLM tokens."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: AI Configuration Form (CMS) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4">
                  <h4 className="font-serif text-sm font-semibold text-[#1a1918] border-b border-[#f2ede8] pb-2 flex items-center gap-2">
                    <Sliders size={16} className="text-[#bf9b30]" />
                    <span>{isRtl ? "إعدادات تهيئة محرك البحث الذكي (CMS)" : "AI Discovery Configuration Center (CMS)"}</span>
                  </h4>

                  <form onSubmit={handleSaveAiConfig} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "اسم مساعد الذكاء الاصطناعي" : "AI Assistant Name"}</label>
                        <input
                          type="text"
                          value={aiName}
                          onChange={(e) => setAiName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-medium text-[#1a1918]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "النموذج النشط من Google" : "Active Gemini Model"}</label>
                        <select
                          value={aiModel}
                          onChange={(e) => setAiModel(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-medium text-[#1a1918]"
                        >
                          <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</option>
                          <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                          <option value="gemini-2.5-pro">Gemini 2.5 Pro (Precision Context)</option>
                          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم الواتساب الافتراضي للمنصة" : "Platform Default WhatsApp Number"}</label>
                      <input
                        type="text"
                        value={whatsappDefaultNumber}
                        onChange={(e) => setWhatsappDefaultNumber(e.target.value)}
                        placeholder="e.g. 97433334444"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-medium text-[#1a1918]"
                      />
                      <p className="text-[10px] text-[#6e6b66] mt-0.5">
                        {isRtl
                          ? "رقم الواتساب الاحتياطي للاستفسارات عن العقارات في حال لم يحدد الوكيل رقماً خاصاً به."
                          : "The fallback WhatsApp contact number for property inquiries if the specific agent has not set one."}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#fdfcfb] rounded-xl border border-[#e6e2de]">
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نص العلامة المائية للصور" : "Property Watermark Text"}</label>
                        <input
                          type="text"
                          value={watermarkText}
                          onChange={(e) => setWatermarkText(e.target.value)}
                          placeholder="e.g. Nerou Finder"
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-medium text-[#1a1918]"
                        />
                        <p className="text-[10px] text-[#6e6b66] mt-0.5">
                          {isRtl ? "النص المعروض في الزاوية السفلية من صور العقارات المرفوعة." : "The main text brand shown in the bottom corner of uploaded property photos."}
                        </p>
                      </div>
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "شعار العلامة المائية" : "Property Watermark Emblem"}</label>
                        <select
                          value={watermarkLogoType}
                          onChange={(e) => setWatermarkLogoType(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-medium text-[#1a1918]"
                        >
                          <option value="gold_diamond">{isRtl ? "مربع ذهبي فاخر (افتراضي)" : "Luxury Golden Diamond (Default)"}</option>
                          <option value="simple_circle">{isRtl ? "حلقة ذهبية كلاسيكية" : "Classic Gold Circle"}</option>
                          <option value="minimal_line">{isRtl ? "خطوط نيرو البسيطة" : "Minimalist Nerou Stripes"}</option>
                          <option value="none">{isRtl ? "بدون شعار (نص فقط)" : "No Emblem (Text Only)"}</option>
                        </select>
                        <p className="text-[10px] text-[#6e6b66] mt-0.5">
                          {isRtl ? "نمط الأيقونة المصاحبة لنص العلامة المائية." : "The architectural icon style accompanying the watermark text."}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الوصف القصير والمهام" : "AI Role & Short Description"}</label>
                      <input
                        type="text"
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        placeholder="e.g. AI-Powered Property Discovery for Qatar Real Estate"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "شخصية وأسلوب المساعد" : "AI Persona & Character Prompt"}</label>
                      <textarea
                        rows={3}
                        value={aiPersonality}
                        onChange={(e) => setAiPersonality(e.target.value)}
                        placeholder="Define how the AI answers, its tone, and style..."
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] font-sans"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "قواعد المطابقة والقيود المباشرة" : "Enforced Search Match Rules"}</label>
                      <textarea
                        rows={2}
                        value={aiRules}
                        onChange={(e) => setAiRules(e.target.value)}
                        placeholder="Enter direct constraints, e.g. strict QAR values, only existing list..."
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المواضيع المحظورة عقاريًا" : "Restricted Topics / Compliance Blocklist"}</label>
                        <textarea
                          rows={2}
                          value={restrictedTopics}
                          onChange={(e) => setRestrictedTopics(e.target.value)}
                          placeholder="e.g. Financial advice, direct legal contracts representation..."
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "إخلاء المسؤولية المالي والمهني" : "Legal Disclaimers & Disclosures"}</label>
                        <textarea
                          rows={2}
                          value={aiDisclaimers}
                          onChange={(e) => setAiDisclaimers(e.target.value)}
                          placeholder="Note: Nerou Finder is a technology-first discovery marketplace and does not act as a broker..."
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">
                          {isRtl ? "درجة الحرارة (العشوائية مقابل الدقة)" : "Temperature (Creativity vs. Precision)"} ({aiTemperature})
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={aiTemperature}
                          onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#e6e2de] rounded-lg appearance-none cursor-pointer accent-[#bf9b30]"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-[#6e6b66] mb-1">
                          {isRtl ? "الحد الأقصى للتوكن الصادر" : "Max Output Tokens"} ({aiMaxTokens})
                        </label>
                        <input
                          type="number"
                          value={aiMaxTokens}
                          onChange={(e) => setAiMaxTokens(parseInt(e.target.value) || 1000)}
                          className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isSavingAiConfig}
                        className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg disabled:bg-gray-400 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingAiConfig ? (
                          <>
                            <RefreshCw className="animate-spin" size={13} />
                            <span>{isRtl ? "جاري الحفظ..." : "Saving..."}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={13} />
                            <span>{isRtl ? "حفظ التغييرات وتطبيقها" : "Save and Deploy Configuration"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right side: Token Tracker & Analytics */}
                <div className="space-y-6">
                  {/* Token Cost Tracker */}
                  <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                    <h4 className="font-serif text-sm font-bold text-[#1a1918] flex items-center gap-1.5">
                      <Zap size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "متتبع استهلاك توكن Gemini" : "Gemini LLM Token Tracker"}</span>
                    </h4>
                    <div className="h-36 bg-[#fdfcfb] rounded-lg border border-[#e6e2de] p-4 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#6e6b66] uppercase block">{isRtl ? "التكلفة التراكمية اليوم" : "Cumulative cost today"}</span>
                        <span className="text-xl font-mono font-bold text-[#1a1918]">0.082 USD</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[#6e6b66]">
                          <span>{isRtl ? "الحد الأقصى الشهري للذكاء الاصطناعي" : "Monthly budget limit (50.00 USD)"}</span>
                          <span>0.16%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#bf9b30]" style={{ width: "2%" }}></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Search Analytics */}
                  <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                    <h4 className="font-serif text-sm font-bold text-[#1a1918] flex items-center gap-1.5">
                      <Activity size={14} className="text-[#bf9b30]" />
                      <span>{isRtl ? "مؤشرات أداء محرك البحث نيرو" : "AI Search Engine KPIs"}</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="bg-[#fdfcfb] border border-[#e6e2de] p-2.5 rounded-lg">
                        <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "البحوث اليوم" : "Searches Today"}</span>
                        <span className="text-base font-bold text-[#1a1918]">284</span>
                      </div>
                      <div className="bg-[#fdfcfb] border border-[#e6e2de] p-2.5 rounded-lg">
                        <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "معدل النجاح" : "Success Rate"}</span>
                        <span className="text-base font-bold text-emerald-600">94.8%</span>
                      </div>
                      <div className="bg-[#fdfcfb] border border-[#e6e2de] p-2.5 rounded-lg">
                        <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "بدون نتائج" : "Zero Results"}</span>
                        <span className="text-base font-bold text-yellow-600">12</span>
                      </div>
                      <div className="bg-[#fdfcfb] border border-[#e6e2de] p-2.5 rounded-lg">
                        <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "التحويل للواتساب" : "WhatsApp Convert"}</span>
                        <span className="text-base font-bold text-[#bf9b30]">14.2%</span>
                      </div>
                    </div>

                    {/* Popular searches taxonomy demand gaps */}
                    <div className="space-y-2 pt-2 border-t border-[#f2ede8]">
                      <span className="font-semibold text-[#1a1918] block">{isRtl ? "المناطق الأكثر طلبًا بالذكاء الاصطناعي" : "Most Searched Locations (AI)"}</span>
                      <div className="space-y-1.5">
                        <div>
                          <div className="flex justify-between text-[10px] text-[#6e6b66] mb-0.5">
                            <span>{isRtl ? "اللؤلؤة قطر" : "Pearl Qatar"}</span>
                            <span>40%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: "40%" }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-[#6e6b66] mb-0.5">
                            <span>{isRtl ? "لوسيل" : "Lusail"}</span>
                            <span>35%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: "35%" }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-[#6e6b66] mb-0.5">
                            <span>{isRtl ? "الخليج الغربي" : "West Bay"}</span>
                            <span>15%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500" style={{ width: "15%" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HEALTH TAB */}
          {activeSubTab === "health" && (
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {health && Object.entries(health).map(([provider, status]) => {
                  if (provider === "lastCheck") return null;
                  return (
                    <div key={provider} className="bg-white p-4 rounded-xl border border-[#e6e2de] flex flex-col justify-between h-28">
                      <div>
                        <span className="text-[10px] text-[#6e6b66] uppercase block font-bold">{provider} Provider</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold mt-1 ${
                          status === "OPERATIONAL" ? "text-emerald-600" : "text-amber-500"
                        }`}>
                          ● {status}
                        </span>
                      </div>
                      <div className="flex gap-1 border-t border-[#f2ede8] pt-2">
                        <button
                          onClick={() => handleUpdateHealth(provider, "OPERATIONAL")}
                          className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-bold rounded"
                        >
                          Reset Live
                        </button>
                        <button
                          onClick={() => handleUpdateHealth(provider, "DEGRADED")}
                          className="px-1.5 py-0.5 bg-red-50 text-red-700 text-[8px] font-bold rounded"
                        >
                          Sim Fail
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS & BILLING TAB */}
          {activeSubTab === "subscription" && (
            <div className="space-y-8 text-xs">
              {/* TOP SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#fbfaf8] p-5 rounded-xl border border-[#e6e2de] space-y-1">
                  <span className="text-[10px] text-[#6e6b66] uppercase font-bold tracking-wider">{isRtl ? "إجمالي المنشآت النشطة" : "Active SaaS Tenants"}</span>
                  <h3 className="text-3xl font-serif font-bold text-[#1a1918]">
                    {organizations.length} <span className="text-xs font-sans text-[#6e6b66] font-normal">Registered Orgs</span>
                  </h3>
                </div>
                <div className="bg-[#fbfaf8] p-5 rounded-xl border border-[#e6e2de] space-y-1">
                  <span className="text-[10px] text-[#6e6b66] uppercase font-bold tracking-wider">{isRtl ? "خطط الأسعار النشطة" : "Configured SaaS Plans"}</span>
                  <h3 className="text-3xl font-serif font-bold text-[#1a1918]">
                    {plans.length} <span className="text-xs font-sans text-[#6e6b66] font-normal">Active Plan Types</span>
                  </h3>
                </div>
                <div className="bg-[#fbfaf8] p-5 rounded-xl border border-[#e6e2de] space-y-1">
                  <span className="text-[10px] text-[#6e6b66] uppercase font-bold tracking-wider">{isRtl ? "التشغيل والفوترة" : "Core Billing Class"}</span>
                  <h3 className="text-xl font-serif font-bold text-emerald-600">
                    {isRtl ? "مستقل / فوترة يدوية آمنة" : "Independent Manual Billing"}
                  </h3>
                  <p className="text-[9px] text-[#6e6b66]">{isRtl ? "لا يتطلب بوابات دفع وسيطة غير مستقرة" : "Zero credit-card gateway dependencies"}</p>
                </div>
              </div>

              {/* DYNAMIC FORMS SECTION */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT: Plans and Allocation Forms */}
                <div className="lg:col-span-7 space-y-8">
                  
                  {/* MANUAL SUBSCRIPTION ALLOCATOR FORM */}
                  <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                    <h4 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-3 bg-[#bf9b30] rounded-full inline-block"></span>
                      <span>{isRtl ? "تخصيص وتحديث الاشتراكات يدويًا للمؤسسات" : "Manual SaaS Subscription Allocator & Override"}</span>
                    </h4>

                    <form onSubmit={handleOverrideSubscription} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "المؤسسة / العميل" : "Select Organization Tenant"}</label>
                          <select
                            required
                            value={selectedOrgId}
                            onChange={(e) => {
                              setSelectedOrgId(e.target.value);
                              const org = organizations.find(o => o.id === e.target.value);
                              if (org) {
                                setSelectedPlanId(org.subscriptionPlanId);
                                setSubStartDate(org.subscriptionStartDate || new Date().toISOString().split("T")[0]);
                                setSubExpiryDate(org.subscriptionExpiry ? org.subscriptionExpiry.split("T")[0] : "");
                                setSubStatus(org.subscriptionStatus || "ACTIVE");
                                setSubNotes(org.subscriptionNotes || "");
                                setSubActivationMethod(org.subscriptionActivationMethod || "MANUAL");
                              }
                            }}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs"
                          >
                            <option value="">-- Choose Tenant Org --</option>
                            {organizations.map(o => (
                              <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "باقة الاشتراك" : "Assign Plan Template"}</label>
                          <select
                            required
                            value={selectedPlanId}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs"
                          >
                            <option value="">-- Select Plan --</option>
                            {plans.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.priceMonthly} QAR/mo)</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "تاريخ بدء التفعيل" : "Activation Start Date"}</label>
                          <input
                            type="date"
                            required
                            value={subStartDate}
                            onChange={(e) => setSubStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "تاريخ نهاية الصلاحية" : "Subscription Expiry Date"}</label>
                          <input
                            type="date"
                            required
                            value={subExpiryDate}
                            onChange={(e) => setSubExpiryDate(e.target.value)}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "حالة الاشتراك" : "Subscription Status"}</label>
                          <select
                            value={subStatus}
                            onChange={(e) => setSubStatus(e.target.value as any)}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs"
                          >
                            <option value="ACTIVE">ACTIVE (نشط ومفعل)</option>
                            <option value="SUSPENDED">SUSPENDED (موقوف مؤقتًا)</option>
                            <option value="CANCELLED">CANCELLED (ملغي ومغلق)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "طريقة الدفع والتفعيل" : "Activation / Payment Method"}</label>
                          <select
                            value={subActivationMethod}
                            onChange={(e) => setSubActivationMethod(e.target.value as any)}
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs"
                          >
                            <option value="MANUAL">MANUAL Override (تفعيل يدوي إداري)</option>
                            <option value="BANK_TRANSFER">BANK TRANSFER (تحويل بنكي مباشر)</option>
                            <option value="INVOICE">INVOICE Billing (إصدار فاتورة آجلة)</option>
                            <option value="OTHER">OTHER Methods (وسائل إضافية)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-[#6e6b66] mb-1">{isRtl ? "ملاحظات إدارية داخلية للفوترة" : "Administrative In-house Billing Notes"}</label>
                        <textarea
                          rows={2}
                          value={subNotes}
                          onChange={(e) => setSubNotes(e.target.value)}
                          placeholder="Record approval details, check or transaction numbers, or custom service limits promised..."
                          className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg text-xs"
                        ></textarea>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!selectedOrgId}
                          className="px-6 py-2 bg-[#1a1918] hover:bg-[#bf9b30] text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {isRtl ? "تحديث وحفظ اشتراك المنشأة" : "Apply Manual Subscription Plan"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* CONFIGURED PLANS LIST */}
                  <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
                    <div className="flex justify-between items-center border-b border-[#f2ede8] pb-2">
                      <h4 className="font-serif text-sm font-bold text-[#1a1918] flex items-center gap-1.5">
                        <span className="w-1.5 h-3 bg-[#bf9b30] rounded-full inline-block"></span>
                        <span>{isRtl ? "خطط الاشتراك المعرفة بالمنصة" : "Active SaaS Packages"}</span>
                      </h4>
                      <button
                        onClick={() => {
                          setEditingPlan(null);
                          setPlanName("");
                          setPlanPriceMonthly("");
                          setPlanPriceYearly("");
                          setPlanPropertyLimit("");
                          setPlanAgentLimit("");
                          setPlanAiLimit("");
                          setPlanFeaturedListingsLimit("");
                          setIsAddingPlan(true);
                        }}
                        className="px-2.5 py-1 bg-[#1a1918] hover:bg-[#bf9b30] text-white text-[10px] font-bold rounded cursor-pointer"
                      >
                        + Create Package
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {plans.map(plan => (
                        <div key={plan.id} className="p-4 bg-[#fbfaf8] border border-[#e6e2de] rounded-xl flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex justify-between items-start">
                              <h5 className="font-serif font-bold text-[#1a1918] text-xs">{plan.name}</h5>
                              <span className="px-2 py-0.5 bg-yellow-50 text-[#bf9b30] text-[9px] font-mono font-bold rounded">
                                ID: {plan.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#6e6b66] mt-1 space-y-1">
                              <p>💰 {plan.priceMonthly} QAR/mo | {plan.priceYearly} QAR/yr</p>
                              <p>🏨 Max properties limit: <strong className="text-[#1a1918]">{plan.propertyLimit}</strong></p>
                              <p>👥 Max agents allowed: <strong className="text-[#1a1918]">{plan.agentLimit}</strong></p>
                              <p>🤖 Monthly AI requests: <strong className="text-[#1a1918]">{plan.aiLimit}</strong></p>
                            </div>
                          </div>
                          <div className="flex justify-end pt-2 border-t border-[#f2ede8]">
                            <button
                              onClick={() => {
                                setEditingPlan(plan);
                                setPlanName(plan.name);
                                setPlanPriceMonthly(String(plan.priceMonthly));
                                setPlanPriceYearly(String(plan.priceYearly));
                                setPlanPropertyLimit(String(plan.propertyLimit));
                                setPlanAgentLimit(String(plan.agentLimit));
                                setPlanAiLimit(String(plan.aiLimit));
                                setPlanAnalyticsAccess(plan.analyticsAccess);
                                setPlanFeaturedListingsLimit(String(plan.featuredListingsLimit));
                                setIsAddingPlan(true);
                              }}
                              className="text-[10px] text-[#bf9b30] hover:underline font-bold"
                            >
                              Edit limits
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* RIGHT: Plan Creator/Editor and Active Tenant Status list */}
                <div className="lg:col-span-5 space-y-8">
                  
                  {/* PLAN CREATOR / EDITOR FORM */}
                  {isAddingPlan && (
                    <form onSubmit={handleSavePlan} className="bg-white p-5 rounded-xl border border-[#bf9b30]/30 space-y-4 text-xs animate-in slide-in-from-right duration-200">
                      <h4 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-1 flex justify-between items-center">
                        <span>{editingPlan ? "Modify Plan Specifications" : "Create New SaaS Plan"}</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingPlan(false)}
                          className="text-[#6e6b66] hover:text-[#1a1918] font-bold"
                        >
                          ✕
                        </button>
                      </h4>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Package Name</label>
                          <input
                            type="text"
                            required
                            value={planName}
                            onChange={(e) => setPlanName(e.target.value)}
                            placeholder="e.g. Enterprise Developer Pack"
                            className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Price Monthly (QAR)</label>
                            <input
                              type="number"
                              required
                              value={planPriceMonthly}
                              onChange={(e) => setPlanPriceMonthly(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Price Yearly (QAR)</label>
                            <input
                              type="number"
                              required
                              value={planPriceYearly}
                              onChange={(e) => setPlanPriceYearly(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Max Properties</label>
                            <input
                              type="number"
                              required
                              value={planPropertyLimit}
                              onChange={(e) => setPlanPropertyLimit(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Max Agents</label>
                            <input
                              type="number"
                              required
                              value={planAgentLimit}
                              onChange={(e) => setPlanAgentLimit(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">AI limit / month</label>
                            <input
                              type="number"
                              required
                              value={planAiLimit}
                              onChange={(e) => setPlanAiLimit(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-[#6e6b66] mb-1">Featured Ads Limit</label>
                            <input
                              type="number"
                              required
                              value={planFeaturedListingsLimit}
                              onChange={(e) => setPlanFeaturedListingsLimit(e.target.value)}
                              className="w-full px-3 py-1.5 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id="analytics"
                            checked={planAnalyticsAccess}
                            onChange={(e) => setPlanAnalyticsAccess(e.target.checked)}
                          />
                          <label htmlFor="analytics" className="text-[10px] font-medium text-[#6e6b66]">
                            Enable Rich Analytics Dashboard
                          </label>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingPlan(false)}
                          className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg"
                        >
                          Save SaaS Package
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ACTIVE TENANTS MONITOR LIST */}
                  <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
                    <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
                      <h4 className="font-serif text-sm font-semibold text-[#1a1918]">Active Tenants Verification & Expire Tracking</h4>
                    </div>
                    <div className="divide-y divide-[#f2ede8] text-[11px]">
                      {organizations.map(org => {
                        const plan = plans.find(p => p.id === org.subscriptionPlanId);
                        const status = org.subscriptionStatus || "ACTIVE";
                        return (
                          <div key={org.id} className="p-4 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-[#1a1918]">{org.name}</span>
                                <span className="block text-[10px] text-[#6e6b66]">{org.type} | {org.email}</span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                                status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                status === "SUSPENDED" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"
                              }`}>
                                {status}
                              </span>
                            </div>

                            <div className="bg-[#fcfbfa] p-2 rounded-lg border border-[#f2ede8] text-[10px] space-y-1 text-[#6e6b66]">
                              <p>📦 Current tier: <strong className="text-[#1a1918]">{plan?.name || org.subscriptionPlanId}</strong></p>
                              <p>🗓 Expiry: <strong className="text-[#1a1918]">{org.subscriptionExpiry ? org.subscriptionExpiry.split("T")[0] : "No Expiry Set"}</strong></p>
                              {org.subscriptionStartDate && <p>🚀 Activated: <strong className="text-[#1a1918]">{org.subscriptionStartDate}</strong></p>}
                              {org.subscriptionActivationMethod && <p>💳 Method: <strong className="text-[#1a1918]">{org.subscriptionActivationMethod}</strong></p>}
                              {org.subscriptionNotes && <p className="italic text-gray-500 mt-1">Notes: "{org.subscriptionNotes}"</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* LEGAL CMS TAB */}
          {activeSubTab === "legal_cms" && (
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex justify-between items-center border-b border-[#f2ede8] pb-4">
                <div>
                  <h3 className="text-lg font-serif text-[#1a1918] font-semibold flex items-center gap-2">
                    <Scale className="text-[#bf9b30]" size={20} />
                    <span>Legal Documents CMS Console</span>
                  </h3>
                  <p className="text-xs text-[#6e6b66]">Draft, publish, and audit regulatory documents and terms of use under Qatari legislation.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedLegalDoc(null);
                    setLegalSlug("");
                    setLegalTitle("");
                    setLegalTitleAr("");
                    setLegalContent("");
                    setLegalContentAr("");
                    setLegalVersion("1.0.0");
                    setLegalStatus("DRAFT");
                    setLegalReview("PENDING");
                    setIsEditingLegalDoc(true);
                  }}
                  className="px-3 py-1.5 bg-[#bf9b30] text-black text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-[#a68628]"
                >
                  <Plus size={14} />
                  <span>Create Policy</span>
                </button>
              </div>

              {isEditingLegalDoc ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const targetId = selectedLegalDoc?.id || `legal-${Date.now()}`;
                    try {
                      const token = localStorage.getItem("token") || "";
                      const res = await fetch(`/api/admin/legal/${targetId}`, {
                        method: "PUT",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          slug: legalSlug,
                          title: legalTitle,
                          titleAr: legalTitleAr,
                          content: legalContent,
                          contentAr: legalContentAr,
                          version: legalVersion,
                          status: legalStatus,
                          legalReviewStatus: legalReview,
                          actorId: currentUser.id,
                          actorName: currentUser.fullName,
                          actorRole: UserRole.PLATFORM_ADMIN
                        })
                      });
                      if (res.ok) {
                        showToast("Legal document catalogued and archived!");
                        setIsEditingLegalDoc(false);
                        fetchControlContext();
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="space-y-4 p-4 bg-[#fcfbfa] border border-[#e6e2de] rounded-xl text-xs"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Slug Identifier</label>
                      <input
                        type="text"
                        required
                        value={legalSlug}
                        onChange={(e) => setLegalSlug(e.target.value)}
                        placeholder="e.g. privacy-policy"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Version</label>
                      <input
                        type="text"
                        required
                        value={legalVersion}
                        onChange={(e) => setLegalVersion(e.target.value)}
                        placeholder="e.g. 1.5.0"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Title (English)</label>
                      <input
                        type="text"
                        required
                        value={legalTitle}
                        onChange={(e) => setLegalTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Title (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={legalTitleAr}
                        onChange={(e) => setLegalTitleAr(e.target.value)}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Content (English)</label>
                    <textarea
                      required
                      value={legalContent}
                      onChange={(e) => setLegalContent(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Content (Arabic)</label>
                    <textarea
                      required
                      value={legalContentAr}
                      onChange={(e) => setLegalContentAr(e.target.value)}
                      rows={6}
                      dir="rtl"
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Deployment Status</label>
                      <select
                        value={legalStatus}
                        onChange={(e: any) => setLegalStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published (Visible on Web)</option>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Legal Review Board Certification</label>
                      <select
                        value={legalReview}
                        onChange={(e: any) => setLegalReview(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="PENDING">Under Platform Audit</option>
                        <option value="APPROVED">Certified & Valid (Approved)</option>
                        <option value="REVISION_REQUIRED">Requires Amendment</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingLegalDoc(false)}
                      className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg"
                    >
                      Commit to Repository
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {legalDocs.map(doc => (
                    <div key={doc.id} className="p-4 border border-[#e6e2de] rounded-xl space-y-3 relative bg-[#fdfcfb]">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-[#1a1918]">{doc.title} / {doc.titleAr}</h4>
                          <span className="text-[10px] text-[#6e6b66]">Slug: /{doc.slug} • Version {doc.version}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                          doc.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {doc.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#6e6b66] line-clamp-3 bg-white p-2 rounded border border-[#f2ede8]">{doc.content}</p>
                      <div className="flex justify-between items-center text-[10px] text-[#6e6b66]">
                        <span>Review: <strong className={doc.legalReviewStatus === "APPROVED" ? "text-emerald-600" : "text-amber-600"}>{doc.legalReviewStatus}</strong></span>
                        <button
                          onClick={() => {
                            setSelectedLegalDoc(doc);
                            setLegalSlug(doc.slug);
                            setLegalTitle(doc.title);
                            setLegalTitleAr(doc.titleAr);
                            setLegalContent(doc.content);
                            setLegalContentAr(doc.contentAr);
                            setLegalVersion(doc.version);
                            setLegalStatus(doc.status);
                            setLegalReview(doc.legalReviewStatus);
                            setIsEditingLegalDoc(true);
                          }}
                          className="text-[#bf9b30] hover:underline font-semibold"
                        >
                          Edit Document
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HELP ARTICLES DESK */}
          {activeSubTab === "help_articles" && (
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex justify-between items-center border-b border-[#f2ede8] pb-4">
                <div>
                  <h3 className="text-lg font-serif text-[#1a1918] font-semibold flex items-center gap-2">
                    <HelpCircle className="text-[#bf9b30]" size={20} />
                    <span>Help Center Articles Manager</span>
                  </h3>
                  <p className="text-xs text-[#6e6b66]">Provide guidelines, manuals, and FAQs for visitors, real estate brokers, and developer tenants.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedArticle(null);
                    setArtCategory("VISITORS");
                    setArtTitle("");
                    setArtTitleAr("");
                    setArtContent("");
                    setArtContentAr("");
                    setArtPublished(true);
                    setIsEditingArticle(true);
                  }}
                  className="px-3 py-1.5 bg-[#bf9b30] text-black text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-[#a68628]"
                >
                  <Plus size={14} />
                  <span>Create Article</span>
                </button>
              </div>

              {isEditingArticle ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const targetId = selectedArticle?.id || `help-${Date.now()}`;
                    try {
                      const token = localStorage.getItem("token") || "";
                      const res = await fetch("/api/admin/help", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          id: targetId,
                          category: artCategory,
                          title: artTitle,
                          titleAr: artTitleAr,
                          content: artContent,
                          contentAr: artContentAr,
                          isPublished: artPublished,
                          actorId: currentUser.id,
                          actorName: currentUser.fullName,
                          actorRole: UserRole.PLATFORM_ADMIN
                        })
                      });
                      if (res.ok) {
                        showToast("Help article published successfully!");
                        setIsEditingArticle(false);
                        fetchControlContext();
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="space-y-4 p-4 bg-[#fcfbfa] border border-[#e6e2de] rounded-xl text-xs"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Audience Category</label>
                      <select
                        value={artCategory}
                        onChange={(e: any) => setArtCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="VISITORS">Visitors & Seekers</option>
                        <option value="AGENTS">Registered Brokers & Agents</option>
                        <option value="AGENCIES">Agencies Admins</option>
                        <option value="DEVELOPERS">Developer Enterprises</option>
                        <option value="SUBSCRIPTIONS">SaaS Plans & Invoices</option>
                        <option value="SECURITY">Account Security & Law 13</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">State</label>
                      <select
                        value={artPublished ? "true" : "false"}
                        onChange={(e) => setArtPublished(e.target.value === "true")}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="true">Published (Live)</option>
                        <option value="false">Draft (Hidden)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Article Title (English)</label>
                      <input
                        type="text"
                        required
                        value={artTitle}
                        onChange={(e) => setArtTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Article Title (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={artTitleAr}
                        onChange={(e) => setArtTitleAr(e.target.value)}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Article Content (English)</label>
                    <textarea
                      required
                      value={artContent}
                      onChange={(e) => setArtContent(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Article Content (Arabic)</label>
                    <textarea
                      required
                      value={artContentAr}
                      onChange={(e) => setArtContentAr(e.target.value)}
                      rows={6}
                      dir="rtl"
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingArticle(false)}
                      className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg"
                    >
                      Publish Article
                    </button>
                  </div>
                </form>
              ) : (
                <div className="divide-y divide-[#f2ede8] text-xs">
                  {helpArticles.map(art => (
                    <div key={art.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#f2ede8] text-[#6e6b66] rounded text-[9px] font-bold uppercase">{art.category}</span>
                          <h4 className="font-bold text-[#1a1918]">{art.title} ({art.titleAr})</h4>
                        </div>
                        <p className="text-[10px] text-[#6e6b66] mt-1 line-clamp-1">{art.content}</p>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-[#6e6b66]">
                        <span>👀 {art.viewCount || 0} views</span>
                        <button
                          onClick={() => {
                            setSelectedArticle(art);
                            setArtCategory(art.category);
                            setArtTitle(art.title);
                            setArtTitleAr(art.titleAr);
                            setArtContent(art.content);
                            setArtContentAr(art.contentAr);
                            setArtPublished(art.isPublished);
                            setIsEditingArticle(true);
                          }}
                          className="text-[#bf9b30] hover:underline font-bold"
                        >
                          Edit Article
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUPPORT TICKETS QUEUE */}
          {activeSubTab === "support_tickets" && (
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="border-b border-[#f2ede8] pb-4">
                <h3 className="text-lg font-serif text-[#1a1918] font-semibold flex items-center gap-2">
                  <AlertOctagon className="text-red-500" size={20} />
                  <span>Central Operations Support Tickets</span>
                </h3>
                <p className="text-xs text-[#6e6b66]">Interact with logged-in agents and enterprise organizations to resolve queries and complaints.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                {/* Tickets list */}
                <div className="md:col-span-1 border border-[#e6e2de] rounded-xl overflow-hidden divide-y divide-[#f2ede8]">
                  <div className="bg-[#fdfcfb] p-3 border-b border-[#e6e2de] font-bold text-[#1a1918]">Active Inquiries Queue</div>
                  {tickets.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Queue is empty</div>
                  ) : (
                    tickets.map(ticket => (
                      <div
                        key={ticket.id}
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setTicketReplyText("");
                        }}
                        className={`p-3 cursor-pointer hover:bg-[#fcfbfa] transition-colors ${selectedTicket?.id === ticket.id ? "bg-[#fcfbfa] border-l-4 border-[#bf9b30]" : ""}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-[#1a1918] truncate max-w-[120px]">{ticket.subject}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold ${
                            ticket.priority === "URGENT" ? "bg-red-100 text-red-700" :
                            ticket.priority === "HIGH" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
                          }`}>{ticket.priority}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-[#6e6b66]">
                          <span>{ticket.userName}</span>
                          <span className={`font-semibold ${ticket.status === "OPEN" ? "text-red-600 animate-pulse" : "text-gray-500"}`}>{ticket.status}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Selected Ticket details */}
                <div className="md:col-span-2 space-y-4">
                  {selectedTicket ? (
                    <div className="border border-[#e6e2de] rounded-xl p-4 bg-[#fdfcfb] space-y-4">
                      <div className="flex justify-between items-start border-b border-[#f2ede8] pb-3">
                        <div>
                          <h4 className="font-bold text-sm text-[#1a1918]">{selectedTicket.subject}</h4>
                          <p className="text-[10px] text-[#6e6b66]">Submitted by <strong>{selectedTicket.userName}</strong> ({selectedTicket.userEmail}) • Category: {selectedTicket.category}</p>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={selectedTicket.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                const token = localStorage.getItem("token") || "";
                                const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
                                  method: "PUT",
                                  headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${token}`
                                  },
                                  body: JSON.stringify({
                                    status: newStatus,
                                    actorId: currentUser.id,
                                    actorName: currentUser.fullName,
                                    actorRole: UserRole.PLATFORM_ADMIN
                                  })
                                });
                                if (res.ok) {
                                  showToast("Ticket status updated successfully!");
                                  fetchControlContext();
                                  setSelectedTicket({ ...selectedTicket, status: newStatus as any });
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="bg-white border border-[#e6e2de] rounded-lg p-1 text-[10px]"
                          >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="WAITING_FOR_USER">Awaiting User</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                        </div>
                      </div>

                      {/* Conversation log */}
                      <div className="space-y-3 max-h-[300px] overflow-y-auto p-2 bg-white rounded-lg border border-[#f2ede8]">
                        <div className="bg-[#fcfbfa] p-3 rounded-lg border border-[#f2ede8] space-y-1">
                          <div className="flex justify-between font-bold text-[10px] text-[#1a1918]">
                            <span>{selectedTicket.userName} (Creator)</span>
                            <span>{selectedTicket.createdDate ? selectedTicket.createdDate.split("T")[0] : ""}</span>
                          </div>
                          <p className="text-xs text-[#6e6b66] whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        {selectedTicket.replies?.map(reply => (
                          <div key={reply.id} className={`p-3 rounded-lg border ${reply.senderRole === "PLATFORM_ADMIN" ? "bg-amber-50/50 border-amber-100 ml-4" : "bg-gray-50 border-gray-100 mr-4"} space-y-1`}>
                            <div className="flex justify-between font-bold text-[10px] text-[#1a1918]">
                              <span>{reply.senderName} ({reply.senderRole.replace("_", " ")})</span>
                              <span>{reply.createdDate ? reply.createdDate.split("T")[0] : ""}</span>
                            </div>
                            <p className="text-xs text-[#6e6b66] whitespace-pre-wrap">{reply.message}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply textbox */}
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!ticketReplyText.trim()) return;
                          try {
                            const token = localStorage.getItem("token") || "";
                            const res = await fetch(`/api/support/tickets/${selectedTicket.id}/reply`, {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                senderId: currentUser.id,
                                senderName: `${currentUser.fullName} (Platform Ops)`,
                                senderRole: UserRole.PLATFORM_ADMIN,
                                message: ticketReplyText
                              })
                            });
                            if (res.ok) {
                              const data = await res.json();
                              showToast("Reply sent successfully!");
                              setTicketReplyText("");
                              fetchControlContext();
                              setSelectedTicket(data.ticket);
                            }
                          } catch (e) {
                             console.error(e);
                          }
                        }}
                        className="space-y-2 pt-2"
                      >
                        <textarea
                          placeholder="Type your official administrative reply here..."
                          value={ticketReplyText}
                          onChange={(e) => setTicketReplyText(e.target.value)}
                          rows={3}
                          required
                          className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                        ></textarea>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg flex items-center gap-1 hover:bg-[#a68628]"
                          >
                            <Send size={12} />
                            <span>Send Reply</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="h-full border border-dashed border-[#e6e2de] rounded-xl flex items-center justify-center text-[#6e6b66] p-8 text-center">
                      Select a support ticket from the list to manage, reply, and monitor audits.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PARTNERSHIP REQUESTS BOARD */}
          {activeSubTab === "partnerships" && (
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="border-b border-[#f2ede8] pb-4">
                <h3 className="text-lg font-serif text-[#1a1918] font-semibold flex items-center gap-2">
                  <Award className="text-[#bf9b30]" size={20} />
                  <span>Incoming Commercial Partnerships Inquiries</span>
                </h3>
                <p className="text-xs text-[#6e6b66]">Review applications from major builders, property brokers, and technology service vendors in the Middle East.</p>
              </div>

              <div className="overflow-x-auto border border-[#e6e2de] rounded-xl text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#fdfcfb] border-b border-[#e6e2de] text-[#6e6b66]">
                      <th className="p-3">Company Name</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Message</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2ede8] text-[#1a1918]">
                    {partnerships.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400">No partnership inquiries registered</td>
                      </tr>
                    ) : (
                      partnerships.map(req => (
                        <tr key={req.id}>
                          <td className="p-3 font-bold">{req.companyName}</td>
                          <td className="p-3">
                            <span className="block">{req.contactName}</span>
                            <span className="block text-[10px] text-[#6e6b66]">{req.email} • {req.phone}</span>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 bg-[#f2ede8] text-[#6e6b66] rounded-full text-[9px] font-bold">{req.type}</span>
                          </td>
                          <td className="p-3 max-w-xs truncate">{req.message}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              req.status === "NEW" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                              req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                            }`}>{req.status}</span>
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem("token") || "";
                                  const res = await fetch(`/api/admin/partnerships/${req.id}`, {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "Authorization": `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      status: "APPROVED",
                                      actorId: currentUser.id,
                                      actorName: currentUser.fullName,
                                      actorRole: UserRole.PLATFORM_ADMIN
                                    })
                                  });
                                  if (res.ok) {
                                    showToast("Partnership request approved!");
                                    fetchControlContext();
                                  }
                                } catch (e) { console.error(e); }
                              }}
                              className="px-2 py-1 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-700 text-[10px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const token = localStorage.getItem("token") || "";
                                  const res = await fetch(`/api/admin/partnerships/${req.id}`, {
                                    method: "PUT",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "Authorization": `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                      status: "REJECTED",
                                      actorId: currentUser.id,
                                      actorName: currentUser.fullName,
                                      actorRole: UserRole.PLATFORM_ADMIN
                                    })
                                  });
                                  if (res.ok) {
                                    showToast("Partnership request marked rejected.");
                                    fetchControlContext();
                                  }
                                } catch (e) { console.error(e); }
                              }}
                              className="px-2 py-1 bg-red-600 text-white font-bold rounded hover:bg-red-700 text-[10px]"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CAREERS OPERATIONS BOARD */}
          {activeSubTab === "careers" && (
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex justify-between items-center border-b border-[#f2ede8] pb-4">
                <div>
                  <h3 className="text-lg font-serif text-[#1a1918] font-semibold flex items-center gap-2">
                    <Briefcase className="text-[#bf9b30]" size={20} />
                    <span>Careers Opportunities CMS Console</span>
                  </h3>
                  <p className="text-xs text-[#6e6b66]">Post active corporate engineering, sales, and operations jobs at Nerou Technology Services offices in Qatar.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedJob(null);
                    setJobTitle("");
                    setJobTitleAr("");
                    setJobDept("");
                    setJobDeptAr("");
                    setJobLoc("Doha, Qatar (Hybrid)");
                    setJobLocAr("الدوحة، قطر (هجين)");
                    setJobType("Full-Time");
                    setJobTypeAr("دوام كامل");
                    setJobDesc("");
                    setJobDescAr("");
                    setJobReqs("");
                    setJobReqsAr("");
                    setIsEditingJob(true);
                  }}
                  className="px-3 py-1.5 bg-[#bf9b30] text-black text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-[#a68628]"
                >
                  <Plus size={14} />
                  <span>Post Job Opening</span>
                </button>
              </div>

              {isEditingJob ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const targetId = selectedJob?.id || `job-${Date.now()}`;
                    try {
                      const token = localStorage.getItem("token") || "";
                      const res = await fetch("/api/admin/careers", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          id: targetId,
                          title: jobTitle,
                          titleAr: jobTitleAr,
                          department: jobDept,
                          departmentAr: jobDeptAr,
                          location: jobLoc,
                          locationAr: jobLocAr,
                          type: jobType,
                          typeAr: jobTypeAr,
                          description: jobDesc,
                          descriptionAr: jobDescAr,
                          requirements: jobReqs.split("\n").filter(Boolean),
                          requirementsAr: jobReqsAr.split("\n").filter(Boolean),
                          actorId: currentUser.id,
                          actorName: currentUser.fullName,
                          actorRole: UserRole.PLATFORM_ADMIN
                        })
                      });
                      if (res.ok) {
                        showToast("Career listing posted successfully!");
                        setIsEditingJob(false);
                        fetchControlContext();
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="space-y-4 p-4 bg-[#fcfbfa] border border-[#e6e2de] rounded-xl text-xs"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Job Title (English)</label>
                      <input
                        type="text"
                        required
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Job Title (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={jobTitleAr}
                        onChange={(e) => setJobTitleAr(e.target.value)}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Department (English)</label>
                      <input
                        type="text"
                        required
                        value={jobDept}
                        onChange={(e) => setJobDept(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Department (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={jobDeptAr}
                        onChange={(e) => setJobDeptAr(e.target.value)}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Location (English)</label>
                      <input
                        type="text"
                        required
                        value={jobLoc}
                        onChange={(e) => setJobLoc(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Location (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={jobLocAr}
                        onChange={(e) => setJobLocAr(e.target.value)}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Job Description (English)</label>
                    <textarea
                      required
                      value={jobDesc}
                      onChange={(e) => setJobDesc(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Job Description (Arabic)</label>
                    <textarea
                      required
                      value={jobDescAr}
                      onChange={(e) => setJobDescAr(e.target.value)}
                      rows={4}
                      dir="rtl"
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Requirements (English, one per line)</label>
                    <textarea
                      required
                      value={jobReqs}
                      onChange={(e) => setJobReqs(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Requirements (Arabic, one per line)</label>
                    <textarea
                      required
                      value={jobReqsAr}
                      onChange={(e) => setJobReqsAr(e.target.value)}
                      rows={4}
                      dir="rtl"
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingJob(false)}
                      className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg"
                    >
                      Publish Job Opening
                    </button>
                  </div>
                </form>
              ) : (
                <div className="divide-y divide-[#f2ede8] text-xs">
                  {careers.map(job => (
                    <div key={job.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#fdfcfb] p-4 border border-[#e6e2de] rounded-xl mb-3">
                      <div>
                        <h4 className="font-bold text-sm text-[#1a1918]">{job.title} / {job.titleAr}</h4>
                        <div className="flex flex-wrap gap-2 text-[10px] text-[#6e6b66] mt-1">
                          <span>🏢 {job.department} ({job.departmentAr})</span>
                          <span>📍 {job.location}</span>
                          <span>⏳ {job.type}</span>
                        </div>
                        <p className="text-[10px] text-[#6e6b66] mt-2 italic">"{job.description}"</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          setJobTitle(job.title);
                          setJobTitleAr(job.titleAr);
                          setJobDept(job.department);
                          setJobDeptAr(job.departmentAr);
                          setJobLoc(job.location);
                          setJobLocAr(job.locationAr);
                          setJobType(job.type);
                          setJobTypeAr(job.typeAr || "");
                          setJobDesc(job.description);
                          setJobDescAr(job.descriptionAr || "");
                          setJobReqs(job.requirements?.join("\n") || "");
                          setJobReqsAr(job.requirementsAr?.join("\n") || "");
                          setIsEditingJob(true);
                        }}
                        className="text-[#bf9b30] hover:underline font-bold"
                      >
                        Edit Listing
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRESS CMS TAB */}
          {activeSubTab === "press" && (
            <div className="bg-white p-5 md:p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex justify-between items-center border-b border-[#f2ede8] pb-3">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1a1918]">
                    {isRtl ? "إدارة البيانات الصحفية والاتصال المؤسسي" : "Corporate Press Releases & Media CMS"}
                  </h3>
                  <p className="text-xs text-[#6e6b66] mt-0.5">
                    {isRtl
                      ? "تعديل، صياغة، ونشر الأخبار الرسمية للمنصة والمستجدات الصحفية بقطر."
                      : "Draft, edit, and authorize official press statements and news updates."}
                  </p>
                </div>
                {!isEditingPress && (
                  <button
                    onClick={() => {
                      setSelectedPress(null);
                      setPressTitle("");
                      setPressTitleAr("");
                      setPressDate(new Date().toISOString().split("T")[0]);
                      setPressSummary("");
                      setPressSummaryAr("");
                      setPressContent("");
                      setPressContentAr("");
                      setIsEditingPress(true);
                    }}
                    className="px-3 py-1.5 bg-[#1c1a17] text-[#bf9b30] hover:bg-[#33302a] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{isRtl ? "صياغة بيان صحفي جديد" : "Draft Press Release"}</span>
                  </button>
                )}
              </div>

              {isEditingPress ? (
                <form onSubmit={handleSavePress} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Title (English)</label>
                      <input
                        type="text"
                        required
                        value={pressTitle}
                        onChange={(e) => setPressTitle(e.target.value)}
                        placeholder="e.g. Nerou Finder Launches AI Search Engine"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Title (Arabic)</label>
                      <input
                        type="text"
                        required
                        value={pressTitleAr}
                        onChange={(e) => setPressTitleAr(e.target.value)}
                        placeholder="مثال: نيرو فايندر تطلق محرك الاكتشاف الذكي التفاعلي بالذكاء الاصطناعي"
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={pressDate}
                        onChange={(e) => setPressDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Status</label>
                      <span className="w-full px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg block font-bold text-center">
                        AUTHORIZED & READY TO DEPLOY
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Summary (English)</label>
                      <textarea
                        required
                        value={pressSummary}
                        onChange={(e) => setPressSummary(e.target.value)}
                        placeholder="A short snippet for social media cards and listings..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                      ></textarea>
                    </div>
                    <div>
                      <label className="block font-semibold text-[#6e6b66] mb-1">Summary (Arabic)</label>
                      <textarea
                        required
                        value={pressSummaryAr}
                        onChange={(e) => setPressSummaryAr(e.target.value)}
                        placeholder="ملخص الخبر للمنصات الرقمية..."
                        rows={2}
                        dir="rtl"
                        className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                      ></textarea>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Full Content (English)</label>
                    <textarea
                      required
                      value={pressContent}
                      onChange={(e) => setPressContent(e.target.value)}
                      placeholder="Type the full detailed article content in English..."
                      rows={6}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#6e6b66] mb-1">Full Content (Arabic)</label>
                    <textarea
                      required
                      value={pressContentAr}
                      onChange={(e) => setPressContentAr(e.target.value)}
                      placeholder="اكتب المحتوى الكامل للمقال باللغة العربية..."
                      rows={6}
                      dir="rtl"
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPress(false)}
                      className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg"
                    >
                      Publish Statement
                    </button>
                  </div>
                </form>
              ) : (
                <div className="divide-y divide-[#f2ede8] text-xs space-y-4">
                  {press.length === 0 ? (
                    <div className="py-12 text-center text-xs text-[#6e6b66] border border-dashed border-[#e6e2de] rounded-xl bg-[#fdfcfb]">
                      No press releases archived in Central CMS yet. Click Draft above to initiate.
                    </div>
                  ) : (
                    press.map(release => (
                      <div key={release.id} className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#fdfcfb] p-4 border border-[#e6e2de] rounded-xl">
                        <div>
                          <span className="text-[10px] font-bold text-[#bf9b30] block uppercase tracking-wider mb-1">{release.date}</span>
                          <h4 className="font-bold text-sm text-[#1a1918]">{release.title} / {release.titleAr}</h4>
                          <p className="text-[10px] text-[#6e6b66] mt-2 italic">"{release.summary}"</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPress(release);
                            setPressTitle(release.title);
                            setPressTitleAr(release.titleAr || "");
                            setPressDate(release.date);
                            setPressSummary(release.summary || "");
                            setPressSummaryAr(release.summaryAr || "");
                            setPressContent(release.content || "");
                            setPressContentAr(release.contentAr || "");
                            setIsEditingPress(true);
                          }}
                          className="text-[#bf9b30] hover:underline font-bold self-end md:self-center shrink-0 cursor-pointer"
                        >
                          Edit Release
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* EMAIL LOGS TAB */}
          {activeSubTab === "email_logs" && (
            <div className="bg-white p-5 md:p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#f2ede8] pb-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1a1918]">
                    {isRtl ? "محاكي سجلات البريد الإلكتروني الصادر (SMTP)" : "Outbound Mock SMTP Email Logs Queue"}
                  </h3>
                  <p className="text-xs text-[#6e6b66] mt-0.5">
                    {isRtl
                      ? "قائمة تتبع ومراقبة رسائل البريد الإلكتروني المحاكاة للمعاملات العقارية واشتراكات SaaS."
                      : "Developer telemetry panel tracking transactional, lead distribution, and SaaS notification emails."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchEmailLogs}
                    disabled={emailLogsLoading}
                    className="px-3 py-1.5 border border-[#e6e2de] hover:border-[#bf9b30] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={emailLogsLoading ? "animate-spin" : ""} />
                    <span>{isRtl ? "تحديث" : "Refresh"}</span>
                  </button>
                  <button
                    onClick={handleClearEmailLogs}
                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>{isRtl ? "مسح السجلات" : "Clear Logs"}</span>
                  </button>
                </div>
              </div>

              {emailLogsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-xs text-[#6e6b66] gap-2">
                  <RefreshCw size={18} className="animate-spin text-[#bf9b30]" />
                  <span>Loading mail server logs...</span>
                </div>
              ) : emails.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#6e6b66] border border-dashed border-[#e6e2de] rounded-xl bg-[#fdfcfb]">
                  No outbound SMTP logs registered yet. Trigger a lead inquiry or request a SaaS subscription to view output.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Email List Left */}
                  <div className="lg:col-span-1 border border-[#e6e2de] rounded-xl overflow-hidden divide-y divide-[#f2ede8] max-h-[600px] overflow-y-auto">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={`p-4 cursor-pointer transition-colors text-left ${
                          selectedEmail?.id === email.id
                            ? "bg-[#bf9b30]/10 border-l-4 border-l-[#bf9b30]"
                            : "hover:bg-[#fcfbfa]"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <span className="text-[9px] font-bold text-[#bf9b30] uppercase tracking-wider">
                            {email.type || "transactional"}
                          </span>
                          <span className="text-[9px] text-[#6e6b66] font-mono">
                            {new Date(email.sentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-[#1a1918] truncate">
                          {email.subject}
                        </h4>
                        <p className="text-[10px] text-[#6e6b66] truncate mt-1">
                          To: {email.to}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Email Preview Right */}
                  <div className="lg:col-span-2 border border-[#e6e2de] rounded-xl overflow-hidden bg-[#fdfcfb] flex flex-col min-h-[500px]">
                    {selectedEmail ? (
                      <div className="flex flex-col h-full">
                        {/* Header Details */}
                        <div className="p-4 bg-white border-b border-[#e6e2de] space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[10px] text-[#bf9b30] bg-[#bf9b30]/10 px-2 py-0.5 rounded">
                              {selectedEmail.id}
                            </span>
                            <span className="text-[10px] text-[#6e6b66]">
                              {new Date(selectedEmail.sentDate).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[#1a1918]">
                            <strong>From:</strong> <span className="text-[#6e6b66]">noreply@nerou.io (Mock Outbound SMTP Engine)</span>
                          </p>
                          <p className="text-[#1a1918]">
                            <strong>To:</strong> <span className="text-[#6e6b66]">{selectedEmail.to}</span>
                          </p>
                          <p className="text-[#1a1918]">
                            <strong>Subject:</strong> <span className="font-semibold text-[#bf9b30]">{selectedEmail.subject}</span>
                          </p>
                        </div>

                        {/* Sandbox HTML Render Frame */}
                        <div className="p-6 bg-[#f2ede8] overflow-y-auto flex-grow flex justify-center">
                          <div
                            className="bg-white rounded-lg shadow-sm border border-[#e6e2de] p-1 overflow-auto max-w-full w-full max-h-[500px]"
                            dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center p-12 text-[#6e6b66] text-xs gap-2">
                        <Mail size={32} className="text-[#bf9b30]/40" />
                        <span>Select an outbound SMTP log entry from the list to view live HTML rendering.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REVIEWS MODERATION TAB */}
          {activeSubTab === "reviews" && (
            <div className="bg-white p-5 md:p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#1a1918]">
                  {isRtl ? "إدارة وتقييم مراجعات المستشارين" : "Ratings & Reviews Moderation Queue"}
                </h3>
                <p className="text-xs text-[#6e6b66] mt-0.5">
                  {isRtl
                    ? "مراجعة واعتماد تقييمات العملاء للمستشارين العقاريين والشركات لضمان النزاهة والموثوقية."
                    : "Moderate client feedback and rating scores submitted for agency brokers and developer companies to ensure network integrity."}
                </p>
              </div>

              {/* FIX 10: platform-wide average + filters */}
              <div className="flex flex-wrap items-center gap-3 p-3 bg-[#fbfaf8] border border-[#e6e2de] rounded-xl">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg">
                  <Star size={13} className="fill-[#bf9b30] text-[#bf9b30]" />
                  <span className="font-bold text-[#1a1918] text-xs">
                    {(() => {
                      const approved = reviews.filter((r: any) => r.status === "APPROVED");
                      return approved.length > 0 ? (approved.reduce((s: number, r: any) => s + r.rating, 0) / approved.length).toFixed(1) : "0.0";
                    })()}
                  </span>
                  <span className="text-[10px] text-[#6e6b66]">{isRtl ? "متوسط المنصة" : "Platform avg"} ({reviews.filter((r: any) => r.status === "APPROVED").length})</span>
                </div>
                <select
                  value={reviewRatingFilter}
                  onChange={(e) => setReviewRatingFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-[11px]"
                >
                  <option value="">{isRtl ? "كل التقييمات" : "All ratings"}</option>
                  {[5, 4, 3, 2, 1].map(s => (
                    <option key={s} value={s}>{s}★</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder={isRtl ? "بحث بالمقيم أو النص أو المعرف" : "Search reviewer, comment, or target ID"}
                  className="px-2.5 py-1.5 bg-white border border-[#e6e2de] rounded-lg text-[11px] min-w-[200px]"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-[#6e6b66] cursor-pointer">
                  <input type="checkbox" checked={reviewReportedOnly} onChange={(e) => setReviewReportedOnly(e.target.checked)} />
                  {isRtl ? "المبلّغ عنها فقط" : "Reported only"}
                </label>
              </div>

              <div className="space-y-4">
                {(() => {
                  const filteredReviews = reviews.filter((rev: any) => {
                    if (reviewRatingFilter && String(Math.round(rev.rating)) !== reviewRatingFilter) return false;
                    if (reviewReportedOnly && !(rev.reportCount > 0)) return false;
                    if (reviewSearch.trim()) {
                      const q = reviewSearch.trim().toLowerCase();
                      if (!rev.reviewerName?.toLowerCase().includes(q) && !rev.comment?.toLowerCase().includes(q) && !rev.targetId?.toLowerCase().includes(q)) return false;
                    }
                    return true;
                  });
                  if (filteredReviews.length === 0) {
                  return (
                  <div className="text-center py-12 border border-dashed border-[#e6e2de] rounded-xl text-[#6e6b66] text-xs">
                    {isRtl ? "لا توجد نتائج مطابقة." : "No reviews match the current filters."}
                  </div>
                  );
                  }
                  return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#e6e2de] bg-gray-50 text-[10px] font-bold text-[#6e6b66] uppercase tracking-wider">
                          <th className="p-3">{isRtl ? "المقيم" : "Reviewer"}</th>
                          <th className="p-3">{isRtl ? "النوع" : "Target Type"}</th>
                          <th className="p-3">{isRtl ? "الهدف" : "Target Profile"}</th>
                          <th className="p-3">{isRtl ? "التقييم" : "Rating"}</th>
                          <th className="p-3">{isRtl ? "التعليق" : "Comment"}</th>
                          <th className="p-3">{isRtl ? "التاريخ" : "Date"}</th>
                          <th className="p-3">{isRtl ? "الحالة" : "Status"}</th>
                          <th className="p-3 text-right">{isRtl ? "إجراءات" : "Actions"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2ede8]">
                        {filteredReviews.map((rev: any) => {
                          const isPending = rev.status === "PENDING";
                          return (
                            <tr key={rev.id} className="hover:bg-gray-50">
                              <td className="p-3 font-semibold text-[#1a1918]">{rev.reviewerName}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rev.targetType === "AGENT" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                }`}>
                                  {rev.targetType}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-[10px]">{rev.targetId}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-0.5 text-amber-500">
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} size={11} className={s <= rev.rating ? "fill-amber-500 text-amber-500" : "text-gray-200"} />
                                  ))}
                                </div>
                              </td>
                              <td className="p-3 max-w-xs truncate" title={rev.comment}>{rev.comment}</td>
                              <td className="p-3 text-[#6e6b66]">
                                {new Date(rev.createdDate).toLocaleDateString()}
                              </td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  rev.status === "APPROVED" ? "bg-green-100 text-green-800" :
                                  rev.status === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {rev.status}
                                </span>
                                {rev.reportCount > 0 && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                    {isRtl ? "مُبلّغ" : "Reported"} ({rev.reportCount})
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end items-center gap-1.5">
                                  {isPending ? (
                                    <>
                                      <button
                                        onClick={() => handleModerateReview(rev.id, "APPROVED")}
                                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        {isRtl ? "اعتماد" : "Approve"}
                                      </button>
                                      <button
                                        onClick={() => handleModerateReview(rev.id, "REJECTED")}
                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                      >
                                        {isRtl ? "رفض" : "Reject"}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[#6e6b66] text-[10px] italic">Processed</span>
                                  )}
                                  <button
                                    onClick={() => handleDeleteReview(rev.id)}
                                    className="px-2 py-1 bg-[#1c1a17] hover:bg-[#33302a] text-white rounded text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                    title={isRtl ? "حذف التقييم" : "Delete Review"}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeSubTab === "locations" && (
            <div className="bg-white p-5 md:p-6 rounded-xl border border-[#e6e2de] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#1a1918]">
                    {isRtl ? "إدارة هيكل وتقسيم المناطق الجغرافية" : "Qatar Geographic Location Hierarchy"}
                  </h3>
                  <p className="text-xs text-[#6e6b66] mt-0.5">
                    {isRtl
                      ? "إدارة بلديات ومناطق ومحلات دولة قطر بشكل هرمي مترابط لربط العقارات والفلاتر والخرائط."
                      : "Manage Qatar's official administrative levels (Municipality → Area → District/Sub-zone) with active parent-child relationships."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsAddingLocation(!isAddingLocation);
                    setNewLocParentId("");
                  }}
                  className="px-4 py-2 bg-[#bf9b30] hover:bg-[#a88524] text-black rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-2 self-start md:self-auto"
                >
                  <Plus size={14} />
                  {isRtl ? "إضافة منطقة جديدة" : "Add New Location"}
                </button>
              </div>

              {/* ADD/EDIT FORM */}
              {isAddingLocation && (
                <form onSubmit={handleSaveLocation} className="bg-[#fcfbfa] p-5 rounded-xl border border-[#e6e2de] space-y-4 animate-in fade-in slide-in-from-top duration-200">
                  <h4 className="font-serif text-sm font-bold text-[#1a1918]">
                    {isRtl ? "إضافة موقع عقاري جديد للهيكل الهرمي" : "Add New Location Node to Hierarchy"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#6e6b66] mb-1">{isRtl ? "الاسم العقاري (إنجليزي) *" : "Location Name (English) *"}</label>
                      <input
                        type="text"
                        required
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white"
                        placeholder="e.g. Marina District, Porto Arabia"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6e6b66] mb-1">{isRtl ? "الاسم العقاري (عربي) *" : "Location Name (Arabic) *"}</label>
                      <input
                        type="text"
                        required
                        value={newLocNameAr}
                        onChange={(e) => setNewLocNameAr(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white text-right"
                        placeholder="مثال: منطقة المارينا، بورتو أرابيا"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6e6b66] mb-1">{isRtl ? "المستوى الإداري *" : "Administrative Level *"}</label>
                      <select
                        value={newLocType}
                        onChange={(e: any) => {
                          setNewLocType(e.target.value);
                          setNewLocParentId("");
                        }}
                        className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white"
                      >
                        <option value="MUNICIPALITY">{isRtl ? "بلدية رئيسية" : "Municipality"}</option>
                        <option value="AREA">{isRtl ? "منطقة عقارية فرعية" : "Area"}</option>
                        <option value="DISTRICT">{isRtl ? "محلة / قطاع / حي جزئي" : "District / Sub-zone"}</option>
                      </select>
                    </div>

                    {newLocType !== "MUNICIPALITY" && (
                      <div>
                        <label className="block text-xs font-semibold text-[#6e6b66] mb-1">
                          {newLocType === "AREA" 
                            ? (isRtl ? "البلدية التابعة لها *" : "Parent Municipality *")
                            : (isRtl ? "المنطقة التابعة لها *" : "Parent Area *")}
                        </label>
                        <select
                          required
                          value={newLocParentId}
                          onChange={(e) => setNewLocParentId(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white"
                        >
                          <option value="">-- {isRtl ? "اختر الموقع الأب" : "Select Parent Location"} --</option>
                          {locations
                            .filter(l => l.type === (newLocType === "AREA" ? "MUNICIPALITY" : "AREA") && l.isActive)
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.nameAr})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-[#6e6b66] mb-1">{isRtl ? "خط العرض (Latitude) - اختياري" : "Latitude - Optional"}</label>
                      <input
                        type="number"
                        step="any"
                        value={newLocLatitude}
                        onChange={(e) => setNewLocLatitude(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white"
                        placeholder="25.385"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#6e6b66] mb-1">{isRtl ? "خط الطول (Longitude) - اختياري" : "Longitude - Optional"}</label>
                      <input
                        type="number"
                        step="any"
                        value={newLocLongitude}
                        onChange={(e) => setNewLocLongitude(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-[#cbd5e1] rounded-lg bg-white"
                        placeholder="51.538"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingLocation(false)}
                      className="px-3 py-1.5 border border-[#cbd5e1] text-[#1a1918] hover:bg-gray-100 rounded-lg text-xs font-medium cursor-pointer"
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-black hover:bg-[#2c2b29] text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {isRtl ? "حفظ المنطقة" : "Save Location"}
                    </button>
                  </div>
                </form>
              )}

              {/* HIERARCHICAL TREE VIEW */}
              <div className="border border-[#e6e2de] rounded-xl overflow-hidden">
                <div className="bg-[#fbf9f6] p-4 border-b border-[#e6e2de] flex justify-between text-xs font-semibold text-[#1a1918]">
                  <span>{isRtl ? "قائمة بلديات ومناطق دولة قطر الرسمية" : "Qatar Official Location Directory Nodes"}</span>
                  <span className="text-[#bf9b30]">{locations.length} {isRtl ? "منطقة نشطة" : "Active Nodes"}</span>
                </div>

                <div className="divide-y divide-[#e6e2de] max-h-[500px] overflow-y-auto p-2 space-y-4">
                  {locations.filter(l => l.type === "MUNICIPALITY").map(muni => {
                    const areasUnderMuni = locations.filter(l => l.parentId === muni.id);
                    return (
                      <div key={muni.id} className="p-3 bg-[#fcfbfa] rounded-lg border border-[#e6e2de] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-serif text-sm font-bold text-black flex items-center gap-2">
                            🏛️ {muni.name} <span className="text-xs text-[#6e6b66] font-sans">({muni.nameAr})</span>
                          </span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-bold rounded">
                            {isRtl ? "بلدية" : "Municipality"}
                          </span>
                        </div>

                        {areasUnderMuni.length === 0 ? (
                          <div className="text-xs text-gray-400 pl-6 italic">
                            {isRtl ? "لا توجد مناطق فرعية مضافة بعد." : "No sub-areas registered yet."}
                          </div>
                        ) : (
                          <div className="pl-6 border-l border-dashed border-[#e6e2de] space-y-3 pt-1">
                            {areasUnderMuni.map(area => {
                              const districtsUnderArea = locations.filter(l => l.parentId === area.id);
                              return (
                                <div key={area.id} className="space-y-1.5">
                                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-[#e6e2de]">
                                    <span className="text-xs font-semibold text-[#1a1918] flex items-center gap-1.5">
                                      📍 {area.name} <span className="text-[10px] text-[#6e6b66]">({area.nameAr})</span>
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                      {districtsUnderArea.length} {isRtl ? "محلات فرعية" : "sub-zones"}
                                    </span>
                                  </div>

                                  {districtsUnderArea.length > 0 && (
                                    <div className="pl-6 flex flex-wrap gap-1.5 pt-0.5">
                                      {districtsUnderArea.map(dist => (
                                        <span 
                                          key={dist.id} 
                                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-medium rounded-full border border-amber-100"
                                        >
                                          🏘️ {dist.name} ({dist.nameAr})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

        </div>
      </div>

    </div>
  );
}
