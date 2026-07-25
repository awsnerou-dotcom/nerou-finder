/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Property, Lead, LeadStatus, User, PropertyType, TransactionType, VerificationStatus, LocationItem } from "../types.js";
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
  Loader2
} from "lucide-react";

interface AgentWorkspaceProps {
  agent: User;
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

export default function AgentWorkspace({ agent, onRefreshAll, isRtl }: AgentWorkspaceProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "leads" | "properties" | "profile">("dashboard");

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

  // Profile Edit States
  const [fullName, setFullName] = useState<string>(agent.fullName);
  const [phone, setPhone] = useState<string>(agent.phone);
  const [whatsapp, setWhatsapp] = useState<string>(agent.whatsapp || "");
  const [bio, setBio] = useState<string>(agent.bio || "");
  const [languages, setLanguages] = useState<string>(agent.languages?.join(", ") || "");
  const [specialties, setSpecialties] = useState<string>(agent.specialties?.join(", ") || "");

  // Listing Form States (Create Property)
  const [isAddingListing, setIsAddingListing] = useState<boolean>(false);
  const [listingTitle, setListingTitle] = useState<string>("");
  const [listingPrice, setListingPrice] = useState<string>("");
  const [listingType, setListingType] = useState<PropertyType>(PropertyType.APARTMENT);
  const [listingTrans, setListingTrans] = useState<TransactionType>(TransactionType.FOR_RENT);
  const [listingArea, setListingArea] = useState<string>("");
  const [listingBeds, setListingBeds] = useState<string>("2");
  const [listingBaths, setListingBaths] = useState<string>("2");
  
  // Dynamic Locations States
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedArea, setSelectedArea] = useState<string>("");

  const [listingDesc, setListingDesc] = useState<string>("");
  const [listingImages, setListingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [listingAmenities, setListingAmenities] = useState<string>("Pool, Gym, Parking");

  useEffect(() => {
    fetchLeadsAndProperties();
    // Load central dynamic locations list
    fetch("/api/locations")
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        // Default to Doha if exists
        const doha = data.find((l: any) => l.name === "Doha" && l.type === "MUNICIPALITY");
        if (doha) setSelectedMunicipality(doha.id);
      })
      .catch(e => console.error("Error loading locations:", e));
  }, [agent.id]);

  const fetchLeadsAndProperties = async () => {
    try {
      // Fetch leads assigned to this agent
      const leadsRes = await fetch(`/api/leads?agentId=${agent.id}`);
      const leadsData = await leadsRes.json();
      setLeads(leadsData);

      // Fetch properties uploaded/assigned to this agent
      const propRes = await fetch(`/api/properties?orgId=${agent.orgId}`);
      const propData = await propRes.json();
      // Filter those belonging to this agent if needed, or show organization properties
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
        headers: { "Content-Type": "application/json" },
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

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
      } else {
        const data = await res.json();
        alert(data.error || "Failed to upload images.");
      }
    } catch (err) {
      console.error("Media upload error:", err);
      alert("Failed to upload media files.");
    } finally {
      setUploading(false);
    }
  };

  const removeUploadedImage = (index: number) => {
    setListingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingTitle || !listingPrice || !listingDesc) return;

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
          orgId: agent.orgId || "org-agency-1",
          actorId: agent.id,
          actorName: agent.fullName,
          actorRole: agent.role
        })
      });

      if (res.ok) {
        setIsAddingListing(false);
        setListingTitle("");
        setListingPrice("");
        setListingArea("");
        setListingDesc("");
        setListingImages([]);
        setSelectedArea("");
        fetchLeadsAndProperties();
        onRefreshAll();
        setToastMessage(isRtl ? "تمت إضافة العقار بنجاح وبانتظار المراجعة والتوثيق!" : "Property listing successfully created and pending review/approval!");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error("Failed to add property listing", err);
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
            {isRtl ? `الوكيل النشط: ${agent.fullName} • رخصة ممارسة المهنة موثقة` : `Active Representative: ${agent.fullName} • Certified Professional Broker`}
          </p>
        </div>

        <div className="flex bg-[#f2ede8] p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "dashboard" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "لوحة القيادة" : "Stats Center"}
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "leads" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "العملاء المحتملون" : "Leads Panel"}
          </button>
          <button
            onClick={() => setActiveTab("properties")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "properties" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "عقاراتي" : "My Listings"}
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "profile" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "الحساب" : "My Profile"}
          </button>
        </div>
      </div>

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
          <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "إدارة وتتبع تواصل العملاء" : "Assigned Lead Lifecycle Funnel"}</h4>
          </div>
          <div className="divide-y divide-[#f2ede8] text-xs">
            {leads.length === 0 ? (
              <p className="text-center py-8 text-[#6e6b66]">{isRtl ? "لا توجد أي طلبات تواصل مسجلة." : "No leads assigned to you yet."}</p>
            ) : (
              leads.map(lead => (
                <div key={lead.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#1a1918] text-sm">{lead.visitorName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        lead.status === LeadStatus.NEW ? "bg-red-50 text-red-700 border border-red-200" :
                        lead.status === LeadStatus.CONTACTED ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "bg-green-50 text-green-700 border border-green-200"
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="text-[#6e6b66] space-y-0.5">
                      <p>📱 {lead.visitorPhone} | {lead.visitorEmail || "No Email Provided"}</p>
                      <p className="italic">"{lead.message}"</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateLeadStatus(lead.id, LeadStatus.CONTACTED)}
                      className="px-3 py-1 bg-white hover:bg-[#fbfaf8] border border-[#e6e2de] text-[#1a1918] font-medium rounded cursor-pointer"
                    >
                      {isRtl ? "تأكيد التواصل" : "Contacted"}
                    </button>
                    <button
                      onClick={() => handleUpdateLeadStatus(lead.id, LeadStatus.CONVERTED)}
                      className="px-3 py-1 bg-[#1a1918] hover:bg-[#bf9b30] text-white font-medium rounded cursor-pointer"
                    >
                      {isRtl ? "إتمام الصفقة" : "Mark Won"}
                    </button>
                  </div>
                </div>
              ))
            )}
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

          {isAddingListing && (
            <form onSubmit={handleAddListing} className="bg-white p-5 rounded-xl border border-[#bf9b30]/30 space-y-4 animate-in fade-in duration-200 text-xs">
              <h5 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-2">
                {isRtl ? "إدخال بيانات عقار جديد" : "Provide New Property Specifications"}
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "السعر (ريال قطري)" : "Price (QAR)"}</label>
                  <input
                    type="number"
                    required
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
                    required
                    value={listingArea}
                    onChange={(e) => setListingArea(e.target.value)}
                    placeholder="e.g. 140"
                    className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="col-span-1 md:col-span-2">
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "صور العقار (تحميل متعدد)" : "Property Photos (Multi-upload)"}</label>
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

                  {listingImages.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
                      {listingImages.map((imgUrl, index) => (
                        <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-[#e6e2de] bg-[#fdfdfc] shadow-2xs">
                          <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(index)}
                            className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

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

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingListing(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {properties.map(prop => (
              <div key={prop.id} className="p-4 bg-white border border-[#e6e2de] rounded-xl flex gap-4">
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">{prop.listingId}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                      prop.verificationStatus === VerificationStatus.APPROVED ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {prop.verificationStatus}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-[#1a1918] truncate">{isRtl ? prop.titleAr : prop.title}</h5>
                  <p className="text-[10px] text-[#6e6b66]">{prop.district}, {prop.city}</p>
                  <p className="text-xs font-bold text-[#bf9b30]">{prop.price.toLocaleString()} QAR</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 text-xs">
          <div className="flex items-center gap-4 border-b border-[#f2ede8] pb-4">
            <div className="w-16 h-16 bg-[#bf9b30] text-black font-bold text-xl rounded-full flex items-center justify-center">
              {agent.fullName.charAt(0)}
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
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg"
              />
            </div>

            <div>
              <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "رقم واتساب للأعمال" : "WhatsApp Business Number"}</label>
              <input
                type="text"
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
