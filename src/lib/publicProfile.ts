// What the public page of an agent or agency shows, assembled only from data that is already public: who they are (as the
// directory and the listing pages already show), their live listings, their approved reviews. Anything private - the
// statistics, unapproved reviews, other people's accounts - never reaches it. Used for the page's JSON and for the HTML
// search engines read. Pure given the database state, unit tested.

import { ApplicationStatus, getVerifiedBadgeLabel, OrganizationType, UserRole, VerificationStatus } from "../types.js";
import type { Organization, Property, Review, User } from "../types.js";
import { isPublishedListing } from "./seo.js";
import { findBySlug, profileSlug, publicReviewerName } from "./profiles.js";
import type { ProfileKind } from "./profiles.js";
import type { AgentPerformance } from "./agentPerformance.js";

export interface PublicReview { id: string; rating: number; comment: string; createdDate: string; reviewerName: string; reply?: { text: string; createdDate: string } }
export interface TeamMember { slug: string; name: string; image?: string; verified: boolean; listings: number }

export interface PublicProfile {
  kind: ProfileKind;
  id: string;
  slug: string;
  name: string;
  nameAr?: string;
  image?: string;
  verified: boolean;
  verifiedLabel?: string;
  verifiedLabelAr?: string;
  /** "Independent agent", the agency's name, or the kind of company */
  subtitle: { en: string; ar: string };
  org?: { slug: string; name: string };
  bio?: string;
  languages: string[];
  specialties: string[];
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  memberSince?: string;
  listingsCount: number;
  listings: Property[];
  rating: { average: number; count: number };
  reviews: PublicReview[];
  performance?: AgentPerformance;
  team?: TeamMember[];
}

export interface ProfileSource {
  users: User[];
  organizations: Organization[];
  properties: Property[];
  reviews?: Review[];
}

export const MAX_PROFILE_LISTINGS = 60;
export const MAX_PROFILE_REVIEWS = 20;

const isLiveListing = (p: Property) => isPublishedListing(p);

function ratingAndReviews(db: ProfileSource, targetType: "AGENT" | "AGENCY", targetId: string) {
  const approved = (db.reviews || []).filter(r => r.targetType === targetType && r.targetId === targetId && r.status === "APPROVED");
  const average = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
  const reviews: PublicReview[] = approved
    .slice()
    .sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate))
    .slice(0, MAX_PROFILE_REVIEWS)
    .map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdDate: r.createdDate,
      reviewerName: publicReviewerName(db.users.find(u => u.id === r.reviewerId)?.fullName),
      ...(r.reply ? { reply: r.reply } : {})
    }));
  return { rating: { average: Math.round(average * 10) / 10, count: approved.length }, reviews };
}

/** An agent page exists for a verified, active professional, or for anyone with a live listing - the same people the public lists show. */
export function isPublicAgent(u: User, db: ProfileSource): boolean {
  if (u.role !== UserRole.AGENT) return false;
  if (db.properties.some(p => p.agentId === u.id && isLiveListing(p))) return true;
  return u.verificationStatus === VerificationStatus.APPROVED && (!u.applicationStatus || u.applicationStatus === ApplicationStatus.ACTIVE);
}

export function isPublicOrg(o: Organization, db: ProfileSource): boolean {
  return o.verificationStatus === VerificationStatus.APPROVED || db.properties.some(p => p.orgId === o.id && isLiveListing(p));
}

export const agentSlug = (u: User) => profileSlug("agents", { id: u.id, name: u.fullName });
export const orgSlug = (o: Organization) => profileSlug("agencies", { id: o.id, name: o.name });

function newestFirst(list: Property[]) {
  return list
    .slice()
    .sort((a, b) => Date.parse(b.updatedDate || b.createdDate || "") - Date.parse(a.updatedDate || a.createdDate || ""))
    .slice(0, MAX_PROFILE_LISTINGS);
}

export function buildPublicProfile(db: ProfileSource, kind: ProfileKind, slug: string, performance?: Record<string, AgentPerformance>): PublicProfile | null {
  if (kind === "agents") {
    const u = findBySlug(db.users.filter(x => x.role === UserRole.AGENT), slug);
    if (!u || !isPublicAgent(u, db)) return null;
    const org = u.orgId ? db.organizations.find(o => o.id === u.orgId) : undefined;
    const live = db.properties.filter(p => p.agentId === u.id && isLiveListing(p));
    const verified = u.verificationStatus === VerificationStatus.APPROVED;
    return {
      kind,
      id: u.id,
      slug: agentSlug(u),
      name: u.fullName,
      image: u.avatarUrl,
      verified,
      verifiedLabel: verified ? getVerifiedBadgeLabel(u, org?.name, false) : undefined,
      verifiedLabelAr: verified ? getVerifiedBadgeLabel(u, org?.name, true) : undefined,
      subtitle: org ? { en: org.name, ar: org.nameAr || org.name } : { en: "Independent agent", ar: "وكيل مستقل" },
      org: org && isPublicOrg(org, db) ? { slug: orgSlug(org), name: org.name } : undefined,
      bio: u.bio,
      languages: u.languages || [],
      specialties: u.specialties || [],
      phone: u.phone,
      whatsapp: u.whatsapp,
      email: u.email,
      memberSince: u.createdDate,
      listingsCount: live.length,
      listings: newestFirst(live),
      ...ratingAndReviews(db, "AGENT", u.id),
      performance: performance?.[u.id]
    };
  }

  const o = findBySlug(db.organizations, slug);
  if (!o || !isPublicOrg(o, db)) return null;
  const live = db.properties.filter(p => p.orgId === o.id && isLiveListing(p));
  const verified = o.verificationStatus === VerificationStatus.APPROVED;
  const team: TeamMember[] = db.users
    .filter(u => u.orgId === o.id && u.role === UserRole.AGENT && isPublicAgent(u, db))
    .map(u => ({
      slug: agentSlug(u),
      name: u.fullName,
      image: u.avatarUrl,
      verified: u.verificationStatus === VerificationStatus.APPROVED,
      listings: live.filter(p => p.agentId === u.id).length
    }))
    .sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name))
    .slice(0, 40);
  return {
    kind,
    id: o.id,
    slug: orgSlug(o),
    name: o.name,
    nameAr: o.nameAr,
    image: o.logoUrl,
    verified,
    subtitle: o.type === OrganizationType.DEVELOPER ? { en: "Developer", ar: "مطوّر عقاري" } : { en: "Real estate agency", ar: "مكتب عقاري" },
    phone: o.phone,
    whatsapp: o.whatsapp,
    email: o.email,
    website: o.website,
    memberSince: o.createdDate,
    languages: [],
    specialties: [],
    listingsCount: live.length,
    listings: newestFirst(live),
    ...ratingAndReviews(db, "AGENCY", o.id),
    team
  };
}

/** The text a search engine reads for a profile: a short summary line used for the page description. */
export function profileSummary(p: PublicProfile, lang: "en" | "ar"): string {
  const ar = lang === "ar";
  const name = ar && p.nameAr ? p.nameAr : p.name;
  const bits: string[] = [];
  bits.push(ar ? p.subtitle.ar : p.subtitle.en);
  if (p.listingsCount > 0) bits.push(ar ? `${p.listingsCount} عقاراً منشوراً` : `${p.listingsCount} live listing${p.listingsCount === 1 ? "" : "s"}`);
  if (p.rating.count > 0) bits.push(ar ? `تقييم ${p.rating.average} من ${p.rating.count} تقييم` : `rated ${p.rating.average} from ${p.rating.count} review${p.rating.count === 1 ? "" : "s"}`);
  if (p.verified) bits.push(ar ? "موثّق على نيرو فايندر" : "verified on Nerou Finder");
  const tail = p.bio ? ` ${p.bio.replace(/\s+/g, " ").trim().slice(0, 140)}` : "";
  return `${name}: ${bits.join(" · ")}.${tail}`.slice(0, 300);
}
