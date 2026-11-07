import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { app, migrateLegacyVerificationDocuments } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { DOCUMENT_DECLARATION } from "../../src/types.js";
import { uniqueEmail, uniqueIp, signupAndVerify } from "../helpers.js";

let dbReady = false;

beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});

const uploadsDir = path.join(process.cwd(), "assets", "uploads");
const privateDir = path.join(uploadsDir, ".private-docs");

// Real file signatures are all the server sniffs for; the rest of the bytes are arbitrary.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fake-id-card-bytes")]);

function adminToken(): string {
  return jwt.sign(
    { id: "user-platform-admin", email: "admin@test.local", role: "PLATFORM_ADMIN", fullName: "Test Admin" },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );
}

async function signupAgent(label: string) {
  const res = await signupAndVerify(app, uniqueIp(), {
    email: uniqueEmail(label),
    password: "correct-horse-battery-staple",
    fullName: `Docs ${label}`,
    phone: "+974 5555 9600",
    role: "AGENT"
  });
  return { token: res.body.token as string, userId: res.body.user.id as string };
}

async function uploadPrivate(token: string, bytes: Buffer = PNG) {
  return request(app)
    .post("/api/verification-documents/upload")
    .set("Authorization", `Bearer ${token}`)
    .attach("file", bytes, { filename: "id.png", contentType: "image/png" });
}

async function submitDocument(token: string, documentType = "QID_FRONT") {
  const up = await uploadPrivate(token);
  expect(up.status).toBe(200);
  const sub = await request(app)
    .post("/api/verification-documents")
    .set("Authorization", `Bearer ${token}`)
    .send({ documentType, fileUrl: up.body.fileRef, declarationAccepted: true, declarationVersion: DOCUMENT_DECLARATION.version });
  expect(sub.status).toBe(200);
  return { fileRef: up.body.fileRef as string, doc: sub.body.document };
}

describe("verification documents are stored privately", () => {
  it("rejects anonymous uploads", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const res = await request(app)
      .post("/api/verification-documents/upload")
      .attach("file", PNG, { filename: "id.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("stores the file in the private folder with no watermark, thumbnail or original- variant, and not under a public name", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("priv-store");
    const { fileRef } = await submitDocument(token);
    const name = fileRef.replace("private:", "");

    expect(fileRef.startsWith("private:")).toBe(true);
    // byte-for-byte as uploaded (the watermark pipeline would have rewritten it)
    expect(fs.readFileSync(path.join(privateDir, name)).equals(PNG)).toBe(true);
    expect(fs.existsSync(path.join(uploadsDir, name))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "thumb-" + name))).toBe(false);
    expect(fs.existsSync(path.join(uploadsDir, "original-" + name))).toBe(false);
  });

  it("is not reachable through the public static /assets handler, however the path is written", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("priv-static");
    const { fileRef } = await submitDocument(token);
    const name = fileRef.replace("private:", "");
    for (const p of [
      `/assets/uploads/.private-docs/${name}`,
      `/assets/uploads/%2eprivate-docs/${name}`,
      `/assets/uploads/.private-docs%2f${name}`
    ]) {
      const res = await request(app).get(p);
      expect(res.status, p).toBe(404);
    }
  });

  it("lets the owner and a platform admin read the file, and nobody else", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const owner = await signupAgent("priv-owner");
    const other = await signupAgent("priv-other");
    const { doc } = await submitDocument(owner.token);
    const url = `/api/verification-documents/${doc.id}/file`;

    const anon = await request(app).get(url);
    expect(anon.status).toBe(401);

    const asOther = await request(app).get(url).set("Authorization", `Bearer ${other.token}`);
    expect(asOther.status).toBe(404);

    const asOwner = await request(app)
      .get(url)
      .set("Authorization", `Bearer ${owner.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers["content-type"]).toMatch(/image\/png/);
    expect(asOwner.headers["cache-control"]).toMatch(/no-store/);
    expect((asOwner.body as Buffer).equals(PNG)).toBe(true);

    const asAdmin = await request(app).get(url).set("Authorization", `Bearer ${adminToken()}`);
    expect(asAdmin.status).toBe(200);
  });

  it("refuses a document that points at a public URL, a missing file, a traversal path, or another user's private file", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await signupAgent("priv-ref-a");
    const b = await signupAgent("priv-ref-b");
    const aFile = (await uploadPrivate(a.token)).body.fileRef as string;

    const body = (fileUrl: string) => ({
      documentType: "QID_FRONT",
      fileUrl,
      declarationAccepted: true,
      declarationVersion: DOCUMENT_DECLARATION.version
    });
    for (const fileUrl of [
      "/assets/uploads/some-public-photo.jpg",
      "private:" + b.userId + "-does-not-exist.png",
      "private:../../server.png",
      aFile // valid, but uploaded by A - B must not be able to claim it
    ]) {
      const res = await request(app).post("/api/verification-documents").set("Authorization", `Bearer ${b.token}`).send(body(fileUrl));
      expect(res.status, fileUrl).toBe(400);
    }
  });

  it("rejects a file whose bytes do not match its declared type", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("priv-sniff");
    const res = await uploadPrivate(token, Buffer.from("<script>alert(1)</script>"));
    expect(res.status).toBe(400);
  });

  it("deletes the previous file when a document is replaced", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { token } = await signupAgent("priv-replace");
    const first = await submitDocument(token);
    const second = await submitDocument(token);
    expect(second.fileRef).not.toBe(first.fileRef);
    expect(fs.existsSync(path.join(privateDir, first.fileRef.replace("private:", "")))).toBe(false);
    expect(fs.existsSync(path.join(privateDir, second.fileRef.replace("private:", "")))).toBe(true);
  });
});

describe("legacy documents uploaded before private storage", () => {
  it("are moved out of the public folder, their watermark/thumb/original variants removed, and fileUrl rewritten", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const { userId } = await signupAgent("priv-legacy");
    const publicName = `legacy-${Date.now()}.png`;
    fs.writeFileSync(path.join(uploadsDir, publicName), Buffer.concat([PNG, Buffer.from("-watermarked")]));
    fs.writeFileSync(path.join(uploadsDir, "original-" + publicName), PNG);
    fs.writeFileSync(path.join(uploadsDir, "thumb-" + publicName), Buffer.from("thumb"));

    const db = readDb();
    db.verificationDocuments = db.verificationDocuments || [];
    const docId = `docv-legacy-${Date.now()}`;
    db.verificationDocuments.push({
      id: docId,
      context: "AGENT",
      userId,
      documentType: "QID_FRONT",
      fileUrl: `/assets/uploads/${publicName}`,
      status: "PENDING",
      submittedDate: new Date().toISOString()
    } as any);
    writeDb(db);

    expect(migrateLegacyVerificationDocuments()).toBeGreaterThanOrEqual(1);

    for (const f of [publicName, "original-" + publicName, "thumb-" + publicName]) {
      expect(fs.existsSync(path.join(uploadsDir, f)), f).toBe(false);
    }
    const moved = readDb().verificationDocuments!.find(d => d.id === docId)!;
    expect(moved.fileUrl.startsWith("private:")).toBe(true);
    // the unwatermarked original is what is kept
    expect(fs.readFileSync(path.join(privateDir, moved.fileUrl.replace("private:", ""))).equals(PNG)).toBe(true);
    // idempotent
    expect(migrateLegacyVerificationDocuments()).toBe(0);
  });
});
