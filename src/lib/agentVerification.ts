import { ApplicationStatus, UserRole, VerificationStatus } from "../types.js";
import type { Organization, User } from "../types.js";

// Who counts as a verified agent. An agent is verified when their own documents are approved, or when they work for an agency that
// is itself verified: the agency answers for the brokers it invited, and the label they carry says so ("Verified - <agency>").
// An agent an admin has suspended or rejected is never verified, and one who has left the agency (no orgId) is judged on their own.
// One place for the rule so the lists, the agency page, the badges and the dashboard can never disagree.

type AgentLike = Pick<User, "role" | "orgId" | "verificationStatus"> & Partial<Pick<User, "applicationStatus">>;
type OrgLike = Pick<Organization, "id" | "verificationStatus">;

/** the agent works for a verified agency, and has not been suspended, rejected or put on hold */
export function isVouchedByAgency(u: AgentLike, orgs: readonly OrgLike[]): boolean {
  if (u.role !== UserRole.AGENT || !u.orgId) return false;
  if (u.verificationStatus === VerificationStatus.SUSPENDED || u.verificationStatus === VerificationStatus.REJECTED) return false;
  if (u.applicationStatus && u.applicationStatus !== ApplicationStatus.ACTIVE) return false;
  return orgs.some(o => o.id === u.orgId && o.verificationStatus === VerificationStatus.APPROVED);
}

export function isAgentVerified(u: AgentLike, orgs: readonly OrgLike[]): boolean {
  return u.verificationStatus === VerificationStatus.APPROVED || isVouchedByAgency(u, orgs);
}
