import { describe, it, expect } from "vitest";
import { assertPublicUrl, fetchPublic, isPublicIp, UnsafeUrlError } from "../../src/lib/safeFetch.js";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];
const privateLookup = async () => [{ address: "10.0.0.5", family: 4 }];
const mixedLookup = async () => [{ address: "93.184.216.34", family: 4 }, { address: "169.254.169.254", family: 4 }];

describe("which addresses count as public", () => {
  it("refuses private, loopback, link-local and reserved IPv4 addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.5"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });
  it("allows ordinary public addresses, including the edges of the private ranges", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.15.0.1", "172.32.0.1", "11.0.0.1", "100.63.0.1", "100.128.0.1"]) expect(isPublicIp(ip), ip).toBe(true);
  });
  it("handles IPv6, including addresses that wrap an IPv4 one", () => {
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("::")).toBe(false);
    expect(isPublicIp("fd00::1")).toBe(false);
    expect(isPublicIp("fe80::1")).toBe(false);
    expect(isPublicIp("ff02::1")).toBe(false);
    expect(isPublicIp("2001:db8::1")).toBe(false);
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });
  it("says no to anything that is not an address", () => {
    expect(isPublicIp("example.com")).toBe(false);
    expect(isPublicIp("")).toBe(false);
  });
});

describe("which links are allowed", () => {
  const bad = async (u: string, lookup = publicLookup) => { try { await assertPublicUrl(u, lookup); return "ok"; } catch (e) { return e instanceof UnsafeUrlError ? e.message : "other"; } };
  it("accepts a normal https link to a public site", async () => {
    expect(await bad("https://example.com/feed.xml")).toBe("ok");
    expect(await bad("http://example.com:80/x")).toBe("ok");
  });
  it("refuses other protocols, credentials and odd ports", async () => {
    expect(await bad("file:///etc/passwd")).toMatch(/http and https/);
    expect(await bad("ftp://example.com/x")).toMatch(/http and https/);
    expect(await bad("https://user:pw@example.com/x")).toMatch(/user name/);
    expect(await bad("https://example.com:6379/x")).toMatch(/ports/);
    expect(await bad("not a url")).toMatch(/valid link/);
  });
  it("refuses an address written as a private IP or a local name", async () => {
    expect(await bad("http://127.0.0.1/admin")).toMatch(/public internet/);
    expect(await bad("http://169.254.169.254/latest/meta-data")).toMatch(/public internet/);
    expect(await bad("http://[::1]/x")).toMatch(/public internet/);
    expect(await bad("http://localhost/x")).toMatch(/public internet/);
    expect(await bad("http://printer.local/x")).toMatch(/public internet/);
  });
  it("refuses a name that resolves to a private address, even when it also resolves to a public one", async () => {
    expect(await bad("https://evil.example/x", privateLookup)).toMatch(/public internet/);
    expect(await bad("https://evil.example/x", mixedLookup)).toMatch(/public internet/);
    expect(await bad("https://nowhere.example/x", async () => { throw new Error("ENOTFOUND"); })).toMatch(/could not find/);
  });
});

function fakeFetch(routes: Record<string, { status?: number; location?: string; body?: string; headers?: Record<string, string> }>): typeof fetch {
  return (async (input: string) => {
    const r = routes[input];
    if (!r) throw new Error(`unexpected ${input}`);
    const headers = new Headers({ ...(r.location ? { location: r.location } : {}), ...(r.headers || {}) });
    return new Response(r.body ?? "", { status: r.status ?? 200, headers });
  }) as unknown as typeof fetch;
}

describe("fetching", () => {
  it("returns the body of a public link", async () => {
    const r = await fetchPublic("https://example.com/feed", { lookup: publicLookup, fetchImpl: fakeFetch({ "https://example.com/feed": { body: "hello", headers: { "content-type": "text/plain" } } }) });
    expect(r.body.toString()).toBe("hello");
    expect(r.contentType).toBe("text/plain");
  });
  it("follows a redirect to another public place and checks it", async () => {
    const f = fakeFetch({ "https://example.com/a": { status: 302, location: "https://cdn.example.com/b" }, "https://cdn.example.com/b": { body: "ok" } });
    expect((await fetchPublic("https://example.com/a", { lookup: publicLookup, fetchImpl: f })).body.toString()).toBe("ok");
  });
  it("refuses a redirect into the private network", async () => {
    const f = fakeFetch({ "https://example.com/a": { status: 302, location: "http://169.254.169.254/latest/meta-data" } });
    await expect(fetchPublic("https://example.com/a", { lookup: publicLookup, fetchImpl: f })).rejects.toThrow(/public internet/);
  });
  it("gives up after too many redirects", async () => {
    const f = fakeFetch({ "https://example.com/a": { status: 302, location: "https://example.com/a" } });
    await expect(fetchPublic("https://example.com/a", { lookup: publicLookup, fetchImpl: f, maxRedirects: 2 })).rejects.toThrow(/too many/);
  });
  it("refuses a file larger than the cap, by its declared size or by what arrives", async () => {
    const declared = fakeFetch({ "https://example.com/big": { body: "x", headers: { "content-length": "999999999" } } });
    await expect(fetchPublic("https://example.com/big", { lookup: publicLookup, fetchImpl: declared, maxBytes: 1000 })).rejects.toThrow(/too large/);
    const actual = fakeFetch({ "https://example.com/big": { body: "x".repeat(5000) } });
    await expect(fetchPublic("https://example.com/big", { lookup: publicLookup, fetchImpl: actual, maxBytes: 1000 })).rejects.toThrow(/too large/);
  });
});
