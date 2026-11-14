import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, ExternalLink, FileText, X } from "lucide-react";
import { documentKind, fetchPrivateFile, verificationDocumentUrl } from "../lib/documents.js";
import type { DocumentKind } from "../lib/documents.js";
import { Spinner } from "./ui/Spinner.js";

// Shows a private verification document inside the app, on top of the current screen, with a way
// back (Back button, X, Escape, or a tap outside). Opening the raw file in a new browser tab left
// people with no button to return, especially on a phone.
export default function DocumentViewer({ docId, fileUrl, title, isRtl, onClose }: {
  /** a verification document id... */
  docId?: string;
  /** ...or the API path of any other private file (for example a client's contract) */
  fileUrl?: string;
  title: string;
  isRtl: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<DocumentKind>("other");
  const [error, setError] = useState("");

  useEffect(() => {
    let revoke = "";
    let cancelled = false;
    setUrl(""); setError("");
    fetchPrivateFile(fileUrl || verificationDocumentUrl(docId || "")).then(r => {
      if (cancelled) return;
      if (r.ok === false) { setError(r.error); return; }
      revoke = URL.createObjectURL(r.blob);
      setKind(documentKind(r.blob.type));
      setUrl(revoke);
    });
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [docId, fileUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page behind should not scroll
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const Back = isRtl ? ArrowRight : ArrowLeft;
  const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer bg-white/10 hover:bg-white/20 text-white";

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 bg-black/60 border-b border-white/10 shrink-0">
        <button type="button" onClick={onClose} className={btn}>
          <Back size={15} />
          <span>{isRtl ? "رجوع" : "Back"}</span>
        </button>
        <p className="flex-1 min-w-0 truncate text-sm font-semibold text-white text-center">{title}</p>
        {url && (
          <>
            <a href={url} download={title.replace(/[^\w؀-ۿ-]+/g, "_")} className={btn} title={isRtl ? "تنزيل" : "Download"}>
              <Download size={15} />
              <span className="hidden sm:inline">{isRtl ? "تنزيل" : "Download"}</span>
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer" className={`${btn} hidden sm:inline-flex`} title={isRtl ? "فتح في تبويب جديد" : "Open in new tab"}>
              <ExternalLink size={15} />
            </a>
          </>
        )}
        <button type="button" onClick={onClose} aria-label={isRtl ? "إغلاق" : "Close"} className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {/* tapping the dark area outside the file also closes */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
        <div className="w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
          {error ? (
            <div className="text-center space-y-3 text-white">
              <FileText size={32} className="mx-auto opacity-60" />
              <p className="text-sm">{error}</p>
              <button type="button" onClick={onClose} className={btn}>{isRtl ? "رجوع" : "Back"}</button>
            </div>
          ) : !url ? (
            <div className="text-white"><Spinner /></div>
          ) : kind === "image" ? (
            <img src={url} alt={title} className="max-w-full max-h-full object-contain rounded-lg bg-white" />
          ) : kind === "pdf" ? (
            <iframe src={url} title={title} className="w-full h-full rounded-lg bg-white" />
          ) : (
            <div className="text-center space-y-3 text-white">
              <FileText size={32} className="mx-auto opacity-60" />
              <p className="text-sm">{isRtl ? "لا يمكن عرض هذا النوع من الملفات هنا." : "This file type can't be previewed here."}</p>
              <a href={url} download className={btn}><Download size={15} />{isRtl ? "تنزيل الملف" : "Download file"}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
