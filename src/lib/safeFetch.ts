// Fetching a link a user gave us (their feed, their photos) without letting them point the server at its own insides. Only http(s)
// on the ordinary ports, only to addresses on the public internet (a name that resolves to a private, loopback, link-local or
// otherwise reserved address is refused, and so is every redirect that does), a cap on the size and the time, and nothing is
// followed more than a few hops. The network pieces (name lookup, fetch) are passed in, so the rules are tested without a network.

import { isIP } from "node:net";

export type Lookup = (hostname: string) => Promise<{ address: string; family: number }[]>;

function ipv4Public(ip: string): boolean {
  const [a, b, c] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast and reserved
  return true;
}

/** true only for an address on the public internet. */
export function isPublicIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4Public(ip);
  if (kind === 6) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return ipv4Public(mapped[1]);
    if (v === "::" || v === "::1") return false;
    if (/^f[cd]/.test(v)) return false; // unique local
    if (/^fe[89ab]/.test(v)) return false; // link-local
    if (v.startsWith("ff")) return false; // multicast
    if (v.startsWith("2001:db8")) return false; // documentation
    return true;
  }
  return false;
}

export class UnsafeUrlError extends Error {}

/** Checks one URL (and the addresses its name resolves to) and returns it parsed; throws UnsafeUrlError with a plain reason otherwise. */
export async function assertPublicUrl(raw: string, lookup: Lookup): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new UnsafeUrlError("That is not a valid link."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https links are allowed.");
  if (url.username || url.password) throw new UnsafeUrlError("Links with a user name or password are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("Only the standard web ports are allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new UnsafeUrlError("That address is not on the public internet.");
    return url;
  }
  if (/^(localhost|.*\.local|.*\.internal|.*\.localdomain)$/i.test(host)) throw new UnsafeUrlError("That address is not on the public internet.");
  let addresses: { address: string }[];
  try { addresses = await lookup(host); } catch { throw new UnsafeUrlError("We could not find that website."); }
  if (addresses.length === 0 || !addresses.every(a => isPublicIp(a.address))) throw new UnsafeUrlError("That address is not on the public internet.");
  return url;
}

export interface FetchedResource { status: number; contentType: string; body: Buffer; finalUrl: string }

export interface SafeFetchOptions {
  lookup: Lookup;
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

/** GETs a public link: redirects are followed by hand so each hop is checked, and the body is read only up to maxBytes. */
export async function fetchPublic(raw: string, opts: SafeFetchOptions): Promise<FetchedResource> {
  const doFetch = opts.fetchImpl ?? fetch;
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current, opts.lookup);
    const res = await doFetch(url.toString(), { redirect: "manual", signal: AbortSignal.timeout(opts.timeoutMs ?? 15000), headers: { "User-Agent": "NerouFinderImport/1.0", ...(opts.headers || {}) } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new UnsafeUrlError("That file is too large.");
    const reader = res.body?.getReader();
    const chunks: Buffer[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new UnsafeUrlError("That file is too large."); }
        chunks.push(Buffer.from(value));
      }
    }
    return { status: res.status, contentType: res.headers.get("content-type") || "", body: Buffer.concat(chunks), finalUrl: url.toString() };
  }
  throw new UnsafeUrlError("That link redirects too many times.");
}
