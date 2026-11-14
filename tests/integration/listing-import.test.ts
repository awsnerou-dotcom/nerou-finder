import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../../server.js";
import { initDb, readDb, writeDb } from "../../server-db.js";
import { uniqueIp } from "../helpers.js";

let dbReady = false;
beforeAll(async () => {
  try {
    await initDb();
    dbReady = true;
  } catch (err) {
    console.warn("Skipping DB-backed integration tests - no reachable test database:", err);
  }
});
afterEach(() => { vi.unstubAllGlobals(); });

const tag = `li${Date.now().toString(36)}`;
const tokenFor = (id: string, role: string) => jwt.sign({ id, email: "x@test.local", role, fullName: "Someone" }, process.env.JWT_SECRET!, { expiresIn: "1h" });

/** an independent agent with no authorization letter, or an agency agent: both made fresh so tests do not share listings */
function makeAgent(kind: "agency" | "independent", suffix: string) {
  const db = readDb();
  const base = db.users.find(u => u.id === "user-agent-1")!;
  const id = `user-imp-${kind}-${suffix}-${tag}`;
  db.users.push({
    ...base, id, fullName: `Importer ${suffix}`, email: `${id}@example.test`, listingFeed: undefined,
    ...(kind === "independent" ? { orgId: undefined, agentType: "INDEPENDENT_AGENT" } : {})
  } as never);
  writeDb(db);
  return id;
}

const header = "reference,title,type,for,price,size_sqm,bedrooms,bathrooms,area,city,description,photos";
const csv = (...rows: string[]) => [header, ...rows].join("\n");
const complete = (ref: string, price = 8500, photos = "") => `${ref},Flat ${ref},apartment,rent,${price},120,2,2,Lusail,Doha,A bright flat. Call 5551 2345,${photos}`;
const noSize = (ref: string) => `${ref},Flat ${ref},apartment,rent,8000,,2,2,Lusail,Doha,No size given,`;

const post = (path: string, id: string, body: string, role = "AGENT") =>
  request(app).post(path).set("Authorization", `Bearer ${tokenFor(id, role)}`).set("X-Forwarded-For", uniqueIp()).set("Content-Type", "text/plain; charset=utf-8").send(body);
const listingsOf = (id: string) => readDb().properties.filter(p => p.agentId === id && p.isFeedImported);

describe("POST /api/listings/import/preview", () => {
  it("says what would be created, updated, skipped and which rows are incomplete, without saving anything", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "pv");
    const res = await post("/api/listings/import/preview", id, csv(complete(`${tag}-1`), noSize(`${tag}-2`), `${tag}-3,Bad row,apartment,rent,,100,2,2,Lusail,Doha,x,`)).expect(200);
    expect(res.body).toMatchObject({ format: "csv", total: 3, counts: { create: 2, update: 0, complete: 1, incomplete: 1 } });
    expect(res.body.skipped).toEqual([{ row: 3, reason: "Missing or invalid price." }]);
    expect(res.body.items[0]).toMatchObject({ externalId: `${tag}-1`, price: 8500, district: "Lusail", action: "create", complete: true });
    expect(listingsOf(id)).toHaveLength(0);
  });

  it("needs a signed-in agent, and rejects empty or unreadable files with a plain message", async (ctx) => {
    if (!dbReady) return ctx.skip();
    await request(app).post("/api/listings/import/preview").set("X-Forwarded-For", uniqueIp()).set("Content-Type", "text/plain").send(csv(complete("x"))).expect(401);
    const id = makeAgent("agency", "pv2");
    expect((await post("/api/listings/import/preview", id, "   ").expect(400)).body.error).toMatch(/empty/i);
    expect((await post("/api/listings/import/preview", id, "<a><b></a>").expect(400)).body.error).toMatch(/invalid xml/i);
    expect((await post("/api/listings/import/preview", id, "{nope").expect(400)).body.error).toMatch(/json/i);
    expect((await post("/api/listings/import/preview", "user-registered-nobody", csv(complete("x")), "REGISTERED").expect(403)).body.error).toMatch(/cannot import/);
  });
});

describe("POST /api/listings/import/commit", () => {
  it("saves everything as drafts by default, as the agent's own, with the phone number removed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "dr");
    const res = await post("/api/listings/import/commit", id, csv(complete(`${tag}-d1`), complete(`${tag}-d2`, 9000))).expect(200);
    expect(res.body).toMatchObject({ created: 2, updated: 0, drafts: 2, published: 0, skipped: [], publishBlocked: null });
    const mine = listingsOf(id);
    expect(mine).toHaveLength(2);
    expect(mine.every(p => p.listingStatus === "DRAFT" && p.agentId === id && p.orgId === "org-agency-1")).toBe(true);
    expect(mine[0].description).not.toMatch(/5551|2345/);
    expect(mine.find(p => p.externalListingId === `${tag}-d1`)).toMatchObject({ price: 8500, area: 120, bedrooms: 2, district: "Lusail", transactionType: "FOR_RENT", rentalPeriod: "MONTHLY" });
  });

  it("publishes the complete listings when asked, and keeps incomplete ones as drafts", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "pub");
    const res = await post("/api/listings/import/commit?publish=1", id, csv(complete(`${tag}-p1`), noSize(`${tag}-p2`))).expect(200);
    expect(res.body).toMatchObject({ created: 2, published: 1, drafts: 1 });
    const byRef = (r: string) => listingsOf(id).find(p => p.externalListingId === r)!;
    expect(byRef(`${tag}-p1`)).toMatchObject({ listingStatus: "PUBLISHED", verificationStatus: "APPROVED" });
    expect(byRef(`${tag}-p2`)).toMatchObject({ listingStatus: "DRAFT" });
  });

  it("keeps an independent agent's listings as drafts until the authorization letter is approved, and says why", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("independent", "ind");
    const res = await post("/api/listings/import/commit?publish=1", id, csv(complete(`${tag}-i1`))).expect(200);
    expect(res.body).toMatchObject({ created: 1, published: 0, drafts: 1 });
    expect(res.body.publishBlocked).toMatch(/Authorization Letter/);
    expect(listingsOf(id)[0]).toMatchObject({ listingStatus: "DRAFT", orgId: undefined });
  });

  it("updates on a second import instead of duplicating, recording a price change and leaving the status alone", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "up");
    await post("/api/listings/import/commit?publish=1", id, csv(complete(`${tag}-u1`, 8500))).expect(200);
    const again = await post("/api/listings/import/commit", id, csv(complete(`${tag}-u1`, 7900))).expect(200);
    expect(again.body).toMatchObject({ created: 0, updated: 1 });
    const mine = listingsOf(id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ price: 7900, listingStatus: "PUBLISHED" });
    expect(mine[0].priceHistory.map(h => h.price)).toEqual([8500, 7900]);
    const preview = await post("/api/listings/import/preview", id, csv(complete(`${tag}-u1`), complete(`${tag}-u2`))).expect(200);
    expect(preview.body.counts).toMatchObject({ create: 1, update: 1 });
  });

  it("never touches another agent's listing that has the same reference", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const a = makeAgent("agency", "ma");
    const b = makeAgent("agency", "mb");
    await post("/api/listings/import/commit", a, csv(complete(`${tag}-same`, 8500))).expect(200);
    await post("/api/listings/import/commit", b, csv(complete(`${tag}-same`, 1234))).expect(200);
    expect(listingsOf(a)[0].price).toBe(8500);
    expect(listingsOf(b)[0].price).toBe(1234);
  });

  it("queues the photos, to be downloaded in the background, and never fetches an address on a private network", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "ph");
    const res = await post("/api/listings/import/commit", id, csv(complete(`${tag}-ph1`, 8500, "https://203.0.113.5/a.jpg|http://127.0.0.1/b.jpg"))).expect(200);
    expect(res.body.photosQueued).toBe(1);
    expect(listingsOf(id)[0].sourceFeedImageUrls).toEqual(["https://203.0.113.5/a.jpg", "http://127.0.0.1/b.jpg"]);
    // both addresses are refused, so the photos end up marked as failed rather than fetched
    for (let i = 0; i < 40 && readDb().properties.find(p => p.agentId === id)?.importPhotos === "PENDING"; i++) await new Promise(r => setTimeout(r, 100));
    expect(readDb().properties.find(p => p.agentId === id)?.importPhotos).toBe("FAILED");
  });
});

describe("POST /api/listings/publish-imported", () => {
  const publishAll = (id: string) =>
    request(app).post("/api/listings/publish-imported").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp());

  it("publishes the imported drafts that are complete and leaves the ones that still need details", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "pa");
    await post("/api/listings/import/commit", id, csv(complete(`${tag}-a1`), complete(`${tag}-a2`), noSize(`${tag}-a3`))).expect(200);
    const res = await publishAll(id).expect(200);
    expect(res.body).toEqual({ published: 2, waiting: 1 });
    const by = (r: string) => listingsOf(id).find(p => p.externalListingId === r)!;
    expect(by(`${tag}-a1`)).toMatchObject({ listingStatus: "PUBLISHED", verificationStatus: "APPROVED" });
    expect(by(`${tag}-a3`)).toMatchObject({ listingStatus: "DRAFT", importIncomplete: true });
    const again = await publishAll(id).expect(200);
    expect(again.body).toEqual({ published: 0, waiting: 1 });
  });

  it("an incomplete import stops being incomplete once the agent edits it", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "pe");
    await post("/api/listings/import/commit", id, csv(noSize(`${tag}-e1`))).expect(200);
    const listing = listingsOf(id)[0];
    await request(app).post("/api/properties").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp())
      .send({ id: listing.id, area: 110, listingStatus: "DRAFT" }).expect(200);
    expect(readDb().properties.find(p => p.id === listing.id)?.importIncomplete).toBeUndefined();
    expect((await publishAll(id).expect(200)).body).toEqual({ published: 1, waiting: 0 });
  });

  it("is refused for an independent agent whose authorization letter is not approved", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("independent", "pi");
    await post("/api/listings/import/commit", id, csv(complete(`${tag}-i9`))).expect(200);
    const res = await publishAll(id).expect(403);
    expect(res.body.error).toMatch(/Authorization Letter/);
    expect(listingsOf(id)[0].listingStatus).toBe("DRAFT");
  });
});

describe("a connected feed", () => {
  const feedUrl = "https://93.184.216.34/feed.csv";
  const stubFeed = (body: string, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
  const put = (id: string, url: string, autoPublish = false) =>
    request(app).put("/api/me/listing-feed").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).send({ url, autoPublish });

  it("refuses a link that is not https or that points inside the server's own network", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "fb");
    await put(id, "http://93.184.216.34/feed.csv").expect(400);
    const res = await put(id, "https://169.254.169.254/latest/meta-data").expect(400);
    expect(res.body.error).toMatch(/public internet/);
    const local = await put(id, "https://localhost/feed").expect(400);
    expect(local.body.error).toMatch(/public internet/);
  });

  it("connects, imports at once as drafts, and reads it again on demand, updating what changed", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "fc");
    stubFeed(csv(complete(`${tag}-f1`), complete(`${tag}-f2`)));
    const res = await put(id, feedUrl).expect(200);
    expect(res.body.result).toMatchObject({ ok: true, created: 2, drafts: 2 });
    expect(res.body.feed).toMatchObject({ url: feedUrl, active: true, autoPublish: false });
    expect(listingsOf(id)).toHaveLength(2);

    stubFeed(csv(complete(`${tag}-f1`, 7000), complete(`${tag}-f2`), complete(`${tag}-f3`)));
    const sync = await request(app).post("/api/me/listing-feed/sync").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(sync.body.result).toMatchObject({ created: 1, updated: 2 });
    expect(listingsOf(id)).toHaveLength(3);
    expect(listingsOf(id).find(p => p.externalListingId === `${tag}-f1`)?.price).toBe(7000);
    const status = await request(app).get("/api/me/listing-feed").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(status.body.feed.lastSyncStats).toMatchObject({ created: 1, updated: 2 });
  });

  it("publishes the complete listings as they arrive when the agent chose that", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "fd");
    stubFeed(csv(complete(`${tag}-g1`), noSize(`${tag}-g2`)));
    await put(id, feedUrl, true).expect(200);
    const by = (r: string) => listingsOf(id).find(p => p.externalListingId === r)!;
    expect(by(`${tag}-g1`).listingStatus).toBe("PUBLISHED");
    expect(by(`${tag}-g2`).listingStatus).toBe("DRAFT");
  });

  it("changes nothing when the feed is empty, broken or unreachable, and shows the agent what went wrong", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "fe");
    stubFeed(csv(complete(`${tag}-h1`)));
    await put(id, feedUrl).expect(200);

    stubFeed(header + "\n");
    const empty = await request(app).post("/api/me/listing-feed/sync").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(400);
    expect(empty.body.error).toMatch(/no listings|nothing was changed|no rows/i);
    stubFeed("oops", 500);
    const down = await request(app).post("/api/me/listing-feed/sync").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(400);
    expect(down.body.error).toMatch(/error \(500\)/);
    expect(listingsOf(id)).toHaveLength(1);
    expect(readDb().users.find(u => u.id === id)?.listingFeed?.lastError).toMatch(/error \(500\)/);
  });

  it("disconnects without removing the listings that came in", async (ctx) => {
    if (!dbReady) return ctx.skip();
    const id = makeAgent("agency", "ff");
    stubFeed(csv(complete(`${tag}-k1`)));
    await put(id, feedUrl).expect(200);
    await request(app).delete("/api/me/listing-feed").set("Authorization", `Bearer ${tokenFor(id, "AGENT")}`).set("X-Forwarded-For", uniqueIp()).expect(200);
    expect(readDb().users.find(u => u.id === id)?.listingFeed).toBeUndefined();
    expect(listingsOf(id)).toHaveLength(1);
  });
});
