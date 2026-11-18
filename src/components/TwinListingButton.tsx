/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { CopyPlus, Link2 } from "lucide-react";
import type { Property } from "../types.js";
import { isRentType, twinTransactionType } from "../lib/twinListing.js";
import { Modal } from "./ui/Modal.js";
import { Button } from "./ui/Button.js";

// A listing that is for sale can also be for rent (and the other way round). This button gives the other price and the platform copies
// everything else (photos, description, size, features, location) into a second listing, linked to the first: nothing is typed twice.

export default function TwinListingButton({ property, isRtl, onCreated }: { property: Property; isRtl: boolean; onCreated: (twin: Property) => void }) {
  const t = (en: string, ar: string) => (isRtl ? ar : en);
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [period, setPeriod] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const other = twinTransactionType(String(property.transactionType));
  if (property.twinId) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gold-active" title={t("This unit is offered both for sale and for rent", "هذه الوحدة معروضة للبيع وللإيجار")}>
        <Link2 size={14} />{t("Also offered the other way", "معروضة أيضاً بالصيغة الأخرى")}
      </span>
    );
  }
  if (!other) return null;

  const toRent = isRentType(String(other));
  const label = toRent ? t("Also for rent", "أضِفه للإيجار أيضاً") : t("Also for sale", "أضِفه للبيع أيضاً");

  const close = () => { if (!busy) { setOpen(false); setError(""); } };
  const submit = async () => {
    const n = Number(price.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) { setError(t("Enter a valid price.", "أدخل سعراً صحيحاً.")); return; }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(property.id)}/twin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ price: n, rentalPeriod: toRent ? period : undefined })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("Could not add the offer.", "تعذّرت إضافة العرض."));
      setOpen(false);
      setPrice("");
      onCreated(data.property as Property);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not add the offer.", "تعذّرت إضافة العرض."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg cursor-pointer transition-colors"
        title={t("Offer this same unit the other way without entering it again", "اعرض الوحدة نفسها بالصيغة الأخرى دون إدخالها من جديد")}
      >
        <CopyPlus size={14} />
        <span>{label}</span>
      </button>
      <Modal
        open={open}
        onClose={close}
        isRtl={isRtl}
        size="sm"
        title={toRent ? t("Also offer this unit for rent", "اعرض هذه الوحدة للإيجار أيضاً") : t("Also offer this unit for sale", "اعرض هذه الوحدة للبيع أيضاً")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>{t("Cancel", "إلغاء")}</Button>
            <Button onClick={submit} loading={busy}>{t("Add the offer", "إضافة العرض")}</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-[13px] text-ink-muted leading-relaxed">
            {t("Only the price is new. The photos, description, size, features and location are copied from this listing into a second one, linked to it.",
               "السعر وحده جديد. تُنسخ الصور والوصف والمساحة والمزايا والموقع من هذا العقار إلى عقار ثانٍ مرتبط به.")}
          </p>
          <label className="block text-[12px] font-semibold text-ink-muted space-y-1.5">
            {toRent ? t("Rent (QAR)", "الإيجار (ريال)") : t("Sale price (QAR)", "سعر البيع (ريال)")}
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={price}
              onChange={e => setPrice(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void submit(); }}
              placeholder={toRent ? "8,000" : "2,500,000"}
              className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-ink font-normal tabular-nums"
              dir="ltr"
            />
          </label>
          {toRent && (
            <label className="block text-[12px] font-semibold text-ink-muted space-y-1.5">
              {t("Rent is paid", "يُدفع الإيجار")}
              <select value={period} onChange={e => setPeriod(e.target.value as "MONTHLY" | "YEARLY")} className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm text-ink font-normal">
                <option value="MONTHLY">{t("Monthly", "شهرياً")}</option>
                <option value="YEARLY">{t("Yearly", "سنوياً")}</option>
              </select>
            </label>
          )}
          {error && <p role="alert" className="text-[12px] text-danger bg-danger-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
