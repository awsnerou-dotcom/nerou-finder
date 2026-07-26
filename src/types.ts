/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  VISITOR = "VISITOR",
  REGISTERED = "REGISTERED",
  AGENT = "AGENT",
  AGENCY_ADMIN = "AGENCY_ADMIN",
  DEVELOPER_ADMIN = "DEVELOPER_ADMIN",
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN"
}

export enum VerificationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED"
}

// Splits AGENT accounts into agents affiliated with an agency (invited, no personal
// subscription) vs. independent agents (self-signed-up, carry their own subscription).
export enum AgentType {
  INDEPENDENT_AGENT = "INDEPENDENT_AGENT",
  AGENCY_AGENT = "AGENCY_AGENT"
}

// Signup-forward onboarding/approval pipeline. Only meaningful for new-signup AGENT
// (INDEPENDENT_AGENT only), AGENCY_ADMIN, and DEVELOPER_ADMIN accounts - REGISTERED/VISITOR
// and AGENCY_AGENT accounts never get gated by this. IMPORTANT: undefined always means
// "grandfathered / fully active" for accounts created before this pipeline existed - never
// treat undefined as "not yet approved".
export enum ApplicationStatus {
  PENDING_APPROVAL = "PENDING_APPROVAL",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  AWAITING_DOCUMENTS = "AWAITING_DOCUMENTS",
  UNDER_VERIFICATION = "UNDER_VERIFICATION",
  ACTIVE = "ACTIVE"
}

export enum TransactionType {
  FOR_SALE = "FOR_SALE",
  FOR_RENT = "FOR_RENT",
  OFF_PLAN = "OFF_PLAN",
  COMMERCIAL_SALE = "COMMERCIAL_SALE",
  COMMERCIAL_LEASE = "COMMERCIAL_LEASE",
  LAND_SALE = "LAND_SALE"
}

export enum PropertyType {
  APARTMENT = "APARTMENT",
  VILLA = "VILLA",
  TOWNHOUSE = "TOWNHOUSE",
  PENTHOUSE = "PENTHOUSE",
  COMPOUND = "COMPOUND",
  STUDIO = "STUDIO",
  ROOM = "ROOM",
  OFFICE = "OFFICE",
  RETAIL = "RETAIL",
  SHOP = "SHOP",
  WAREHOUSE = "WAREHOUSE",
  BUILDING = "BUILDING",
  LAND = "LAND",
  HOTEL_APARTMENT = "HOTEL_APARTMENT",
  COMMERCIAL = "COMMERCIAL",
  RESIDENTIAL = "RESIDENTIAL",
  FARM = "FARM",
  CHALET = "CHALET",
  OTHER = "OTHER"
}

export interface LocationItem {
  id: string;
  name: string;
  nameAr: string;
  type: "COUNTRY" | "MUNICIPALITY" | "CITY" | "AREA" | "DISTRICT" | "SUB_AREA";
  parentId?: string;
  latitude?: number;
  longitude?: number;
  seoSlug?: string;
  isActive: boolean;
}

export enum ListingStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  PUBLISHED = "PUBLISHED",
  PAUSED = "PAUSED",
  SOLD = "SOLD",
  RENTED = "RENTED",
  SUSPENDED = "SUSPENDED"
}

export enum LeadStatus {
  NEW = "NEW",
  ASSIGNED = "ASSIGNED",
  CONTACTED = "CONTACTED",
  VIEWING_REQUESTED = "VIEWING_REQUESTED",
  VIEWING_SCHEDULED = "VIEWING_SCHEDULED",
  NEGOTIATION = "NEGOTIATION",
  CONVERTED = "CONVERTED",
  LOST = "LOST"
}

export enum OrganizationType {
  AGENCY = "AGENCY",
  DEVELOPER = "DEVELOPER"
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  whatsapp?: string;
  role: UserRole;
  orgId?: string; // Optional reference to Organization
  avatarUrl?: string;
  bio?: string;
  languages?: string[];
  specialties?: string[]; // e.g. areas or property types
  verificationStatus: VerificationStatus;
  createdDate: string;
  password?: string;
  isExpat?: boolean; // Determines whether PASSPORT is a required verification document for AGENT role
  agentType?: AgentType; // Only meaningful when role === UserRole.AGENT
  applicationStatus?: ApplicationStatus; // Onboarding pipeline state - undefined means grandfathered/active
  // Independent-agent subscription fields (same shape as Organization's equivalents below).
  // Only meaningful for an AGENT whose effective AgentType is INDEPENDENT_AGENT - an
  // AGENCY_AGENT's access is governed entirely by their agency Organization's subscription.
  subscriptionPlanId?: string;
  subscriptionExpiry?: string;
  subscriptionStatus?: "ACTIVE" | "SUSPENDED" | "CANCELLED" | "PENDING_APPROVAL";
  subscriptionActivationMethod?: "MANUAL" | "BANK_TRANSFER" | "INVOICE" | "OTHER";
  subscriptionNotes?: string;
}

// Resolves an AGENT's effective type defensively: existing accounts created before
// AgentType existed have agentType === undefined, so we derive it from orgId rather
// than treating undefined as an error or defaulting everyone to one fixed value.
export function getEffectiveAgentType(user: { role: UserRole; orgId?: string; agentType?: AgentType }): AgentType {
  if (user.agentType) return user.agentType;
  return user.orgId ? AgentType.AGENCY_AGENT : AgentType.INDEPENDENT_AGENT;
}

export interface Organization {
  id: string;
  name: string;
  nameAr?: string;
  type: OrganizationType;
  logoUrl: string;
  email: string;
  phone: string;
  whatsapp?: string;
  website?: string;
  verificationStatus: VerificationStatus;
  subscriptionPlanId: string;
  subscriptionExpiry: string;
  createdDate: string;
  subscriptionStartDate?: string;
  subscriptionStatus?: "ACTIVE" | "SUSPENDED" | "CANCELLED" | "PENDING_APPROVAL";
  subscriptionNotes?: string;
  subscriptionActivationMethod?: "MANUAL" | "BANK_TRANSFER" | "INVOICE" | "OTHER";
  leadRoutingPolicy?: "ROUND_ROBIN" | "AREA_BASED" | "PERFORMANCE";
}

export interface PriceHistoryItem {
  price: number;
  date: string;
}

export interface Property {
  id: string;
  listingId: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  propertyType: PropertyType;
  transactionType: TransactionType;
  price: number;
  currency: string; // e.g. QAR, USD
  rentalPeriod?: "MONTHLY" | "YEARLY" | "WEEKLY" | "DAILY";
  area: number; // in square meters
  sizeUnit: "SQM" | "SQFT";
  city: string; // e.g. Doha, Lusail, Al Rayyan
  district: string; // e.g. Marina District, West Bay, Pearl Qatar
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  furnished: "YES" | "NO" | "PARTLY";
  parking: boolean;
  amenities: string[];
  images: string[];
  videoUrl?: string;
  agentId: string;
  orgId: string; // Agency or Developer organization ID
  projectId?: string; // If off-plan / developer project
  verificationStatus: VerificationStatus;
  listingStatus: ListingStatus;
  qualityScore: number; // Listing quality score out of 100
  createdDate: string;
  updatedDate: string;
  lastVerifiedDate?: string;
  priceHistory: PriceHistoryItem[];
  // Extended Professional Specifications & Qatar Localization
  referenceNumber?: string;
  subtype?: string;
  deposit?: number;
  commissions?: number;
  kahramaa?: boolean; // electricity/water inclusion
  internet?: boolean;
  cooling?: boolean; // cooling included
  cheques?: number;
  contractLength?: string;
  builtUpArea?: number;
  grossArea?: number;
  netArea?: number;
  plotArea?: number;
  floorNumber?: number;
  unitNumber?: string;
  buildingName?: string;
  buildingNumber?: string;
  viewType?: string; // Sea, City, Marina, Lagoon, Street, Garden, Golf, Skyline
  serviceCharges?: number;
  villaType?: string; // standalone, compound, semi-detached
  majlis?: boolean;
  backyard?: boolean;
  privatePool?: boolean;
  outdoorKitchen?: boolean;
  maidRoom?: boolean;
  driverRoom?: boolean;
  laundryRoom?: boolean;
  centralAc?: boolean;
  districtCooling?: boolean;
  smartHome?: boolean;
  appliancesIncluded?: boolean;
  elevator?: boolean;
  concierge?: boolean;
  commercialUsage?: string;
  officeGrade?: string; // Grade A, B, C
  fittedStatus?: string; // Fitted, Shell & Core
  loadingBay?: boolean;
  coldStorage?: boolean;
  industrialPower?: string;
  commercialLicense?: string;
  suitability?: string;
  landZoning?: string;
  maxHeight?: string;
  floorAreaRatio?: number;
  roadAccess?: string;
  utilitiesConnected?: boolean;
  developer?: string;
  constructionStatus?: string;
  completionDate?: string;
  paymentPlan?: { reservation: number; installments: string; details: string };
  floorPlans?: string[];
  nearbyPlaces?: { type: string; name: string; distance: string }[];
  savedCount?: number;
  reportCount?: number;
  imageCategories?: string[];
  // Qatar-specific specification fields
  completionYear?: number; // Year the building was/will be completed (off-plan vs ready)
  // Richer furnishing detail alongside the existing `furnished` YES/NO/PARTLY field
  // (kept for backward compatibility - forms should use furnishingStatus going forward).
  furnishingStatus?: "FULLY_FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
  metroStation?: string; // Nearest Doha Metro station
  metroWalkingMinutes?: number; // Approximate walking time to the metro station, in minutes
  utilitiesIncluded?: "YES" | "NO" | "PARTIAL";
  parkingType?: "COVERED" | "UNCOVERED" | "GARAGE" | "NONE";
  parkingSpaces?: number;
  tenureType?: "FREEHOLD" | "USUFRUCT" | "LOCAL_OWNERSHIP_ONLY";
}

export interface Project {
  id: string;
  developerId: string;
  name: string;
  nameAr?: string;
  description: string;
  city: string;
  district: string;
  status: "PLANNING" | "UNDER_CONSTRUCTION" | "COMPLETED";
  deliveryDate?: string;
  images: string[];
  brochureUrl?: string;
  createdDate: string;
}

export interface Lead {
  id: string;
  propertyId?: string;
  projectId?: string;
  visitorName: string;
  visitorPhone: string;
  visitorWhatsapp?: string;
  visitorEmail?: string;
  preferredLanguage?: string;
  message: string;
  contactMethod: "WHATSAPP" | "CALL" | "INQUIRY";
  status: LeadStatus;
  agentId?: string;
  orgId?: string;
  createdDate: string;
  updatedDate: string;
  attribution?: {
    source?: string;
    campaign?: string;
    utmSource?: string;
  };
}

export interface ViewingRequest {
  id: string;
  leadId: string;
  propertyId: string;
  agentId: string;
  preferredDate: string;
  preferredTimeSlot: string;
  status: "REQUESTED" | "CONFIRMED" | "RESCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string;
  createdDate: string;
}

export interface SupportReport {
  id: string;
  propertyId?: string;
  userId?: string;
  reporterEmail: string;
  reporterName: string;
  reason: "fake_listing" | "incorrect_price" | "unavailable" | "scam" | "misleading" | "other";
  details: string;
  status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";
  createdDate: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  propertyLimit: number;
  agentLimit: number;
  aiLimit: number; // search / descriptions count per month
  analyticsAccess: boolean;
  featuredListingsLimit: number;
}

export interface AdCampaign {
  id: string;
  orgId: string;
  propertyId?: string;
  projectId?: string;
  type: "FEATURED_LISTING" | "SPONSORED_SEARCH" | "BANNER_AD";
  budget: number;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "COMPLETED";
  metrics: {
    impressions: number;
    clicks: number;
    saves: number;
    leads: number;
    spend: number;
  };
  createdDate: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetId: string;
  targetType: string;
  metadata?: any;
  timestamp: string;
}

export interface SystemHealthStatus {
  api: "OPERATIONAL" | "DEGRADED" | "ERROR";
  database: "OPERATIONAL" | "DEGRADED" | "ERROR";
  ai: "OPERATIONAL" | "DEGRADED" | "ERROR";
  payment: "OPERATIONAL" | "DEGRADED" | "ERROR";
  whatsapp: "OPERATIONAL" | "DEGRADED" | "ERROR";
  lastCheck: string;
}

export interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ARCHIVED";
  author: string;
  legalReviewStatus: "PENDING" | "APPROVED" | "REVISION_REQUIRED";
}

export interface HelpArticle {
  id: string;
  category: "VISITORS" | "AGENTS" | "AGENCIES" | "DEVELOPERS" | "SUBSCRIPTIONS" | "SECURITY";
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  isPublished: boolean;
  viewCount: number;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  category: "TECHNICAL" | "BILLING" | "VERIFICATION" | "REPORT_ABUSE" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  subject: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_USER" | "RESOLVED" | "CLOSED";
  createdDate: string;
  replies: {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    createdDate: string;
  }[];
}

export interface JobListing {
  id: string;
  title: string;
  titleAr: string;
  department: string;
  departmentAr: string;
  location: string;
  locationAr: string;
  type: string;
  typeAr: string;
  description: string;
  descriptionAr: string;
  requirements: string[];
  requirementsAr: string[];
}

export interface PressRelease {
  id: string;
  title: string;
  titleAr: string;
  date: string;
  summary: string;
  summaryAr: string;
  content: string;
  contentAr: string;
}

export interface PartnershipRequest {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  type: "DEVELOPER" | "AGENCY" | "TECHNOLOGY" | "MEDIA" | "OTHER";
  message: string;
  status: "NEW" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  createdDate: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  targetType: "AGENT" | "AGENCY";
  targetId: string;
  rating: number;
  comment: string;
  createdDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface Invitation {
  id: string;
  email: string;
  orgId: string;
  invitedRole: UserRole;
  token: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
  createdDate: string;
  expiresDate: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  cvUrl?: string;
  coverLetter?: string;
  status: "PENDING" | "REVIEWED" | "ACCEPTED" | "REJECTED";
  createdDate: string;
}

// ---------------------------------------------------------------------------
// Document Verification System
// ---------------------------------------------------------------------------

export enum DocumentType {
  QID_FRONT = "QID_FRONT",
  QID_BACK = "QID_BACK",
  PASSPORT = "PASSPORT",
  AGENCY_AUTHORIZATION_LETTER = "AGENCY_AUTHORIZATION_LETTER",
  COMMERCIAL_REGISTRATION = "COMMERCIAL_REGISTRATION",
  TRADE_LICENSE = "TRADE_LICENSE",
  BROKERAGE_PERMIT = "BROKERAGE_PERMIT",
  SIGNATORY_ID = "SIGNATORY_ID",
  MUNICIPALITY_PROJECT_PERMIT = "MUNICIPALITY_PROJECT_PERMIT",
  LAND_OR_MASTER_DEVELOPER_AUTHORIZATION = "LAND_OR_MASTER_DEVELOPER_AUTHORIZATION",
  ESCROW_CONFIRMATION = "ESCROW_CONFIRMATION"
}

export enum DocumentStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED"
}

// The verification "context" an applicant belongs to - drives which document
// checklist applies. AGENT documents are owned by a User; AGENCY/DEVELOPER
// documents are owned by an Organization.
export type VerificationContext = "AGENT" | "AGENCY" | "DEVELOPER";

export interface VerificationDocument {
  id: string;
  context: VerificationContext;
  userId?: string; // set when context === "AGENT"
  orgId?: string; // set when context === "AGENCY" | "DEVELOPER"
  documentType: DocumentType;
  fileUrl: string;
  status: DocumentStatus;
  rejectionReason?: string;
  expiryDate?: string;
  submittedDate: string;
  reviewedDate?: string;
  reviewedBy?: string;
  reminder30SentDate?: string;
  reminder7SentDate?: string;
}

// Required document checklist per verification context. AGENT's PASSPORT
// requirement is conditional on User.isExpat and is handled separately by
// getRequiredDocumentTypes() below rather than being listed unconditionally here.
export const REQUIRED_DOCUMENTS_BY_CONTEXT: Record<VerificationContext, DocumentType[]> = {
  AGENT: [DocumentType.QID_FRONT, DocumentType.QID_BACK, DocumentType.AGENCY_AUTHORIZATION_LETTER],
  AGENCY: [
    DocumentType.COMMERCIAL_REGISTRATION,
    DocumentType.TRADE_LICENSE,
    DocumentType.BROKERAGE_PERMIT,
    DocumentType.SIGNATORY_ID
  ],
  DEVELOPER: [
    DocumentType.COMMERCIAL_REGISTRATION,
    DocumentType.MUNICIPALITY_PROJECT_PERMIT,
    DocumentType.LAND_OR_MASTER_DEVELOPER_AUTHORIZATION,
    DocumentType.ESCROW_CONFIRMATION
  ]
};

export function getRequiredDocumentTypes(context: VerificationContext, isExpat?: boolean): DocumentType[] {
  const base = REQUIRED_DOCUMENTS_BY_CONTEXT[context];
  if (context === "AGENT" && isExpat) {
    return [...base, DocumentType.PASSPORT];
  }
  return base;
}

// ---------------------------------------------------------------------------
// Self-Service Ad Boosts & Billing Ledger
// ---------------------------------------------------------------------------

export type AdChargeType = "BUMP" | "FEATURED";

export interface AdCharge {
  id: string;
  orgId: string;
  propertyId: string;
  type: AdChargeType;
  amount: number;
  createdDate: string;
  billingPeriod: string; // "YYYY-MM"
  settled: boolean;
  settledDate?: string;
  settledBy?: string;
}

export const AD_CHARGE_PRICES: Record<AdChargeType, number> = {
  BUMP: 49,
  FEATURED: 299
};

// Monthly self-service boost cap per subscription plan id. Adjustable by PLATFORM_ADMIN
// via PlatformConfig.adBoostCaps (falls back to this default when unset).
export const DEFAULT_MONTHLY_BOOST_CAPS: Record<string, number> = {
  "plan-basic": 3,
  "plan-premium": 15,
  "plan-developer": 25
};

export const DEFAULT_BOOST_CAP_FALLBACK = 3;

// Doha Metro stations (Red, Green and Gold lines) - used to populate the
// metroStation dropdown on the listing form. Free text is still accepted server-side,
// this is just a convenience list of real station names.
export const DOHA_METRO_STATIONS: string[] = [
  // Red Line
  "Lusail", "Lusail QNCC", "Legtaifiya", "Msheireb", "Al Sadd",
  "Al Bidda", "Corniche", "Union", "Al Mansoura", "Souq Waqif",
  "National Museum of Qatar", "Sports City", "Katara", "Ras Bu Aboud",
  "Free Zone", "Ras Bu Fantas", "Al Wakrah", "Al Wukair", "Mesaieed",
  // Green Line
  "Al Riffa", "Bin Mahmoud", "Dafna", "Umm Ghuwailina", "Hamad Hospital",
  "Al Aziziyah", "Al Waab", "Al Gharrafa", "Al Markhiya",
  "Qatar National Library", "Qatar University", "Al Messila",
  // Gold Line
  "Rawdat Al Khail", "Al Matar Al Qadeem (Old Airport)", "Bani Hajer",
  "Salwa Road", "Ezdan Oasis", "Al Shaqab", "Al Wajba",
  "Hamad International Airport"
];

