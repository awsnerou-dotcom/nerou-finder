/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";
import { Resend } from "resend";
import { readDb, writeDb, DatabaseState, initDb, prisma, getLastSyncError, flushPendingWrites } from "./server-db.js";
import {
  UserRole,
  VerificationStatus,
  ListingStatus,
  LeadStatus,
  Lead,
  Property,
  AdCampaign,
  AuditLog,
  SupportReport,
  SubscriptionPlan,
  LegalDocument,
  HelpArticle,
  SupportTicket,
  JobListing,
  PressRelease,
  PartnershipRequest,
  DocumentType,
  DocumentStatus,
  VerificationDocument,
  VerificationContext,
  REQUIRED_DOCUMENTS_BY_CONTEXT,
  getRequiredDocumentTypes,
  AdCharge,
  AdChargeType,
  AD_CHARGE_PRICES,
  DEFAULT_MONTHLY_BOOST_CAPS,
  DEFAULT_BOOST_CAP_FALLBACK,
  JobApplication,
  Invitation,
  Organization,
  AgentType,
  ApplicationStatus,
  getEffectiveAgentType,
  getVerifiedBadgeLabel,
  getAvailabilityStaleDays,
  AVAILABILITY_CONFIRM_DUE_DAYS,
  AVAILABILITY_UNCONFIRMED_DAYS,
  AVAILABILITY_AUTO_PAUSE_DAYS
} from "./src/types.js";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Render (and most PaaS hosts) sit behind a reverse proxy - without this, express-rate-limit
// and any req.ip usage see the proxy's single IP for every request, so the login rate limit
// would be effectively shared across all users (one attacker's failed logins could lock out
// everyone else's login attempts platform-wide).
app.set("trust proxy", 1);

// Baseline security headers on every response. CSP is deliberately not set here - this app
// loads Leaflet/Unsplash/QR-code assets from several third-party origins, and a CSP added
// without carefully allowlisting all of them would break those features; that needs its own
// dedicated pass rather than being bolted on as a one-line default.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

// Fail fast rather than silently signing every session token with a public, guessable
// string - a missing JWT_SECRET in production would otherwise let anyone forge a valid
// admin token by signing their own JWT with this same hardcoded value.
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set. Refusing to start with an insecure default secret.");
  process.exit(1);
}
const JWT_SECRET: string = process.env.JWT_SECRET;

// Rate limiters for auth and discovery
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication requests per windowMs
  message: { error: "Too many authentication attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const aiSearchRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // Limit each IP to 30 AI searches per hour
  message: { error: "Too many AI discovery searches from this IP. Please try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Shared limiter for public write endpoints that were previously completely unprotected
// (leads, reports, career/partnership applications, support tickets, reviews, uploads) -
// without this, any of them could be spammed/resource-exhausted from a single IP.
const publicWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { error: "Too many requests. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads (image/PDF watermarking via sharp) are CPU-intensive per file - a tighter limit.
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many upload requests. Please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// TOTP Implementation Helpers
function decodeBase32(charString: string): Buffer {
  const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = charString.toUpperCase().replace(/[\s-]/g, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = base32chars.indexOf(cleaned[i]);
    if (val >= 0) {
      bits += val.toString(2).padStart(5, "0");
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function verifyTOTP(secret: string, token: string): boolean {
  try {
    const key = decodeBase32(secret);
    const epoch = Math.floor(Date.now() / 30000);
    for (let i = -1; i <= 1; i++) {
      const timeStep = epoch + i;
      const buffer = Buffer.alloc(8);
      const high = Math.floor(timeStep / 0x100000000);
      const low = timeStep % 0x100000000;
      buffer.writeUInt32BE(high, 0);
      buffer.writeUInt32BE(low, 4);
      
      const hmac = crypto.createHmac("sha1", key);
      hmac.update(buffer);
      const hmacResult = hmac.digest();
      
      const offset = hmacResult[hmacResult.length - 1] & 0xf;
      const code = (
        ((hmacResult[offset] & 0x7f) << 24) |
        ((hmacResult[offset + 1] & 0xff) << 16) |
        ((hmacResult[offset + 2] & 0xff) << 8) |
        (hmacResult[offset + 3] & 0xff)
      ) % 1000000;
      
      if (code.toString().padStart(6, "0") === token) {
        return true;
      }
    }
  } catch (err) {
    console.error("TOTP verification error:", err);
  }
  return false;
}

export function generateTOTPSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  const randomBytes = crypto.randomBytes(20);
  for (let i = 0; i < randomBytes.length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}


// Outbound Email: logs every email locally (visible in Control Center's Email Logs),
// and additionally delivers it for real via Resend when RESEND_API_KEY is configured.
const EMAILS_FILE = path.join(process.cwd(), "emails.json");
const resendApiKey = process.env.RESEND_API_KEY;
const resendClient = resendApiKey ? new Resend(resendApiKey) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "Nerou Finder <onboarding@resend.dev>";

// Escapes user-supplied text before it's interpolated into an HTML email template. Lead
// names/messages and signup fields are attacker-controlled and otherwise flow straight
// into raw HTML - both sent to real recipients via Resend and rendered unescaped in the
// admin Control Center's Email Logs viewer (which uses dangerouslySetInnerHTML).
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateInquiryEmailHtml(leadName: string, leadPhone: string, leadEmail: string, propTitle: string, propPrice: number, propId: string) {
  leadName = escapeHtml(leadName);
  leadPhone = escapeHtml(leadPhone);
  leadEmail = escapeHtml(leadEmail);
  propTitle = escapeHtml(propTitle);
  propId = escapeHtml(propId);
  return `
<div style="font-family: serif, 'Playfair Display', sans-serif; background-color: #1a1918; color: #fdfcfb; padding: 30px; max-width: 600px; margin: 0 auto; border: 2px solid #bf9b30; border-radius: 8px;">
  <div style="text-align: center; border-bottom: 1px solid #bf9b30; padding-bottom: 20px; margin-bottom: 20px;">
    <h1 style="color: #bf9b30; font-size: 24px; letter-spacing: 0.15em; margin: 0; font-weight: bold;">NEROU FINDER</h1>
    <p style="color: #a8a4a0; font-size: 11px; text-transform: uppercase; margin: 5px 0 0 0; letter-spacing: 0.1em;">Luxury Real Estate & SaaS Portal</p>
  </div>
  
  <div style="margin-bottom: 25px;">
    <h2 style="color: #bf9b30; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-top: 0;">New Lead Viewing Inquiry Received</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #e6e2de;">An active lead inquiry has been registered on one of your exclusive listed assets on Nerou Finder.</p>
  </div>
  
  <div style="background-color: #24211e; padding: 15px; border-radius: 6px; border-left: 3px solid #bf9b30; margin-bottom: 25px;">
    <h3 style="color: #bf9b30; font-size: 14px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">Lead Contact Profile</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e6e2de;">
      <tr>
        <td style="padding: 4px 0; font-weight: bold; width: 30%; color: #a8a4a0;">Full Name:</td>
        <td style="padding: 4px 0;">${leadName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Phone Number:</td>
        <td style="padding: 4px 0;">${leadPhone}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Email Address:</td>
        <td style="padding: 4px 0;">${leadEmail}</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #24211e; padding: 15px; border-radius: 6px; border-left: 3px solid #bf9b30; margin-bottom: 25px;">
    <h3 style="color: #bf9b30; font-size: 14px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">Target Asset Details</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e6e2de;">
      <tr>
        <td style="padding: 4px 0; font-weight: bold; width: 30%; color: #a8a4a0;">Property Title:</td>
        <td style="padding: 4px 0; font-weight: bold;">${propTitle}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Asset Cost:</td>
        <td style="padding: 4px 0; color: #bf9b30; font-weight: bold;">${propPrice.toLocaleString()} QAR</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">System ID:</td>
        <td style="padding: 4px 0; font-family: monospace;">${propId}</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; font-size: 11px; color: #8c847a; border-top: 1px solid #333; padding-top: 15px; margin-top: 25px;">
    <p>This is an automated notification of Nerou Technology Services. All lead distributions are idempotent and logged under GDPR guidelines.</p>
    <p style="color: #bf9b30;">Nerou Finder • Doha, Qatar • nerou.io</p>
  </div>
</div>
`;
}

export function generateSubscriptionRequestEmailHtml(orgName: string, adminName: string, email: string, phone: string, planName: string, price: number) {
  orgName = escapeHtml(orgName);
  adminName = escapeHtml(adminName);
  email = escapeHtml(email);
  phone = escapeHtml(phone);
  planName = escapeHtml(planName);
  return `
<div style="font-family: serif, 'Playfair Display', sans-serif; background-color: #1a1918; color: #fdfcfb; padding: 30px; max-width: 600px; margin: 0 auto; border: 2px solid #bf9b30; border-radius: 8px;">
  <div style="text-align: center; border-bottom: 1px solid #bf9b30; padding-bottom: 20px; margin-bottom: 20px;">
    <h1 style="color: #bf9b30; font-size: 24px; letter-spacing: 0.15em; margin: 0; font-weight: bold;">NEROU FINDER</h1>
    <p style="color: #a8a4a0; font-size: 11px; text-transform: uppercase; margin: 5px 0 0 0; letter-spacing: 0.1em;">Enterprise Partner Program</p>
  </div>
  
  <div style="margin-bottom: 25px;">
    <h2 style="color: #bf9b30; font-size: 18px; border-bottom: 1px solid #333; padding-bottom: 8px; margin-top: 0;">New Partner Registration & SaaS Request</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #e6e2de;">A new real estate agency or developer partner has registered a portal account and submitted a subscription request for a premium SaaS tier.</p>
  </div>
  
  <div style="background-color: #24211e; padding: 15px; border-radius: 6px; border-left: 3px solid #bf9b30; margin-bottom: 25px;">
    <h3 style="color: #bf9b30; font-size: 14px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">Requested SaaS Tier Details</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e6e2de;">
      <tr>
        <td style="padding: 4px 0; font-weight: bold; width: 35%; color: #a8a4a0;">SaaS Plan Requested:</td>
        <td style="padding: 4px 0; font-weight: bold; color: #bf9b30; font-size: 15px;">${planName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Monthly License Fee:</td>
        <td style="padding: 4px 0; font-weight: bold; color: #bf9b30;">${price.toLocaleString()} QAR / month</td>
      </tr>
    </table>
  </div>

  <div style="background-color: #24211e; padding: 15px; border-radius: 6px; border-left: 3px solid #bf9b30; margin-bottom: 25px;">
    <h3 style="color: #bf9b30; font-size: 14px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase;">Organization Account Profile</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e6e2de;">
      <tr>
        <td style="padding: 4px 0; font-weight: bold; width: 35%; color: #a8a4a0;">Enterprise Name:</td>
        <td style="padding: 4px 0; font-weight: bold;">${orgName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Account Administrator:</td>
        <td style="padding: 4px 0;">${adminName}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Email Address:</td>
        <td style="padding: 4px 0;">${email}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-weight: bold; color: #a8a4a0;">Contact Phone:</td>
        <td style="padding: 4px 0;">${phone}</td>
      </tr>
    </table>
  </div>

  <div style="padding: 10px; background-color: #33241b; border: 1px dashed #bf9b30; border-radius: 6px; text-align: center; margin-bottom: 25px;">
    <p style="margin: 0; font-size: 12px; color: #f3dfb6; font-weight: bold;">Action Required: Review in Admin Control Center</p>
    <p style="margin: 5px 0 0 0; font-size: 11px; color: #e6e2de;">This account's listings and services will be disabled until manually verified and set to ACTIVE by a Platform Admin.</p>
  </div>

  <div style="text-align: center; font-size: 11px; color: #8c847a; border-top: 1px solid #333; padding-top: 15px; margin-top: 25px;">
    <p>Nerou Technology Services Partner Pipeline Management Module.</p>
    <p style="color: #bf9b30;">Doha, State of Qatar</p>
  </div>
</div>
`;
}

export function generateSubscriptionApprovedEmailHtml(orgName: string, planName: string, expiryDate: string, limits: { properties: number; agents: number; aiQuota: number }) {
  orgName = escapeHtml(orgName);
  planName = escapeHtml(planName);
  return `
<div style="font-family: serif, 'Playfair Display', sans-serif; background-color: #1a1918; color: #fdfcfb; padding: 30px; max-width: 600px; margin: 0 auto; border: 2px solid #bf9b30; border-radius: 8px;">
  <div style="text-align: center; border-bottom: 1px solid #bf9b30; padding-bottom: 20px; margin-bottom: 20px;">
    <h1 style="color: #bf9b30; font-size: 24px; letter-spacing: 0.15em; margin: 0; font-weight: bold;">NEROU FINDER</h1>
    <p style="color: #a8a4a0; font-size: 11px; text-transform: uppercase; margin: 5px 0 0 0; letter-spacing: 0.1em;">Activation Certificate</p>
  </div>
  
  <div style="margin-bottom: 25px; text-align: center;">
    <span style="display: inline-block; padding: 4px 12px; background-color: #166534; color: #bbf7d0; font-size: 10px; font-weight: bold; border-radius: 12px; text-transform: uppercase; margin-bottom: 15px; letter-spacing: 0.05em;">Approved & Verified</span>
    <h2 style="color: #bf9b30; font-size: 20px; margin: 0;">SaaS Subscription Activated!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #e6e2de; margin-top: 10px;">Congratulations! Your registered organization, <strong style="color: white;">${orgName}</strong>, has been verified and fully approved for the <strong style="color: #bf9b30;">${planName}</strong> SaaS tier on the Nerou Finder platform.</p>
  </div>
  
  <div style="background-color: #24211e; padding: 15px; border-radius: 6px; border: 1px solid #bf9b30/30; margin-bottom: 25px;">
    <h3 style="color: #bf9b30; font-size: 13px; margin-top: 0; margin-bottom: 10px; text-transform: uppercase; text-align: center;">Active SLA Parameters & Tier Limits</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e6e2de;">
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 8px 0; font-weight: bold; color: #a8a4a0;">SaaS Tier Template:</td>
        <td style="padding: 8px 0; font-weight: bold; text-align: right; color: white;">${planName}</td>
      </tr>
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 8px 0; font-weight: bold; color: #a8a4a0;">Active Listing Seats:</td>
        <td style="padding: 8px 0; text-align: right; color: #bf9b30; font-weight: bold;">${limits.properties} Properties Max</td>
      </tr>
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 8px 0; font-weight: bold; color: #a8a4a0;">Agent Workspace Seats:</td>
        <td style="padding: 8px 0; text-align: right; color: #bf9b30; font-weight: bold;">${limits.agents} Members Max</td>
      </tr>
      <tr style="border-bottom: 1px solid #333;">
        <td style="padding: 8px 0; font-weight: bold; color: #a8a4a0;">Monthly AI Assistant Quota:</td>
        <td style="padding: 8px 0; text-align: right; color: #bf9b30; font-weight: bold;">${limits.aiQuota} Smart Queries</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold; color: #a8a4a0;">License Expiry Date:</td>
        <td style="padding: 8px 0; text-align: right; color: white;">${expiryDate}</td>
      </tr>
    </table>
  </div>

  <div style="text-align: center; margin-bottom: 25px;">
    <p style="font-size: 13px; color: #e6e2de; margin-bottom: 15px;">You may now log in to your premium dashboard and begin listing properties, building campaigns, and receiving AI lead insights instantly.</p>
    <a href="https://nerou.io/login" style="display: inline-block; padding: 12px 25px; background-color: #bf9b30; color: #000; font-weight: bold; text-decoration: none; border-radius: 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em;">Access Partner Portal</a>
  </div>

  <div style="text-align: center; font-size: 11px; color: #8c847a; border-top: 1px solid #333; padding-top: 15px; margin-top: 25px;">
    <p>Thank you for partnering with Nerou Technology Services. We are excited to fuel your real estate distribution pipeline.</p>
    <p style="color: #bf9b30;">Nerou Technology Services • Doha, Qatar</p>
  </div>
</div>
`;
}

export function sendMockEmail(to: string, subject: string, html: string, type: string) {
  const id = `em-${Date.now()}`;
  const sentDate = new Date().toISOString();
  const emailLog = { id, to, subject, html, sentDate, type };

  let emails: any[] = [];
  if (fs.existsSync(EMAILS_FILE)) {
    try {
      emails = JSON.parse(fs.readFileSync(EMAILS_FILE, "utf-8"));
    } catch (e) {
      emails = [];
    }
  }
  emails.unshift(emailLog);
  if (emails.length > 200) {
    emails = emails.slice(0, 200);
  }
  fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2), "utf-8");

  console.log(`
\x1b[33m+=============================================================================+
|                      NEROU OUTBOUND SMTP EMULATOR (MOCK LOG)                |
+=============================================================================+\x1b[0m
\x1b[36mID:\x1b[0m ${id}
\x1b[36mTo:\x1b[0m ${to}
\x1b[36mSubject:\x1b[0m ${subject}
\x1b[36mDate:\x1b[0m ${sentDate}
\x1b[36mType:\x1b[0m ${type}
\x1b[33m+-----------------------------------------------------------------------------+
|                          HTML EMAIL BODY (PREVIEW)                          |
+-----------------------------------------------------------------------------+\x1b[0m
${html.replace(/<[^>]*>/g, " ").trim().substring(0, 400)}...
\x1b[33m+=============================================================================+\x1b[0m
  `);

  // Real delivery (fire-and-forget so callers never have to await email sending)
  if (resendClient) {
    resendClient.emails.send({ from: EMAIL_FROM, to, subject, html }).catch(err => {
      console.error(`Failed to deliver email via Resend (to: ${to}, type: ${type}):`, err?.message || err);
    });
  }
}

export interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    role: string;
    fullName: string;
  };
}

export function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token missing or invalid. Please sign in." });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token. Please sign in again." });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !allowedRoles.includes(authReq.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions." });
    }
    next();
  };
}

// Multer multi-image upload setup
const uploadsDir = path.join(process.cwd(), "assets", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const ALLOWED_UPLOAD_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

// multer's fileFilter only checks the client-supplied Content-Type header, which is fully
// attacker-controlled - a file with arbitrary bytes and a spoofed "image/jpeg" header would
// otherwise be accepted and served back statically from /assets/uploads. This checks the
// actual leading bytes on disk against each allowed type's real file signature.
function fileMatchesDeclaredType(buffer: Buffer, mimetype: string): boolean {
  const startsWith = (bytes: number[]) => bytes.every((b, i) => buffer[i] === b);
  switch (mimetype) {
    case "image/jpeg": return startsWith([0xff, 0xd8, 0xff]);
    case "image/png": return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif": return startsWith([0x47, 0x49, 0x46, 0x38]); // "GIF8"
    case "image/webp": return startsWith([0x52, 0x49, 0x46, 0x46]) && buffer.slice(8, 12).toString("ascii") === "WEBP";
    case "application/pdf": return startsWith([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    default: return false;
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 20
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only JPG, PNG, WEBP, GIF, and PDF files are allowed."));
    }
  }
});

// Shared lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in your secrets.");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper to log platform audits
function logAudit(actorId: string, actorName: string, role: UserRole | string, action: string, targetId: string, targetType: string, metadata?: any) {
  const db = readDb();
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    actorId,
    actorName,
    actorRole: role as UserRole,
    action,
    targetId,
    targetType,
    metadata,
    timestamp: new Date().toISOString()
  };
  db.auditLogs.unshift(newLog);
  writeDb(db);
}

// Derives the audit-log actor from the verified JWT (req.user), never from req.body -
// req.body is client-controlled, so trusting it here would let any caller attribute
// admin actions to an arbitrary actorId/actorName/actorRole in the audit trail.
function getAuditActor(req: express.Request): { id: string; name: string; role: UserRole } {
  const user = (req as AuthenticatedRequest).user;
  return {
    id: user?.id || "unknown",
    name: user?.fullName || "Unknown",
    role: (user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
  };
}

// Strips the bcrypt password hash before a user record is ever sent over the wire -
// used on every response that includes a full user object (login/signup/profile
// updates/admin lookups), not just the plain GET /api/users list.
function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, "password"> {
  const { password, ...safe } = user;
  return safe;
}

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// System Health Check. Serves both the admin Control Center's health tab (systemHealth
// object) and external uptime monitors (status/database/uptime fields per OPERATIONS.md) -
// previously registered twice, where the first (this one) always shadowed the second, more
// thorough handler, which checked real Postgres connectivity but could never actually run.
app.get("/api/health", async (req, res) => {
  const db = readDb();
  db.systemHealth.lastCheck = new Date().toISOString();
  writeDb(db);

  const syncError = getLastSyncError();
  try {
    await prisma.user.count();
    res.status(200).json({
      status: "ok",
      systemHealth: db.systemHealth,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "CONNECTED",
      environment: process.env.NODE_ENV || "development",
      lastSyncError: syncError
    });
  } catch (error: any) {
    logStructuredError("/api/health", error, req);
    res.status(500).json({
      status: "error",
      systemHealth: db.systemHealth,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "DISCONNECTED",
      environment: process.env.NODE_ENV || "development",
      error: error.message,
      lastSyncError: syncError
    });
  }
});

app.use("/api/admin", authMiddleware, requireRole([UserRole.PLATFORM_ADMIN]));

// Update System Health Indicator (Platform Admin action)
app.post("/api/admin/health/update", (req, res) => {
  const { api, database, ai, payment, whatsapp } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (api) db.systemHealth.api = api;
  if (database) db.systemHealth.database = database;
  if (ai) db.systemHealth.ai = ai;
  if (payment) db.systemHealth.payment = payment;
  if (whatsapp) db.systemHealth.whatsapp = whatsapp;
  db.systemHealth.lastCheck = new Date().toISOString();
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "UPDATE_SYSTEM_HEALTH",
    "system-health",
    "SystemHealth",
    { api, database, ai, payment, whatsapp }
  );

  res.json({ success: true, systemHealth: db.systemHealth });
});

// Auth Simulator / Real Login
app.post("/api/auth/login", authRateLimiter, (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  // Validate password if it is set in user record
  if (user.password) {
    const isMatched = bcrypt.compareSync(password, user.password);
    if (!isMatched) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }
  }

  // 2FA check
  if ((user as any).twoFactorEnabled) {
    return res.json({ require2fa: true, userId: user.id });
  }

  // Issue JWT Token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ user: sanitizeUser(user), token });
});

// TOTP 2FA Login Verification
app.post("/api/auth/login-2fa", authRateLimiter, (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) {
    return res.status(400).json({ error: "User ID and verification code are required." });
  }
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const verified = verifyTOTP((user as any).twoFactorSecret, code);
  if (!verified) {
    return res.status(401).json({ error: "Invalid 2FA code. Please try again." });
  }

  // Issue JWT Token upon successful verification
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ user: sanitizeUser(user), token });
});

// 2FA Setup Setup (generate secret + qr code)
app.post("/api/auth/2fa/setup", authMiddleware, (req, res) => {
  const user = (req as any).user;
  const secret = generateTOTPSecret();
  const otpauthUrl = `otpauth://totp/NerouFinder:${encodeURIComponent(user.email)}?secret=${secret}&issuer=NerouFinder`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
  res.json({ secret, qrCodeUrl });
});

// 2FA Enable (verify code and enable)
app.post("/api/auth/2fa/enable", authMiddleware, (req, res) => {
  const { secret, code } = req.body;
  const authUser = (req as any).user;
  if (!secret || !code) {
    return res.status(400).json({ error: "Secret and verification code are required." });
  }

  const verified = verifyTOTP(secret, code);
  if (!verified) {
    return res.status(400).json({ error: "Invalid code. Setup verification failed." });
  }

  const db = readDb();
  const idx = db.users.findIndex(u => u.id === authUser.id);
  if (idx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  (db.users[idx] as any).twoFactorEnabled = true;
  (db.users[idx] as any).twoFactorSecret = secret;
  writeDb(db);

  res.json({ success: true, message: "Two-Factor Authentication successfully enabled." });
});

// 2FA Disable
app.post("/api/auth/2fa/disable", authMiddleware, (req, res) => {
  const authUser = (req as any).user;
  const { password } = req.body;
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === authUser.id);
  if (idx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  // Require the current password before disabling 2FA - without this, a stolen/hijacked
  // JWT alone (e.g. via XSS) would be enough to permanently strip 2FA off an account.
  const currentPasswordHash = db.users[idx].password;
  if (currentPasswordHash) {
    if (!password || !bcrypt.compareSync(password, currentPasswordHash)) {
      return res.status(401).json({ error: "Current password is required to disable Two-Factor Authentication." });
    }
  }

  (db.users[idx] as any).twoFactorEnabled = false;
  (db.users[idx] as any).twoFactorSecret = undefined;
  writeDb(db);

  res.json({ success: true, message: "Two-Factor Authentication successfully disabled." });
});

// Real Signup
// Security-critical: only these roles may ever be self-assigned via public signup.
// PLATFORM_ADMIN/SUPER_ADMIN accounts must be created through a separate, protected path
// (e.g. a trusted admin creating one directly), never handed out to whatever the client sends.
const SELF_SIGNUP_ALLOWED_ROLES = [UserRole.AGENT, UserRole.AGENCY_ADMIN, UserRole.DEVELOPER_ADMIN, UserRole.REGISTERED];
app.post("/api/auth/signup", authRateLimiter, (req, res) => {
  const { email, password, fullName, phone, role, orgName, orgType, selectedPlanId, inviteToken } = req.body;
  const db = readDb();

  if (role && !SELF_SIGNUP_ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role for self-service signup." });
  }

  // Check if user already exists
  const exists = db.users.find(u => u.email === email);
  if (exists) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  let orgId: string | undefined = undefined;
  let effectiveRole = role;
  // Onboarding approval-gate pipeline state (FIX3). Left undefined for REGISTERED/VISITOR
  // and for any role that doesn't go through the gate - undefined is always treated as
  // "grandfathered / active" everywhere this field is read.
  let applicationStatus: ApplicationStatus | undefined;

  // If signing up via a team invitation, honor the invited org + role instead of the form's own selection
  let consumedInvitation: Invitation | undefined;
  if (inviteToken) {
    if (!db.invitations) db.invitations = [];
    const invitation = db.invitations.find(inv => inv.token === inviteToken);
    if (invitation && invitation.status === "PENDING" && new Date(invitation.expiresDate) >= new Date()) {
      orgId = invitation.orgId;
      effectiveRole = invitation.invitedRole;
      consumedInvitation = invitation;
    }
  }

  // If role is AGENCY_ADMIN or DEVELOPER_ADMIN, create organization
  if (!orgId && (effectiveRole === UserRole.AGENCY_ADMIN || effectiveRole === UserRole.DEVELOPER_ADMIN)) {
    orgId = `org-${Date.now()}`;
    const targetPlanId = selectedPlanId || (orgType === "DEVELOPER" ? "plan-developer" : "plan-basic");
    // Defensive fallback: db.subscriptionPlans is self-healed on every server boot, but a new
    // org signup must never hard-crash even in the unlikely event it's still empty somehow.
    const matchedPlan = db.subscriptionPlans.find(p => p.id === targetPlanId) || db.subscriptionPlans[0]
      || { name: targetPlanId, priceMonthly: 0 };

    const newOrg = {
      id: orgId,
      name: orgName || `${fullName}'s Group`,
      logoUrl: orgType === "DEVELOPER"
        ? "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=200&h=200&q=80"
        : "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&h=200&q=80",
      type: orgType || "AGENCY",
      email,
      phone,
      whatsapp: phone,
      verificationStatus: VerificationStatus.APPROVED,
      subscriptionPlanId: targetPlanId,
      subscriptionStatus: "PENDING_APPROVAL" as any,
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      createdDate: new Date().toISOString()
    };
    db.organizations.push(newOrg);
    // A brand-new AGENCY_ADMIN/DEVELOPER_ADMIN signup (this is the only way these roles sign
    // up today - there is no admin invite flow for them) must clear the onboarding pipeline
    // before getting full workspace access.
    applicationStatus = ApplicationStatus.PENDING_APPROVAL;
    logAudit("system", "System", UserRole.PLATFORM_ADMIN, "REGISTER_ORGANIZATION", orgId, "Organization", { name: newOrg.name });

    // Send transactional email log for subscription request
    const reqEmailHtml = generateSubscriptionRequestEmailHtml(
      newOrg.name,
      fullName,
      email,
      phone || "Not specified",
      matchedPlan.name,
      matchedPlan.priceMonthly
    );
    sendMockEmail("admin@nerou.io", `[Nerou Finder] New SaaS Subscription Request: ${newOrg.name}`, reqEmailHtml, "subscription_request");
  }
  // Agents signing up without an invitation remain unaffiliated (orgId undefined) until they
  // either receive/accept an agency invite or an agency admin links them manually.

  // FIX1/FIX3: split AGENT signups into INDEPENDENT_AGENT (self-signup, no invite - gated by
  // the onboarding pipeline, carries their own subscription) vs AGENCY_AGENT (invited by an
  // agency - immediately ACTIVE, access instead governed live by their agency's subscription).
  let agentType: AgentType | undefined;
  if (effectiveRole === UserRole.AGENT) {
    agentType = consumedInvitation ? AgentType.AGENCY_AGENT : AgentType.INDEPENDENT_AGENT;
    applicationStatus = consumedInvitation ? ApplicationStatus.ACTIVE : ApplicationStatus.PENDING_APPROVAL;
  }

  const userId = `user-${Date.now()}`;
  const hashedPassword = bcrypt.hashSync(password || "nerou123", 10);
  const newUser = {
    id: userId,
    email,
    password: hashedPassword,
    fullName,
    phone,
    whatsapp: phone,
    role: effectiveRole || UserRole.AGENT,
    orgId,
    agentType,
    applicationStatus,
    avatarUrl: `https://images.unsplash.com/photo-${effectiveRole === UserRole.AGENT ? "1560250097-0b93528c311a" : "1472099645785-5658abf4ff4e"}?auto=format&fit=crop&w=200&h=200&q=80`,
    bio: effectiveRole === UserRole.AGENT ? "Professional real estate specialist." : "Administrator account.",
    languages: ["English", "Arabic"],
    specialties: ["Pearl Qatar", "West Bay"],
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: new Date().toISOString()
  };

  db.users.push(newUser);

  if (consumedInvitation) {
    consumedInvitation.status = "ACCEPTED";
  }

  writeDb(db);

  logAudit(userId, fullName, effectiveRole, "USER_SIGNUP", userId, "User", { email, viaInvitation: !!consumedInvitation });

  // FIX 9: welcome email to the new user themself - previously only admins were ever notified
  // (and only for org signups), the new user got nothing.
  sendMockEmail(
    email,
    "[Nerou Finder] Welcome to Nerou Finder",
    generateNotificationEmailHtml(
      "Welcome to Nerou Finder",
      fullName,
      `<p>Your account has been created successfully. You can now sign in to your dashboard.</p>`
    ),
    "welcome"
  );

  // Issue JWT Token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, fullName: newUser.fullName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ user: sanitizeUser(newUser), token });
});


// GET dynamic Locations from database
app.get("/api/locations", (req, res) => {
  const db = readDb();
  res.json(db.locations || []);
});

// Admin Manage Locations
app.post("/api/admin/locations", (req, res) => {
  const { id, name, nameAr, type, parentId, latitude, longitude, seoSlug, isActive } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.locations) db.locations = [];

  const isEdit = !!id;
  if (isEdit) {
    const idx = db.locations.findIndex(l => l.id === id);
    if (idx !== -1) {
      db.locations[idx] = {
        id,
        name,
        nameAr,
        type,
        parentId,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        seoSlug,
        isActive: isActive !== undefined ? !!isActive : true
      };
      writeDb(db);
      logAudit(actor.id, actor.name, actor.role, "EDIT_LOCATION", id, "Location", { name });
      return res.json({ success: true, location: db.locations[idx] });
    }
  }

  const newId = `loc-${Date.now()}`;
  const newLoc = {
    id: newId,
    name,
    nameAr,
    type,
    parentId,
    latitude: latitude ? Number(latitude) : undefined,
    longitude: longitude ? Number(longitude) : undefined,
    seoSlug: seoSlug || name.toLowerCase().replace(/\s+/g, "-"),
    isActive: true
  };
  db.locations.push(newLoc);
  writeDb(db);
  logAudit(actor.id, actor.name, actor.role, "CREATE_LOCATION", newId, "Location", { name });
  res.json({ success: true, location: newLoc });
});

// Security-critical: this endpoint is intentionally public (unauthenticated) - the public
// storefront (VisitorExperience) uses it to resolve agent/org display names for anyone
// browsing, and it's also the data source for the admin Users directory. It must NEVER
// return the bcrypt password hash regardless of caller, which it previously did unconditionally.
app.get("/api/users", (req, res) => {
  const db = readDb();
  res.json(db.users.map(({ password, ...safe }) => safe));
});

// Update own profile (Agent/Agency/Developer "Save Profile Changes" forms), or any user if PLATFORM_ADMIN
app.patch("/api/users/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const actor = authReq.user;
  if (!actor) return res.status(401).json({ error: "Access token missing or invalid." });
  if (actor.id !== id && actor.role !== UserRole.PLATFORM_ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    return res.status(403).json({ error: "You may only update your own profile." });
  }

  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found." });

  // Whitelist: profile fields only. Role, email, password, verificationStatus, and orgId
  // all have their own dedicated admin/auth endpoints and must not be changed here.
  const { fullName, phone, whatsapp, bio, languages, specialties, avatarUrl, affiliatedAgencyName } = req.body;
  const existing = db.users[idx] as any;
  if (fullName !== undefined) existing.fullName = fullName;
  if (phone !== undefined) existing.phone = phone;
  if (whatsapp !== undefined) existing.whatsapp = whatsapp;
  if (bio !== undefined) existing.bio = bio;
  if (languages !== undefined) existing.languages = languages;
  if (specialties !== undefined) existing.specialties = specialties;
  if (avatarUrl !== undefined) existing.avatarUrl = avatarUrl;
  if (affiliatedAgencyName !== undefined) existing.affiliatedAgencyName = affiliatedAgencyName;

  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "UPDATE_USER_PROFILE", id, "User", { fullName, phone, whatsapp });

  if (existing.email) {
    sendMockEmail(
      existing.email,
      "[Nerou Finder] Your Profile Was Updated",
      generateNotificationEmailHtml(
        "Profile Updated",
        existing.fullName,
        `<p>Your account profile was just updated. If you did not make this change, please contact support immediately.</p>`
      ),
      "profile_updated"
    );
  }

  res.json({ success: true, user: sanitizeUser(db.users[idx]) });
});

// Change own password. A user may only change their own password - never another user's,
// even a PLATFORM_ADMIN (admin password resets, if ever needed, are a separate concern).
app.post("/api/users/:id/change-password", authMiddleware, (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const actor = authReq.user;
  if (!actor) return res.status(401).json({ error: "Access token missing or invalid." });
  if (actor.id !== id) {
    return res.status(403).json({ error: "You may only change your own password." });
  }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required." });
  }

  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found." });
  const user = db.users[idx];

  if (!user.password || !bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  (user as any).password = bcrypt.hashSync(newPassword, 10);
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role as UserRole, "CHANGE_PASSWORD", id, "User", {});

  if (user.email) {
    sendMockEmail(
      user.email,
      "[Nerou Finder] Your Password Was Changed",
      generateNotificationEmailHtml(
        "Password Changed",
        user.fullName,
        `<p>Your account password was just changed. If you did not make this change, please contact support immediately.</p>`
      ),
      "security_password_changed"
    );
  }

  res.json({ success: true });
});

// Properties API
app.get("/api/properties", (req, res) => {
  const db = readDb();
  let properties = db.properties;

  // Search filter implementation
  const {
    city,
    district,
    propertyType,
    transactionType,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    minArea,
    furnished,
    verifiedOnly,
    orgId,
    searchQuery,
    includeAllStatuses
  } = req.query;

  // FIX 1: public/search callers only ever see live listings by default - Sold/Rented/Draft/
  // Suspended listings used to leak into every search result because this filter didn't
  // exist. Agent/agency/admin dashboards pass includeAllStatuses=true to see their full
  // history (own listings in every status) instead.
  if (includeAllStatuses !== "true") {
    properties = properties.filter(p => p.listingStatus === ListingStatus.PUBLISHED);
  }

  if (city) {
    properties = properties.filter(p => p.city.toLowerCase() === (city as string).toLowerCase());
  }
  if (district) {
    properties = properties.filter(p => p.district.toLowerCase() === (district as string).toLowerCase());
  }
  if (propertyType) {
    properties = properties.filter(p => p.propertyType === propertyType);
  }
  if (transactionType) {
    properties = properties.filter(p => p.transactionType === transactionType);
  }
  if (minPrice) {
    properties = properties.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice) {
    properties = properties.filter(p => p.price <= Number(maxPrice));
  }
  if (bedrooms) {
    properties = properties.filter(p => p.bedrooms === Number(bedrooms));
  }
  if (bathrooms) {
    properties = properties.filter(p => p.bathrooms === Number(bathrooms));
  }
  if (minArea) {
    properties = properties.filter(p => p.area >= Number(minArea));
  }
  if (furnished) {
    properties = properties.filter(p => p.furnished === furnished);
  }
  if (verifiedOnly === "true") {
    properties = properties.filter(p => p.verificationStatus === VerificationStatus.APPROVED);
  }
  if (orgId) {
    properties = properties.filter(p => p.orgId === orgId);
  }
  if (searchQuery) {
    const q = (searchQuery as string).toLowerCase();
    properties = properties.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q)
    );
  }

  // Smart Budget Pacing for Featured campaigns: among AdCharge type FEATURED whose
  // billingPeriod covers today (i.e. equals the current "YYYY-MM" period - see
  // getCurrentBillingPeriod() below, and not yet rolled into an expired past period), rotate
  // which one gets "front of queue" placement so whichever org boosted first doesn't
  // permanently win the top slot. Rotation key is the current hour-of-day, cycled modulo the
  // number of active Featured listings - deterministic within an hour, and over a full day
  // every active Featured listing gets roughly equal time at the front. Purely additive: it
  // only affects relative order among Featured listings and does not change whether a
  // non-Featured listing shows up.
  const currentBillingPeriodForRotation = getCurrentBillingPeriod();
  const activeFeaturedPropertyIds = Array.from(
    new Set(
      (db.adCharges || [])
        .filter(c => c.type === "FEATURED" && c.billingPeriod === currentBillingPeriodForRotation)
        .map(c => c.propertyId)
    )
  ).sort(); // stable base order (by id) before the hourly rotation offset is applied
  const rotationOffset = activeFeaturedPropertyIds.length > 0 ? new Date().getHours() % activeFeaturedPropertyIds.length : 0;
  const rotatedFeaturedIds = [
    ...activeFeaturedPropertyIds.slice(rotationOffset),
    ...activeFeaturedPropertyIds.slice(0, rotationOffset)
  ];
  const featuredRotationRank = new Map(rotatedFeaturedIds.map((id, i) => [id, i]));

  // Modest default-ranking penalty: no explicit sort is requested here (callers - the public
  // search UI, agent/agency/developer dashboards - each apply their own further sort on top of
  // this order), so the existing implicit order is "whatever the filters above produced" (most
  // recently created first, since properties are unshifted on creation). Additively layer two
  // rules on top: (1) currently-active Featured listings rotate to the front, taking turns per
  // the hourly rotation above; (2) listings sitting in the "Availability Unconfirmed" window
  // (21+ days since lastConfirmedAvailableDate, see Property.lastConfirmedAvailableDate) are
  // stable-sorted just behind everything else - without touching relative order within groups.
  properties = properties
    .map((p, idx) => ({
      p,
      idx,
      featuredRank: featuredRotationRank.has(p.id) ? (featuredRotationRank.get(p.id) as number) : -1,
      penalized: getAvailabilityStaleDays(p.lastConfirmedAvailableDate || p.createdDate) >= AVAILABILITY_UNCONFIRMED_DAYS
    }))
    .sort((a, b) => {
      const aFeatured = a.featuredRank !== -1;
      const bFeatured = b.featuredRank !== -1;
      if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
      if (aFeatured && bFeatured && a.featuredRank !== b.featuredRank) return a.featuredRank - b.featuredRank;
      return a.penalized === b.penalized ? a.idx - b.idx : a.penalized ? 1 : -1;
    })
    .map(x => x.p);

  res.json(properties);
});

// Single Property Detail
app.get("/api/properties/:id", (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ error: "Property not found" });
  }
  res.json(property);
});

// FIX 8: real view tracking. `fingerprint` is a stable per-browser id the client generates
// once and persists in localStorage - not a security identifier, just a dedup key. A view is
// "unique" if this fingerprint hasn't been seen for this listing in the last 30 minutes;
// recentViewers is continuously pruned to that same window so it never grows unbounded.
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;
app.post("/api/properties/:id/view", (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) return res.status(404).json({ error: "Property not found" });

  const { fingerprint } = req.body as { fingerprint?: string };
  const now = Date.now();

  if (!property.recentViewers) property.recentViewers = [];
  property.recentViewers = property.recentViewers.filter(v => now - v.ts < VIEW_DEDUP_WINDOW_MS);

  const isUnique = !fingerprint || !property.recentViewers.some(v => v.fingerprint === fingerprint);
  if (fingerprint) property.recentViewers.push({ fingerprint, ts: now });

  property.views = (property.views || 0) + 1;
  if (isUnique) property.uniqueViews = (property.uniqueViews || 0) + 1;

  const today = new Date().toISOString().split("T")[0];
  if (!property.viewsByDay) property.viewsByDay = {};
  property.viewsByDay[today] = (property.viewsByDay[today] || 0) + 1;

  writeDb(db);
  res.json({ success: true, views: property.views, uniqueViews: property.uniqueViews });
});

// Get correct WhatsApp contact number for property (agent specific with fallback to platform default)
app.get("/api/properties/:id/whatsapp-number", (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ error: "Property not found" });
  }

  let phone = "";

  // 1. Check agent
  const agent = db.users.find(u => u.id === property.agentId);
  if (agent) {
    if (agent.whatsapp && agent.whatsapp.trim()) {
      phone = agent.whatsapp.trim();
    } else if (agent.phone && agent.phone.trim()) {
      phone = agent.phone.trim();
    }
  }

  // 2. Check organization
  if (!phone && property.orgId) {
    const org = db.organizations.find(o => o.id === property.orgId);
    if (org) {
      if (org.whatsapp && org.whatsapp.trim()) {
        phone = org.whatsapp.trim();
      } else if (org.phone && org.phone.trim()) {
        phone = org.phone.trim();
      }
    }
  }

  // 3. Fallback to platform default in aiConfig
  if (!phone) {
    phone = db.aiConfig?.whatsappDefaultNumber || "97433334444";
  }

  // Clean to ensure digits only, international format (remove non-digits)
  const cleanedPhone = phone.replace(/\D/g, "");

  res.json({ whatsappNumber: cleanedPhone });
});

// Get the real assigned agent/agency identity for a property (name, photo, verification, contact
// number) so the frontend never has to fabricate a display name or license for the contact card
// and PDF brochure.
app.get("/api/properties/:id/agent-info", (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) {
    return res.status(404).json({ error: "Property not found" });
  }

  const agent = db.users.find(u => u.id === property.agentId);
  const org = property.orgId ? db.organizations.find(o => o.id === property.orgId) : undefined;

  let phone = "";
  if (agent) {
    if (agent.whatsapp && agent.whatsapp.trim()) {
      phone = agent.whatsapp.trim();
    } else if (agent.phone && agent.phone.trim()) {
      phone = agent.phone.trim();
    }
  }
  if (!phone && org) {
    if (org.whatsapp && org.whatsapp.trim()) {
      phone = org.whatsapp.trim();
    } else if (org.phone && org.phone.trim()) {
      phone = org.phone.trim();
    }
  }
  if (!phone) {
    phone = db.aiConfig?.whatsappDefaultNumber || "97433334444";
  }
  const cleanedPhone = phone.replace(/\D/g, "");

  res.json({
    agentName: agent ? agent.fullName : null,
    agentPhotoUrl: agent?.avatarUrl || org?.logoUrl || null,
    orgName: org ? org.name : null,
    phone: cleanedPhone,
    isVerifiedAgent: agent ? agent.verificationStatus === VerificationStatus.APPROVED : false,
    hasAssignedAgent: !!agent,
    // FIX 4: real agency name instead of a generic "Nerou Verified Consultant" claim.
    verifiedBadgeLabel: agent && agent.verificationStatus === VerificationStatus.APPROVED
      ? getVerifiedBadgeLabel(agent, org?.name, false)
      : null,
    verifiedBadgeLabelAr: agent && agent.verificationStatus === VerificationStatus.APPROVED
      ? getVerifiedBadgeLabel(agent, org?.name, true)
      : null
  });
});

// Create/Update Property (SaaS Agent/Agency Admin/Developer workspace action)
app.post("/api/properties", authMiddleware, (req, res) => {
  const db = readDb();
  const propData = req.body;
  const isEdit = !!propData.id;

  if (propData.price !== undefined && Number(propData.price) < 0) {
    return res.status(400).json({ error: "Price cannot be negative." });
  }
  if (propData.area !== undefined && Number(propData.area) < 0) {
    return res.status(400).json({ error: "Area cannot be negative." });
  }
  if (Array.isArray(propData.images) && propData.images.length > 14) {
    return res.status(400).json({ error: "A listing may have a maximum of 14 photos." });
  }

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agent";
  const actorRole = authReq.user?.role || UserRole.AGENT;
  const actor = db.users.find(u => u.id === actorId);

  // Only listing-capable roles may ever create a property; a plain REGISTERED/visitor
  // account must never be able to publish a listing just by posting to this endpoint.
  const LISTING_CREATOR_ROLES = [UserRole.AGENT, UserRole.AGENCY_ADMIN, UserRole.DEVELOPER_ADMIN, UserRole.PLATFORM_ADMIN];
  if (!isEdit && !LISTING_CREATOR_ROLES.includes(actorRole as UserRole)) {
    return res.status(403).json({ error: "Your account type is not permitted to create property listings." });
  }

  // Qatar regulation gate: an INDEPENDENT_AGENT must declare (and have approved) the
  // licensed agency/brokerage they operate under before any listing of theirs can go
  // live. AGENCY_AGENT and org admins are not subject to this - they're covered by
  // their organization's own verification. Applies on both create and edit, since edit
  // can carry a listingStatus straight from the client.
  // FIX 3: per-listing admin approval was removed - a brand-new listing now publishes
  // immediately once this account-level gate passes, instead of always landing in a
  // PENDING_REVIEW queue. The client may still explicitly request DRAFT to save without
  // publishing. Edits keep respecting whatever listingStatus the client sends.
  const requestedListingStatus = isEdit
    ? propData.listingStatus
    : (propData.listingStatus === ListingStatus.DRAFT ? ListingStatus.DRAFT : ListingStatus.PUBLISHED);
  if (
    actor &&
    actor.role === UserRole.AGENT &&
    getEffectiveAgentType(actor) === AgentType.INDEPENDENT_AGENT &&
    requestedListingStatus === ListingStatus.PUBLISHED
  ) {
    if (!db.verificationDocuments) db.verificationDocuments = [];
    const authLetter = db.verificationDocuments.find(
      d => d.userId === actor.id && d.documentType === DocumentType.AGENCY_AUTHORIZATION_LETTER
    );
    if (!authLetter || authLetter.status !== DocumentStatus.APPROVED) {
      const currentState = !authLetter ? "NOT_SUBMITTED" : authLetter.status;
      return res.status(403).json({
        error: `You must have your Agency Authorization Letter approved before publishing listings. Current status: ${currentState}.`
      });
    }
  }

  let qualityScore = 70; // Base score
  if (propData.description && propData.description.length > 100) qualityScore += 10;
  if (propData.images && propData.images.length >= 3) qualityScore += 10;
  if (propData.amenities && propData.amenities.length >= 4) qualityScore += 10;

  if (isEdit) {
    const idx = db.properties.findIndex(p => p.id === propData.id);
    if (idx === -1) return res.status(404).json({ error: "Property not found" });

    const existing = db.properties[idx];

    // Ownership gate: only the listing's own agent, an org admin of the same org, or a
    // platform admin may edit it. Without this, any authenticated account could POST an
    // edit for someone else's listing (including reassigning it to themselves below).
    const isOwnAgent = actorId === existing.agentId;
    const isOrgAdmin = !!existing.orgId && actor?.orgId === existing.orgId &&
      (actorRole === UserRole.AGENCY_ADMIN || actorRole === UserRole.DEVELOPER_ADMIN);
    const isPlatformAdmin = actorRole === UserRole.PLATFORM_ADMIN;
    if (!isOwnAgent && !isOrgAdmin && !isPlatformAdmin) {
      return res.status(403).json({ error: "You do not have permission to edit this listing." });
    }

    // Only push a price-history entry when a valid new price was actually provided -
    // Number(undefined) is NaN, and NaN !== existing.price is always true, so without this
    // guard every edit that omits price would silently corrupt priceHistory with a NaN entry.
    const newPrice = propData.price !== undefined ? Number(propData.price) : existing.price;
    const priceHistory = [...existing.priceHistory];
    if (Number.isFinite(newPrice) && existing.price !== newPrice) {
      priceHistory.push({ price: newPrice, date: new Date().toISOString().split("T")[0] });
    }

    const updatedProp: Property = {
      ...existing,
      ...propData,
      // agentId/orgId are ownership fields, not editable listing content - never let them
      // be overwritten from client-supplied propData (that's how a listing gets hijacked).
      agentId: existing.agentId,
      orgId: existing.orgId,
      price: Number.isFinite(newPrice) ? newPrice : existing.price,
      area: propData.area !== undefined ? Number(propData.area) : existing.area,
      bedrooms: propData.bedrooms !== undefined ? Number(propData.bedrooms) : existing.bedrooms,
      bathrooms: propData.bathrooms !== undefined ? Number(propData.bathrooms) : existing.bathrooms,
      priceHistory,
      qualityScore,
      updatedDate: new Date().toISOString()
    };

    db.properties[idx] = updatedProp;
    writeDb(db);

    logAudit(
      actorId,
      actorName,
      actorRole,
      "UPDATE_PROPERTY",
      updatedProp.id,
      "Property",
      { title: updatedProp.title, price: updatedProp.price }
    );

    return res.json(updatedProp);
  } else {
    // New property listing
    const id = `prop-${Date.now()}`;
    const listingId = `N-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowIso = new Date().toISOString();
    const newProp: Property = {
      id,
      listingId,
      title: propData.title,
      titleAr: propData.titleAr || propData.title,
      description: propData.description,
      descriptionAr: propData.descriptionAr || propData.description,
      propertyType: propData.propertyType,
      transactionType: propData.transactionType,
      price: Number(propData.price),
      currency: propData.currency || "QAR",
      rentalPeriod: propData.rentalPeriod,
      area: Number(propData.area),
      sizeUnit: propData.sizeUnit || "SQM",
      city: propData.city,
      district: propData.district,
      latitude: propData.latitude || 25.3,
      longitude: propData.longitude || 51.5,
      bedrooms: Number(propData.bedrooms),
      bathrooms: Number(propData.bathrooms),
      furnished: propData.furnished || "NO",
      parking: !!propData.parking,
      amenities: propData.amenities || [],
      images: propData.images && propData.images.length > 0 ? propData.images : [
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80"
      ],
      videoUrl: propData.videoUrl,
      agentId: actorId, // Link automatically to logged-in user
      // An INDEPENDENT_AGENT has no orgId by design - do not fall back to a hardcoded
      // organization, or every independently-listed property would be silently misattributed.
      orgId: propData.orgId || actor?.orgId || undefined,
      projectId: propData.projectId,
      // No more manual per-listing review step to leave this PENDING - a published listing
      // is auto-approved at the property level; admin retains suspend/flag/remove as
      // after-the-fact moderation tools (see POST /api/admin/properties/:id/flag).
      verificationStatus: requestedListingStatus === ListingStatus.PUBLISHED ? VerificationStatus.APPROVED : VerificationStatus.PENDING,
      listingStatus: requestedListingStatus,
      statusChangedDate: nowIso,
      qualityScore,
      createdDate: nowIso,
      updatedDate: nowIso,
      // Availability refresh cycle baseline: every new listing starts "confirmed available"
      // as of its own creation instant, so it doesn't read as immediately stale.
      lastConfirmedAvailableDate: nowIso,
      priceHistory: [{ price: Number(propData.price), date: new Date().toISOString().split("T")[0] }],
      // Qatar-specific specification fields
      completionYear: propData.completionYear !== undefined ? Number(propData.completionYear) : undefined,
      furnishingStatus: propData.furnishingStatus,
      metroStation: propData.metroStation,
      metroWalkingMinutes: propData.metroWalkingMinutes !== undefined ? Number(propData.metroWalkingMinutes) : undefined,
      utilitiesIncluded: propData.utilitiesIncluded,
      parkingType: propData.parkingType,
      parkingSpaces: propData.parkingSpaces !== undefined ? Number(propData.parkingSpaces) : undefined,
      tenureType: propData.tenureType
    };

    // Duplicate detection (informational only - never blocks creation): look for other
    // currently-PUBLISHED listings from the same organization (or the same agent, when no
    // orgId applies) that appear to describe the same unit - same district, same bedroom
    // count, and price within +/-5%. Computed against the list as it stood before this new
    // property is added, so the new listing never matches against itself.
    const dupScopeIsOrg = !!newProp.orgId;
    const dupPriceTolerance = newProp.price * 0.05;
    const possibleDuplicates = db.properties
      .filter(
        p =>
          p.listingStatus === ListingStatus.PUBLISHED &&
          (dupScopeIsOrg ? p.orgId === newProp.orgId : p.agentId === newProp.agentId) &&
          p.district === newProp.district &&
          p.bedrooms === newProp.bedrooms &&
          Math.abs(p.price - newProp.price) <= dupPriceTolerance
      )
      .map(p => ({ id: p.id, title: p.title, price: p.price, district: p.district }));

    db.properties.unshift(newProp);
    writeDb(db);

    logAudit(
      actorId,
      actorName,
      actorRole,
      "CREATE_PROPERTY",
      id,
      "Property",
      { title: newProp.title, price: newProp.price }
    );

    // FIX 9: confirm the listing went live (or was saved as a draft) - there was previously
    // no notification at all for a brand-new listing.
    if (actor?.email) {
      const isPublished = newProp.listingStatus === ListingStatus.PUBLISHED;
      sendMockEmail(
        actor.email,
        `[Nerou Finder] Listing ${isPublished ? "Published" : "Saved as Draft"}: ${newProp.title}`,
        generateNotificationEmailHtml(
          isPublished ? "Listing Published" : "Listing Saved as Draft",
          actor.fullName,
          `<p>Your listing <strong>${newProp.title}</strong> (ID: ${newProp.listingId}) ${isPublished ? "is now live." : "was saved as a draft and is not yet public."}</p>`
        ),
        "listing_published"
      );
    }

    return res.json(possibleDuplicates.length > 0 ? { ...newProp, possibleDuplicates } : newProp);
  }
});

// Confirm a listing is still available - resets the staleness clock and, if this listing
// was auto-paused purely for going stale (see checkPropertyStalenessAndReminders below),
// reactivates it back to its prior live status. Callable by the property's own agent, or an
// org admin (AGENCY_ADMIN/DEVELOPER_ADMIN) belonging to the property's own orgId.
app.patch("/api/properties/:id/confirm-available", authMiddleware, (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) return res.status(404).json({ error: "Property not found." });

  const authReq = req as AuthenticatedRequest;
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const isOwnAgent = actor.id === property.agentId;
  const isOrgAdmin =
    !!property.orgId &&
    actor.orgId === property.orgId &&
    (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);

  if (!isOwnAgent && !isOrgAdmin) {
    return res.status(403).json({ error: "You are not authorized to confirm availability for this listing." });
  }

  const nowIso = new Date().toISOString();
  property.lastConfirmedAvailableDate = nowIso;
  property.staleReminderSentDate = undefined;

  // If this listing was auto-paused purely for going stale (not a manual pause for some
  // other reason), reactivate it back to whatever live status it held before the sweep
  // paused it, rather than leaving the agent to manually re-publish.
  if (property.listingStatus === ListingStatus.PAUSED && property.staleAutoPausedFromStatus) {
    property.listingStatus = property.staleAutoPausedFromStatus;
    property.staleAutoPausedFromStatus = undefined;
  }

  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "CONFIRM_PROPERTY_AVAILABLE", property.id, "Property", { title: property.title });

  res.json(property);
});

// FIX 1: agent-facing listing status control (Active/Sold/Rented/Unavailable/Draft). Never
// accepts SUSPENDED or PENDING_REVIEW - those remain admin-only (see /api/admin/properties/verify
// and /api/admin/properties/:id/flag). History is preserved - this never deletes the listing,
// only changes its status, so it stays fully visible in the agent's own dashboard/history.
const AGENT_SETTABLE_STATUSES = [ListingStatus.DRAFT, ListingStatus.PUBLISHED, ListingStatus.SOLD, ListingStatus.RENTED, ListingStatus.PAUSED];
app.patch("/api/properties/:id/status", authMiddleware, (req, res) => {
  const db = readDb();
  const property = db.properties.find(p => p.id === req.params.id);
  if (!property) return res.status(404).json({ error: "Property not found." });

  const authReq = req as AuthenticatedRequest;
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const isOwnAgent = actor.id === property.agentId;
  const isOrgAdmin =
    !!property.orgId &&
    actor.orgId === property.orgId &&
    (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  if (!isOwnAgent && !isOrgAdmin) {
    return res.status(403).json({ error: "You are not authorized to change the status of this listing." });
  }

  const { status } = req.body as { status?: ListingStatus };
  if (!status || !AGENT_SETTABLE_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${AGENT_SETTABLE_STATUSES.join(", ")}` });
  }

  // Same Qatar-regulation gate as creation: an INDEPENDENT_AGENT without an approved Agency
  // Authorization Letter cannot (re)publish a listing.
  if (status === ListingStatus.PUBLISHED && actor.role === UserRole.AGENT && getEffectiveAgentType(actor) === AgentType.INDEPENDENT_AGENT) {
    if (!db.verificationDocuments) db.verificationDocuments = [];
    const authLetter = db.verificationDocuments.find(
      d => d.userId === actor.id && d.documentType === DocumentType.AGENCY_AUTHORIZATION_LETTER
    );
    if (!authLetter || authLetter.status !== DocumentStatus.APPROVED) {
      const currentState = !authLetter ? "NOT_SUBMITTED" : authLetter.status;
      return res.status(403).json({
        error: `You must have your Agency Authorization Letter approved before publishing listings. Current status: ${currentState}.`
      });
    }
  }

  const previousStatus = property.listingStatus;
  property.listingStatus = status;
  property.statusChangedDate = new Date().toISOString();
  if (status === ListingStatus.PUBLISHED) {
    property.verificationStatus = VerificationStatus.APPROVED;
  }
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "UPDATE_PROPERTY_STATUS", property.id, "Property", { from: previousStatus, to: status });

  // FIX 9: notify the agent's own record of the change (useful for agency-admin-triggered
  // changes on an agent's listing) and, for the more consequential Sold/Rented transitions,
  // give it its own recognizable subject line.
  const owningAgent = db.users.find(u => u.id === property.agentId);
  if (owningAgent?.email && previousStatus !== status) {
    const title = status === ListingStatus.SOLD || status === ListingStatus.RENTED
      ? `Listing Marked ${status === ListingStatus.SOLD ? "Sold" : "Rented"}`
      : "Listing Status Changed";
    sendMockEmail(
      owningAgent.email,
      `[Nerou Finder] ${title}: ${property.title}`,
      generateNotificationEmailHtml(
        title,
        owningAgent.fullName,
        `<p>Your listing <strong>${property.title}</strong> (ID: ${property.listingId}) changed status from <strong>${previousStatus}</strong> to <strong>${status}</strong>.</p>`
      ),
      "listing_status_changed"
    );
  }

  res.json(property);
});

async function checkAndIncrementSavedSearches(property: Property) {
  try {
    const list = await prisma.savedSearch.findMany();
    for (const item of list) {
      let filters;
      try {
        filters = JSON.parse(item.filters);
      } catch (e) {
        continue;
      }

      let matches = true;

      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const inTitle = property.title.toLowerCase().includes(q) || (property.titleAr && property.titleAr.toLowerCase().includes(q));
        const inDesc = property.description.toLowerCase().includes(q) || (property.descriptionAr && property.descriptionAr.toLowerCase().includes(q));
        if (!inTitle && !inDesc) matches = false;
      }

      if (filters.selectedMunicipality) {
        const db = readDb();
        const muni = db.locations?.find(l => l.id === filters.selectedMunicipality);
        if (muni) {
          const mName = muni.name.toLowerCase();
          const mNameAr = muni.nameAr.toLowerCase();
          const pCity = property.city.toLowerCase();
          if (pCity !== mName && pCity !== mNameAr) {
            matches = false;
          }
        }
      }

      if (filters.selectedArea) {
        const db = readDb();
        const area = db.locations?.find(l => l.id === filters.selectedArea);
        if (area) {
          const aName = area.name.toLowerCase();
          const aNameAr = area.nameAr.toLowerCase();
          const pDistrict = property.district.toLowerCase();
          if (pDistrict !== aName && pDistrict !== aNameAr) {
            matches = false;
          }
        }
      }

      if (filters.propType && property.propertyType !== filters.propType) {
        matches = false;
      }

      if (filters.transType && property.transactionType !== filters.transType) {
        matches = false;
      }

      if (filters.minPrice && property.price < Number(filters.minPrice)) {
        matches = false;
      }

      if (filters.maxPrice && property.price > Number(filters.maxPrice)) {
        matches = false;
      }

      if (filters.beds && property.bedrooms < Number(filters.beds)) {
        matches = false;
      }

      if (matches) {
        await prisma.savedSearch.update({
          where: { id: item.id },
          data: {
            newMatchesCount: {
              increment: 1
            }
          }
        });
      }
    }
  } catch (err) {
    console.error("Failed to increment saved search counters:", err);
  }
}

// Admin Approval/Rejection of Property Listing
app.post("/api/admin/properties/verify", async (req, res) => {
  const { propertyId, status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.properties.findIndex(p => p.id === propertyId);
  if (idx === -1) return res.status(404).json({ error: "Property not found" });

  // Qatar regulation gate: this is the real point a listing goes live (agents never send
  // listingStatus directly - admin approval is what flips it to PUBLISHED). Block publication
  // if the property's own agent is an INDEPENDENT_AGENT without an APPROVED Agency
  // Authorization Letter, even if the property itself otherwise checks out.
  if (status === VerificationStatus.APPROVED) {
    const propertyAgent = db.users.find(u => u.id === db.properties[idx].agentId);
    if (propertyAgent && propertyAgent.role === UserRole.AGENT && getEffectiveAgentType(propertyAgent) === AgentType.INDEPENDENT_AGENT) {
      if (!db.verificationDocuments) db.verificationDocuments = [];
      const authLetter = db.verificationDocuments.find(
        d => d.userId === propertyAgent.id && d.documentType === DocumentType.AGENCY_AUTHORIZATION_LETTER
      );
      if (!authLetter || authLetter.status !== DocumentStatus.APPROVED) {
        const currentState = !authLetter ? "NOT_SUBMITTED" : authLetter.status;
        return res.status(403).json({
          error: `This listing's agent has not had their Agency Authorization Letter approved (current status: ${currentState}). The listing cannot be published until that is resolved.`
        });
      }
    }
  }

  db.properties[idx].verificationStatus = status;
  if (status === VerificationStatus.APPROVED) {
    db.properties[idx].listingStatus = ListingStatus.PUBLISHED;
    db.properties[idx].lastVerifiedDate = new Date().toISOString();
    await checkAndIncrementSavedSearches(db.properties[idx]);
  } else if (status === VerificationStatus.REJECTED) {
    db.properties[idx].listingStatus = ListingStatus.SUSPENDED;
  }


  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    status === VerificationStatus.APPROVED ? "APPROVE_PROPERTY" : "REJECT_PROPERTY",
    propertyId,
    "Property",
    { status }
  );

  res.json({ success: true, property: db.properties[idx] });
});

// FIX 3: after-the-fact admin moderation - flag a live listing "under review" without
// unpublishing it (suspending via /verify above already fully unpublishes; this is the
// lighter-weight alternative). Pass reason: undefined/omitted to clear an existing flag.
app.post("/api/admin/properties/:id/flag", (req, res) => {
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };
  const db = readDb();
  const idx = db.properties.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Property not found" });

  const prop = db.properties[idx];
  if (reason) {
    prop.flaggedForReview = true;
    prop.flagReason = reason;
    prop.flaggedDate = new Date().toISOString();
  } else {
    prop.flaggedForReview = false;
    prop.flagReason = undefined;
    prop.flaggedDate = undefined;
  }
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(
    authReq.user?.id || "unknown",
    authReq.user?.fullName || "Admin",
    (authReq.user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
    reason ? "FLAG_PROPERTY" : "UNFLAG_PROPERTY",
    id,
    "Property",
    { reason }
  );

  res.json({ success: true, property: prop });
});

// Delete a Property (Platform Admin action)
app.delete("/api/admin/properties/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const idx = db.properties.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Property not found" });

  const [removed] = db.properties.splice(idx, 1);
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(
    authReq.user?.id || "unknown",
    authReq.user?.fullName || "Admin",
    (authReq.user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
    "DELETE_PROPERTY",
    id,
    "Property",
    { title: removed.title }
  );

  res.json({ success: true });
});

// Lead Capture (Visitor submits inquiry or triggers Call/WhatsApp event)
app.post("/api/leads", publicWriteRateLimiter, (req, res) => {
  const db = readDb();
  const {
    propertyId,
    visitorName,
    visitorPhone,
    visitorWhatsapp,
    visitorEmail,
    preferredLanguage,
    message,
    contactMethod,
    source,
    campaign,
    utmSource
  } = req.body;

  // Identify responsible agent and organization
  let agentId = "user-agent-1"; // Fallback
  let orgId = "org-agency-1";
  if (propertyId) {
    const prop = db.properties.find(p => p.id === propertyId);
    if (prop) {
      agentId = prop.agentId;
      orgId = prop.orgId;
    }
  }

  const id = `lead-${Date.now()}`;
  const newLead: Lead = {
    id,
    propertyId,
    visitorName,
    visitorPhone: visitorPhone || "Not specified",
    visitorWhatsapp,
    visitorEmail,
    preferredLanguage,
    message: message || `User initiated ${contactMethod} callback request.`,
    contactMethod,
    status: LeadStatus.NEW,
    agentId,
    orgId,
    createdDate: new Date().toISOString(),
    updatedDate: new Date().toISOString(),
    attribution: {
      source: source || "Direct Website",
      campaign: campaign || "Organic discovery",
      utmSource: utmSource || "web"
    }
  };

  db.leads.unshift(newLead);

  // FIX 6: real ad-lead attribution - if the visitor arrived via a campaign's shareable
  // link (?campaignId=... captured once in App.tsx and threaded through to lead creation),
  // credit that campaign's lead count. `campaign` here is the raw client-supplied value
  // (before the "Organic discovery" display fallback above), so it only matches a real id.
  if (campaign) {
    const matchedCampaign = db.campaigns.find(c => c.id === campaign);
    if (matchedCampaign) {
      matchedCampaign.metrics.leads = (matchedCampaign.metrics.leads || 0) + 1;
    }
  }

  writeDb(db);

  // If a viewing request was submitted in the inquiry
  const viewingRequested = !!(req.body.preferredDate && req.body.preferredTimeSlot);
  if (viewingRequested) {
    const viewingId = `view-${Date.now()}`;
    db.viewings.unshift({
      id: viewingId,
      leadId: id,
      propertyId: propertyId || "",
      agentId,
      preferredDate: req.body.preferredDate,
      preferredTimeSlot: req.body.preferredTimeSlot,
      status: "REQUESTED",
      notes: req.body.viewingNotes,
      createdDate: new Date().toISOString()
    });
    writeDb(db);
  }

  // Trigger outbound mock email log for lead inquiry
  const agentObj = db.users.find(u => u.id === agentId);
  const orgObj = db.organizations.find(o => o.id === orgId);

  // FIX 9: dedicated viewing-request notification, distinct from the general "inquiry"
  // email below - a viewing request is a more time-sensitive, actionable event.
  if (viewingRequested && agentObj?.email) {
    sendMockEmail(
      agentObj.email,
      `[Nerou Finder] New Viewing Request: ${visitorName}`,
      generateNotificationEmailHtml(
        "New Viewing Request",
        agentObj.fullName,
        `<p><strong>${visitorName}</strong> requested a viewing on <strong>${req.body.preferredDate}</strong> at <strong>${req.body.preferredTimeSlot}</strong>. Contact: ${visitorPhone || "Not specified"}${visitorEmail ? ` / ${visitorEmail}` : ""}.</p>`
      ),
      "viewing_requested"
    );
  }
  const targetEmail = agentObj?.email || orgObj?.email || "agent@nerou.io";
  const propObj = db.properties.find(p => p.id === propertyId);
  const propTitle = propObj ? propObj.title : "Exclusive Property Asset";
  const propPrice = propObj ? propObj.price : 0;
  
  const inquiryEmailHtml = generateInquiryEmailHtml(
    visitorName,
    visitorPhone || "Not specified",
    visitorEmail || "Not specified",
    propTitle,
    propPrice,
    propertyId || "General Portal Form"
  );
  sendMockEmail(targetEmail, `[Nerou Finder] New Property Inquiry - ${propTitle}`, inquiryEmailHtml, "inquiry");

  res.json({ success: true, lead: newLead });
});

// Retrieve Leads for Agent or Agency Workspace. Leads carry visitor PII (name, phone,
// email, message) - this must never be reachable without auth, and every caller other
// than a platform admin is hard-scoped to their own agentId/org, regardless of what
// agentId/orgId query params they pass (previously this endpoint had no auth at all and
// trusted those params outright, leaking every lead in the system to anonymous callers).
app.get("/api/leads", authMiddleware, (req, res) => {
  const db = readDb();
  const authReq = req as AuthenticatedRequest;
  const actor = authReq.user;
  if (!actor) return res.status(401).json({ error: "Access token missing or invalid." });

  const isPlatformAdmin = actor.role === UserRole.PLATFORM_ADMIN || actor.role === UserRole.SUPER_ADMIN;
  let leads = db.leads;

  if (isPlatformAdmin) {
    const { agentId, orgId } = req.query;
    if (agentId) leads = leads.filter(l => l.agentId === agentId);
    if (orgId) leads = leads.filter(l => l.orgId === orgId);
  } else {
    const dbUser = db.users.find(u => u.id === actor.id);
    const isOrgAdmin = !!dbUser?.orgId && (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
    leads = isOrgAdmin
      ? leads.filter(l => l.orgId === dbUser!.orgId)
      : leads.filter(l => l.agentId === actor.id);
  }

  res.json(leads);
});

// Update Lead Status
app.post("/api/leads/status", authMiddleware, (req, res) => {
  const { leadId, status } = req.body;
  const db = readDb();
  const idx = db.leads.findIndex(l => l.id === leadId);
  if (idx === -1) return res.status(404).json({ error: "Lead not found" });

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agent";
  const actorRole = authReq.user?.role || UserRole.AGENT;

  const lead = db.leads[idx];
  const previousStatus = lead.status;
  lead.status = status;
  lead.updatedDate = new Date().toISOString();
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "UPDATE_LEAD_STATUS",
    leadId,
    "Lead",
    { status }
  );

  // FIX 9: notify the responsible agent of the status change (skip when the agent themself
  // is the one making the change - no need to notify yourself).
  const owningAgent = db.users.find(u => u.id === lead.agentId);
  if (owningAgent?.email && owningAgent.id !== actorId && previousStatus !== status) {
    sendMockEmail(
      owningAgent.email,
      `[Nerou Finder] Lead Status Changed: ${lead.visitorName}`,
      generateNotificationEmailHtml(
        "Lead Status Changed",
        owningAgent.fullName,
        `<p>The lead <strong>${lead.visitorName}</strong> changed status from <strong>${previousStatus}</strong> to <strong>${status}</strong>.</p>`
      ),
      "lead_status_changed"
    );
  }

  res.json({ success: true, lead: db.leads[idx] });
});

// FIX 2: timestamped notes on a lead - persisted, visible on its detail view.
app.post("/api/leads/:id/notes", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required." });

  const db = readDb();
  const lead = db.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const authReq = req as AuthenticatedRequest;
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const isOwnAgent = actor.id === lead.agentId;
  const isOrgAdmin = !!lead.orgId && actor.orgId === lead.orgId && actor.role === UserRole.AGENCY_ADMIN;
  if (!isOwnAgent && !isOrgAdmin) {
    return res.status(403).json({ error: "You are not authorized to add notes to this lead." });
  }

  if (!lead.notes) lead.notes = [];
  const note = {
    id: `note-${Date.now()}`,
    text: text.trim(),
    authorId: actor.id,
    authorName: actor.fullName,
    createdDate: new Date().toISOString()
  };
  lead.notes.unshift(note);
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "ADD_LEAD_NOTE", id, "Lead", { text: note.text });

  res.json({ success: true, lead });
});

// FIX 2: soft-close/reopen a lead - preserves history, never deletes it.
app.patch("/api/leads/:id/archive", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { isArchived } = req.body as { isArchived?: boolean };

  const db = readDb();
  const lead = db.leads.find(l => l.id === id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const authReq = req as AuthenticatedRequest;
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const isOwnAgent = actor.id === lead.agentId;
  const isOrgAdmin = !!lead.orgId && actor.orgId === lead.orgId && actor.role === UserRole.AGENCY_ADMIN;
  if (!isOwnAgent && !isOrgAdmin) {
    return res.status(403).json({ error: "You are not authorized to archive this lead." });
  }

  lead.isArchived = !!isArchived;
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, isArchived ? "ARCHIVE_LEAD" : "UNARCHIVE_LEAD", id, "Lead", {});

  res.json({ success: true, lead });
});

// Manually Reassign Lead to a Specific Agent (Agency Admin action, independent of automatic routing policy)
app.patch("/api/leads/:id/assign", authMiddleware, requireRole([UserRole.AGENCY_ADMIN]), (req, res) => {
  const { id } = req.params;
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId is required." });

  const db = readDb();
  const leadIdx = db.leads.findIndex(l => l.id === id);
  if (leadIdx === -1) return res.status(404).json({ error: "Lead not found" });

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actor = db.users.find(u => u.id === actorId);
  if (!actor?.orgId) return res.status(403).json({ error: "No organization associated with this account." });

  const lead = db.leads[leadIdx];
  if (lead.orgId !== actor.orgId) {
    return res.status(403).json({ error: "You may only reassign leads belonging to your own organization." });
  }

  const targetAgent = db.users.find(u => u.id === agentId);
  if (!targetAgent || targetAgent.role !== UserRole.AGENT || targetAgent.orgId !== actor.orgId) {
    return res.status(400).json({ error: "Target agent must be a member of your organization." });
  }

  db.leads[leadIdx].agentId = agentId;
  db.leads[leadIdx].status = lead.status === LeadStatus.NEW ? LeadStatus.ASSIGNED : lead.status;
  db.leads[leadIdx].updatedDate = new Date().toISOString();
  writeDb(db);

  logAudit(
    actorId,
    actor.fullName || "Agency Admin",
    UserRole.AGENCY_ADMIN,
    "REASSIGN_LEAD",
    id,
    "Lead",
    { agentId, previousAgentId: lead.agentId }
  );

  // FIX 9: notify the newly-assigned agent.
  if (targetAgent.email) {
    sendMockEmail(
      targetAgent.email,
      `[Nerou Finder] New Lead Assigned: ${lead.visitorName}`,
      generateNotificationEmailHtml(
        "New Lead Assigned To You",
        targetAgent.fullName,
        `<p>A lead, <strong>${lead.visitorName}</strong>, has been assigned to you. Contact: ${lead.visitorPhone}${lead.visitorEmail ? ` / ${lead.visitorEmail}` : ""}.</p>`
      ),
      "lead_assigned"
    );
  }

  res.json({ success: true, lead: db.leads[leadIdx] });
});

// Delete a Lead (Platform Admin action)
app.delete("/api/admin/leads/:id", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const idx = db.leads.findIndex(l => l.id === id);
  if (idx === -1) return res.status(404).json({ error: "Lead not found" });

  const [removed] = db.leads.splice(idx, 1);
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(
    authReq.user?.id || "unknown",
    authReq.user?.fullName || "Admin",
    (authReq.user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
    "DELETE_LEAD",
    id,
    "Lead",
    { visitorName: removed.visitorName }
  );

  res.json({ success: true });
});

// Projects API (Developers)
app.get("/api/projects", (req, res) => {
  const db = readDb();
  res.json(db.projects);
});

app.post("/api/projects", authMiddleware, (req, res) => {
  const db = readDb();
  const projData = req.body;
  const id = `proj-${Date.now()}`;

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Developer";
  const actorRole = authReq.user?.role || UserRole.DEVELOPER_ADMIN;

  const newProject = {
    id,
    developerId: projData.developerId || actorId, // Organization id (matches how projects are looked up), falls back to actor id if omitted
    name: projData.name,
    nameAr: projData.nameAr || projData.name,
    description: projData.description,
    city: projData.city,
    district: projData.district,
    status: projData.status || "PLANNING",
    deliveryDate: projData.deliveryDate,
    images: projData.images || ["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"],
    createdDate: new Date().toISOString()
  };

  db.projects.unshift(newProject);
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "CREATE_PROJECT",
    id,
    "Project",
    { name: newProject.name }
  );

  res.json(newProject);
});


// Viewings list
// FIX 7: was previously unauthenticated (any request returned every viewing platform-wide,
// or any agent's viewings by simply guessing an agentId). Admin roles may see everything
// (optionally filtered by ?agentId=); everyone else may only see their own.
app.get("/api/viewings", authMiddleware, (req, res) => {
  const db = readDb();
  const authReq = req as AuthenticatedRequest;
  const actor = authReq.user;
  if (!actor) return res.status(401).json({ error: "Access token missing or invalid." });
  const isAdmin = actor.role === UserRole.PLATFORM_ADMIN || actor.role === UserRole.SUPER_ADMIN;

  const { agentId } = req.query;
  let viewings = db.viewings;
  if (isAdmin) {
    if (agentId) viewings = viewings.filter(v => v.agentId === agentId);
  } else {
    viewings = viewings.filter(v => v.agentId === actor.id);
  }
  res.json(viewings);
});

app.post("/api/viewings/status", authMiddleware, (req, res) => {
  const { viewingId, status } = req.body;
  const db = readDb();
  const idx = db.viewings.findIndex(v => v.id === viewingId);
  if (idx === -1) return res.status(404).json({ error: "Viewing not found" });

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agent";
  const actorRole = authReq.user?.role || UserRole.AGENT;

  const viewing = db.viewings[idx];
  const previousStatus = viewing.status;
  viewing.status = status;
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "UPDATE_VIEWING_STATUS",
    viewingId,
    "Viewing",
    { status }
  );

  // FIX 9: notify the visitor who requested the viewing, if they left an email.
  const relatedLead = db.leads.find(l => l.id === viewing.leadId);
  if (relatedLead?.visitorEmail && previousStatus !== status) {
    sendMockEmail(
      relatedLead.visitorEmail,
      "[Nerou Finder] Your Viewing Request Status Changed",
      generateNotificationEmailHtml(
        "Viewing Request Update",
        relatedLead.visitorName,
        `<p>Your viewing request for ${viewing.preferredDate} at ${viewing.preferredTimeSlot} is now <strong>${status}</strong>.</p>`
      ),
      "viewing_status_changed"
    );
  }

  res.json({ success: true, viewing: db.viewings[idx] });
});

// Developer Mock Outbound SMTP Log Queue
app.get("/api/admin/emails", (req, res) => {
  let emails: any[] = [];
  if (fs.existsSync(EMAILS_FILE)) {
    try {
      emails = JSON.parse(fs.readFileSync(EMAILS_FILE, "utf-8"));
    } catch (e) {
      emails = [];
    }
  }
  res.json(emails);
});

app.post("/api/admin/emails/clear", (req, res) => {
  try {
    fs.writeFileSync(EMAILS_FILE, JSON.stringify([], null, 2), "utf-8");
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to clear mock outbound email logs." });
  }
});

// Subscriptions & Organizations
app.get("/api/organizations", (req, res) => {
  const db = readDb();
  res.json(db.organizations);
});

// Upgrade SaaS Plan (Subscribing)
app.post("/api/organizations/upgrade", authMiddleware, (req, res) => {
  const { orgId, planId } = req.body;
  const db = readDb();
  const idx = db.organizations.findIndex(o => o.id === orgId);
  if (idx === -1) return res.status(404).json({ error: "Organization not found" });

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agency Admin";
  const actorRole = authReq.user?.role || UserRole.AGENCY_ADMIN;

  // Ownership gate: without this, any authenticated user could upgrade any organization's
  // subscription for free by just supplying its orgId - mirrors the PATCH /:id auth pattern.
  const actor = db.users.find(u => u.id === actorId);
  const isAdmin = actorRole === UserRole.PLATFORM_ADMIN || actorRole === UserRole.SUPER_ADMIN;
  const isOrgAdmin = actor?.orgId === orgId && (actorRole === UserRole.AGENCY_ADMIN || actorRole === UserRole.DEVELOPER_ADMIN);
  if (!isAdmin && !isOrgAdmin) {
    return res.status(403).json({ error: "Only an organization admin may upgrade this organization's subscription." });
  }

  // Update subscription
  db.organizations[idx].subscriptionPlanId = planId;
  // Expire in 1 year
  const expDate = new Date();
  expDate.setFullYear(expDate.getFullYear() + 1);
  db.organizations[idx].subscriptionExpiry = expDate.toISOString();
  
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "UPGRADE_SUBSCRIPTION",
    orgId,
    "Organization",
    { planId }
  );


  res.json({ success: true, organization: db.organizations[idx] });
});

// Update an organization's own profile fields (logo, name, contact details). Org admin
// for this org, or a platform admin, only - mirrors the /routing endpoint's auth pattern.
app.patch("/api/organizations/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  const isAdmin = actor?.role === UserRole.PLATFORM_ADMIN || actor?.role === UserRole.SUPER_ADMIN;
  const isOrgAdmin = actor?.orgId === id && (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  if (!actor || (!isAdmin && !isOrgAdmin)) {
    return res.status(403).json({ error: "Only an organization admin may update this organization's profile." });
  }

  const orgIdx = db.organizations.findIndex(o => o.id === id);
  if (orgIdx === -1) return res.status(404).json({ error: "Organization not found." });

  // Whitelist: public profile fields only. Subscription, verification, and type fields
  // all have their own dedicated admin endpoints and must not be changed here.
  const { name, nameAr, logoUrl, phone, whatsapp, website } = req.body;
  const existing = db.organizations[orgIdx] as any;
  if (name !== undefined) existing.name = name;
  if (nameAr !== undefined) existing.nameAr = nameAr;
  if (logoUrl !== undefined) existing.logoUrl = logoUrl;
  if (phone !== undefined) existing.phone = phone;
  if (whatsapp !== undefined) existing.whatsapp = whatsapp;
  if (website !== undefined) existing.website = website;

  writeDb(db);
  logAudit(actor.id, actor.fullName, actor.role, "UPDATE_ORGANIZATION_PROFILE", id, "Organization", { name, phone, whatsapp });

  res.json({ success: true, organization: db.organizations[orgIdx] });
});

// -----------------------------------------------------------------------------
// ORGANIZATION TEAM INVITATIONS & LEAD ROUTING POLICY
// -----------------------------------------------------------------------------

// Public: look up an invitation by its token (used by the signup page before the user has an account)
app.get("/api/invitations/:token", (req, res) => {
  const { token } = req.params;
  const db = readDb();
  if (!db.invitations) db.invitations = [];
  const invitation = db.invitations.find(inv => inv.token === token);
  if (!invitation) return res.status(404).json({ error: "Invitation not found." });
  if (invitation.status !== "PENDING") {
    return res.status(410).json({ error: "This invitation has already been used or revoked." });
  }
  if (new Date(invitation.expiresDate) < new Date()) {
    invitation.status = "EXPIRED";
    writeDb(db);
    return res.status(410).json({ error: "This invitation has expired." });
  }
  res.json({ invitation });
});

// List an organization's invitations (org admin or platform admin only)
app.get("/api/organizations/:id/invitations", authMiddleware, (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  const isAdmin = actor?.role === UserRole.PLATFORM_ADMIN || actor?.role === UserRole.SUPER_ADMIN;
  if (!actor || (!isAdmin && actor.orgId !== id)) {
    return res.status(403).json({ error: "You do not have access to this organization's invitations." });
  }

  if (!db.invitations) db.invitations = [];
  res.json(db.invitations.filter(inv => inv.orgId === id));
});

// Send a team invitation (org admin or platform admin only)
app.post("/api/organizations/:id/invite", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { email, invitedRole } = req.body;
  if (!email) return res.status(400).json({ error: "email is required." });

  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  const isAdmin = actor?.role === UserRole.PLATFORM_ADMIN || actor?.role === UserRole.SUPER_ADMIN;
  const isOrgAdmin = actor?.orgId === id && (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  if (!actor || (!isAdmin && !isOrgAdmin)) {
    return res.status(403).json({ error: "Only an organization admin may send invitations." });
  }

  const org = db.organizations.find(o => o.id === id);
  if (!org) return res.status(404).json({ error: "Organization not found." });

  if (db.users.some(u => u.email === email)) {
    return res.status(400).json({ error: "A user with this email already exists." });
  }

  if (!db.invitations) db.invitations = [];
  const token = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const expiresDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Reuse an existing pending invite for the same email+org rather than duplicating rows
  let invitation = db.invitations.find(inv => inv.email === email && inv.orgId === id && inv.status === "PENDING");
  if (invitation) {
    invitation.token = token;
    invitation.expiresDate = expiresDate;
    invitation.createdDate = now.toISOString();
  } else {
    invitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      email,
      orgId: id,
      invitedRole: invitedRole || UserRole.AGENT,
      token,
      status: "PENDING",
      createdDate: now.toISOString(),
      expiresDate
    };
    db.invitations.push(invitation);
  }

  writeDb(db);
  logAudit(actor.id, actor.fullName, actor.role, "SEND_INVITATION", invitation.id, "Invitation", { email, orgId: id });

  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const inviteLink = `${appUrl}/?token=${token}`;
  const html = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">You're invited to join ${org.name} on Nerou Finder</h2>
    <p>Click the link below to create your account and join the team:</p>
    <p><a href="${inviteLink}" style="color: #bf9b30;">${inviteLink}</a></p>
    <p>This invitation expires in 7 days.</p>
  </div>`;
  sendMockEmail(email, `[Nerou Finder] You're invited to join ${org.name}`, html, "org_invitation");

  res.json({ success: true, invitation });
});

// Update lead routing policy (org admin or platform admin only)
app.patch("/api/organizations/:id/routing", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { policy } = req.body;
  if (!policy) return res.status(400).json({ error: "policy is required." });

  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  const isAdmin = actor?.role === UserRole.PLATFORM_ADMIN || actor?.role === UserRole.SUPER_ADMIN;
  const isOrgAdmin = actor?.orgId === id && (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  if (!actor || (!isAdmin && !isOrgAdmin)) {
    return res.status(403).json({ error: "Only an organization admin may update the routing policy." });
  }

  const orgIdx = db.organizations.findIndex(o => o.id === id);
  if (orgIdx === -1) return res.status(404).json({ error: "Organization not found." });

  db.organizations[orgIdx].leadRoutingPolicy = policy;
  writeDb(db);
  logAudit(actor.id, actor.fullName, actor.role, "UPDATE_LEAD_ROUTING_POLICY", id, "Organization", { policy });

  res.json({ success: true, organization: db.organizations[orgIdx] });
});

// GET all subscription plans
app.get("/api/plans", (req, res) => {
  const db = readDb();
  res.json(db.subscriptionPlans || []);
});

// CREATE or UPDATE subscription plan
app.post("/api/admin/plans", (req, res) => {
  const { id, name, priceMonthly, priceYearly, propertyLimit, agentLimit, aiLimit, analyticsAccess, featuredListingsLimit } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.subscriptionPlans) {
    db.subscriptionPlans = [];
  }

  const isEdit = !!id;
  if (isEdit) {
    const idx = db.subscriptionPlans.findIndex(p => p.id === id);
    if (idx !== -1) {
      db.subscriptionPlans[idx] = {
        id,
        name,
        priceMonthly: Number(priceMonthly),
        priceYearly: Number(priceYearly),
        propertyLimit: Number(propertyLimit),
        agentLimit: Number(agentLimit),
        aiLimit: Number(aiLimit),
        analyticsAccess: !!analyticsAccess,
        featuredListingsLimit: Number(featuredListingsLimit)
      };
      writeDb(db);
      logAudit(actor.id, actor.name, actor.role, "EDIT_SUBSCRIPTION_PLAN", id, "SubscriptionPlan", { name });
      return res.json({ success: true, plan: db.subscriptionPlans[idx] });
    }
  }

  // Create new plan
  const newId = id || `plan-${Date.now()}`;
  const newPlan: SubscriptionPlan = {
    id: newId,
    name,
    priceMonthly: Number(priceMonthly),
    priceYearly: Number(priceYearly),
    propertyLimit: Number(propertyLimit),
    agentLimit: Number(agentLimit),
    aiLimit: Number(aiLimit),
    analyticsAccess: !!analyticsAccess,
    featuredListingsLimit: Number(featuredListingsLimit)
  };
  db.subscriptionPlans.push(newPlan);
  writeDb(db);
  logAudit(actor.id, actor.name, actor.role, "CREATE_SUBSCRIPTION_PLAN", newId, "SubscriptionPlan", { name });
  res.json({ success: true, plan: newPlan });
});

// MANUALLY OVERRIDE ORGANIZATION SUBSCRIPTION
app.post("/api/admin/organizations/subscription", (req, res) => {
  const { orgId, planId, startDate, expiryDate, status, notes, activationMethod } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.organizations.findIndex(o => o.id === orgId);
  if (idx === -1) return res.status(404).json({ error: "Organization not found" });

  db.organizations[idx].subscriptionPlanId = planId;
  db.organizations[idx].subscriptionExpiry = expiryDate;
  db.organizations[idx].subscriptionStartDate = startDate;
  db.organizations[idx].subscriptionStatus = status;
  db.organizations[idx].subscriptionNotes = notes;
  db.organizations[idx].subscriptionActivationMethod = activationMethod;

  // Onboarding pipeline (FIX3): confirming an ACTIVE subscription for an org that's still
  // AWAITING_PAYMENT unblocks its admin to move on to document submission.
  if (status === "ACTIVE") {
    const orgAdmin = db.users.find(u => u.orgId === orgId && (u.role === UserRole.AGENCY_ADMIN || u.role === UserRole.DEVELOPER_ADMIN));
    if (orgAdmin && orgAdmin.applicationStatus === ApplicationStatus.AWAITING_PAYMENT) {
      orgAdmin.applicationStatus = ApplicationStatus.AWAITING_DOCUMENTS;
    }
  }

  writeDb(db);

  // Trigger outbound mock email log if subscription is approved and active
  const updatedOrg = db.organizations[idx];
  const planObj = db.subscriptionPlans.find(p => p.id === planId);
  if (status === "ACTIVE") {
    const approvedEmailHtml = generateSubscriptionApprovedEmailHtml(
      updatedOrg.name,
      planObj?.name || planId,
      expiryDate,
      {
        properties: planObj?.propertyLimit || 15,
        agents: planObj?.agentLimit || 1,
        aiQuota: planObj?.aiLimit || 50
      }
    );
    sendMockEmail(updatedOrg.email, `[Welcome to Nerou Finder] SaaS Subscription Activated: ${updatedOrg.name}`, approvedEmailHtml, "subscription_approval");
  }

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "MANUAL_MANAGE_SUBSCRIPTION",
    orgId,
    "Organization",
    { planId, status, activationMethod }
  );

  res.json({ success: true, organization: db.organizations[idx] });
});

// MANUALLY CONFIRM/OVERRIDE AN INDEPENDENT AGENT'S SUBSCRIPTION - mirrors the Organization
// subscription endpoint above, for AGENT accounts with no orgId (INDEPENDENT_AGENT).
app.post("/api/admin/users/:id/subscription", (req, res) => {
  const { id } = req.params;
  const { planId, expiryDate, status, notes, activationMethod } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  const user = db.users[idx];
  user.subscriptionPlanId = planId;
  user.subscriptionExpiry = expiryDate;
  user.subscriptionStatus = status;
  user.subscriptionActivationMethod = activationMethod;
  user.subscriptionNotes = notes;

  // Onboarding pipeline (FIX3): confirming an ACTIVE subscription for an agent still
  // AWAITING_PAYMENT unblocks them to move on to document submission.
  if (status === "ACTIVE" && user.applicationStatus === ApplicationStatus.AWAITING_PAYMENT) {
    user.applicationStatus = ApplicationStatus.AWAITING_DOCUMENTS;
  }

  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "CONFIRM_AGENT_SUBSCRIPTION",
    id,
    "User",
    { planId, status, activationMethod }
  );

  const { password: _pw1, ...safeUser } = user as any;
  res.json({ success: true, user: safeUser });
});

// Manually nudge a user's onboarding applicationStatus (e.g. PENDING_APPROVAL -> AWAITING_PAYMENT).
// Generic on purpose - used for any manual status transition an admin needs, not just one step.
app.patch("/api/admin/users/:id/application-status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const authReq = req as AuthenticatedRequest;

  const validStatuses: string[] = Object.values(ApplicationStatus);
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
  }

  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  db.users[idx].applicationStatus = status;
  writeDb(db);

  logAudit(
    authReq.user?.id || "admin",
    authReq.user?.fullName || "Admin",
    (authReq.user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
    "UPDATE_APPLICATION_STATUS",
    id,
    "User",
    { status }
  );

  res.json({ success: true, user: sanitizeUser(db.users[idx]) });
});

// Admin verification of Agents/Organizations
app.post("/api/admin/verify-org", (req, res) => {
  const { orgId, status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.organizations.findIndex(o => o.id === orgId);
  if (idx === -1) return res.status(404).json({ error: "Organization not found" });

  db.organizations[idx].verificationStatus = status;
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "VERIFY_ORGANIZATION",
    orgId,
    "Organization",
    { status }
  );

  res.json({ success: true, organization: db.organizations[idx] });
});

app.post("/api/admin/verify-user", (req, res) => {
  const { userId, status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  db.users[idx].verificationStatus = status;
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "VERIFY_USER",
    userId,
    "User",
    { status }
  );

  res.json({ success: true, user: sanitizeUser(db.users[idx]) });
});

// -----------------------------------------------------------------------------
// DOCUMENT VERIFICATION SYSTEM
// -----------------------------------------------------------------------------

const ALL_DOCUMENT_TYPES_BY_CONTEXT: Record<VerificationContext, DocumentType[]> = {
  AGENT: [...REQUIRED_DOCUMENTS_BY_CONTEXT.AGENT, DocumentType.PASSPORT],
  AGENCY: REQUIRED_DOCUMENTS_BY_CONTEXT.AGENCY,
  DEVELOPER: REQUIRED_DOCUMENTS_BY_CONTEXT.DEVELOPER
};

function getVerificationContextForUser(user: { role: string }): VerificationContext | null {
  if (user.role === UserRole.AGENT) return "AGENT";
  if (user.role === UserRole.AGENCY_ADMIN) return "AGENCY";
  if (user.role === UserRole.DEVELOPER_ADMIN) return "DEVELOPER";
  return null;
}

function getDocumentOwnerContact(db: DatabaseState, doc: VerificationDocument): { email: string; name: string } | null {
  if (doc.context === "AGENT") {
    const u = db.users.find(u => u.id === doc.userId);
    return u ? { email: u.email, name: u.fullName } : null;
  }
  const o = db.organizations.find(o => o.id === doc.orgId);
  return o ? { email: o.email, name: o.name } : null;
}

// Recomputes the owning User/Organization's overall verificationStatus from its
// document checklist. Only flips between PENDING/APPROVED - a manually-set
// SUSPENDED status (from the existing account-level verify endpoints) is left alone.
function recomputeAccountVerification(db: DatabaseState, context: VerificationContext, userId?: string, orgId?: string) {
  if (!db.verificationDocuments) db.verificationDocuments = [];
  const isAgent = context === "AGENT";
  const owner: { verificationStatus: VerificationStatus; isExpat?: boolean } | undefined =
    isAgent ? db.users.find(u => u.id === userId) : db.organizations.find(o => o.id === orgId);
  if (!owner) return;
  if (owner.verificationStatus === VerificationStatus.SUSPENDED) return;

  const required = getRequiredDocumentTypes(context, isAgent ? owner.isExpat : undefined);
  const ownDocs = db.verificationDocuments.filter(d => (isAgent ? d.userId === userId : d.orgId === orgId));
  const allApproved = required.every(type => ownDocs.some(d => d.documentType === type && d.status === DocumentStatus.APPROVED));

  owner.verificationStatus = allApproved ? VerificationStatus.APPROVED : VerificationStatus.PENDING;

  // Onboarding pipeline (FIX3): once all required documents are APPROVED, an applicant sitting
  // at UNDER_VERIFICATION graduates to ACTIVE. Actor resolution mirrors document ownership:
  // the agent themself for AGENT context, or the org's admin user for AGENCY/DEVELOPER context.
  if (allApproved) {
    const actingUser = isAgent
      ? db.users.find(u => u.id === userId)
      : db.users.find(u => u.orgId === orgId && (u.role === UserRole.AGENCY_ADMIN || u.role === UserRole.DEVELOPER_ADMIN));
    if (actingUser && actingUser.applicationStatus === ApplicationStatus.UNDER_VERIFICATION) {
      actingUser.applicationStatus = ApplicationStatus.ACTIVE;
    }
  }
}

function generateDocumentReviewEmailHtml(name: string, documentType: string, status: string, rejectionReason?: string): string {
  name = escapeHtml(name);
  rejectionReason = rejectionReason ? escapeHtml(rejectionReason) : rejectionReason;
  const statusColor = status === DocumentStatus.APPROVED ? "#059669" : "#dc2626";
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">Verification Document ${status === DocumentStatus.APPROVED ? "Approved" : "Rejected"}</h2>
    <p>Dear ${name},</p>
    <p>Your submitted document <strong>${documentType.replace(/_/g, " ")}</strong> has been reviewed and marked as
    <strong style="color: ${statusColor};">${status}</strong>.</p>
    ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p><p>Please resubmit a corrected document from your workspace.</p>` : ""}
    <p>&mdash; Nerou Finder Compliance Team</p>
  </div>`;
}

function generateDocumentExpiryEmailHtml(name: string, documentType: string, daysLeft: number, expired: boolean): string {
  name = escapeHtml(name);
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">${expired ? "Verification Document Expired" : "Verification Document Expiring Soon"}</h2>
    <p>Dear ${name},</p>
    <p>Your document <strong>${documentType.replace(/_/g, " ")}</strong> ${expired ? "has expired and your account verification has been downgraded until it is renewed." : `will expire in ${daysLeft} day(s).`}</p>
    <p>Please upload a renewed document from your workspace as soon as possible to avoid disruption.</p>
    <p>&mdash; Nerou Finder Compliance Team</p>
  </div>`;
}

// Generic lightweight template for the assorted lifecycle notifications added across
// FIX 9 (listing/lead/viewing/profile/security events) - keeps a consistent look without a
// bespoke generator function per event, matching the styling of the other templates above.
function generateNotificationEmailHtml(title: string, name: string, bodyHtml: string): string {
  title = escapeHtml(title);
  name = escapeHtml(name);
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">${title}</h2>
    <p>Dear ${name},</p>
    ${bodyHtml}
    <p>&mdash; Nerou Finder</p>
  </div>`;
}

// Submit or resubmit a verification document (Agent / Agency Admin / Developer Admin)
app.post("/api/verification-documents", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const context = getVerificationContextForUser(actor);
  if (!context) return res.status(403).json({ error: "Your account type does not require document verification." });

  const { documentType, fileUrl, expiryDate } = req.body;
  if (!documentType || !fileUrl) return res.status(400).json({ error: "documentType and fileUrl are required." });
  if (!ALL_DOCUMENT_TYPES_BY_CONTEXT[context].includes(documentType)) {
    return res.status(400).json({ error: `${documentType} is not a valid document type for ${context}.` });
  }

  if (!db.verificationDocuments) db.verificationDocuments = [];
  const userId = context === "AGENT" ? actor.id : undefined;
  const orgId = context !== "AGENT" ? actor.orgId : undefined;
  if (context !== "AGENT" && !orgId) return res.status(400).json({ error: "No organization associated with this account." });

  const existingIdx = db.verificationDocuments.findIndex(d =>
    d.documentType === documentType && (context === "AGENT" ? d.userId === userId : d.orgId === orgId)
  );

  const now = new Date().toISOString();
  let doc: VerificationDocument;
  if (existingIdx > -1) {
    doc = db.verificationDocuments[existingIdx];
    doc.fileUrl = fileUrl;
    doc.status = DocumentStatus.PENDING;
    doc.rejectionReason = undefined;
    doc.expiryDate = expiryDate || undefined;
    doc.submittedDate = now;
    doc.reviewedDate = undefined;
    doc.reviewedBy = undefined;
    doc.reminder30SentDate = undefined;
    doc.reminder7SentDate = undefined;
  } else {
    doc = {
      id: `docv-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      context,
      userId,
      orgId,
      documentType,
      fileUrl,
      status: DocumentStatus.PENDING,
      expiryDate: expiryDate || undefined,
      submittedDate: now
    };
    db.verificationDocuments.push(doc);
  }

  // Submitting a passport is treated as a self-declaration of expat status, which is
  // what makes PASSPORT part of the AGENT required checklist going forward.
  if (context === "AGENT" && documentType === DocumentType.PASSPORT) {
    actor.isExpat = true;
  }

  // Onboarding pipeline (FIX3): once every required document type has been submitted (PENDING
  // review or later counts - they don't need to be APPROVED yet, just present), an applicant
  // sitting at AWAITING_DOCUMENTS moves on to UNDER_VERIFICATION. `actor` is already the correct
  // party to bump in both cases: the agent themself for AGENT context, or the org admin who is
  // the only one able to submit AGENCY/DEVELOPER documents.
  const requiredForBump = getRequiredDocumentTypes(context, actor.isExpat);
  const ownDocsAfterSubmit = db.verificationDocuments.filter(d => (context === "AGENT" ? d.userId === userId : d.orgId === orgId));
  const allSubmitted = requiredForBump.every(type => ownDocsAfterSubmit.some(d => d.documentType === type));
  if (allSubmitted && actor.applicationStatus === ApplicationStatus.AWAITING_DOCUMENTS) {
    actor.applicationStatus = ApplicationStatus.UNDER_VERIFICATION;
  }

  writeDb(db);
  logAudit(actor.id, actor.fullName, actor.role, "SUBMIT_VERIFICATION_DOCUMENT", doc.id, "VerificationDocument", { documentType, context });

  // FIX 9: confirm receipt of the submission - previously only the eventual approve/reject
  // decision emailed anything, submission itself was silent.
  if (actor.email) {
    sendMockEmail(
      actor.email,
      `[Nerou Finder] Document Received: ${documentType.replace(/_/g, " ")}`,
      generateNotificationEmailHtml(
        "Verification Document Received",
        actor.fullName,
        `<p>We've received your submitted document <strong>${documentType.replace(/_/g, " ")}</strong>. It's now pending review by our compliance team.</p>`
      ),
      "document_submitted"
    );
  }

  res.json({ success: true, document: doc });
});

// Get my verification checklist + submitted documents
app.get("/api/verification-documents/mine", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const context = getVerificationContextForUser(actor);
  if (!context) return res.status(403).json({ error: "Your account type does not require document verification." });

  if (!db.verificationDocuments) db.verificationDocuments = [];
  const userId = context === "AGENT" ? actor.id : undefined;
  const orgId = context !== "AGENT" ? actor.orgId : undefined;

  const documents = db.verificationDocuments.filter(d => (context === "AGENT" ? d.userId === userId : d.orgId === orgId));
  const required = getRequiredDocumentTypes(context, actor.isExpat);

  // Self-heal: ensure verificationStatus always reflects actual document completeness
  // (matters for accounts that were pre-approved before this checklist existed).
  recomputeAccountVerification(db, context, userId, orgId);
  writeDb(db);

  const owner: { verificationStatus: VerificationStatus } | undefined =
    context === "AGENT" ? db.users.find(u => u.id === userId) : db.organizations.find(o => o.id === orgId);

  res.json({
    context,
    required,
    documents,
    verificationStatus: owner?.verificationStatus || VerificationStatus.PENDING
  });
});

// Admin: list all verification documents (optionally filtered by status/context)
app.get("/api/admin/verification-documents", (req, res) => {
  const db = readDb();
  if (!db.verificationDocuments) db.verificationDocuments = [];
  const { status, context } = req.query;
  let docs = db.verificationDocuments;
  if (status) docs = docs.filter(d => d.status === status);
  if (context) docs = docs.filter(d => d.context === context);

  const enriched = docs.map(d => {
    const contact = getDocumentOwnerContact(db, d);
    return { ...d, applicantName: contact?.name || "Unknown", applicantEmail: contact?.email || "" };
  });

  res.json(enriched);
});

// Admin: review (approve/reject) a single document - rejection requires a reason
app.post("/api/admin/verification-documents/review", (req, res) => {
  const { documentId, status, rejectionReason } = req.body;
  const actor = getAuditActor(req);
  if (!documentId || !status) return res.status(400).json({ error: "documentId and status are required." });
  if (status !== DocumentStatus.APPROVED && status !== DocumentStatus.REJECTED) {
    return res.status(400).json({ error: "status must be APPROVED or REJECTED." });
  }
  if (status === DocumentStatus.REJECTED && !rejectionReason) {
    return res.status(400).json({ error: "rejectionReason is required when rejecting a document." });
  }

  const db = readDb();
  if (!db.verificationDocuments) db.verificationDocuments = [];
  const idx = db.verificationDocuments.findIndex(d => d.id === documentId);
  if (idx === -1) return res.status(404).json({ error: "Document not found." });

  const doc = db.verificationDocuments[idx];
  doc.status = status;
  doc.rejectionReason = status === DocumentStatus.REJECTED ? rejectionReason : undefined;
  doc.reviewedDate = new Date().toISOString();
  doc.reviewedBy = actor.id;

  recomputeAccountVerification(db, doc.context, doc.userId, doc.orgId);
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "REVIEW_VERIFICATION_DOCUMENT",
    documentId,
    "VerificationDocument",
    { status, rejectionReason }
  );

  const contact = getDocumentOwnerContact(db, doc);
  if (contact) {
    const html = generateDocumentReviewEmailHtml(contact.name, doc.documentType, status, doc.rejectionReason);
    sendMockEmail(
      contact.email,
      `[Nerou Finder] Document ${status === DocumentStatus.APPROVED ? "Approved" : "Rejected"}: ${doc.documentType.replace(/_/g, " ")}`,
      html,
      "document_review"
    );
  }

  res.json({ success: true, document: doc });
});

// Expiry sweep: flags EXPIRED documents, downgrades verification, and sends 30/7-day reminder emails.
// Runs on an interval from startServer() and can also be triggered manually for testing.
export function checkDocumentExpiryAndReminders() {
  const db = readDb();
  if (!db.verificationDocuments || db.verificationDocuments.length === 0) return;

  const now = Date.now();
  let changed = false;

  for (const doc of db.verificationDocuments) {
    if (!doc.expiryDate || doc.status !== DocumentStatus.APPROVED) continue;
    const expiryTime = Date.parse(doc.expiryDate);
    if (isNaN(expiryTime)) continue;
    const daysLeft = Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000));
    const contact = getDocumentOwnerContact(db, doc);

    if (daysLeft <= 0) {
      doc.status = DocumentStatus.EXPIRED;
      recomputeAccountVerification(db, doc.context, doc.userId, doc.orgId);
      changed = true;
      if (contact) {
        sendMockEmail(
          contact.email,
          `[Nerou Finder] Document Expired: ${doc.documentType.replace(/_/g, " ")}`,
          generateDocumentExpiryEmailHtml(contact.name, doc.documentType, 0, true),
          "document_expired"
        );
      }
      logAudit("system", "System", UserRole.PLATFORM_ADMIN, "DOCUMENT_EXPIRED", doc.id, "VerificationDocument", { documentType: doc.documentType });
    } else if (daysLeft <= 7 && !doc.reminder7SentDate) {
      doc.reminder7SentDate = new Date().toISOString();
      changed = true;
      if (contact) {
        sendMockEmail(
          contact.email,
          `[Nerou Finder] Document Expiring in ${daysLeft} Day(s): ${doc.documentType.replace(/_/g, " ")}`,
          generateDocumentExpiryEmailHtml(contact.name, doc.documentType, daysLeft, false),
          "document_expiry_reminder"
        );
      }
    } else if (daysLeft <= 30 && !doc.reminder30SentDate) {
      doc.reminder30SentDate = new Date().toISOString();
      changed = true;
      if (contact) {
        sendMockEmail(
          contact.email,
          `[Nerou Finder] Document Expiring in ${daysLeft} Day(s): ${doc.documentType.replace(/_/g, " ")}`,
          generateDocumentExpiryEmailHtml(contact.name, doc.documentType, daysLeft, false),
          "document_expiry_reminder"
        );
      }
    }
  }

  if (changed) writeDb(db);
}

function generatePropertyStaleEmailHtml(name: string, propertyTitle: string, kind: "reminder" | "paused"): string {
  name = escapeHtml(name);
  propertyTitle = escapeHtml(propertyTitle);
  if (kind === "paused") {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1918;">Listing Paused - Availability Confirmation Needed</h2>
      <p>Dear ${name},</p>
      <p>Your listing <strong>${propertyTitle}</strong> has not had its availability confirmed in over 30 days, so it has been automatically paused and removed from public search results.</p>
      <p>Please log in to your workspace and click "Confirm Still Available" on this listing to reactivate it immediately.</p>
      <p>&mdash; Nerou Finder Listings Team</p>
    </div>`;
  }
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">Please Confirm Your Listing Is Still Available</h2>
    <p>Dear ${name},</p>
    <p>Your listing <strong>${propertyTitle}</strong> hasn't had its availability confirmed in a while. Please log in to your workspace and click "Confirm Still Available" to keep it fresh and fully visible to buyers and renters.</p>
    <p>If it isn't reconfirmed, it may be shown lower in search results and, if left unconfirmed for 30 days total, automatically paused.</p>
    <p>&mdash; Nerou Finder Listings Team</p>
  </div>`;
}

// Property availability staleness sweep: sends a one-time-per-window "please confirm" reminder
// once a listing crosses 14 days since its last confirmed-available check, and auto-pauses it
// (with a notification email) once it crosses 30 days. The 21-29 day "Availability Unconfirmed"
// public badge and search ranking penalty are computed live from lastConfirmedAvailableDate
// wherever needed (see GET /api/properties and the frontend) rather than stored here. Runs on
// the same interval as the verification document expiry sweep and can also be triggered
// manually for testing.
export function checkPropertyStalenessAndReminders() {
  const db = readDb();
  if (!db.properties || db.properties.length === 0) return;

  const now = Date.now();
  let changed = false;

  for (const prop of db.properties) {
    // Only listings that are actually live (or on their way to being live) carry a freshness
    // clock - a SOLD/RENTED/SUSPENDED/DRAFT listing, or one already PAUSED (whether manually
    // or by this very sweep), has nothing to "confirm" right now.
    if (prop.listingStatus !== ListingStatus.PUBLISHED && prop.listingStatus !== ListingStatus.PENDING_REVIEW) continue;

    const baseline = prop.lastConfirmedAvailableDate || prop.createdDate;
    const baselineTime = Date.parse(baseline);
    if (isNaN(baselineTime)) continue;
    const daysStale = Math.floor((now - baselineTime) / (24 * 60 * 60 * 1000));

    const agent = db.users.find(u => u.id === prop.agentId);

    if (daysStale >= AVAILABILITY_AUTO_PAUSE_DAYS) {
      prop.staleAutoPausedFromStatus = prop.listingStatus;
      prop.listingStatus = ListingStatus.PAUSED;
      changed = true;

      if (agent) {
        sendMockEmail(
          agent.email,
          `[Nerou Finder] Listing Paused - Availability Confirmation Needed: ${prop.title}`,
          generatePropertyStaleEmailHtml(agent.fullName, prop.title, "paused"),
          "listing_stale_paused"
        );
      }
      logAudit("system", "System", UserRole.PLATFORM_ADMIN, "AUTO_PAUSE_STALE_PROPERTY", prop.id, "Property", { title: prop.title, daysStale });
    } else if (
      daysStale >= AVAILABILITY_CONFIRM_DUE_DAYS &&
      (!prop.staleReminderSentDate || Date.parse(prop.staleReminderSentDate) < baselineTime)
    ) {
      prop.staleReminderSentDate = new Date().toISOString();
      changed = true;

      if (agent) {
        sendMockEmail(
          agent.email,
          `[Nerou Finder] Please Confirm Your Listing Is Still Available: ${prop.title}`,
          generatePropertyStaleEmailHtml(agent.fullName, prop.title, "reminder"),
          "listing_stale_reminder"
        );
      }
    }
  }

  if (changed) writeDb(db);
}

// Ad Campaigns (Monetization)
app.get("/api/campaigns", (req, res) => {
  const db = readDb();
  res.json(db.campaigns);
});

app.post("/api/campaigns", authMiddleware, (req, res) => {
  const db = readDb();
  const campData = req.body;
  const id = `camp-${Date.now()}`;

  if (campData.budget !== undefined && Number(campData.budget) < 0) {
    return res.status(400).json({ error: "Campaign budget cannot be negative." });
  }

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agency Admin";
  const actorRole = authReq.user?.role || UserRole.AGENCY_ADMIN;

  // orgId always comes from the actor's own org, never from the client body - otherwise
  // any authenticated account could spam another org's campaign list by supplying its id.
  const actorUser = db.users.find(u => u.id === actorId);
  const isPlatformAdmin = actorRole === UserRole.PLATFORM_ADMIN || actorRole === UserRole.SUPER_ADMIN;
  const resolvedOrgId = isPlatformAdmin ? (campData.orgId || actorUser?.orgId) : actorUser?.orgId;
  if (!resolvedOrgId) {
    return res.status(403).json({ error: "You must belong to an organization to create an ad campaign." });
  }

  const newCampaign: AdCampaign = {
    id,
    orgId: resolvedOrgId,
    propertyId: campData.propertyId,
    projectId: campData.projectId,
    type: campData.type || "FEATURED_LISTING",
    budget: Number(campData.budget),
    startDate: campData.startDate || new Date().toISOString().split("T")[0],
    endDate: campData.endDate,
    status: "PENDING_REVIEW",
    metrics: {
      impressions: 0,
      clicks: 0,
      saves: 0,
      leads: 0,
      spend: 0
    },
    createdDate: new Date().toISOString()
  };

  db.campaigns.unshift(newCampaign);
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "CREATE_AD_CAMPAIGN",
    id,
    "AdCampaign",
    { type: newCampaign.type, budget: newCampaign.budget }
  );

  res.json(newCampaign);
});

// FIX 6: campaign owner-only ops (Edit/Pause/Resume/Delete) - the campaign flow previously
// had no way to do any of these; only self-service ad-boosts (a separate flow) supported
// pause/resume-equivalent lifecycle actions.
function requireCampaignOwner(req: express.Request, res: express.Response, campaign: AdCampaign | undefined): boolean {
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return false;
  }
  const authReq = req as AuthenticatedRequest;
  const actor = readDb().users.find(u => u.id === authReq.user?.id);
  const isOwnerOrgAdmin = !!actor?.orgId && actor.orgId === campaign.orgId &&
    (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  const isPlatformAdmin = actor?.role === UserRole.PLATFORM_ADMIN || actor?.role === UserRole.SUPER_ADMIN;
  if (!isOwnerOrgAdmin && !isPlatformAdmin) {
    res.status(403).json({ error: "You are not authorized to manage this campaign." });
    return false;
  }
  return true;
}

app.put("/api/campaigns/:id", authMiddleware, (req, res) => {
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!requireCampaignOwner(req, res, campaign)) return;

  const { budget, endDate, type } = req.body as { budget?: number; endDate?: string; type?: string };
  if (budget !== undefined) {
    if (Number(budget) < 0) return res.status(400).json({ error: "Campaign budget cannot be negative." });
    campaign!.budget = Number(budget);
  }
  if (endDate !== undefined) campaign!.endDate = endDate;
  if (type !== undefined) campaign!.type = type as AdCampaign["type"];
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(authReq.user?.id || "unknown", authReq.user?.fullName || "Agency Admin", (authReq.user?.role as UserRole) || UserRole.AGENCY_ADMIN, "UPDATE_AD_CAMPAIGN", campaign!.id, "AdCampaign", { budget, endDate, type });

  res.json(campaign);
});

app.post("/api/campaigns/:id/pause", authMiddleware, (req, res) => {
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!requireCampaignOwner(req, res, campaign)) return;
  if (campaign!.status !== "ACTIVE") return res.status(400).json({ error: "Only an active campaign can be paused." });

  campaign!.status = "PAUSED";
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(authReq.user?.id || "unknown", authReq.user?.fullName || "Agency Admin", (authReq.user?.role as UserRole) || UserRole.AGENCY_ADMIN, "PAUSE_AD_CAMPAIGN", campaign!.id, "AdCampaign", {});

  res.json(campaign);
});

app.post("/api/campaigns/:id/resume", authMiddleware, (req, res) => {
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!requireCampaignOwner(req, res, campaign)) return;
  if (campaign!.status !== "PAUSED") return res.status(400).json({ error: "Only a paused campaign can be resumed." });

  campaign!.status = "ACTIVE";
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(authReq.user?.id || "unknown", authReq.user?.fullName || "Agency Admin", (authReq.user?.role as UserRole) || UserRole.AGENCY_ADMIN, "RESUME_AD_CAMPAIGN", campaign!.id, "AdCampaign", {});

  res.json(campaign);
});

app.delete("/api/campaigns/:id", authMiddleware, (req, res) => {
  const db = readDb();
  const campaign = db.campaigns.find(c => c.id === req.params.id);
  if (!requireCampaignOwner(req, res, campaign)) return;

  db.campaigns = db.campaigns.filter(c => c.id !== req.params.id);
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(authReq.user?.id || "unknown", authReq.user?.fullName || "Agency Admin", (authReq.user?.role as UserRole) || UserRole.AGENCY_ADMIN, "DELETE_AD_CAMPAIGN", req.params.id, "AdCampaign", {});

  res.json({ success: true });
});

app.post("/api/admin/campaigns/review", (req, res) => {
  const { campaignId, status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) return res.status(404).json({ error: "Campaign not found" });

  db.campaigns[idx].status = status;
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "REVIEW_AD_CAMPAIGN",
    campaignId,
    "AdCampaign",
    { status }
  );

  res.json({ success: true, campaign: db.campaigns[idx] });
});

// -----------------------------------------------------------------------------
// SELF-SERVICE AD BOOSTS & BILLING LEDGER (independent of the campaign-based
// FEATURED_LISTING admin-approval flow above, which is left untouched)
// -----------------------------------------------------------------------------

function getCurrentBillingPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Post-Campaign ROI Report: computed live (no schema change / no settle-time write needed) so
// it's always accurate for the current state of the property's views/leads, whether the charge
// is settled yet or not. "Before" window is the 7 days immediately preceding the boost; the
// "during" window runs from the charge's createdDate through its settledDate (or now, if the
// billing period hasn't been settled yet). Views are summed from Property.viewsByDay (see FIX 8
// real view tracking, POST /api/properties/:id/view) which is keyed by "YYYY-MM-DD".
function computeAdChargeRoi(charge: AdCharge, db: DatabaseState): {
  viewsBefore: number;
  viewsDuring: number;
  leadsGenerated: number;
  costPerLead: number | null;
} {
  const property = db.properties.find(p => p.id === charge.propertyId);
  const boostStart = new Date(charge.createdDate);
  const boostEnd = charge.settledDate ? new Date(charge.settledDate) : new Date();
  const preStart = new Date(boostStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const sumViewsInRange = (from: Date, to: Date): number => {
    if (!property?.viewsByDay) return 0;
    let total = 0;
    for (const [dateStr, count] of Object.entries(property.viewsByDay)) {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      if (d >= from && d <= to) total += count;
    }
    return total;
  };

  const viewsBefore = sumViewsInRange(preStart, boostStart);
  const viewsDuring = sumViewsInRange(boostStart, boostEnd);

  const leadsGenerated = db.leads.filter(l => {
    if (l.propertyId !== charge.propertyId) return false;
    const created = new Date(l.createdDate);
    if (isNaN(created.getTime())) return false;
    return created >= boostStart && created <= boostEnd;
  }).length;

  const costPerLead = leadsGenerated > 0 ? Math.round((charge.amount / leadsGenerated) * 100) / 100 : null;

  return { viewsBefore, viewsDuring, leadsGenerated, costPerLead };
}

// Self-service: instantly activate a Bump or Featured boost on your own org's listing
app.post("/api/ad-charges", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });
  if (![UserRole.AGENT, UserRole.AGENCY_ADMIN, UserRole.DEVELOPER_ADMIN].includes(actor.role as UserRole)) {
    return res.status(403).json({ error: "Only agents, agency admins, or developer admins can activate ad boosts." });
  }

  const isAgent = actor.role === UserRole.AGENT;
  const effectiveAgentType = isAgent ? getEffectiveAgentType(actor) : undefined;

  // AGENCY_AGENT never self-triggers a boost - their agency admin does it on their behalf
  // (billed to the agency ledger), so reject outright before any other checks.
  if (isAgent && effectiveAgentType === AgentType.AGENCY_AGENT) {
    return res.status(403).json({ error: "Ask your agency administrator to boost this listing." });
  }

  const { propertyId, type } = req.body as { propertyId: string; type: AdChargeType };
  if (!propertyId || (type !== "BUMP" && type !== "FEATURED")) {
    return res.status(400).json({ error: "propertyId and a valid type (BUMP or FEATURED) are required." });
  }

  const property = db.properties.find(p => p.id === propertyId);
  if (!property) return res.status(404).json({ error: "Property not found." });

  // Billing owner key for the ad-charges ledger: a real Organization.id for org-billed
  // accounts (AGENCY_ADMIN / DEVELOPER_ADMIN, or an AGENCY_AGENT - though that's rejected
  // above), or the agent's own User.id as a stand-in "billing owner" key for a self-serve
  // INDEPENDENT_AGENT charge, since they carry their own subscription instead of an org's.
  let billingOwnerId: string;
  let subscriptionStatus: string | undefined;
  let subscriptionPlanId: string | undefined;

  if (isAgent && effectiveAgentType === AgentType.INDEPENDENT_AGENT) {
    if (property.agentId !== actor.id) {
      return res.status(403).json({ error: "You may only boost your own listings." });
    }
    billingOwnerId = actor.id;
    subscriptionStatus = actor.subscriptionStatus;
    subscriptionPlanId = actor.subscriptionPlanId;
  } else {
    if (!actor.orgId) return res.status(400).json({ error: "No organization associated with this account." });

    const org = db.organizations.find(o => o.id === actor.orgId);
    if (!org) return res.status(404).json({ error: "Organization not found." });
    if (property.orgId !== org.id) {
      return res.status(403).json({ error: "You may only boost listings that belong to your own organization." });
    }
    billingOwnerId = org.id;
    subscriptionStatus = org.subscriptionStatus;
    subscriptionPlanId = org.subscriptionPlanId;
  }

  if (subscriptionStatus !== "ACTIVE") {
    return res.status(403).json({ error: "An active subscription is required to activate self-service ad boosts." });
  }

  if (!db.adCharges) db.adCharges = [];
  const currentPeriod = getCurrentBillingPeriod();

  const hasUnsettledPastPeriod = db.adCharges.some(c => c.orgId === billingOwnerId && c.billingPeriod !== currentPeriod && !c.settled);
  if (hasUnsettledPastPeriod) {
    return res.status(403).json({ error: "You have an unsettled ad billing period from a previous month. Please contact support to settle it before activating new boosts." });
  }

  const cap = db.aiConfig?.adBoostCaps?.[subscriptionPlanId || ""] ?? DEFAULT_BOOST_CAP_FALLBACK;
  const usedThisPeriod = db.adCharges.filter(c => c.orgId === billingOwnerId && c.billingPeriod === currentPeriod).length;
  if (usedThisPeriod >= cap) {
    return res.status(403).json({ error: `Monthly self-service boost cap (${cap}) reached for your plan this billing period.` });
  }

  const charge: AdCharge = {
    id: `adc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    orgId: billingOwnerId,
    propertyId,
    type,
    amount: AD_CHARGE_PRICES[type],
    createdDate: new Date().toISOString(),
    billingPeriod: currentPeriod,
    settled: false
  };
  db.adCharges.push(charge);
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "ACTIVATE_AD_BOOST", charge.id, "AdCharge", { propertyId, type, amount: charge.amount });

  res.json({ success: true, charge, remainingThisPeriod: Math.max(0, cap - usedThisPeriod - 1) });
});

// List ad charges - org members see only their own org's ledger, admins may query any org
app.get("/api/ad-charges", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  if (!db.adCharges) db.adCharges = [];
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  let charges = db.adCharges;
  if (actor.role === UserRole.PLATFORM_ADMIN || actor.role === UserRole.SUPER_ADMIN) {
    const { orgId } = req.query;
    if (orgId) charges = charges.filter(c => c.orgId === orgId);
  } else {
    // INDEPENDENT_AGENT has no orgId - their own charges are keyed by their User.id instead
    // (see POST /api/ad-charges), so fall back to that as the ledger lookup key.
    const billingOwnerId = actor.orgId || actor.id;
    charges = charges.filter(c => c.orgId === billingOwnerId);
  }

  // Post-Campaign ROI Report: attach a live-computed performance summary to every charge
  // (views in the 7 days before the boost vs. during it, leads generated, cost-per-lead) -
  // see computeAdChargeRoi() above. Purely additive field, safe whether the charge is settled
  // yet or still in its active billing period.
  const chargesWithRoi = charges.map(c => ({ ...c, roiSummary: computeAdChargeRoi(c, db) }));

  res.json(chargesWithRoi);
});

// Admin: mark a billing period as settled for an org (mirrors the existing manual
// subscription-payment-confirmation pattern at /api/admin/organizations/subscription)
app.post("/api/admin/ad-charges/settle", (req, res) => {
  const { orgId, billingPeriod } = req.body;
  const actor = getAuditActor(req);
  if (!orgId || !billingPeriod) return res.status(400).json({ error: "orgId and billingPeriod are required." });

  const db = readDb();
  if (!db.adCharges) db.adCharges = [];
  const matching = db.adCharges.filter(c => c.orgId === orgId && c.billingPeriod === billingPeriod);
  if (matching.length === 0) return res.status(404).json({ error: "No ad charges found for that organization and billing period." });

  const now = new Date().toISOString();
  matching.forEach(c => {
    c.settled = true;
    c.settledDate = now;
    c.settledBy = actor.id;
  });
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "SETTLE_AD_BILLING_PERIOD",
    orgId,
    "Organization",
    { billingPeriod, chargeCount: matching.length, total: matching.reduce((s, c) => s + c.amount, 0) }
  );

  res.json({ success: true, settledCount: matching.length });
});

// -----------------------------------------------------------------------------
// SMART BOOST RECOMMENDATIONS ("Recommended to Boost" panel)
// -----------------------------------------------------------------------------
//
// Simple "Performance Score" per property, computed from data already on hand: total views,
// lead count, and how long ago it was created / last boosted. No dedicated AI-search-match log
// exists in this codebase (checked - there is no aiSearchLog/searchMatchCount table), so this
// falls back to the views/leads-relative-to-age heuristic described in the task. Listings that
// are at least a couple of days old, haven't been boosted very recently, and are generating few
// views/leads per day since creation are surfaced as candidates. For each candidate we make ONE
// real Gemini call (same client/model/error-handling pattern as /api/ai/search above) to produce
// a natural-language one-sentence reason, in both English and Arabic.
const BOOST_RECOMMENDATION_MIN_AGE_DAYS = 2;
const BOOST_RECOMMENDATION_MIN_DAYS_SINCE_LAST_BOOST = 2;
const BOOST_RECOMMENDATION_MAX_RESULTS = 5;
// Above this Performance Score (views/day + leads/day*5, see below), a listing is doing fine
// on its own and isn't worth flagging as an underperformer.
const BOOST_RECOMMENDATION_MAX_SCORE = 5;

function daysSinceIso(dateStr?: string): number {
  if (!dateStr) return 0;
  const then = Date.parse(dateStr);
  if (isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)));
}

app.get("/api/boost-recommendations", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const { agentId, orgId } = req.query as { agentId?: string; orgId?: string };
  const isPlatformStaff = actor.role === UserRole.PLATFORM_ADMIN || actor.role === UserRole.SUPER_ADMIN;

  let scoped: Property[];
  if (orgId) {
    if (!isPlatformStaff && actor.orgId !== orgId) {
      return res.status(403).json({ error: "Not authorized for this organization." });
    }
    scoped = db.properties.filter(p => p.orgId === orgId);
  } else {
    const targetAgentId = agentId || actor.id;
    if (!isPlatformStaff && targetAgentId !== actor.id) {
      return res.status(403).json({ error: "Not authorized for this agent." });
    }
    scoped = db.properties.filter(p => p.agentId === targetAgentId);
  }

  // Only currently-live listings are worth boosting.
  scoped = scoped.filter(p => p.listingStatus === ListingStatus.PUBLISHED);

  const adCharges = db.adCharges || [];

  type Candidate = {
    property: Property;
    performanceScore: number;
    viewsPerDay: number;
    leadsCount: number;
    ageDays: number;
    daysSinceLastBoost: number;
  };

  const candidates: Candidate[] = scoped
    .map(property => {
      const ageDays = Math.max(1, daysSinceIso(property.createdDate));
      const lastBoost = adCharges
        .filter(c => c.propertyId === property.id)
        .sort((a, b) => Date.parse(b.createdDate) - Date.parse(a.createdDate))[0];
      const daysSinceLastBoost = lastBoost ? daysSinceIso(lastBoost.createdDate) : ageDays;
      const leadsCount = db.leads.filter(l => l.propertyId === property.id).length;
      const viewsPerDay = (property.views || 0) / ageDays;
      const leadsPerDay = leadsCount / ageDays;
      // Simple weighted engagement rate: views count a little, leads count a lot more since
      // they're the far stronger signal of real interest. Lower = more "underperforming".
      const performanceScore = Math.round((viewsPerDay + leadsPerDay * 5) * 100) / 100;
      return { property, performanceScore, viewsPerDay, leadsCount, ageDays, daysSinceLastBoost };
    })
    .filter(
      c =>
        c.ageDays >= BOOST_RECOMMENDATION_MIN_AGE_DAYS &&
        c.daysSinceLastBoost >= BOOST_RECOMMENDATION_MIN_DAYS_SINCE_LAST_BOOST &&
        // Only genuinely low-performing listings are worth flagging - without this absolute
        // cutoff, ranking alone would always surface a workspace's "worst" listing even when
        // every listing is actually doing fine.
        c.performanceScore < BOOST_RECOMMENDATION_MAX_SCORE
    )
    .sort((a, b) => a.performanceScore - b.performanceScore)
    .slice(0, BOOST_RECOMMENDATION_MAX_RESULTS);

  if (candidates.length === 0) {
    return res.json({ recommendations: [] });
  }

  const cfg = db.aiConfig;
  const model = cfg?.modelConfiguration?.model || "gemini-3.6-flash";

  const buildFallbackReason = (c: Candidate) => ({
    reasonEn: `Only ${c.property.views || 0} views and ${c.leadsCount} lead(s) in ${c.ageDays} day(s) since listing${
      c.daysSinceLastBoost === c.ageDays ? " (never boosted)" : ` (last boosted ${c.daysSinceLastBoost}d ago)`
    } - boosting could help it get seen.`,
    reasonAr: `${c.property.views || 0} مشاهدة فقط و ${c.leadsCount} عميل محتمل خلال ${c.ageDays} يوم منذ الإدراج${
      c.daysSinceLastBoost === c.ageDays ? " (لم يتم رفعه من قبل)" : ` (آخر رفع منذ ${c.daysSinceLastBoost} يوم)`
    } - قد يساعد الرفع في زيادة ظهوره.`
  });

  let ai: GoogleGenAI | null = null;
  try {
    ai = getGeminiClient();
  } catch (e) {
    // No Gemini key configured - degrade gracefully to the deterministic fallback reason
    // rather than failing the whole panel.
    ai = null;
  }

  const recommendations = await Promise.all(
    candidates.map(async c => {
      let reasonEn: string;
      let reasonAr: string;

      if (!ai) {
        const fb = buildFallbackReason(c);
        reasonEn = fb.reasonEn;
        reasonAr = fb.reasonAr;
      } else {
        try {
          const systemInstruction = `You are the boost-recommendation reasoning assistant for Nerou Finder's "Recommended to Boost" panel. You must respond with strictly valid JSON only, matching the given schema exactly - no markdown, no commentary, no text before or after the JSON object.`;

          const prompt = `Listing: "${c.property.title}" - a ${c.property.propertyType} in ${c.property.district}, ${c.property.city}, priced at ${c.property.price} ${c.property.currency}.
Real performance data since it was listed: ${c.property.views || 0} total views (about ${c.viewsPerDay.toFixed(2)} views/day) and ${c.leadsCount} lead(s), over ${c.ageDays} day(s) on the platform.
It was ${c.daysSinceLastBoost === c.ageDays ? "never boosted" : `last boosted ${c.daysSinceLastBoost} day(s) ago`}.
Write exactly one short, natural-language sentence (in English, and separately in Arabic) explaining concretely why this specific listing is a good candidate to boost right now. Reference the real numbers above. Do not invent any data that wasn't given.`;

          const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              systemInstruction,
              temperature: 0.2,
              maxOutputTokens: 1000,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  reasonEn: { type: Type.STRING },
                  reasonAr: { type: Type.STRING }
                },
                required: ["reasonEn", "reasonAr"]
              }
            }
          });

          const textResult = response.text;
          if (!textResult) throw new Error("AI returned empty text content.");
          const parsed = JSON.parse(textResult.trim());
          reasonEn = parsed.reasonEn;
          reasonAr = parsed.reasonAr;
        } catch (error: any) {
          console.error("Gemini boost-recommendation reason failed:", error);
          const fb = buildFallbackReason(c);
          reasonEn = fb.reasonEn;
          reasonAr = fb.reasonAr;
        }
      }

      return {
        propertyId: c.property.id,
        performanceScore: c.performanceScore,
        viewsPerDay: Math.round(c.viewsPerDay * 100) / 100,
        leadsCount: c.leadsCount,
        ageDays: c.ageDays,
        daysSinceLastBoost: c.daysSinceLastBoost,
        reasonEn,
        reasonAr
      };
    })
  );

  res.json({ recommendations });
});

// Admin: adjust monthly self-service boost caps per subscription plan id
app.post("/api/admin/ad-boost-caps", (req, res) => {
  const { caps } = req.body;
  if (!caps || typeof caps !== "object") return res.status(400).json({ error: "caps object is required." });

  const db = readDb();
  if (!db.aiConfig) db.aiConfig = {} as any;
  db.aiConfig.adBoostCaps = { ...(db.aiConfig.adBoostCaps || {}), ...caps };
  writeDb(db);

  res.json({ success: true, adBoostCaps: db.aiConfig.adBoostCaps });
});

// Support Reports (Moderation Queue)
app.get("/api/reports", (req, res) => {
  const db = readDb();
  res.json(db.reports);
});

app.post("/api/reports", publicWriteRateLimiter, (req, res) => {
  const db = readDb();
  const reportData = req.body;
  const id = `rep-${Date.now()}`;

  const newReport: SupportReport = {
    id,
    propertyId: reportData.propertyId,
    reporterEmail: reportData.reporterEmail,
    reporterName: reportData.reporterName,
    reason: reportData.reason,
    details: reportData.details,
    status: "OPEN",
    createdDate: new Date().toISOString()
  };

  db.reports.push(newReport);
  writeDb(db);

  res.json({ success: true, report: newReport });
});

app.post("/api/admin/reports/resolve", (req, res) => {
  const { reportId, status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  const idx = db.reports.findIndex(r => r.id === reportId);
  if (idx === -1) return res.status(404).json({ error: "Report not found" });

  db.reports[idx].status = status;
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "RESOLVE_SUPPORT_REPORT",
    reportId,
    "SupportReport",
    { status }
  );

  res.json({ success: true, report: db.reports[idx] });
});

// Audit Logs list for Admin Panel
app.get("/api/admin/audits", (req, res) => {
  const db = readDb();
  res.json(db.auditLogs);
});

// AI Configuration Admin routes
app.get("/api/admin/ai-config", (req, res) => {
  const db = readDb();
  res.json(db.aiConfig || {});
});

app.post("/api/admin/ai-config", (req, res) => {
  const db = readDb();
  db.aiConfig = {
    ...(db.aiConfig || {}),
    ...req.body
  };
  writeDb(db);
  res.json({ success: true, aiConfig: db.aiConfig });
});

// -----------------------------------------------------------------------------
const conversationSessions: Record<string, any[]> = {};

// AI NATURAL-LANGUAGE PROPERTY SEARCH (Server-side Gemini proxy)
// -----------------------------------------------------------------------------
app.post("/api/ai/search", aiSearchRateLimiter, async (req, res) => {
  const { prompt, conversationId } = req.body;
  if (!prompt || prompt.trim() === "") {
    return res.status(400).json({ error: "Query prompt is required." });
  }

  const db = readDb();
  const cfg = db.aiConfig || {
    aiName: "Nerou Find",
    aiDescription: "AI-Powered Property Discovery",
    aiPersonality: "Professional, precise technology discovery companion. Neutral, compliant, Qatar-focused, informative, helpful.",
    aiRules: "Never invent listings. Clearly declare that Nerou Finder does NOT act as a brokerage or receive commissions. Ground matches in real platform data. Match user constraints closely.",
    disclaimers: "Nerou Finder is a technology-first discovery marketplace. It does not provide real estate brokerage services, nor represent parties, nor receive commissions. The legal relationship remains between the relevant parties.",
    modelConfiguration: {
      model: "gemini-3.6-flash",
      temperature: 0.1,
      maxTokens: 1000
    }
  };

  // Filter active and published properties for visitors
  const availableProperties = db.properties.filter(
    p => p.listingStatus === ListingStatus.PUBLISHED && p.verificationStatus === VerificationStatus.APPROVED
  );

  try {
    const ai = getGeminiClient();

    const systemInstruction = `You are ${cfg.aiName}, the official AI-powered discovery and search intelligence engine of Nerou Finder (developed by Nerou Technology Services).

${cfg.aiDescription}

AI Personality & Tone:
${cfg.aiPersonality}

Rules & Compliance:
- ${cfg.aiRules}
- ${cfg.disclaimers}

Strict Grounding Rules:
- You must strictly only match properties that are present in the provided live database.
- Never invent properties, IDs, prices, areas, features, or details.
- Translate conversational criteria into structured criteria.
- If a user asks you to negotiate, represent them, write a lease, or guarantee a sale, you MUST output a standard brand disclaimer in your "whyMatchEn" and "whyMatchAr" explanations. For example: "${cfg.disclaimers}"

Response Schema Requirements:
You must respond with a strictly valid JSON object matching the following structure:
{
  "matches": [
    {
      "propertyId": "string (the exact property ID)",
      "whyMatchEn": "string (clear reason why this matches, with appropriate brand and compliance context in English)",
      "whyMatchAr": "string (clear reason why this matches, with appropriate brand and compliance context in Arabic)"
    }
  ]
}

If no properties logically match, or if the user asks questions completely unrelated to real estate discovery, return an empty "matches" array.

Here is the live properties JSON database:
${JSON.stringify(availableProperties, null, 2)}`;

    let contents: any[] = [];
    if (conversationId) {
      if (!conversationSessions[conversationId]) {
        conversationSessions[conversationId] = [];
      }
      contents = conversationSessions[conversationId];
    }

    contents.push({
      role: "user",
      parts: [{ text: `Visitor Search Request: "${prompt}"` }]
    });

    const response = await ai.models.generateContent({
      model: cfg.modelConfiguration?.model || "gemini-3.6-flash",
      contents,
      config: {
        systemInstruction,
        temperature: cfg.modelConfiguration?.temperature ?? 0.1,
        maxOutputTokens: cfg.modelConfiguration?.maxTokens ?? 1000,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  propertyId: { type: Type.STRING },
                  whyMatchEn: { type: Type.STRING },
                  whyMatchAr: { type: Type.STRING }
                },
                required: ["propertyId", "whyMatchEn", "whyMatchAr"]
              }
            }
          },
          required: ["matches"]
        }
      }
    });

    const textResult = response.text;
    if (!textResult) {
      throw new Error("AI returned empty text content.");
    }

    if (conversationId) {
      contents.push({
        role: "model",
        parts: [{ text: textResult }]
      });
    }

    const aiResponse = JSON.parse(textResult.trim());
    res.json(aiResponse);


  } catch (error: any) {
    console.error("Gemini API search failed:", error);
    res.status(500).json({
      error: "Gemini search failed",
      details: error.message,
      fallbackMatches: []
    });
  }
});

// =============================================================================
// LEGAL CMS & INFRASTRUCTURE ENDPOINTS
// =============================================================================
app.get("/api/legal", (req, res) => {
  const db = readDb();
  const docs = db.legalDocuments || [];
  // Visitor only sees PUBLISHED documents
  res.json(docs.filter(d => d.status === "PUBLISHED"));
});

app.get("/api/legal/:slug", (req, res) => {
  const db = readDb();
  const docs = db.legalDocuments || [];
  const doc = docs.find(d => d.slug === req.params.slug);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json(doc);
});

app.put("/api/admin/legal/:id", (req, res) => {
  const { id } = req.params;
  const { slug, title, titleAr, content, contentAr, version, effectiveDate, status, author, legalReviewStatus } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.legalDocuments) db.legalDocuments = [];

  const idx = db.legalDocuments.findIndex(d => d.id === id);
  const updatedDoc: LegalDocument = {
    id,
    slug: slug || "untitled",
    title: title || "",
    titleAr: titleAr || "",
    content: content || "",
    contentAr: contentAr || "",
    version: version || "1.0.0",
    effectiveDate: effectiveDate || new Date().toISOString().split("T")[0],
    lastUpdated: new Date().toISOString().split("T")[0],
    status: status || "DRAFT",
    author: author || "Admin",
    legalReviewStatus: legalReviewStatus || "PENDING"
  };

  if (idx !== -1) {
    db.legalDocuments[idx] = updatedDoc;
  } else {
    db.legalDocuments.push(updatedDoc);
  }

  writeDb(db);
  logAudit(
    actor.id,
    actor.name,
    actor.role,
    idx !== -1 ? "UPDATE_LEGAL_DOC" : "CREATE_LEGAL_DOC",
    id,
    "LegalDocument",
    { slug, status }
  );
  res.json({ success: true, document: updatedDoc });
});

// =============================================================================
// HELP CENTER ARTICLE ENDPOINTS
// =============================================================================
app.get("/api/help", (req, res) => {
  const db = readDb();
  const articles = db.helpArticles || [];
  res.json(articles);
});

app.post("/api/help/:id/view", (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db.helpArticles) db.helpArticles = [];
  const idx = db.helpArticles.findIndex(a => a.id === id);
  if (idx !== -1) {
    db.helpArticles[idx].viewCount = (db.helpArticles[idx].viewCount || 0) + 1;
    writeDb(db);
    return res.json({ success: true, viewCount: db.helpArticles[idx].viewCount });
  }
  res.status(404).json({ error: "Article not found" });
});

app.post("/api/admin/help", (req, res) => {
  const { id, category, title, titleAr, content, contentAr, isPublished } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.helpArticles) db.helpArticles = [];

  const targetId = id || `help-${Date.now()}`;
  const idx = db.helpArticles.findIndex(a => a.id === targetId);

  const updatedArticle: HelpArticle = {
    id: targetId,
    category: category || "VISITORS",
    title: title || "",
    titleAr: titleAr || "",
    content: content || "",
    contentAr: contentAr || "",
    isPublished: isPublished !== undefined ? isPublished : true,
    viewCount: idx !== -1 ? (db.helpArticles[idx].viewCount || 0) : 0
  };

  if (idx !== -1) {
    db.helpArticles[idx] = updatedArticle;
  } else {
    db.helpArticles.push(updatedArticle);
  }

  writeDb(db);
  logAudit(
    actor.id,
    actor.name,
    actor.role,
    idx !== -1 ? "UPDATE_HELP_ARTICLE" : "CREATE_HELP_ARTICLE",
    targetId,
    "HelpArticle",
    { category, title }
  );
  res.json({ success: true, article: updatedArticle });
});

// =============================================================================
// SUPPORT TICKET ENDPOINTS
// =============================================================================
// Scoped strictly to the authenticated caller's own tickets - never trust a client-supplied
// userId/email query param, or any logged-in visitor could read every user's support tickets
// (names, emails, phone numbers) platform-wide. Admin-wide ticket access is a separate,
// admin-gated endpoint (GET /api/admin/support/tickets).
app.get("/api/support/tickets", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  let tickets = db.supportTickets || [];
  tickets = tickets.filter(t => t.userId === authReq.user?.id || t.userEmail === authReq.user?.email);
  res.json(tickets);
});

app.post("/api/support/tickets", publicWriteRateLimiter, (req, res) => {
  const { userId, userEmail, userName, category, priority, subject, description } = req.body;
  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];

  const newTicket: SupportTicket = {
    id: `ticket-${Date.now()}`,
    userId: userId || "guest",
    userEmail: userEmail || "anonymous@example.com",
    userName: userName || "Guest",
    category: category || "TECHNICAL",
    priority: priority || "MEDIUM",
    subject: subject || "No Subject",
    description: description || "",
    status: "OPEN",
    createdDate: new Date().toISOString(),
    replies: []
  };

  db.supportTickets.push(newTicket);
  writeDb(db);

  logAudit(
    userId || "guest",
    userName || "Guest",
    UserRole.REGISTERED,
    "CREATE_SUPPORT_TICKET",
    newTicket.id,
    "SupportTicket",
    { category, priority, subject }
  );

  res.json({ success: true, ticket: newTicket });
});

// Auth required, and the sender identity/role is always derived from the verified JWT -
// previously this endpoint was fully unauthenticated and trusted senderId/senderName/
// senderRole straight from the body, so anyone could reply to any ticket by guessing its
// id, and could set senderRole: PLATFORM_ADMIN to impersonate support staff.
app.post("/api/support/tickets/:id/reply", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const authReq = req as AuthenticatedRequest;
  const actor = authReq.user;
  if (!actor) return res.status(401).json({ error: "Access token missing or invalid." });

  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];

  const idx = db.supportTickets.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Ticket not found" });

  const ticket = db.supportTickets[idx];
  const isPlatformAdmin = actor.role === UserRole.PLATFORM_ADMIN || actor.role === UserRole.SUPER_ADMIN;
  const isTicketOwner = ticket.userId === actor.id || ticket.userEmail === actor.email;
  if (!isPlatformAdmin && !isTicketOwner) {
    return res.status(403).json({ error: "You do not have permission to reply to this ticket." });
  }

  const reply = {
    id: `reply-${Date.now()}`,
    senderId: actor.id,
    senderName: actor.fullName || "Respondent",
    senderRole: actor.role,
    message: message || "",
    createdDate: new Date().toISOString()
  };

  db.supportTickets[idx].replies.push(reply);

  // Auto switch status
  if (isPlatformAdmin) {
    db.supportTickets[idx].status = "WAITING_FOR_USER";
  } else {
    db.supportTickets[idx].status = "OPEN";
  }

  writeDb(db);
  res.json({ success: true, ticket: db.supportTickets[idx] });
});

app.get("/api/admin/support/tickets", (req, res) => {
  const db = readDb();
  res.json(db.supportTickets || []);
});

app.put("/api/admin/support/tickets/:id", (req, res) => {
  const { id } = req.params;
  const { status, priority } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];

  const idx = db.supportTickets.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Ticket not found" });

  if (status) db.supportTickets[idx].status = status;
  if (priority) db.supportTickets[idx].priority = priority;

  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "UPDATE_SUPPORT_TICKET",
    id,
    "SupportTicket",
    { status, priority }
  );

  res.json({ success: true, ticket: db.supportTickets[idx] });
});

// =============================================================================
// CAREERS, PRESS, & PARTNERSHIP ENDPOINTS
// =============================================================================
app.get("/api/careers", (req, res) => {
  const db = readDb();
  res.json(db.jobListings || []);
});

app.post("/api/admin/careers", (req, res) => {
  const { id, title, titleAr, department, departmentAr, location, locationAr, type, typeAr, description, descriptionAr, requirements, requirementsAr } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.jobListings) db.jobListings = [];

  const targetId = id || `job-${Date.now()}`;
  const idx = db.jobListings.findIndex(j => j.id === targetId);

  const updatedJob: JobListing = {
    id: targetId,
    title: title || "",
    titleAr: titleAr || "",
    department: department || "",
    departmentAr: departmentAr || "",
    location: location || "Doha, Qatar",
    locationAr: locationAr || "الدوحة، قطر",
    type: type || "Full-Time",
    typeAr: typeAr || "دوام كامل",
    description: description || "",
    descriptionAr: descriptionAr || "",
    requirements: requirements || [],
    requirementsAr: requirementsAr || []
  };

  if (idx !== -1) {
    db.jobListings[idx] = updatedJob;
  } else {
    db.jobListings.push(updatedJob);
  }

  writeDb(db);
  logAudit(
    actor.id,
    actor.name,
    actor.role,
    idx !== -1 ? "UPDATE_JOB" : "CREATE_JOB",
    targetId,
    "JobListing",
    { title }
  );

  res.json({ success: true, job: updatedJob });
});

// Public: submit a job application (no auth - applicants aren't platform users)
app.post("/api/careers/apply", publicWriteRateLimiter, (req, res) => {
  const { jobId, applicantName, applicantEmail, applicantPhone, coverLetter, cvUrl } = req.body;
  if (!jobId || !applicantName || !applicantEmail || !applicantPhone) {
    return res.status(400).json({ error: "jobId, applicantName, applicantEmail, and applicantPhone are required." });
  }

  const db = readDb();
  if (!db.jobListings) db.jobListings = [];
  const job = db.jobListings.find(j => j.id === jobId);
  if (!job) return res.status(404).json({ error: "Job listing not found." });

  if (!db.jobApplications) db.jobApplications = [];
  const application: JobApplication = {
    id: `jobapp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    jobId,
    applicantName,
    applicantEmail,
    applicantPhone,
    cvUrl,
    coverLetter,
    status: "PENDING",
    createdDate: new Date().toISOString()
  };
  db.jobApplications.push(application);
  writeDb(db);

  logAudit(application.id, applicantName, UserRole.VISITOR, "SUBMIT_JOB_APPLICATION", jobId, "JobApplication", { applicantEmail, jobTitle: job.title });

  const notifyHtml = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">New Job Application</h2>
    <p><strong>Position:</strong> ${job.title}</p>
    <p><strong>Applicant:</strong> ${applicantName} (${applicantEmail}, ${applicantPhone})</p>
    ${coverLetter ? `<p><strong>Cover Letter:</strong></p><p>${coverLetter}</p>` : ""}
  </div>`;
  sendMockEmail("careers@nerou.io", `[Nerou Finder] New Application: ${job.title}`, notifyHtml, "job_application");

  res.json({ success: true, application });
});

app.get("/api/press", (req, res) => {
  const db = readDb();
  res.json(db.pressReleases || []);
});

app.post("/api/admin/press", (req, res) => {
  const { id, title, titleAr, date, summary, summaryAr, content, contentAr } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.pressReleases) db.pressReleases = [];

  const targetId = id || `press-${Date.now()}`;
  const idx = db.pressReleases.findIndex(p => p.id === targetId);

  const updatedPress: PressRelease = {
    id: targetId,
    title: title || "",
    titleAr: titleAr || "",
    date: date || new Date().toISOString().split("T")[0],
    summary: summary || "",
    summaryAr: summaryAr || "",
    content: content || "",
    contentAr: contentAr || ""
  };

  if (idx !== -1) {
    db.pressReleases[idx] = updatedPress;
  } else {
    db.pressReleases.push(updatedPress);
  }

  writeDb(db);
  logAudit(
    actor.id,
    actor.name,
    actor.role,
    idx !== -1 ? "UPDATE_PRESS" : "CREATE_PRESS",
    targetId,
    "PressRelease",
    { title }
  );

  res.json({ success: true, press: updatedPress });
});

app.get("/api/admin/partnerships", (req, res) => {
  const db = readDb();
  res.json(db.partnershipRequests || []);
});

app.post("/api/partnerships", publicWriteRateLimiter, (req, res) => {
  const { companyName, contactName, email, phone, type, message } = req.body;
  const db = readDb();
  if (!db.partnershipRequests) db.partnershipRequests = [];

  const newReq: PartnershipRequest = {
    id: `partner-${Date.now()}`,
    companyName: companyName || "",
    contactName: contactName || "",
    email: email || "",
    phone: phone || "",
    type: type || "OTHER",
    message: message || "",
    status: "NEW",
    createdDate: new Date().toISOString()
  };

  db.partnershipRequests.push(newReq);
  writeDb(db);

  res.json({ success: true, partnershipRequest: newReq });
});

app.put("/api/admin/partnerships/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const actor = getAuditActor(req);
  const db = readDb();
  if (!db.partnershipRequests) db.partnershipRequests = [];

  const idx = db.partnershipRequests.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Partnership request not found" });

  db.partnershipRequests[idx].status = status;
  writeDb(db);

  logAudit(
    actor.id,
    actor.name,
    actor.role,
    "UPDATE_PARTNERSHIP",
    id,
    "PartnershipRequest",
    { status }
  );

  res.json({ success: true, partnershipRequest: db.partnershipRequests[idx] });
});

// -----------------------------------------------------------------------------
// SAVED PROPERTIES ENDPOINTS (FIX 1)
// -----------------------------------------------------------------------------
app.post("/api/saved-properties", authMiddleware, async (req, res) => {
  const { propertyId } = req.body;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId || !propertyId) {
    return res.status(400).json({ error: "Missing userId or propertyId" });
  }

  try {
    const existing = await prisma.savedProperty.findFirst({
      where: { userId, propertyId }
    });

    if (existing) {
      return res.json({ success: true, savedProperty: existing, message: "Already saved" });
    }

    const saved = await prisma.savedProperty.create({
      data: {
        id: `sp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId,
        propertyId,
        createdDate: new Date().toISOString()
      }
    });

    res.json({ success: true, savedProperty: saved });
  } catch (err) {
    console.error("Error saving property:", err);
    res.status(500).json({ error: "Failed to save property" });
  }
});

app.delete("/api/saved-properties/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  try {
    const record = await prisma.savedProperty.findFirst({
      where: { id, userId }
    });

    if (!record) {
      return res.status(404).json({ error: "Saved property record not found or unauthorized" });
    }

    await prisma.savedProperty.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting saved property:", err);
    res.status(500).json({ error: "Failed to delete saved property" });
  }
});

// Custom endpoint to toggle/delete by propertyId directly
app.delete("/api/saved-properties/property/:propertyId", authMiddleware, async (req, res) => {
  const { propertyId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  try {
    const record = await prisma.savedProperty.findFirst({
      where: { propertyId, userId }
    });

    if (!record) {
      return res.status(404).json({ error: "Saved property record not found" });
    }

    await prisma.savedProperty.delete({
      where: { id: record.id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting saved property:", err);
    res.status(500).json({ error: "Failed to delete saved property" });
  }
});

app.get("/api/saved-properties", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(400).json({ error: "User unauthorized" });
  }

  try {
    const list = await prisma.savedProperty.findMany({
      where: { userId }
    });
    res.json(list);
  } catch (err) {
    console.error("Error listing saved properties:", err);
    res.status(500).json({ error: "Failed to list saved properties" });
  }
});

// -----------------------------------------------------------------------------
// SAVED SEARCHES & ALERTS ENDPOINTS (FIX 2)
// -----------------------------------------------------------------------------
app.post("/api/saved-searches", authMiddleware, async (req, res) => {
  const { name, filters } = req.body;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId || !filters) {
    return res.status(400).json({ error: "Missing filters" });
  }

  try {
    const filterObj = typeof filters === "string" ? JSON.parse(filters) : filters;
    filterObj.customName = name || "Saved Search";
    const filtersStr = JSON.stringify(filterObj);

    const saved = await prisma.savedSearch.create({
      data: {
        id: `ss-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId,
        filters: filtersStr,
        createdDate: new Date().toISOString(),
        lastNotifiedDate: new Date().toISOString(),
        newMatchesCount: 0
      }
    });

    const returnedSearch = {
      ...saved,
      name: name || "Saved Search"
    };

    res.json({ success: true, savedSearch: returnedSearch });
  } catch (err) {
    console.error("Error creating saved search:", err);
    res.status(500).json({ error: "Failed to create saved search" });
  }
});

app.get("/api/saved-searches", authMiddleware, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  if (!userId) {
    return res.status(400).json({ error: "User unauthorized" });
  }

  try {
    const list = await prisma.savedSearch.findMany({
      where: { userId }
    });

    const result = list.map((item: any) => {
      let parsedFilters: any = {};
      try {
        parsedFilters = JSON.parse(item.filters);
      } catch (e) {}
      return {
        ...item,
        name: parsedFilters.customName || "Saved Search"
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error listing saved searches:", err);
    res.status(500).json({ error: "Failed to list saved searches" });
  }
});

app.delete("/api/saved-searches/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  try {
    const record = await prisma.savedSearch.findFirst({
      where: { id, userId }
    });

    if (!record) {
      return res.status(404).json({ error: "Saved search not found or unauthorized" });
    }

    await prisma.savedSearch.delete({
      where: { id }
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting saved search:", err);
    res.status(500).json({ error: "Failed to delete saved search" });
  }
});

app.post("/api/saved-searches/:id/reset", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id;

  try {
    const record = await prisma.savedSearch.findFirst({
      where: { id, userId }
    });

    if (!record) {
      return res.status(404).json({ error: "Saved search not found or unauthorized" });
    }

    const updated = await prisma.savedSearch.update({
      where: { id },
      data: { newMatchesCount: 0 }
    });

    res.json({ success: true, savedSearch: updated });
  } catch (err) {
    console.error("Error resetting match counter:", err);
    res.status(500).json({ error: "Failed to reset counter" });
  }
});

// -----------------------------------------------------------------------------
// MEDIA MULTI-UPLOAD ENDPOINT (FIX 3)
// -----------------------------------------------------------------------------
async function applyWatermark(inputPath: string, outputPath: string) {
  try {
    const db = readDb();
    const cfg = (db.aiConfig || {}) as any;
    const text = cfg.watermarkText || "Nerou Finder";
    const logoType = cfg.watermarkLogoType || "gold_diamond";

    // Load original image metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const width = metadata.width || 1200;
    const height = metadata.height || 800;

    // Scale watermark proportion to image size (e.g. baseline 1200px width)
    const scaleFactor = Math.max(0.5, Math.min(1.5, width / 1200));
    const wmWidth = Math.round(220 * scaleFactor);
    const wmHeight = Math.round(60 * scaleFactor);

    // Positions: bottom-right corner
    const marginRight = Math.round(30 * scaleFactor);
    const marginBottom = Math.round(30 * scaleFactor);

    // Dynamic brand logo select
    let logoSvg = "";
    if (logoType === "gold_diamond") {
      logoSvg = `
        <path d="M 0,12 L 12,0 L 24,12 L 12,24 Z" fill="#bf9b30" />
        <path d="M 3.5,12 L 12,3.5 L 20.5,12 L 12,20.5 Z" fill="none" stroke="#1a1918" stroke-width="1.5" />
        <circle cx="12" cy="12" r="3" fill="#bf9b30" />
      `;
    } else if (logoType === "simple_circle") {
      logoSvg = `
        <circle cx="12" cy="12" r="10" fill="none" stroke="#bf9b30" stroke-width="2" />
        <circle cx="12" cy="12" r="5" fill="#bf9b30" />
      `;
    } else if (logoType === "minimal_line") {
      logoSvg = `
        <line x1="0" y1="4" x2="24" y2="4" stroke="#bf9b30" stroke-width="3" />
        <line x1="4" y1="12" x2="20" y2="12" stroke="#bf9b30" stroke-width="2" />
        <line x1="8" y1="20" x2="16" y2="20" stroke="#bf9b30" stroke-width="1" />
      `;
    }

    const svgWidth = wmWidth + 40;
    const svgHeight = wmHeight;

    const fontSizeTitle = Math.round(14 * scaleFactor);
    const fontSizeSub = Math.round(9 * scaleFactor);
    const textX = logoSvg ? Math.round(32 * scaleFactor) : 0;
    const textYTitle = Math.round(16 * scaleFactor);
    const textYSub = Math.round(28 * scaleFactor);

    const svgString = `
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <g opacity="0.8">
          <!-- Translucent background box for high legibility on any dark or light photo -->
          <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" rx="6" fill="#1a1918" opacity="0.45" />
          <g transform="translate(${Math.round(8 * scaleFactor)}, ${Math.round(8 * scaleFactor)})">
            ${logoSvg ? `<g transform="scale(${scaleFactor})">${logoSvg}</g>` : ""}
            <text x="${textX}" y="${textYTitle}" font-family="'Playfair Display', Georgia, serif" font-size="${fontSizeTitle}" font-weight="bold" fill="#bf9b30">${text}</text>
            <text x="${textX}" y="${textYSub}" font-family="sans-serif" font-size="${fontSizeSub}" font-weight="500" fill="#a8a4a0" letter-spacing="0.5">neroufinder.qa</text>
          </g>
        </g>
      </svg>
    `;

    // Composite SVG watermark in bottom-right corner
    const left = width - svgWidth - marginRight;
    const top = height - svgHeight - marginBottom;

    await image
      .composite([{
        input: Buffer.from(svgString),
        top: Math.max(0, top),
        left: Math.max(0, left),
      }])
      .toFile(outputPath);

    console.log(`Watermark applied successfully! Saved to: ${outputPath}`);
  } catch (err) {
    console.error("Error applying watermark with sharp:", err);
    // Fallback: copy input to output on failure
    try {
      if (inputPath !== outputPath) {
        fs.copyFileSync(inputPath, outputPath);
      }
    } catch (copyErr) {
      console.error("Fallback file copy failed:", copyErr);
    }
  }
}

app.post("/api/media/upload", authMiddleware, uploadRateLimiter, (req, res, next) => {
  upload.array("files")(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || "File upload failed." });
    }
    next();
  });
}, async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  // Content-sniff every file against its declared mimetype before doing anything else with
  // it - reject (and clean up) the whole batch if any file's real bytes don't match what it
  // claimed to be, rather than trusting the client-supplied Content-Type header alone.
  for (const file of files) {
    const head = Buffer.alloc(12);
    const fd = fs.openSync(path.join(uploadsDir, file.filename), "r");
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    if (!fileMatchesDeclaredType(head, file.mimetype)) {
      for (const f of files) {
        try { fs.unlinkSync(path.join(uploadsDir, f.filename)); } catch {}
      }
      return res.status(400).json({ error: "One or more files do not match their declared file type." });
    }
  }

  // Profile/org avatar & logo uploads should never carry the visible property-photo
  // watermark. Callers opt out via ?type=avatar (query) or an "uploadType=avatar" form
  // field - default (no param) keeps the existing watermark-every-upload behavior so
  // every other caller of this shared endpoint is unaffected.
  const uploadType = (req.query.type as string | undefined) || (req.body && (req.body as any).uploadType);
  const skipWatermark = uploadType === "avatar";

  const urls = [];

  for (const file of files) {
    const filename = file.filename;
    const uploadedPath = path.join(uploadsDir, filename);
    const originalPath = path.join(uploadsDir, "original-" + filename);

    if (skipWatermark) {
      // Serve the raw uploaded file as-is - no watermark composite step.
      urls.push(`/assets/uploads/${filename}`);
      continue;
    }

    try {
      // 1. Store the raw/unwatermarked copy as 'original-<filename>'
      fs.copyFileSync(uploadedPath, originalPath);

      // 2. Apply watermark on originalPath and write back to uploadedPath
      await applyWatermark(originalPath, uploadedPath);
    } catch (err) {
      console.error("Failed to copy or watermark image file:", err);
    }

    urls.push(`/assets/uploads/${filename}`);
  }

  res.json({ urls, fileUrls: urls });
});

// =============================================================================
// GDPR & QATAR LAW NO.13 PRIVACY & DATA PORTABILITY COMPLIANCE ENDPOINTS
// =============================================================================
app.post("/api/user/delete-account", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const isAdmin = authReq.user?.role === UserRole.PLATFORM_ADMIN || authReq.user?.role === UserRole.SUPER_ADMIN;
  const requestedUserId = req.body.userId;
  // Users may only scrub their own account; only a platform admin may act on someone else's behalf
  const userId = isAdmin && requestedUserId ? requestedUserId : authReq.user?.id;
  if (!userId) return res.status(400).json({ error: "User ID is required" });
  if (!isAdmin && requestedUserId && requestedUserId !== authReq.user?.id) {
    return res.status(403).json({ error: "You may only delete your own account." });
  }

  const db = readDb();
  
  // Find User
  const userIdx = db.users.findIndex(u => u.id === userId);
  if (userIdx === -1) return res.status(404).json({ error: "User not found" });

  const userEmail = db.users[userIdx].email;

  // 1. Permanently remove personal identification details of the user (scrubbing)
  db.users[userIdx].fullName = "Scrubbed Account (Deleted)";
  db.users[userIdx].phone = "00000000";
  if (db.users[userIdx].bio) db.users[userIdx].bio = "Personal details permanently deleted per Qatar Law No. 13 of 2016";
  db.users[userIdx].avatarUrl = "";
  db.users[userIdx].verificationStatus = VerificationStatus.REJECTED;

  // 2. Suspend all active listings associated with this user
  let propertiesSuspended = 0;
  db.properties.forEach(p => {
    if (p.agentId === userId) {
      p.listingStatus = ListingStatus.SUSPENDED;
      propertiesSuspended++;
    }
  });

  writeDb(db);

  // 3. Log into Audit Trail - actor is always the authenticated caller (which may be an
  // admin acting on someone else's behalf), never client-supplied, so the trail always
  // shows who actually performed the deletion, not just who was deleted.
  logAudit(
    authReq.user?.id || "unknown",
    authReq.user?.fullName || "Self",
    (authReq.user?.role as UserRole) || UserRole.REGISTERED,
    "PERMANENT_ACCOUNT_DELETION_SCRUB",
    userId,
    "User",
    { userEmail, propertiesSuspended, timestamp: new Date().toISOString() }
  );

  res.json({
    success: true,
    message: "Your profile has been fully scrubbed and personal data permanently expunged, in full compliance with Qatar's Personal Data Privacy Law (No. 13 of 2016). All your active listings have been suspended."
  });
});

app.get("/api/user/export-data", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const isAdmin = authReq.user?.role === UserRole.PLATFORM_ADMIN || authReq.user?.role === UserRole.SUPER_ADMIN;
  const requestedUserId = req.query.userId as string | undefined;
  // Users may only export their own data; only a platform admin may act on someone else's behalf
  const userId = isAdmin && requestedUserId ? requestedUserId : authReq.user?.id;
  if (!userId) return res.status(400).json({ error: "User ID is required" });
  if (!isAdmin && requestedUserId && requestedUserId !== authReq.user?.id) {
    return res.status(403).json({ error: "You may only export your own data." });
  }

  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Gather all data associated with this user
  const userProperties = db.properties.filter(p => p.agentId === userId);
  const userLeads = db.leads.filter(l => l.agentId === userId);
  const userTickets = (db.supportTickets || []).filter(t => t.userId === userId);
  const auditActions = db.auditLogs.filter(a => a.actorId === userId);

  // Build the data portability envelope
  const exportPayload = {
    exportDate: new Date().toISOString(),
    regulatoryFramework: "Qatar Law No. 13 of 2016 on Protecting Personal Data Privacy",
    dataSubject: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      whatsapp: user.whatsapp || "Not Provided",
      role: user.role,
      specialties: user.specialties || [],
      languages: user.languages || [],
      verificationStatus: user.verificationStatus,
      createdDate: user.createdDate
    },
    organization: db.organizations.find(o => o.id === user.orgId) || null,
    properties: userProperties.map(p => ({
      id: p.id,
      listingId: p.listingId,
      title: p.title,
      price: p.price,
      city: p.city,
      district: p.district,
      listingStatus: p.listingStatus,
      createdDate: p.createdDate
    })),
    leads: userLeads.map(l => ({
      id: l.id,
      visitorName: l.visitorName,
      message: l.message,
      contactMethod: l.contactMethod,
      status: l.status,
      createdDate: l.createdDate
    })),
    supportTickets: userTickets,
    recentAuditLogs: auditActions
  };

  res.setHeader("Content-Disposition", `attachment; filename=nerou-data-export-${userId}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(exportPayload, null, 2));
});

// -----------------------------------------------------------------------------
// SEO INFRASTRUCTURE (robots.txt & dynamic sitemap.xml)
// -----------------------------------------------------------------------------
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *
Allow: /
Allow: /properties/
Allow: /help-center
Allow: /careers
Allow: /press
Allow: /plans-pricing
Disallow: /api/
Disallow: /admin/
Disallow: /control-center/
Disallow: /workspace/

Sitemap: ${req.protocol}://${req.get("host")}/sitemap.xml
`);
});

app.get("/sitemap.xml", (req, res) => {
  const db = readDb();
  const host = `${req.protocol}://${req.get("host")}`;
  const now = new Date().toISOString().split("T")[0];
  
  // Static pages
  const staticPaths = [
    "",
    "/help-center",
    "/careers",
    "/press",
    "/plans-pricing"
  ];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  // Add static URLs
  staticPaths.forEach(path => {
    xml += `
  <url>
    <loc>${host}${path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${path === "" ? "1.0" : "0.8"}</priority>
  </url>`;
  });

  // Add published properties
  const publishedProperties = db.properties.filter(
    p => (p.listingStatus as any) === "APPROVED" || p.listingStatus === "PUBLISHED" || (p.listingStatus as any) === "ACTIVE"
  );
  
  publishedProperties.forEach(prop => {
    xml += `
  <url>
    <loc>${host}/properties/${prop.id}</loc>
    <lastmod>${prop.updatedDate ? prop.updatedDate.split("T")[0] : now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
  });

  xml += `
</urlset>`;

  res.type("application/xml");
  res.send(xml);
});

// -----------------------------------------------------------------------------
// TRUST & ENGAGEMENT: REVIEWS AND RATINGS API
// -----------------------------------------------------------------------------
// GET /api/reviews - public approved reviews
app.get("/api/reviews", (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    return res.status(400).json({ error: "targetType and targetId are required." });
  }
  const db = readDb();
  if (!db.reviews) db.reviews = [];
  
  const filtered = db.reviews
    .filter(r => r.targetType === targetType && r.targetId === targetId && r.status === "APPROVED")
    .map(r => {
      const reviewer = db.users.find(u => u.id === r.reviewerId);
      const name = reviewer ? (reviewer as any).fullName || reviewer.email : "Verified User";
      return {
        ...r,
        reviewerName: name
      };
    });
    
  res.json(filtered);
});

// POST /api/reviews - submit review, requires auth
app.post("/api/reviews", authMiddleware, publicWriteRateLimiter, (req, res) => {
  const { targetType, targetId, rating, comment } = req.body;
  const user = (req as any).user;
  
  if (!targetType || !targetId || !rating || !comment) {
    return res.status(400).json({ error: "All fields (targetType, targetId, rating, comment) are required." });
  }
  
  const score = Number(rating);
  if (isNaN(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
  }
  
  const db = readDb();
  if (!db.reviews) db.reviews = [];
  if (!db.leads) db.leads = [];
  
  // Eligibility check: does a Lead record exist between this user's email and the target?
  const hasInquiry = db.leads.some(l => {
    const isUserEmail = l.visitorEmail?.toLowerCase() === user.email?.toLowerCase();
    const matchesTarget = targetType === "AGENT" ? (l.agentId === targetId) : (l.orgId === targetId);
    return isUserEmail && matchesTarget;
  });
  
  if (!hasInquiry) {
    return res.status(403).json({
      error: "Eligibility Check Failed: You can only review an agent or agency that you have actively submitted a Lead or Viewing request to."
    });
  }

  // Duplicate prevention: one review per reviewer per target (regardless of its current
  // moderation status - resubmitting after a REJECTED or while a PENDING is outstanding
  // is not allowed; use the admin edit/delete flow instead).
  const alreadyReviewed = db.reviews.some(
    r => r.reviewerId === user.id && r.targetType === targetType && r.targetId === targetId
  );
  if (alreadyReviewed) {
    return res.status(400).json({
      error: "You have already submitted a review for this profile."
    });
  }

  const id = `review-${Date.now()}`;
  const newReview = {
    id,
    reviewerId: user.id,
    targetType,
    targetId,
    rating: score,
    comment,
    createdDate: new Date().toISOString(),
    status: "PENDING" as "PENDING" | "APPROVED" | "REJECTED"
  };
  
  db.reviews.unshift(newReview);
  writeDb(db);

  // FIX 9/10: notify the reviewed agent/agency of the new review immediately (not just on
  // eventual admin approval).
  const targetContact = targetType === "AGENT"
    ? db.users.find(u => u.id === targetId)
    : db.organizations.find(o => o.id === targetId);
  if (targetContact?.email) {
    sendMockEmail(
      targetContact.email,
      "[Nerou Finder] You Received a New Review",
      generateNotificationEmailHtml(
        "New Review Received",
        (targetContact as any).fullName || (targetContact as any).name,
        `<p>You received a new ${score}-star review: "${comment}". It's pending admin moderation before it appears publicly.</p>`
      ),
      "new_review"
    );
  }

  res.status(201).json({ success: true, message: "Review submitted for admin moderation.", review: newReview });
});

// FIX 10: aggregated rating summary (average, count, star distribution) for an agent/agency
// or a property - computed server-side once so every surface (public profile, agent
// dashboard reviews tab, admin moderation) shows the exact same numbers.
app.get("/api/reviews/summary", (req, res) => {
  const { targetType, targetId } = req.query;
  if (!targetType || !targetId) {
    return res.status(400).json({ error: "targetType and targetId are required." });
  }
  const db = readDb();
  if (!db.reviews) db.reviews = [];

  const approved = db.reviews.filter(r => r.targetType === targetType && r.targetId === targetId && r.status === "APPROVED");
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of approved) {
    const bucket = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket]++;
  }
  const average = approved.length > 0 ? approved.reduce((sum, r) => sum + r.rating, 0) / approved.length : 0;

  res.json({ average: Math.round(average * 10) / 10, count: approved.length, distribution });
});

// FIX 10: agent/agency replies publicly to a review they received.
app.patch("/api/reviews/:id/reply", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) return res.status(400).json({ error: "text is required." });

  const db = readDb();
  if (!db.reviews) db.reviews = [];
  const review = db.reviews.find(r => r.id === id);
  if (!review) return res.status(404).json({ error: "Review not found." });

  const authReq = req as AuthenticatedRequest;
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });

  const isTargetAgent = review.targetType === "AGENT" && review.targetId === actor.id;
  const isTargetAgencyAdmin = review.targetType === "AGENCY" && review.targetId === actor.orgId &&
    (actor.role === UserRole.AGENCY_ADMIN || actor.role === UserRole.DEVELOPER_ADMIN);
  if (!isTargetAgent && !isTargetAgencyAdmin) {
    return res.status(403).json({ error: "You may only reply to reviews about you or your agency." });
  }

  review.reply = { text: text.trim(), createdDate: new Date().toISOString() };
  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "REPLY_TO_REVIEW", id, "Review", { text: review.reply.text });

  // FIX 9/10: notify the original reviewer that the agent/agency replied.
  const reviewer = db.users.find(u => u.id === review.reviewerId);
  if (reviewer?.email) {
    sendMockEmail(
      reviewer.email,
      "[Nerou Finder] You Received a Reply to Your Review",
      generateNotificationEmailHtml(
        "Reply to Your Review",
        reviewer.fullName,
        `<p>${actor.fullName} replied to your review: "${review.reply.text}"</p>`
      ),
      "review_reply"
    );
  }

  res.json({ success: true, review });
});

// FIX 10: report a review as abusive/policy-violating - surfaces in the admin moderation
// queue's "reported" filter without auto-hiding it (admin still decides).
app.post("/api/reviews/:id/report", authMiddleware, (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db.reviews) db.reviews = [];
  const review = db.reviews.find(r => r.id === id);
  if (!review) return res.status(404).json({ error: "Review not found." });

  review.reportCount = (review.reportCount || 0) + 1;
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(authReq.user?.id || "unknown", authReq.user?.fullName || "User", (authReq.user?.role as UserRole) || UserRole.REGISTERED, "REPORT_REVIEW", id, "Review", {});

  res.json({ success: true, review });
});

// Admin Review Moderation endpoints
app.get("/api/admin/reviews", authMiddleware, requireRole([UserRole.PLATFORM_ADMIN]), (req, res) => {
  const db = readDb();
  if (!db.reviews) db.reviews = [];
  
  const reviewsWithNames = db.reviews.map(r => {
    const reviewer = db.users.find(u => u.id === r.reviewerId);
    const name = reviewer ? (reviewer as any).fullName || reviewer.email : "Unknown User";
    return {
      ...r,
      reviewerName: name
    };
  });
  
  res.json(reviewsWithNames);
});

app.put("/api/admin/reviews/:id", authMiddleware, requireRole([UserRole.PLATFORM_ADMIN]), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be APPROVED or REJECTED." });
  }
  
  const db = readDb();
  if (!db.reviews) db.reviews = [];
  
  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }
  
  db.reviews[idx].status = status;
  writeDb(db);

  res.json({ success: true, review: db.reviews[idx] });
});

app.delete("/api/admin/reviews/:id", authMiddleware, requireRole([UserRole.PLATFORM_ADMIN]), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db.reviews) db.reviews = [];

  const idx = db.reviews.findIndex(r => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "Review not found." });
  }

  const [removed] = db.reviews.splice(idx, 1);
  writeDb(db);

  const authReq = req as AuthenticatedRequest;
  logAudit(
    authReq.user?.id || "unknown",
    authReq.user?.fullName || "Admin",
    (authReq.user?.role as UserRole) || UserRole.PLATFORM_ADMIN,
    "DELETE_REVIEW",
    id,
    "Review",
    { targetId: removed.targetId, targetType: removed.targetType }
  );

  res.json({ success: true });
});

// -----------------------------------------------------------------------------
// ERROR LOGGING & MONITORING INFRASTRUCTURE
// -----------------------------------------------------------------------------

// Helper for structured JSON logging of unhandled errors
function logStructuredError(route: string, error: any, req?: any) {
  const logData = {
    severity: "ERROR",
    timestamp: new Date().toISOString(),
    message: error?.message || String(error),
    stack: error?.stack,
    route,
    method: req?.method,
    headers: req ? {
      "user-agent": req.headers["user-agent"],
      "host": req.headers["host"],
    } : undefined,
    query: req?.query,
    body: req?.body ? { ...req.body, password: req.body.password ? "***" : undefined } : undefined
  };
  console.error(JSON.stringify(logData));
}

// Global process exception handlers
process.on("unhandledRejection", (reason: any) => {
  const logData = {
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    message: `Unhandled Rejection: ${reason?.message || String(reason)}`,
    stack: reason?.stack,
  };
  console.error(JSON.stringify(logData));
});

process.on("uncaughtException", (error: Error) => {
  const logData = {
    severity: "CRITICAL",
    timestamp: new Date().toISOString(),
    message: `Uncaught Exception: ${error.message}`,
    stack: error.stack,
  };
  console.error(JSON.stringify(logData));
});

// Admin-only JSON export of database
app.get("/api/admin/export", (req, res, next) => {
  try {
    const db = readDb();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=nerou_database_export.json");
    res.json(db);
  } catch (error) {
    next(error);
  }
});

// Express Error Handling Middleware (must be after routes but before static files)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logStructuredError(req.originalUrl || req.path, err, req);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred." : err.message
  });
});

// -----------------------------------------------------------------------------
// VITE OR STATIC FILE MIDDLEWARE
// -----------------------------------------------------------------------------
async function startServer() {
  try {
    await initDb();
    console.log("PostgreSQL database initialized successfully.");
  } catch (err) {
    // Postgres is the sole source of truth now (no more data.json fallback store), so a
    // failed init means the app has nowhere to read or persist real data - starting anyway
    // would silently serve/collect data that goes nowhere. Fail the boot instead.
    console.error("FATAL: Failed to initialize the database on startup. Refusing to start.", err);
    process.exit(1);
  }

  // Verification document expiry sweep: flags EXPIRED docs and sends 30/7-day reminder emails.
  checkDocumentExpiryAndReminders();
  setInterval(checkDocumentExpiryAndReminders, 24 * 60 * 60 * 1000);

  // Listing availability staleness sweep: 14-day "please confirm" reminder emails and 30-day
  // auto-pause. Same interval/pattern as the verification document expiry sweep above.
  checkPropertyStalenessAndReminders();
  setInterval(checkPropertyStalenessAndReminders, 24 * 60 * 60 * 1000);

  // Dynamic SEO meta tags for properties
  app.get("/properties/:id", (req, res, next) => {
    const { id } = req.params;
    const db = readDb();
    const property = db.properties.find(p => p.id === id);
    if (!property) {
      return next();
    }

    let indexPath = path.join(process.cwd(), "dist", "index.html");
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), "index.html");
    }

    if (fs.existsSync(indexPath)) {
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        const title = `${property.title} | Nerou Finder`;
        const desc = property.description || "Discover exclusive luxury real estate in Doha.";
        const coverImage = property.images && property.images.length > 0
          ? property.images[0]
          : "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=1200&h=630&q=80";

        const host = req.get("host") || "nerou.io";
        const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
        const absoluteCoverImage = coverImage.startsWith("http")
          ? coverImage
          : `${protocol}://${host}${coverImage}`;

        html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
        html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/g, `<meta property="og:title" content="${title}" />`);
        html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/g, `<meta property="og:description" content="${desc}" />`);
        html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/g, `<meta property="og:image" content="${absoluteCoverImage}" />`);
        html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/g, `<meta name="twitter:title" content="${title}" />`);
        html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/g, `<meta name="twitter:description" content="${desc}" />`);
        html = html.replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/g, `<meta name="twitter:image" content="${absoluteCoverImage}" />`);

        return res.send(html);
      } catch (err) {
        console.error("SEO dynamic meta hydration failed:", err);
      }
    }
    next();
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files with production cache control headers
    app.use(express.static(distPath, {
      maxAge: "1y",
      etag: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|woff|woff2)$/)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // On a redeploy/restart (e.g. Render sends SIGTERM), stop accepting new connections and
  // wait for any already-queued database writes to finish before exiting, so a request that
  // already got a 200 response never silently loses its write.
  const shutdown = (signal: string) => {
    console.log(`${signal} received: draining pending writes before shutdown...`);
    server.close(() => {
      flushPendingWrites()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
    // Safety net in case something hangs indefinitely.
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
