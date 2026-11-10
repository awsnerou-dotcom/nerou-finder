import { describe, it, expect } from "vitest";
import { buildApplicantCards, matchesApplicantSearch } from "../../src/lib/applicants.js";
import type { ApplicantDoc } from "../../src/lib/applicants.js";

const user = (o: any) => ({ id: "u", email: "u@x.com", fullName: "U", phone: "", role: "AGENT", verificationStatus: "APPROVED", createdDate: "2026-01-01T00:00:00Z", ...o });
const org = (o: any) => ({ id: "o", name: "Org", type: "AGENCY", email: "o@x.com", phone: "", logoUrl: "", verificationStatus: "APPROVED", subscriptionPlanId: "", subscriptionExpiry: "", createdDate: "2026-01-01T00:00:00Z", ...o });
const doc = (o: Partial<ApplicantDoc>): ApplicantDoc => ({ id: "d", context: "AGENT", documentType: "QID_FRONT", status: "APPROVED", submittedDate: "2026-02-01T00:00:00Z", ...o });

describe("one card per applicant", () => {
  it("puts all of one person's documents on one card and keeps people apart", () => {
    const users = [user({ id: "a1", fullName: "Ali" }), user({ id: "a2", fullName: "Sara" })] as any;
    const cards = buildApplicantCards(
      [doc({ id: "1", userId: "a1" }), doc({ id: "2", userId: "a1", documentType: "QID_BACK" }), doc({ id: "3", userId: "a2" })],
      users, []
    );
    expect(cards).toHaveLength(2);
    expect(cards.find(c => c.name === "Ali")!.docs).toHaveLength(2);
    expect(cards.find(c => c.name === "Sara")!.docs).toHaveLength(1);
  });

  it("shows an agency's documents under the agency, with its admin as the contact", () => {
    const orgs = [org({ id: "o1", name: "Gulf Realty" })] as any;
    const users = [user({ id: "ad", role: "AGENCY_ADMIN", orgId: "o1", fullName: "Boss" })] as any;
    const [card] = buildApplicantCards([doc({ context: "AGENCY", orgId: "o1" })], users, orgs);
    expect(card.name).toBe("Boss");
    expect(card.org?.name).toBe("Gulf Realty");
    expect(card.user?.id).toBe("ad");
  });

  it("includes applicants who have not uploaded anything yet", () => {
    const users = [user({ id: "n1", fullName: "New", applicationStatus: "PENDING_APPROVAL" }), user({ id: "ok", fullName: "Done", applicationStatus: "ACTIVE" })] as any;
    const cards = buildApplicantCards([], users, []);
    expect(cards.map(c => c.name)).toEqual(["New"]);
    expect(cards[0].docs).toEqual([]);
    expect(cards[0].needsAction).toBe(true);
  });

  it("lists the ones that need review first, newest activity first", () => {
    const users = [user({ id: "a", fullName: "Approved" }), user({ id: "b", fullName: "Waiting" }), user({ id: "c", fullName: "Waiting newer" })] as any;
    const cards = buildApplicantCards([
      doc({ id: "1", userId: "a", status: "APPROVED", submittedDate: "2026-05-01T00:00:00Z" }),
      doc({ id: "2", userId: "b", status: "PENDING", submittedDate: "2026-03-01T00:00:00Z" }),
      doc({ id: "3", userId: "c", status: "PENDING", submittedDate: "2026-04-01T00:00:00Z" }),
    ], users, []);
    expect(cards.map(c => c.name)).toEqual(["Waiting newer", "Waiting", "Approved"]);
  });

  it("searches by name, email, mobile and company", () => {
    const [card] = buildApplicantCards([doc({ userId: "a1" })], [user({ id: "a1", fullName: "Ali Hassan", email: "ali@x.com", phone: "+974 5555" })] as any, []);
    expect(matchesApplicantSearch(card, "hassan")).toBe(true);
    expect(matchesApplicantSearch(card, "ALI@X")).toBe(true);
    expect(matchesApplicantSearch(card, "5555")).toBe(true);
    expect(matchesApplicantSearch(card, "nobody")).toBe(false);
    expect(matchesApplicantSearch(card, "  ")).toBe(true);
  });
});
