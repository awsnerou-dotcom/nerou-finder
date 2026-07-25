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
  MapPin
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";

interface DeveloperWorkspaceProps {
  developer: Organization;
  onRefreshAll: () => void;
  isRtl: boolean;
}

export default function DeveloperWorkspace({ developer, onRefreshAll, isRtl }: DeveloperWorkspaceProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeTab, setActiveTab] = useState<"projects" | "inventory" | "leads" | "verification">("projects");

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

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
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerId: developer.id,
          name: projName,
          description: projDesc,
          city: finalCity,
          district: finalDistrict,
          status: projStatus,
          deliveryDate: projDate,
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
        fetchDeveloperContext();
        onRefreshAll();
        setToastMessage(isRtl ? "تمت إضافة المشروع الجديد بنجاح في المنصة وتحديث الدليل!" : "New master project catalogued and published successfully!");
        setTimeout(() => setToastMessage(""), 4000);
      }
    } catch (err) {
      console.error(err);
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
        <div className="flex bg-[#f2ede8] p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("projects")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "projects" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "المشاريع الكبرى" : "Master Projects"}
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "inventory" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "مخزون الوحدات" : "Units Inventory"}
          </button>
          <button
            onClick={() => setActiveTab("verification")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "verification" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "التوثيق" : "Verification"}
          </button>
        </div>
      </div>

      {/* VERIFICATION TAB */}
      {activeTab === "verification" && <VerificationDocumentsPanel isRtl={isRtl} />}

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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
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
