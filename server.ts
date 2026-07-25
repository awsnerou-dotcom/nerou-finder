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
import { readDb, writeDb, DatabaseState, initDb, prisma } from "./server-db.js";
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
  DEFAULT_BOOST_CAP_FALLBACK
} from "./src/types.js";
import { rateLimit } from "express-rate-limit";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

const JWT_SECRET = process.env.JWT_SECRET || "nerou-secret-key-12345";

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


// Mock Outbound SMTP Email Emulator and Storage Queue
const EMAILS_FILE = path.join(process.cwd(), "emails.json");

export function generateInquiryEmailHtml(leadName: string, leadPhone: string, leadEmail: string, propTitle: string, propPrice: number, propId: string) {
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

const upload = multer({ storage });

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

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// System Health Check
app.get("/api/health", (req, res) => {
  const db = readDb();
  db.systemHealth.lastCheck = new Date().toISOString();
  writeDb(db);
  res.json({
    status: "ok",
    systemHealth: db.systemHealth
  });
});

app.use("/api/admin", authMiddleware, requireRole([UserRole.PLATFORM_ADMIN]));

// Update System Health Indicator (Platform Admin action)
app.post("/api/admin/health/update", (req, res) => {
  const { api, database, ai, payment, whatsapp, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  if (api) db.systemHealth.api = api;
  if (database) db.systemHealth.database = database;
  if (ai) db.systemHealth.ai = ai;
  if (payment) db.systemHealth.payment = payment;
  if (whatsapp) db.systemHealth.whatsapp = whatsapp;
  db.systemHealth.lastCheck = new Date().toISOString();
  writeDb(db);
  
  logAudit(
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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

  res.json({ user, token });
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

  res.json({ user, token });
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
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === authUser.id);
  if (idx === -1) {
    return res.status(404).json({ error: "User not found." });
  }

  (db.users[idx] as any).twoFactorEnabled = false;
  (db.users[idx] as any).twoFactorSecret = undefined;
  writeDb(db);

  res.json({ success: true, message: "Two-Factor Authentication successfully disabled." });
});

// Real Signup
app.post("/api/auth/signup", authRateLimiter, (req, res) => {
  const { email, password, fullName, phone, role, orgName, orgType, selectedPlanId } = req.body;
  const db = readDb();

  // Check if user already exists
  const exists = db.users.find(u => u.email === email);
  if (exists) {
    return res.status(400).json({ error: "An account with this email already exists." });
  }

  let orgId: string | undefined = undefined;
  
  // If role is AGENCY_ADMIN or DEVELOPER_ADMIN, create organization
  if (role === UserRole.AGENCY_ADMIN || role === UserRole.DEVELOPER_ADMIN) {
    orgId = `org-${Date.now()}`;
    const targetPlanId = selectedPlanId || (orgType === "DEVELOPER" ? "plan-developer" : "plan-basic");
    const matchedPlan = db.subscriptionPlans.find(p => p.id === targetPlanId) || db.subscriptionPlans[0];

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
  } else if (role === UserRole.AGENT) {
    // Default link to org-agency-1 for demo purposes if they register as individual agent, or they can stand alone
    orgId = "org-agency-1";
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
    role: role || UserRole.AGENT,
    orgId,
    avatarUrl: `https://images.unsplash.com/photo-${role === UserRole.AGENT ? "1560250097-0b93528c311a" : "1472099645785-5658abf4ff4e"}?auto=format&fit=crop&w=200&h=200&q=80`,
    bio: role === UserRole.AGENT ? "Professional real estate specialist." : "Administrator account.",
    languages: ["English", "Arabic"],
    specialties: ["Pearl Qatar", "West Bay"],
    verificationStatus: VerificationStatus.APPROVED,
    createdDate: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);

  logAudit(userId, fullName, role, "USER_SIGNUP", userId, "User", { email });

  // Issue JWT Token
  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role, fullName: newUser.fullName },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ user: newUser, token });
});


// GET dynamic Locations from database
app.get("/api/locations", (req, res) => {
  const db = readDb();
  res.json(db.locations || []);
});

// Admin Manage Locations
app.post("/api/admin/locations", (req, res) => {
  const { id, name, nameAr, type, parentId, latitude, longitude, seoSlug, isActive, actorId, actorName, actorRole } = req.body;
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
      logAudit(actorId || "admin", actorName || "Admin", actorRole || UserRole.PLATFORM_ADMIN, "EDIT_LOCATION", id, "Location", { name });
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
  logAudit(actorId || "admin", actorName || "Admin", actorRole || UserRole.PLATFORM_ADMIN, "CREATE_LOCATION", newId, "Location", { name });
  res.json({ success: true, location: newLoc });
});

app.get("/api/users", (req, res) => {
  const db = readDb();
  res.json(db.users);
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
  const { fullName, phone, whatsapp, bio, languages, specialties, avatarUrl } = req.body;
  const existing = db.users[idx] as any;
  if (fullName !== undefined) existing.fullName = fullName;
  if (phone !== undefined) existing.phone = phone;
  if (whatsapp !== undefined) existing.whatsapp = whatsapp;
  if (bio !== undefined) existing.bio = bio;
  if (languages !== undefined) existing.languages = languages;
  if (specialties !== undefined) existing.specialties = specialties;
  if (avatarUrl !== undefined) existing.avatarUrl = avatarUrl;

  writeDb(db);

  logAudit(actor.id, actor.fullName, actor.role, "UPDATE_USER_PROFILE", id, "User", { fullName, phone, whatsapp });

  res.json({ success: true, user: db.users[idx] });
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
    searchQuery
  } = req.query;

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

// Create/Update Property (SaaS Agent/Agency Admin/Developer workspace action)
app.post("/api/properties", authMiddleware, (req, res) => {
  const db = readDb();
  const propData = req.body;
  const isEdit = !!propData.id;

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agent";
  const actorRole = authReq.user?.role || UserRole.AGENT;

  let qualityScore = 70; // Base score
  if (propData.description && propData.description.length > 100) qualityScore += 10;
  if (propData.images && propData.images.length >= 3) qualityScore += 10;
  if (propData.amenities && propData.amenities.length >= 4) qualityScore += 10;

  if (isEdit) {
    const idx = db.properties.findIndex(p => p.id === propData.id);
    if (idx === -1) return res.status(404).json({ error: "Property not found" });
    
    const existing = db.properties[idx];
    
    // Track price changes in price history
    const priceHistory = [...existing.priceHistory];
    if (existing.price !== Number(propData.price)) {
      priceHistory.push({ price: Number(propData.price), date: new Date().toISOString().split("T")[0] });
    }

    const updatedProp: Property = {
      ...existing,
      ...propData,
      price: Number(propData.price),
      area: Number(propData.area),
      bedrooms: Number(propData.bedrooms),
      bathrooms: Number(propData.bathrooms),
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
      orgId: propData.orgId || "org-agency-1",
      projectId: propData.projectId,
      verificationStatus: VerificationStatus.PENDING,
      listingStatus: ListingStatus.PENDING_REVIEW,
      qualityScore,
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      priceHistory: [{ price: Number(propData.price), date: new Date().toISOString().split("T")[0] }]
    };

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

    return res.json(newProp);
  }
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
app.post("/api/admin/properties/verify", (req, res) => {
  const { propertyId, status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.properties.findIndex(p => p.id === propertyId);
  if (idx === -1) return res.status(404).json({ error: "Property not found" });

  db.properties[idx].verificationStatus = status;
  if (status === VerificationStatus.APPROVED) {
    db.properties[idx].listingStatus = ListingStatus.PUBLISHED;
    db.properties[idx].lastVerifiedDate = new Date().toISOString();
    checkAndIncrementSavedSearches(db.properties[idx]);
  } else if (status === VerificationStatus.REJECTED) {
    db.properties[idx].listingStatus = ListingStatus.SUSPENDED;
  }


  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    status === VerificationStatus.APPROVED ? "APPROVE_PROPERTY" : "REJECT_PROPERTY",
    propertyId,
    "Property",
    { status }
  );

  res.json({ success: true, property: db.properties[idx] });
});

// Lead Capture (Visitor submits inquiry or triggers Call/WhatsApp event)
app.post("/api/leads", (req, res) => {
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
  writeDb(db);

  // If a viewing request was submitted in the inquiry
  if (req.body.preferredDate && req.body.preferredTimeSlot) {
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

// Retrieve Leads for Agent or Agency Workspace
app.get("/api/leads", (req, res) => {
  const db = readDb();
  const { agentId, orgId } = req.query;
  let leads = db.leads;

  if (agentId) {
    leads = leads.filter(l => l.agentId === agentId);
  }
  if (orgId) {
    leads = leads.filter(l => l.orgId === orgId);
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

  db.leads[idx].status = status;
  db.leads[idx].updatedDate = new Date().toISOString();
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

  res.json({ success: true, lead: db.leads[idx] });
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

  res.json({ success: true, lead: db.leads[leadIdx] });
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
app.get("/api/viewings", (req, res) => {
  const db = readDb();
  const { agentId } = req.query;
  let viewings = db.viewings;
  if (agentId) {
    viewings = viewings.filter(v => v.agentId === agentId);
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

  db.viewings[idx].status = status;
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

// GET all subscription plans
app.get("/api/plans", (req, res) => {
  const db = readDb();
  res.json(db.subscriptionPlans || []);
});

// CREATE or UPDATE subscription plan
app.post("/api/admin/plans", (req, res) => {
  const { id, name, priceMonthly, priceYearly, propertyLimit, agentLimit, aiLimit, analyticsAccess, featuredListingsLimit, actorId, actorName, actorRole } = req.body;
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
      logAudit(actorId || "admin", actorName || "Admin", actorRole || UserRole.PLATFORM_ADMIN, "EDIT_SUBSCRIPTION_PLAN", id, "SubscriptionPlan", { name });
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
  logAudit(actorId || "admin", actorName || "Admin", actorRole || UserRole.PLATFORM_ADMIN, "CREATE_SUBSCRIPTION_PLAN", newId, "SubscriptionPlan", { name });
  res.json({ success: true, plan: newPlan });
});

// MANUALLY OVERRIDE ORGANIZATION SUBSCRIPTION
app.post("/api/admin/organizations/subscription", (req, res) => {
  const { orgId, planId, startDate, expiryDate, status, notes, activationMethod, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.organizations.findIndex(o => o.id === orgId);
  if (idx === -1) return res.status(404).json({ error: "Organization not found" });

  db.organizations[idx].subscriptionPlanId = planId;
  db.organizations[idx].subscriptionExpiry = expiryDate;
  db.organizations[idx].subscriptionStartDate = startDate;
  db.organizations[idx].subscriptionStatus = status;
  db.organizations[idx].subscriptionNotes = notes;
  db.organizations[idx].subscriptionActivationMethod = activationMethod;

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
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
    "MANUAL_MANAGE_SUBSCRIPTION",
    orgId,
    "Organization",
    { planId, status, activationMethod }
  );

  res.json({ success: true, organization: db.organizations[idx] });
});

// Admin verification of Agents/Organizations
app.post("/api/admin/verify-org", (req, res) => {
  const { orgId, status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.organizations.findIndex(o => o.id === orgId);
  if (idx === -1) return res.status(404).json({ error: "Organization not found" });

  db.organizations[idx].verificationStatus = status;
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "VERIFY_ORGANIZATION",
    orgId,
    "Organization",
    { status }
  );

  res.json({ success: true, organization: db.organizations[idx] });
});

app.post("/api/admin/verify-user", (req, res) => {
  const { userId, status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: "User not found" });

  db.users[idx].verificationStatus = status;
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
    "VERIFY_USER",
    userId,
    "User",
    { status }
  );

  res.json({ success: true, user: db.users[idx] });
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
}

function generateDocumentReviewEmailHtml(name: string, documentType: string, status: string, rejectionReason?: string): string {
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
  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #1a1918;">${expired ? "Verification Document Expired" : "Verification Document Expiring Soon"}</h2>
    <p>Dear ${name},</p>
    <p>Your document <strong>${documentType.replace(/_/g, " ")}</strong> ${expired ? "has expired and your account verification has been downgraded until it is renewed." : `will expire in ${daysLeft} day(s).`}</p>
    <p>Please upload a renewed document from your workspace as soon as possible to avoid disruption.</p>
    <p>&mdash; Nerou Finder Compliance Team</p>
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

  writeDb(db);
  logAudit(actor.id, actor.fullName, actor.role, "SUBMIT_VERIFICATION_DOCUMENT", doc.id, "VerificationDocument", { documentType, context });

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
  const { documentId, status, rejectionReason, actorId, actorName, actorRole } = req.body;
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
  doc.reviewedBy = actorId || "admin";

  recomputeAccountVerification(db, doc.context, doc.userId, doc.orgId);
  writeDb(db);

  logAudit(
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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

// Ad Campaigns (Monetization)
app.get("/api/campaigns", (req, res) => {
  const db = readDb();
  res.json(db.campaigns);
});

app.post("/api/campaigns", authMiddleware, (req, res) => {
  const db = readDb();
  const campData = req.body;
  const id = `camp-${Date.now()}`;

  const authReq = req as AuthenticatedRequest;
  const actorId = authReq.user?.id || "unknown";
  const actorName = authReq.user?.fullName || "Agency Admin";
  const actorRole = authReq.user?.role || UserRole.AGENCY_ADMIN;

  const newCampaign: AdCampaign = {
    id,
    orgId: campData.orgId || "org-agency-1",
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


app.post("/api/admin/campaigns/review", (req, res) => {
  const { campaignId, status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) return res.status(404).json({ error: "Campaign not found" });

  db.campaigns[idx].status = status;
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
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

// Self-service: instantly activate a Bump or Featured boost on your own org's listing
app.post("/api/ad-charges", authMiddleware, (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const db = readDb();
  const actor = db.users.find(u => u.id === authReq.user?.id);
  if (!actor) return res.status(404).json({ error: "User not found." });
  if (![UserRole.AGENT, UserRole.AGENCY_ADMIN, UserRole.DEVELOPER_ADMIN].includes(actor.role as UserRole)) {
    return res.status(403).json({ error: "Only agents, agency admins, or developer admins can activate ad boosts." });
  }
  if (!actor.orgId) return res.status(400).json({ error: "No organization associated with this account." });

  const org = db.organizations.find(o => o.id === actor.orgId);
  if (!org) return res.status(404).json({ error: "Organization not found." });
  if (org.subscriptionStatus !== "ACTIVE") {
    return res.status(403).json({ error: "An active subscription is required to activate self-service ad boosts." });
  }

  const { propertyId, type } = req.body as { propertyId: string; type: AdChargeType };
  if (!propertyId || (type !== "BUMP" && type !== "FEATURED")) {
    return res.status(400).json({ error: "propertyId and a valid type (BUMP or FEATURED) are required." });
  }

  const property = db.properties.find(p => p.id === propertyId);
  if (!property || property.orgId !== org.id) {
    return res.status(403).json({ error: "You may only boost listings that belong to your own organization." });
  }

  if (!db.adCharges) db.adCharges = [];
  const currentPeriod = getCurrentBillingPeriod();

  const hasUnsettledPastPeriod = db.adCharges.some(c => c.orgId === org.id && c.billingPeriod !== currentPeriod && !c.settled);
  if (hasUnsettledPastPeriod) {
    return res.status(403).json({ error: "You have an unsettled ad billing period from a previous month. Please contact support to settle it before activating new boosts." });
  }

  const cap = db.aiConfig?.adBoostCaps?.[org.subscriptionPlanId] ?? DEFAULT_BOOST_CAP_FALLBACK;
  const usedThisPeriod = db.adCharges.filter(c => c.orgId === org.id && c.billingPeriod === currentPeriod).length;
  if (usedThisPeriod >= cap) {
    return res.status(403).json({ error: `Monthly self-service boost cap (${cap}) reached for your plan this billing period.` });
  }

  const charge: AdCharge = {
    id: `adc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    orgId: org.id,
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
    if (!actor.orgId) return res.json([]);
    charges = charges.filter(c => c.orgId === actor.orgId);
  }

  res.json(charges);
});

// Admin: mark a billing period as settled for an org (mirrors the existing manual
// subscription-payment-confirmation pattern at /api/admin/organizations/subscription)
app.post("/api/admin/ad-charges/settle", (req, res) => {
  const { orgId, billingPeriod, actorId, actorName, actorRole } = req.body;
  if (!orgId || !billingPeriod) return res.status(400).json({ error: "orgId and billingPeriod are required." });

  const db = readDb();
  if (!db.adCharges) db.adCharges = [];
  const matching = db.adCharges.filter(c => c.orgId === orgId && c.billingPeriod === billingPeriod);
  if (matching.length === 0) return res.status(404).json({ error: "No ad charges found for that organization and billing period." });

  const now = new Date().toISOString();
  matching.forEach(c => {
    c.settled = true;
    c.settledDate = now;
    c.settledBy = actorId || "admin";
  });
  writeDb(db);

  logAudit(
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
    "SETTLE_AD_BILLING_PERIOD",
    orgId,
    "Organization",
    { billingPeriod, chargeCount: matching.length, total: matching.reduce((s, c) => s + c.amount, 0) }
  );

  res.json({ success: true, settledCount: matching.length });
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

app.post("/api/reports", (req, res) => {
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
  const { reportId, status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  const idx = db.reports.findIndex(r => r.id === reportId);
  if (idx === -1) return res.status(404).json({ error: "Report not found" });

  db.reports[idx].status = status;
  writeDb(db);

  logAudit(
    actorId,
    actorName,
    actorRole,
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
  const { slug, title, titleAr, content, contentAr, version, effectiveDate, status, author, legalReviewStatus, actorId, actorName, actorRole } = req.body;
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
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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
  const { id, category, title, titleAr, content, contentAr, isPublished, actorId, actorName, actorRole } = req.body;
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
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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
app.get("/api/support/tickets", (req, res) => {
  const { userId, email } = req.query;
  const db = readDb();
  let tickets = db.supportTickets || [];
  if (userId) {
    tickets = tickets.filter(t => t.userId === userId);
  } else if (email) {
    tickets = tickets.filter(t => t.userEmail === email);
  }
  res.json(tickets);
});

app.post("/api/support/tickets", (req, res) => {
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

app.post("/api/support/tickets/:id/reply", (req, res) => {
  const { id } = req.params;
  const { senderId, senderName, senderRole, message } = req.body;
  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];

  const idx = db.supportTickets.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Ticket not found" });

  const reply = {
    id: `reply-${Date.now()}`,
    senderId: senderId || "guest",
    senderName: senderName || "Respondent",
    senderRole: senderRole || "VISITOR",
    message: message || "",
    createdDate: new Date().toISOString()
  };

  db.supportTickets[idx].replies.push(reply);
  
  // Auto switch status
  if (senderRole === UserRole.PLATFORM_ADMIN || senderRole === UserRole.SUPER_ADMIN) {
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
  const { status, priority, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  if (!db.supportTickets) db.supportTickets = [];

  const idx = db.supportTickets.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Ticket not found" });

  if (status) db.supportTickets[idx].status = status;
  if (priority) db.supportTickets[idx].priority = priority;

  writeDb(db);

  logAudit(
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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
  const { id, title, titleAr, department, departmentAr, location, locationAr, type, typeAr, description, descriptionAr, requirements, requirementsAr, actorId, actorName, actorRole } = req.body;
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
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
    idx !== -1 ? "UPDATE_JOB" : "CREATE_JOB",
    targetId,
    "JobListing",
    { title }
  );

  res.json({ success: true, job: updatedJob });
});

app.get("/api/press", (req, res) => {
  const db = readDb();
  res.json(db.pressReleases || []);
});

app.post("/api/admin/press", (req, res) => {
  const { id, title, titleAr, date, summary, summaryAr, content, contentAr, actorId, actorName, actorRole } = req.body;
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
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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

app.post("/api/partnerships", (req, res) => {
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
  const { status, actorId, actorName, actorRole } = req.body;
  const db = readDb();
  if (!db.partnershipRequests) db.partnershipRequests = [];

  const idx = db.partnershipRequests.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: "Partnership request not found" });

  db.partnershipRequests[idx].status = status;
  writeDb(db);

  logAudit(
    actorId || "admin",
    actorName || "Admin",
    actorRole || UserRole.PLATFORM_ADMIN,
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

app.post("/api/media/upload", upload.array("files"), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded." });
  }

  const urls = [];

  for (const file of files) {
    const filename = file.filename;
    const uploadedPath = path.join(uploadsDir, filename);
    const originalPath = path.join(uploadsDir, "original-" + filename);

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
app.post("/api/user/delete-account", (req, res) => {
  const { userId, actorName, actorRole } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

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

  // 3. Log into Audit Trail
  logAudit(
    userId,
    actorName || "Self",
    actorRole || UserRole.REGISTERED,
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

app.get("/api/user/export-data", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "User ID is required" });

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
app.post("/api/reviews", authMiddleware, (req, res) => {
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
  
  res.status(201).json({ success: true, message: "Review submitted for admin moderation.", review: newReview });
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

// Uptime Monitoring Health Check
app.get("/api/health", async (req, res, next) => {
  try {
    await prisma.user.count();
    res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "CONNECTED",
      environment: process.env.NODE_ENV || "development"
    });
  } catch (error: any) {
    logStructuredError("/api/health", error, req);
    res.status(500).json({
      status: "ERROR",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: "DISCONNECTED",
      error: error.message
    });
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
    console.error("Failed to initialize PostgreSQL database on startup:", err);
  }

  // Verification document expiry sweep: flags EXPIRED docs and sends 30/7-day reminder emails.
  checkDocumentExpiryAndReminders();
  setInterval(checkDocumentExpiryAndReminders, 24 * 60 * 60 * 1000);

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
