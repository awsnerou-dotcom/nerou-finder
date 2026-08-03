import React, { useState, useEffect } from "react";
import { Sparkles, Building2, Calendar, MapPin, Download, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { Project, Organization } from "../types.js";

interface ProjectsViewProps {
  isRtl: boolean;
  organizations: Organization[];
}

export default function ProjectsView({ isRtl, organizations }: ProjectsViewProps) {
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [liveProjects, setLiveProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then(res => res.json())
      .then((data: Project[]) => setLiveProjects(data))
      .catch(e => console.error("Error fetching projects:", e));
  }, []);

  const developerProjects = liveProjects.map(proj => {
    const org = organizations.find(o => o.id === proj.developerId);
    const developerName = org?.name || "Verified Developer";
    const developerNameAr = org?.nameAr || developerName;
    return {
      id: proj.id,
      name: proj.name,
      nameAr: proj.nameAr || proj.name,
      developer: developerName,
      developerAr: developerNameAr,
      location: `${proj.district}, ${proj.city}`,
      locationAr: `${proj.district}، ${proj.city}`,
      price: "Contact for Pricing",
      priceAr: "تواصل معنا للأسعار",
      delivery: proj.deliveryDate || "TBD",
      deliveryAr: proj.deliveryDate || "قيد التحديد",
      status: proj.status,
      image: proj.images?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
      description: proj.description,
      descriptionAr: proj.description,
      amenities: []
    };
  });

  // Previously this concatenated three fabricated placeholder projects (using the real names
  // of actual Qatari developers - UDC, Qatari Diar, Barwa - none of which are registered on
  // this platform) with genuine API results, rendered indistinguishably from real listings.
  // Their "Download Brochure" inquiry form also silently submitted leads against a projectId
  // that doesn't exist in the database. Only real developer-submitted projects are shown now.
  const projects = developerProjects;

  const handleInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryPhone) return;
    
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          visitorName: inquiryName,
          visitorPhone: inquiryPhone,
          visitorEmail: inquiryEmail,
          message: `Inquiry about developer project: ${selectedProject.name}`,
          contactMethod: "EMAIL",
          source: "Developer Portal"
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setInquiryName("");
          setInquiryPhone("");
          setInquiryEmail("");
          setSelectedProject(null);
        }, 2500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
          <Building2 className="text-[#bf9b30]" size={24} />
          <span>{isRtl ? "مشاريع المطورين والمخططات الرئيسية" : "Developer Master Planned Projects"}</span>
        </h2>
        <p className="text-xs text-[#6e6b66] mt-1">
          {isRtl
            ? "استكشف أحدث مشاريع البيع على الخارطة والمجتمعات الفاخرة المخططة من كبار المطورين في قطر."
            : "Explore the latest premium off-plan developments and signature communities in Doha & Lusail."}
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#e6e2de]">
          <Building2 size={32} className="mx-auto text-[#e6e2de] mb-3" />
          <p className="text-sm font-semibold text-[#1a1918]">
            {isRtl ? "لا توجد مشاريع منشورة حالياً" : "No published projects yet"}
          </p>
          <p className="text-xs text-[#6e6b66] mt-1">
            {isRtl
              ? "يقوم المطورون الموثّقون حالياً بإعداد مخططاتهم الرئيسية. تحقق مرة أخرى قريباً."
              : "Verified developers are still setting up their master plans. Check back soon."}
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((proj) => (
          <div key={proj.id} className="bg-white border border-[#e6e2de] rounded-xl overflow-hidden hover:shadow-md transition-all flex flex-col justify-between">
            <div>
              <div className="relative h-48 bg-[#f2ede8]">
                <img src={proj.image} alt={proj.name} className="w-full h-full object-cover" />
                <span className="absolute top-3 right-3 bg-[#1c1a17] text-[#bf9b30] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                  {proj.status.replace("_", " ")}
                </span>
              </div>
              <div className="p-4 space-y-2">
                <span className="text-[10px] text-[#bf9b30] font-bold block uppercase tracking-wider">{isRtl ? proj.developerAr : proj.developer}</span>
                <h3 className="font-serif font-bold text-[#1a1918] text-base">{isRtl ? proj.nameAr : proj.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-[#6e6b66]">
                  <MapPin size={13} />
                  <span>{isRtl ? proj.locationAr : proj.location}</span>
                </div>
                <p className="text-xs text-[#6e6b66] line-clamp-3 mt-1 leading-relaxed">
                  {isRtl ? proj.descriptionAr : proj.description}
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-[#f2ede8] flex items-center justify-between">
              <div className="leading-tight">
                <span className="text-[9px] text-[#6e6b66] uppercase block">{isRtl ? "سعر البداية" : "STARTING FROM"}</span>
                <span className="text-xs font-bold text-[#1c1a17]">{isRtl ? proj.priceAr : proj.price}</span>
              </div>
              <button
                onClick={() => setSelectedProject(proj)}
                className="px-3 py-1.5 bg-[#1c1a17] text-white hover:bg-[#33302a] text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>{isRtl ? "تفاصيل واستفسار" : "Details & Inquire"}</span>
                <ChevronRight size={14} className={isRtl ? "rotate-180" : ""} />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* DETAIL MODAL */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#e6e2de] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-[#f2ede8] pb-3">
              <div>
                <span className="text-[10px] text-[#bf9b30] font-bold block uppercase tracking-wider">
                  {isRtl ? selectedProject.developerAr : selectedProject.developer}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#1a1918]">
                  {isRtl ? selectedProject.nameAr : selectedProject.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1.5 bg-gray-50 border border-[#e6e2de] rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#1a1918]">
              <div className="space-y-4">
                <img src={selectedProject.image} alt={selectedProject.name} className="w-full h-40 object-cover rounded-lg border border-[#e6e2de]" />
                <p className="leading-relaxed text-[#6e6b66]">
                  {isRtl ? selectedProject.descriptionAr : selectedProject.description}
                </p>

                <div className="bg-[#fcfbfa] p-3 rounded-lg border border-[#f2ede8] space-y-2">
                  <span className="font-bold text-[10px] text-[#bf9b30] uppercase block">{isRtl ? "المواصفات الرئيسية" : "Key Specifications"}</span>
                  <p>📍 {isRtl ? "الموقع: " : "Location: "} <strong>{isRtl ? selectedProject.locationAr : selectedProject.location}</strong></p>
                  <p>🗓 {isRtl ? "التسليم المتوقع: " : "Expected Delivery: "} <strong>{isRtl ? selectedProject.deliveryAr : selectedProject.delivery}</strong></p>
                  <p>💵 {isRtl ? "تبدأ من: " : "Price: "} <strong>{isRtl ? selectedProject.priceAr : selectedProject.price}</strong></p>
                </div>
              </div>

              {/* Inquiry block */}
              <div className="bg-[#fdfcfb] border border-[#e6e2de] p-4 rounded-xl space-y-3">
                <h4 className="font-serif font-bold text-sm text-[#1a1918] border-b border-[#f2ede8] pb-1">
                  {isRtl ? "احجز وحدتك أو حمل الكتيب" : "Request Brochure & Pricing"}
                </h4>
                {success ? (
                  <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-center space-y-2">
                    <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
                    <p className="font-bold text-xs">{isRtl ? "تم إرسال طلبك بنجاح!" : "Brochure Inquiry Submitted!"}</p>
                    <p className="text-[10px]">{isRtl ? "سيتواصل معك فريق مبيعات المطور مباشرة." : "The developer relations desk will contact you shortly."}</p>
                  </div>
                ) : (
                  <form onSubmit={handleInquiry} className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "الاسم الكامل" : "Full Name"}</label>
                      <input
                        type="text"
                        required
                        value={inquiryName}
                        onChange={(e) => setInquiryName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "رقم الجوال" : "Mobile Phone"}</label>
                      <input
                        type="tel"
                        required
                        value={inquiryPhone}
                        onChange={(e) => setInquiryPhone(e.target.value)}
                        placeholder="+974"
                        className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "البريد الإلكتروني" : "Email Address"}</label>
                      <input
                        type="email"
                        value={inquiryEmail}
                        onChange={(e) => setInquiryEmail(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-[#bf9b30] hover:bg-[#a68628] text-black font-bold text-xs rounded-lg uppercase tracking-wide cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>{isRtl ? "حمل الكتيب وتفاصيل الأسعار" : "Download Brochure & PDF"}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
