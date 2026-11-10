import { describe, it, expect } from "vitest";
import { TERMS_EN, TERMS_AR, PRIVACY_EN, PRIVACY_AR, NEW_LEGAL_DOCUMENTS, upgradeSeededLegalDocuments } from "../../src/data/legalTexts.js";
import { COMPANY, companyCrLabel } from "../../src/companyInfo.js";
import type { LegalDocument } from "../../src/types.js";

const headings = (t: string) => t.split("\n").filter(l => /^\d{1,2}\.\s/.test(l) && l.length <= 90);
const bullets = (t: string) => t.split("\n").filter(l => l.startsWith("- "));

describe("the company's registration number", () => {
  it("is 209013 and is shown in both languages", () => {
    expect(COMPANY.crNumber).toBe("209013");
    expect(companyCrLabel(false)).toBe("Commercial Registration (CR) No. 209013");
    expect(companyCrLabel(true)).toBe("السجل التجاري رقم 209013");
  });
});

describe("Terms of Use and Privacy Policy say who we are", () => {
  it("name the company, its CR number, address and email in both languages", () => {
    for (const text of [TERMS_EN, PRIVACY_EN]) {
      expect(text).toContain(COMPANY.nameEn);
      expect(text).toContain("209013");
      expect(text).toContain(COMPANY.addressEn);
      expect(text).toContain(COMPANY.email);
    }
    for (const text of [TERMS_AR, PRIVACY_AR]) {
      expect(text).toContain(COMPANY.nameAr);
      expect(text).toContain("209013");
      expect(text).toContain(COMPANY.addressAr);
      expect(text).toContain(COMPANY.email);
    }
  });

  it("no longer use the old name", () => {
    for (const text of [TERMS_EN, TERMS_AR, PRIVACY_EN, PRIVACY_AR]) {
      expect(text).not.toMatch(/Nerou Property|نيرو العقارية/);
    }
  });
});

describe("the platform's role is stated plainly", () => {
  it("English: a listing-display platform that does not negotiate, mediate or take commissions", () => {
    expect(TERMS_EN).toMatch(/dedicated to displaying properties/);
    expect(TERMS_EN).toMatch(/does not negotiate/);
    expect(TERMS_EN).toMatch(/does not mediate/);
    expect(TERMS_EN).toMatch(/does not charge or receive any brokerage commission/);
    expect(TERMS_EN).toMatch(/not a party to any agreement/);
    expect(TERMS_EN).toMatch(/does not receive, hold or transfer money/);
    expect(PRIVACY_EN).toMatch(/do not negotiate, mediate or take commissions/);
  });

  it("Arabic: the same statements", () => {
    expect(TERMS_AR).toMatch(/تُعنى بعرض العقارات/);
    expect(TERMS_AR).toMatch(/لا تتفاوض/);
    expect(TERMS_AR).toMatch(/لا تتوسط/);
    expect(TERMS_AR).toMatch(/لا تتقاضى ولا تستلم أي عمولة وساطة/);
    expect(TERMS_AR).toMatch(/ليست طرفًا في أي اتفاق/);
    expect(TERMS_AR).toMatch(/لا تستلم أو تحتفظ بأو تحوّل أموالًا/);
    expect(PRIVACY_AR).toMatch(/لا نتفاوض ولا نتوسط ولا نتقاضى عمولات/);
  });

  it("is honest that advertisers pay platform fees, never a share of a deal", () => {
    expect(TERMS_EN).toMatch(/revenue only from the fees that advertisers pay/);
    expect(TERMS_EN).toMatch(/do not depend on whether any transaction takes place/);
    expect(TERMS_AR).toMatch(/الرسوم التي يدفعها المعلنون/);
  });

  it("tells visitors never to pay anything through the platform", () => {
    expect(TERMS_EN).toMatch(/never asks you to pay for a property/);
    expect(TERMS_AR).toMatch(/لا تطلب «نيرو» منك أبدًا دفع/);
  });
});

describe("structure: the two languages match and the headings run in order", () => {
  it("Terms of Use: 20 clauses in order, same number of headings and bullets in both languages", () => {
    for (const t of [TERMS_EN, TERMS_AR]) expect(headings(t).map(h => parseInt(h))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(bullets(TERMS_EN).length).toBe(bullets(TERMS_AR).length);
  });

  it("Privacy Policy: 15 sections in order, same number of headings and bullets in both languages", () => {
    for (const t of [PRIVACY_EN, PRIVACY_AR]) expect(headings(t).map(h => parseInt(h))).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(bullets(PRIVACY_EN).length).toBe(bullets(PRIVACY_AR).length);
  });

  it("the Privacy Policy covers what the platform really does", () => {
    for (const phrase of ["Law No. 13 of 2016", "AI search", "Call or WhatsApp", "Sales Desk", "verification", "Your rights"]) {
      expect(PRIVACY_EN.toLowerCase()).toContain(phrase.toLowerCase());
    }
    expect(PRIVACY_AR).toMatch(/رقم 13 لسنة 2016/);
    expect(PRIVACY_AR).toMatch(/مكتب المبيعات/);
    expect(PRIVACY_AR).toMatch(/حقوقك/);
  });
});

describe("replacing the old seeded documents", () => {
  const doc = (slug: string, version: string, lastUpdated: string): LegalDocument => ({
    id: `legal-${slug}`, slug, title: "t", titleAr: "ع", content: "old", contentAr: "قديم", version, effectiveDate: "2026-01-01",
    lastUpdated, status: "PUBLISHED", author: "Someone", legalReviewStatus: "APPROVED"
  });

  it("replaces the untouched old Terms of Use and Privacy Policy, keeping everything else", () => {
    const docs = [doc("terms-of-use", "1.2.0", "2026-07-20"), doc("privacy-policy", "1.5.0", "2026-07-20"), doc("cookie-policy", "1.1.0", "2026-07-20")];
    expect(upgradeSeededLegalDocuments(docs)).toBe(2);
    expect(docs[0]).toMatchObject({ id: "legal-terms-of-use", status: "PUBLISHED", version: "2.0.0", content: TERMS_EN, contentAr: TERMS_AR, legalReviewStatus: "PENDING" });
    expect(docs[1]).toMatchObject({ version: "2.0.0", content: PRIVACY_EN, contentAr: PRIVACY_AR });
    expect(docs[2].content).toBe("old");
  });

  it("never overwrites a document an admin has edited", () => {
    const edited = [doc("terms-of-use", "1.2.0", "2026-09-01"), doc("privacy-policy", "1.6.0", "2026-07-20")];
    expect(upgradeSeededLegalDocuments(edited)).toBe(0);
    expect(edited[0].content).toBe("old");
    expect(edited[1].content).toBe("old");
  });

  it("does nothing the second time", () => {
    const docs = [doc("terms-of-use", "1.2.0", "2026-07-20")];
    upgradeSeededLegalDocuments(docs);
    expect(upgradeSeededLegalDocuments(docs)).toBe(0);
    expect(docs[0].version).toBe(NEW_LEGAL_DOCUMENTS["terms-of-use"].version);
  });

  it("marks the new documents as not yet reviewed by a lawyer", () => {
    expect(NEW_LEGAL_DOCUMENTS["terms-of-use"].legalReviewStatus).toBe("PENDING");
    expect(NEW_LEGAL_DOCUMENTS["privacy-policy"].legalReviewStatus).toBe("PENDING");
  });
});
