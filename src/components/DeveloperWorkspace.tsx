/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Organization, Project, Property, User, LocationItem, Lead, LeadStatus, ListingStatus, PropertyType, TransactionType, VerificationStatus } from "../types.js";
import {
  FolderKanban,
  Building2,
  Boxes,
  Plus,
  Compass,
  FileText,
  Clock,
  PieChart,
  Users,
  CheckCircle,
  TrendingUp,
  MapPin,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Edit2,
  Camera,
  Lock,
  Settings,
  DollarSign,
  Zap,
  ShieldCheck,
  MessageSquare,
  Mail,
  X
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";
import BoostRecommendations from "./BoostRecommendations.js";
import { compressImage } from "../lib/image.js";
import { getActingUserId } from "../lib/auth.js";
import StatCard from "./StatCard.js";
import DashboardChart from "./DashboardChart.js";
import { Badge } from "./ui/Badge.js";
import { EmptyState } from "./ui/EmptyState.js";
import { Button } from "./ui/Button.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { buildDailyCountSeries, isThisMonth, listingStatusTone, leadStatusTone } from "../lib/dashboardMetrics.js";
import OnboardingTour, { TourStep } from "./OnboardingTour.js";
import ListingPerformanceModal from "./ListingPerformanceModal.js";

interface DeveloperWorkspaceProps {
  developer: Organization;
  currentUser: User;
  onRefreshAll: () => void;
  isRtl: boolean;
}

export default function DeveloperWorkspace({ developer, currentUser, onRefreshAll, isRtl }: DeveloperWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [adCharges, setAdCharges] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "projects" | "inventory" | "leads" | "verification" | "profile">("dashboard");

  // Minimal "Add Unit" quick form (Dashboard/Inventory quick action) - units are tied to a
  // master project so city/district are derived from the selected project rather than asking
  // the developer to repeat the location picker they already filled in when creating it.
  const [isAddingUnit, setIsAddingUnit] = useState<boolean>(false);
  const [unitProjectId, setUnitProjectId] = useState<string>("");
  const [unitTitle, setUnitTitle] = useState<string>("");
  const [unitType, setUnitType] = useState<PropertyType>(PropertyType.APARTMENT);
  const [unitTransactionType, setUnitTransactionType] = useState<TransactionType>(TransactionType.OFF_PLAN);
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [unitArea, setUnitArea] = useState<string>("");
  const [unitBedrooms, setUnitBedrooms] = useState<string>("2");
  const [unitBathrooms, setUnitBathrooms] = useState<string>("2");
  const [unitDescription, setUnitDescription] = useState<string>("");
  const [creatingUnit, setCreatingUnit] = useState<boolean>(false);
  // Non-null while the "Add Unit" form is instead editing an existing unit in place -
  // submitting sends the unit's own id back so POST /api/properties updates it.
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [performanceListingId, setPerformanceListingId] = useState<string | null>(null);
  const [isDeletingUnit, setIsDeletingUnit] = useState<boolean>(false);
  // Leads tab (FIX 4): inline related-unit preview, same pattern as Agent/AgencyWorkspace.
  const [leadPropertyPreview, setLeadPropertyPreview] = useState<Property | null>(null);

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

  // First-time onboarding tour: shows once automatically for an account that hasn't seen it
  // yet, and can be replayed on demand from the Profile tab.
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (!currentUser.hasSeenOnboardingTour) {
      setShowTour(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const DEVELOPER_TOUR_STEPS: TourStep[] = [
    {
      selector: "developer-dashboard-tab",
      title: isRtl ? "لوحة القيادة" : "Dashboard",
      body: isRtl
        ? "نظرة عامة على أداء شركتك: العملاء المحتملون هذا الشهر، والوحدات المتاحة."
        : "Your developer enterprise overview: leads this month and available units at a glance."
    },
    {
      selector: "developer-projects-tab",
      title: isRtl ? "المشاريع الكبرى" : "Master Projects",
      body: isRtl
        ? "أضف مشاريعك العقارية الكبرى وأدرها من هنا."
        : "Add and manage your master real-estate projects here."
    },
    {
      selector: "developer-inventory-tab",
      title: isRtl ? "مخزون الوحدات" : "Units Inventory",
      body: isRtl
        ? "أضف الوحدات الفردية المرتبطة بكل مشروع وتابع حالتها."
        : "Add the individual units tied to each project and track their status."
    },
    {
      selector: "developer-verification-tab",
      title: isRtl ? "التوثيق" : "Verification",
      body: isRtl
        ? "ارفع مستندات شركتك (السجل التجاري، تصريح المشروع البلدي، إلخ) لتفعيل التوثيق."
        : "Upload your company documents (commercial registration, municipality project permit, etc.) for verification."
    },
    {
      selector: "developer-profile-tab",
      title: isRtl ? "الإعدادات" : "Profile",
      body: isRtl
        ? "حدّث بيانات شركتك من هنا في أي وقت."
        : "Update your developer enterprise's details here any time."
    }
  ];

  const handleFinishTour = async () => {
    setShowTour(false);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`/api/users/${currentUser.id}/onboarding-tour-seen`, {
        method: "POST",
        headers,
        body: JSON.stringify({ seen: true })
      });
      const stored = localStorage.getItem("nerou_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("nerou_user", JSON.stringify({ ...parsed, hasSeenOnboardingTour: true }));
      }
      onRefreshAll();
    } catch (err) {
      console.error("Failed to persist onboarding tour state", err);
    }
  };

  // Profile / organization settings state (Part B/C: developer admin's own org profile
  // fields - Organization has no fullName/bio like a User, so this edits org-level
  // name/logo/contact info via the new PATCH /api/organizations/:id endpoint).
  const [orgName, setOrgName] = useState<string>(developer.name);
  const [orgPhone, setOrgPhone] = useState<string>(developer.phone || "");
  const [orgWhatsapp, setOrgWhatsapp] = useState<string>(developer.whatsapp || "");
  const [orgWebsite, setOrgWebsite] = useState<string>(developer.website || "");
  const [orgLogoUrl, setOrgLogoUrl] = useState<string>(developer.logoUrl || "");
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [savingOrgProfile, setSavingOrgProfile] = useState<boolean>(false);

  // Change Password form state - this workspace only receives the org (not the acting user),
  // so the acting DEVELOPER_ADMIN's own id is read from the same "nerou_user" localStorage
  // record every workspace already writes back to on profile save.
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [passwordChanging, setPasswordChanging] = useState<boolean>(false);

  // New Project Form
  const [isAddingProject, setIsAddingProject] = useState<boolean>(false);
  const [projName, setProjName] = useState<string>("");
  const [projDesc, setProjDesc] = useState<string>("");
  
  // Dynamic Locations States
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");

  const [projStatus, setProjStatus] = useState<"PLANNING" | "UNDER_CONSTRUCTION" | "COMPLETED">("UNDER_CONSTRUCTION");
  const [projDate, setProjDate] = useState<string>("");
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  // FIX 5: PDF brochure upload - reuses the same generic /api/media/upload endpoint the
  // verification-documents PDF uploads already use (VerificationDocumentsPanel.tsx).
  const [projectBrochureUrl, setProjectBrochureUrl] = useState<string>("");
  const [uploadingBrochure, setUploadingBrochure] = useState<boolean>(false);

  useEffect(() => {
    fetchDeveloperContext();
    // Fetch dynamic locations
    fetch("/api/locations")
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        const lusail = data.find((l: any) => l.name === "Lusail" && l.type === "MUNICIPALITY");
        if (lusail) setSelectedMunicipality(lusail.id);
      })
      .catch(e => console.error("Error fetching locations in Developer:", e));
  }, [developer.id]);

  const fetchDeveloperContext = async () => {
    try {
      // Get all projects for this developer
      const projRes = await fetch("/api/projects");
      const projData = await projRes.json();
      const developerProjects = projData.filter((p: Project) => p.developerId === developer.id);
      setProjects(developerProjects);

      // Get units / properties belonging to these projects or this developer
      const propRes = await fetch(`/api/properties?orgId=${developer.id}&includeAllStatuses=true`);
      const propData = await propRes.json();
      setProperties(propData);

      // Get this developer org's leads (GET /api/leads self-scopes non-platform-admin org
      // admins to their own orgId - no query param needed) and ad billing ledger, for the
      // Dashboard tab's leads chart and ad billing + boost summary.
      const token = localStorage.getItem("token");
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [leadsRes, adChargesRes] = await Promise.all([
        fetch("/api/leads", { headers: authHeaders }),
        fetch("/api/ad-charges", { headers: authHeaders })
      ]);
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (adChargesRes.ok) setAdCharges(await adChargesRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName || !selectedArea) return;

    // Resolve names dynamically
    const muniItem = locations.find(l => l.id === selectedMunicipality);
    const areaItem = locations.find(l => l.id === selectedArea);
    const finalCity = muniItem ? muniItem.name : "Lusail";
    const finalDistrict = areaItem ? areaItem.name : "Fox Hills";

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({
          developerId: developer.id,
          name: projName,
          description: projDesc,
          city: finalCity,
          district: finalDistrict,
          status: projStatus,
          deliveryDate: projDate,
          images: projectImages,
          brochureUrl: projectBrochureUrl || undefined,
          actorId: developer.id,
          actorName: developer.name,
          actorRole: "DEVELOPER_ADMIN"
        })
      });

      if (res.ok) {
        setIsAddingProject(false);
        setProjName("");
        setProjDesc("");
        setSelectedArea("");
        setProjectImages([]);
        setProjectBrochureUrl("");
        fetchDeveloperContext();
        onRefreshAll();
        setToastMessage(isRtl ? "تمت إضافة المشروع الجديد بنجاح في المنصة وتحديث الدليل!" : "New master project catalogued and published successfully!");
        setTimeout(() => setToastMessage(""), 4000);
      } else {
        setToastMessage(isRtl ? "تعذر إضافة المشروع. يرجى المحاولة مرة أخرى." : "Failed to create the project. Please try again.");
        setTimeout(() => setToastMessage(""), 5000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage(isRtl ? "تعذر إضافة المشروع. يرجى المحاولة مرة أخرى." : "Failed to create the project. Please try again.");
      setTimeout(() => setToastMessage(""), 5000);
    }
  };

  // Minimal unit-creation form (Inventory tab quick action) - POSTs straight to the same
  // POST /api/properties endpoint agents use, with city/district derived from the chosen
  // master project so this stays a short form instead of duplicating the full 5-step agent
  // listing wizard.
  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = projects.find(p => p.id === unitProjectId);
    if (!project || !unitTitle || !unitPrice || !unitArea) return;

    setCreatingUnit(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const isEdit = !!editingUnitId;
      const existingUnit = isEdit ? properties.find(p => p.id === editingUnitId) : undefined;
      const res = await fetch("/api/properties", {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: editingUnitId || undefined,
          title: unitTitle,
          description: unitDescription || `${unitType} unit in ${project.name}`,
          propertyType: unitType,
          transactionType: unitTransactionType,
          price: Number(unitPrice),
          area: Number(unitArea),
          bedrooms: Number(unitBedrooms),
          bathrooms: Number(unitBathrooms),
          city: project.city,
          district: project.district,
          projectId: project.id,
          images: isEdit && existingUnit?.images?.length ? existingUnit.images : (project.images?.length ? [project.images[0]] : [])
        })
      });

      if (res.ok) {
        setIsAddingUnit(false);
        setEditingUnitId(null);
        setUnitProjectId("");
        setUnitTitle("");
        setUnitPrice("");
        setUnitArea("");
        setUnitBedrooms("2");
        setUnitBathrooms("2");
        setUnitDescription("");
        fetchDeveloperContext();
        onRefreshAll();
        setToastMessage(
          isEdit
            ? (isRtl ? "تم تحديث بيانات الوحدة بنجاح!" : "Unit updated successfully!")
            : (isRtl ? "تمت إضافة الوحدة الجديدة بنجاح!" : "New unit added successfully!")
        );
        setTimeout(() => setToastMessage(""), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر حفظ الوحدة." : "Failed to save the unit."));
        setTimeout(() => setToastMessage(""), 5000);
      }
    } catch (err) {
      console.error(err);
      setToastMessage(isRtl ? "تعذر حفظ الوحدة." : "Failed to save the unit.");
      setTimeout(() => setToastMessage(""), 5000);
    } finally {
      setCreatingUnit(false);
    }
  };

  const startEditUnit = (unit: Property) => {
    setEditingUnitId(unit.id);
    setUnitProjectId(unit.projectId || "");
    setUnitTitle(unit.title || "");
    setUnitType(unit.propertyType);
    setUnitTransactionType(unit.transactionType);
    setUnitPrice(unit.price !== undefined ? String(unit.price) : "");
    setUnitArea(unit.area !== undefined ? String(unit.area) : "");
    setUnitBedrooms(unit.bedrooms !== undefined ? String(unit.bedrooms) : "2");
    setUnitBathrooms(unit.bathrooms !== undefined ? String(unit.bathrooms) : "2");
    setUnitDescription(unit.description || "");
    setIsAddingUnit(true);
  };

  const handleDeleteUnit = async (unitId: string) => {
    setIsDeletingUnit(true);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/properties/${unitId}`, { method: "DELETE", headers });
      if (res.ok) {
        setProperties(prev => prev.filter(p => p.id !== unitId));
        onRefreshAll();
        setToastMessage(isRtl ? "تم حذف الوحدة." : "Unit deleted.");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر حذف الوحدة." : "Failed to delete the unit."));
      }
    } catch (e) {
      console.error("Failed to delete unit", e);
      setToastMessage(isRtl ? "تعذر حذف الوحدة." : "Failed to delete the unit.");
    } finally {
      setIsDeletingUnit(false);
      setDeletingUnitId(null);
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  // Same POST /api/leads/status action AgentWorkspace/AgencyWorkspace already use - no new
  // backend logic needed, GET /api/leads already self-scopes this org's leads correctly.
  const handleUpdateLeadStatus = async (leadId: string, status: LeadStatus) => {
    try {
      const res = await fetch("/api/leads/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          leadId,
          status,
          actorId: currentUser.id,
          actorName: currentUser.fullName,
          actorRole: currentUser.role
        })
      });
      if (res.ok) {
        setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status } : l)));
        onRefreshAll();
      }
    } catch (e) {
      console.error("Failed to update lead status", e);
    }
  };

  const handleProjectMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    const formData = new FormData();
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const compressed = await compressImage(file);
          formData.append("files", compressed);
        } catch (err) {
          formData.append("files", file);
        }
      }
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/media/upload", { method: "POST", headers, body: formData });
      if (res.ok) {
        const data = await res.json();
        const uploadedUrls = data.fileUrls || data.urls || [];
        setProjectImages(prev => [...prev, ...uploadedUrls]);
      } else {
        const data = await res.json();
        setToastMessage(data.error || (isRtl ? "فشل رفع الصور." : "Failed to upload images."));
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error("Project media upload error:", err);
      setToastMessage(isRtl ? "فشل رفع الصور." : "Failed to upload images.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const removeProjectImage = (index: number) => {
    setProjectImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleBrochureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBrochure(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/media/upload", { method: "POST", headers, body: formData });
      if (res.ok) {
        const data = await res.json();
        const uploadedUrl = (data.fileUrls || data.urls || [])[0];
        if (uploadedUrl) setProjectBrochureUrl(uploadedUrl);
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل رفع ملف البروشور." : "Failed to upload the brochure."));
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error("Brochure upload error:", err);
      setToastMessage(isRtl ? "فشل رفع ملف البروشور." : "Failed to upload the brochure.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setUploadingBrochure(false);
      e.target.value = "";
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

      // ?type=avatar skips the property-photo watermark - correct for a company logo too.
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

      const res = await fetch(`/api/organizations/${developer.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: orgName, phone: orgPhone, whatsapp: orgWhatsapp, website: orgWebsite, logoUrl: orgLogoUrl })
      });

      if (res.ok) {
        onRefreshAll();
        setToastMessage(isRtl ? "تم حفظ ملف الشركة بنجاح!" : "Company profile saved successfully!");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل حفظ ملف الشركة." : "Failed to save company profile."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Save org profile error:", err);
      setToastMessage(isRtl ? "فشل حفظ ملف الشركة." : "Failed to save company profile.");
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

  // Stats calculation
  const totalProjects = projects.length;
  const totalUnits = properties.length;
  const soldUnits = properties.filter(u => u.listingStatus === ListingStatus.SOLD).length;
  const availableUnits = properties.filter(u => u.listingStatus === ListingStatus.PUBLISHED || u.listingStatus === ListingStatus.PENDING_REVIEW).length;

  // Dashboard tab (FIX 4) KPI computations.
  const activeProjectsCount = projects.filter(p => p.status !== "COMPLETED").length;
  const salesProgressPercent = totalUnits > 0 ? Math.round((soldUnits / totalUnits) * 100) : 0;
  const leadsThisMonth = leads.filter(l => isThisMonth(l.createdDate));
  const leadsPerDaySeries = buildDailyCountSeries(leads.map(l => l.createdDate), 30, isRtl);

  const nowDate = new Date();
  const currentBillingPeriod = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const currentPeriodAdCharges = adCharges.filter((c: any) => c.billingPeriod === currentBillingPeriod);
  const currentPeriodAdTotal = currentPeriodAdCharges.reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdSettled = currentPeriodAdCharges.filter((c: any) => c.settled).reduce((acc: number, c: any) => acc + c.amount, 0);
  const currentPeriodAdUnsettled = currentPeriodAdTotal - currentPeriodAdSettled;

  // Per-project unit breakdown, for the Dashboard tab's progress-bar project cards.
  const projectProgress = projects.map(proj => {
    const units = properties.filter(u => u.projectId === proj.id);
    const sold = units.filter(u => u.listingStatus === ListingStatus.SOLD).length;
    const progress = units.length > 0 ? Math.round((sold / units.length) * 100) : 0;
    return { project: proj, unitCount: units.length, soldCount: sold, progress };
  });

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Developer Header Profile */}
      <div className="bg-surface p-6 rounded-xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-border overflow-hidden bg-gray-50">
            <img src={developer.logoUrl} alt={developer.name} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-serif font-medium text-ink">
              {isRtl ? developer.nameAr : developer.name}
            </h3>
            <p className="text-xs text-ink-muted">
              {isRtl ? `المطور العقاري المعتمد • مساحة تتبع المشروعات الإنشائية` : `Licensed Master Developer • Asset & Project Management Workspace`}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-surface-2 p-0.5 rounded-lg text-xs font-medium overflow-x-auto scrollbar-none max-w-full">
          <button
            data-tour="developer-dashboard-tab"
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "dashboard" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "لوحة القيادة" : "Dashboard"}
          </button>
          <button
            data-tour="developer-projects-tab"
            onClick={() => setActiveTab("projects")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "projects" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "المشاريع الكبرى" : "Master Projects"}
          </button>
          <button
            data-tour="developer-inventory-tab"
            onClick={() => setActiveTab("inventory")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "inventory" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "مخزون الوحدات" : "Units Inventory"}
          </button>
          <button
            data-tour="developer-leads-tab"
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "leads" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "العملاء المحتملون" : "Leads"}
          </button>
          <button
            data-tour="developer-verification-tab"
            onClick={() => setActiveTab("verification")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "verification" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "التوثيق" : "Verification"}
          </button>
          <button
            data-tour="developer-profile-tab"
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "profile" ? "bg-surface text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {isRtl ? "الإعدادات" : "Profile"}
          </button>
        </div>
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {developer.verificationStatus !== VerificationStatus.APPROVED && (
            <button
              type="button"
              onClick={() => setActiveTab("verification")}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-colors ${
                developer.verificationStatus === VerificationStatus.REJECTED || developer.verificationStatus === VerificationStatus.SUSPENDED
                  ? "bg-danger-soft border-danger/30 hover:brightness-95"
                  : "bg-warning-soft border-warning/30 hover:brightness-95"
              }`}
            >
              <ShieldCheck size={18} className={developer.verificationStatus === VerificationStatus.REJECTED || developer.verificationStatus === VerificationStatus.SUSPENDED ? "text-danger shrink-0" : "text-warning shrink-0"} />
              <span className="text-xs font-semibold text-ink">
                {developer.verificationStatus === VerificationStatus.PENDING &&
                  (isRtl ? "توثيق شركتكم قيد المراجعة. يرجى استكمال المستندات المطلوبة." : "Your company verification is pending. Complete your required documents.")}
                {developer.verificationStatus === VerificationStatus.REJECTED &&
                  (isRtl ? "تم رفض توثيق الشركة. اضغط لمراجعة السبب وإعادة الرفع." : "Company verification was rejected. Tap to review and resubmit.")}
                {developer.verificationStatus === VerificationStatus.SUSPENDED &&
                  (isRtl ? "تم تعليق حساب الشركة. تواصل مع الإدارة أو راجع مستنداتك." : "Company account is suspended. Review your documents or contact support.")}
              </span>
            </button>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FolderKanban} label={isRtl ? "المشاريع النشطة" : "Active Projects"} value={activeProjectsCount} subtitle={isRtl ? `${totalProjects} إجمالي` : `${totalProjects} total`} />
            <StatCard icon={Boxes} label={isRtl ? "إجمالي الوحدات" : "Total Units"} value={totalUnits} subtitle={isRtl ? `${availableUnits} متاحة • ${soldUnits} مباعة` : `${availableUnits} available • ${soldUnits} sold`} />
            <StatCard icon={Users} label={isRtl ? "عملاء هذا الشهر" : "Leads This Month"} value={leadsThisMonth.length} subtitle={isRtl ? `${leads.length} إجمالي` : `${leads.length} all-time`} />
            <StatCard icon={TrendingUp} label={isRtl ? "نسبة إنجاز المبيعات" : "Sales Progress"} value={`${salesProgressPercent}%`} subtitle={isRtl ? "من إجمالي الوحدات" : "of total units sold"} />
          </div>

          {/* Quick actions */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="font-serif text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
              <Zap size={14} className="text-gold" />
              <span>{isRtl ? "إجراءات سريعة" : "Quick Actions"}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => { setActiveTab("projects"); setIsAddingProject(true); }}
                className="flex items-center gap-2 p-3 bg-canvas hover:bg-surface-2 border border-border rounded-lg cursor-pointer transition-colors"
              >
                <Plus size={16} className="text-gold shrink-0" />
                <span className="text-xs font-bold text-ink">{isRtl ? "إضافة مشروع" : "Add Project"}</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("inventory"); setIsAddingUnit(true); }}
                className="flex items-center gap-2 p-3 bg-canvas hover:bg-surface-2 border border-border rounded-lg cursor-pointer transition-colors"
              >
                <Boxes size={16} className="text-gold shrink-0" />
                <span className="text-xs font-bold text-ink">{isRtl ? "إضافة وحدة" : "Add Unit"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("verification")}
                className="flex items-center gap-2 p-3 bg-canvas hover:bg-surface-2 border border-border rounded-lg cursor-pointer transition-colors"
              >
                <ShieldCheck size={16} className="text-gold shrink-0" />
                <span className="text-xs font-bold text-ink">{isRtl ? "التوثيق" : "View Verification"}</span>
              </button>
            </div>
          </div>

          {/* Leads trend chart */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="font-serif text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-gold" />
              <span>{isRtl ? "العملاء المحتملون يومياً (آخر 30 يوماً)" : "Leads Per Day (Last 30 Days)"}</span>
            </h4>
            <DashboardChart data={leadsPerDaySeries} valueLabel={isRtl ? "عملاء محتملون" : "Leads"} isRtl={isRtl} />
          </div>

          {/* Per-project cards with a sales progress bar */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            <div className="p-4 bg-ink-inverse border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "تقدم المبيعات حسب المشروع" : "Sales Progress by Project"}</h4>
            </div>
            {projectProgress.length === 0 ? (
              <p className="p-8 text-center text-xs text-ink-muted">{isRtl ? "لا توجد مشاريع بعد." : "No projects yet."}</p>
            ) : (
              <div className="divide-y divide-surface-2">
                {projectProgress.map(row => (
                  <div key={row.project.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs font-bold text-ink">{isRtl ? row.project.nameAr || row.project.name : row.project.name}</p>
                      <span className="text-[10px] text-ink-muted">{row.soldCount} / {row.unitCount} {isRtl ? "مباعة" : "sold"}</span>
                    </div>
                    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-gold" style={{ width: `${row.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ad billing + boost summary */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h4 className="font-serif text-sm font-semibold text-ink mb-3 flex items-center gap-1.5">
              <DollarSign size={14} className="text-gold" />
              <span>{isRtl ? "ملخص فوترة الإعلانات" : "Ad Billing Summary"}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-4">
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
            <BoostRecommendations properties={properties} orgId={developer.id} isRtl={isRtl} />
          </div>
        </div>
      )}

      {/* LEADS TAB (FIX 4) - reuses GET /api/leads, which already self-scopes to this
          developer org's leads server-side; follows the same status-badge / contact-info
          visual pattern as AgentWorkspace's and AgencyWorkspace's own leads tabs. */}
      {activeTab === "leads" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden text-xs">
          <div className="p-4 bg-ink-inverse border-b border-border flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
              <Users size={14} className="text-gold" />
              <span>{isRtl ? "العملاء المحتملون لمشاريعكم" : "Project & Unit Inquiries"}</span>
            </h4>
            <span className="px-2.5 py-1 bg-chrome text-white text-[10px] font-bold rounded-full">
              {leads.length} {isRtl ? "عملاء كلي" : "Total Leads"}
            </span>
          </div>
          <div className="divide-y divide-surface-2">
            {leads.length === 0 ? (
              <p className="p-8 text-center text-ink-muted italic">
                {isRtl ? "لا توجد أي طلبات تواصل مسجلة بعد." : "No leads registered for your projects yet."}
              </p>
            ) : (
              leads.map(lead => {
                const waPhone = (lead.visitorWhatsapp || lead.visitorPhone || "").replace(/[^0-9]/g, "");
                return (
                  <div key={lead.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink text-sm">{lead.visitorName}</span>
                        <Badge tone={leadStatusTone(lead.status)}>{lead.status.replace(/_/g, " ")}</Badge>
                      </div>
                      <div className="text-ink-muted space-y-0.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold"
                          >
                            <MessageSquare size={12} /> {lead.visitorPhone}
                          </a>
                          {lead.visitorEmail && (
                            <a href={`mailto:${lead.visitorEmail}`} className="flex items-center gap-1 text-ink hover:text-gold font-semibold">
                              <Mail size={12} /> {lead.visitorEmail}
                            </a>
                          )}
                        </div>
                        <p className="italic">"{lead.message}"</p>
                        {lead.propertyId && (
                          <button
                            type="button"
                            onClick={() => setLeadPropertyPreview(properties.find(p => p.id === lead.propertyId) || null)}
                            className="text-[10px] text-gold underline cursor-pointer"
                          >
                            {isRtl ? "عرض الوحدة المرتبطة" : "View related unit"}
                          </button>
                        )}
                        <span className="text-[9px] text-ink-faint block">{new Date(lead.createdDate || new Date()).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <select
                        value={lead.status}
                        onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as LeadStatus)}
                        className="px-2 py-1.5 bg-surface border border-border rounded text-[10px] font-semibold text-ink"
                      >
                        {Object.values(LeadStatus).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Inline related-unit preview modal for the Leads tab above. */}
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
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION TAB */}
      {activeTab === "verification" && <VerificationDocumentsPanel isRtl={isRtl} />}

      {/* PROFILE / SETTINGS TAB */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="bg-surface p-6 rounded-xl border border-border flex items-center justify-between gap-4 text-xs">
            <div>
              <h4 className="font-serif text-sm font-semibold text-ink">{isRtl ? "الجولة التعريفية" : "Guided Tour"}</h4>
              <p className="text-ink-muted mt-0.5">{isRtl ? "أعد مشاهدة جولة التعريف بلوحة تحكم شركتك." : "Replay the guided tour of your developer dashboard."}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTour(true)}
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
                  htmlFor="developer-logo-upload"
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-chrome hover:bg-gold text-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white"
                  title={isRtl ? "تغيير الشعار" : "Change logo"}
                >
                  {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                </label>
                <input
                  id="developer-logo-upload"
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
                  <span>{isRtl ? "ملف الشركة المطورة" : "Developer Company Profile"}</span>
                </h4>
                <p className="text-[10px] text-ink-muted mt-0.5">{isRtl ? "قم بتحديث شعار الشركة وبيانات التواصل الرسمية." : "Update your company logo and official contact details."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "اسم الشركة" : "Company Name"}</label>
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
                className="px-6 py-2 bg-chrome hover:bg-gold text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {savingOrgProfile ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ ملف الشركة" : "Save Company Profile")}
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
                className="px-6 py-2 bg-chrome hover:bg-gold text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {passwordChanging ? (isRtl ? "جارٍ التحديث..." : "Updating...") : (isRtl ? "تغيير كلمة المرور" : "Change Password")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
              <Building2 size={14} className="text-gold" />
              <span>{isRtl ? "سجل المشاريع الإنشائية والتطويرية" : "Developer Master projects"}</span>
            </h4>
            <button
              onClick={() => setIsAddingProject(!isAddingProject)}
              className="px-3 py-1.5 bg-chrome hover:bg-gold text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "إضافة مشروع جديد" : "Create Project"}</span>
            </button>
          </div>

          {isAddingProject && (
            <form onSubmit={handleCreateProject} className="bg-surface p-5 rounded-xl border border-gold/30 space-y-4 max-w-xl text-xs animate-in slide-in-from-top duration-200">
              <h5 className="font-serif text-sm font-bold text-ink border-b border-surface-2 pb-2">
                {isRtl ? "إدخال تفاصيل المشروع الجديد" : "Provide New Project Guidelines"}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "اسم المشروع" : "Project Name"}</label>
                  <input
                    type="text"
                    required
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="e.g. Marina Heights Tower C"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "تاريخ التسليم المتوقع" : "Expected Handover"}</label>
                  <input
                    type="date"
                    value={projDate}
                    onChange={(e) => setProjDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "البلدية" : "Municipality"}</label>
                  <select
                    value={selectedMunicipality}
                    onChange={(e) => {
                      setSelectedMunicipality(e.target.value);
                      setSelectedArea("");
                    }}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg"
                  >
                    <option value="">Select Municipality</option>
                    {locations.filter(l => l.type === "MUNICIPALITY" && l.isActive).map(muni => (
                      <option key={muni.id} value={muni.id}>{muni.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المنطقة / الحي" : "Area / District"}</label>
                  <select
                    value={selectedArea}
                    disabled={!selectedMunicipality}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg disabled:opacity-50"
                  >
                    <option value="">Select Area / District</option>
                    {locations.filter(l => l.parentId === selectedMunicipality && l.isActive).map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "حالة الإنشاءات" : "Construction Status"}</label>
                  <select
                    value={projStatus}
                    onChange={(e) => setProjStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="COMPLETED">Completed / Ready</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "شرح ومواصفات المشروع" : "Project Summary & Pitch"}</label>
                <textarea
                  rows={3}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Describe location conveniences, beach layout access..."
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                ></textarea>
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "صور المشروع" : "Project Photos"}</label>
                <div className="border-2 border-dashed border-border hover:border-gold rounded-xl p-6 text-center cursor-pointer bg-surface transition-colors relative">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleProjectMediaUpload}
                    disabled={uploadingImages}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-2">
                    {uploadingImages ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-gold" size={28} />
                        <p className="text-sm font-medium text-ink-muted">{isRtl ? "جارٍ رفع الصور..." : "Uploading images..."}</p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="mx-auto text-gray-400" size={32} />
                        <p className="text-sm font-medium text-ink">{isRtl ? "اضغط هنا لرفع عدة صور" : "Click here to upload multiple images"}</p>
                        <p className="text-xs text-ink-muted">{isRtl ? "يدعم JPG، PNG وغيرها" : "Supports JPG, PNG etc."}</p>
                      </>
                    )}
                  </div>
                </div>
                {projectImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
                    {projectImages.map((imgUrl, index) => (
                      <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-ink-inverse shadow-2xs">
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeProjectImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "ملف البروشور (PDF)" : "PDF Brochure"}</label>
                <div className="border-2 border-dashed border-border hover:border-gold rounded-xl p-4 text-center cursor-pointer bg-surface transition-colors relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleBrochureUpload}
                    disabled={uploadingBrochure}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2">
                    {uploadingBrochure ? (
                      <>
                        <Loader2 className="animate-spin text-gold" size={16} />
                        <p className="text-xs font-medium text-ink-muted">{isRtl ? "جارٍ رفع الملف..." : "Uploading brochure..."}</p>
                      </>
                    ) : projectBrochureUrl ? (
                      <>
                        <FileText size={16} className="text-emerald-600" />
                        <p className="text-xs font-medium text-ink">{isRtl ? "تم رفع ملف البروشور - اضغط للاستبدال" : "Brochure uploaded - click to replace"}</p>
                      </>
                    ) : (
                      <>
                        <FileText size={16} className="text-gray-400" />
                        <p className="text-xs font-medium text-ink">{isRtl ? "اضغط لرفع ملف PDF (اختياري)" : "Click to upload a PDF (optional)"}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingProject(false)}
                  className="px-4 py-2 bg-surface hover:bg-surface-2 border border-border rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-chrome hover:bg-gold text-white font-semibold rounded-lg"
                >
                  Create Master Catalog
                </button>
              </div>
            </form>
          )}

          {/* Project Cards */}
          {projects.length === 0 ? (
            <EmptyState
              icon={<Building2 size={20} />}
              title={isRtl ? "لا توجد مشاريع بعد" : "No projects yet"}
              description={isRtl ? "أنشئ أول مشروع تطويري ليظهر هنا وتتمكن من إضافة الوحدات إليه." : "Create your first development project to see it here and start adding units to it."}
              action={
                <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setIsAddingProject(true)}>
                  {isRtl ? "إضافة مشروع جديد" : "Create Project"}
                </Button>
              }
            />
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map(proj => (
              <div key={proj.id} className="bg-surface rounded-xl border border-border overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="h-44 bg-gray-100 overflow-hidden relative">
                    <img src={proj.images[0]} alt={proj.name} className="w-full h-full object-cover" />
                    <span className="absolute top-3 left-3 bg-chrome/80 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                      {proj.status}
                    </span>
                  </div>

                  <div className="p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-1 text-ink-muted">
                      <MapPin size={13} />
                      <span>{proj.district}, {proj.city}</span>
                    </div>
                    <h5 className="font-serif text-base font-bold text-ink">{isRtl ? proj.nameAr : proj.name}</h5>
                    <p className="text-ink-muted leading-relaxed line-clamp-2">{proj.description}</p>
                  </div>
                </div>

                <div className="p-4 border-t border-surface-2 flex justify-between items-center text-[11px] text-ink-muted">
                  <span>Handover Target: <strong className="text-ink">{proj.deliveryDate || "TBD"}</strong></span>
                  {proj.brochureUrl ? (
                    <a href={proj.brochureUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-gold underline cursor-pointer">
                      {isRtl ? "عرض ملف البروشور" : "View PDF Brochure"}
                    </a>
                  ) : (
                    <span className="italic text-ink-faint">{isRtl ? "لم يتم رفع بروشور بعد" : "No brochure uploaded yet"}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* INVENTORY TAB */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Inventory Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-border text-center text-xs">
              <span className="text-ink-muted block mb-1">{isRtl ? "الوحدات الإجمالية" : "Total Catalogued Units"}</span>
              <strong className="text-xl text-ink">{totalUnits}</strong>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border text-center text-xs">
              <span className="text-ink-muted block mb-1">{isRtl ? "المباع" : "Sold out (Closed)"}</span>
              <strong className="text-xl text-green-600">{soldUnits}</strong>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-border text-center text-xs">
              <span className="text-ink-muted block mb-1">{isRtl ? "المتبقي المتاح" : "Available inventory"}</span>
              <strong className="text-xl text-blue-600">{availableUnits}</strong>
            </div>
          </div>

          {/* Smart Boost Recommendations panel - AI-assisted "Recommended to Boost" analysis. */}
          <BoostRecommendations properties={properties} orgId={developer.id} isRtl={isRtl} />

          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
              <Boxes size={14} className="text-gold" />
              <span>{isRtl ? "قائمة الوحدات التفصيلية" : "Specific Units Specifications"}</span>
            </h4>
            <button
              onClick={() => {
                if (!isAddingUnit && editingUnitId) {
                  setEditingUnitId(null);
                  setUnitProjectId("");
                  setUnitTitle("");
                  setUnitPrice("");
                  setUnitArea("");
                  setUnitBedrooms("2");
                  setUnitBathrooms("2");
                  setUnitDescription("");
                }
                setEditingUnitId(null);
                setIsAddingUnit(!isAddingUnit);
              }}
              className="px-3 py-1.5 bg-chrome hover:bg-gold text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "إضافة وحدة" : "Add Unit"}</span>
            </button>
          </div>

          {isAddingUnit && (
            <form onSubmit={handleCreateUnit} className="bg-surface p-5 rounded-xl border border-gold/30 space-y-4 max-w-xl text-xs">
              <h5 className="font-serif text-sm font-bold text-ink border-b border-surface-2 pb-2">
                {editingUnitId
                  ? (isRtl ? "تعديل بيانات الوحدة" : "Edit Unit Details")
                  : (isRtl ? "تفاصيل الوحدة الجديدة" : "New Unit Details")}
              </h5>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المشروع" : "Project"}</label>
                <select
                  required
                  value={unitProjectId}
                  onChange={(e) => setUnitProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                >
                  <option value="">{isRtl ? "اختر مشروعاً" : "Select a project"}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="text-[10px] text-warning mt-1">{isRtl ? "أنشئ مشروعاً أولاً قبل إضافة وحدات." : "Create a project first before adding units."}</p>
                )}
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "اسم الوحدة" : "Unit Title"}</label>
                <input
                  type="text"
                  required
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="e.g. Marina Heights Tower C - Unit 1204"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "النوع" : "Type"}</label>
                  <select value={unitType} onChange={(e) => setUnitType(e.target.value as PropertyType)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg">
                    {Object.values(PropertyType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المعاملة" : "Transaction"}</label>
                  <select value={unitTransactionType} onChange={(e) => setUnitTransactionType(e.target.value as TransactionType)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg">
                    {Object.values(TransactionType).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "السعر (ر.ق)" : "Price (QAR)"}</label>
                  <input type="number" required min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                </div>
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "المساحة (م²)" : "Area (SQM)"}</label>
                  <input type="number" required min="0" value={unitArea} onChange={(e) => setUnitArea(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                </div>
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "غرف النوم" : "Bedrooms"}</label>
                  <input type="number" min="0" value={unitBedrooms} onChange={(e) => setUnitBedrooms(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                </div>
                <div>
                  <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الحمامات" : "Bathrooms"}</label>
                  <input type="number" min="0" value={unitBathrooms} onChange={(e) => setUnitBathrooms(e.target.value)} className="w-full px-2 py-2 bg-surface border border-border rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block font-medium text-ink-muted mb-1">{isRtl ? "الوصف (اختياري)" : "Description (optional)"}</label>
                <textarea rows={2} value={unitDescription} onChange={(e) => setUnitDescription(e.target.value)} className="w-full px-3 py-2 bg-surface border border-border rounded-lg" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => { setIsAddingUnit(false); setEditingUnitId(null); }} className="px-4 py-2 bg-surface hover:bg-surface-2 border border-border rounded-lg font-semibold">
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" disabled={creatingUnit || projects.length === 0} className="px-6 py-2 bg-chrome hover:bg-gold text-white font-semibold rounded-lg disabled:opacity-50">
                  {creatingUnit
                    ? (isRtl ? "جارٍ الحفظ..." : "Saving...")
                    : editingUnitId
                    ? (isRtl ? "حفظ التغييرات" : "Save Changes")
                    : (isRtl ? "إضافة الوحدة" : "Add Unit")}
                </button>
              </div>
            </form>
          )}

          {/* Catalog Table */}
          <div className="bg-surface rounded-xl border border-border overflow-hidden text-xs">
            <div className="p-4 bg-ink-inverse border-b border-border">
              <h4 className="font-serif text-sm font-semibold text-ink flex items-center gap-1.5">
                <Boxes size={14} className="text-gold" />
                <span>{isRtl ? "قائمة الوحدات التفصيلية" : "Specific Units Specifications"}</span>
              </h4>
            </div>
            <div className="divide-y divide-surface-2">
              {properties.length === 0 ? (
                <p className="p-8 text-center text-ink-muted">{isRtl ? "لا توجد وحدات مسجلة تحت هذا المشروع." : "No units listed under this developer workspace yet."}</p>
              ) : (
                properties.map(unit => (
                  <div key={unit.id} className="p-4 flex justify-between items-center gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-ink">{isRtl ? unit.titleAr : unit.title}</p>
                      <p className="text-[10px] text-ink-muted">District: {unit.district} | {unit.bedrooms} Bed | {unit.area} SQM</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <BoostButton property={unit} isRtl={isRtl} />
                      <Badge tone={listingStatusTone(unit.listingStatus)}>{unit.listingStatus.replace(/_/g, " ")}</Badge>
                      <button
                        type="button"
                        onClick={() => setPerformanceListingId(unit.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded cursor-pointer"
                      >
                        <TrendingUp size={11} />
                        <span>{isRtl ? "الأداء" : "Performance"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditUnit(unit)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded cursor-pointer"
                      >
                        <Edit2 size={11} />
                        <span>{isRtl ? "تعديل" : "Edit"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingUnitId(unit.id)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 size={11} />
                        <span>{isRtl ? "حذف" : "Delete"}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <ConfirmDialog
            open={!!deletingUnitId}
            onCancel={() => setDeletingUnitId(null)}
            onConfirm={() => deletingUnitId && handleDeleteUnit(deletingUnitId)}
            title={isRtl ? "هل تريد حذف هذه الوحدة؟ لا يمكن التراجع عن هذا الإجراء." : "Delete this unit? This cannot be undone."}
            tone="danger"
            loading={isDeletingUnit}
            isRtl={isRtl}
          />

          <ListingPerformanceModal
            open={!!performanceListingId}
            onClose={() => setPerformanceListingId(null)}
            property={properties.find(p => p.id === performanceListingId) || null}
            leads={leads}
            isRtl={isRtl}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-chrome text-white p-4 rounded-xl shadow-2xl border border-gold flex items-center gap-3 animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-gold animate-ping" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}

      {showTour && (
        <OnboardingTour steps={DEVELOPER_TOUR_STEPS} isRtl={isRtl} onFinish={handleFinishTour} />
      )}
    </div>
  );
}
