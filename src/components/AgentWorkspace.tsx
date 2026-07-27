/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Property,
  Lead,
  LeadStatus,
  User,
  PropertyType,
  TransactionType,
  VerificationStatus,
  ListingStatus,
  LocationItem,
  AgentType,
  getEffectiveAgentType,
  SubscriptionPlan,
  Organization,
  DocumentType,
  DocumentStatus,
  DOHA_METRO_STATIONS,
  getAvailabilityStaleDays,
  AVAILABILITY_CONFIRM_DUE_DAYS,
  AVAILABILITY_UNCONFIRMED_DAYS,
  LeadNote,
  getVerifiedBadgeLabel
} from "../types.js";
import {
  TrendingUp,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  Plus,
  Edit2,
  Trash2,
  Settings,
  Mail,
  UserCheck,
  Building,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  CreditCard,
  Camera,
  Lock,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  ChevronDown,
  X,
  Eye,
  Star
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";

interface AgentWorkspaceProps {
  agent: User;
  onRefreshAll: () => void;
  isRtl: boolean;
}

// A listing may carry at most this many photos - enforced client-side here and
// server-side in POST /api/properties.
const MAX_LISTING_IMAGES = 14;

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        const MAX_WIDTH = 1400;
        const MAX_HEIGHT = 1400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

export default function AgentWorkspace({ agent, onRefreshAll, isRtl }: AgentWorkspaceProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  // FIX 10: Reviews & Ratings tab
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [myReviewSummary, setMyReviewSummary] = useState<{ average: number; count: number; distribution: Record<number, number> } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const fetchMyReviews = async () => {
    try {
      const [reviewsRes, summaryRes] = await Promise.all([
        fetch(`/api/reviews?targetType=AGENT&targetId=${agent.id}`),
        fetch(`/api/reviews/summary?targetType=AGENT&targetId=${agent.id}`)
      ]);
      if (reviewsRes.ok) setMyReviews(await reviewsRes.json());
      if (summaryRes.ok) setMyReviewSummary(await summaryRes.json());
    } catch (e) {
      console.error("Failed to load reviews", e);
    }
  };

  useEffect(() => {
    fetchMyReviews();
  }, [agent.id]);

  const handleReplyToReview = async (reviewId: string) => {
    const text = replyDrafts[reviewId];
    if (!text || !text.trim()) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ text: text.trim() })
      });
      if (res.ok) {
        setReplyDrafts(prev => ({ ...prev, [reviewId]: "" }));
        fetchMyReviews();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX 2: lead detail modal + notes + archive toggle
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [leadNoteDraft, setLeadNoteDraft] = useState<string>("");
  const [showArchivedLeads, setShowArchivedLeads] = useState<boolean>(false);
  const [leadPropertyPreview, setLeadPropertyPreview] = useState<Property | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "leads" | "properties" | "verification" | "subscription" | "profile" | "reviews">("dashboard");

  // FIX1: derive the agent's effective type defensively - existing accounts created before
  // AgentType existed have agentType === undefined, so fall back to orgId-based inference
  // rather than treating undefined as an error.
  const effectiveAgentType = getEffectiveAgentType(agent);

  // Subscription tab data (INDEPENDENT_AGENT only) & agency subscription banner (AGENCY_AGENT only)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [agencyOrg, setAgencyOrg] = useState<Organization | null>(null);

  // Qatar regulation gate (INDEPENDENT_AGENT only): a listing cannot go live until this
  // agent's Agency Authorization Letter (the licensed agency/brokerage they operate under)
  // is APPROVED. "NOT_SUBMITTED" means no such document exists yet at all.
  const [authLetterStatus, setAuthLetterStatus] = useState<DocumentStatus | "NOT_SUBMITTED" | null>(null);

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

  // Profile Edit States
  const [fullName, setFullName] = useState<string>(agent.fullName);
  const [phone, setPhone] = useState<string>(agent.phone);
  const [whatsapp, setWhatsapp] = useState<string>(agent.whatsapp || "");
  const [bio, setBio] = useState<string>(agent.bio || "");
  const [languages, setLanguages] = useState<string>(agent.languages?.join(", ") || "");
  const [specialties, setSpecialties] = useState<string>(agent.specialties?.join(", ") || "");
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string>(agent.avatarUrl || "");
  const [avatarUploading, setAvatarUploading] = useState<boolean>(false);

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>("");
  const [passwordChanging, setPasswordChanging] = useState<boolean>(false);

  // Listing Form States (Create Property) - restructured as a 5-step wizard. All field state
  // below is unchanged from the original single-page form; only the JSX that renders it (and
  // when handleAddListing fires) changed.
  const [isAddingListing, setIsAddingListing] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [listingTitle, setListingTitle] = useState<string>("");
  const [listingPrice, setListingPrice] = useState<string>("");
  const [listingType, setListingType] = useState<PropertyType>(PropertyType.APARTMENT);
  const [listingTrans, setListingTrans] = useState<TransactionType>(TransactionType.FOR_RENT);
  const [listingArea, setListingArea] = useState<string>("");
  const [listingBeds, setListingBeds] = useState<string>("2");
  const [listingBaths, setListingBaths] = useState<string>("2");

  // Qatar-specific specification fields
  const [listingCompletionYear, setListingCompletionYear] = useState<string>("");
  const [listingFurnishingStatus, setListingFurnishingStatus] = useState<string>("");
  const [listingMetroStation, setListingMetroStation] = useState<string>("");
  const [listingMetroWalkingMinutes, setListingMetroWalkingMinutes] = useState<string>("");
  const [listingUtilitiesIncluded, setListingUtilitiesIncluded] = useState<string>("");
  const [listingParkingType, setListingParkingType] = useState<string>("");
  const [listingParkingSpaces, setListingParkingSpaces] = useState<string>("");
  const [listingTenureType, setListingTenureType] = useState<string>("");

  // Dynamic Locations States
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");

  const [listingDesc, setListingDesc] = useState<string>("");
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [listingAmenities, setListingAmenities] = useState<string>("Pool, Gym, Parking");

  // Non-blocking duplicate-listing warning surfaced after a successful create (Part 2 of the
  // availability refresh cycle work) - the listing is already created by the time this shows,
  // it's purely informational so the agent can confirm it's a genuinely different unit.
  const [possibleDuplicates, setPossibleDuplicates] = useState<{ id: string; title: string; price: number; district: string }[]>([]);

  // "Confirm Still Available" button state - tracks which listing card currently has a
  // confirm-available request in flight so only that card's button shows a spinner.
  const [confirmingAvailabilityId, setConfirmingAvailabilityId] = useState<string | null>(null);

  // Draft auto-save: persist in-progress wizard state to localStorage, keyed per-agent so it
  // never collides with another agent's draft on a shared browser profile. Restored on mount
  // below and cleared on successful submission. This is a nice-to-have per spec - kept simple
  // (raw JSON blob of primitive field state, no debouncing needed since writes are cheap).
  const listingDraftKey = `nerou_agent_listing_draft_${agent.id}`;
  // Guards the "default municipality to Doha" effect below from clobbering a municipality that
  // was just restored from a saved draft (the fetch resolves after mount, i.e. after restore).
  const restoredMunicipalityRef = React.useRef<boolean>(false);
  const draftRestoreAttempted = React.useRef<boolean>(false);

  // Restore an in-progress listing draft (if any) on first mount for this agent.
  useEffect(() => {
    if (draftRestoreAttempted.current) return;
    draftRestoreAttempted.current = true;
    try {
      const raw = localStorage.getItem(listingDraftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      const hasContent = !!(draft.listingTitle || draft.listingPrice || draft.listingDesc || draft.selectedMunicipality || (draft.listingImages && draft.listingImages.length > 0));
      if (!hasContent) return;

      if (draft.selectedMunicipality) restoredMunicipalityRef.current = true;

      setWizardStep(draft.wizardStep || 1);
      setListingTitle(draft.listingTitle || "");
      setListingPrice(draft.listingPrice || "");
      setListingType(draft.listingType || PropertyType.APARTMENT);
      setListingTrans(draft.listingTrans || TransactionType.FOR_RENT);
      setListingArea(draft.listingArea || "");
      setListingBeds(draft.listingBeds || "2");
      setListingBaths(draft.listingBaths || "2");
      setListingCompletionYear(draft.listingCompletionYear || "");
      setListingFurnishingStatus(draft.listingFurnishingStatus || "");
      setListingMetroStation(draft.listingMetroStation || "");
      setListingMetroWalkingMinutes(draft.listingMetroWalkingMinutes || "");
      setListingUtilitiesIncluded(draft.listingUtilitiesIncluded || "");
      setListingParkingType(draft.listingParkingType || "");
      setListingParkingSpaces(draft.listingParkingSpaces || "");
      setListingTenureType(draft.listingTenureType || "");
      setSelectedMunicipality(draft.selectedMunicipality || "");
      setSelectedArea(draft.selectedArea || "");
      setListingDesc(draft.listingDesc || "");
      setListingImages(draft.listingImages || []);
      setListingAmenities(draft.listingAmenities || "Pool, Gym, Parking");
      setIsAddingListing(true);
      setToastMessage(isRtl ? "تم استرجاع مسودة الإعلان المحفوظة." : "Restored your saved listing draft.");
      setTimeout(() => setToastMessage(""), 4000);
    } catch (e) {
      console.error("Failed to restore listing draft:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  // Persist the in-progress wizard state on every change while the form is open.
  useEffect(() => {
    if (!isAddingListing) return;
    try {
      const draft = {
        wizardStep, listingTitle, listingPrice, listingType, listingTrans, listingArea, listingBeds, listingBaths,
        listingCompletionYear, listingFurnishingStatus, listingMetroStation, listingMetroWalkingMinutes,
        listingUtilitiesIncluded, listingParkingType, listingParkingSpaces, listingTenureType,
        selectedMunicipality, selectedArea, listingDesc, listingImages, listingAmenities
      };
      localStorage.setItem(listingDraftKey, JSON.stringify(draft));
    } catch (e) {
      console.error("Failed to save listing draft:", e);
    }
  }, [
    isAddingListing, wizardStep, listingTitle, listingPrice, listingType, listingTrans, listingArea, listingBeds, listingBaths,
    listingCompletionYear, listingFurnishingStatus, listingMetroStation, listingMetroWalkingMinutes,
    listingUtilitiesIncluded, listingParkingType, listingParkingSpaces, listingTenureType,
    selectedMunicipality, selectedArea, listingDesc, listingImages, listingAmenities, listingDraftKey
  ]);

  useEffect(() => {
    fetchLeadsAndProperties();
    // Load central dynamic locations list
    fetch("/api/locations")
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        // Default to Doha if exists - unless a saved draft already restored a specific
        // municipality choice, in which case don't clobber it.
        const doha = data.find((l: any) => l.name === "Doha" && l.type === "MUNICIPALITY");
        if (doha && !restoredMunicipalityRef.current) setSelectedMunicipality(doha.id);
      })
      .catch(e => console.error("Error loading locations:", e));
  }, [agent.id]);

  // INDEPENDENT_AGENT: load subscription plan catalog so we can resolve the plan name for display.
  useEffect(() => {
    if (effectiveAgentType !== AgentType.INDEPENDENT_AGENT) return;
    fetch("/api/plans")
      .then(res => res.json())
      .then(data => setPlans(data || []))
      .catch(e => console.error("Error loading subscription plans:", e));
  }, [effectiveAgentType]);

  // AGENCY_AGENT: access is governed live by the agency's subscription status, not a static
  // per-user field - fetch the agency org so we can surface a banner if it isn't ACTIVE.
  useEffect(() => {
    if (effectiveAgentType !== AgentType.AGENCY_AGENT || !agent.orgId) return;
    fetch("/api/organizations")
      .then(res => res.json())
      .then((orgs: Organization[]) => {
        const matched = orgs.find(o => o.id === agent.orgId);
        if (matched) setAgencyOrg(matched);
      })
      .catch(e => console.error("Error loading agency organization:", e));
  }, [effectiveAgentType, agent.orgId]);

  // INDEPENDENT_AGENT: fetch this agent's own verification documents so we can proactively
  // warn them (before they ever submit a listing) that publication is blocked until their
  // Agency Authorization Letter is APPROVED - mirrors the same check server-side.
  useEffect(() => {
    if (effectiveAgentType !== AgentType.INDEPENDENT_AGENT) return;
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch("/api/verification-documents/mine", { headers })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        const authLetter = (data.documents || []).find(
          (d: any) => d.documentType === DocumentType.AGENCY_AUTHORIZATION_LETTER
        );
        setAuthLetterStatus(authLetter ? authLetter.status : "NOT_SUBMITTED");
      })
      .catch(e => console.error("Error loading verification documents:", e));
  }, [effectiveAgentType, agent.id]);

  const fetchLeadsAndProperties = async () => {
    try {
      // Fetch leads assigned to this agent
      const leadsRes = await fetch(`/api/leads?agentId=${agent.id}`);
      const leadsData = await leadsRes.json();
      setLeads(leadsData);

      // Fetch properties uploaded/assigned to this agent. AGENCY_AGENT listings are scoped
      // by their agency's orgId; INDEPENDENT_AGENT has no orgId, so fetch broadly and rely
      // on the agentId filter below.
      const propRes = await fetch(agent.orgId ? `/api/properties?orgId=${agent.orgId}&includeAllStatuses=true` : "/api/properties?includeAllStatuses=true");
      const propData = await propRes.json();
      const agentProperties = propData.filter((p: Property) => p.agentId === agent.id);
      setProperties(agentProperties);
    } catch (err) {
      console.error("Failed to load agent workspace details", err);
    }
  };

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
          actorId: agent.id,
          actorName: agent.fullName,
          actorRole: agent.role
        })
      });
      if (res.ok) {
        fetchLeadsAndProperties();
        onRefreshAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX 2: add a timestamped note to a lead (persisted, visible on its detail view).
  const handleAddLeadNote = async (leadId: string) => {
    if (!leadNoteDraft.trim()) return;
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ text: leadNoteDraft.trim(), authorId: agent.id, authorName: agent.fullName })
      });
      if (res.ok) {
        setLeadNoteDraft("");
        fetchLeadsAndProperties();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX 2: soft-close/reopen a lead - preserves history, never deletes it.
  const handleArchiveLead = async (leadId: string, isArchived: boolean) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ isArchived })
      });
      if (res.ok) {
        fetchLeadsAndProperties();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // FIX 2: "view the related property" - the app has no client-side router/deep-linking for
  // property detail pages (they're an in-memory selection inside VisitorExperience), so the
  // honest way to show it from the dashboard is to fetch and preview it inline here.
  const handleViewLeadProperty = async (propertyId: string) => {
    try {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (res.ok) {
        setLeadPropertyPreview(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/users/${agent.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          fullName,
          phone,
          whatsapp,
          bio,
          languages: languages.split(",").map(s => s.trim()).filter(Boolean),
          specialties: specialties.split(",").map(s => s.trim()).filter(Boolean)
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update user session in localStorage
        localStorage.setItem("nerou_user", JSON.stringify(data.user));
        // Trigger page/workspace refresh
        onRefreshAll();
        setToastMessage(isRtl ? "تم حفظ تغييرات الملف الشخصي بنجاح!" : "Profile details saved successfully!");
      } else {
        const data = await res.json();
        setToastMessage(data.error || "Failed to update profile.");
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage("Network error saving profile changes.");
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setAvatarUploading(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("files", compressed);

      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // ?type=avatar tells the shared media upload endpoint to skip the property-photo
      // watermark - appropriate for property images, wrong for a profile picture.
      const uploadRes = await fetch("/api/media/upload?type=avatar", {
        method: "POST",
        headers,
        body: formData
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل رفع الصورة الشخصية." : "Failed to upload profile picture."));
        setTimeout(() => setToastMessage(""), 4000);
        return;
      }

      const uploadData = await uploadRes.json();
      const newAvatarUrl = (uploadData.fileUrls || uploadData.urls || [])[0];
      if (!newAvatarUrl) return;

      const patchHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (token) patchHeaders["Authorization"] = `Bearer ${token}`;
      const patchRes = await fetch(`/api/users/${agent.id}`, {
        method: "PATCH",
        headers: patchHeaders,
        body: JSON.stringify({ avatarUrl: newAvatarUrl })
      });

      if (patchRes.ok) {
        const data = await patchRes.json();
        setCurrentAvatarUrl(newAvatarUrl);
        localStorage.setItem("nerou_user", JSON.stringify(data.user));
        onRefreshAll();
        setToastMessage(isRtl ? "تم تحديث الصورة الشخصية بنجاح!" : "Profile picture updated successfully!");
      } else {
        const data = await patchRes.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "فشل حفظ الصورة الشخصية." : "Failed to save profile picture."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Avatar upload error:", err);
      setToastMessage(isRtl ? "فشل رفع الصورة الشخصية." : "Failed to upload profile picture.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const res = await fetch(`/api/users/${agent.id}/change-password`, {
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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Hard cap: existing + newly-selected images may not exceed MAX_LISTING_IMAGES.
    const remainingSlots = MAX_LISTING_IMAGES - listingImages.length;
    if (remainingSlots <= 0) {
      setToastMessage(
        isRtl
          ? "الحد الأقصى 14 صورة لكل إعلان — قم بإزالة صورة لإضافة أخرى."
          : "Maximum 14 photos per listing reached — remove one to add another."
      );
      setTimeout(() => setToastMessage(""), 4000);
      e.target.value = "";
      return;
    }

    const allFiles: File[] = [];
    for (let i = 0; i < files.length; i++) allFiles.push(files[i]);
    let truncated = false;
    let filesToUpload = allFiles;
    if (filesToUpload.length > remainingSlots) {
      filesToUpload = filesToUpload.slice(0, remainingSlots);
      truncated = true;
    }

    setUploading(true);
    const formData = new FormData();

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        try {
          const compressed = await compressImage(file);
          formData.append("files", compressed);
        } catch (err) {
          formData.append("files", file); // fallback to original
        }
      }

      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/media/upload", {
        method: "POST",
        headers,
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedUrls = data.fileUrls || data.urls || [];
        setListingImages(prev => [...prev, ...uploadedUrls]);
        if (truncated) {
          setToastMessage(
            isRtl
              ? "الحد الأقصى 14 صورة لكل إعلان — قم بإزالة صورة لإضافة أخرى."
              : "Maximum 14 photos per listing reached — remove one to add another."
          );
          setTimeout(() => setToastMessage(""), 4000);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to upload images.");
      }
    } catch (err) {
      console.error("Media upload error:", err);
      alert("Failed to upload media files.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeUploadedImage = (index: number) => {
    setListingImages(prev => prev.filter((_, i) => i !== index));
  };

  // Simple up/down reordering for the photo grid - no drag-and-drop library required.
  const moveListingImage = (index: number, direction: -1 | 1) => {
    setListingImages(prev => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const tmp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = tmp;
      return updated;
    });
  };

  // 5-step "Add Listing" wizard: names + per-step validation. Validation checks mirror exactly
  // what the original single-page form already enforced (via `required` attributes and the
  // guard at the top of handleAddListing) - just moved to fire on "Next" instead of only at
  // final submit. Location (step 2) and Photos (step 4) carry no hard requirement in the
  // original form either (location silently falls back to Doha/West Bay), so none is added here.
  const LISTING_WIZARD_STEPS: { step: number; en: string; ar: string }[] = [
    { step: 1, en: "Type & Purpose", ar: "النوع والغرض" },
    { step: 2, en: "Location", ar: "الموقع" },
    { step: 3, en: "Specifications", ar: "المواصفات" },
    { step: 4, en: "Photos", ar: "الصور" },
    { step: 5, en: "Description & Review", ar: "الوصف والمراجعة" }
  ];

  const getListingStepError = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!listingTitle.trim()) return isRtl ? "يرجى إدخال عنوان الإعلان." : "Please enter a listing title.";
        if (!listingType) return isRtl ? "يرجى اختيار نوع العقار." : "Please select a property type.";
        if (!listingTrans) return isRtl ? "يرجى اختيار نوع المعاملة." : "Please select a transaction type.";
        return null;
      case 3:
        if (!listingPrice || Number(listingPrice) < 0) return isRtl ? "يرجى إدخال سعر صالح." : "Please enter a valid price.";
        if (!listingArea || Number(listingArea) < 0) return isRtl ? "يرجى إدخال مساحة صالحة." : "Please enter a valid area size.";
        return null;
      case 5:
        if (!listingDesc.trim()) return isRtl ? "يرجى إدخال وصف للعقار." : "Please enter a property description.";
        return null;
      default:
        return null;
    }
  };

  const handleWizardNext = () => {
    const err = getListingStepError(wizardStep);
    if (err) {
      setToastMessage(err);
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }
    setWizardStep(s => Math.min(LISTING_WIZARD_STEPS.length, s + 1));
  };

  const handleWizardBack = () => {
    setWizardStep(s => Math.max(1, s - 1));
  };

  // Clicking a step "pill" in the progress indicator only allows going BACK to a step already
  // visited - forward jumps must go through handleWizardNext so validation still applies.
  const goToWizardStep = (step: number) => {
    if (step <= wizardStep) setWizardStep(step);
  };

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingTitle || !listingPrice || !listingDesc) return;
    // AGENCY_AGENT listings must always carry their agency's orgId. INDEPENDENT_AGENT has no
    // orgId by definition and lists under their own account instead (see FIX A: publication
    // gate below), so this affiliation check only applies to AGENCY_AGENT.
    if (effectiveAgentType === AgentType.AGENCY_AGENT && !agent.orgId) {
      setToastMessage(isRtl ? "يجب أن تنضم إلى مكتب عقاري لتتمكن من إضافة عقارات." : "You must be affiliated with an agency before you can list properties.");
      setTimeout(() => setToastMessage(""), 5000);
      return;
    }

    // Resolve city & district names from selected location IDs
    const muniItem = locations.find(l => l.id === selectedMunicipality);
    const areaItem = locations.find(l => l.id === selectedArea);
    const finalCity = muniItem ? muniItem.name : "Doha";
    const finalDistrict = areaItem ? areaItem.name : "West Bay";

    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/properties", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: listingTitle,
          price: Number(listingPrice),
          propertyType: listingType,
          transactionType: listingTrans,
          area: Number(listingArea),
          bedrooms: Number(listingBeds),
          bathrooms: Number(listingBaths),
          city: finalCity,
          district: finalDistrict,
          description: listingDesc,
          images: listingImages,
          amenities: listingAmenities.split(",").map(a => a.trim()),
          agentId: agent.id,
          orgId: agent.orgId,
          actorId: agent.id,
          actorName: agent.fullName,
          actorRole: agent.role,
          // Qatar-specific specification fields
          completionYear: listingCompletionYear ? Number(listingCompletionYear) : undefined,
          furnishingStatus: listingFurnishingStatus || undefined,
          metroStation: listingMetroStation || undefined,
          metroWalkingMinutes: listingMetroWalkingMinutes ? Number(listingMetroWalkingMinutes) : undefined,
          utilitiesIncluded: listingUtilitiesIncluded || undefined,
          parkingType: listingParkingType || undefined,
          parkingSpaces: listingParkingSpaces ? Number(listingParkingSpaces) : undefined,
          tenureType: listingTenureType || undefined
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setIsAddingListing(false);
        setWizardStep(1);
        setListingTitle("");
        setListingPrice("");
        setListingArea("");
        setListingDesc("");
        setListingImages([]);
        setSelectedArea("");
        setListingCompletionYear("");
        setListingFurnishingStatus("");
        setListingMetroStation("");
        setListingMetroWalkingMinutes("");
        setListingUtilitiesIncluded("");
        setListingParkingType("");
        setListingParkingSpaces("");
        setListingTenureType("");
        // Draft fully consumed - clear it so a stale draft doesn't reappear on next visit.
        try { localStorage.removeItem(listingDraftKey); } catch (e) { console.error(e); }
        fetchLeadsAndProperties();
        onRefreshAll();
        // FIX 3: listings publish immediately (no per-listing admin approval step) once the
        // account-level gate passes - message reflects the actual resulting status instead
        // of the old "pending review" copy.
        setToastMessage(
          data.listingStatus === ListingStatus.DRAFT
            ? (isRtl ? "تم حفظ العقار كمسودة." : "Property saved as a draft.")
            : (isRtl ? "تم نشر العقار بنجاح!" : "Property listing published successfully!")
        );
        setTimeout(() => setToastMessage(""), 4000);
        // Non-blocking duplicate warning - the listing above is already created either way,
        // this is purely informational (see possibleDuplicates banner in the Properties tab).
        if (Array.isArray(data.possibleDuplicates) && data.possibleDuplicates.length > 0) {
          setPossibleDuplicates(data.possibleDuplicates);
        } else {
          setPossibleDuplicates([]);
        }
      } else {
        // Surface the backend's exact error (e.g. the Agency Authorization Letter gate for
        // INDEPENDENT_AGENT) instead of a generic message, so the agent knows exactly what's missing.
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر إضافة العقار. يرجى المحاولة مرة أخرى." : "Failed to add the property listing. Please try again."));
        setTimeout(() => setToastMessage(""), 6000);
      }
    } catch (err) {
      console.error("Failed to add property listing", err);
      setToastMessage(isRtl ? "تعذر إضافة العقار. يرجى المحاولة مرة أخرى." : "Failed to add the property listing. Please try again.");
      setTimeout(() => setToastMessage(""), 5000);
    }
  };

  // One-click "Confirm Still Available" - resets the listing's staleness clock server-side
  // and, if it had been auto-paused purely for going stale, reactivates it.
  const handleConfirmAvailable = async (propertyId: string) => {
    setConfirmingAvailabilityId(propertyId);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/properties/${propertyId}/confirm-available`, {
        method: "PATCH",
        headers
      });

      if (res.ok) {
        const updated = await res.json();
        setProperties(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        setToastMessage(isRtl ? "تم تأكيد أن العقار لا يزال متاحاً!" : "Listing availability confirmed!");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر تأكيد توفر العقار." : "Failed to confirm listing availability."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Failed to confirm listing availability", err);
      setToastMessage(isRtl ? "تعذر تأكيد توفر العقار." : "Failed to confirm listing availability.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setConfirmingAvailabilityId(null);
    }
  };

  // FIX 1: agent-facing listing status control. Status changes never delete the listing -
  // it stays fully visible here with its status and statusChangedDate, so history is preserved.
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const handleUpdateListingStatus = async (propertyId: string, status: ListingStatus) => {
    setUpdatingStatusId(propertyId);
    try {
      const token = localStorage.getItem("token");
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/properties/${propertyId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        const updated = await res.json();
        setProperties(prev => prev.map(p => (p.id === updated.id ? updated : p)));
        setToastMessage(isRtl ? "تم تحديث حالة العقار!" : "Listing status updated!");
      } else {
        const data = await res.json().catch(() => ({}));
        setToastMessage(data.error || (isRtl ? "تعذر تحديث حالة العقار." : "Failed to update listing status."));
      }
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Failed to update listing status", err);
      setToastMessage(isRtl ? "تعذر تحديث حالة العقار." : "Failed to update listing status.");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Stats calculation
  const totalLeads = leads.length;
  const convertedLeads = leads.filter(l => l.status === LeadStatus.CONVERTED).length;
  const activeListings = properties.length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e6e2de] pb-4">
        <div>
          <h2 className="text-2xl font-serif text-[#1a1918] font-medium">
            {isRtl ? "مساحة عمل الوكيل العقاري" : "Agent Workspace"}
          </h2>
          <p className="text-xs text-[#6e6b66] mt-0.5">
            {isRtl ? `الوكيل النشط: ${agent.fullName}` : `Active Representative: ${agent.fullName}`}
            {agent.verificationStatus === VerificationStatus.APPROVED && (
              <span className="ml-1.5 font-semibold text-[#bf9b30]">
                • {getVerifiedBadgeLabel(agent, agencyOrg?.name, isRtl)}
              </span>
            )}
          </p>
        </div>

        <div className="flex bg-[#f2ede8] p-0.5 rounded-lg text-xs font-medium overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "dashboard" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "لوحة القيادة" : "Stats Center"}
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "leads" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "العملاء المحتملون" : "Leads Panel"}
          </button>
          <button
            onClick={() => setActiveTab("properties")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "properties" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "عقاراتي" : "My Listings"}
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "verification" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "التوثيق" : "Verification"}
          </button>
          {/* FIX1: Subscription tab only applies to INDEPENDENT_AGENT - an AGENCY_AGENT rides on
              their agency's subscription and never sees a self-serve subscription tab at all. */}
          {effectiveAgentType === AgentType.INDEPENDENT_AGENT && (
            <button
              onClick={() => setActiveTab("subscription")}
              className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "subscription" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
            >
              {isRtl ? "الاشتراك" : "Subscription"}
            </button>
          )}
          <button
            onClick={() => setActiveTab("reviews")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "reviews" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "التقييمات" : "Reviews"}
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "profile" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "الحساب" : "My Profile"}
          </button>
        </div>
      </div>

      {/* AGENCY_AGENT: access is governed live by the agency's subscription, not a static
          per-user field - show a non-blocking banner (not a full-screen block) when it lapses. */}
      {effectiveAgentType === AgentType.AGENCY_AGENT && agencyOrg && agencyOrg.subscriptionStatus && agencyOrg.subscriptionStatus !== "ACTIVE" && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            {isRtl
              ? "اشتراك مكتبك العقاري غير مفعل حالياً. يرجى التواصل مع مدير المكتب لتفعيله."
              : "Your agency's subscription is not currently active. Contact your agency administrator."}
          </span>
        </div>
      )}

      {/* VERIFICATION TAB */}
      {activeTab === "verification" && <VerificationDocumentsPanel isRtl={isRtl} agent={agent} onSaved={onRefreshAll} />}

      {/* SUBSCRIPTION TAB (INDEPENDENT_AGENT only) */}
      {activeTab === "subscription" && effectiveAgentType === AgentType.INDEPENDENT_AGENT && (
        <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 text-xs max-w-xl">
          <h4 className="font-serif text-sm font-semibold text-[#1a1918] border-b border-[#f2ede8] pb-3 flex items-center gap-2">
            <CreditCard size={16} className="text-[#bf9b30]" />
            {isRtl ? "بيانات اشتراكك كوكيل مستقل" : "Your Independent Agent Subscription"}
          </h4>
          {(() => {
            const plan = plans.find(p => p.id === agent.subscriptionPlanId);
            const status = agent.subscriptionStatus || "PENDING_APPROVAL";
            const statusColor =
              status === "ACTIVE" ? "text-emerald-600" :
              (status === "SUSPENDED" || status === "CANCELLED") ? "text-red-600" : "text-amber-600";
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6b66]">{isRtl ? "الخطة الحالية" : "Current Plan"}</span>
                  <span className="font-bold text-[#1a1918]">{plan?.name || (isRtl ? "لم يتم تحديد خطة بعد" : "No plan selected yet")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6b66]">{isRtl ? "حالة الاشتراك" : "Subscription Status"}</span>
                  <span className={`font-bold ${statusColor}`}>{status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6e6b66]">{isRtl ? "تاريخ الانتهاء" : "Expiry Date"}</span>
                  <span className="font-bold text-[#1a1918]">
                    {agent.subscriptionExpiry ? new Date(agent.subscriptionExpiry).toLocaleDateString() : "-"}
                  </span>
                </div>
                {agent.subscriptionNotes && (
                  <div className="pt-3 border-t border-[#f2ede8]">
                    <span className="text-[#6e6b66] block mb-1">{isRtl ? "ملاحظات الإدارة" : "Admin Notes"}</span>
                    <p className="text-[#1a1918]">{agent.subscriptionNotes}</p>
                  </div>
                )}
                <p className="text-[10px] text-[#6e6b66] pt-3 border-t border-[#f2ede8]">
                  {isRtl
                    ? "يقوم فريق نيرو فايندر بتفعيل خطة اشتراكك بعد التواصل معك وتأكيد الدفع. لا حاجة لإجراء أي دفع ذاتي من هنا."
                    : "Your plan and payment are activated by the Nerou Finder team after they contact you and confirm payment. No self-service payment is required here."}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#e6e2de]">
              <div className="flex items-center justify-between text-[#6e6b66] mb-2">
                <span className="text-xs font-medium">{isRtl ? "إجمالي العملاء" : "Total Leads Assigned"}</span>
                <Users size={16} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-[#1a1918]">{totalLeads}</h3>
              <p className="text-[10px] text-emerald-600 font-medium mt-1">↑ 14% {isRtl ? "هذا الأسبوع" : "vs last week"}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e6e2de]">
              <div className="flex items-center justify-between text-[#6e6b66] mb-2">
                <span className="text-xs font-medium">{isRtl ? "نسبة التحويل" : "Conversion Efficiency"}</span>
                <TrendingUp size={16} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-[#1a1918]">{conversionRate}%</h3>
              <p className="text-[10px] text-[#6e6b66] mt-1">{isRtl ? "معدل الإغلاق الكلي" : "Of total processed inquiries"}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e6e2de]">
              <div className="flex items-center justify-between text-[#6e6b66] mb-2">
                <span className="text-xs font-medium">{isRtl ? "عقارات معروضة" : "Active Listings"}</span>
                <Building size={16} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-[#1a1918]">{activeListings}</h3>
              <p className="text-[10px] text-[#6e6b66] mt-1">{isRtl ? "منشورة ومتاحة للتداول" : "Published properties online"}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e6e2de]">
              <div className="flex items-center justify-between text-[#6e6b66] mb-2">
                <span className="text-xs font-medium">{isRtl ? "زمن الاستجابة" : "Avg. Response Time"}</span>
                <Clock size={16} />
              </div>
              <h3 className="text-2xl font-serif font-bold text-[#1a1918]">12 min</h3>
              <p className="text-[10px] text-emerald-600 font-medium mt-1">↓ 3 min {isRtl ? "أسرع اليوم" : "industry gold class"}</p>
            </div>
          </div>

          {/* Quick Tasks & Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
              <h4 className="font-serif text-base font-semibold text-[#1a1918]">
                {isRtl ? "العملاء الجدد المعلقين" : "Unaddressed Hot Leads"}
              </h4>
              <div className="space-y-3">
                {leads.filter(l => l.status === LeadStatus.NEW).length === 0 ? (
                  <p className="text-xs text-center text-[#6e6b66] py-4">{isRtl ? "لا توجد عملاء جدد معلقين." : "All incoming requests processed!"}</p>
                ) : (
                  leads.filter(l => l.status === LeadStatus.NEW).map(lead => (
                    <div key={lead.id} className="p-3 bg-[#fbfaf8] border border-[#e6e2de] rounded-lg flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h5 className="text-xs font-bold text-[#1a1918]">{lead.visitorName}</h5>
                        <p className="text-[10px] text-[#6e6b66] line-clamp-1">{lead.message}</p>
                      </div>
                      <button
                        onClick={() => handleUpdateLeadStatus(lead.id, LeadStatus.CONTACTED)}
                        className="px-2.5 py-1 bg-[#1a1918] hover:bg-[#bf9b30] text-white text-[10px] rounded"
                      >
                        {isRtl ? "تأكيد التواصل" : "Acknowledge"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4">
              <h4 className="font-serif text-base font-semibold text-[#1a1918]">
                {isRtl ? "قنوات الإغلاق والإنتاجية" : "Lead Channel Attribution"}
              </h4>
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>{isRtl ? "واتساب مباشر" : "Direct WhatsApp Inquiries"}</span>
                    <span className="font-bold">60%</span>
                  </div>
                  <div className="h-2 bg-[#f2ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "60%" }}></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>{isRtl ? "اتصال هاتفي" : "Direct Telephone Contacts"}</span>
                    <span className="font-bold">25%</span>
                  </div>
                  <div className="h-2 bg-[#f2ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: "25%" }}></div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>{isRtl ? "جدولة معاينات نموذج الموقع" : "Interactive Booking Forms"}</span>
                    <span className="font-bold">15%</span>
                  </div>
                  <div className="h-2 bg-[#f2ede8] rounded-full overflow-hidden">
                    <div className="h-full bg-[#bf9b30]" style={{ width: "15%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEADS TAB */}
      {activeTab === "leads" && (
        <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
          <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex items-center justify-between gap-3 flex-wrap">
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "إدارة وتتبع تواصل العملاء" : "Assigned Lead Lifecycle Funnel"}</h4>
            <button
              type="button"
              onClick={() => setShowArchivedLeads(prev => !prev)}
              className="text-[10px] font-semibold text-[#6e6b66] hover:text-[#1a1918] underline cursor-pointer"
            >
              {showArchivedLeads
                ? (isRtl ? "إخفاء العملاء المؤرشفين" : "Hide archived leads")
                : (isRtl ? "عرض العملاء المؤرشفين" : "Show archived leads")}
            </button>
          </div>
          <div className="divide-y divide-[#f2ede8] text-xs">
            {(() => {
              const visibleLeads = leads.filter(l => (showArchivedLeads ? !!l.isArchived : !l.isArchived));
              if (visibleLeads.length === 0) {
                return (
                  <p className="text-center py-8 text-[#6e6b66]">
                    {showArchivedLeads
                      ? (isRtl ? "لا يوجد عملاء مؤرشفون." : "No archived leads.")
                      : (isRtl ? "لا توجد أي طلبات تواصل مسجلة." : "No leads assigned to you yet.")}
                  </p>
                );
              }
              const waPhone = (lead: Lead) => (lead.visitorWhatsapp || lead.visitorPhone || "").replace(/[^0-9]/g, "");
              return visibleLeads.map(lead => (
                <div key={lead.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedLeadId(lead.id)}
                        className="font-bold text-[#1a1918] text-sm hover:text-[#bf9b30] cursor-pointer underline decoration-dotted"
                      >
                        {lead.visitorName}
                      </button>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        lead.status === LeadStatus.NEW ? "bg-red-50 text-red-700 border border-red-200" :
                        lead.status === LeadStatus.CONTACTED || lead.status === LeadStatus.VIEWING_REQUESTED || lead.status === LeadStatus.VIEWING_SCHEDULED ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
                        lead.status === LeadStatus.LOST ? "bg-gray-100 text-gray-500 border border-gray-200" : "bg-green-50 text-green-700 border border-green-200"
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="text-[#6e6b66] space-y-0.5">
                      <div className="flex items-center gap-3">
                        <a
                          href={`https://wa.me/${waPhone(lead)}?text=${encodeURIComponent(isRtl ? `مرحباً ${lead.visitorName}، بخصوص استفساركم العقاري.` : `Hello ${lead.visitorName}, regarding your property inquiry.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold"
                        >
                          <MessageSquare size={12} /> {lead.visitorPhone}
                        </a>
                        {lead.visitorEmail && (
                          <a href={`mailto:${lead.visitorEmail}`} className="flex items-center gap-1 text-[#1a1918] hover:text-[#bf9b30] font-semibold">
                            <Mail size={12} /> {lead.visitorEmail}
                          </a>
                        )}
                      </div>
                      <p className="italic">"{lead.message}"</p>
                      {lead.propertyId && (
                        <button type="button" onClick={() => handleViewLeadProperty(lead.propertyId!)} className="text-[10px] text-[#bf9b30] underline cursor-pointer">
                          {isRtl ? "عرض العقار المرتبط" : "View related property"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <select
                      value={lead.status}
                      onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as LeadStatus)}
                      className="px-2 py-1.5 bg-white border border-[#e6e2de] rounded text-[10px] font-semibold text-[#1a1918]"
                    >
                      {Object.values(LeadStatus).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleArchiveLead(lead.id, !lead.isArchived)}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] text-[#1a1918] font-medium rounded cursor-pointer"
                    >
                      {lead.isArchived ? (isRtl ? "إعادة فتح" : "Reopen") : (isRtl ? "أرشفة" : "Archive")}
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* FIX 2: lead detail modal - full record, notes, and quick actions */}
      {selectedLeadId && (() => {
        const lead = leads.find(l => l.id === selectedLeadId);
        if (!lead) return null;
        const waPhone = (lead.visitorWhatsapp || lead.visitorPhone || "").replace(/[^0-9]/g, "");
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLeadId(null)}>
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-serif text-base font-bold text-[#1a1918]">{lead.visitorName}</h4>
                  <p className="text-[10px] text-[#6e6b66]">{isRtl ? "استلم بتاريخ " : "Received "}{new Date(lead.createdDate).toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => setSelectedLeadId(null)} className="text-[#6e6b66] hover:text-[#1a1918] cursor-pointer"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold">
                  <MessageSquare size={14} /> {isRtl ? "واتساب" : "WhatsApp"}
                </a>
                <a href={`tel:${lead.visitorPhone}`} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1a1918] hover:bg-[#33302a] text-white rounded-lg font-semibold">
                  <Phone size={14} /> {isRtl ? "اتصال" : "Call"}
                </a>
              </div>

              <div className="space-y-1 border-t border-[#f2ede8] pt-3">
                <p><strong>{isRtl ? "البريد: " : "Email: "}</strong>{lead.visitorEmail || "—"}</p>
                <p><strong>{isRtl ? "الرسالة: " : "Message: "}</strong>{lead.message}</p>
                <p><strong>{isRtl ? "الحالة: " : "Status: "}</strong>{lead.status}</p>
                {lead.propertyId && (
                  <button type="button" onClick={() => handleViewLeadProperty(lead.propertyId!)} className="text-[#bf9b30] underline cursor-pointer">
                    {isRtl ? "عرض العقار المرتبط" : "View related property"}
                  </button>
                )}
              </div>

              <div className="border-t border-[#f2ede8] pt-3 space-y-2">
                <p className="font-bold text-[#1a1918]">{isRtl ? "الملاحظات" : "Notes"}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={leadNoteDraft}
                    onChange={(e) => setLeadNoteDraft(e.target.value)}
                    placeholder={isRtl ? "أضف ملاحظة..." : "Add a note..."}
                    className="flex-1 px-2 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg"
                  />
                  <button type="button" onClick={() => handleAddLeadNote(lead.id)} disabled={!leadNoteDraft.trim()} className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] disabled:opacity-40 text-white rounded-lg font-semibold cursor-pointer">
                    {isRtl ? "إضافة" : "Add"}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(lead.notes || []).length === 0 ? (
                    <p className="text-[#a9a49d] italic">{isRtl ? "لا توجد ملاحظات بعد." : "No notes yet."}</p>
                  ) : (
                    (lead.notes || []).map(n => (
                      <div key={n.id} className="bg-[#fbfaf8] border border-[#f2ede8] rounded-lg p-2">
                        <p className="text-[#1a1918]">{n.text}</p>
                        <p className="text-[9px] text-[#a9a49d] mt-0.5">{n.authorName} • {new Date(n.createdDate).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FIX 2: inline property preview (no client-side router exists to deep-link into
          VisitorExperience's property detail view, so this fetches and shows it directly). */}
      {leadPropertyPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setLeadPropertyPreview(null)}>
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden text-xs" onClick={(e) => e.stopPropagation()}>
            <img src={leadPropertyPreview.images?.[0]} alt={leadPropertyPreview.title} className="w-full h-40 object-cover" />
            <div className="p-4 space-y-1">
              <div className="flex items-start justify-between">
                <h5 className="font-serif text-sm font-bold text-[#1a1918]">{isRtl ? leadPropertyPreview.titleAr : leadPropertyPreview.title}</h5>
                <button type="button" onClick={() => setLeadPropertyPreview(null)} className="text-[#6e6b66] hover:text-[#1a1918] cursor-pointer"><X size={16} /></button>
              </div>
              <p className="text-[#6e6b66]">{leadPropertyPreview.district}, {leadPropertyPreview.city}</p>
              <p className="font-bold text-[#bf9b30]">{leadPropertyPreview.price?.toLocaleString()} QAR</p>
              <p className="text-[10px] text-[#6e6b66]">{isRtl ? "الحالة: " : "Status: "}{leadPropertyPreview.listingStatus} • ID: {leadPropertyPreview.listingId}</p>
            </div>
          </div>
        </div>
      )}

      {/* PROPERTIES TAB (Listing Manager) */}
      {activeTab === "properties" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "إدارة مخزون العقارات المعروضة" : "Active Exclusive Listings"}</h4>
            <button
              onClick={() => setIsAddingListing(!isAddingListing)}
              className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "إضافة عقار جديد" : "New Property"}</span>
            </button>
          </div>

          {/* Qatar regulation gate: INDEPENDENT_AGENT listings cannot go live until their
              Agency Authorization Letter is APPROVED. Warn proactively, before submission,
              rather than only surfacing this after a failed publish attempt. */}
          {effectiveAgentType === AgentType.INDEPENDENT_AGENT && authLetterStatus !== null && authLetterStatus !== DocumentStatus.APPROVED && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                {isRtl
                  ? `يجب اعتماد "خطاب تفويض المكتب العقاري" الخاص بك قبل أن تتمكن من نشر عقاراتك للعامة. الحالة الحالية: ${authLetterStatus}. يمكنك إدارة مستنداتك من تبويب "التوثيق".`
                  : `Your Agency Authorization Letter must be approved before your listings can go live to the public. Current status: ${authLetterStatus}. Manage this under the "Verification" tab.`}
              </span>
            </div>
          )}

          {/* Non-blocking duplicate-listing warning (Part 2 of the availability refresh cycle
              work): shown right after a create response comes back with possibleDuplicates.
              The new listing is already created either way - this is purely informational. */}
          {possibleDuplicates.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="shrink-0" />
                    {isRtl ? "قد يكون هذا الإعلان مشابهاً لإعلان حالي" : "This may be similar to an existing listing"}
                  </p>
                  {possibleDuplicates.map(dup => (
                    <p key={dup.id}>
                      {isRtl
                        ? `يبدو هذا الإعلان مشابهاً لإعلانك الحالي "${dup.title}" (${dup.district}، ${dup.price.toLocaleString()} ر.ق) — يرجى التأكد من أن هذه وحدة مختلفة فعلياً، أو التفكير في تعديل الإعلان الحالي بدلاً من ذلك.`
                        : `This looks similar to your existing listing "${dup.title}" (${dup.district}, ${dup.price.toLocaleString()} QAR) — please confirm this is a genuinely different unit, or consider editing the existing one instead.`}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPossibleDuplicates([])}
                  className="text-blue-700 hover:text-blue-900 shrink-0 cursor-pointer"
                  aria-label={isRtl ? "إغلاق" : "Dismiss"}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {isAddingListing && (
            <form
              onSubmit={handleAddListing}
              onKeyDown={(e) => {
                // Only the final step's submit button should ever fire this form's submission -
                // block implicit Enter-to-submit on earlier steps so it always goes through the
                // wizard's own Next/validation flow instead.
                if (e.key === "Enter" && wizardStep < LISTING_WIZARD_STEPS.length && (e.target as HTMLElement).tagName !== "TEXTAREA") {
                  e.preventDefault();
                }
              }}
              className="bg-white p-5 rounded-xl border border-[#bf9b30]/30 space-y-5 animate-in fade-in duration-200 text-xs"
            >
              <div>
                <h5 className="font-serif text-sm font-bold text-[#1a1918] pb-2">
                  {isRtl ? "إدخال بيانات عقار جديد" : "Provide New Property Specifications"}
                </h5>

                {/* Progress indicator - "Step X of 5" with clickable back-navigation to any
                    already-visited step. Forward jumps must go through Next's validation. */}
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-2">
                  {LISTING_WIZARD_STEPS.map((s, idx) => {
                    const isActive = s.step === wizardStep;
                    const isDone = s.step < wizardStep;
                    const isClickable = s.step <= wizardStep;
                    return (
                      <React.Fragment key={s.step}>
                        <button
                          type="button"
                          onClick={() => goToWizardStep(s.step)}
                          disabled={!isClickable}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0 text-[10px] sm:text-xs font-semibold transition-colors ${
                            isActive ? "bg-[#1a1918] text-white" :
                            isDone ? "bg-[#f2ede8] text-[#1a1918] cursor-pointer hover:bg-[#e6e2de]" :
                            "text-[#a9a49d] cursor-not-allowed"
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                            isActive ? "bg-[#bf9b30] text-white" : isDone ? "bg-[#bf9b30]/70 text-white" : "bg-[#e6e2de] text-[#6e6b66]"
                          }`}>
                            {isDone ? <Check size={10} /> : s.step}
                          </span>
                          <span className="whitespace-nowrap">{isRtl ? s.ar : s.en}</span>
                        </button>
                        {idx < LISTING_WIZARD_STEPS.length - 1 && (
                          <div className={`h-px w-3 sm:w-6 shrink-0 ${s.step < wizardStep ? "bg-[#bf9b30]" : "bg-[#e6e2de]"}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[#6e6b66] border-b border-[#f2ede8] pb-3">
                  {isRtl
                    ? `الخطوة ${wizardStep} من ${LISTING_WIZARD_STEPS.length}: ${LISTING_WIZARD_STEPS[wizardStep - 1].ar}`
                    : `Step ${wizardStep} of ${LISTING_WIZARD_STEPS.length}: ${LISTING_WIZARD_STEPS[wizardStep - 1].en}`}
                </p>
              </div>

              {/* STEP 1: Property Type & Purpose */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "عنوان الإعلان" : "Listing Title"}</label>
                    <input
                      type="text"
                      required
                      value={listingTitle}
                      onChange={(e) => setListingTitle(e.target.value)}
                      placeholder="e.g. Elegant 2-BR West Bay Penthouse"
                      className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نوع العقار" : "Property Type"}</label>
                      <select
                        value={listingType}
                        onChange={(e) => setListingType(e.target.value as PropertyType)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value={PropertyType.APARTMENT}>Apartment</option>
                        <option value={PropertyType.VILLA}>Villa</option>
                        <option value={PropertyType.TOWNHOUSE}>Townhouse</option>
                        <option value={PropertyType.PENTHOUSE}>Penthouse</option>
                        <option value={PropertyType.COMPOUND}>Compound</option>
                        <option value={PropertyType.STUDIO}>Studio</option>
                        <option value={PropertyType.ROOM}>Room</option>
                        <option value={PropertyType.OFFICE}>Office</option>
                        <option value={PropertyType.RETAIL}>Retail</option>
                        <option value={PropertyType.SHOP}>Shop</option>
                        <option value={PropertyType.WAREHOUSE}>Warehouse</option>
                        <option value={PropertyType.BUILDING}>Building</option>
                        <option value={PropertyType.LAND}>Land</option>
                        <option value={PropertyType.HOTEL_APARTMENT}>Hotel Apartment</option>
                        <option value={PropertyType.CHALET}>Chalet</option>
                        <option value={PropertyType.FARM}>Farm</option>
                        <option value={PropertyType.OTHER}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نوع المعاملة" : "Transaction"}</label>
                      <select
                        value={listingTrans}
                        onChange={(e) => setListingTrans(e.target.value as TransactionType)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value={TransactionType.FOR_RENT}>For Rent</option>
                        <option value={TransactionType.FOR_SALE}>For Sale</option>
                        <option value={TransactionType.OFF_PLAN}>Off-Plan</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Location */}
              {wizardStep === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "البلدية / المدينة" : "Municipality"}</label>
                    <select
                      value={selectedMunicipality}
                      onChange={(e) => {
                        setSelectedMunicipality(e.target.value);
                        setSelectedArea("");
                      }}
                      className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                    >
                      <option value="">Select Municipality</option>
                      {locations.filter(l => l.type === "MUNICIPALITY" && l.isActive).map(muni => (
                        <option key={muni.id} value={muni.id}>{muni.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الحي / المنطقة" : "Area / District"}</label>
                    <select
                      value={selectedArea}
                      disabled={!selectedMunicipality}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg disabled:opacity-50"
                    >
                      <option value="">Select Area / District</option>
                      {locations.filter(l => l.parentId === selectedMunicipality && l.isActive).map(area => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 3: Specifications */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "السعر (ريال قطري)" : "Price (QAR)"}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        required
                        min="0"
                        value={listingPrice}
                        onChange={(e) => setListingPrice(e.target.value)}
                        placeholder="e.g. 10000"
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المساحة (متر مربع)" : "Area Size (SQM)"}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        required
                        min="0"
                        value={listingArea}
                        onChange={(e) => setListingArea(e.target.value)}
                        placeholder="e.g. 140"
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "غرف النوم" : "Bedrooms"}</label>
                      <select
                        value={listingBeds}
                        onChange={(e) => setListingBeds(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4+</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الحمامات" : "Bathrooms"}</label>
                      <select
                        value={listingBaths}
                        onChange={(e) => setListingBaths(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4+</option>
                      </select>
                    </div>
                  </div>

                  <h5 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-2 pt-2">
                    {isRtl ? "مواصفات قطرية إضافية" : "Qatar Specifications"}
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "سنة الإنجاز" : "Completion Year"}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1950"
                        max="2100"
                        value={listingCompletionYear}
                        onChange={(e) => setListingCompletionYear(e.target.value)}
                        placeholder="e.g. 2026"
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "حالة الفرش" : "Furnishing Status"}</label>
                      <select
                        value={listingFurnishingStatus}
                        onChange={(e) => setListingFurnishingStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="">{isRtl ? "غير محدد" : "Not specified"}</option>
                        <option value="FULLY_FURNISHED">{isRtl ? "مؤثث بالكامل" : "Fully Furnished"}</option>
                        <option value="SEMI_FURNISHED">{isRtl ? "مؤثث جزئياً" : "Semi Furnished"}</option>
                        <option value="UNFURNISHED">{isRtl ? "غير مؤثث" : "Unfurnished"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نوع الملكية" : "Tenure Type"}</label>
                      <select
                        value={listingTenureType}
                        onChange={(e) => setListingTenureType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="">{isRtl ? "غير محدد" : "Not specified"}</option>
                        <option value="FREEHOLD">{isRtl ? "تملك حر" : "Freehold"}</option>
                        <option value="USUFRUCT">{isRtl ? "حق الانتفاع" : "Usufruct"}</option>
                        <option value="LOCAL_OWNERSHIP_ONLY">{isRtl ? "تملك للمواطنين فقط" : "Local Ownership Only"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المرافق مشمولة" : "Utilities Included"}</label>
                      <select
                        value={listingUtilitiesIncluded}
                        onChange={(e) => setListingUtilitiesIncluded(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="">{isRtl ? "غير محدد" : "Not specified"}</option>
                        <option value="YES">{isRtl ? "نعم" : "Yes"}</option>
                        <option value="NO">{isRtl ? "لا" : "No"}</option>
                        <option value="PARTIAL">{isRtl ? "جزئياً" : "Partial"}</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "أقرب محطة مترو" : "Nearest Metro Station"}</label>
                      <select
                        value={listingMetroStation}
                        onChange={(e) => setListingMetroStation(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="">{isRtl ? "غير محدد" : "Not specified"}</option>
                        {DOHA_METRO_STATIONS.map(station => (
                          <option key={station} value={station}>{station}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "دقائق المشي للمترو" : "Walking Minutes to Metro"}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={listingMetroWalkingMinutes}
                        onChange={(e) => setListingMetroWalkingMinutes(e.target.value)}
                        placeholder="e.g. 5"
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نوع مواقف السيارات" : "Parking Type"}</label>
                      <select
                        value={listingParkingType}
                        onChange={(e) => setListingParkingType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
                      >
                        <option value="">{isRtl ? "غير محدد" : "Not specified"}</option>
                        <option value="COVERED">{isRtl ? "مغطى" : "Covered"}</option>
                        <option value="UNCOVERED">{isRtl ? "مكشوف" : "Uncovered"}</option>
                        <option value="GARAGE">{isRtl ? "كراج" : "Garage"}</option>
                        <option value="NONE">{isRtl ? "لا يوجد" : "None"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "عدد مواقف السيارات" : "Parking Spaces"}</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={listingParkingSpaces}
                        onChange={(e) => setListingParkingSpaces(e.target.value)}
                        placeholder="e.g. 2"
                        className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المرافق (مفصولة بفاصلة)" : "Amenities (Comma separated)"}</label>
                    <input
                      type="text"
                      value={listingAmenities}
                      onChange={(e) => setListingAmenities(e.target.value)}
                      placeholder="e.g. Pool, Gym, Parking, Balcony"
                      className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Photos */}
              {wizardStep === 4 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-[#6e6b66]">{isRtl ? "صور العقار (تحميل متعدد)" : "Property Photos (Multi-upload)"}</label>
                    <span className={`text-xs font-semibold ${listingImages.length >= MAX_LISTING_IMAGES ? "text-red-600" : "text-[#6e6b66]"}`}>
                      {listingImages.length} / {MAX_LISTING_IMAGES} {isRtl ? "صورة" : "photos"}
                    </span>
                  </div>
                  {listingImages.length >= MAX_LISTING_IMAGES ? (
                    <div className="border-2 border-dashed border-red-200 rounded-xl p-6 text-center bg-red-50">
                      <AlertTriangle className="mx-auto text-red-500" size={28} />
                      <p className="text-sm font-medium text-red-700 mt-2">
                        {isRtl
                          ? "الحد الأقصى 14 صورة لكل إعلان — قم بإزالة صورة لإضافة أخرى."
                          : "Maximum 14 photos per listing reached — remove one to add another."}
                      </p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-[#e6e2de] hover:border-[#bf9b30] rounded-xl p-6 text-center cursor-pointer bg-white transition-colors relative">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleMediaUpload}
                        disabled={uploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-2">
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#bf9b30]" size={28} />
                            <p className="text-sm font-medium text-[#6e6b66]">{isRtl ? "جاري رفع الصور..." : "Uploading images..."}</p>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="mx-auto text-gray-400" size={32} />
                            <p className="text-sm font-medium text-[#1a1918]">
                              {isRtl ? "اضغط هنا لتحميل صور متعددة" : "Click here to upload multiple images"}
                            </p>
                            <p className="text-xs text-[#6e6b66]">
                              {isRtl ? "يدعم ملفات JPG, PNG وغيرها" : "Supports JPG, PNG etc."}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {listingImages.length > 0 && (
                    <>
                      <p className="text-[10px] text-[#6e6b66] mt-3">
                        {isRtl
                          ? "استخدم الأسهم لإعادة ترتيب الصور - الصورة الأولى هي الصورة الرئيسية للإعلان."
                          : "Use the arrows to reorder photos - the first photo is the listing's main cover image."}
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-2">
                        {listingImages.map((imgUrl, index) => (
                          <div key={imgUrl + index} className="relative group aspect-square rounded-lg overflow-hidden border border-[#e6e2de] bg-[#fdfdfc] shadow-2xs">
                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                            {index === 0 && (
                              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-[#1a1918]/80 text-white text-[8px] font-bold rounded">
                                {isRtl ? "الرئيسية" : "COVER"}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeUploadedImage(index)}
                              className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            >
                              <Trash2 size={12} />
                            </button>
                            <div className="absolute top-1 left-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                type="button"
                                onClick={() => moveListingImage(index, -1)}
                                disabled={index === 0}
                                className="p-0.5 bg-white/90 hover:bg-white text-[#1a1918] rounded shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isRtl ? "تحريك للأعلى" : "Move earlier"}
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveListingImage(index, 1)}
                                disabled={index === listingImages.length - 1}
                                className="p-0.5 bg-white/90 hover:bg-white text-[#1a1918] rounded shadow-md cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isRtl ? "تحريك للأسفل" : "Move later"}
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 5: Description & Review */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "شرح وتفاصيل الإعلان" : "Property Details & Descriptions"}</label>
                    <textarea
                      rows={3}
                      required
                      value={listingDesc}
                      onChange={(e) => setListingDesc(e.target.value)}
                      placeholder="Provide comprehensive details about amenities, location near schools, views..."
                      className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                    ></textarea>
                  </div>

                  {(() => {
                    const muniItem = locations.find(l => l.id === selectedMunicipality);
                    const areaItem = locations.find(l => l.id === selectedArea);
                    return (
                      <div className="border-t border-[#f2ede8] pt-4 space-y-3">
                        <h5 className="font-serif text-sm font-bold text-[#1a1918]">
                          {isRtl ? "مراجعة الإعلان قبل النشر" : "Review Before Publishing"}
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 bg-[#fbfaf8] border border-[#e6e2de] rounded-lg p-4">
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "العنوان" : "Title"}</span>
                            <span className="font-bold text-[#1a1918] sm:block">{listingTitle || "-"}</span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "النوع / المعاملة" : "Type / Transaction"}</span>
                            <span className="font-bold text-[#1a1918] sm:block">{listingType} • {listingTrans}</span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "الموقع" : "Location"}</span>
                            <span className="font-bold text-[#1a1918] sm:block">
                              {(muniItem?.name || "Doha")}{areaItem ? ` › ${areaItem.name}` : ""}
                            </span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "السعر" : "Price"}</span>
                            <span className="font-bold text-[#bf9b30] sm:block">{listingPrice ? `${Number(listingPrice).toLocaleString()} QAR` : "-"}</span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "المواصفات" : "Specs"}</span>
                            <span className="font-bold text-[#1a1918] sm:block">
                              {listingArea || "-"} SQM • {listingBeds} {isRtl ? "غرف" : "bed"} • {listingBaths} {isRtl ? "حمام" : "bath"}
                            </span>
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="text-[#6e6b66]">{isRtl ? "الصور" : "Photos"}</span>
                            <span className="font-bold text-[#1a1918] sm:block">{listingImages.length} / {MAX_LISTING_IMAGES}</span>
                          </div>
                          {(listingCompletionYear || listingFurnishingStatus || listingTenureType || listingUtilitiesIncluded || listingMetroStation || listingParkingType) && (
                            <div className="sm:col-span-2 pt-2 border-t border-[#e6e2de] text-[10px] text-[#6e6b66] space-y-0.5">
                              {listingCompletionYear && <p>{isRtl ? "سنة الإنجاز" : "Completion Year"}: {listingCompletionYear}</p>}
                              {listingFurnishingStatus && <p>{isRtl ? "حالة الفرش" : "Furnishing"}: {listingFurnishingStatus}</p>}
                              {listingTenureType && <p>{isRtl ? "نوع الملكية" : "Tenure"}: {listingTenureType}</p>}
                              {listingUtilitiesIncluded && <p>{isRtl ? "المرافق" : "Utilities Included"}: {listingUtilitiesIncluded}</p>}
                              {listingMetroStation && <p>{isRtl ? "المترو" : "Metro"}: {listingMetroStation}{listingMetroWalkingMinutes ? ` (${listingMetroWalkingMinutes} min walk)` : ""}</p>}
                              {listingParkingType && <p>{isRtl ? "المواقف" : "Parking"}: {listingParkingType}{listingParkingSpaces ? ` × ${listingParkingSpaces}` : ""}</p>}
                            </div>
                          )}
                        </div>
                        {listingImages.length > 0 && (
                          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                            {listingImages.map((imgUrl, index) => (
                              <div key={imgUrl + index} className="aspect-square rounded-md overflow-hidden border border-[#e6e2de]">
                                <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Wizard navigation */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f2ede8]">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={handleWizardBack}
                    className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    {isRtl ? "السابق" : "Back"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingListing(false)}
                    className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold cursor-pointer"
                  >
                    {isRtl ? "إلغاء" : "Cancel"}
                  </button>
                )}
                <div className="flex gap-2">
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setIsAddingListing(false)}
                      className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold cursor-pointer"
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
                    </button>
                  )}
                  {wizardStep < LISTING_WIZARD_STEPS.length ? (
                    <button
                      type="button"
                      onClick={handleWizardNext}
                      className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      {isRtl ? "التالي" : "Next"}
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer"
                    >
                      {isRtl ? "نشر الإعلان" : "Publish Listing"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map(prop => {
              // Availability refresh cycle: staleness is computed live from
              // lastConfirmedAvailableDate (falling back to createdDate for pre-existing
              // records), never stored - see getAvailabilityStaleDays() in types.ts.
              const staleDays = getAvailabilityStaleDays(prop.lastConfirmedAvailableDate || prop.createdDate);
              const isPausedForStaleness = prop.listingStatus === ListingStatus.PAUSED && !!prop.staleAutoPausedFromStatus;
              const isUnconfirmed = staleDays >= AVAILABILITY_UNCONFIRMED_DAYS;
              const isDueSoon = staleDays >= AVAILABILITY_CONFIRM_DUE_DAYS && staleDays < AVAILABILITY_UNCONFIRMED_DAYS;
              const confirmationDue = isPausedForStaleness || isUnconfirmed || isDueSoon;
              const isConfirming = confirmingAvailabilityId === prop.id;

              return (
                <div key={prop.id} className="p-4 bg-white border border-[#e6e2de] rounded-xl flex gap-4">
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                    <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500">{prop.listingId}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                        prop.verificationStatus === VerificationStatus.APPROVED ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {prop.verificationStatus}
                      </span>
                      {isPausedForStaleness ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-50 text-red-700 border border-red-200">
                          {isRtl ? "متوقف - يتطلب تأكيد التوفر" : "Paused - Needs Confirmation"}
                        </span>
                      ) : isUnconfirmed ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          {isRtl ? "التوفر غير مؤكد" : "Availability Unconfirmed"}
                        </span>
                      ) : isDueSoon ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#f2ede8] text-[#6e6b66] border border-[#e6e2de]">
                          {isRtl ? "يستحق التأكيد قريباً" : "Confirmation Due Soon"}
                        </span>
                      ) : null}
                    </div>
                    <h5 className="text-xs font-bold text-[#1a1918] truncate">{isRtl ? prop.titleAr : prop.title}</h5>
                    <p className="text-[10px] text-[#6e6b66]">{prop.district}, {prop.city}</p>
                    <p className="text-xs font-bold text-[#bf9b30]">{prop.price.toLocaleString()} QAR</p>
                    {/* FIX 8: real view counts (total / unique) for this listing */}
                    <p className="text-[9px] text-[#a9a49d] flex items-center gap-1">
                      <Eye size={10} /> {prop.views || 0} {isRtl ? "مشاهدة" : "views"} • {prop.uniqueViews || 0} {isRtl ? "فريدة" : "unique"}
                    </p>

                    {/* FIX 1: listing status control - Sold/Rented removes it from public search
                        immediately but it stays here with full history; can be reverted anytime. */}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <select
                        value={prop.listingStatus}
                        disabled={updatingStatusId === prop.id}
                        onChange={(e) => handleUpdateListingStatus(prop.id, e.target.value as ListingStatus)}
                        className="px-2 py-1 bg-[#fdfcfb] border border-[#e6e2de] rounded text-[10px] font-semibold text-[#1a1918] disabled:opacity-50"
                      >
                        <option value={ListingStatus.PUBLISHED}>{isRtl ? "متاح" : "Active/Available"}</option>
                        <option value={ListingStatus.PAUSED}>{isRtl ? "غير متاح" : "Unavailable"}</option>
                        <option value={ListingStatus.SOLD}>{isRtl ? "مباع" : "Sold"}</option>
                        <option value={ListingStatus.RENTED}>{isRtl ? "مؤجر" : "Rented"}</option>
                        <option value={ListingStatus.DRAFT}>{isRtl ? "مسودة" : "Draft"}</option>
                      </select>
                      {updatingStatusId === prop.id && <Loader2 size={10} className="animate-spin text-[#6e6b66]" />}
                      {prop.statusChangedDate && (
                        <span className="text-[9px] text-[#a9a49d]">
                          {isRtl ? "منذ " : "since "}{new Date(prop.statusChangedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* AGENCY_AGENT never self-triggers a boost - their agency admin does it on
                        their behalf from AgencyWorkspace, billed to the agency ledger. */}
                    {effectiveAgentType !== AgentType.AGENCY_AGENT && (
                      <BoostButton propertyId={prop.id} isRtl={isRtl} />
                    )}

                    {/* One-click "Confirm Still Available" - shown prominently when confirmation
                        is due soon/overdue or the listing was auto-paused for staleness, and
                        unobtrusively (small text link) otherwise. */}
                    <div>
                      <button
                        type="button"
                        onClick={() => handleConfirmAvailable(prop.id)}
                        disabled={isConfirming}
                        className={
                          confirmationDue
                            ? "mt-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            : "mt-1 px-1.5 py-0.5 text-[9px] text-[#6e6b66] hover:text-[#1a1918] underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        }
                      >
                        {isConfirming ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                        <span>{isRtl ? "تأكيد أن العقار لا يزال متاحاً" : "Confirm Still Available"}</span>
                      </button>
                      {prop.lastConfirmedAvailableDate && (
                        <p className="text-[9px] text-[#a9a49d] mt-0.5">
                          {isRtl
                            ? staleDays <= 0 ? "آخر تأكيد: اليوم" : `آخر تأكيد: منذ ${staleDays} يوم`
                            : `Confirmed ${staleDays <= 0 ? "today" : `${staleDays}d ago`}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REVIEWS & RATINGS TAB (FIX 10) */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#e6e2de] flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="text-center sm:text-left">
              <p className="text-3xl font-serif font-bold text-[#bf9b30]">{myReviewSummary?.average.toFixed(1) || "0.0"}</p>
              <p className="text-[10px] text-[#6e6b66]">{myReviewSummary?.count || 0} {isRtl ? "تقييم" : "reviews"}</p>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(star => {
                const count = myReviewSummary?.distribution?.[star] || 0;
                const total = myReviewSummary?.count || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-[10px]">
                    <span className="w-8 text-[#6e6b66]">{star}★</span>
                    <div className="flex-1 h-1.5 bg-[#f2ede8] rounded-full overflow-hidden">
                      <div className="h-full bg-[#bf9b30]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-[#6e6b66] text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
            <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "التقييمات المستلمة" : "Reviews Received"}</h4>
            </div>
            <div className="divide-y divide-[#f2ede8]">
              {myReviews.length === 0 ? (
                <p className="text-center py-8 text-[#6e6b66]">{isRtl ? "لا توجد تقييمات بعد." : "No reviews yet."}</p>
              ) : (
                myReviews.map(rev => (
                  <div key={rev.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1a1918]">{rev.reviewerName}</span>
                      <span className="text-[10px] text-[#6e6b66]">{new Date(rev.createdDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={12} className={s <= rev.rating ? "fill-[#bf9b30] text-[#bf9b30]" : "text-gray-200"} />
                      ))}
                    </div>
                    <p className="text-[#4c4943]">{rev.comment}</p>
                    {rev.reply ? (
                      <div className="pl-3 border-l-2 border-[#bf9b30]/40 bg-[#fbfaf8] p-2 rounded">
                        <p className="text-[10px] font-bold text-[#1a1918]">{isRtl ? "ردك" : "Your reply"}</p>
                        <p className="text-[11px] text-[#4c4943] mt-0.5">{rev.reply.text}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={replyDrafts[rev.id] || ""}
                          onChange={(e) => setReplyDrafts(prev => ({ ...prev, [rev.id]: e.target.value }))}
                          placeholder={isRtl ? "اكتب رداً علنياً..." : "Write a public reply..."}
                          className="flex-1 px-2 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleReplyToReview(rev.id)}
                          disabled={!replyDrafts[rev.id]?.trim()}
                          className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] disabled:opacity-40 text-white rounded-lg font-semibold cursor-pointer"
                        >
                          {isRtl ? "رد" : "Reply"}
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 text-xs">
          <div className="flex items-center gap-4 border-b border-[#f2ede8] pb-4">
            <div className="relative shrink-0">
              {currentAvatarUrl ? (
                <img src={currentAvatarUrl} alt={agent.fullName} className="w-16 h-16 rounded-full object-cover border border-[#e6e2de]" />
              ) : (
                <div className="w-16 h-16 bg-[#bf9b30] text-black font-bold text-xl rounded-full flex items-center justify-center">
                  {agent.fullName.charAt(0)}
                </div>
              )}
              <label
                htmlFor="agent-avatar-upload"
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1c1a17] hover:bg-[#bf9b30] text-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white"
                title={isRtl ? "تغيير الصورة الشخصية" : "Change profile picture"}
              >
                {avatarUploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              </label>
              <input
                id="agent-avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={avatarUploading}
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{agent.fullName}</h4>
              <p className="text-[10px] text-emerald-600 font-medium">✨ {isRtl ? "مستشار مرخص وموثق من شركة نيرو" : "Certified Platform Representative"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الاسم بالكامل" : "Representative Name"}</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم الاتصال المباشر" : "Direct Telephone"}</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم واتساب للأعمال" : "WhatsApp Business Number"}</label>
              <input
                type="tel"
                inputMode="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+97433334444"
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "اللغات" : "Spoken Languages"}</label>
              <input
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="Arabic, English"
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المناطق المتخصصة" : "Specialty Areas (Comma separated)"}</label>
            <input
              type="text"
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="Pearl Qatar, West Bay"
              className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
            />
          </div>

          <div>
            <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "النبذة التعريفية" : "Agent Professional Bio"}</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
            ></textarea>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#f2ede8]">
            <button
              type="submit"
              className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

      {activeTab === "profile" && (
        <form onSubmit={handleChangePassword} className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 text-xs">
          <div className="border-b border-[#f2ede8] pb-3 flex items-center gap-2">
            <Lock size={16} className="text-[#bf9b30]" />
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "تغيير كلمة المرور" : "Change Password"}</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "كلمة المرور الحالية" : "Current Password"}</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "كلمة المرور الجديدة" : "New Password"}</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>
            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[#f2ede8]">
            <button
              type="submit"
              disabled={passwordChanging}
              className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
            >
              {passwordChanging ? (isRtl ? "جارٍ التحديث..." : "Updating...") : (isRtl ? "تغيير كلمة المرور" : "Change Password")}
            </button>
          </div>
        </form>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#1c1a17] text-white p-4 rounded-xl shadow-2xl border border-[#bf9b30] flex items-center gap-3 animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-[#bf9b30] animate-ping" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
