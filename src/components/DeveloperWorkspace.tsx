/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Organization, Project, Property, User, LocationItem } from "../types.js";
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
  Camera,
  Lock,
  Settings
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";

interface DeveloperWorkspaceProps {
  developer: Organization;
  onRefreshAll: () => void;
  isRtl: boolean;
}

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

export default function DeveloperWorkspace({ developer, onRefreshAll, isRtl }: DeveloperWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<"projects" | "inventory" | "leads" | "verification" | "profile">("projects");

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

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

  const getActingUserId = (): string => {
    const saved = localStorage.getItem("nerou_user");
    if (!saved) return "";
    try {
      return JSON.parse(saved)?.id || "";
    } catch {
      return "";
    }
  };

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
      const propRes = await fetch(`/api/properties?orgId=${developer.id}`);
      const propData = await propRes.json();
      setProperties(propData);
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
  const soldUnits = properties.filter(u => u.listingStatus === "SOLD").length;
  const availableUnits = properties.filter(u => u.listingStatus === "PUBLISHED" || u.listingStatus === "PENDING_REVIEW").length;

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Developer Header Profile */}
      <div className="bg-white p-6 rounded-xl border border-[#e6e2de] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-[#e6e2de] overflow-hidden bg-gray-50">
            <img src={developer.logoUrl} alt={developer.name} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-serif font-medium text-[#1a1918]">
              {isRtl ? developer.nameAr : developer.name}
            </h3>
            <p className="text-xs text-[#6e6b66]">
              {isRtl ? `المطور العقاري المعتمد • مساحة تتبع المشروعات الإنشائية` : `Licensed Master Developer • Asset & Project Management Workspace`}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#f2ede8] p-0.5 rounded-lg text-xs font-medium overflow-x-auto scrollbar-none max-w-full">
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "projects" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "المشاريع الكبرى" : "Master Projects"}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "inventory" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "مخزون الوحدات" : "Units Inventory"}
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "verification" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "التوثيق" : "Verification"}
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-2 md:py-1.5 rounded-md cursor-pointer transition-colors shrink-0 ${activeTab === "profile" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "الإعدادات" : "Profile"}
          </button>
        </div>
      </div>

      {/* VERIFICATION TAB */}
      {activeTab === "verification" && <VerificationDocumentsPanel isRtl={isRtl} />}

      {/* PROFILE / SETTINGS TAB */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveOrgProfile} className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 text-xs">
            <div className="flex items-center gap-4 border-b border-[#f2ede8] pb-4">
              <div className="relative shrink-0">
                {orgLogoUrl ? (
                  <img src={orgLogoUrl} alt={orgName} className="w-16 h-16 rounded-xl object-cover border border-[#e6e2de]" />
                ) : (
                  <div className="w-16 h-16 bg-[#bf9b30] text-black font-bold text-xl rounded-xl flex items-center justify-center">
                    {orgName.charAt(0)}
                  </div>
                )}
                <label
                  htmlFor="developer-logo-upload"
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1c1a17] hover:bg-[#bf9b30] text-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white"
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
                <h4 className="font-serif text-sm font-semibold text-[#1a1918] flex items-center gap-1.5">
                  <Settings size={14} className="text-[#bf9b30]" />
                  <span>{isRtl ? "ملف الشركة المطورة" : "Developer Company Profile"}</span>
                </h4>
                <p className="text-[10px] text-[#6e6b66] mt-0.5">{isRtl ? "قم بتحديث شعار الشركة وبيانات التواصل الرسمية." : "Update your company logo and official contact details."}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "اسم الشركة" : "Company Name"}</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم واتساب" : "WhatsApp Number"}</label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={orgWhatsapp}
                  onChange={(e) => setOrgWhatsapp(e.target.value)}
                  placeholder="+97433334444"
                  className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الموقع الإلكتروني" : "Website"}</label>
                <input
                  type="text"
                  value={orgWebsite}
                  onChange={(e) => setOrgWebsite(e.target.value)}
                  placeholder="https://"
                  className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#f2ede8]">
              <button
                type="submit"
                disabled={savingOrgProfile}
                className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer disabled:opacity-60"
              >
                {savingOrgProfile ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ ملف الشركة" : "Save Company Profile")}
              </button>
            </div>
          </form>

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
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "سجل المشاريع الإنشائية والتطويرية" : "Developer Master projects"}</h4>
            <button
              onClick={() => setIsAddingProject(!isAddingProject)}
              className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "إضافة مشروع جديد" : "Create Project"}</span>
            </button>
          </div>

          {isAddingProject && (
            <form onSubmit={handleCreateProject} className="bg-white p-5 rounded-xl border border-[#bf9b30]/30 space-y-4 max-w-xl text-xs animate-in slide-in-from-top duration-200">
              <h5 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-2">
                {isRtl ? "إدخال تفاصيل المشروع الجديد" : "Provide New Project Guidelines"}
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "اسم المشروع" : "Project Name"}</label>
                  <input
                    type="text"
                    required
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="e.g. Marina Heights Tower C"
                    className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "تاريخ التسليم المتوقع" : "Expected Handover"}</label>
                  <input
                    type="date"
                    value={projDate}
                    onChange={(e) => setProjDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "البلدية" : "Municipality"}</label>
                  <select
                    value={selectedMunicipality}
                    onChange={(e) => {
                      setSelectedMunicipality(e.target.value);
                      setSelectedArea("");
                    }}
                    className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                  >
                    <option value="">Select Municipality</option>
                    {locations.filter(l => l.type === "MUNICIPALITY" && l.isActive).map(muni => (
                      <option key={muni.id} value={muni.id}>{muni.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "المنطقة / الحي" : "Area / District"}</label>
                  <select
                    value={selectedArea}
                    disabled={!selectedMunicipality}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg disabled:opacity-50"
                  >
                    <option value="">Select Area / District</option>
                    {locations.filter(l => l.parentId === selectedMunicipality && l.isActive).map(area => (
                      <option key={area.id} value={area.id}>{area.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "حالة الإنشاءات" : "Construction Status"}</label>
                  <select
                    value={projStatus}
                    onChange={(e) => setProjStatus(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg"
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="COMPLETED">Completed / Ready</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "شرح ومواصفات المشروع" : "Project Summary & Pitch"}</label>
                <textarea
                  rows={3}
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Describe location conveniences, beach layout access..."
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg"
                ></textarea>
              </div>

              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "صور المشروع" : "Project Photos"}</label>
                <div className="border-2 border-dashed border-[#e6e2de] hover:border-[#bf9b30] rounded-xl p-6 text-center cursor-pointer bg-white transition-colors relative">
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
                        <Loader2 className="animate-spin text-[#bf9b30]" size={28} />
                        <p className="text-sm font-medium text-[#6e6b66]">{isRtl ? "جارٍ رفع الصور..." : "Uploading images..."}</p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="mx-auto text-gray-400" size={32} />
                        <p className="text-sm font-medium text-[#1a1918]">{isRtl ? "اضغط هنا لرفع عدة صور" : "Click here to upload multiple images"}</p>
                        <p className="text-xs text-[#6e6b66]">{isRtl ? "يدعم JPG، PNG وغيرها" : "Supports JPG, PNG etc."}</p>
                      </>
                    )}
                  </div>
                </div>
                {projectImages.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
                    {projectImages.map((imgUrl, index) => (
                      <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-[#e6e2de] bg-[#fdfdfc] shadow-2xs">
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

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingProject(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg"
                >
                  Create Master Catalog
                </button>
              </div>
            </form>
          )}

          {/* Project Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map(proj => (
              <div key={proj.id} className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="h-44 bg-gray-100 overflow-hidden relative">
                    <img src={proj.images[0]} alt={proj.name} className="w-full h-full object-cover" />
                    <span className="absolute top-3 left-3 bg-[#1a1918]/80 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                      {proj.status}
                    </span>
                  </div>

                  <div className="p-4 space-y-2 text-xs">
                    <div className="flex items-center gap-1 text-[#6e6b66]">
                      <MapPin size={13} />
                      <span>{proj.district}, {proj.city}</span>
                    </div>
                    <h5 className="font-serif text-base font-bold text-[#1a1918]">{isRtl ? proj.nameAr : proj.name}</h5>
                    <p className="text-[#6e6b66] leading-relaxed line-clamp-2">{proj.description}</p>
                  </div>
                </div>

                <div className="p-4 border-t border-[#f2ede8] flex justify-between items-center text-[11px] text-[#6e6b66]">
                  <span>Handover Target: <strong className="text-[#1a1918]">{proj.deliveryDate || "TBD"}</strong></span>
                  <span className="font-bold text-[#bf9b30]">{isRtl ? "عرض ملف البروشور" : "View PDF Brochure"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INVENTORY TAB */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Inventory Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#e6e2de] text-center text-xs">
              <span className="text-[#6e6b66] block mb-1">{isRtl ? "الوحدات الإجمالية" : "Total Catalogued Units"}</span>
              <strong className="text-xl text-[#1a1918]">{totalUnits}</strong>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#e6e2de] text-center text-xs">
              <span className="text-[#6e6b66] block mb-1">{isRtl ? "المباع" : "Sold out (Closed)"}</span>
              <strong className="text-xl text-green-600">{soldUnits}</strong>
            </div>
            <div className="bg-white p-4 rounded-xl border border-[#e6e2de] text-center text-xs">
              <span className="text-[#6e6b66] block mb-1">{isRtl ? "المتبقي المتاح" : "Available inventory"}</span>
              <strong className="text-xl text-blue-600">{availableUnits}</strong>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
            <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "قائمة الوحدات التفصيلية" : "Specific Units Specifications"}</h4>
            </div>
            <div className="divide-y divide-[#f2ede8]">
              {properties.length === 0 ? (
                <p className="p-8 text-center text-[#6e6b66]">{isRtl ? "لا توجد وحدات مسجلة تحت هذا المشروع." : "No units listed under this developer workspace yet."}</p>
              ) : (
                properties.map(unit => (
                  <div key={unit.id} className="p-4 flex justify-between items-center gap-3 flex-wrap">
                    <div>
                      <p className="font-bold text-[#1a1918]">{isRtl ? unit.titleAr : unit.title}</p>
                      <p className="text-[10px] text-[#6e6b66]">District: {unit.district} | {unit.bedrooms} Bed | {unit.area} SQM</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <BoostButton propertyId={unit.id} isRtl={isRtl} />
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold uppercase rounded shrink-0">
                        Available
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
