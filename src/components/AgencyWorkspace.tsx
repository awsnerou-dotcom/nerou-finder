/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Organization, User, UserRole, AdCampaign, SubscriptionPlan, Lead, Property, Project, LeadStatus, PropertyType, TransactionType } from "../types.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import {
  CreditCard,
  Briefcase,
  Users,
  Layers,
  BarChart2,
  Settings,
  Plus,
  Tv,
  CheckCircle,
  Eye,
  Check,
  Zap,
  TrendingUp,
  Award,

  Camera,
  Lock,
  Loader2,
  DollarSign,
  Phone,
  Mail,
  MessageSquare,
  X,
  Building2,
  ArrowUpDown,
  UserPlus,
  Edit2,
  Trash2,
  LayoutDashboard,
  Inbox,
  Shuffle,
  Megaphone,
  Receipt,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";
import BoostRecommendations from "./BoostRecommendations.js";
import CmaReportButton from "./CmaReportButton.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Button } from "./ui/Button.js";
import { compressImage } from "../lib/image.js";
import { getActingUserId } from "../lib/auth.js";
import StatCard from "./StatCard.js";
import { SubscriptionAlertBanner } from "./WorkspaceWidgets.js";
import WorkspaceShell, { AttentionPanel, QuickActions, TopListingsPanel, WorkspaceHero } from "./WorkspaceShell.js";
import type { NavGroup } from "./WorkspaceShell.js";
import { agencyAttention, topListings, waitingLeads } from "../lib/workspaceAttention.js";
import { SectionHeader, StatStrip, LeadCard, ListingCard } from "./WorkspaceParts.js";

import DashboardChart from "./DashboardChart.js";
import { Badge } from "./ui/Badge.js";
import { buildDailySumSeries, datesToDayRecord, isThisMonth, listingStatusTone } from "../lib/dashboardMetrics.js";
import OnboardingTour, { TourStep } from "./OnboardingTour.js";
import { salesDeskTourSteps } from "./salesDeskTour.js";
import { TOUR_VERSION, tourModeFor } from "../lib/tour.js";
import type { TourMode } from "../lib/tour.js";
import ListingPerformanceModal from "./ListingPerformanceModal.js";
import NotificationBell from "./NotificationBell.js";
import SalesDesk from "./SalesDesk.js";
import ReferralPanel from "./ReferralPanel.js";

interface AgencyWorkspaceProps {
  agency: Organization;
  currentUser: User;
  onRefreshAll: () => void;
  isRtl: boolean;
}

export default function AgencyWorkspace({ agency, currentUser, onRefreshAll, isRtl }: AgencyWorkspaceProps) {
  const [agents, setAgents] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "team" | "listings" | "routing" | "campaigns" | "subscription" | "leads" | "salesdesk" | "verification" | "profile">("dashboard");
  // Listings tab (FIX 3): edit-in-place form state, submitted back to POST /api/properties
  // with the listing's own id so it updates rather than creates a new one.
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [listingEditTitle, setListingEditTitle] = useState<string>("");
  const [listingEditPrice, setListingEditPrice] = useState<string>("");
  const [listingEditArea, setListingEditArea] = useState<string>("");
  const [listingEditBeds, setListingEditBeds] = useState<string>("");
  const [listingEditBaths, setListingEditBaths] = useState<string>("");
  const [listingEditType, setListingEditType] = useState<PropertyType>(PropertyType.APARTMENT);
  const [listingEditTrans, setListingEditTrans] = useState<TransactionType>(TransactionType.FOR_RENT);
  const [listingEditDesc, setListingEditDesc] = useState<string>("");
  const [listingEditProjectId, setListingEditProjectId] = useState<string>("");
  const [savingListing, setSavingListing] = useState<boolean>(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  // Set when POST /api/properties 403s because the selected project requires developer
  // authorization the agency isn't (yet) granted.
  const [projectAuthError, setProjectAuthError] = useState<{ projectId: string; message: string } | null>(null);
  const [requestingRepresentation, setRequestingRepresentation] = useState<boolean>(false);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [performanceListingId, setPerformanceListingId] = useState<string | null>(null);
  const [isDeletingListing, setIsDeletingListing] = useState<boolean>(false);
  // Sortable team performance table (Dashboard tab)
  const [teamSortBy, setTeamSortBy] = useState<"name" | "listings" | "leads" | "conversion">("name");
  const [teamSortDir, setTeamSortDir] = useState<"asc" | "desc">("asc");
  const [invitations, setInvitations] = useState<any[]>([]);
  const [orgLeads, setOrgLeads] = useState<Lead[]>([]);
  const [orgProperties, setOrgProperties] = useState<Property[]>([]);
  // The leads and listings pages can hold hundreds of rows: filter, search and show them a page at a time.
  const [leadFilter, setLeadFilter] = useState<"all" | "unassigned" | "waiting">("all");
  const [leadLimit, setLeadLimit] = useState<number>(30);
  const [listingSearch, setListingSearch] = useState<string>("");
  const [listingLimit, setListingLimit] = useState<number>(20);
  // FIX 2: inline property preview - AgencyWorkspace has no "properties" tab/route of its own.
  const [leadPropertyPreview, setLeadPropertyPreview] = useState<Property | null>(null);
  const [adCharges, setAdCharges] = useState<any[]>([]);

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

  // First-time onboarding tour: shows once automatically for an account that hasn't seen it
  // yet, and can be replayed on demand from the Profile tab.
  const [showTour, setShowTour] = useState(false);
  // "full" = the whole tour; "whatsnew" = only the new Sales Desk steps, for accounts that finished an older tour.
  const [tourMode, setTourMode] = useState<TourMode>(null);
  useEffect(() => {
    const mode = tourModeFor(currentUser);
    if (mode) {
      setTourMode(mode);
      setShowTour(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const AGENCY_BASE_TOUR_STEPS: TourStep[] = [
    {
      selector: "agency-dashboard-tab",
      title: isRtl ? "لوحة القيادة" : "Dashboard",
      body: isRtl
        ? "نظرة عامة على أداء المكتب: العملاء المحتملون، أداء الفريق، والإعلانات النشطة."
        : "Your agency's overview: leads, team performance, and active listings at a glance."
    },
    {
      selector: "agency-team-tab",
      title: isRtl ? "فريق العمل" : "Agents Team",
      body: isRtl
        ? "ادعُ وسطاء جدد إلى مكتبك وتابع أداء كل عضو في الفريق."
        : "Invite new agents to your agency and track each team member's performance."
    },
    {
      selector: "agency-leads-tab",
      title: isRtl ? "إدارة العملاء" : "Leads Panel",
      body: isRtl
        ? "تابع جميع استفسارات العملاء الواردة عبر عقارات مكتبك."
        : "Track every client inquiry coming in across your agency's listings."
    },
    {
      selector: "agency-campaigns-tab",
      title: isRtl ? "الحملات الإعلانية" : "Ad Campaigns",
      body: isRtl
        ? "فعّل رفع (Boost) للعقارات المميزة لمكتبك - غير متاح لوسطاء الفريق أنفسهم، فقط لك كمسؤول."
        : "Activate boosts on your agency's listings - agency agents can't self-boost, only you as admin can."
    },
    {
      selector: "agency-verification-tab",
      title: isRtl ? "التوثيق" : "Verification",
      body: isRtl
        ? "ارفع مستندات مكتبك (السجل التجاري، رخصة الوساطة، إلخ) لتفعيل التوثيق الكامل."
        : "Upload your agency's documents (commercial registration, brokerage permit, etc.) for full verification."
    },
    {
      selector: "agency-profile-tab",
      title: isRtl ? "الإعدادات" : "Profile",
      body: isRtl
        ? "حدّث بيانات المكتب من هنا في أي وقت."
        : "Update your agency's details here any time."
    }
  ];

  const deskTourSteps = salesDeskTourSteps({ isRtl, isAdmin: true, tabSelector: "agency-salesdesk-tab", openDesk: () => setActiveTab("salesdesk") });
  const AGENCY_TOUR_STEPS: TourStep[] = tourMode === "whatsnew"
    ? deskTourSteps
    : [...AGENCY_BASE_TOUR_STEPS.slice(0, 3), ...deskTourSteps, ...AGENCY_BASE_TOUR_STEPS.slice(3)];

  const handleFinishTour = async () => {
    setShowTour(false);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`/api/users/${currentUser.id}/onboarding-tour-seen`, {
        method: "POST",
        headers,
        body: JSON.stringify({ seen: true, version: TOUR_VERSION })
      });
      const stored = localStorage.getItem("nerou_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("nerou_user", JSON.stringify({ ...parsed, hasSeenOnboardingTour: true, onboardingTourVersion: TOUR_VERSION }));
      }
      onRefreshAll();
    } catch (err) {
      console.error("Failed to persist onboarding tour state", err);
    }
  };

  // Profile / organization settings state (Part C)
  const [orgName, setOrgName] = useState<string>(agency.name);
  const [orgPhone, setOrgPhone] = useState<string>(agency.phone || "");
  const [orgWhatsapp, setOrgWhatsapp] = useState<string>(agency.whatsapp || "");
  const [orgWebsite, setOrgWebsite] = useState<string>(agency.website || "");
  const [orgLogoUrl, setOrgLogoUrl] = useState<string>(agency.logoUrl || "");
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [savingOrgProfile, setSavingOrgProfile] = useState<boolean>(false);

  // Change Password form state - this workspace only receives the org (not the acting user),
  // so the acting AGENCY_ADMIN's own id is read from the same "nerou_user" localStorage
  // record every workspace already writes back to on profile save.
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [passwordChanging, setPasswordChanging] = useState<boolean>(false);

  // Lead Routing Config state
  const [routingMethod, setRoutingMethod] = useState<string>(agency.leadRoutingPolicy || "ROUND_ROBIN");

  // Invite Agent State
  const [newAgentEmail, setNewAgentEmail] = useState<string>("");
  const [newAgentName, setNewAgentName] = useState<string>("");
  const [newAgentPhone, setNewAgentPhone] = useState<string>("");

  // Campaign State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState<boolean>(false);
  const [campBudget, setCampBudget] = useState<string>("");
  const [campEndDate, setCampEndDate] = useState<string>("");
  const [campType, setCampType] = useState<string>("FEATURED_LISTING");

  // SaaS upgrade state
  const [paymentProcessing, setPaymentProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (agency.leadRoutingPolicy) {
      setRoutingMethod(agency.leadRoutingPolicy);
    }
  }, [agency]);

  useEffect(() => {
    fetchAgencyContext();
    // Load the developer project catalog for the listing edit form's project selector.
    fetch("/api/projects")
      .then(res => res.json())
      .then((data: Project[]) => setAllProjects(data))
      .catch(e => console.error("Error fetching projects:", e));
  }, [agency.id]);

  const fetchAgencyContext = async () => {
    try {
      // Get all agents belonging to this organization
      // signed in: the server returns this organisation's full team records, not just the public profiles
      const usersRes = await fetch("/api/users", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const usersData = await usersRes.json();
      const orgAgents = usersData.filter((u: User) => u.orgId === agency.id && u.role === UserRole.AGENT);
      setAgents(orgAgents);

      // Get invitations
      const invRes = await fetch(`/api/organizations/${agency.id}/invitations`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData);
      }

      // Get org leads. GET /api/leads now requires auth (it used to be open and leaked
      // every lead in the system to anonymous callers).
      const leadsRes = await fetch(`/api/leads?orgId=${agency.id}`, {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setOrgLeads(leadsData);
      }

      // Get campaigns for this agency
      const campRes = await fetch("/api/campaigns");
      const campData = await campRes.json();
      const agencyCamps = campData.filter((c: AdCampaign) => c.orgId === agency.id);
      setCampaigns(agencyCamps);

      // Get this agency's own listings (for self-service ad boosts)
      const propsRes = await fetch(`/api/properties?orgId=${agency.id}&includeAllStatuses=true`);
      if (propsRes.ok) {
        setOrgProperties(await propsRes.json());
      }

      // Get subscription plan catalog
      // signed in, so the plan's price is included (visitors who are not signed in do not get prices)
      const plansRes = await fetch("/api/plans", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (plansRes.ok) {
        setPlans(await plansRes.json());
      }

      // Get this agency's own ad billing ledger (server scopes non-admin callers to their
      // own org automatically, so no orgId query param is needed here).
      const adChargesRes = await fetch("/api/ad-charges", {
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (adChargesRes.ok) {
        setAdCharges(await adChargesRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setLogoUploading(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("files", compressed);

      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // ?type=avatar skips the property-photo watermark - correct for an agency logo too.
      const res = await fetch("/api/media/upload?type=avatar", { method: "POST", headers, body: formData });
      if (res.ok) {
        const data = await res.json();
        const newLogoUrl = (data.fileUrls || data.urls || [])[0];
        if (newLogoUrl) setOrgLogoUrl(newLogoUrl);
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل رفع الشعار." : "Failed to upload logo."));
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error("Logo upload error:", err);
      setToastMessage(isRtl ? "فشل رفع الشعار." : "Failed to upload logo.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveOrgProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrgProfile(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/organizations/${agency.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: orgName, phone: orgPhone, whatsapp: orgWhatsapp, website: orgWebsite, logoUrl: orgLogoUrl })
      });

      if (res.ok) {
        onRefreshAll();
        setToastMessage(isRtl ? "تم حفظ ملف المكتب العقاري بنجاح!" : "Agency profile saved successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل حفظ ملف المكتب العقاري." : "Failed to save agency profile."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Save org profile error:", err);
      setToastMessage(isRtl ? "فشل حفظ ملف المكتب العقاري." : "Failed to save agency profile.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setSavingOrgProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const actingUserId = getActingUserId();
    if (!actingUserId) {
      setToastMessage(isRtl ? "تعذر تحديد المستخدم الحالي. يرجى إعادة تسجيل الدخول." : "Could not determine the current user. Please sign in again.");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setToastMessage(isRtl ? "كلمتا المرور الجديدتان غير متطابقتين." : "New password and confirmation do not match.");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }
    if (newPassword.length < 8) {
      setToastMessage(isRtl ? "يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل." : "New password must be at least 8 characters long.");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }

    setPasswordChanging(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/users/${actingUserId}/change-password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToastMessage(isRtl ? "تم تغيير كلمة المرور بنجاح!" : "Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setToastMessage(data.error || (isRtl ? "فشل تغيير كلمة المرور." : "Failed to change password."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Change password error:", err);
      setToastMessage(isRtl ? "فشل تغيير كلمة المرور." : "Failed to change password.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleInviteAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentEmail || !newAgentName) return;

    try {
      const res = await fetch(`/api/organizations/${agency.id}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          email: newAgentEmail,
          invitedRole: UserRole.AGENT
        })
      });

      const data = await res.json();
      if (res.ok) {
        setToastMessage(isRtl ? `تم إرسال دعوة انضمام بنجاح إلى البريد الإلكتروني ${newAgentEmail}` : `Invitation link sent successfully to ${newAgentEmail}!`);
        setTimeout(() => setToastMessage(""), 4000);
        setNewAgentEmail("");
        setNewAgentName("");
        setNewAgentPhone("");
        fetchAgencyContext();
      } else {
        setToastMessage(data.error || "Failed to send invitation.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage("Network error sending invitation.");
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handleSaveRouting = async () => {
    try {
      const res = await fetch(`/api/organizations/${agency.id}/routing`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ policy: routingMethod })
      });
      const data = await res.json();
      if (res.ok) {
        setToastMessage(isRtl ? "تم حفظ سياسة توزيع العملاء بنجاح!" : "Automated routing rules saved successfully!");
        setTimeout(() => setToastMessage(""), 4000);
        onRefreshAll();
      } else {
        setToastMessage(data.error || "Failed to save routing policy.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReassignLead = async (leadId: string, targetAgentId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ agentId: targetAgentId })
      });
      const data = await res.json();
      if (res.ok) {
        setToastMessage(isRtl ? "تم إعادة تعيين العميل بنجاح!" : "Lead successfully reassigned!");
        setTimeout(() => setToastMessage(""), 4000);
        fetchAgencyContext();
      } else {
        setToastMessage(data.error || "Failed to reassign lead.");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // In-app Lead Notification Center: fire-and-forget mark-as-read the moment a lead row is
  // opened (the whole row here - there's no separate expand/detail step in this table-style
  // Leads tab). Optimistically updates local state too, matching handleArchiveLead-style
  // fetch-and-forget calls already used elsewhere in this component.
  const markLeadRead = (leadId: string) => {
    setOrgLeads(prev => prev.map(l => (l.id === leadId ? { ...l, readByRecipient: true } : l)));
    fetch(`/api/leads/${leadId}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    }).catch(err => console.error("Failed to mark lead as read:", err));
  };

  // Listings tab (FIX 3): edit-in-place for any listing under this org. The server's
  // ownership gate on POST /api/properties (isEdit branch) already allows an AGENCY_ADMIN
  // to edit any listing whose orgId matches their own - not just their own personal listings.
  const startEditListing = (prop: Property) => {
    setEditingListingId(prop.id);
    setListingEditTitle(prop.title || "");
    setListingEditPrice(prop.price !== undefined ? String(prop.price) : "");
    setListingEditArea(prop.area !== undefined ? String(prop.area) : "");
    setListingEditBeds(prop.bedrooms !== undefined ? String(prop.bedrooms) : "");
    setListingEditBaths(prop.bathrooms !== undefined ? String(prop.bathrooms) : "");
    setListingEditType(prop.propertyType);
    setListingEditTrans(prop.transactionType);
    setListingEditDesc(prop.description || "");
    setListingEditProjectId(prop.projectId || "");
    setProjectAuthError(null);
  };

  const cancelEditListing = () => {
    setEditingListingId(null);
    setProjectAuthError(null);
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListingId) return;
    setSavingListing(true);
    setProjectAuthError(null);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/properties", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: editingListingId,
          title: listingEditTitle,
          price: Number(listingEditPrice),
          area: Number(listingEditArea),
          bedrooms: Number(listingEditBeds),
          bathrooms: Number(listingEditBaths),
          propertyType: listingEditType,
          transactionType: listingEditTrans,
          description: listingEditDesc,
          projectId: listingEditProjectId || undefined
        })
      });
      if (res.ok) {
        setEditingListingId(null);
        fetchAgencyContext();
        onRefreshAll();
        setToastMessage(isRtl ? "تم تحديث بيانات العقار بنجاح!" : "Listing updated successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403 && data.projectId) {
          setProjectAuthError({ projectId: data.projectId, message: data.error });
        } else {
          setToastMessage(data.error || (isRtl ? "تعذر تحديث العقار." : "Failed to update the listing."));
        }
      }
    } catch (err) {
      console.error("Failed to update listing", err);
      setToastMessage(isRtl ? "تعذر تحديث العقار." : "Failed to update the listing.");
    } finally {
      setSavingListing(false);
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  // Fired from the "Request representation" banner shown after a 403 on POST /api/properties
  // for an isPlatformDeveloper project this agency isn't (yet) authorized for.
  const handleRequestRepresentation = async () => {
    if (!projectAuthError) return;
    setRequestingRepresentation(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/projects/${projectAuthError.projectId}/representation-requests`, {
        method: "POST",
        headers
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToastMessage(isRtl ? "تم إرسال طلب التمثيل إلى المطور. سيتم إعلامك عند الموافقة." : "Representation request sent to the developer. You'll be notified once approved.");
        setProjectAuthError(null);
      } else {
        setToastMessage(data.error || (isRtl ? "تعذر إرسال طلب التمثيل." : "Failed to send the representation request."));
      }
      setTimeout(() => setToastMessage(""), 5000);
    } catch (err) {
      console.error("Failed to request representation", err);
      setToastMessage(isRtl ? "تعذر إرسال طلب التمثيل." : "Failed to send the representation request.");
      setTimeout(() => setToastMessage(""), 5000);
    } finally {
      setRequestingRepresentation(false);
    }
  };

  const handleDeleteListing = async (propertyId: string) => {
    setIsDeletingListing(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE", headers });
      if (res.ok) {
        fetchAgencyContext();
        onRefreshAll();
        setToastMessage(isRtl ? "تم حذف الإعلان." : "Listing deleted.");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر حذف الإعلان." : "Failed to delete the listing."));
      }
    } catch (e) {
      console.error("Failed to delete listing", e);
      setToastMessage(isRtl ? "تعذر حذف الإعلان." : "Failed to delete the listing.");
    } finally {
      setIsDeletingListing(false);
      setDeletingListingId(null);
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campBudget || !campEndDate) return;

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          orgId: agency.id,
          type: campType,
          budget: Number(campBudget),
          endDate: campEndDate,
          actorId: agency.id,
          actorName: agency.name,
          actorRole: UserRole.AGENCY_ADMIN
        })
      });
      if (res.ok) {
        setIsCreatingCampaign(false);
        setCampBudget("");
        setCampEndDate("");
        fetchAgencyContext();
        onRefreshAll();
        setToastMessage(isRtl ? "تم جدولة الحملة الترويجية وتنتظر موافقة الإدارة!" : "Ad campaign scheduled and pending administrative approval!");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // FIX 6: campaign Edit/Pause/Resume/Delete - previously only Create existed.
  const [campaignBudgetDrafts, setCampaignBudgetDrafts] = useState<Record<string, string>>({});
  const [copiedCampaignId, setCopiedCampaignId] = useState<string>("");
  const [pendingDeleteCampaignId, setPendingDeleteCampaignId] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);

  const handleUpdateCampaignBudget = async (campaignId: string) => {
    const draft = campaignBudgetDrafts[campaignId];
    if (!draft) return;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ budget: Number(draft) })
      });
      if (res.ok) {
        setCampaignBudgetDrafts(prev => ({ ...prev, [campaignId]: "" }));
        fetchAgencyContext();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePauseCampaign = async (camp: AdCampaign) => {
    try {
      const res = await fetch(`/api/campaigns/${camp.id}/${camp.status === "ACTIVE" ? "pause" : "resume"}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) fetchAgencyContext();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCampaign = (campaignId: string) => {
    setPendingDeleteCampaignId(campaignId);
  };

  const confirmDeleteCampaign = async () => {
    if (!pendingDeleteCampaignId) return;
    setDeletingCampaign(true);
    try {
      const res = await fetch(`/api/campaigns/${pendingDeleteCampaignId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) fetchAgencyContext();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingCampaign(false);
      setPendingDeleteCampaignId(null);
    }
  };

  const handleCopyCampaignLink = (campaignId: string) => {
    const link = `${window.location.origin}${window.location.pathname}?campaignId=${campaignId}`;
    navigator.clipboard.writeText(link);
    setCopiedCampaignId(campaignId);
    setTimeout(() => setCopiedCampaignId(""), 2000);
  };

  const handleUpgradeSubscription = async (planId: string) => {
    setPaymentProcessing(true);
    setPaymentSuccess(false);

    // Simulate safe idempotent billing capture
    setTimeout(async () => {
      try {
        const res = await fetch("/api/organizations/upgrade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            orgId: agency.id,
            planId,
            actorId: agency.id,
            actorName: agency.name,
            actorRole: UserRole.AGENCY_ADMIN
          })
        });

        if (res.ok) {
          setPaymentSuccess(true);
          fetchAgencyContext();
          onRefreshAll();
          setTimeout(() => setPaymentSuccess(false), 3000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPaymentProcessing(false);
      }
    }, 1500);
  };

  // Ad billing summary (Part C): current billing period total vs settled/unsettled amounts,
  // computed client-side from the org-scoped adCharges ledger already fetched above.
  const nowDate = new Date();
  const currentBillingPeriod = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const currentPeriodAdCharges = adCharges.filter((c: any) => c.billingPeriod === currentBillingPeriod);
  const currentPeriodAdTotal = currentPeriodAdCharges.reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdSettled = currentPeriodAdCharges.filter((c: any) => c.settled).reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdUnsettled = currentPeriodAdTotal - currentPeriodAdSettled;

  // Dashboard tab (FIX 3) KPI computations.
  const pendingInvitationsCount = invitations.filter((i: any) => i.status === "PENDING").length;
  const leadsThisMonth = orgLeads.filter(l => isThisMonth(l.createdDate));
  const convertedLeadsThisMonth = leadsThisMonth.filter(l => l.status === LeadStatus.CONVERTED).length;
  const conversionRateThisMonth = leadsThisMonth.length > 0 ? Math.round((convertedLeadsThisMonth / leadsThisMonth.length) * 100) : 0;

  // Sortable team performance table rows - one row per agent, metrics derived from the
  // already-fetched org-scoped orgProperties/orgLeads lists.
  const teamRows = agents.map(a => {
    const listingsCount = orgProperties.filter(p => p.agentId === a.id).length;
    const agentLeads = orgLeads.filter(l => l.agentId === a.id);
    const convertedCount = agentLeads.filter(l => l.status === LeadStatus.CONVERTED).length;
    const conversion = agentLeads.length > 0 ? Math.round((convertedCount / agentLeads.length) * 100) : 0;
    return { agent: a, listingsCount, leadsCount: agentLeads.length, conversion };
  });
  const sortedTeamRows = [...teamRows].sort((a, b) => {
    let cmp = 0;
    if (teamSortBy === "name") cmp = a.agent.fullName.localeCompare(b.agent.fullName);
    else if (teamSortBy === "listings") cmp = a.listingsCount - b.listingsCount;
    else if (teamSortBy === "leads") cmp = a.leadsCount - b.leadsCount;
    else if (teamSortBy === "conversion") cmp = a.conversion - b.conversion;
    return teamSortDir === "asc" ? cmp : -cmp;
  });
  const toggleTeamSort = (col: "name" | "listings" | "leads" | "conversion") => {
    if (teamSortBy === col) {
      setTeamSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTeamSortBy(col);
      setTeamSortDir("asc");
    }
  };

  // FIX 7: the SaaS Billing tab's "Current Active Plan" card must reflect the org's real
  // subscriptionPlanId/subscriptionStatus, not a hardcoded "Silver Broker" plan - reuses the
  // `plans` list already fetched from GET /api/plans above (fetchAgencyContext).
  const currentPlan = plans.find(p => p.id === agency.subscriptionPlanId);
  // FIX 6: the upsell card advertises itself as the Enterprise Agency plan (matching
  // "plan-premium"'s real limits - 100 properties / 10 agents - in DEFAULT_SUB_PLANS) but its
  // button used to call handleUpgradeSubscription("plan-developer") (Master Developer, wrong
  // tier for an agency). Resolve the plan by name instead of a hardcoded id so this stays
  // correct even if ids ever change, falling back to the known id.
  const enterprisePlan = plans.find(p => p.name === "Enterprise Agency") || plans.find(p => p.id === "plan-premium");

  // Leads + views trend chart (last 30 days) - views summed from each listing's real per-day
  // view tracking (Property.viewsByDay), leads from the org-scoped leads list.
  const agencyTrendSeries = buildDailySumSeries(
    orgProperties.map(p => p.viewsByDay || {}),
    30,
    isRtl,
    [datesToDayRecord(orgLeads.map(l => l.createdDate))]
  );

  const waitingCount = waitingLeads(orgLeads).length;
  const attention = agencyAttention({
    leads: orgLeads,
    properties: orgProperties,
    agentsWithoutListings: agents.filter(a => !orgProperties.some(p => p.agentId === a.id)).length,
    pendingInvitations: pendingInvitationsCount,
    now: Date.now()
  });
  const clock = new Date();
  const hour = clock.getHours();
  const firstName = (currentUser.fullName || "").split(" ")[0];
  const greeting = isRtl
    ? `${hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء النور"}، ${firstName}`
    : `${hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${firstName}`;

  const navGroups: NavGroup[] = [
    {
      id: "overview",
      label: { en: "Overview", ar: "نظرة عامة" },
      items: [{ id: "dashboard", label: { en: "Dashboard", ar: "لوحة القيادة" }, icon: LayoutDashboard, accent: "indigo", tourId: "agency-dashboard-tab" }]
    },
    {
      id: "business",
      label: { en: "Business", ar: "العمل" },
      items: [
        { id: "team", label: { en: "Agents Team", ar: "فريق العمل" }, icon: Users, accent: "violet", badge: pendingInvitationsCount, tourId: "agency-team-tab" },
        { id: "listings", label: { en: "Listings", ar: "العقارات المدرجة" }, icon: Building2, accent: "sky", tourId: "agency-listings-tab" },
        { id: "leads", label: { en: "Leads", ar: "إدارة العملاء" }, icon: Inbox, accent: "emerald", badge: waitingCount, tourId: "agency-leads-tab" },
        { id: "salesdesk", label: { en: "Sales Desk", ar: "مكتب المبيعات" }, icon: Briefcase, accent: "amber", tourId: "agency-salesdesk-tab" },
        { id: "routing", label: { en: "Lead Routing", ar: "توزيع العملاء" }, icon: Shuffle, accent: "fuchsia" }
      ]
    },
    {
      id: "growth",
      label: { en: "Growth", ar: "النمو" },
      items: [{ id: "campaigns", label: { en: "Ad Campaigns", ar: "الحملات الإعلانية" }, icon: Megaphone, accent: "rose", tourId: "agency-campaigns-tab" }]
    },
    {
      id: "account",
      label: { en: "Account", ar: "الحساب" },
      items: [
        { id: "subscription", label: { en: "Billing", ar: "الاشتراك والفواتير" }, icon: Receipt, accent: "teal" },
        { id: "verification", label: { en: "Verification", ar: "التوثيق" }, icon: ShieldCheck, accent: "indigo", tourId: "agency-verification-tab" },
        { id: "profile", label: { en: "Settings", ar: "الإعدادات" }, icon: Settings, accent: "gold", tourId: "agency-profile-tab" }
      ]
    }
  ];

  return (
    <div className="ws space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <WorkspaceHero
        eyebrow={greeting}
        title={isRtl ? "مساحة عمل المكتب العقاري" : "Agency Workspace"}
        subtitle={isRtl ? agency.nameAr || agency.name : agency.name}
        actions={
          <>
            <NotificationBell isRtl={isRtl} onClick={() => setActiveTab("leads")} />
            <button
              type="button"
              data-testid="invite-agent-cta"
              onClick={() => setActiveTab("team")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gold text-gold-ink text-sm font-bold shadow-card hover:brightness-110 cursor-pointer transition"
            >
              <UserPlus size={18} strokeWidth={2.5} aria-hidden />
              <span>{isRtl ? "دعوة وسيط" : "Invite agent"}</span>
            </button>
          </>
        }
      />

      <WorkspaceShell
        groups={navGroups}
        active={activeTab}
        onSelect={(id) => setActiveTab(id as typeof activeTab)}
        identity={{
          image: agency.logoUrl,
          initial: agency.name || "?",
          title: isRtl ? agency.nameAr || agency.name : agency.name,
          subtitle: (
            <>
              {plans.find(p => p.id === agency.subscriptionPlanId)?.name && (
                <span className="block truncate">{plans.find(p => p.id === agency.subscriptionPlanId)?.name}</span>
              )}
              {agency.verificationStatus === "APPROVED" ? (
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-success">
                  <ShieldCheck size={12} aria-hidden />
                  {isRtl ? "مكتب موثّق" : "Verified agency"}
                </span>
              ) : (
                <span className="mt-1 inline-flex items-center gap-1 font-semibold text-warning">
                  <AlertTriangle size={12} aria-hidden />
                  {isRtl ? "غير موثّق بعد" : "Not verified yet"}
                </span>
              )}
            </>
          )
        }}
        isRtl={isRtl}
      >

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <SubscriptionAlertBanner expiry={agency.subscriptionExpiry} isRtl={isRtl} onOpen={() => setActiveTab("subscription")} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Users}
              label={isRtl ? "إجمالي الوسطاء" : "Total Agents"}
              value={agents.length}
              subtitle={isRtl ? `${pendingInvitationsCount} دعوة معلقة` : `${pendingInvitationsCount} pending invite(s)`}
            />
            <StatCard
              icon={Building2}
              label={isRtl ? "إجمالي العقارات" : "Total Listings"}
              value={orgProperties.length}
            />
            <StatCard
              icon={TrendingUp}
              label={isRtl ? "عملاء هذا الشهر" : "Leads This Month"}
              value={leadsThisMonth.length}
              subtitle={isRtl ? `${orgLeads.length} إجمالي` : `${orgLeads.length} all-time`}
            />
            <StatCard
              icon={Award}
              label={isRtl ? "نسبة التحويل" : "Conversion Rate"}
              value={`${conversionRateThisMonth}%`}
              subtitle={isRtl ? "هذا الشهر" : "this month"}
            />
          </div>

          {/* Referral Program: "Invite & Earn" */}
          <ReferralPanel user={currentUser} isRtl={isRtl} />

          <QuickActions
            isRtl={isRtl}
            actions={[
              { id: "invite", icon: UserPlus, accent: "violet", label: { en: "Invite an agent", ar: "ادعُ وسيطاً" }, hint: { en: "Grow your team", ar: "وسّع فريقك" }, onClick: () => setActiveTab("team") },
              { id: "leads", icon: Inbox, accent: "emerald", label: { en: "Team enquiries", ar: "استفسارات الفريق" }, hint: waitingCount > 0 ? { en: `${waitingCount} waiting`, ar: `${waitingCount} بانتظار الرد` } : { en: "All answered", ar: "تم الرد على الجميع" }, onClick: () => setActiveTab("leads") },
              { id: "boost", icon: Megaphone, accent: "rose", label: { en: "Boost a listing", ar: "رقّ إعلاناً" }, hint: { en: "Reach more buyers", ar: "الوصول إلى مشترين أكثر" }, onClick: () => setActiveTab("campaigns") },
              { id: "billing", icon: Receipt, accent: "teal", label: { en: "Billing", ar: "الاشتراك والفواتير" }, hint: { en: "Plan and ad ledger", ar: "الخطة وسجل الإعلانات" }, onClick: () => setActiveTab("subscription") }
            ]}
          />
          <AttentionPanel items={attention} onGo={(tab) => setActiveTab(tab as typeof activeTab)} isRtl={isRtl} />

          {/* Leads + views trend chart */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="font-serif text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
              <BarChart2 size={14} className="text-gold" />
              <span>{isRtl ? "المشاهدات والعملاء المحتملون (آخر 30 يوماً)" : "Views & Leads (Last 30 Days)"}</span>
            </h4>
            <DashboardChart
              data={agencyTrendSeries}
              valueLabel={isRtl ? "مشاهدات" : "Views"}
              secondaryValueLabel={isRtl ? "عملاء محتملون" : "Leads"}
              isRtl={isRtl}
            />
          </div>

          <TopListingsPanel properties={topListings(orgProperties, 3)} isRtl={isRtl} onOpenAll={() => setActiveTab("listings")} />

          {/* Sortable team performance table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-4 bg-ink-inverse border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "أداء الفريق" : "Team Performance"}</h4>
            </div>
            {sortedTeamRows.length === 0 ? (
              <p className="p-8 text-center text-xs text-ink-muted">{isRtl ? "لا يوجد وسطاء بعد." : "No agents yet."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-ink-muted">
                      <th className="text-left px-4 py-2 font-semibold">
                        <button type="button" onClick={() => toggleTeamSort("name")} className="flex items-center gap-1 cursor-pointer hover:text-ink">
                          {isRtl ? "الاسم" : "Name"} <ArrowUpDown size={11} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">{isRtl ? "الحالة" : "Status"}</th>
                      <th className="text-left px-4 py-2 font-semibold">
                        <button type="button" onClick={() => toggleTeamSort("listings")} className="flex items-center gap-1 cursor-pointer hover:text-ink">
                          {isRtl ? "العقارات" : "Listings"} <ArrowUpDown size={11} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">
                        <button type="button" onClick={() => toggleTeamSort("leads")} className="flex items-center gap-1 cursor-pointer hover:text-ink">
                          {isRtl ? "العملاء" : "Leads"} <ArrowUpDown size={11} />
                        </button>
                      </th>
                      <th className="text-left px-4 py-2 font-semibold">
                        <button type="button" onClick={() => toggleTeamSort("conversion")} className="flex items-center gap-1 cursor-pointer hover:text-ink">
                          {isRtl ? "التحويل" : "Conversion"} <ArrowUpDown size={11} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-2">
                    {sortedTeamRows.map(row => (
                      <tr key={row.agent.id}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {row.agent.avatarUrl ? (
                              <img src={row.agent.avatarUrl} alt={row.agent.fullName} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-surface-2 text-ink font-bold flex items-center justify-center shrink-0 text-[10px]">
                                {row.agent.fullName.charAt(0)}
                              </span>
                            )}
                            <span className="font-bold text-ink">{row.agent.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge tone="success">{isRtl ? "نشط" : "Active"}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-ink">{row.listingsCount}</td>
                        <td className="px-4 py-2.5 text-ink">{row.leadsCount}</td>
                        <td className="px-4 py-2.5 text-ink font-bold">{row.conversion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ad billing summary - reuses the same computation as the Subscription tab's full ledger. */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
                <DollarSign size={14} className="text-gold" />
                <span>{isRtl ? "ملخص فوترة الإعلانات" : "Ad Billing Summary"}</span>
              </h4>
              <button type="button" onClick={() => setActiveTab("subscription")} className="text-[11px] font-bold text-gold hover:underline cursor-pointer">
                {isRtl ? "عرض السجل الكامل" : "View full ledger"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{currentBillingPeriod} {isRtl ? "الإجمالي" : "Total"}</p>
                <p className="text-lg font-serif font-bold text-ink">{currentPeriodAdTotal.toLocaleString()} QAR</p>
              </div>
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{isRtl ? "مسواة" : "Settled"}</p>
                <p className="text-lg font-serif font-bold text-success">{currentPeriodAdSettled.toLocaleString()} QAR</p>
              </div>
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{isRtl ? "غير مسواة" : "Unsettled"}</p>
                <p className="text-lg font-serif font-bold text-warning">{currentPeriodAdUnsettled.toLocaleString()} QAR</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "verification" && (
        <SectionHeader icon={ShieldCheck} accent="indigo" title={isRtl ? "التوثيق" : "Verification"} description={isRtl ? "ارفع مستندات مكتبك. المكاتب الموثّقة تظهر أولاً وتكسب الثقة." : "Upload your agency documents. Verified agencies are shown first and earn trust."} />
      )}

      {/* VERIFICATION TAB */}
      {activeTab === "verification" && <VerificationDocumentsPanel isRtl={isRtl} />}

      {activeTab === "profile" && (
        <SectionHeader icon={Settings} accent="gold" title={isRtl ? "الإعدادات" : "Settings"} description={isRtl ? "بيانات مكتبك العامة وشعاره والأمان." : "Your agency's public details, logo and security."} />
      )}

      {/* PROFILE / SETTINGS TAB */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="bg-surface p-6 rounded-xl border border-border flex items-center justify-between gap-4 text-xs">
            <div>
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "الجولة التعريفية" : "Guided Tour"}</h4>
              <p className="text-ink-muted mt-0.5">{isRtl ? "أعد مشاهدة جولة التعريف بلوحة تحكم المكتب." : "Replay the guided tour of your agency dashboard."}</p>
            </div>
            <button
              type="button"
              onClick={() => { setTourMode("full"); setShowTour(true); }}
              className="px-4 py-2 bg-surface-2 hover:bg-border text-ink font-semibold rounded-lg cursor-pointer shrink-0"
            >
              {isRtl ? "أرني الجولة مرة أخرى" : "Show me the tour again"}
            </button>
          </div>

          <form onSubmit={handleSaveOrgProfile} className="bg-surface p-6 rounded-xl border border-border space-y-4 text-xs">
            <div className="flex items-center gap-4 border-b border-surface-2 pb-4">
              <div className="relative shrink-0">
                {orgLogoUrl ? (
                  <img src={orgLogoUrl} alt={orgName} className="w-16 h-16 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 bg-gold text-black font-bold text-xl rounded-xl flex items-center justify-center">
                    {orgName.charAt(0)}
                  </div>
                )}
                <label
                  htmlFor="agency-logo-upload"
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-chrome hover:bg-gold hover:text-gold-ink text-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white"
                  title={isRtl ? "تغيير الشعار" : "Change logo"}
                >
                  {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                </label>
                <input
                  id="agency-logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={logoUploading}
                  onChange={handleLogoUpload}
                />
              </div>
              <div>
                <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
                  <Settings size={14} className="text-gold" />
                  <span>{isRtl ? "ملف المكتب العقاري" : "Agency Profile"}</span>
                </h4>
                <p className="text-[10px] text-ink-muted mt-0.5">{isRtl ? "قم بتحديث شعار المكتب وبيانات التواصل الرسمية." : "Update your agency logo and official contact details."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "اسم المكتب" : "Agency Name"}</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "رقم واتساب" : "WhatsApp Number"}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={orgWhatsapp}
                  onChange={(e) => setOrgWhatsapp(e.target.value)}
                  placeholder="+97433334444"
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الموقع الإلكتروني" : "Website"}</label>
                <input
                  type="text"
                  value={orgWebsite}
                  onChange={(e) => setOrgWebsite(e.target.value)}
                  placeholder="https://"
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-2">
              <button
                type="submit"
                disabled={savingOrgProfile}
                className="px-6 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {savingOrgProfile ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ ملف المكتب" : "Save Agency Profile")}
              </button>
            </div>
          </form>

          <form onSubmit={handleChangePassword} className="bg-surface p-6 rounded-xl border border-border space-y-4 text-xs">
            <div className="border-b border-surface-2 pb-3 flex items-center gap-2">
              <Lock size={16} className="text-gold" />
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "تغيير كلمة المرور" : "Change Password"}</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "كلمة المرور الحالية" : "Current Password"}</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "كلمة المرور الجديدة" : "New Password"}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-ink-inverse border border-border rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-surface-2">
              <button
                type="submit"
                disabled={passwordChanging}
                className="px-6 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {passwordChanging ? (isRtl ? "جارٍ التحديث..." : "Updating...") : (isRtl ? "تغيير كلمة المرور" : "Change Password")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTINGS TAB (FIX 3) - agency admins can edit or delete any listing under their own
          org, not just their personal ones; POST /api/properties (isEdit branch) and
          DELETE /api/properties/:id already authorize an AGENCY_ADMIN whose orgId matches
          the listing's orgId, so no new backend logic is needed beyond the scoped DELETE
          route added alongside this UI. */}
      {activeTab === "listings" && (
        <div className="space-y-5">
          <SectionHeader
            icon={Building2}
            accent="sky"
            title={isRtl ? "العقارات المدرجة" : "Listings"}
            description={isRtl ? "كل عقارات المكتب ووسطائه: عدّل، تابع الأداء، أو احذف." : "Every listing across your agency: edit, check performance or remove."}
          />
          <StatStrip
            items={[
              { label: isRtl ? "إجمالي العقارات" : "Total listings", value: orgProperties.length, icon: Building2, accent: "sky" },
              { label: isRtl ? "منشورة" : "Live", value: orgProperties.filter(p => p.listingStatus === "PUBLISHED").length, icon: CheckCircle, accent: "emerald" },
              { label: isRtl ? "غير منشورة" : "Not live", value: orgProperties.filter(p => p.listingStatus !== "PUBLISHED").length, icon: AlertTriangle, accent: "amber" },
              { label: isRtl ? "وسطاء" : "Agents", value: agents.length, icon: Users, accent: "violet" }
            ]}
          />
          <input
            type="search"
            value={listingSearch}
            onChange={(e) => { setListingSearch(e.target.value); setListingLimit(20); }}
            placeholder={isRtl ? "ابحث بالعنوان أو الرقم أو المنطقة أو الوسيط..." : "Search by title, reference, area or agent..."}
            aria-label={isRtl ? "بحث في العقارات" : "Search listings"}
            className="w-full px-4 py-3 bg-surface border border-border rounded-xl"
          />

          {orgProperties.length === 0 ? (
            <EmptyState
              icon={<Building2 size={20} />}
              title={isRtl ? "لا توجد عقارات بعد" : "No listings yet"}
              description={isRtl ? "ستظهر هنا عقارات وسطائكم بمجرد إضافتها." : "Listings added by your agents will appear here."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const q = listingSearch.trim().toLowerCase();
                const matches = q
                  ? orgProperties.filter(p => [p.title, p.titleAr, p.listingId, p.district, p.city, agents.find(a => a.id === p.agentId)?.fullName].some(v => (v || "").toLowerCase().includes(q)))
                  : orgProperties;
                const page = matches.slice(0, listingLimit);
                return (
                  <>
                    {matches.length === 0 && <p className="text-center text-ink-muted py-8">{isRtl ? "لا نتائج مطابقة." : "No listings match your search."}</p>}
                    {page.map(prop => (
                <ListingCard
                  key={prop.id}
                  property={prop}
                  isRtl={isRtl}
                  notice={
                    <p className="text-[12px] text-ink-muted">
                      {isRtl ? "الوسيط: " : "Agent: "}<span className="font-semibold text-ink">{agents.find(a => a.id === prop.agentId)?.fullName || "—"}</span>
                    </p>
                  }
                >
                  <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setPerformanceListingId(prop.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <TrendingUp size={14} />
                      <span>{isRtl ? "الأداء" : "Performance"}</span>
                    </button>
                    <CmaReportButton property={prop} agent={currentUser} orgName={agency.name} isRtl={isRtl} />
                    <button
                      type="button"
                      onClick={() => (editingListingId === prop.id ? cancelEditListing() : startEditListing(prop))}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <Edit2 size={14} />
                      <span>{editingListingId === prop.id ? (isRtl ? "إغلاق" : "Close") : (isRtl ? "تعديل" : "Edit")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingListingId(prop.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-danger hover:bg-danger-soft rounded-lg cursor-pointer transition-colors ms-auto"
                    >
                      <Trash2 size={14} />
                      <span>{isRtl ? "حذف" : "Delete"}</span>
                    </button>
                  </div>

                  {editingListingId === prop.id && (
                    <form onSubmit={handleSaveListing} className="bg-canvas p-4 rounded-lg border border-gold/30 space-y-3">
                      <div>
                        <label className="block font-medium text-ink-muted mb-1">{isRtl ? "العنوان" : "Title"}</label>
                        <input type="text" required value={listingEditTitle} onChange={(e) => setListingEditTitle(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "النوع" : "Type"}</label>
                          <select value={listingEditType} onChange={(e) => setListingEditType(e.target.value as PropertyType)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg">
                            {Object.values(PropertyType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المعاملة" : "Transaction"}</label>
                          <select value={listingEditTrans} onChange={(e) => setListingEditTrans(e.target.value as TransactionType)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg">
                            {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "السعر (ر.ق)" : "Price (QAR)"}</label>
                          <input type="number" required min="0" value={listingEditPrice} onChange={(e) => setListingEditPrice(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                        </div>
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المساحة (م²)" : "Area (SQM)"}</label>
                          <input type="number" required min="0" value={listingEditArea} onChange={(e) => setListingEditArea(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                        </div>
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "غرف النوم" : "Bedrooms"}</label>
                          <input type="number" min="0" value={listingEditBeds} onChange={(e) => setListingEditBeds(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                        </div>
                        <div>
                          <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الحمامات" : "Bathrooms"}</label>
                          <input type="number" min="0" value={listingEditBaths} onChange={(e) => setListingEditBaths(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                        </div>
                      </div>
                      <div>
                        <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الوصف" : "Description"}</label>
                        <textarea rows={2} value={listingEditDesc} onChange={(e) => setListingEditDesc(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg" />
                      </div>
                      <div>
                        <label className="block font-medium text-ink-muted mb-1">{isRtl ? "ربط بمشروع تطوير (اختياري)" : "Link to a developer project (optional)"}</label>
                        <select
                          value={listingEditProjectId}
                          onChange={(e) => setListingEditProjectId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                        >
                          <option value="">{isRtl ? "بدون مشروع" : "No project"}</option>
                          {allProjects.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.developerName}{p.isPlatformDeveloper ? "" : (isRtl ? " (خارج المنصة)" : " (off-platform)")}
                            </option>
                          ))}
                        </select>
                      </div>
                      {projectAuthError && (
                        <div className="p-3 bg-warning-soft border border-warning/30 rounded-lg space-y-2 text-[11px]">
                          <p className="font-semibold text-ink">{projectAuthError.message}</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            loading={requestingRepresentation}
                            onClick={handleRequestRepresentation}
                          >
                            {isRtl ? "طلب تمثيل هذا المشروع" : "Request representation"}
                          </Button>
                        </div>
                      )}
                      <div className="flex gap-2 justify-end pt-1">
                        <button type="button" onClick={cancelEditListing} className="px-4 py-2 bg-surface hover:bg-surface-2 border border-border rounded-lg font-semibold cursor-pointer">
                          {isRtl ? "إلغاء" : "Cancel"}
                        </button>
                        <button type="submit" disabled={savingListing} className="px-6 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg disabled:opacity-50 cursor-pointer">
                          {savingListing ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ التغييرات" : "Save Changes")}
                        </button>
                      </div>
                    </form>
                  )}
                </ListingCard>
                    ))}
                    {matches.length > listingLimit && (
                      <button
                        type="button"
                        onClick={() => setListingLimit(n => n + 20)}
                        className="w-full py-3 rounded-2xl border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        {isRtl ? `عرض المزيد (${matches.length - listingLimit})` : `Show more (${matches.length - listingLimit} left)`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <ConfirmDialog
            open={!!deletingListingId}
            onCancel={() => setDeletingListingId(null)}
            onConfirm={() => deletingListingId && handleDeleteListing(deletingListingId)}
            title={isRtl ? "هل تريد حذف هذا العقار؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this listing? This cannot be undone."}
            tone="danger"
            loading={isDeletingListing}
            isRtl={isRtl}
          />

          <ListingPerformanceModal
            open={!!performanceListingId}
            onClose={() => setPerformanceListingId(null)}
            property={orgProperties.find(p => p.id === performanceListingId) || null}
            leads={orgLeads}
            isRtl={isRtl}
          />
        </div>
      )}

      {activeTab === "team" && (
        <SectionHeader icon={Users} accent="violet" title={isRtl ? "فريق العمل" : "Agents Team"} description={isRtl ? "وسطاؤك، وما يتولاه كل منهم، ومن دعوتَه." : "Your brokers, what each one is handling, and who you have invited."} />
      )}

      {/* TEAM TAB */}
      {activeTab === "team" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Agents list */}
          <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-4 bg-ink-inverse border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
                <Users size={14} className="text-gold" />
                <span>{isRtl ? "قائمة المستشارين العقاريين" : "Active Certified Brokers"}</span>
              </h4>
            </div>
            {agents.length === 0 ? (
              <EmptyState
                icon={<Users size={20} />}
                title={isRtl ? "لا يوجد وسطاء بعد" : "No agents yet"}
                description={isRtl ? "ادعُ وسيطك العقاري الأول للانضمام إلى مساحة عمل مكتبك." : "Invite your first broker to join your agency workspace."}
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<UserPlus size={14} />}
                    onClick={() => {
                      const el = document.getElementById("agency-invite-broker-name");
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      (el as HTMLInputElement | null)?.focus();
                    }}
                  >
                    {isRtl ? "دعوة وسيط" : "Invite Agent"}
                  </Button>
                }
              />
            ) : (
            <div className="divide-y divide-surface-2 text-xs">
              {agents.map(agent => {
                const agentListingCount = orgProperties.filter(p => p.agentId === agent.id).length;
                const agentLeadCount = orgLeads.filter(l => l.agentId === agent.id).length;
                return (
                  <div key={agent.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {agent.avatarUrl ? (
                        <img src={agent.avatarUrl} alt="" className="w-11 h-11 rounded-2xl object-cover shrink-0" />
                      ) : (
                        <span className="w-11 h-11 rounded-2xl bg-violet-100 text-violet-700 font-serif font-bold text-lg flex items-center justify-center shrink-0">
                          {agent.fullName.charAt(0)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-[15px] text-ink truncate">{agent.fullName}</p>
                        <p className="text-[12px] text-ink-muted truncate">{agent.email}</p>
                        {!!agent.specialties?.length && <p className="text-[12px] text-ink-faint truncate">{agent.specialties.join(" · ")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="info" className="!normal-case" title={isRtl ? "عدد العقارات" : "Listings"}>
                        <Building2 size={12} aria-hidden /> {agentListingCount} {isRtl ? "عقار" : "listings"}
                      </Badge>
                      <Badge tone="gold" className="!normal-case" title={isRtl ? "عدد العملاء المحتملين" : "Leads"}>
                        <Inbox size={12} aria-hidden /> {agentLeadCount} {isRtl ? "عميل" : "leads"}
                      </Badge>
                      <Badge tone="success" dot className="!normal-case">{isRtl ? "نشط" : "Active"}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* Pending Invitations Section */}
            <div className="p-4 bg-ink-inverse border-t border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "دعوات الانضمام المعلقة" : "Pending Joining Invitations"}</h4>
            </div>
            <div className="divide-y divide-surface-2 text-xs">
              {invitations.length === 0 ? (
                <p className="p-4 text-ink-muted italic">{isRtl ? "لا توجد دعوات معلقة" : "No pending broker invitations."}</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-ink">{inv.email}</p>
                      <p className="text-[10px] text-ink-muted">
                        {isRtl ? "تاريخ الإرسال: " : "Sent: "} {new Date(inv.createdDate).toLocaleDateString()} • {isRtl ? "تنتهي في: " : "Expires: "} {new Date(inv.expiresDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge tone="warning" dot className="!normal-case">{inv.status === "PENDING" ? (isRtl ? "بانتظار القبول" : "Pending") : inv.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invite broker */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-4 h-fit">
            <h4 className="font-serif text-base font-semibold text-ink">{isRtl ? "دعوة وسيط عقاري جديد" : "Invite Licensed Broker"}</h4>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              {isRtl ? "أدخل البريد الإلكتروني للوسيط التابع للوكالة لإضافته إلى حساب مساحة العمل وترحيل العقارات والعملاء تلقائيًا." : "Send joining credentials to brokers. Once registered, they gain full assigned lead tracking privileges under your organization."}
            </p>
            <form onSubmit={handleInviteAgent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-ink-muted mb-1">{isRtl ? "اسم الوسيط" : "Broker Name"}</label>
                <input
                  id="agency-invite-broker-name"
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Faisal Hassan"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="block text-[10px] text-ink-muted mb-1">{isRtl ? "البريد الإلكتروني" : "Email address"}</label>
                <input
                  type="email"
                  required
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  placeholder="e.g. broker@elitegulf.qa"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-gold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                {isRtl ? "إرسال دعوة انضمام" : "Send Invitation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "routing" && (
        <SectionHeader icon={Shuffle} accent="fuchsia" title={isRtl ? "توزيع العملاء" : "Lead Routing"} description={isRtl ? "حدّد كيف تُوزَّع الاستفسارات الجديدة على وسطائك." : "Decide how new enquiries are shared among your agents."} />
      )}

      {/* LEAD ROUTING TAB */}
      {activeTab === "routing" && (
        <div className="bg-surface p-6 rounded-xl border border-border space-y-6 max-w-2xl text-xs">
          <div>
            <h4 className="font-serif text-base font-semibold text-ink">{isRtl ? "توزيع وتوجيه العملاء آليًا" : "SaaS Automated Lead Routing Policy"}</h4>
            <p className="text-ink-muted mt-1 leading-relaxed">
              {isRtl ? "اختر السياسة الأنسب لتوجيه الاستفسارات ومعاينات واتساب الواردة إلى الوسطاء التابعين للوكالة تلقائيًا." : "Set target rules on how the system automatically distributes hot leads, viewing reservations, and whatsapp intents."}
            </p>
          </div>

          <div className="space-y-3">
            <label className="p-4 bg-ink-inverse border border-gold/40 rounded-xl flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "ROUND_ROBIN"}
                onChange={() => setRoutingMethod("ROUND_ROBIN")}
                className="text-gold focus:ring-gold"
              />
              <div>
                <h5 className="font-bold text-ink">{isRtl ? "التوزيع الدائري المتساوي (Round Robin)" : "Fair Round-Robin Cycle"}</h5>
                <p className="text-[11px] text-ink-muted mt-0.5">{isRtl ? "يتم توجيه كل عميل جديد إلى الوسيط التالي في القائمة بالتناوب بشكل عادل." : "Every incoming client intent is routed sequentially to the next broker to maximize coverage parity."}</p>
              </div>
            </label>

            <label className="p-4 bg-surface border border-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "AREA_BASED"}
                onChange={() => setRoutingMethod("AREA_BASED")}
                className="text-gold focus:ring-gold"
              />
              <div>
                <h5 className="font-bold text-ink">{isRtl ? "التوزيع الجغرافي حسب التخصص (Area-based)" : "Geographic Area Specialty"}</h5>
                <p className="text-[11px] text-ink-muted mt-0.5">{isRtl ? "يتم إسناد العميل إلى الوسيط المتخصص في المنطقة الجغرافية التي يقع فيها العقار." : "Directly routing queries to brokers who listed Pearl Qatar or Lusail district specializations in profiles."}</p>
              </div>
            </label>

            <label className="p-4 bg-surface border border-border rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "PERFORMANCE"}
                onChange={() => setRoutingMethod("PERFORMANCE")}
                className="text-gold focus:ring-gold"
              />
              <div>
                <h5 className="font-bold text-ink">{isRtl ? "التوزيع حسب الأداء والسرعة (Performance-based)" : "Broker Performance Priority"}</h5>
                <p className="text-[11px] text-ink-muted mt-0.5">{isRtl ? "يتم توجيه العميل تلقائيًا إلى الوسيط صاحب أسرع معدل استجابة وأعلى نسبة تحويل صفقات." : "Routes leads preferentially to representatives displaying lower average lead processing times."}</p>
              </div>
            </label>
          </div>

          <button
            onClick={handleSaveRouting}
            className="px-6 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg cursor-pointer"
          >
            {isRtl ? "حفظ سياسة التوجيه" : "Save Routing Setup"}
          </button>
        </div>
      )}

      {activeTab === "campaigns" && (
        <SectionHeader icon={Megaphone} accent="rose" title={isRtl ? "الحملات الإعلانية" : "Ad Campaigns"} description={isRtl ? "رقِّ إعلاناتك للوصول إلى مشترين أكثر وتابع ما تنفقه." : "Boost your listings to reach more buyers and track what you spend."} />
      )}

      {/* AD CAMPAIGNS TAB */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Self-service ad boosts (instant, no admin approval - independent of the campaign flow below) */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-4 bg-ink-inverse border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "رفع فوري للإعلانات (بدون موافقة إدارية)" : "Self-Service Listing Boosts"}</h4>
              <p className="text-[10px] text-ink-muted mt-0.5">
                {isRtl ? "متاح فقط للحسابات ذات الاشتراك النشط." : "Requires an active subscription. Charges are logged instantly to your Ad Billing Ledger."}
              </p>
            </div>
            <div className="divide-y divide-surface-2 max-h-80 overflow-y-auto">
              {orgProperties.length === 0 ? (
                <p className="p-6 text-center text-ink-muted">{isRtl ? "لا توجد عقارات مسجلة بعد." : "No listings found for this agency yet."}</p>
              ) : (
                orgProperties.map(prop => (
                  <div key={prop.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-bold text-ink truncate">{isRtl ? prop.titleAr : prop.title}</p>
                      <p className="text-[10px] text-ink-muted">{prop.district}, {prop.city}</p>
                    </div>
                    <BoostButton property={prop} isRtl={isRtl} bonusBoostCredits={currentUser.bonusBoostCredits} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Smart Boost Recommendations panel - AI-assisted "Recommended to Boost" analysis. */}
          <BoostRecommendations properties={orgProperties} orgId={agency.id} isRtl={isRtl} />

          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "إعلانات العقارات المميزة والمدعومة" : "Promoted Listings Marketing campaigns"}</h4>
            <button
              onClick={() => setIsCreatingCampaign(!isCreatingCampaign)}
              className="px-3 py-1.5 bg-chrome hover:bg-gold hover:text-gold-ink text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "بدء حملة إعلانية" : "Launch Promotion"}</span>
            </button>
          </div>

          {isCreatingCampaign && (
            <form onSubmit={handleCreateCampaign} className="bg-surface p-5 rounded-xl border border-gold/30 space-y-4 max-w-xl text-xs animate-in slide-in-from-top duration-200">
              <h5 className="font-serif text-sm font-bold text-ink border-b border-surface-2 pb-2">
                {isRtl ? "تفاصيل ترويج العقار المختار" : "Configure Promoted Campaign Parameters"}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الميزانية الكلية (ريال قطري)" : "Total Campaign Budget (QAR)"}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min="0"
                    value={campBudget}
                    onChange={(e) => setCampBudget(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "تاريخ انتهاء الحملة" : "Target End Date"}</label>
                  <input
                    type="date"
                    required
                    value={campEndDate}
                    onChange={(e) => setCampEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "نوع الإعلان والظهور" : "Ad Placement Class"}</label>
                <select
                  value={campType}
                  onChange={(e) => setCampType(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                >
                  <option value="FEATURED_LISTING">Featured Listing (Top of Grid / تمييز الإعلان في الصدر)</option>
                  <option value="SPONSORED_SEARCH">Sponsored Search (AI Recommended / مطابقة مفضلة بالذكاء الاصطناعي)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-2 border border-border rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-chrome hover:bg-gold hover:text-gold-ink text-white font-semibold rounded-lg"
                >
                  Schedule and Submit
                </button>
              </div>
            </form>
          )}

          {/* Active Campaigns list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(camp => (
              <div key={camp.id} className="p-5 bg-surface border border-border rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-surface-2 pb-2">
                  <span className="text-xs font-bold text-ink uppercase">{camp.type}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                    camp.status === "ACTIVE" ? "bg-green-50 text-green-700 border-green-200" :
                    camp.status === "PAUSED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                    "bg-gray-100 text-gray-600 border-gray-200"
                  }`}>
                    {camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "المشاهدات" : "Impressions"}</span>
                    <span className="font-bold text-ink">{camp.metrics.impressions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "النقرات" : "Clicks"}</span>
                    <span className="font-bold text-ink">{camp.metrics.clicks}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "الحفظ" : "Saves"}</span>
                    <span className="font-bold text-ink">{camp.metrics.saves}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "العملاء" : "Leads"}</span>
                    <span className="font-bold text-ink">{camp.metrics.leads}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "الإنفاق" : "Spend"}</span>
                    <span className="font-bold text-ink">{camp.metrics.spend} QAR</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-muted block">{isRtl ? "الميزانية" : "Budget"}</span>
                    <span className="font-bold text-gold">{camp.budget} QAR</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-surface-2 flex-wrap">
                  <input
                    type="number"
                    value={campaignBudgetDrafts[camp.id] || ""}
                    onChange={(e) => setCampaignBudgetDrafts(prev => ({ ...prev, [camp.id]: e.target.value }))}
                    placeholder={isRtl ? "ميزانية جديدة" : "New budget"}
                    className="w-24 px-2 py-1 bg-ink-inverse border border-border rounded text-[10px]"
                  />
                  <button
                    type="button"
                    disabled={!campaignBudgetDrafts[camp.id]}
                    onClick={() => handleUpdateCampaignBudget(camp.id)}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-2 border border-border rounded text-[10px] font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    {isRtl ? "تعديل" : "Edit"}
                  </button>
                  {(camp.status === "ACTIVE" || camp.status === "PAUSED") && (
                    <button
                      type="button"
                      onClick={() => handleTogglePauseCampaign(camp)}
                      className="px-2.5 py-1 bg-surface hover:bg-surface-2 border border-border rounded text-[10px] font-semibold cursor-pointer"
                    >
                      {camp.status === "ACTIVE" ? (isRtl ? "إيقاف مؤقت" : "Pause") : (isRtl ? "استئناف" : "Resume")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyCampaignLink(camp.id)}
                    className="px-2.5 py-1 bg-surface hover:bg-surface-2 border border-border rounded text-[10px] font-semibold cursor-pointer"
                  >
                    {copiedCampaignId === camp.id ? (isRtl ? "تم النسخ!" : "Copied!") : (isRtl ? "نسخ رابط التتبع" : "Copy Tracking Link")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="px-2.5 py-1 bg-surface hover:bg-red-50 border border-border hover:border-red-200 text-red-600 rounded text-[10px] font-semibold cursor-pointer"
                  >
                    {isRtl ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "salesdesk" && <SalesDesk isRtl={isRtl} />}

      {/* LEADS PANEL TAB */}
      {activeTab === "leads" && (() => {
        const nowMs = Date.now();
        const waitingIds = new Set(waitingLeads(orgLeads).map(l => l.id));
        const unassignedCount = orgLeads.filter(l => !l.agentId).length;
        const shown = orgLeads
          .filter(l => (leadFilter === "unassigned" ? !l.agentId : leadFilter === "waiting" ? waitingIds.has(l.id) : true))
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
        return (
          <div className="space-y-5">
            <SectionHeader
              icon={Inbox}
              accent="emerald"
              title={isRtl ? "إدارة العملاء" : "Leads"}
              description={isRtl ? "راقب استفسارات فريقك وأعد توزيعها على الوسطاء لتسريع الرد." : "Oversee your team's enquiries and reassign them to speed up replies."}
            />
            <StatStrip
              items={[
                { label: isRtl ? "كل الاستفسارات" : "All enquiries", value: orgLeads.length, icon: Inbox, accent: "indigo", onClick: () => { setLeadFilter("all"); setLeadLimit(30); }, active: leadFilter === "all" },
                { label: isRtl ? "بانتظار الرد" : "Waiting for a reply", value: waitingIds.size, icon: AlertTriangle, accent: "rose", onClick: () => { setLeadFilter("waiting"); setLeadLimit(30); }, active: leadFilter === "waiting" },
                { label: isRtl ? "بلا وسيط" : "Unassigned", value: unassignedCount, icon: Shuffle, accent: "amber", onClick: () => { setLeadFilter("unassigned"); setLeadLimit(30); }, active: leadFilter === "unassigned" }
              ]}
            />
            {shown.length === 0 ? (
              <EmptyState
                icon={<Inbox size={20} />}
                title={orgLeads.length === 0 ? (isRtl ? "لا توجد استفسارات بعد" : "No enquiries yet") : (isRtl ? "لا شيء هنا" : "Nothing here")}
                description={orgLeads.length === 0 ? (isRtl ? "ستظهر هنا استفسارات عقارات مكتبكم." : "Enquiries about your agency's listings will appear here.") : undefined}
              />
            ) : (
              <div className="space-y-3">
                {shown.slice(0, leadLimit).map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isRtl={isRtl}
                    now={nowMs}
                    unread={lead.readByRecipient === false}
                    onOpen={() => markLeadRead(lead.id)}
                    onViewProperty={lead.propertyId ? () => setLeadPropertyPreview(orgProperties.find(p => p.id === lead.propertyId) || null) : undefined}
                    footer={
                      <p className="text-[12px] text-ink-muted">
                        {isRtl ? "الوسيط الحالي: " : "Assigned to: "}
                        {agents.find(a => a.id === lead.agentId)?.fullName || (
                          <span className="text-danger font-semibold">{isRtl ? "غير معيّن" : "Unassigned"}</span>
                        )}
                      </p>
                    }
                    controls={
                      <select
                        value={lead.agentId || ""}
                        onChange={(e) => handleReassignLead(lead.id, e.target.value)}
                        aria-label={isRtl ? "إعادة تعيين" : "Reassign"}
                        className="px-3 py-2 bg-surface border border-border rounded-xl text-[13px] font-semibold text-ink cursor-pointer max-w-[220px]"
                      >
                        <option value="">{isRtl ? "اختر وسيطاً" : "Assign broker"}</option>
                        {agents.map(ag => (
                          <option key={ag.id} value={ag.id}>{ag.fullName}</option>
                        ))}
                      </select>
                    }
                  />
                ))}
                {shown.length > leadLimit && (
                  <button
                    type="button"
                    onClick={() => setLeadLimit(n => n + 30)}
                    className="w-full py-3 rounded-2xl border border-border bg-surface text-[13px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    {isRtl ? `عرض المزيد (${shown.length - leadLimit})` : `Show more (${shown.length - leadLimit} left)`}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* FIX 2: inline property preview - no client-side router exists to deep-link into a
          property detail page from here, so this fetches/shows it directly instead. */}
      {leadPropertyPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setLeadPropertyPreview(null)}>
          <div className="bg-surface rounded-xl max-w-md w-full overflow-hidden text-xs" onClick={(e) => e.stopPropagation()}>
            <img src={leadPropertyPreview.images?.[0]} alt={leadPropertyPreview.title} className="w-full h-40 object-cover" />
            <div className="p-4 space-y-1">
              <div className="flex items-start justify-between">
                <h5 className="font-serif text-sm font-bold text-ink">{isRtl ? leadPropertyPreview.titleAr : leadPropertyPreview.title}</h5>
                <button type="button" onClick={() => setLeadPropertyPreview(null)} className="text-ink-muted hover:text-ink cursor-pointer"><X size={16} /></button>
              </div>
              <p className="text-ink-muted">{leadPropertyPreview.district}, {leadPropertyPreview.city}</p>
              <p className="font-bold text-gold">{leadPropertyPreview.price?.toLocaleString()} QAR</p>
              <p className="text-[10px] text-ink-muted">{isRtl ? "الحالة: " : "Status: "}{leadPropertyPreview.listingStatus} • ID: {leadPropertyPreview.listingId}</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "subscription" && (
        <SectionHeader icon={Receipt} accent="teal" title={isRtl ? "الاشتراك والفواتير" : "Billing"} description={isRtl ? "خطتك ورسوم الإعلانات وسجل المدفوعات." : "Your plan, ad charges and payment ledger."} />
      )}

      {/* SUBSCRIPTION SaaS BILLING TAB */}
      {activeTab === "subscription" && (
        <div className="space-y-6">
          {/* Ad billing summary (Part C) - self-service boost charges, separate from the SaaS plan fee below */}
          <div className="bg-surface p-5 rounded-xl border border-border space-y-3">
            <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
              <DollarSign size={14} className="text-gold" />
              <span>{isRtl ? "ملخص فوترة الإعلانات (الرفع الفوري)" : "Ad Billing Summary (Self-Service Boosts)"}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{currentBillingPeriod} {isRtl ? "الإجمالي" : "Total"}</p>
                <p className="text-lg font-serif font-bold text-ink">{currentPeriodAdTotal.toLocaleString()} QAR</p>
              </div>
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{isRtl ? "مسواة" : "Settled"}</p>
                <p className="text-lg font-serif font-bold text-emerald-700">{currentPeriodAdSettled.toLocaleString()} QAR</p>
              </div>
              <div className="p-3 bg-ink-inverse border border-border rounded-lg">
                <p className="text-[10px] text-ink-muted uppercase tracking-wider">{isRtl ? "غير مسواة" : "Unsettled"}</p>
                <p className="text-lg font-serif font-bold text-amber-700">{currentPeriodAdUnsettled.toLocaleString()} QAR</p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-chrome text-white rounded-xl border border-chrome-hover flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-gold font-bold uppercase tracking-wider block">{isRtl ? "الخطة النشطة الحالية" : "Current Active Plan Tier"}</span>
              <h4 className="font-serif text-lg font-bold">{currentPlan?.name || (isRtl ? "لا توجد خطة نشطة" : "No active plan")}</h4>
              <p className="text-xs text-gray-400">
                {isRtl ? "تاريخ انتهاء الاشتراك: " : "Subscription expiry: "}
                {agency.subscriptionExpiry ? new Date(agency.subscriptionExpiry).toLocaleDateString() : "—"}
                {agency.subscriptionStatus && ` • ${agency.subscriptionStatus.replace(/_/g, " ")}`}
              </p>
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-bold border border-white/20">
              {(currentPlan?.priceMonthly ?? 0).toLocaleString()} QAR <span className="text-xs font-normal">/ month</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface p-6 rounded-xl border border-border space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-bold uppercase rounded">
                  <Zap size={11} />
                  <span>{isRtl ? "الخطة الأعلى المتاحة" : "Recommended Enterprise Plan"}</span>
                </div>
                <h4 className="font-serif text-lg font-bold text-ink">{isRtl ? "الخطة الذهبية للمؤسسات والشركات الكبرى" : "Gold Enterprise Agency SaaS Plan"}</h4>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {isRtl ? "مناسبة للمكاتب والشركات الكبرى التي تمتلك أكثر من ١٠ وسطاء وتتطلع للوصول اللامحدود لإحصائيات السوق والذكاء الاصطناعي." : "Perfect for premium brokerage houses aiming to increase listing capacity up to 100 properties and expand active teams to 10 agents."}
                </p>

                <ul className="text-xs text-ink-muted space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>Up to 100 Properties (vs 15 currently)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>Up to 10 Agent Workspaces (vs 1 currently)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-emerald-600" />
                    <span>Gold Badge and Certified Priority Verification priority</span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t border-surface-2 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-ink-muted uppercase block">Monthly charge</span>
                  <span className="text-xl font-bold text-ink">{(enterprisePlan?.priceMonthly ?? 1800).toLocaleString()} QAR</span>
                </div>

                <button
                  onClick={() => handleUpgradeSubscription(enterprisePlan?.id || "plan-premium")}
                  disabled={paymentProcessing}
                  className="px-5 py-2 bg-chrome hover:bg-gold hover:text-gold-ink disabled:bg-gray-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider cursor-pointer"
                >
                  {paymentProcessing ? "Processing safe capture..." : (isRtl ? "الترقية والدفع الآمن" : "Secure Payment Upgrade")}
                </button>
              </div>
            </div>

            <div className="bg-ink-inverse p-6 rounded-xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-3">
              <Award size={40} className="text-gold" />
              <h4 className="font-serif text-sm font-bold text-ink">{isRtl ? "معايير سداد اشتراكات آمنة مائة بالمائة" : "Idempotent Transaction Gaurantee"}</h4>
              <p className="text-xs text-ink-muted max-w-xs leading-relaxed">
                {isRtl ? "كل عمليات التحصيل والفوترة في منصة نيرو العقارية مشفرة وتتم عبر رقم مراجع موحد يمنع تكرار الخصم نهائيًا." : "Every SaaS subscription change registers a unique transaction ID. System blocks double billing attempts from repeated clicks."}
              </p>
              {paymentSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 animate-bounce">
                  <CheckCircle size={14} className="text-emerald-600" />
                  <span>{isRtl ? "تمت ترقية الحساب بنجاح!" : "SaaS Plan successfully upgraded!"}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </WorkspaceShell>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-chrome text-white p-4 rounded-xl shadow-2xl border border-gold flex items-center gap-3 animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-gold animate-ping" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteCampaignId !== null}
        onCancel={() => setPendingDeleteCampaignId(null)}
        onConfirm={confirmDeleteCampaign}
        title={isRtl ? "هل تريد حذف هذه الحملة؟" : "Delete this campaign?"}
        tone="danger"
        loading={deletingCampaign}
        isRtl={isRtl}
      />

      {showTour && (
        <OnboardingTour steps={AGENCY_TOUR_STEPS} isRtl={isRtl} onFinish={handleFinishTour} />
      )}
    </div>
  );
}
