/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

export const prisma = new PrismaClient();
import {
  User,
  UserRole,
  Organization,
  OrganizationType,
  Property,
  PropertyType,
  TransactionType,
  ListingStatus,
  VerificationStatus,
  Lead,
  LeadStatus,
  Project,
  ViewingRequest,
  SupportReport,
  AdCampaign,
  AuditLog,
  SystemHealthStatus,
  SubscriptionPlan,
  LocationItem,
  LegalDocument,
  HelpArticle,
  SupportTicket,
  JobListing,
  PressRelease,
  PartnershipRequest,
  Review,
  Invitation,
  JobApplication
} from "./src/types.js";

const DB_FILE = path.join(process.cwd(), "data.json");

export interface DatabaseState {
  users: User[];
  organizations: Organization[];
  projects: Project[];
  properties: Property[];
  leads: Lead[];
  viewings: ViewingRequest[];
  reports: SupportReport[];
  campaigns: AdCampaign[];
  auditLogs: AuditLog[];
  systemHealth: SystemHealthStatus;
  subscriptionPlans: SubscriptionPlan[];
  locations?: LocationItem[];
  legalDocuments?: LegalDocument[];
  helpArticles?: HelpArticle[];
  supportTickets?: SupportTicket[];
  jobListings?: JobListing[];
  pressReleases?: PressRelease[];
  partnershipRequests?: PartnershipRequest[];
  reviews?: Review[];
  invitations?: Invitation[];
  jobApplications?: JobApplication[];
  aiConfig?: {
    whatsappDefaultNumber?: string;
    watermarkText?: string;
    watermarkLogoType?: string;
    aiName: string;
    aiDescription: string;
    aiPersonality: string;
    supportedLanguages: string[];
    searchTaxonomy: string[];
    propertyTaxonomy: string[];
    aiRules: string;
    restrictedTopics: string;
    disclaimers: string;
    recommendedQuestions: string[];
    usageLimits: number;
    featureFlags: { [key: string]: boolean };
    modelConfiguration: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
  };
}

const DEFAULT_SUB_PLANS: SubscriptionPlan[] = [
  {
    id: "plan-basic",
    name: "Standard Broker",
    priceMonthly: 500,
    priceYearly: 4800,
    propertyLimit: 15,
    agentLimit: 1,
    aiLimit: 50,
    analyticsAccess: false,
    featuredListingsLimit: 2
  },
  {
    id: "plan-premium",
    name: "Enterprise Agency",
    priceMonthly: 1800,
    priceYearly: 18000,
    propertyLimit: 100,
    agentLimit: 10,
    aiLimit: 500,
    analyticsAccess: true,
    featuredListingsLimit: 15
  },
  {
    id: "plan-developer",
    name: "Master Developer",
    priceMonthly: 4500,
    priceYearly: 45000,
    propertyLimit: 500,
    agentLimit: 50,
    aiLimit: 2000,
    analyticsAccess: true,
    featuredListingsLimit: 50
  }
];

const DEFAULT_USERS: User[] = [
  {
    id: "user-super-admin",
    email: "super_admin@nerou.com",
    fullName: "Nasser Al-Thani",
    phone: "+974 5555 1111",
    role: UserRole.SUPER_ADMIN,
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-01-10T12:00:00Z"
  },
  {
    id: "user-platform-admin",
    email: "platform_admin@nerou.com",
    fullName: "Ameera Al-Ansari",
    phone: "+974 5555 2222",
    role: UserRole.PLATFORM_ADMIN,
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-02-15T09:30:00Z"
  },
  {
    id: "user-agency-admin",
    email: "agency_admin@nerou.com",
    fullName: "Tareq Al-Jaber",
    phone: "+974 4444 3333",
    role: UserRole.AGENCY_ADMIN,
    orgId: "org-agency-1",
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-03-01T08:00:00Z"
  },
  {
    id: "user-agent-1",
    email: "agent1@nerou.com",
    fullName: "Faisal Hassan",
    phone: "+974 3333 4444",
    whatsapp: "+97433334444",
    role: UserRole.AGENT,
    orgId: "org-agency-1",
    bio: "Luxury residential specialist with 8+ years experience in Pearl Qatar and West Bay.",
    languages: ["English", "Arabic"],
    specialties: ["Pearl Qatar", "West Bay", "Penthouses"],
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-03-05T10:15:00Z"
  },
  {
    id: "user-agent-2",
    email: "agent2@nerou.com",
    fullName: "Sarah Connor",
    phone: "+974 3333 5555",
    whatsapp: "+97433335555",
    role: UserRole.AGENT,
    orgId: "org-agency-1",
    bio: "Focused on modern townhouses and family apartments in Lusail Marina.",
    languages: ["English", "French"],
    specialties: ["Lusail", "Apartments"],
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-03-10T14:20:00Z"
  },
  {
    id: "user-developer-admin",
    email: "developer_admin@nerou.com",
    fullName: "Khalid Al-Marri",
    phone: "+974 6666 7777",
    role: UserRole.DEVELOPER_ADMIN,
    orgId: "org-developer-1",
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: "2026-03-12T11:00:00Z"
  }
];

const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: "org-agency-1",
    name: "Elite Gulf Realty",
    nameAr: "إيليت جلف العقارية",
    type: OrganizationType.AGENCY,
    logoUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&h=200&q=80",
    email: "info@elitegulfrealty.qa",
    phone: "+974 4444 8888",
    whatsapp: "+97444448888",
    website: "https://elitegulfrealty.qa",
    verificationStatus: VerificationStatus.APPROVED,
    subscriptionPlanId: "plan-premium",
    subscriptionExpiry: "2027-07-20T11:20:00Z",
    createdDate: "2026-03-01T08:00:00Z"
  },
  {
    id: "org-developer-1",
    name: "Al Shamal Developments",
    nameAr: "تطوير الشمال",
    type: OrganizationType.DEVELOPER,
    logoUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=200&h=200&q=80",
    email: "sales@alshamal.qa",
    phone: "+974 4444 9999",
    whatsapp: "+97444449999",
    website: "https://alshamal.qa",
    verificationStatus: VerificationStatus.APPROVED,
    subscriptionPlanId: "plan-developer",
    subscriptionExpiry: "2027-07-20T11:20:00Z",
    createdDate: "2026-03-12T11:00:00Z"
  }
];

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "proj-1",
    developerId: "org-developer-1",
    name: "Marina Heights Lusail",
    nameAr: "أبراج مارينا لوسيل",
    description: "Premium high-rise residential towers offering scenic views of the Lusail Yacht Marina. Features smart home technology, temperature-controlled pool, and 24/7 private concierge.",
    city: "Lusail",
    district: "Marina District",
    status: "UNDER_CONSTRUCTION",
    deliveryDate: "2027-12-31",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1464938050520-ef2270bb8ce8?auto=format&fit=crop&w=800&q=80"
    ],
    brochureUrl: "#",
    createdDate: "2026-03-15T09:00:00Z"
  },
  {
    id: "proj-2",
    developerId: "org-developer-1",
    name: "Pearl Breeze Villas",
    nameAr: "فلل نسيم اللؤلؤة",
    description: "Ultra-luxurious beachfront villas with private yacht berths, beach access, and state-of-the-art security.",
    city: "Doha",
    district: "Pearl Qatar",
    status: "PLANNING",
    deliveryDate: "2028-06-30",
    images: [
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
    ],
    createdDate: "2026-04-01T10:00:00Z"
  }
];

const DEFAULT_PROPERTIES: Property[] = [
  {
    id: "prop-1",
    listingId: "N-10204",
    title: "Stunning 2-BR Apartment in Pearl Qatar",
    titleAr: "شقة مذهلة غرفتين في لؤلؤة قطر",
    description: "A gorgeous, fully-furnished 2 bedroom apartment in Porto Arabia, Pearl Qatar. This high-floor unit features spacious balconies, direct marina views, a fully-equipped open kitchen, and state-of-the-art facilities like gym, luxury spa, and temperature-controlled pool. Perfect for professional couples or small families seeking premium living.",
    descriptionAr: "شقة رائعة مفروشة بالكامل من غرفتين في بورتو أرابيا، لؤلؤة قطر. تتميز هذه الوحدة بطابق مرتفع وشرفات واسعة وإطلالات مباشرة على المرسى ومطبخ مفتوح مجهز بالكامل ومرافق حديثة مثل صالة ألعاب رياضية وسبا فاخر ومسبح متحكم بدرجة حرارته.",
    propertyType: PropertyType.APARTMENT,
    transactionType: TransactionType.FOR_RENT,
    price: 11000,
    currency: "QAR",
    rentalPeriod: "MONTHLY",
    area: 145,
    sizeUnit: "SQM",
    city: "Doha",
    district: "Pearl Qatar",
    latitude: 25.3725,
    longitude: 51.5512,
    bedrooms: 2,
    bathrooms: 3,
    furnished: "YES",
    parking: true,
    amenities: ["Pool", "Gym", "Balcony", "Security", "Marina View", "Elevator", "Pets Allowed"],
    images: [
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1502005229762-fc1b2b812ca5?auto=format&fit=crop&w=800&q=80"
    ],
    agentId: "user-agent-1",
    orgId: "org-agency-1",
    verificationStatus: VerificationStatus.APPROVED,
    listingStatus: ListingStatus.PUBLISHED,
    qualityScore: 95,
    createdDate: "2026-06-01T10:00:00Z",
    updatedDate: "2026-07-15T08:00:00Z",
    lastVerifiedDate: "2026-07-15T08:00:00Z",
    priceHistory: [
      { price: 12000, date: "2026-06-01" },
      { price: 11000, date: "2026-07-15" }
    ]
  },
  {
    id: "prop-2",
    listingId: "N-10205",
    title: "Luxury 5-Bedroom Beachfront Villa in West Bay",
    titleAr: "فيلا شاطئية فاخرة 5 غرف في الخليج الغربي",
    description: "An extraordinary master-designed 5 bedroom villa on the edge of West Bay lagoon. Boasts a sprawling landscaped garden, private infinity pool, exclusive private beach access, custom-crafted Italian marble floors, cinema room, elevator, separate maids quarters, and smart home controls. Unrivaled luxury and absolute privacy.",
    descriptionAr: "فيلا استثنائية من تصميم مهندس رئيسي بـ 5 غرف على حافة بحيرة الخليج الغربي. تضم حديقة منسقة مترامية الأطراف، ومسبح إنفينيتي خاص، ومنفذ خاص وحصري للشاطئ، وأرضيات من الرخام الإيطالي الفاخر، وغرفة سينما، ومصعد، ومسكن منفصل للخادمة.",
    propertyType: PropertyType.VILLA,
    transactionType: TransactionType.FOR_SALE,
    price: 18500000,
    currency: "QAR",
    area: 680,
    sizeUnit: "SQM",
    city: "Doha",
    district: "West Bay Lagoon",
    latitude: 25.3855,
    longitude: 51.5285,
    bedrooms: 5,
    bathrooms: 6,
    furnished: "NO",
    parking: true,
    amenities: ["Pool", "Gym", "Garden", "Security", "Sea View", "Elevator", "Maids Room", "Smart Home"],
    images: [
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80"
    ],
    agentId: "user-agent-1",
    orgId: "org-agency-1",
    verificationStatus: VerificationStatus.APPROVED,
    listingStatus: ListingStatus.PUBLISHED,
    qualityScore: 100,
    createdDate: "2026-05-10T12:00:00Z",
    updatedDate: "2026-07-10T09:30:00Z",
    lastVerifiedDate: "2026-07-10T09:30:00Z",
    priceHistory: [
      { price: 19000000, date: "2026-05-10" },
      { price: 18500000, date: "2026-07-10" }
    ]
  },
  {
    id: "prop-3",
    listingId: "N-10206",
    title: "Modern 1-BR Apartment in Lusail Marina",
    titleAr: "شقة حديثة غرفة واحدة في مارينا لوسيل",
    description: "An elegant, contemporary 1 bedroom apartment in the heart of Lusail Marina District. High floor with pristine skyline and sea views, semi-furnished with brand new designer kitchen appliances, sleek integrated wardrobing, and direct private balcony. Close to supermarkets, promenade, and coffee shops.",
    descriptionAr: "شقة أنيقة وعصرية من غرفة نوم واحدة في قلب منطقة مارينا لوسيل. طابق مرتفع مع إطلالات رائعة على أفق المدينة والبحر، مفروشة جزئيًا بأجهزة مطبخ جديدة وتصميم راقي وخزائن مدمجة وشرفة خاصة.",
    propertyType: PropertyType.APARTMENT,
    transactionType: TransactionType.FOR_RENT,
    price: 7500,
    currency: "QAR",
    rentalPeriod: "MONTHLY",
    area: 90,
    sizeUnit: "SQM",
    city: "Lusail",
    district: "Marina District",
    latitude: 25.4215,
    longitude: 51.5298,
    bedrooms: 1,
    bathrooms: 2,
    furnished: "PARTLY",
    parking: true,
    amenities: ["Pool", "Gym", "Balcony", "Security", "Elevator", "Sea View"],
    images: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80"
    ],
    agentId: "user-agent-2",
    orgId: "org-agency-1",
    verificationStatus: VerificationStatus.APPROVED,
    listingStatus: ListingStatus.PUBLISHED,
    qualityScore: 92,
    createdDate: "2026-06-15T11:00:00Z",
    updatedDate: "2026-07-18T10:00:00Z",
    lastVerifiedDate: "2026-07-18T10:00:00Z",
    priceHistory: [
      { price: 7500, date: "2026-06-15" }
    ]
  },
  {
    id: "prop-4",
    listingId: "N-10207",
    title: "Off-Plan Luxury Residence in Marina Heights",
    titleAr: "شقة فاخرة قيد الإنشاء في مارينا هايتس",
    description: "Invest early in the highly sought-after Marina Heights Project by Al Shamal Developments. A beautifully laid out 3 bedroom premium unit with payment plans direct from developer. State-of-the-art thermal cladding, smart metering, and premium luxury layouts. Handover in late 2027.",
    descriptionAr: "استثمر مبكرًا في مشروع مارينا هايتس المرغوب بشدة من تطوير الشمال. وحدة فاخرة مصممة بـ 3 غرف نوم مع خطط سداد ميسرة مباشرة من المطور. تكسية حرارية متطورة وعدادات ذكية وتخطيطات فاخرة.",
    propertyType: PropertyType.APARTMENT,
    transactionType: TransactionType.OFF_PLAN,
    price: 2450000,
    currency: "QAR",
    area: 185,
    sizeUnit: "SQM",
    city: "Lusail",
    district: "Marina District",
    latitude: 25.422,
    longitude: 51.5305,
    bedrooms: 3,
    bathrooms: 4,
    furnished: "NO",
    parking: true,
    amenities: ["Pool", "Gym", "Balcony", "Security", "Smart Home", "Elevator"],
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=800&q=80"
    ],
    agentId: "user-developer-admin",
    orgId: "org-developer-1",
    projectId: "proj-1",
    verificationStatus: VerificationStatus.PENDING,
    listingStatus: ListingStatus.PENDING_REVIEW,
    qualityScore: 88,
    createdDate: "2026-07-01T15:00:00Z",
    updatedDate: "2026-07-01T15:00:00Z",
    priceHistory: [
      { price: 2450000, date: "2026-07-01" }
    ]
  },
  {
    id: "prop-5",
    listingId: "N-10208",
    title: "Spacious Premium Townhouse in Al Waab",
    titleAr: "تاونهاوس فخم وفسيح في الوعب",
    description: "An elegant, highly private 4 bedroom townhouse situated inside a premium gated residential compound in Al Waab, Doha. Features a beautiful backyard garden, customized maid quarters, large laundry room, premium fittings, and dual car enclosed garage. Community facilities include double pools, squash court, tennis court, and kids playing zone.",
    descriptionAr: "تاونهاوس أنيق وعالي الخصوصية من 4 غرف نوم يقع داخل مجمع سكني متميز في الوعب، الدوحة. يتميز بحديقة خلفية جميلة ومسكن خادمة مخصص وغرفة غسيل كبيرة وتجهيزات ممتازة ومرآب مغلق لسيارتين.",
    propertyType: PropertyType.TOWNHOUSE,
    transactionType: TransactionType.FOR_SALE,
    price: 4200000,
    currency: "QAR",
    area: 320,
    sizeUnit: "SQM",
    city: "Doha",
    district: "Al Waab",
    latitude: 25.2685,
    longitude: 51.4655,
    bedrooms: 4,
    bathrooms: 5,
    furnished: "NO",
    parking: true,
    amenities: ["Pool", "Gym", "Garden", "Security", "Maids Room", "Compound"],
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"
    ],
    agentId: "user-agent-2",
    orgId: "org-agency-1",
    verificationStatus: VerificationStatus.APPROVED,
    listingStatus: ListingStatus.PUBLISHED,
    qualityScore: 94,
    createdDate: "2026-06-20T10:00:00Z",
    updatedDate: "2026-07-12T14:00:00Z",
    lastVerifiedDate: "2026-07-12T14:00:00Z",
    priceHistory: [
      { price: 4200000, date: "2026-06-20" }
    ]
  }
];

const DEFAULT_LEADS: Lead[] = [
  {
    id: "lead-1",
    propertyId: "prop-1",
    visitorName: "Ahmed Al-Mansoori",
    visitorPhone: "+974 5511 2233",
    visitorWhatsapp: "+97455112233",
    visitorEmail: "ahmed.mansoori@gmail.com",
    preferredLanguage: "Arabic",
    message: "I am interested in rent pricing and want to schedule a viewing for this weekend.",
    contactMethod: "INQUIRY",
    status: LeadStatus.ASSIGNED,
    agentId: "user-agent-1",
    orgId: "org-agency-1",
    createdDate: "2026-07-18T10:30:00Z",
    updatedDate: "2026-07-18T11:00:00Z",
    attribution: {
      source: "SEO Google",
      campaign: "Organic Search",
      utmSource: "google"
    }
  },
  {
    id: "lead-2",
    propertyId: "prop-3",
    visitorName: "John Doe",
    visitorPhone: "+974 3322 1100",
    visitorWhatsapp: "+97433221100",
    visitorEmail: "johndoe@yahoo.com",
    preferredLanguage: "English",
    message: "WhatsApp inquiry about parking amenities and move-in availability.",
    contactMethod: "WHATSAPP",
    status: LeadStatus.CONTACTED,
    agentId: "user-agent-2",
    orgId: "org-agency-1",
    createdDate: "2026-07-19T14:20:00Z",
    updatedDate: "2026-07-19T14:25:00Z",
    attribution: {
      source: "WhatsApp Direct",
      utmSource: "direct"
    }
  },
  {
    id: "lead-3",
    propertyId: "prop-2",
    visitorName: "Mariam Al-Kuwari",
    visitorPhone: "+974 6600 5500",
    visitorWhatsapp: "+97466005500",
    preferredLanguage: "Arabic",
    message: "Called Faisal Hassan about West Bay Villa pricing history and final offer guidelines.",
    contactMethod: "CALL",
    status: LeadStatus.NEW,
    agentId: "user-agent-1",
    orgId: "org-agency-1",
    createdDate: "2026-07-20T08:15:00Z",
    updatedDate: "2026-07-20T08:15:00Z",
    attribution: {
      source: "Call Intent Tracker"
    }
  }
];

const DEFAULT_VIEWINGS: ViewingRequest[] = [
  {
    id: "view-1",
    leadId: "lead-1",
    propertyId: "prop-1",
    agentId: "user-agent-1",
    preferredDate: "2026-07-24",
    preferredTimeSlot: "16:00 - 18:00",
    status: "CONFIRMED",
    notes: "Visitor requested Arabic speaking agent Faisal to accompany.",
    createdDate: "2026-07-18T11:00:00Z"
  }
];

const DEFAULT_REPORTS: SupportReport[] = [
  {
    id: "rep-1",
    propertyId: "prop-5",
    reporterEmail: "moderator_test@gmail.com",
    reporterName: "Jassim Ali",
    reason: "incorrect_price",
    details: "The compound rent has changed slightly but details were unchanged.",
    status: "OPEN",
    createdDate: "2026-07-19T16:00:00Z"
  }
];

const DEFAULT_CAMPAIGNS: AdCampaign[] = [
  {
    id: "camp-1",
    orgId: "org-agency-1",
    propertyId: "prop-2",
    type: "FEATURED_LISTING",
    budget: 1500,
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    status: "ACTIVE",
    metrics: {
      impressions: 4250,
      clicks: 340,
      saves: 85,
      leads: 12,
      spend: 645.50
    },
    createdDate: "2026-06-28T09:00:00Z"
  }
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: "log-1",
    actorId: "user-platform-admin",
    actorName: "Ameera Al-Ansari",
    actorRole: UserRole.PLATFORM_ADMIN,
    action: "VERIFIED_ORGANIZATION",
    targetId: "org-agency-1",
    targetType: "Organization",
    metadata: { orgName: "Elite Gulf Realty" },
    timestamp: "2026-03-01T08:30:00Z"
  },
  {
    id: "log-2",
    actorId: "user-agency-admin",
    actorName: "Tareq Al-Jaber",
    actorRole: UserRole.AGENCY_ADMIN,
    action: "CREATED_USER",
    targetId: "user-agent-1",
    targetType: "User",
    metadata: { agentName: "Faisal Hassan" },
    timestamp: "2026-03-05T10:15:00Z"
  }
];

export const DEFAULT_LOCATIONS: LocationItem[] = [
  // Country
  { id: "loc-qatar", name: "Qatar", nameAr: "قطر", type: "COUNTRY", isActive: true, seoSlug: "qatar" },
  
  // Municipalities
  { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "doha" },
  { id: "m-rayyan", name: "Al Rayyan", nameAr: "الريان", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-rayyan" },
  { id: "m-wakrah", name: "Al Wakrah", nameAr: "الوكرة", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-wakrah" },
  { id: "m-umsalal", name: "Umm Salal", nameAr: "أم صلال", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "umm-salal" },
  { id: "m-alkhor", name: "Al Khor and Al Thakhira", nameAr: "الخور والذخيرة", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-khor" },
  { id: "m-daayen", name: "Al Daayen", nameAr: "الظعاين", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-daayen" },
  { id: "m-shamal", name: "Al Shamal", nameAr: "الشمال", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-shamal" },
  { id: "m-shahaniya", name: "Al Shahaniya", nameAr: "الشحانية", type: "MUNICIPALITY", parentId: "loc-qatar", isActive: true, seoSlug: "al-shahaniya" },

  // Doha Areas
  { id: "a-westbay", name: "West Bay", nameAr: "الخليج الغربي", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "west-bay" },
  { id: "a-msheireb", name: "Msheireb Downtown", nameAr: "مشيرب قلب الدوحة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "msheireb" },
  { id: "a-alsadd", name: "Al Sadd", nameAr: "السد", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-sadd" },
  { id: "a-oldairport", name: "Old Airport", nameAr: "المطار القديم", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "old-airport" },
  { id: "a-binmahmoud", name: "Bin Mahmoud", nameAr: "بن محمود", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "bin-mahmoud" },
  { id: "a-alnasr", name: "Al Nasr", nameAr: "النصر", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-nasr" },
  { id: "a-fereej-abdulaziz", name: "Fereej Abdul Aziz", nameAr: "فريج عبد العزيز", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "fereej-abdul-aziz" },
  { id: "a-rumaila", name: "Al Rumaila", nameAr: "الرميلة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-rumaila" },
  { id: "a-salata", name: "Al Salata", nameAr: "السلطة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-salata" },
  { id: "a-najma", name: "Najma", nameAr: "نجمة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "najma" },
  { id: "a-ummghuwailina", name: "Umm Ghuwailina", nameAr: "أم غويلينة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "umm-ghuwailina" },
  { id: "a-alhilal", name: "Al Hilal", nameAr: "الهلال", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-hilal" },
  { id: "a-almansoura", name: "Al Mansoura", nameAr: "المنصورة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-mansoura" },
  { id: "a-doha-jadeeda", name: "Al Doha Al Jadeeda", nameAr: "الدوحة الجديدة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-doha-al-jadeeda" },
  { id: "a-wakra-road", name: "Al Wakra Road Area", nameAr: "منطقة طريق الوكرة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-wakra-road" },
  { id: "a-rawdat-khail", name: "Rawdat Al Khail", nameAr: "روضة الخيل", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "rawdat-al-khail" },
  { id: "a-althumama", name: "Al Thumama", nameAr: "الثمامة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "al-thumama" },
  { id: "a-new-salata", name: "New Salata", nameAr: "اسلطة الجديدة", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "new-salata" },

  // The Pearl / West Bay Lagoon (under Doha)
  { id: "a-pearl", name: "The Pearl-Qatar", nameAr: "لؤلؤة قطر", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "the-pearl" },
  { id: "a-westbaylagoon", name: "West Bay Lagoon", nameAr: "بحيرة الخليج الغربي", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "west-bay-lagoon" },
  { id: "a-gewanisland", name: "Gewan Island", nameAr: "جزيرة جيوان", type: "AREA", parentId: "m-doha", isActive: true, seoSlug: "gewan-island" },

  // Pearl Districts
  { id: "d-porto-arabia", name: "Porto Arabia", nameAr: "بورتو أرابيا", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "porto-arabia" },
  { id: "d-viva-bahriya", name: "Viva Bahriya", nameAr: "فيفا بحرية", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "viva-bahriya" },
  { id: "d-qanat-quartier", name: "Qanat Quartier", nameAr: "قناة كارتييه", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "qanat-quartier" },
  { id: "d-medina-centrale", name: "Medina Centrale", nameAr: "مدينا سنترال", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "medina-centrale" },
  { id: "d-abraj-quartier", name: "Abraj Quartier", nameAr: "أبراج كارتييه", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "abraj-quartier" },
  { id: "d-giardino", name: "Giardino Village", nameAr: "قرية جياردينو", type: "DISTRICT", parentId: "a-pearl", isActive: true, seoSlug: "giardino-village" },

  // Al Rayyan Areas
  { id: "a-alrayyan-area", name: "Al Rayyan", nameAr: "الريان", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-rayyan-area" },
  { id: "a-alwaab", name: "Al Waab", nameAr: "الوعب", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-waab" },
  { id: "a-ainkhaled", name: "Ain Khaled", nameAr: "عين خالد", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "ain-khaled" },
  { id: "a-aziziya", name: "Al Aziziya", nameAr: "العزيزية", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-aziziya" },
  { id: "a-muaither", name: "Muaither", nameAr: "معيذر", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "muaither" },
  { id: "a-gharrafah", name: "Al Gharrafa", nameAr: "الغرافة", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-gharrafa" },
  { id: "a-rayyan-sheehaniya", name: "Al Sheehaniya", nameAr: "الشيحانية", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-sheehaniya-rayyan" },
  { id: "a-shaghab", name: "Al Shaghab", nameAr: "الشغب", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-shaghab" },
  { id: "a-al-luqta", name: "Al Luqta", nameAr: "اللقطة", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-luqta" },
  { id: "a-education", name: "Education City", nameAr: "المدينة التعليمية", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "education-city" },
  { id: "a-baaya", name: "Baaya", nameAr: "البعيا", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "baaya" },
  { id: "a-fereej-al-amir", name: "Fereej Al Amir", nameAr: "فريج الأمير", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "fereej-al-amir" },
  { id: "a-mebaireek", name: "Mebaireek", nameAr: "مبيريك", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "mebaireek" },
  { id: "a-rawdat-jahhaniya", name: "Rawdat Al Jahhaniya", nameAr: "روضة الجهانية", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "rawdat-al-jahhaniya" },
  { id: "a-rawdat-rashed", name: "Rawdat Rashed", nameAr: "روضة راشد", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "rawdat-rashed" },
  { id: "a-themaid", name: "Al Themaid", nameAr: "الثميد", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "al-themaid" },
  { id: "a-abu-hamour", name: "Abu Hamour", nameAr: "أبو هامور", type: "AREA", parentId: "m-rayyan", isActive: true, seoSlug: "abu-hamour" },

  // Al Wakrah Areas
  { id: "a-wakrah-city", name: "Al Wakrah", nameAr: "الوكرة", type: "AREA", parentId: "m-wakrah", isActive: true, seoSlug: "al-wakrah-city" },
  { id: "a-wukair", name: "Al Wukair", nameAr: "الوكير", type: "AREA", parentId: "m-wakrah", isActive: true, seoSlug: "al-wukair" },
  { id: "a-mesaieed", name: "Mesaieed", nameAr: "مسيعيد", type: "AREA", parentId: "m-wakrah", isActive: true, seoSlug: "mesaieed" },
  { id: "a-rawdat-el-jabal", name: "Rawdat El Jabal", nameAr: "روضة الجبل", type: "AREA", parentId: "m-wakrah", isActive: true, seoSlug: "rawdat-el-jabal" },
  { id: "a-al-jafnayn", name: "Al Jafnayn", nameAr: "الجفنأين", type: "AREA", parentId: "m-wakrah", isActive: true, seoSlug: "al-jafnayn" },

  // Al Khor Areas
  { id: "a-alkhor-city", name: "Al Khor", nameAr: "الخور", type: "AREA", parentId: "m-alkhor", isActive: true, seoSlug: "al-khor-city" },
  { id: "a-althakhira", name: "Al Thakhira", nameAr: "الذخيرة", type: "AREA", parentId: "m-alkhor", isActive: true, seoSlug: "al-thakhira" },
  { id: "a-simaisma", name: "Simaisma", nameAr: "سميسمة", type: "AREA", parentId: "m-alkhor", isActive: true, seoSlug: "simaisma" },
  { id: "a-al-jeryan", name: "Al Jeryan", nameAr: "الجريان", type: "AREA", parentId: "m-alkhor", isActive: true, seoSlug: "al-jeryan" },
  { id: "a-raslaffan", name: "Ras Laffan", nameAr: "رأس لفان", type: "AREA", parentId: "m-alkhor", isActive: true, seoSlug: "ras-laffan" },

  // Umm Salal Areas
  { id: "a-ums-mohammed", name: "Umm Salal Mohammed", nameAr: "أم صلال محمد", type: "AREA", parentId: "m-umsalal", isActive: true, seoSlug: "umm-salal-mohammed" },
  { id: "a-ums-ali", name: "Umm Salal Ali", nameAr: "أم صلال علي", type: "AREA", parentId: "m-umsalal", isActive: true, seoSlug: "umm-salal-ali" },
  { id: "a-izghawa", name: "Izghawa", nameAr: "إزغوى", type: "AREA", parentId: "m-umsalal", isActive: true, seoSlug: "izghawa" },
  { id: "a-al-kharaitiyat", name: "Al Kharaitiyat", nameAr: "الخريطيات", type: "AREA", parentId: "m-umsalal", isActive: true, seoSlug: "al-kharaitiyat" },
  { id: "a-kheesa", name: "Al Kheesa", nameAr: "الخيسة", type: "AREA", parentId: "m-umsalal", isActive: true, seoSlug: "al-kheesa" },

  // Al Daayen Areas & Lusail City
  { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "lusail-city" },
  { id: "a-al-daayen-area", name: "Al Daayen Area", nameAr: "منطقة الظعاين", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "al-daayen-area" },
  { id: "a-rawdat", name: "Rawdat Al Hamama", nameAr: "روضة الحمامة", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "rawdat-al-hamama" },
  { id: "a-ummqarn", name: "Umm Qarn", nameAr: "أم قرن", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "umm-qarn" },
  { id: "a-al-egla", name: "Al Egla", nameAr: "العقلة", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "al-egla" },
  { id: "a-al-kharayej", name: "Al Kharayej", nameAr: "الخرايج", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "al-kharayej" },
  { id: "a-wadi-al-banat", name: "Wadi Al Banat", nameAr: "وادي البنات", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "wadi-al-banat" },
  { id: "a-jeryan-jenaihat", name: "Jeryan Jenaihat", nameAr: "جريان جنيحات", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "jeryan-jenaihat" },
  { id: "a-tenbek", name: "Tenbek", nameAr: "تنباك", type: "AREA", parentId: "m-daayen", isActive: true, seoSlug: "tenbek" },

  // Lusail Districts (under Lusail Area)
  { id: "d-marina", name: "Marina District", nameAr: "منطقة المارينا", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "marina-district" },
  { id: "d-foxhills", name: "Fox Hills", nameAr: "فوكس هيلز", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "fox-hills" },
  { id: "d-waterfront", name: "Waterfront District", nameAr: "المنطقة البحرية", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "waterfront-district" },
  { id: "d-boulevard", name: "Lusail Boulevard", nameAr: "بوليڤارد لوسيل", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "lucide-boulevard" },
  { id: "d-alerkyah", name: "Al Erkyah", nameAr: "الاركية", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "al-erkyah" },
  { id: "d-alqutaifiya", name: "Al Qutaifiya", nameAr: "القطيفية", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "al-qutaifiya" },
  { id: "d-energycity", name: "Energy City", nameAr: "مدينة الطاقة", type: "DISTRICT", parentId: "a-lusail", isActive: true, seoSlug: "energy-city" },

  // Al Shamal Areas
  { id: "a-ruwais", name: "Al Ruwais", nameAr: "الرويس", type: "AREA", parentId: "m-shamal", isActive: true, seoSlug: "al-ruwais" },
  { id: "a-madinat-ash-shamal", name: "Madinat ash Shamal", nameAr: "مدينة الشمال", type: "AREA", parentId: "m-shamal", isActive: true, seoSlug: "madinat-ash-shamal" },
  { id: "a-abu-dhalouf", name: "Abu Dhalouf", nameAr: "أبو ظلوف", type: "AREA", parentId: "m-shamal", isActive: true, seoSlug: "abu-dhalouf" },
  { id: "a-fuwayrit", name: "Fuwayrit", nameAr: "فويرط", type: "AREA", parentId: "m-shamal", isActive: true, seoSlug: "fuwayrit" },
  { id: "a-ain-sinan", name: "Ain Sinan", nameAr: "عين سنان", type: "AREA", parentId: "m-shamal", isActive: true, seoSlug: "ain-sinan" },

  // Al Shahaniya Areas
  { id: "a-sheehaniya-area", name: "Al Shahaniya", nameAr: "الشحانية", type: "AREA", parentId: "m-shahaniya", isActive: true, seoSlug: "al-shahaniya-city" },
  { id: "a-sheehaniya-rawdat-rashed", name: "Rawdat Rashed", nameAr: "روضة راشد", type: "AREA", parentId: "m-shahaniya", isActive: true, seoSlug: "rawdat-rashed-shahaniya" },
  { id: "a-al-utouriya", name: "Al Utouriya", nameAr: "العطورية", type: "AREA", parentId: "m-shahaniya", isActive: true, seoSlug: "al-utouriya" },
  { id: "a-al-jamilas", name: "Al Jamilas", nameAr: "الجميلية", type: "AREA", parentId: "m-shahaniya", isActive: true, seoSlug: "al-jamilas" },
  { id: "a-karaana", name: "Al Karaana", nameAr: "الكرعانة", type: "AREA", parentId: "m-shahaniya", isActive: true, seoSlug: "al-karaana" }
];

const DEFAULT_SYSTEM_HEALTH: SystemHealthStatus = {
  api: "OPERATIONAL",
  database: "OPERATIONAL",
  ai: "OPERATIONAL",
  payment: "OPERATIONAL",
  whatsapp: "OPERATIONAL",
  lastCheck: new Date().toISOString()
};

const DEFAULT_LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: "legal-tou",
    slug: "terms-of-use",
    title: "Terms of Use",
    titleAr: "شروط الاستخدام",
    content: "Welcome to Nerou Property. By accessing or using our platform, you agree to comply with and be bound by these Terms of Use. You must be at least 18 years of age and possess the legal authority to enter into this agreement. Account security is your sole responsibility. Nerou Property acts solely as an interactive search platform and does not represent itself as the broker, landlord, developer, or seller of any listed properties. Visitors, brokers, agencies, and developers must provide accurate, verified information. Fraudulent listings, scraping abuse, credential sharing, and spam are strictly prohibited. Suspension or account termination may occur upon violation of these policies under Qatari law.",
    contentAr: "مرحباً بكم في نيرو العقارية. بدخولكم واستخدامكم للمنصة، فإنكم توافقون على الالتزام بشروط الاستخدام هذه. يجب أن لا يقل عمر المستخدم عن 18 عاماً وأن يمتلك الأهلية القانونية. تقع مسؤولية أمان الحساب بالكامل على عاتقك. نيرو العقارية تعمل كمحرك بحث تفاعلي فقط ولا تقدم نفسها كمالك أو وسيط أو مطور أو بائع لأي عقار معروض. يلتزم الشركاء بتقديم معلومات صحيحة وموثوقة. يُمنع منعاً باتاً نشر إعلانات مضللة أو نسخ البيانات أو مشاركة الحسابات بشكل غير مصرح به. يحق لإدارة المنصة تعليق أو إغلاق الحسابات المخالفة بموجب القوانين والتشريعات القطرية.",
    version: "1.2.0",
    effectiveDate: "2026-01-01",
    lastUpdated: "2026-07-20",
    status: "PUBLISHED",
    author: "Nasser Al-Thani",
    legalReviewStatus: "APPROVED"
  },
  {
    id: "legal-saas",
    slug: "saas-terms",
    title: "Platform & SaaS Terms",
    titleAr: "شروط اتفاقية الخدمة السحابية",
    content: "These Platform and Software-as-a-Service (SaaS) Terms govern the commercial subscriptions for Brokers, Agencies, Developers, and Advertisers. Subscriptions provide premium workspace access, listing quotas, agent seats, and analytics. All plans are manually requested, audited, and approved. Payment is processed offline through traditional corporate bank transfers. Upon payment verification, administrative access is enabled. Plan quotas and feature limits are strictly enforced. Cancellations must be requested 30 days prior to renewal. Accounts may be suspended for billing delinquency or non-compliance with property verification standards.",
    contentAr: "تحكم شروط الخدمة السحابية (SaaS) الاشتراكات التجارية للوسطاء والمكاتب والمطورين والمعلنين. توفر الاشتراكات وصولاً للمساحة المخصصة، وحصص الإدراج، وحسابات الوكلاء والتحليلات. يتم مراجعة وتفعيل كافة خطط الاشتراك يدوياً بعد سداد الرسوم خارج المنصة عبر التحويلات البنكية. تُطبق حدود الإعلانات وعدد الوكلاء لكل باقة بدقة. يتوجب تقديم طلب الإلغاء قبل 30 يوماً من التجديد. يحق للإدارة تعليق الحسابات في حال التأخر عن السداد أو الإخلال بمعايير التوثيق.",
    version: "2.0.1",
    effectiveDate: "2026-01-01",
    lastUpdated: "2026-07-20",
    status: "PUBLISHED",
    author: "Nasser Al-Thani",
    legalReviewStatus: "APPROVED"
  },
  {
    id: "legal-privacy",
    slug: "privacy-policy",
    title: "Privacy & Data Protection",
    titleAr: "سياسة الخصوصية وحماية البيانات",
    content: "Nerou Property is committed to protecting user privacy in accordance with Qatar Law No. 13 of 2016 on Protecting Personal Data Privacy. We collect registration details, profile info, property details, search histories, saved collections, and device identifiers. This data is processed to deliver AI search matching, route inquiries directly to verified brokers, and compile performance analytics. We protect your data using industry-standard TLS encryption and secure hosting. Users hold the right to request access, correction, restriction, or permanent deletion of their personal and organizational data.",
    contentAr: "تلتزم نيرو العقارية بحماية خصوصية المستخدمين بما يتماشى مع القانون القطري رقم 13 لسنة 2016 بشأن حماية خصوصية البيانات الشخصية. نقوم بجمع بيانات التسجيل، الملفات الشخصية، تفاصيل العقارات، وتاريخ البحث. تُعالج البيانات لتقديم خدمة البحث المدعوم بالذكاء الاصطناعي وإرسال طلبات المعاينة إلى الوسطاء المعتمدين. نحمي بياناتكم باستخدام تشفير TLS والاستضافة الآمنة. يحق للمستخدمين طلب الوصول إلى بياناتهم، تعديلها، أو حذفها نهائياً من سجلاتنا.",
    version: "1.5.0",
    effectiveDate: "2026-01-01",
    lastUpdated: "2026-07-20",
    status: "PUBLISHED",
    author: "Ameera Al-Ansari",
    legalReviewStatus: "APPROVED"
  },
  {
    id: "legal-cookie",
    slug: "cookie-policy",
    title: "Cookie Policy",
    titleAr: "سياسة ملفات تعريف الارتباط",
    content: "We use cookies to improve user experience, memorize language preferences, analyze traffic flow, and personalize promotional campaigns. Essential cookies are required to maintain user sessions and security. Performance and Functional cookies save UI adjustments. Analytics cookies help optimize server loading and search results. Users can control and update their cookie preferences at any time through our central Consent Manager.",
    contentAr: "نستخدم ملفات تعريف الارتباط (الكوكيز) لتحسين تجربة المستخدم، وحفظ تفضيلات اللغة، وتحليل حركة المرور، وتخصيص الحملات الترويجية. الكوكيز الأساسية ضرورية للحفاظ على الجلسات والأمان، بينما تساعد الكوكيز التحليلية في تحسين سرعة الخادم ونتائج البحث. يمكنكم التحكم وتعديل خيارات ملفات تعريف الارتباط في أي وقت من خلال مركز إدارة التفضيلات.",
    version: "1.1.0",
    effectiveDate: "2026-01-01",
    lastUpdated: "2026-07-20",
    status: "PUBLISHED",
    author: "Ameera Al-Ansari",
    legalReviewStatus: "APPROVED"
  },
  {
    id: "legal-listing-provider",
    slug: "listing-provider-terms",
    title: "Listing Provider Terms",
    titleAr: "شروط مزودي العقارات والإعلانات",
    content: "Listing providers (independent brokers, agencies, and developers) must possess an active, valid license from the Ministry of Justice in Qatar to list properties on Nerou Finder. All property listings must be accurate, current, and legally authorized for marketing. Duplicate listings, misleading pricing, or posting properties without owner consent is strictly prohibited. Listings are subject to manual auditing by our compliance department. Failure to maintain accurate listings, respond to inquiry flags, or provide proof of licensing will result in immediate suspension of listing privileges and workspace access.",
    contentAr: "يجب على مقدمي العقارات (الوسطاء المستقلين، والمكاتب العقارية، والمطورين) حيازة ترخيص ساري المفعول من وزارة العدل في دولة قطر لإدراج العقارات في نيرو فايندر. يجب أن تكون جميع الإدراجات دقيقة ومحدثة ومرخصة قانونياً للتسويق. يُمنع منعاً باتاً تكرار الإعلانات، أو التلاعب بالأسعار، أو نشر عقارات دون موافقة المالك. تخضع جميع العقارات للمراجعة اليدوية من قبل قسم الامتثال والرقابة لدينا. سيؤدي عدم الحفاظ على دقة البيانات أو عدم تقديم وثائق الترخيص عند الطلب إلى تعليق فوري لصلاحيات النشر وحساب الشريك.",
    version: "1.0.0",
    effectiveDate: "2026-07-24",
    lastUpdated: "2026-07-24",
    status: "PUBLISHED",
    author: "Nasser Al-Thani",
    legalReviewStatus: "PENDING"
  },
  {
    id: "legal-ai-disclaimer",
    slug: "ai-disclaimer",
    title: "AI Search & Content Disclaimer",
    titleAr: "إخلاء المسؤولية عن نتائج الذكاء الاصطناعي",
    content: "Nerou Finder leverages Gemini-based AI technologies to analyze user requests, retrieve matching properties, and generate comparative summaries. While we strive to maximize accuracy, AI-generated content, scores, and match explanations are for informational purposes only and do not constitute financial, investment, or legal advice. Users must independently verify all property details, pricing, RERA status, and developer information with official registries or licensed representatives before making any financial commitments.",
    contentAr: "تستخدم منصة نيرو فايندر تقنيات الذكاء الاصطناعي المتقدمة (جيميناي) لتحليل طلبات المستخدمين وجلب العقارات المناسبة وإعداد ملخصات المقارنة. رغم سعينا لضمان دقة البيانات، فإن النتائج والتفسيرات والتقييمات الصادرة عن الذكاء الاصطناعي هي لأغراض إرشادية وتثقيفية فقط، ولا تشكل نصيحة مالية أو استثمارية أو قانونية. يتعين على المستخدمين التحقق بشكل مستقل من تفاصيل العقار والأسعار والترخيص العقاري قبل اتخاذ أي قرار استثماري.",
    version: "1.0.0",
    effectiveDate: "2026-07-24",
    lastUpdated: "2026-07-24",
    status: "PUBLISHED",
    author: "Ameera Al-Ansari",
    legalReviewStatus: "PENDING"
  },
  {
    id: "legal-advertising",
    slug: "advertising-policy",
    title: "Advertising & Sponsorship Policy",
    titleAr: "سياسة الإعلانات والتمويل",
    content: "This Advertising and Sponsorship Policy outlines the standards for paid promotions, featured listings, and brand sponsorship on Nerou Finder. Paid advertising is available to licensed developers and registered real estate agencies. Sponsored properties must comply with the same verification and regulatory standards as standard listings. Sponsored content will be clearly marked with a 'Featured' or 'Sponsored' badge. Nerou Finder reserves the right to reject any advertisement that is misleading, non-compliant with Qatari cultural standards, or lacks proper regulatory licensing.",
    contentAr: "تحدد سياسة الإعلانات والتمويل المعايير المتبعة للعقارات المميزة والحملات الترويجية المدفوعة على منصة نيرو فايندر. تتوفر خدمات الإعلان للمطورين المرخصين والمكاتب المعتمدة فقط. يجب أن تلتزم العقارات المميزة بنفس معايير التوثيق والامتثال المطبقة على باقي العقارات، وسيتم تمييزها بوضوح بملصق 'عقار مميز' أو 'ممول'. تحتفظ المنصة بالحق في رفض أي إعلان مضلل أو مخالف للقيم المجتمعية في قطر أو يفتقر للتراخيص الرقابية المطلوبة.",
    version: "1.0.0",
    effectiveDate: "2026-07-24",
    lastUpdated: "2026-07-24",
    status: "PUBLISHED",
    author: "Nasser Al-Thani",
    legalReviewStatus: "PENDING"
  }
];

const DEFAULT_HELP_ARTICLES: HelpArticle[] = [
  {
    id: "help-1",
    category: "VISITORS",
    title: "How to use AI Property Search",
    titleAr: "كيفية استخدام البحث بالذكاء الاصطناعي",
    content: "Our conversational search is powered by Gemini 3.5. Describe your requirements in natural language (e.g. 'Looking for a furnished 1 bedroom apartment in Pearl Qatar under 10000 QAR with a gym'). The AI will convert your query into filters and fetch matching properties with a clear reasoning.",
    contentAr: "محرك البحث التفاعلي لدينا مدعوم بالذكاء الاصطناعي جيميناي 3.5. صِف متطلباتك بلغة طبيعية (مثال: 'شقة مفروشة غرفة نوم واحدة في لؤلؤة قطر بسعر أقل من 10000 ريال مع صالة رياضية'). وسيقوم الذكاء الاصطناعي بتحويل طلبك إلى فلاتر وجلب العقارات المناسبة مع تقديم تفسير لكل عقار.",
    isPublished: true,
    viewCount: 154
  },
  {
    id: "help-2",
    category: "AGENTS",
    title: "Uploading Listings & Improving Quality Score",
    titleAr: "رفع العقارات وتحسين تقييم الجودة",
    content: "To gain verified status and appear higher in search results, listings must maintain a high quality score. Ensure you upload at least 3 high-resolution landscape photos, input accurate price history, define precise Qatari municipalities, and complete all technical and residential specifications.",
    contentAr: "للحصول على شارة عقار معتمد والظهور في مقدمة نتائج البحث، يجب الحفاظ على تقييم جودة مرتفع لعقاراتك. تأكد من رفع 3 صور أفقية عالية الجودة، وإدخال تاريخ أسعار دقيق، وتحديد البلدية والمنطقة بدقة، وإكمال كافة المواصفات والخدمات الفنية.",
    isPublished: true,
    viewCount: 98
  },
  {
    id: "help-3",
    category: "SUBSCRIPTIONS",
    title: "Requesting and Activating SaaS Plans",
    titleAr: "طلب وتفعيل خطط الاشتراك للشركات",
    content: "To upgrade your agency or developer workspace, navigate to the Plans section, select your plan, and click 'Request Upgrade'. Our administration team will review your business license and email an invoice. Once bank transfer is confirmed outside the system, your SaaS portal will be manually activated.",
    contentAr: "لترقية مساحة العمل لشركتك أو مكتبك العقاري، توجه لقسم الخطط واختر الباقة المطلوبة واضغط 'طلب ترقية'. سيقوم فريق الإدارة بمراجعة طلبك وإرسال الفاتورة لتسديدها عبر تحويل بنكي خارجي، وفور التأكيد سيتم تفعيل حسابك يدوياً.",
    isPublished: true,
    viewCount: 120
  }
];

const DEFAULT_JOB_LISTINGS: JobListing[] = [
  {
    id: "job-1",
    title: "Senior Enterprise Software Engineer",
    titleAr: "مهندس برمجيات أول للمؤسسات",
    department: "Engineering",
    departmentAr: "الهندسة والتقنية",
    location: "Doha, Qatar (Hybrid)",
    locationAr: "الدوحة، قطر (هجين)",
    type: "Full-Time",
    typeAr: "دوام كامل",
    description: "We are seeking a senior full-stack engineer to lead the development of our next-generation Qatar-first SaaS core database engines and AI search integration protocols.",
    descriptionAr: "نبحث عن مهندس برمجيات أول لقيادة تطوير محركات قواعد البيانات والذكاء الاصطناعي السحابية الخاصة بالمنصة وإدارة البنية التحتية.",
    requirements: ["5+ years experience with React, Node.js, and Cloud architectures", "Knowledge of relational databases and search indexing", "Bilingual in English and Arabic is a strong plus"],
    requirementsAr: ["خبرة 5 سنوات على الأقل في تطوير نظم الويب React و Node", "معرفة بقواعد البيانات والفهرسة المتقدمة للبحث", "إتقان اللغتين العربية والإنجليزية ميزة إضافية كبيرة"]
  }
];

const DEFAULT_PRESS_RELEASES: PressRelease[] = [
  {
    id: "press-1",
    title: "Nerou Property Launches Groundbreaking AI-Driven Marketplace in Qatar",
    titleAr: "نيرو العقارية تطلق أول منصة سحابية مدعومة بالذكاء الاصطناعي في قطر",
    date: "2026-07-15",
    summary: "Introducing a fully multi-tenant enterprise portal integrated with real-time location analytics, side-by-side comparison matrix, and server-side Gemini 3.5 AI.",
    summaryAr: "إطلاق منصة عقارية شاملة للشركات والوسطاء مدعومة بمحرك ذكاء اصطناعي تفاعلي وتحليلات جغرافية متطورة.",
    content: "DOHA, QATAR — Nerou Property today announced the official public deployment of its flagship real estate SaaS and marketplace hub. Operating on full-stack architecture, it delivers state-of-the-art tools including verification badges, anti-fraud warning flags, and direct WhatsApp CRM connectors.",
    contentAr: "الدوحة، قطر — أعلنت نيرو العقارية اليوم عن الإطلاق الرسمي لمنصتها السحابية المخصصة لخدمات التسويق والتطوير العقاري في قطر، مجهزة بحلول مبتكرة مثل كشف الاحتيال وشارات التوثيق المعتمدة."
  }
];

const DEFAULT_AI_CONFIG = {
  aiName: "Nerou Find",
  aiDescription: "AI-Powered Property Discovery",
  aiPersonality: "Professional, precise technology discovery companion. Neutral, compliant, Qatar-focused, informative, helpful.",
  supportedLanguages: ["English", "Arabic", "Gulf Arabic"],
  searchTaxonomy: ["Residential", "Commercial", "Off-Plan"],
  propertyTaxonomy: ["Villa", "Apartment", "Townhouse", "Compound", "Penthouse", "Studio", "Duplex", "Office", "Retail", "Shop", "Warehouse", "Building", "Land"],
  aiRules: "Never invent listings. Clearly declare that Nerou Finder does NOT act as a brokerage or receive commissions. Ground matches in real platform data. Match user constraints closely.",
  restrictedTopics: "Financial advice, legal counsel, price negotiations, representation in contracts, transaction guarantees, investment yields guarantees.",
  disclaimers: "Nerou Finder is a technology-first discovery marketplace. It does not provide real estate brokerage services, nor represent parties, nor receive commissions. The legal relationship remains between the relevant parties.",
  recommendedQuestions: [
    "Find me a villa in Lusail with private pool under 6 million QAR.",
    "Show me apartments in West Bay under 12,000 QAR/month.",
    "Find commercial offices in West Bay.",
    "Compare available properties in Pearl Qatar."
  ],
  usageLimits: 50,
  whatsappDefaultNumber: "97433334444",
  featureFlags: {
    enableStreaming: false,
    showMatchScore: true,
    strictDbFilter: true
  },
  modelConfiguration: {
    model: "gemini-3.6-flash",
    temperature: 0.1,
    maxTokens: 1000
  }
};

let dbCache: DatabaseState | null = null;
let syncQueue: Promise<any> = Promise.resolve();

export async function initDb(): Promise<DatabaseState> {
  if (dbCache) return dbCache;

  try {
    const count = await prisma.user.count();
    if (count > 0) {
      console.log("Loading existing database state from SQLite...");
      dbCache = await loadStateFromDb();
      return dbCache;
    }
  } catch (err) {
    console.warn("Could not check SQLite tables or database is uninitialized, proceeding with migration/defaults...", err);
  }

  console.log("Database is empty or missing. Migrating data.json or seeding defaults...");
  let initialState: DatabaseState;
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      initialState = JSON.parse(data);
    } catch (err) {
      initialState = getDefaults();
    }
  } else {
    initialState = getDefaults();
  }

  ensureStateDefaults(initialState);

  // Auto bcrypt-hash user passwords that are plaintext
  for (const u of initialState.users) {
    if (u.password && !u.password.startsWith("$2b$") && !u.password.startsWith("$2a$")) {
      u.password = bcrypt.hashSync(u.password, 10);
    }
  }

  // Seed the SQLite tables
  await syncStateToDb(initialState);

  dbCache = initialState;
  return dbCache;
}

function getDefaults(): DatabaseState {
  return {
    users: DEFAULT_USERS,
    organizations: DEFAULT_ORGANIZATIONS,
    projects: DEFAULT_PROJECTS,
    properties: DEFAULT_PROPERTIES,
    leads: DEFAULT_LEADS,
    viewings: DEFAULT_VIEWINGS,
    reports: DEFAULT_REPORTS,
    campaigns: DEFAULT_CAMPAIGNS,
    auditLogs: DEFAULT_AUDIT_LOGS,
    systemHealth: DEFAULT_SYSTEM_HEALTH,
    subscriptionPlans: DEFAULT_SUB_PLANS,
    locations: DEFAULT_LOCATIONS,
    legalDocuments: DEFAULT_LEGAL_DOCUMENTS,
    helpArticles: DEFAULT_HELP_ARTICLES,
    supportTickets: [],
    jobListings: DEFAULT_JOB_LISTINGS,
    pressReleases: DEFAULT_PRESS_RELEASES,
    partnershipRequests: [],
    reviews: [],
    invitations: [],
    jobApplications: [],
    aiConfig: DEFAULT_AI_CONFIG
  };
}

function ensureStateDefaults(db: DatabaseState): void {
  // Always load the complete default locations list to ensure the full official Qatar hierarchy is fully seeded
  db.locations = DEFAULT_LOCATIONS;
  if (!db.legalDocuments || db.legalDocuments.length === 0) {
    db.legalDocuments = DEFAULT_LEGAL_DOCUMENTS;
  } else {
    // Merge missing legal documents by slug to avoid missing newly added documents
    for (const d of DEFAULT_LEGAL_DOCUMENTS) {
      if (!db.legalDocuments.some(existing => existing.slug === d.slug || existing.id === d.id)) {
        db.legalDocuments.push(d);
      }
    }
  }
  if (!db.helpArticles || db.helpArticles.length === 0) db.helpArticles = DEFAULT_HELP_ARTICLES;
  if (!db.supportTickets) db.supportTickets = [];
  if (!db.jobListings || db.jobListings.length === 0) db.jobListings = DEFAULT_JOB_LISTINGS;
  if (!db.pressReleases || db.pressReleases.length === 0) db.pressReleases = DEFAULT_PRESS_RELEASES;
  if (!db.partnershipRequests) db.partnershipRequests = [];
  if (!db.reviews) db.reviews = [];
  if (!db.invitations) db.invitations = [];
  if (!db.jobApplications) db.jobApplications = [];
  if (!db.aiConfig) db.aiConfig = DEFAULT_AI_CONFIG;
}


async function loadStateFromDb(): Promise<DatabaseState> {
  const [
    users,
    organizations,
    projects,
    properties,
    leads,
    viewings,
    reports,
    campaigns,
    auditLogs,
    systemHealthRows,
    subscriptionPlans,
    locations,
    legalDocuments,
    helpArticles,
    supportTickets,
    jobListings,
    pressReleases,
    partnershipRequests,
    aiConfigRows,
    reviews,
    invitations,
    jobApplications
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.organization.findMany(),
    prisma.project.findMany(),
    prisma.property.findMany(),
    prisma.lead.findMany(),
    prisma.viewingRequest.findMany(),
    prisma.supportReport.findMany(),
    prisma.adCampaign.findMany(),
    prisma.auditLog.findMany(),
    prisma.systemHealth.findMany(),
    prisma.subscriptionPlan.findMany(),
    prisma.locationItem.findMany(),
    prisma.legalDocument.findMany(),
    prisma.helpArticle.findMany(),
    prisma.supportTicket.findMany(),
    prisma.jobListing.findMany(),
    prisma.pressRelease.findMany(),
    prisma.partnershipRequest.findMany(),
    prisma.aiConfig.findMany(),
    prisma.review.findMany(),
    prisma.invitation.findMany(),
    prisma.jobApplication.findMany()
  ]);

  return {
    users: users.map(u => JSON.parse(u.data)),
    organizations: organizations.map(o => JSON.parse(o.data)),
    projects: projects.map(p => JSON.parse(p.data)),
    properties: properties.map(p => JSON.parse(p.data)),
    leads: leads.map(l => JSON.parse(l.data)),
    viewings: viewings.map(v => JSON.parse(v.data)),
    reports: reports.map(r => JSON.parse(r.data)),
    campaigns: campaigns.map(c => JSON.parse(c.data)),
    auditLogs: auditLogs.map(a => JSON.parse(a.data)),
    systemHealth: systemHealthRows[0] ? JSON.parse(systemHealthRows[0].data) : DEFAULT_SYSTEM_HEALTH,
    subscriptionPlans: subscriptionPlans.map(p => JSON.parse(p.data)),
    locations: locations.map(l => JSON.parse(l.data)),
    legalDocuments: legalDocuments.map(l => JSON.parse(l.data)),
    helpArticles: helpArticles.map(h => JSON.parse(h.data)),
    supportTickets: supportTickets.map(s => JSON.parse(s.data)),
    jobListings: jobListings.map(j => JSON.parse(j.data)),
    pressReleases: pressReleases.map(p => JSON.parse(p.data)),
    partnershipRequests: partnershipRequests.map(p => JSON.parse(p.data)),
    reviews: reviews.map(r => JSON.parse(r.data)),
    invitations: invitations.map(i => JSON.parse(i.data)),
    jobApplications: jobApplications.map(j => JSON.parse(j.data)),
    aiConfig: aiConfigRows[0] ? JSON.parse(aiConfigRows[0].data) : DEFAULT_AI_CONFIG
  };
}

async function syncStateToDb(state: DatabaseState): Promise<void> {
  // Synchronously update data.json for robust filesystem-level persistence
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write state to data.json:", e);
  }

  try {
    // Delete all rows in collections in a single transaction
    await prisma.$transaction([
      prisma.user.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.project.deleteMany(),
      prisma.property.deleteMany(),
      prisma.lead.deleteMany(),
      prisma.viewingRequest.deleteMany(),
      prisma.supportReport.deleteMany(),
      prisma.adCampaign.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.systemHealth.deleteMany(),
      prisma.subscriptionPlan.deleteMany(),
      prisma.locationItem.deleteMany(),
      prisma.legalDocument.deleteMany(),
      prisma.helpArticle.deleteMany(),
      prisma.supportTicket.deleteMany(),
      prisma.jobListing.deleteMany(),
      prisma.pressRelease.deleteMany(),
      prisma.partnershipRequest.deleteMany(),
      prisma.aiConfig.deleteMany(),
      prisma.review.deleteMany(),
      prisma.invitation.deleteMany(),
      prisma.jobApplication.deleteMany(),
    ]);

    // Re-insert everything from state
    if (state.users.length > 0) {
      await prisma.user.createMany({
        data: state.users.map(u => ({
          id: u.id,
          email: u.email,
          role: u.role,
          data: JSON.stringify(u),
        }))
      });
    }

    if (state.organizations.length > 0) {
      await prisma.organization.createMany({
        data: state.organizations.map(o => ({
          id: o.id,
          data: JSON.stringify(o),
        }))
      });
    }

    if (state.projects.length > 0) {
      await prisma.project.createMany({
        data: state.projects.map(p => ({
          id: p.id,
          data: JSON.stringify(p),
        }))
      });
    }

    if (state.properties.length > 0) {
      await prisma.property.createMany({
        data: state.properties.map(p => ({
          id: p.id,
          listingStatus: p.listingStatus,
          verificationStatus: p.verificationStatus,
          agentId: p.agentId,
          orgId: p.orgId,
          city: p.city || null,
          propertyType: p.propertyType || null,
          price: typeof p.price === "number" ? p.price : null,
          data: JSON.stringify(p),
        }))
      });
    }

    if (state.leads.length > 0) {
      await prisma.lead.createMany({
        data: state.leads.map(l => ({
          id: l.id,
          data: JSON.stringify(l),
        }))
      });
    }

    if (state.viewings.length > 0) {
      await prisma.viewingRequest.createMany({
        data: state.viewings.map(v => ({
          id: v.id,
          data: JSON.stringify(v),
        }))
      });
    }

    if (state.reports.length > 0) {
      await prisma.supportReport.createMany({
        data: state.reports.map(r => ({
          id: r.id,
          data: JSON.stringify(r),
        }))
      });
    }

    if (state.campaigns.length > 0) {
      await prisma.adCampaign.createMany({
        data: state.campaigns.map(c => ({
          id: c.id,
          data: JSON.stringify(c),
        }))
      });
    }

    if (state.auditLogs.length > 0) {
      await prisma.auditLog.createMany({
        data: state.auditLogs.map(a => ({
          id: a.id,
          data: JSON.stringify(a),
        }))
      });
    }

    await prisma.systemHealth.create({
      data: {
        id: "health",
        data: JSON.stringify(state.systemHealth),
      }
    });

    if (state.subscriptionPlans.length > 0) {
      await prisma.subscriptionPlan.createMany({
        data: state.subscriptionPlans.map(p => ({
          id: p.id,
          data: JSON.stringify(p),
        }))
      });
    }

    if (state.locations && state.locations.length > 0) {
      await prisma.locationItem.createMany({
        data: state.locations.map(l => ({
          id: l.id,
          data: JSON.stringify(l),
        }))
      });
    }

    if (state.legalDocuments && state.legalDocuments.length > 0) {
      await prisma.legalDocument.createMany({
        data: state.legalDocuments.map(l => ({
          id: l.id,
          data: JSON.stringify(l),
        }))
      });
    }

    if (state.helpArticles && state.helpArticles.length > 0) {
      await prisma.helpArticle.createMany({
        data: state.helpArticles.map(h => ({
          id: h.id,
          data: JSON.stringify(h),
        }))
      });
    }

    if (state.supportTickets && state.supportTickets.length > 0) {
      await prisma.supportTicket.createMany({
        data: state.supportTickets.map(s => ({
          id: s.id,
          data: JSON.stringify(s),
        }))
      });
    }

    if (state.jobListings && state.jobListings.length > 0) {
      await prisma.jobListing.createMany({
        data: state.jobListings.map(j => ({
          id: j.id,
          data: JSON.stringify(j),
        }))
      });
    }

    if (state.pressReleases && state.pressReleases.length > 0) {
      await prisma.pressRelease.createMany({
        data: state.pressReleases.map(p => ({
          id: p.id,
          data: JSON.stringify(p),
        }))
      });
    }

    if (state.partnershipRequests && state.partnershipRequests.length > 0) {
      await prisma.partnershipRequest.createMany({
        data: state.partnershipRequests.map(p => ({
          id: p.id,
          data: JSON.stringify(p),
        }))
      });
    }

    if (state.reviews && state.reviews.length > 0) {
      await prisma.review.createMany({
        data: state.reviews.map(r => ({
          id: r.id,
          reviewerId: r.reviewerId,
          targetType: r.targetType,
          targetId: r.targetId,
          rating: r.rating,
          comment: r.comment,
          createdDate: r.createdDate,
          status: r.status,
          data: JSON.stringify(r),
        }))
      });
    }

    if (state.invitations && state.invitations.length > 0) {
      await prisma.invitation.createMany({
        data: state.invitations.map(i => ({
          id: i.id,
          data: JSON.stringify(i),
        }))
      });
    }

    if (state.jobApplications && state.jobApplications.length > 0) {
      await prisma.jobApplication.createMany({
        data: state.jobApplications.map(j => ({
          id: j.id,
          data: JSON.stringify(j),
        }))
      });
    }

    await prisma.aiConfig.create({
      data: {
        id: "config",
        data: JSON.stringify(state.aiConfig),
      }
    });

  } catch (err) {
    console.error("Critical error in syncStateToDb background worker:", err);
  }
}

export function readDb(): DatabaseState {
  if (!dbCache) {
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = fs.readFileSync(DB_FILE, "utf-8");
        dbCache = JSON.parse(data);
      } catch (err) {
        dbCache = getDefaults();
      }
    } else {
      dbCache = getDefaults();
    }
  }
  return dbCache!;
}

export function writeDb(state: DatabaseState): void {
  dbCache = state;
  // Queue background write to serialize SQL transactions and avoid race conditions
  syncQueue = syncQueue.then(() => syncStateToDb(state));
}


