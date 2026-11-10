import type { Organization, User } from "../types.js";
import { ApplicationStatus, UserRole, VerificationStatus } from "../types.js";

// One entry per person/company that applied to the platform, gathering everything the admin needs
// about them in one place: who they are, the documents they sent, and where their application
// stands. Used by the admin "Verifications" screen to show one card per client.

export interface ApplicantDoc {
  id: string;
  context: string; // "AGENT" | "AGENCY" | "DEVELOPER"
  userId?: string;
  orgId?: string;
  documentType: string;
  status: string; // PENDING | APPROVED | REJECTED | EXPIRED
  submittedDate?: string;
  applicantName?: string;
  applicantEmail?: string;
  [k: string]: unknown;
}

export interface ApplicantCardData {
  key: string;
  context: string;
  name: string;
  email: string;
  user?: User; // the agent, or the agency/developer admin
  org?: Organization; // the agency/developer (also set for an agent who works under an agency)
  docs: ApplicantDoc[];
  needsAction: boolean;
  lastActivity: number;
}

const ADMIN_ROLES: string[] = [UserRole.AGENCY_ADMIN, UserRole.DEVELOPER_ADMIN];

function contextOfUser(u: User, orgs: Organization[]): { context: string; orgId?: string } {
  if (u.role === UserRole.AGENT) return { context: "AGENT" };
  const org = orgs.find(o => o.id === u.orgId);
  return { context: String(org?.type || (u.role === UserRole.DEVELOPER_ADMIN ? "DEVELOPER" : "AGENCY")), orgId: u.orgId };
}

export function buildApplicantCards(docs: ApplicantDoc[], users: User[], orgs: Organization[]): ApplicantCardData[] {
  const cards = new Map<string, ApplicantCardData>();

  const ensure = (context: string, userId?: string, orgId?: string, fallback?: { name?: string; email?: string }): ApplicantCardData => {
    const key = `${context}:${userId || orgId}`;
    let card = cards.get(key);
    if (card) return card;
    let user: User | undefined;
    let org: Organization | undefined;
    if (context === "AGENT") {
      user = users.find(u => u.id === userId);
      org = orgs.find(o => o.id === user?.orgId);
    } else {
      org = orgs.find(o => o.id === orgId);
      user = users.find(u => u.orgId === orgId && ADMIN_ROLES.includes(u.role));
    }
    card = {
      key,
      context,
      name: user?.fullName || org?.name || fallback?.name || "Unknown",
      email: user?.email || org?.email || fallback?.email || "",
      user,
      org,
      docs: [],
      needsAction: false,
      lastActivity: 0,
    };
    cards.set(key, card);
    return card;
  };

  for (const d of docs) {
    const card = ensure(d.context, d.userId, d.orgId, { name: d.applicantName, email: d.applicantEmail });
    card.docs.push(d);
    const t = d.submittedDate ? new Date(d.submittedDate).getTime() : 0;
    if (t > card.lastActivity) card.lastActivity = t;
  }

  // Applicants still in the onboarding pipeline who have not uploaded anything yet.
  for (const u of users) {
    if (!u.applicationStatus || u.applicationStatus === ApplicationStatus.ACTIVE) continue;
    const { context, orgId } = contextOfUser(u, orgs);
    ensure(context, u.role === UserRole.AGENT ? u.id : undefined, u.role === UserRole.AGENT ? undefined : orgId, { name: u.fullName, email: u.email });
  }

  for (const card of cards.values()) {
    const app = card.user?.applicationStatus;
    card.needsAction =
      card.docs.some(d => d.status === "PENDING" || d.status === "EXPIRED") ||
      app === ApplicationStatus.PENDING_APPROVAL ||
      app === ApplicationStatus.AWAITING_PAYMENT ||
      (card.context !== "AGENT" && card.org?.verificationStatus === VerificationStatus.PENDING);
    if (!card.lastActivity) {
      const created = card.user?.createdDate || card.org?.createdDate;
      card.lastActivity = created ? new Date(created).getTime() : 0;
    }
  }

  return [...cards.values()].sort((a, b) => Number(b.needsAction) - Number(a.needsAction) || b.lastActivity - a.lastActivity);
}

export function matchesApplicantSearch(card: ApplicantCardData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [card.name, card.email, card.user?.phone, card.org?.name, card.org?.email].some(v => !!v && String(v).toLowerCase().includes(q));
}
