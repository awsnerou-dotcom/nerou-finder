/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Admin: how the site looks to search engines. Shows what pages exist for them (the landing pages
// built from real listings, in English and Arabic), which listings hurt their own ranking (thin
// text, few photos...), and the steps that only the site's owner can do (Google Search Console).

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Globe, RefreshCw, Search, Send, FileText, AlertTriangle, Copy } from "lucide-react";
import { Button } from "./ui/Button.js";
import { Spinner } from "./ui/Spinner.js";

interface Overview {
  origin: string;
  sitemap: string;
  indexNowKeyFile: string;
  listings: number;
  listingsWithIssues: number;
  issues: { id: string; title: string; problems: string[] }[];
  landingPages: number;
  duplicatePages: number;
  sitemapUrls: number;
  pages: { path: string; arPath: string; label: string; labelAr: string; listings: number; indexable: boolean; canonicalPath: string }[];
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong.");
  return body as T;
}

export default function SeoCenter({ isRtl }: { isRtl: boolean }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Overview>("/api/admin/seo/overview")); setError(""); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return error ? <p role="alert" className="p-6 text-sm text-danger">{error}</p> : <div className="p-10 flex justify-center"><Spinner /></div>;

  const host = new URL(data.origin).host;
  const submit = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await api<{ submitted: number }>("/api/admin/seo/indexnow", { method: "POST", body: "{}" });
      setNote({ text: t(`Sent ${r.submitted} page addresses to Bing, Yandex and the other search engines that accept them.`, `تم إرسال ${r.submitted} رابطًا إلى Bing وYandex ومحركات البحث الأخرى التي تقبلها.`) });
    } catch (e: any) { setNote({ text: e.message, bad: true }); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.sitemap); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard may be blocked */ }
  };

  const card = "bg-surface border border-border rounded-xl";
  const kpi = (label: string, value: string, warn?: boolean) => (
    <div className={`${card} p-3.5 ${warn ? "border-danger/40" : ""}`}>
      <p className={`text-[11px] font-semibold ${warn ? "text-danger" : "text-ink-muted"}`}>{label}</p>
      <p className="mt-1 font-serif text-xl font-semibold text-ink">{value}</p>
    </div>
  );

  return (
    <div className="space-y-5 text-xs" data-testid="seo-center">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink flex items-center gap-2"><Search size={18} className="text-gold" />{t("SEO Center", "مركز تحسين محركات البحث")}</h3>
          <p className="text-ink-muted mt-0.5 max-w-2xl">
            {t("Every page below is real HTML that search engines read without running any code, in English and Arabic, with its own title, text, structured data and links. Pages are built only from listings that exist.",
              "كل صفحة هنا هي HTML حقيقي تقرؤه محركات البحث بلا أي تشغيل لأكواد، بالإنجليزي والعربي، مع عنوانها ونصها وبياناتها المنظمة وروابطها. تُبنى الصفحات فقط من إعلانات موجودة فعلًا.")}
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={13} />} onClick={load}>{t("Refresh", "تحديث")}</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(t("Live listings", "إعلانات منشورة"), String(data.listings))}
        {kpi(t("Landing pages (per language)", "صفحات هبوط (لكل لغة)"), String(data.landingPages))}
        {kpi(t("Addresses in the sitemap", "روابط في خريطة الموقع"), String(data.sitemapUrls))}
        {kpi(t("Listings that need work", "إعلانات تحتاج تحسينًا"), String(data.listingsWithIssues), data.listingsWithIssues > 0)}
      </div>

      <section className={`${card} p-4 space-y-3`}>
        <h4 className="font-bold text-ink flex items-center gap-2"><Globe size={14} className="text-gold" />{t("Tell the search engines", "أخبر محركات البحث")}</h4>
        <ol className="space-y-3 list-decimal ps-5 text-ink">
          <li>
            <strong>{t("Google (do once, takes 5 minutes):", "جوجل (مرة واحدة، 5 دقائق):")}</strong>{" "}
            {t("add this site in Google Search Console, verify it, then submit the sitemap address below. Only the site's owner can do this with their Google account.",
              "أضف هذا الموقع في Google Search Console وأكّد ملكيته، ثم أرسل رابط خريطة الموقع أدناه. هذه الخطوة لا يقوم بها إلا مالك الموقع بحسابه في جوجل.")}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <code dir="ltr" className="px-2 py-1 rounded bg-canvas border border-border">{data.sitemap}</code>
              <Button size="sm" variant="outline" leftIcon={<Copy size={12} />} onClick={copy}>{copied ? t("Copied", "تم النسخ") : t("Copy", "نسخ")}</Button>
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-active underline"><ExternalLink size={12} />Search Console</a>
            </div>
          </li>
          <li>
            <strong>{t("Bing, Yandex and others:", "Bing وYandex وغيرها:")}</strong>{" "}
            {t("press the button to send all page addresses at once. Do it again after publishing new listings.", "اضغط الزر لإرسال كل الروابط دفعة واحدة. كرّر ذلك بعد نشر إعلانات جديدة.")}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <Button size="sm" leftIcon={<Send size={13} />} loading={busy} onClick={submit}>{t("Send all pages (IndexNow)", "إرسال كل الصفحات (IndexNow)")}</Button>
              <a href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-active underline"><ExternalLink size={12} />Bing Webmaster Tools</a>
            </div>
          </li>
          <li>
            <strong>{t("See what Google already knows:", "شاهد ما تعرفه جوجل الآن:")}</strong>{" "}
            <a href={`https://www.google.com/search?q=${encodeURIComponent(`site:${host}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold-active underline" dir="ltr"><ExternalLink size={12} />site:{host}</a>
          </li>
        </ol>
        {note && <p role="status" className={`p-2.5 rounded-lg ${note.bad ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>{note.text}</p>}
      </section>

      <section className={`${card} overflow-hidden`}>
        <h4 className="p-3 font-bold text-ink border-b border-border flex items-center gap-2"><FileText size={14} className="text-gold" />{t("Landing pages", "صفحات الهبوط")} <span className="text-ink-muted font-normal">({t(`${data.landingPages} in the sitemap`, `${data.landingPages} في خريطة الموقع`)}{data.duplicatePages > 0 ? t(` + ${data.duplicatePages} that repeat another page`, ` + ${data.duplicatePages} تكرر صفحة أخرى`) : ""})</span></h4>
        {data.pages.length === 0 ? (
          <p className="p-5 text-ink-muted">{t("No landing pages yet. They appear automatically as soon as a listing is published: one for each type, area and rent/sale combination that has listings.", "لا توجد صفحات هبوط بعد. تظهر تلقائيًا فور نشر أول إعلان: صفحة لكل تركيبة من النوع والمنطقة والإيجار/البيع فيها إعلانات.")}</p>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-canvas sticky top-0"><tr className="text-[10px] text-ink-muted uppercase">
                <th className="p-2.5 text-start">{t("Page", "الصفحة")}</th><th className="p-2.5 text-start">{t("Listings", "الإعلانات")}</th><th className="p-2.5 text-start">{t("For search engines", "لمحركات البحث")}</th><th className="p-2.5 text-start">{t("Open", "فتح")}</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-2">
                {data.pages.map(p => (
                  <tr key={p.path}>
                    <td className="p-2.5"><p className="font-semibold text-ink">{isRtl ? p.labelAr : p.label}</p><p dir="ltr" className="text-[10px] text-ink-muted">{p.path}</p></td>
                    <td className="p-2.5">{p.listings}</td>
                    <td className="p-2.5">
                      {p.indexable
                        ? <span className="inline-flex items-center gap-1 text-success font-bold"><CheckCircle2 size={12} />{t("In the sitemap", "في خريطة الموقع")}</span>
                        : <span className="text-ink-muted">{t("Same listings as", "نفس إعلانات")} <span dir="ltr">{p.canonicalPath}</span></span>}
                    </td>
                    <td className="p-2.5 space-x-2 rtl:space-x-reverse"><a href={p.path} target="_blank" rel="noopener noreferrer" className="text-gold-active underline">EN</a><a href={p.arPath} target="_blank" rel="noopener noreferrer" className="text-gold-active underline">AR</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <h4 className="p-3 font-bold text-ink border-b border-border flex items-center gap-2"><AlertTriangle size={14} className="text-gold" />{t("Listings that hold back their own ranking", "إعلانات تُضعف ترتيبها في البحث")} <span className="text-ink-muted font-normal">({data.listingsWithIssues})</span></h4>
        {data.issues.length === 0 ? (
          <p className="p-5 text-success flex items-center gap-1.5"><CheckCircle2 size={14} />{t("Every live listing has a good title, description and photos.", "كل إعلان منشور له عنوان ووصف وصور جيدة.")}</p>
        ) : (
          <ul className="divide-y divide-surface-2 max-h-[360px] overflow-y-auto">
            {data.issues.map(i => (
              <li key={i.id} className="p-3 space-y-1">
                <a href={`/properties/${i.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">{i.title}</a>
                <ul className="text-ink-muted list-disc ps-5">{i.problems.map(p => <li key={p}>{p}</li>)}</ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
