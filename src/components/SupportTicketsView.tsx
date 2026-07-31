import React, { useState, useEffect } from "react";
import { AlertCircle, Plus, Send, RefreshCw, MessageSquare, ShieldAlert, CheckCircle, Clock, LogIn, UserPlus } from "lucide-react";

interface SupportTicketsViewProps {
  isRtl: boolean;
  currentUser: any;
  onLoginTrigger?: () => void;
  onSignupTrigger?: () => void;
}

export default function SupportTicketsView({
  isRtl,
  currentUser,
  onLoginTrigger,
  onSignupTrigger
}: SupportTicketsViewProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  // Create form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("TECHNICAL");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const userEmail = currentUser?.email || "";
  const userName = currentUser?.fullName || "";
  const userId = currentUser?.id || "";

  useEffect(() => {
    if (currentUser) {
      fetchUserTickets();
    } else {
      setLoading(false);
    }
  }, [userEmail]);

  const fetchUserTickets = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/support/tickets", {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (res.ok) {
        // Server now scopes results to the authenticated caller already - no client-side
        // filtering needed (and no other user's tickets are ever sent to the browser).
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="bg-white p-8 md:p-12 rounded-xl border border-[#e6e2de] text-center max-w-lg mx-auto space-y-6 my-12 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
        <div className="w-16 h-16 bg-[#bf9b30]/10 border border-[#bf9b30]/30 text-[#bf9b30] rounded-full flex items-center justify-center mx-auto shadow-sm">
          <ShieldAlert size={28} />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-serif text-lg font-bold text-[#1a1918]">
            {isRtl ? "مطلوب تسجيل الدخول للبوابة" : "Partner Portal Access Required"}
          </h3>
          <p className="text-xs text-[#6e6b66] leading-relaxed">
            {isRtl
              ? "قم بتقديم التذاكر، مراقبة الاستفسارات العقارية، والتعاون مع فريق إدارة التشغيل. يرجى تسجيل الدخول أو إنشاء حساب جديد للوصول لمكتب الدعم الخاص بك."
              : "Submit tickets, monitor active properties inquiries, and collaborate with staff. Please log in or register a new profile to access your custom Support Desk."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            onClick={onLoginTrigger}
            className="px-5 py-2.5 bg-[#1c1a17] hover:bg-[#33302a] text-white text-xs font-bold rounded-lg uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogIn size={14} />
            <span>{isRtl ? "تسجيل دخول" : "Log In"}</span>
          </button>
          <button
            onClick={onSignupTrigger}
            className="px-5 py-2.5 bg-white border border-[#e6e2de] hover:bg-gray-50 text-[#1a1918] text-xs font-bold rounded-lg uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>{isRtl ? "شريك جديد" : "Sign Up"}</span>
          </button>
        </div>
      </div>
    );
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          userEmail,
          userName,
          category,
          priority,
          subject,
          description,
        })
      });

      if (res.ok) {
        showToast(isRtl ? "تم فتح تذكرة الدعم الفني بنجاح!" : "Support ticket opened successfully!");
        setSubject("");
        setDescription("");
        setIsCreating(false);
        fetchUserTickets();
      } else {
        showToast(isRtl ? "تعذر فتح تذكرة الدعم. يرجى المحاولة مرة أخرى." : "Failed to open the support ticket. Please try again.");
      }
    } catch (err) {
      console.error(err);
      showToast(isRtl ? "تعذر فتح تذكرة الدعم. يرجى المحاولة مرة أخرى." : "Failed to open the support ticket. Please try again.");
    }
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch(`/api/support/tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          message: replyText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setReplyText("");
        setSelectedTicket(data.ticket);
        showToast(isRtl ? "تم إرسال الرد الفني." : "Reply successfully transmitted.");
        fetchUserTickets();
      } else {
        showToast(isRtl ? "تعذر إرسال الرد. يرجى المحاولة مرة أخرى." : "Failed to send the reply. Please try again.");
      }
    } catch (err) {
      console.error(err);
      showToast(isRtl ? "تعذر إرسال الرد. يرجى المحاولة مرة أخرى." : "Failed to send the reply. Please try again.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1c1a17] border border-[#bf9b30] text-[#bf9b30] px-4 py-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-bounce">
          <AlertCircle size={14} />
          <span>{toast}</span>
        </div>
      )}

      <div className="flex justify-between items-center border-b border-[#f2ede8] pb-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1a1918] font-medium flex items-center gap-2">
            <MessageSquare className="text-[#bf9b30]" size={24} />
            <span>{isRtl ? "بطاقات الدعم والاستفسارات الفنية" : "Support Tickets Desk"}</span>
          </h2>
          <p className="text-xs text-[#6e6b66] mt-1">
            {isRtl
              ? "تابع طلبات الدعم الخاصة بك أو قم بفتح استفسار جديد بشأن الحساب، المعاملات، أو التوثيق."
              : "Track your active operations inquiries, regulatory audits, and ask technical staff directly."}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchUserTickets}
            className="p-1.5 bg-white border border-[#e6e2de] rounded-lg hover:bg-gray-50 text-[#6e6b66] cursor-pointer"
            title={isRtl ? "تحديث" : "Refresh"}
          >
            <RefreshCw size={14} />
          </button>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 bg-[#bf9b30] text-black text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-[#a68628] cursor-pointer"
            >
              <Plus size={14} />
              <span>{isRtl ? "فتح بطاقة جديدة" : "Open New Ticket"}</span>
            </button>
          )}
        </div>
      </div>

      {isCreating ? (
        <form onSubmit={handleSubmitTicket} className="bg-white p-5 border border-[#bf9b30]/30 rounded-xl space-y-4 text-xs">
          <h3 className="font-serif font-bold text-sm text-[#1a1918] border-b border-[#f2ede8] pb-1">
            {isRtl ? "تفاصيل تذكرة الدعم الفني" : "Describe Technical/Billing Issue"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "عنوان الموضوع" : "Subject Title"}</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={isRtl ? "مثال: مشكلة في مراجعة مستندات التوثيق" : "e.g. Issue reviewing regulatory credentials"}
                className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "الفئة" : "Category"}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                >
                  <option value="TECHNICAL">{isRtl ? "فني" : "Technical"}</option>
                  <option value="BILLING">{isRtl ? "الفواتير" : "Billing"}</option>
                  <option value="VERIFICATION">{isRtl ? "التوثيق والهوية" : "Verification"}</option>
                  <option value="REPORT_ABUSE">{isRtl ? "إبلاغ عن إساءة" : "Abuse Report"}</option>
                  <option value="OTHER">{isRtl ? "أخرى" : "Other"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "الأولوية" : "Priority"}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                >
                  <option value="LOW">{isRtl ? "منخفضة" : "Low"}</option>
                  <option value="MEDIUM">{isRtl ? "متوسطة" : "Medium"}</option>
                  <option value="HIGH">{isRtl ? "عالية" : "High"}</option>
                  <option value="URGENT">{isRtl ? "عاجلة جداً" : "Urgent"}</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#6e6b66] mb-1">{isRtl ? "وصف دقيق للمشكلة" : "Detailed Description"}</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isRtl ? "يرجى كتابة التفاصيل هنا لمساعدة موظفي الدعم لدينا..." : "Please give full details of your inquiry, licensing ID, or tenant status..."}
              className="w-full px-3 py-2 bg-[#fdfdfc] border border-[#e6e2de] rounded-lg focus:outline-none font-sans"
            ></textarea>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 bg-white border border-[#e6e2de] rounded-lg cursor-pointer"
            >
              {isRtl ? "إلغاء" : "Cancel"}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg cursor-pointer"
            >
              {isRtl ? "إرسال البطاقة" : "Transmit Support Request"}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* List queue */}
          <div className="md:col-span-1 border border-[#e6e2de] rounded-xl overflow-hidden divide-y divide-[#f2ede8] bg-white h-fit">
            <div className="bg-[#fdfcfb] p-3 border-b border-[#e6e2de] font-bold text-[#1a1918]">
              {isRtl ? "بطاقاتي المفتوحة والمغلقة" : "My Open Inquiries"}
            </div>
            {loading ? (
              <div className="p-8 text-center text-[#6e6b66]">{isRtl ? "جاري التحميل..." : "Querying..."}</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {isRtl ? "لا توجد بطاقات حالية." : "No active tickets found."}
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 cursor-pointer hover:bg-[#fcfbfa] transition-colors ${
                    selectedTicket?.id === t.id ? "bg-[#fcfbfa] border-l-4 border-[#bf9b30]" : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-[#1a1918] truncate max-w-[120px]">{t.subject}</span>
                    <span className={`px-1 rounded text-[8px] font-bold ${
                      t.priority === "URGENT" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"
                    }`}>{t.priority}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[#6e6b66]">
                    <span>{t.category}</span>
                    <span className={`font-semibold uppercase text-[9px] ${t.status === "OPEN" ? "text-red-600 animate-pulse" : "text-emerald-600"}`}>{t.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Details & Replies thread */}
          <div className="md:col-span-2">
            {selectedTicket ? (
              <div className="bg-[#fdfcfb] border border-[#e6e2de] p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-start border-b border-[#f2ede8] pb-3">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-[#1a1918]">{selectedTicket.subject}</h3>
                    <span className="text-[10px] text-[#6e6b66]">
                      {isRtl ? "رقم المرجع: " : "Ref: "} {selectedTicket.id} • Status: <strong className="text-[#bf9b30]">{selectedTicket.status}</strong>
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-white border border-[#e6e2de] rounded-full text-[9px] font-bold uppercase text-[#6e6b66]">
                    {selectedTicket.priority}
                  </span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto p-2 bg-white rounded-lg border border-[#f2ede8]">
                  <div className="bg-[#fcfbfa] p-3 rounded-lg border border-[#f2ede8] space-y-1">
                    <span className="font-bold text-[9px] text-[#1a1918] block">{userName} ({isRtl ? "العميل" : "Creator"})</span>
                    <p className="text-xs text-[#6e6b66] whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>

                  {selectedTicket.replies?.map((reply: any) => (
                    <div
                      key={reply.id}
                      className={`p-3 rounded-lg border ${
                        reply.senderRole === "PLATFORM_ADMIN"
                          ? "bg-amber-50/50 border-amber-100 ml-4"
                          : "bg-gray-50 border-gray-100 mr-4"
                      } space-y-1`}
                    >
                      <span className="font-bold text-[9px] text-[#1a1918] block">
                        {reply.senderName} ({reply.senderRole.replace("_", " ")})
                      </span>
                      <p className="text-xs text-[#6e6b66] whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>

                {selectedTicket.status !== "CLOSED" ? (
                  <form onSubmit={handleReplySubmit} className="space-y-2 pt-2">
                    <textarea
                      required
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={isRtl ? "اكتب ردك الدعم هنا..." : "Type your message to technical support here..."}
                      className="w-full px-3 py-2 bg-white border border-[#e6e2de] rounded-lg focus:outline-none"
                    ></textarea>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#bf9b30] text-black font-bold rounded-lg flex items-center gap-1 hover:bg-[#a68628] cursor-pointer"
                      >
                        <Send size={12} />
                        <span>{isRtl ? "إرسال الرد" : "Transmit Reply"}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 bg-gray-50 text-center text-gray-400 border border-gray-100 rounded-lg">
                    {isRtl ? "هذه التذكرة مغلقة." : "This support ticket has been closed by administration."}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-64 border border-dashed border-[#e6e2de] rounded-xl flex items-center justify-center text-[#6e6b66] p-8 text-center bg-white">
                {isRtl
                  ? "اختر بطاقة دعم فني من القائمة لعرض المحادثة والردود الرسمية من إدارة نيرو بروبرتي."
                  : "Select a support ticket from the side menu to view technical responses and official resolutions."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
