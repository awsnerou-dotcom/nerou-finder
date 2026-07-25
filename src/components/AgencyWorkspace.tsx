/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Organization, User, UserRole, AdCampaign, SubscriptionPlan, Lead, Property } from "../types.js";
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
  UserCheck
} from "lucide-react";
import VerificationDocumentsPanel from "./VerificationDocumentsPanel.js";
import BoostButton from "./BoostButton.js";

interface AgencyWorkspaceProps {
  agency: Organization;
  onRefreshAll: () => void;
  isRtl: boolean;
}

export default function AgencyWorkspace({ agency, onRefreshAll, isRtl }: AgencyWorkspaceProps) {
  const [agents, setAgents] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [activeTab, setActiveTab] = useState<"team" | "routing" | "campaigns" | "subscription" | "leads" | "verification">("team");
  const [invitations, setInvitations] = useState<any[]>([]);
  const [orgLeads, setOrgLeads] = useState<Lead[]>([]);
  const [orgProperties, setOrgProperties] = useState<Property[]>([]);

  // Local toast state
  const [toastMessage, setToastMessage] = useState<string>("");

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
  }, [agency.id]);

  const fetchAgencyContext = async () => {
    try {
      // Get all agents belonging to this organization
      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();
      const orgAgents = usersData.filter((u: User) => u.orgId === agency.id && u.role === UserRole.AGENT);
      setAgents(orgAgents);

      // Get invitations
      const invRes = await fetch(`/api/organizations/${agency.id}/invitations`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitations(invData);
      }

      // Get org leads
      const leadsRes = await fetch(`/api/leads?orgId=${agency.id}`);
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
      const propsRes = await fetch(`/api/properties?orgId=${agency.id}`);
      if (propsRes.ok) {
        setOrgProperties(await propsRes.json());
      }

      // Get subscriptions definitions
      const dbRes = await fetch("/api/health");
      const dbData = await dbRes.json();
      // Since subscriptionPlans are seeded in the DB, let's fetch them
      const plansRes = await fetch("/api/admin/audits"); // We can get the DB lists
    } catch (e) {
      console.error(e);
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

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campBudget || !campEndDate) return;

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const handleUpgradeSubscription = async (planId: string) => {
    setPaymentProcessing(true);
    setPaymentSuccess(false);

    // Simulate safe idempotent billing capture
    setTimeout(async () => {
      try {
        const res = await fetch("/api/organizations/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Agency Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-[#e6e2de] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl border border-[#e6e2de] overflow-hidden bg-gray-50">
            <img src={agency.logoUrl} alt={agency.name} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-serif font-medium text-[#1a1918]">
              {isRtl ? agency.nameAr : agency.name}
            </h3>
            <p className="text-xs text-[#6e6b66]">
              {isRtl ? `الرخصة العقارية رقم: RE-202611 • الحساب الفضي` : `Licence No: RE-202611 • Silver Agency Class Account`}
            </p>
          </div>
        </div>

        {/* Workspace tabs navigator */}
        <div className="flex flex-wrap bg-[#f2ede8] p-0.5 rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("team")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "team" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "فريق العمل" : "Agents Team"}
          </button>
          <button
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "leads" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "إدارة العملاء" : "Leads Panel"}
          </button>
          <button
            onClick={() => setActiveTab("routing")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "routing" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "توزيع العملاء" : "Lead Routing"}
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "campaigns" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "الحملات الإعلانية" : "Ad Campaigns"}
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${activeTab === "subscription" ? "bg-white text-[#1a1918]" : "text-[#6e6b66] hover:text-[#1a1918]"}`}
          >
            {isRtl ? "الاشتراكات SaaS" : "SaaS Billing"}
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

      {/* TEAM TAB */}
      {activeTab === "team" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Agents list */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
            <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "قائمة المستشارين العقاريين" : "Active Certified Brokers"}</h4>
            </div>
            <div className="divide-y divide-[#f2ede8] text-xs">
              {agents.map(agent => (
                <div key={agent.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f2ede8] font-bold text-xs flex items-center justify-center text-[#1a1918]">
                      {agent.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#1a1918]">{agent.fullName}</p>
                      <p className="text-[10px] text-[#6e6b66]">{agent.email} | Specialties: {agent.specialties?.join(", ")}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase rounded">
                    {isRtl ? "نشط" : "Online"}
                  </span>
                </div>
              ))}
            </div>

            {/* Pending Invitations Section */}
            <div className="p-4 bg-[#fdfcfb] border-t border-b border-[#e6e2de]">
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "دعوات الانضمام المعلقة" : "Pending Joining Invitations"}</h4>
            </div>
            <div className="divide-y divide-[#f2ede8] text-xs">
              {invitations.length === 0 ? (
                <p className="p-4 text-[#6e6b66] italic">{isRtl ? "لا توجد دعوات معلقة" : "No pending broker invitations."}</p>
              ) : (
                invitations.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#1a1918]">{inv.email}</p>
                      <p className="text-[10px] text-[#6e6b66]">
                        {isRtl ? "تاريخ الإرسال: " : "Sent: "} {new Date(inv.createdDate).toLocaleDateString()} • {isRtl ? "تنتهي في: " : "Expires: "} {new Date(inv.expiresDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-[9px] font-bold uppercase rounded">
                      {inv.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Invite broker */}
          <div className="bg-white p-5 rounded-xl border border-[#e6e2de] space-y-4 h-fit">
            <h4 className="font-serif text-base font-semibold text-[#1a1918]">{isRtl ? "دعوة وسيط عقاري جديد" : "Invite Licensed Broker"}</h4>
            <p className="text-[11px] text-[#6e6b66] leading-relaxed">
              {isRtl ? "أدخل البريد الإلكتروني للوسيط التابع للوكالة لإضافته إلى حساب مساحة العمل وترحيل العقارات والعملاء تلقائيًا." : "Send joining credentials to brokers. Once registered, they gain full assigned lead tracking privileges under your organization."}
            </p>
            <form onSubmit={handleInviteAgent} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] text-[#6e6b66] mb-1">{isRtl ? "اسم الوسيط" : "Broker Name"}</label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Faisal Hassan"
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#6e6b66] mb-1">{isRtl ? "البريد الإلكتروني" : "Email address"}</label>
                <input
                  type="email"
                  required
                  value={newAgentEmail}
                  onChange={(e) => setNewAgentEmail(e.target.value)}
                  placeholder="e.g. broker@elitegulf.qa"
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                {isRtl ? "إرسال دعوة انضمام" : "Send Invitation"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LEAD ROUTING TAB */}
      {activeTab === "routing" && (
        <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-6 max-w-2xl text-xs">
          <div>
            <h4 className="font-serif text-base font-semibold text-[#1a1918]">{isRtl ? "توزيع وتوجيه العملاء آليًا" : "SaaS Automated Lead Routing Policy"}</h4>
            <p className="text-[#6e6b66] mt-1 leading-relaxed">
              {isRtl ? "اختر السياسة الأنسب لتوجيه الاستفسارات ومعاينات واتساب الواردة إلى الوسطاء التابعين للوكالة تلقائيًا." : "Set target rules on how the system automatically distributes hot leads, viewing reservations, and whatsapp intents."}
            </p>
          </div>

          <div className="space-y-3">
            <label className="p-4 bg-[#fdfcfb] border border-[#bf9b30]/40 rounded-xl flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "ROUND_ROBIN"}
                onChange={() => setRoutingMethod("ROUND_ROBIN")}
                className="text-[#bf9b30] focus:ring-[#bf9b30]"
              />
              <div>
                <h5 className="font-bold text-[#1a1918]">{isRtl ? "التوزيع الدائري المتساوي (Round Robin)" : "Fair Round-Robin Cycle"}</h5>
                <p className="text-[11px] text-[#6e6b66] mt-0.5">{isRtl ? "يتم توجيه كل عميل جديد إلى الوسيط التالي في القائمة بالتناوب بشكل عادل." : "Every incoming client intent is routed sequentially to the next broker to maximize coverage parity."}</p>
              </div>
            </label>

            <label className="p-4 bg-white border border-[#e6e2de] rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "AREA_BASED"}
                onChange={() => setRoutingMethod("AREA_BASED")}
                className="text-[#bf9b30] focus:ring-[#bf9b30]"
              />
              <div>
                <h5 className="font-bold text-[#1a1918]">{isRtl ? "التوزيع الجغرافي حسب التخصص (Area-based)" : "Geographic Area Specialty"}</h5>
                <p className="text-[11px] text-[#6e6b66] mt-0.5">{isRtl ? "يتم إسناد العميل إلى الوسيط المتخصص في المنطقة الجغرافية التي يقع فيها العقار." : "Directly routing queries to brokers who listed Pearl Qatar or Lusail district specializations in profiles."}</p>
              </div>
            </label>

            <label className="p-4 bg-white border border-[#e6e2de] rounded-xl flex items-center gap-3 cursor-pointer hover:border-gray-300">
              <input
                type="radio"
                name="routing"
                checked={routingMethod === "PERFORMANCE"}
                onChange={() => setRoutingMethod("PERFORMANCE")}
                className="text-[#bf9b30] focus:ring-[#bf9b30]"
              />
              <div>
                <h5 className="font-bold text-[#1a1918]">{isRtl ? "التوزيع حسب الأداء والسرعة (Performance-based)" : "Broker Performance Priority"}</h5>
                <p className="text-[11px] text-[#6e6b66] mt-0.5">{isRtl ? "يتم توجيه العميل تلقائيًا إلى الوسيط صاحب أسرع معدل استجابة وأعلى نسبة تحويل صفقات." : "Routes leads preferentially to representatives displaying lower average lead processing times."}</p>
              </div>
            </label>
          </div>

          <button
            onClick={handleSaveRouting}
            className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg cursor-pointer"
          >
            {isRtl ? "حفظ سياسة التوجيه" : "Save Routing Setup"}
          </button>
        </div>
      )}

      {/* AD CAMPAIGNS TAB */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Self-service ad boosts (instant, no admin approval - independent of the campaign flow below) */}
          <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden">
            <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de]">
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "رفع فوري للإعلانات (بدون موافقة إدارية)" : "Self-Service Listing Boosts"}</h4>
              <p className="text-[10px] text-[#6e6b66] mt-0.5">
                {isRtl ? "متاح فقط للحسابات ذات الاشتراك النشط." : "Requires an active subscription. Charges are logged instantly to your Ad Billing Ledger."}
              </p>
            </div>
            <div className="divide-y divide-[#f2ede8] max-h-80 overflow-y-auto">
              {orgProperties.length === 0 ? (
                <p className="p-6 text-center text-[#6e6b66]">{isRtl ? "لا توجد عقارات مسجلة بعد." : "No listings found for this agency yet."}</p>
              ) : (
                orgProperties.map(prop => (
                  <div key={prop.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-bold text-[#1a1918] truncate">{isRtl ? prop.titleAr : prop.title}</p>
                      <p className="text-[10px] text-[#6e6b66]">{prop.district}, {prop.city}</p>
                    </div>
                    <BoostButton propertyId={prop.id} isRtl={isRtl} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "إعلانات العقارات المميزة والمدعومة" : "Promoted Listings Marketing campaigns"}</h4>
            <button
              onClick={() => setIsCreatingCampaign(!isCreatingCampaign)}
              className="px-3 py-1.5 bg-[#1a1918] hover:bg-[#bf9b30] text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "بدء حملة إعلانية" : "Launch Promotion"}</span>
            </button>
          </div>

          {isCreatingCampaign && (
            <form onSubmit={handleCreateCampaign} className="bg-white p-5 rounded-xl border border-[#bf9b30]/30 space-y-4 max-w-xl text-xs animate-in slide-in-from-top duration-200">
              <h5 className="font-serif text-sm font-bold text-[#1a1918] border-b border-[#f2ede8] pb-2">
                {isRtl ? "تفاصيل ترويج العقار المختار" : "Configure Promoted Campaign Parameters"}
              </h5>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "الميزانية الكلية (ريال قطري)" : "Total Campaign Budget (QAR)"}</label>
                  <input
                    type="number"
                    required
                    value={campBudget}
                    onChange={(e) => setCampBudget(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "تاريخ انتهاء الحملة" : "Target End Date"}</label>
                  <input
                    type="date"
                    required
                    value={campEndDate}
                    onChange={(e) => setCampEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#6e6b66] mb-1">{isRtl ? "نوع الإعلان والظهور" : "Ad Placement Class"}</label>
                <select
                  value={campType}
                  onChange={(e) => setCampType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg"
                >
                  <option value="FEATURED_LISTING">Featured Listing (Top of Grid / تمييز الإعلان في الصدر)</option>
                  <option value="SPONSORED_SEARCH">Sponsored Search (AI Recommended / مطابقة مفضلة بالذكاء الاصطناعي)</option>
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCampaign(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f2ede8] border border-[#e6e2de] rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] text-white font-semibold rounded-lg"
                >
                  Schedule and Submit
                </button>
              </div>
            </form>
          )}

          {/* Active Campaigns list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(camp => (
              <div key={camp.id} className="p-5 bg-white border border-[#e6e2de] rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-[#f2ede8] pb-2">
                  <span className="text-xs font-bold text-[#1c1a17] uppercase">{camp.type}</span>
                  <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold rounded">
                    {camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "المشاهدات" : "Impressions"}</span>
                    <span className="font-bold text-[#1a1918]">{camp.metrics.impressions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "النقرات" : "Clicks"}</span>
                    <span className="font-bold text-[#1a1918]">{camp.metrics.clicks}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6e6b66] block">{isRtl ? "الميزانية الكلية" : "Total Budget"}</span>
                    <span className="font-bold text-[#bf9b30]">{camp.budget} QAR</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LEADS PANEL TAB */}
      {activeTab === "leads" && (
        <div className="bg-white rounded-xl border border-[#e6e2de] overflow-hidden text-xs">
          <div className="p-4 bg-[#fdfcfb] border-b border-[#e6e2de] flex justify-between items-center">
            <div>
              <h4 className="font-serif text-sm font-semibold text-[#1a1918]">{isRtl ? "إدارة وتوزيع العملاء المحتملين" : "Leads Management Suite"}</h4>
              <p className="text-[11px] text-[#6e6b66] mt-0.5">{isRtl ? "عرض وإعادة تعيين العملاء المحتملين لوسطاء الوكالة يدوياً." : "Oversee team leads and reassign clients to optimize representative response times."}</p>
            </div>
            <span className="px-2.5 py-1 bg-[#1a1918] text-white text-[10px] font-bold rounded-full">
              {orgLeads.length} {isRtl ? "عملاء كلي" : "Total Leads"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fcfbfa] border-b border-[#e6e2de] text-[10px] text-[#6e6b66] uppercase tracking-wider">
                  <th className="p-4 font-semibold">{isRtl ? "العميل" : "Client / Contact"}</th>
                  <th className="p-4 font-semibold">{isRtl ? "العقار المستهدف" : "Target Property / Message"}</th>
                  <th className="p-4 font-semibold">{isRtl ? "الوسيط الحالي" : "Assigned Representative"}</th>
                  <th className="p-4 font-semibold">{isRtl ? "إعادة تعيين" : "Manual Reassignment"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2ede8]">
                {orgLeads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[#6e6b66] italic">
                      {isRtl ? "لا يوجد عملاء متاحين حالياً في هذا المكتب." : "No leads registered under this organization yet."}
                    </td>
                  </tr>
                ) : (
                  orgLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#fcfbfa]/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-sm text-[#1a1918]">{lead.visitorName}</div>
                        <div className="text-[10px] text-[#6e6b66] mt-0.5">{lead.visitorPhone} {lead.visitorEmail ? `• ${lead.visitorEmail}` : ""}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-[9px] rounded font-mono">
                          {lead.contactMethod}
                        </span>
                      </td>
                      <td className="p-4 max-w-xs">
                        <p className="font-semibold text-xs text-[#bf9b30] truncate">ID: {lead.propertyId || "General Inquiry"}</p>
                        <p className="text-[#6e6b66] mt-1 line-clamp-2 leading-relaxed">{lead.message}</p>
                        <span className="text-[9px] text-[#a8a4a0] block mt-1">{new Date(lead.createdDate || new Date()).toLocaleString()}</span>
                      </td>
                      <td className="p-4 font-medium text-[#1a1918]">
                        {agents.find((a) => a.id === lead.agentId)?.fullName || (
                          <span className="text-rose-500 font-bold italic">{isRtl ? "غير معين" : "Unassigned"}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={lead.agentId || ""}
                          onChange={(e) => handleReassignLead(lead.id, e.target.value)}
                          className="px-2 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg focus:outline-none focus:border-[#bf9b30] text-xs font-semibold cursor-pointer text-[#1a1918]"
                        >
                          <option value="">-- {isRtl ? "اختر وكيلاً" : "Assign Broker"} --</option>
                          {agents.map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.fullName}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION SaaS BILLING TAB */}
      {activeTab === "subscription" && (
        <div className="space-y-6">
          <div className="p-5 bg-[#1c1a17] text-white rounded-xl border border-[#33302a] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-[#bf9b30] font-bold uppercase tracking-wider block">{isRtl ? "الخطة النشطة الحالية" : "Current Active Plan Tier"}</span>
              <h4 className="font-serif text-lg font-bold">{isRtl ? "الخطة الفضية للمكاتب العقارية" : "SaaS Silver Broker Plan"}</h4>
              <p className="text-xs text-gray-400">{isRtl ? "تاريخ التجديد التلقائي: ٢٠ يوليو ٢٠٢٧" : "Idempotent subscription renewal: July 20, 2027"}</p>
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-bold border border-white/20">
              1,800 QAR <span className="text-xs font-normal">/ month</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl border border-[#e6e2de] space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-[10px] font-bold uppercase rounded">
                  <Zap size={11} />
                  <span>{isRtl ? "الخطة الأعلى المتاحة" : "Recommended Enterprise Plan"}</span>
                </div>
                <h4 className="font-serif text-lg font-bold text-[#1a1918]">{isRtl ? "الخطة الذهبية للمؤسسات والشركات الكبرى" : "Gold Enterprise Agency SaaS Plan"}</h4>
                <p className="text-xs text-[#6e6b66] leading-relaxed">
                  {isRtl ? "مناسبة للمكاتب والشركات الكبرى التي تمتلك أكثر من ١٠ وسطاء وتتطلع للوصول اللامحدود لإحصائيات السوق والذكاء الاصطناعي." : "Perfect for premium brokerage houses aiming to increase listing capacity up to 100 properties and expand active teams to 10 agents."}
                </p>

                <ul className="text-xs text-[#6e6b66] space-y-2 pt-2">
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

              <div className="pt-6 border-t border-[#f2ede8] flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-[#6e6b66] uppercase block">Monthly charge</span>
                  <span className="text-xl font-bold text-[#1a1918]">4,500 QAR</span>
                </div>

                <button
                  onClick={() => handleUpgradeSubscription("plan-developer")}
                  disabled={paymentProcessing}
                  className="px-5 py-2 bg-[#1c1a17] hover:bg-[#bf9b30] disabled:bg-gray-400 text-white font-bold rounded-lg text-xs uppercase tracking-wider cursor-pointer"
                >
                  {paymentProcessing ? "Processing safe capture..." : (isRtl ? "الترقية والدفع الآمن" : "Secure Payment Upgrade")}
                </button>
              </div>
            </div>

            <div className="bg-[#fdfcfb] p-6 rounded-xl border border-dashed border-[#e6e2de] flex flex-col items-center justify-center text-center space-y-3">
              <Award size={40} className="text-[#bf9b30]" />
              <h4 className="font-serif text-sm font-bold text-[#1a1918]">{isRtl ? "معايير سداد اشتراكات آمنة مائة بالمائة" : "Idempotent Transaction Gaurantee"}</h4>
              <p className="text-xs text-[#6e6b66] max-w-xs leading-relaxed">
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
