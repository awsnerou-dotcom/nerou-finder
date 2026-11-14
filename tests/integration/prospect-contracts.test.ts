import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb } from "../../server-db.js";
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

const ADMIN_ID = "user-platform-admin";
const admin = () => ({ Authorization: `Bearer ${jwt.sign({ id: ADMIN_ID, email: "x@test.local", role: "PLATFORM_ADMIN", fullName: "Admin" }, process.env.JWT_SECRET!, { expiresIn: "1h" })}` });
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

let seq = 0;
const addClient = async (over: object = {}) =>
  (await request(app).post("/api/admin/prospects").set(admin()).send({ name: `Contract client ${Date.now()}-${seq++}`, email: uniqueEmail("ctr"), kind: "AGENCY", source: "EVENT", ...over })).body.prospect;

const attach = (id: string, fields: Record<string, string> = { title: "Annual agreement" }, file: { bytes: Buffer; name: string; type: string } | null = { bytes: PDF, name: "agreement.pdf", type: "application/pdf" }) => {
  let r = request(app).post(`/api/admin/prospects/${id}/contracts`).set(admin());
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  if (file) r = r.attach("file", file.bytes, { filename: file.name, contentType: file.type });
  return r;
};
const stored = (prospectId: string) => readDb().prospects!.find(p => p.id === prospectId)!;
const privateFile = (ref: string) => path.join(process.cwd(), "assets", "uploads", ".private-docs", ref.replace("private:", ""));

describe("contracts on a client", () => {
  it("attaches a signed PDF with its details, never reveals the private file reference, and logs it in the history", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    const res = await attach(c.id, { title: "Gold plan 2026", kind: "SUBSCRIPTION", signedDate: "2026-11-01", startDate: "2026-11-01", endDate: "2027-10-31", monthlyValue: "1800" });
    expect(res.status).toBe(201);
    const contract = res.body.prospect.contracts[0];
    expect(contract).toMatchObject({ title: "Gold plan 2026", kind: "SUBSCRIPTION", endDate: "2027-10-31", monthlyValue: 1800, fileName: "agreement.pdf", mimeType: "application/pdf", uploadedBy: expect.any(String) });
    expect(contract.fileRef).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("private:");
    expect(res.body.prospect.activity.at(-1).text).toContain("Contract attached: Gold plan 2026");

    const list = await request(app).get("/api/admin/prospects").set(admin()).expect(200);
    expect(JSON.stringify(list.body)).not.toContain("private:");
    expect(list.body.contractStats).toMatchObject({ subscribed: expect.any(Number), missing: expect.any(Number) });

    // the file really is on disk, in the private folder
    expect(fs.existsSync(privateFile(stored(c.id).contracts![0].fileRef!))).toBe(true);
  });

  it("serves the file only to a platform admin, with the right type", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    const res = await attach(c.id).expect(201);
    const cid = res.body.prospect.contracts[0].id;
    const url = `/api/admin/prospects/${c.id}/contracts/${cid}/file`;

    const ok = await request(app).get(url).set(admin()).expect(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");
    expect(ok.headers["cache-control"]).toContain("no-store");
    expect(Buffer.from(ok.body).toString("latin1")).toContain("%PDF");

    await request(app).get(url).expect(401);
    const agent = await signupAndVerify(app, uniqueIp(), { email: uniqueEmail("ctr-agent"), password: "correct-horse-battery-staple", fullName: "Curious Agent", phone: "+974 5555 9822", role: "AGENT" });
    await request(app).get(url).set({ Authorization: `Bearer ${agent.body.token}` }).expect(403);
    await request(app).post(`/api/admin/prospects/${c.id}/contracts`).set({ Authorization: `Bearer ${agent.body.token}` }).field("title", "x").attach("file", PDF, { filename: "a.pdf", contentType: "application/pdf" }).expect(403);
    await request(app).get(`/api/admin/prospects/${c.id}/contracts/nope/file`).set(admin()).expect(404);
  });

  it("refuses a missing file, a missing title, bad dates, a fake PDF and a wrong file type - and leaves no stray file behind", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    const dir = path.join(process.cwd(), "assets", "uploads", ".private-docs");
    const before = fs.readdirSync(dir).length;

    await attach(c.id, { title: "x" }, null).expect(400);
    await attach(c.id, { title: "  " }).expect(400);
    await attach(c.id, { title: "x", endDate: "31/12/2026" }).expect(400);
    await attach(c.id, { title: "x", startDate: "2026-12-01", endDate: "2026-01-01" }).expect(400);
    await attach(c.id, { title: "x" }, { bytes: Buffer.from("MZ not a pdf at all"), name: "fake.pdf", type: "application/pdf" }).expect(400);
    await attach(c.id, { title: "x" }, { bytes: Buffer.from("PK\u0003\u0004 zip"), name: "c.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }).expect(400);
    await attach("no-such-client", { title: "x" }).expect(404);

    expect(stored(c.id).contracts ?? []).toHaveLength(0);
    expect(fs.readdirSync(dir).length).toBe(before);
  });

  it("accepts a photo of the contract too, and keeps an Arabic file name readable", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    const res = await attach(c.id, { title: "عقد الاشتراك" }, { bytes: PNG, name: "عقد-الاشتراك.png", type: "image/png" }).expect(201);
    expect(res.body.prospect.contracts[0]).toMatchObject({ title: "عقد الاشتراك", mimeType: "image/png", fileName: "عقد-الاشتراك.png" });
  });

  it("edits the details without touching the file, and removes the file when the contract is deleted", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    const created = await attach(c.id, { title: "Draft title", endDate: "2027-01-01" }).expect(201);
    const cid = created.body.prospect.contracts[0].id;
    const ref = stored(c.id).contracts![0].fileRef!;

    const edited = await request(app).patch(`/api/admin/prospects/${c.id}/contracts/${cid}`).set(admin()).send({ title: "Final title", endDate: "2028-01-01" }).expect(200);
    expect(edited.body.prospect.contracts[0]).toMatchObject({ title: "Final title", endDate: "2028-01-01", fileName: "agreement.pdf" });
    expect(stored(c.id).contracts![0].fileRef).toBe(ref);
    await request(app).patch(`/api/admin/prospects/${c.id}/contracts/${cid}`).set(admin()).send({ endDate: "nonsense" }).expect(400);
    // an edit cannot repoint the file at another one
    await request(app).patch(`/api/admin/prospects/${c.id}/contracts/${cid}`).set(admin()).send({ fileRef: "private:other.pdf", fileName: "evil" }).expect(200);
    expect(stored(c.id).contracts![0].fileRef).toBe(ref);

    await request(app).delete(`/api/admin/prospects/${c.id}/contracts/${cid}`).set(admin()).expect(200);
    expect(stored(c.id).contracts).toHaveLength(0);
    expect(fs.existsSync(privateFile(ref))).toBe(false);
    await request(app).delete(`/api/admin/prospects/${c.id}/contracts/${cid}`).set(admin()).expect(404);
  });

  it("deleting the client deletes their contract files", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const c = await addClient();
    await attach(c.id).expect(201);
    const ref = stored(c.id).contracts![0].fileRef!;
    expect(fs.existsSync(privateFile(ref))).toBe(true);
    await request(app).delete(`/api/admin/prospects/${c.id}`).set(admin()).expect(200);
    expect(fs.existsSync(privateFile(ref))).toBe(false);
  });

  it("counts subscribed clients with no contract on file", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = await addClient();
    const b = await addClient();
    for (const id of [a.id, b.id]) await request(app).patch(`/api/admin/prospects/${id}`).set(admin()).send({ stage: "WON" }).expect(200);
    const before = (await request(app).get("/api/admin/prospects").set(admin())).body.contractStats;
    await attach(a.id).expect(201);
    const after = (await request(app).get("/api/admin/prospects").set(admin())).body.contractStats;
    expect(after.withContract).toBe(before.withContract + 1);
    expect(after.missing).toBe(before.missing - 1);
  });
});
