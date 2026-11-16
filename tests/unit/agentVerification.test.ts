import { describe, expect, it } from "vitest";
import { isAgentVerified, isVouchedByAgency } from "../../src/lib/agentVerification.js";
import { isPublicAgent } from "../../src/lib/publicProfile.js";
import { agentChecklist } from "../../src/lib/workspaceReadiness.js";
import { ApplicationStatus, UserRole, VerificationStatus } from "../../src/types.js";

const orgs = [
  { id: "org-ok", verificationStatus: VerificationStatus.APPROVED },
  { id: "org-wait", verificationStatus: VerificationStatus.PENDING },
  { id: "org-off", verificationStatus: VerificationStatus.SUSPENDED }
];
const agent = (o: Record<string, unknown> = {}) => ({ role: UserRole.AGENT, orgId: "org-ok", verificationStatus: VerificationStatus.PENDING, ...o }) as never;

describe("agent verification", () => {
  it("counts an agent of a verified agency as verified even when their own documents are not approved", () => {
    expect(isAgentVerified(agent(), orgs)).toBe(true);
    expect(isVouchedByAgency(agent(), orgs)).toBe(true);
  });

  it("does not, when the agency is not verified, does not exist, or the agent has no agency", () => {
    expect(isAgentVerified(agent({ orgId: "org-wait" }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ orgId: "org-off" }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ orgId: "org-gone" }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ orgId: undefined }), orgs)).toBe(false);
  });

  it("never vouches for an agent who was suspended or rejected, or is not active", () => {
    expect(isAgentVerified(agent({ verificationStatus: VerificationStatus.SUSPENDED }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ verificationStatus: VerificationStatus.REJECTED }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ applicationStatus: ApplicationStatus.PENDING_APPROVAL }), orgs)).toBe(false);
    expect(isAgentVerified(agent({ applicationStatus: ApplicationStatus.ACTIVE }), orgs)).toBe(true);
  });

  it("still counts an agent whose own documents are approved, with or without an agency", () => {
    expect(isAgentVerified(agent({ orgId: undefined, verificationStatus: VerificationStatus.APPROVED }), orgs)).toBe(true);
    expect(isAgentVerified(agent({ orgId: "org-wait", verificationStatus: VerificationStatus.APPROVED }), orgs)).toBe(true);
  });

  it("only agents are vouched for: an agency admin is not an agent", () => {
    expect(isVouchedByAgency(agent({ role: UserRole.AGENCY_ADMIN }), orgs)).toBe(false);
  });

  it("makes the agent visible on the public lists", () => {
    const db = { users: [], organizations: orgs as never, properties: [], reviews: [] };
    expect(isPublicAgent(agent({ id: "a" }), db)).toBe(true);
    expect(isPublicAgent(agent({ id: "b", orgId: "org-wait" }), db)).toBe(false);
  });

  it("shows the verification step of the checklist as done through the agency", () => {
    const a = { verificationStatus: VerificationStatus.PENDING, bio: "", languages: [], specialties: [], whatsapp: "" };
    expect(agentChecklist(a, { listings: 0, published: 0 }).items[0].done).toBe(false);
    expect(agentChecklist(a, { listings: 0, published: 0, verified: true }).items[0].done).toBe(true);
  });
});
