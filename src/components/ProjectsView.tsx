import React, { useState } from "react";
import { Sparkles, Building2, Calendar, MapPin, Download, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

interface ProjectsViewProps {
  isRtl: boolean;
}

export default function ProjectsView({ isRtl }: ProjectsViewProps) {
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryPhone, setInquiryPhone] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [success, setSuccess] = useState(false);

  const projects = [
    {
      id: "proj-1",
      name: "The Pearl-Qatar: Gewan Island Prestige",
      nameAr: "اللؤلؤة قطر: جزيرة جيوان المتميزة",
      developer: "United Development Company (UDC)",
      developerAr: "الشركة المتحدة للتنمية",
      location: "The Pearl-Qatar, Doha",
      locationAr: "اللؤلؤة قطر، الدوحة",
      price: "From 1,850,000 QAR",
      priceAr: "تبدأ من ١,٨٥٠,٠٠٠ ر.ق",
      delivery: "Q4 2027",
      deliveryAr: "الربع الرابع ٢٠٢٧",
      status: "UNDER_CONSTRUCTION",
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
      description: "Gewan Island is UDC's latest master plan project, featuring premium waterfront villas, crystal residences, and an air-conditioned outdoor promenade.",
      descriptionAr: "جزيرة جيوان هي أحدث مشروع رئيسي للشركة المتحدة للتنمية، حيث تضم فيلات فاخرة مطلة على الماء، ومساكن كريستال، وممشى خارجي مكيف الهواء.",
      amenities: ["Golf Course Access", "Beach Club", "Banana Park", "Climatic Promenade", "Marina Berths"]
    },
    {
      id: "proj-2",
      name: "Yasmeen City: Boulevard Residences",
      nameAr: "مدينة الياسمين: مساكن البوليفارد",
      developer: "Qatari Diar",
      developerAr: "الديار القطرية",
      location: "Yasmeen City, Lusail",
      locationAr: "مدينة الياسمين، لوسيل",
      price: "From 1,100,000 QAR",
      priceAr: "تبدأ من ١,١٠٠,٠٠٠ ر.ق",
      delivery: "Q2 2028",
      deliveryAr: "الربع الثاني ٢٠٢٨",
      status: "UNDER_CONSTRUCTION",
      image: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?auto=format&fit=crop&w=800&q=80",
      description: "A smart-city residential master plan situated in Lusail, Yasmeen City is designed as a sustainable district integrating schools, mosques, and retail greenery.",
      descriptionAr: "مشروع سكني رئيسي للمدينة الذكية يقع في لوسيل، وقد تم تصميم مدينة الياسمين كمنطقة مستدامة تدمج المدارس والمساجد والحدائق الخضراء للمحلات التجارية.",
      amenities: ["Integrated Smart Hub", "Tramway Stations", "Public Parks", "Rooftop Infinity Pools", "School District"]
    },
    {
      id: "proj-3",
      name: "Marina Waterfront Towers",
      nameAr: "أبراج الواجهة البحرية مارينا",
      developer: "Barwa Real Estate Group",
      developerAr: "مجموعة بروة العقارية",
      location: "Marina District, Lusail",
      locationAr: "منطقة المارينا، لوسيل",
      price: "From 2,400,000 QAR",
      priceAr: "تبدأ من ٢,٤٠٠,٠٠٠ ر.ق",
      delivery: "Q3 2026",
      deliveryAr: "الربع الثالث ٢٠٢٦",
      status: "NEAR_COMPLETION",
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      description: "Premium high-rise waterfront apartments in Lusail's bustling Marina district, featuring panoramic views of the Persian Gulf and bespoke smart automated interiors.",
      descriptionAr: "شقق شاهقة فاخرة على الواجهة البحرية في منطقة مارينا الصاخبة في لوسيل، وتتميز بإطلالات بانورامية على الخليج العربي وتصميمات داخلية ذكية ومؤتمتة بالكامل.",
      amenities: ["Private Yachts Berths", "24/7 Concierge", "Wellness Spa Center", "Private Theater Room", "Panoramic Lounges"]
    }
  ];

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
