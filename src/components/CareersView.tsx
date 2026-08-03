import React, { useState, useEffect } from "react";
import { Briefcase, MapPin, Clock, ArrowRight, CheckCircle2, User, Mail, Phone, Upload, X } from "lucide-react";

interface CareersViewProps {
  isRtl: boolean;
}

export default function CareersView({ isRtl }: CareersViewProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [applicantName, setApplicantName] = useState("");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const [applicantCover, setApplicantCover] = useState("");
  const [applicantResume, setApplicantResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applyError, setApplyError] = useState("");
  const [applySubmitting, setApplySubmitting] = useState(false);

  const MAX_RESUME_BYTES = 5 * 1024 * 1024;

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setResumeError("");
    if (!file) {
      setApplicantResume(null);
      return;
    }
    if (file.type !== "application/pdf") {
      setResumeError(isRtl ? "يجب أن يكون الملف بصيغة PDF." : "File must be a PDF.");
      e.target.value = "";
      setApplicantResume(null);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setResumeError(isRtl ? "الحد الأقصى لحجم الملف هو ٥ ميجابايت." : "Maximum file size is 5MB.");
      e.target.value = "";
      setApplicantResume(null);
      return;
    }
    setApplicantResume(file);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/careers");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName || !applicantEmail || !applicantPhone) return;
    setApplyError("");
    setApplySubmitting(true);

    try {
      const formData = new FormData();
      formData.append("jobId", selectedJob.id);
      formData.append("applicantName", applicantName);
      formData.append("applicantEmail", applicantEmail);
      formData.append("applicantPhone", applicantPhone);
      formData.append("coverLetter", applicantCover);
      if (applicantResume) formData.append("resume", applicantResume);

      const res = await fetch("/api/careers/apply", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setApplicantName("");
          setApplicantEmail("");
          setApplicantPhone("");
          setApplicantCover("");
          setApplicantResume(null);
          setSelectedJob(null);
        }, 2500);
      } else {
        const data = await res.json().catch(() => null);
        setApplyError(
          data?.error ||
            (isRtl
              ? "تعذر إرسال طلبك. يرجى المحاولة مرة أخرى."
              : "We couldn't submit your application. Please try again.")
        );
      }
    } catch (err) {
      console.error(err);
      setApplyError(
        isRtl
          ? "تعذر إرسال طلبك. يرجى المحاولة مرة أخرى."
          : "We couldn't submit your application. Please try again."
      );
    } finally {
      setApplySubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-2xl font-serif text-ink font-medium flex items-center gap-2">
          <Briefcase className="text-gold" size={24} />
          <span>{isRtl ? "فرص التطوير المهني والوظائف" : "Careers & Opportunities"}</span>
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {isRtl
            ? "انضم إلى فريق خدمات نيرو التقنية وساعدنا في ريادة منصة نيرو فايندر لتكنولوجيا العقارات."
            : "Join Nerou Technology Services and build the state-of-the-art real estate discovery marketplace Nerou Finder."}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-ink-muted">{isRtl ? "جاري تحميل الفرص الوظيفية..." : "Loading career listings..."}</div>
      ) : jobs.length === 0 ? (
        <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl bg-surface p-8">
          <p className="font-semibold text-sm mb-1">{isRtl ? "لا توجد وظائف شاغرة حاليًا" : "No open positions right now"}</p>
          <p className="text-[11px] text-gray-400">{isRtl ? "يرجى التحقق لاحقًا لمعرفة المزيد من الشواغر." : "Please check back later or send an email to careers@nerou.qa"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="p-5 bg-surface border border-border rounded-xl hover:shadow-xs transition-shadow flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-ink">{isRtl && job.titleAr ? job.titleAr : job.title}</h3>
                    <p className="text-[10px] text-gold font-bold block uppercase tracking-wider">{isRtl && job.departmentAr ? job.departmentAr : job.department}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-canvas border border-surface-2 text-chrome text-[9px] font-bold rounded">
                    {isRtl && job.typeAr ? job.typeAr : job.type}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[10px] text-ink-muted">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} />
                    <span>{isRtl && job.locationAr ? job.locationAr : job.location}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{isRtl ? "فوري" : "Immediate Hiring"}</span>
                  </span>
                </div>

                <p className="text-xs text-ink-muted line-clamp-3 leading-relaxed">
                  {isRtl && job.descriptionAr ? job.descriptionAr : job.description}
                </p>

                {job.requirements && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-chrome block mb-1">{isRtl ? "المتطلبات الأساسية" : "Requirements"}</span>
                    <ul className="list-disc list-inside text-[11px] text-ink-muted space-y-0.5">
                      {((isRtl && job.requirementsAr) || job.requirements || []).slice(0, 3).map((req: string, i: number) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-surface-2 mt-4 flex justify-end">
                <button
                  onClick={() => setSelectedJob(job)}
                  className="px-3 py-1.5 bg-chrome text-white hover:bg-chrome-hover text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>{isRtl ? "قدم الآن" : "Apply to this role"}</span>
                  <ArrowRight size={13} className={isRtl ? "rotate-180" : ""} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* APPLICATION MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start border-b border-surface-2 pb-2">
              <div>
                <span className="text-[10px] text-gold font-bold uppercase tracking-wider block">
                  {isRtl ? selectedJob.departmentAr : selectedJob.department}
                </span>
                <h3 className="font-serif font-bold text-sm text-ink">
                  {isRtl ? selectedJob.titleAr : selectedJob.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
                aria-label={isRtl ? "إغلاق" : "Close"}
              >
                <X size={16} />
              </button>
            </div>

            {success ? (
              <div className="p-6 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 text-center space-y-2 text-xs">
                <CheckCircle2 className="mx-auto text-emerald-600" size={32} />
                <p className="font-bold">{isRtl ? "تم إرسال طلبك بنجاح!" : "Application Sent Successfully!"}</p>
                <p className="text-[10px] text-gray-500">{isRtl ? "سيتصل بك فريق التوظيف والموارد البشرية لدينا قريبًا." : "Our human resources desk will reach out if your profile matches our needs."}</p>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-3 text-xs text-ink">
                {applyError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[11px] font-medium">
                    {applyError}
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">{isRtl ? "الاسم الكامل" : "Full Name"}</label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-3 py-1.5 bg-ink-inverse border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">{isRtl ? "البريد الإلكتروني" : "Email Address"}</label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className="w-full px-3 py-1.5 bg-ink-inverse border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">{isRtl ? "رقم الهاتف" : "Phone Number"}</label>
                  <input
                    type="tel"
                    required
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-ink-inverse border border-border rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-ink-muted mb-1">{isRtl ? "رسالة التغطية" : "Cover Letter"}</label>
                  <textarea
                    rows={3}
                    value={applicantCover}
                    onChange={(e) => setApplicantCover(e.target.value)}
                    placeholder={isRtl ? "أخبرنا لماذا ترغب بالانضمام إلينا..." : "Introduce yourself briefly..."}
                    className="w-full px-3 py-1.5 bg-ink-inverse border border-border rounded-lg focus:outline-none"
                  ></textarea>
                </div>

                <div>
                  <label
                    htmlFor="resume-upload"
                    className="border border-dashed border-border hover:border-gold p-4 rounded-lg bg-ink-inverse text-center space-y-1 flex flex-col items-center cursor-pointer transition-colors"
                  >
                    <Upload className="mx-auto text-gold" size={16} />
                    <span className="text-[10px] block font-semibold">
                      {applicantResume
                        ? applicantResume.name
                        : isRtl ? "قم بتحميل السيرة الذاتية (PDF)" : "Upload CV/Resume (PDF)"}
                    </span>
                    <span className="text-[8px] text-gray-400 block">{isRtl ? "الحد الأقصى للملف: ٥ ميجابايت" : "Maximum file size: 5MB"}</span>
                  </label>
                  <input
                    id="resume-upload"
                    type="file"
                    accept="application/pdf"
                    onChange={handleResumeChange}
                    className="hidden"
                  />
                  {resumeError && (
                    <p className="text-[10px] text-red-600 mt-1">{resumeError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={applySubmitting}
                  className="w-full py-2 bg-gold hover:bg-gold-hover disabled:bg-[#dcc98a] disabled:cursor-not-allowed text-black font-bold text-xs rounded-lg uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
                >
                  {applySubmitting ? (
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>{isRtl ? "إرسال طلب التوظيف" : "Submit Job Application"}</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
