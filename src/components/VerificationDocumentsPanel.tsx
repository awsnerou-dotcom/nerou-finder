/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { VerificationDocument, User } from "../types.js";
import { UploadCloud, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, FileText, Building2 } from "lucide-react";

interface VerificationDocumentsPanelProps {
  isRtl: boolean;
  // Only relevant in the AGENT context - lets an INDEPENDENT_AGENT declare the licensed
  // agency they operate under, alongside their AGENCY_AUTHORIZATION_LETTER upload.
  agent?: User;
  onSaved?: () => void;
}

interface ChecklistResponse {
  context: "AGENT" | "AGENCY" | "DEVELOPER";
  required: string[];
  documents: VerificationDocument[];
  verificationStatus: string;
}

const DOC_LABELS: Record<string, { en: string; ar: string }> = {
  QID_FRONT: { en: "Qatar ID - Front", ar: "البطاقة الشخصية القطرية - الوجه الأمامي" },
  QID_BACK: { en: "Qatar ID - Back", ar: "البطاقة الشخصية القطرية - الوجه الخلفي" },
  PASSPORT: { en: "Passport (Expat Agents)", ar: "جواز السفر (للوكلاء الوافدين)" },
  AGENCY_AUTHORIZATION_LETTER: { en: "Agency Authorization Letter", ar: "خطاب تفويض من الوكالة" },
  COMMERCIAL_REGISTRATION: { en: "Commercial Registration", ar: "السجل التجاري" },
  TRADE_LICENSE: { en: "Trade License", ar: "الرخصة التجارية" },
  BROKERAGE_PERMIT: { en: "Brokerage Permit", ar: "تصريح الوساطة العقارية" },
  SIGNATORY_ID: { en: "Authorized Signatory ID", ar: "هوية المفوض بالتوقيع" },
  MUNICIPALITY_PROJECT_PERMIT: { en: "Municipality Project Permit", ar: "تصريح المشروع من البلدية" },
  LAND_OR_MASTER_DEVELOPER_AUTHORIZATION: { en: "Land / Master Developer Authorization", ar: "تفويض المطور الرئيسي / ملكية الأرض" },
  ESCROW_CONFIRMATION: { en: "Escrow Account Confirmation", ar: "تأكيد حساب الضمان" }
};

function statusBadge(status: string | undefined, isRtl: boolean) {
  const map: Record<string, { cls: string; icon: React.ReactNode; en: string; ar: string }> = {
    APPROVED: { cls: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 size={12} />, en: "Approved", ar: "موثق" },
    PENDING: { cls: "bg-amber-50 text-amber-700", icon: <Clock size={12} />, en: "Pending Review", ar: "قيد المراجعة" },
    REJECTED: { cls: "bg-rose-50 text-rose-700", icon: <XCircle size={12} />, en: "Rejected", ar: "مرفوض" },
    EXPIRED: { cls: "bg-orange-50 text-orange-700", icon: <AlertTriangle size={12} />, en: "Expired", ar: "منتهي الصلاحية" }
  };
  const entry = status && map[status] ? map[status] : { cls: "bg-gray-100 text-gray-500", icon: <FileText size={12} />, en: "Not Submitted", ar: "لم يتم الرفع" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${entry.cls}`}>
      {entry.icon}
      {isRtl ? entry.ar : entry.en}
    </span>
  );
}

export default function VerificationDocumentsPanel({ isRtl, agent, onSaved }: VerificationDocumentsPanelProps) {
  const [data, setData] = useState<ChecklistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [showOptionalPassport, setShowOptionalPassport] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [agencyNameDraft, setAgencyNameDraft] = useState(agent?.affiliatedAgencyName || "");
  const [savingAgencyName, setSavingAgencyName] = useState(false);

  useEffect(() => {
    setAgencyNameDraft(agent?.affiliatedAgencyName || "");
  }, [agent?.affiliatedAgencyName]);

  const handleSaveAgencyName = async () => {
    if (!agent) return;
    setSavingAgencyName(true);
    try {
      const res = await fetch(`/api/users/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ affiliatedAgencyName: agencyNameDraft })
      });
      if (res.ok) {
        showToast(isRtl ? "تم حفظ اسم الوكالة." : "Agency name saved.");
        onSaved?.();
      } else {
        showToast(isRtl ? "فشل حفظ اسم الوكالة." : "Failed to save agency name.");
      }
    } catch (e) {
      showToast(isRtl ? "فشل حفظ اسم الوكالة." : "Failed to save agency name.");
    } finally {
      setSavingAgencyName(false);
    }
  };

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchChecklist = async () => {
    try {
      const res = await fetch("/api/verification-documents/mine", { headers: authHeaders() });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleUpload = async (documentType: string, file: File) => {
    setUploadingType(documentType);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", headers: authHeaders(), body: formData });
      if (!uploadRes.ok) throw new Error("upload_failed");
      const uploadData = await uploadRes.json();
      const fileUrl = (uploadData.fileUrls || uploadData.urls || [])[0];
      if (!fileUrl) throw new Error("no_url");

      const submitRes = await fetch("/api/verification-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ documentType, fileUrl, expiryDate: expiryDrafts[documentType] || undefined })
      });
      if (submitRes.ok) {
        showToast(isRtl ? "تم رفع المستند بنجاح!" : "Document uploaded successfully!");
        fetchChecklist();
      } else {
        const err = await submitRes.json();
        showToast(err.error || (isRtl ? "فشل رفع المستند." : "Failed to submit document."));
      }
    } catch (e) {
      showToast(isRtl ? "فشل رفع المستند." : "Failed to upload document.");
    } finally {
      setUploadingType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-[#bf9b30]" size={28} />
      </div>
    );
  }

  if (!data) return null;

  const { required, documents, verificationStatus } = data;
  const findDoc = (type: string) => documents.find((d) => d.documentType === type);
  const isAgentContext = data.context === "AGENT";
  const passportDoc = isAgentContext ? findDoc("PASSPORT") : undefined;
  const showPassportRow = isAgentContext && (required.includes("PASSPORT") || !!passportDoc || showOptionalPassport);

  const renderRow = (type: string) => {
    const doc = findDoc(type);
    const label = DOC_LABELS[type] ? (isRtl ? DOC_LABELS[type].ar : DOC_LABELS[type].en) : type;
    const isUploading = uploadingType === type;

    return (
      <div key={type} className="p-4 bg-white border border-[#e6e2de] rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold text-[#1a1918]">{label}</p>
            {doc?.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#bf9b30] underline">
                {isRtl ? "عرض الملف الحالي" : "View current file"}
              </a>
            )}
          </div>
          {statusBadge(doc?.status, isRtl)}
        </div>

        {doc?.status === "REJECTED" && doc.rejectionReason && (
          <div className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-2">
            <strong>{isRtl ? "سبب الرفض: " : "Rejection reason: "}</strong>
            {doc.rejectionReason}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <input
            type="date"
            value={expiryDrafts[type] || ""}
            onChange={(e) => setExpiryDrafts((prev) => ({ ...prev, [type]: e.target.value }))}
            className="px-2 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg text-[10px] text-[#6e6b66]"
            title={isRtl ? "تاريخ انتهاء الصلاحية (اختياري)" : "Expiry date (optional)"}
          />
          <label className={`relative px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer border transition-colors ${isUploading ? "bg-gray-100 text-gray-400 border-gray-200" : "bg-[#1c1a17] hover:bg-[#bf9b30] text-white border-transparent"}`}>
            {isUploading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="animate-spin" size={12} />
                {isRtl ? "جارٍ الرفع..." : "Uploading..."}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <UploadCloud size={12} />
                {doc ? (isRtl ? "إعادة الرفع" : "Re-upload") : (isRtl ? "رفع الملف" : "Upload File")}
              </span>
            )}
            <input
              type="file"
              accept="image/*,application/pdf"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(type, file);
                e.target.value = "";
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
          </label>
        </div>

        {type === "AGENCY_AUTHORIZATION_LETTER" && agent && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[#f0eee9] mt-1">
            <Building2 size={14} className="text-[#6e6b66] shrink-0" />
            <input
              type="text"
              value={agencyNameDraft}
              onChange={(e) => setAgencyNameDraft(e.target.value)}
              placeholder={isRtl ? "اسم الوكالة العقارية المرخصة التي تعمل تحتها" : "Name of the licensed agency you operate under"}
              className="flex-1 min-w-[200px] px-2 py-1.5 bg-[#fdfcfb] border border-[#e6e2de] rounded-lg text-[10px] text-[#1a1918]"
            />
            <button
              type="button"
              onClick={handleSaveAgencyName}
              disabled={savingAgencyName || agencyNameDraft === (agent.affiliatedAgencyName || "")}
              className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[#1c1a17] hover:bg-[#bf9b30] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {savingAgencyName ? (isRtl ? "جارٍ الحفظ..." : "Saving...") : (isRtl ? "حفظ" : "Save")}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 flex-wrap ${verificationStatus === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div>
          <p className="text-xs font-bold text-[#1a1918]">
            {isRtl ? "حالة التوثيق الإجمالية" : "Overall Verification Status"}
          </p>
          <p className="text-[10px] text-[#6e6b66] mt-0.5">
            {verificationStatus === "APPROVED"
              ? (isRtl ? "تم توثيق حسابك بنجاح. جميع المستندات المطلوبة معتمدة." : "Your account is fully verified. All required documents are approved.")
              : (isRtl ? "يجب رفع واعتماد جميع المستندات المطلوبة لتوثيق الحساب." : "All required documents must be uploaded and approved to verify this account.")}
          </p>
        </div>
        {statusBadge(verificationStatus === "APPROVED" ? "APPROVED" : "PENDING", isRtl)}
      </div>

      {required.filter((t) => t !== "PASSPORT").map((type) => renderRow(type))}
      {showPassportRow && renderRow("PASSPORT")}
      {isAgentContext && !showPassportRow && (
        <button
          type="button"
          onClick={() => setShowOptionalPassport(true)}
          className="text-[10px] font-semibold text-[#bf9b30] underline cursor-pointer"
        >
          {isRtl ? "+ أنا وافد، أضف جواز السفر" : "+ I'm an expat agent, add my passport"}
        </button>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#1c1a17] text-white p-4 rounded-xl shadow-2xl border border-[#bf9b30] flex items-center gap-3 animate-slide-in">
          <div className="w-2 h-2 rounded-full bg-[#bf9b30] animate-ping" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
