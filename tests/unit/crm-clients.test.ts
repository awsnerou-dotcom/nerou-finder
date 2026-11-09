import { describe, it, expect } from "vitest";
import { guessSource, parseCsv, phoneKey, rowsToClients, validateClientInput, westernDigits } from "../../src/lib/crm.js";

describe("validateClientInput", () => {
  it("accepts a client with a name and one way to reach them, and cleans the fields", () => {
    const r = validateClientInput({ name: "  Ali   Al  Thani ", phone: " +974 5555 1234 ", email: "ALI@Example.COM", source: "REFERRAL", budget: "1500000", interest: " 2BR  in Lusail ", notes: "met at the cafe" });
    expect(r).toEqual({
      ok: true,
      value: { name: "Ali Al Thani", phone: "+974 5555 1234", whatsapp: undefined, email: "ali@example.com", source: "REFERRAL", interest: "2BR in Lusail", budget: 1500000, notes: "met at the cafe" }
    });
  });

  it("needs a name and a way to reach the client", () => {
    expect(validateClientInput({ name: "", phone: "+974 5555 1234" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "   ", phone: "+974 5555 1234" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "Ali" })).toMatchObject({ ok: false, error: expect.stringMatching(/phone/i) });
    expect(validateClientInput({ name: "Ali", whatsapp: "+974 5555 1234" })).toMatchObject({ ok: true });
    expect(validateClientInput({ name: "Ali", email: "a@b.co" })).toMatchObject({ ok: true });
  });

  it("rejects malformed phones, emails, sources and budgets", () => {
    expect(validateClientInput({ name: "A", phone: "abc" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "12" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "=1+1" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "+974 5555 1234", email: "not-an-email" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "+974 5555 1234", source: "TIKTOK" })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "+974 5555 1234", budget: -5 })).toMatchObject({ ok: false });
    expect(validateClientInput({ name: "A", phone: "+974 5555 1234", budget: "lots" })).toMatchObject({ ok: false });
  });

  it("turns Arabic-Indic digits typed on an Arabic keyboard into normal digits", () => {
    expect(westernDigits("+٩٧٤ ٥٥٥٥ ١٢٣٤")).toBe("+974 5555 1234");
    const r = validateClientInput({ name: "علي", phone: "+٩٧٤ ٥٥٥٥ ١٢٣٤" });
    expect(r).toMatchObject({ ok: true, value: { name: "علي", phone: "+974 5555 1234" } });
  });

  it("limits the length of free text", () => {
    const r = validateClientInput({ name: "x".repeat(500), phone: "+974 5555 1234", notes: "n".repeat(5000), interest: "i".repeat(900) });
    expect(r.ok && r.value.name.length).toBe(120);
    expect(r.ok && r.value.notes!.length).toBe(1000);
    expect(r.ok && r.value.interest!.length).toBe(300);
  });
});

describe("phoneKey (duplicate detection)", () => {
  it("treats the same number written differently as the same person", () => {
    const k = phoneKey("+974 5555 1234");
    expect(k).toBe("55551234");
    expect(phoneKey("00974 5555-1234")).toBe(k);
    expect(phoneKey("(974) 55551234")).toBe(k);
    expect(phoneKey("5555 1234")).toBe(k);
    expect(phoneKey("+٩٧٤ ٥٥٥٥ ١٢٣٤")).toBe(k);
  });
  it("gives nothing for empty or too-short numbers (so they never match each other)", () => {
    expect(phoneKey("")).toBe("");
    expect(phoneKey(undefined)).toBe("");
    expect(phoneKey("123")).toBe("");
  });
});

describe("parseCsv", () => {
  it("reads quoted cells with commas, quotes and line breaks, CRLF and a BOM", () => {
    const rows = parseCsv('﻿Name,Notes\r\n"Ali, Jr","said ""hi""\nthen left"\r\nSara,ok\r\n');
    expect(rows).toEqual([["Name", "Notes"], ["Ali, Jr", 'said "hi"\nthen left'], ["Sara", "ok"]]);
  });
  it("detects the semicolon and tab separators Excel uses in many regions", () => {
    expect(parseCsv("Name;Phone\nAli;5555 1234")).toEqual([["Name", "Phone"], ["Ali", "5555 1234"]]);
    expect(parseCsv("Name\tPhone\nAli\t5555 1234")).toEqual([["Name", "Phone"], ["Ali", "5555 1234"]]);
  });
  it("skips blank lines and keeps a last row with no trailing newline", () => {
    expect(parseCsv("A,B\n\n1,2\n\n3,4")).toEqual([["A", "B"], ["1", "2"], ["3", "4"]]);
  });
});

describe("rowsToClients", () => {
  it("understands English headers in any order and case", () => {
    const r = rowsToClients(parseCsv("PHONE,name,Source,Budget,Notes\n+974 5555 1234,Ali,Instagram,\"1,200,000\",call back"));
    expect(r.error).toBeUndefined();
    expect(r.clients).toEqual([{ name: "Ali", phone: "+974 5555 1234", whatsapp: "", email: "", source: "INSTAGRAM", interest: "", budget: 1200000, notes: "call back" }]);
    expect(r.recognised).toEqual(expect.arrayContaining(["name", "phone", "source", "budget", "notes"]));
  });

  it("understands Arabic headers and Arabic digits", () => {
    const r = rowsToClients(parseCsv("الاسم;الجوال;المصدر;الميزانية;ملاحظات\nعلي;٠٠٩٧٤٥٥٥٥١٢٣٤;توصية;٢٥٠٠٠٠٠;عميل جاد"));
    expect(r.error).toBeUndefined();
    expect(r.clients[0]).toMatchObject({ name: "علي", phone: "٠٠٩٧٤٥٥٥٥١٢٣٤", source: "REFERRAL", budget: 2500000, notes: "عميل جاد" });
  });

  it("explains itself when there is no name column or no rows", () => {
    expect(rowsToClients(parseCsv("Phone,Email\n5555 1234,a@b.co")).error).toMatch(/name column/i);
    expect(rowsToClients(parseCsv("Name,Phone")).error).toMatch(/no client rows/i);
  });
});

describe("guessSource", () => {
  it("maps the words people really type into a spreadsheet", () => {
    expect(guessSource("WhatsApp")).toBe("WHATSAPP");
    expect(guessSource("واتساب")).toBe("WHATSAPP");
    expect(guessSource("Phone call")).toBe("PHONE_CALL");
    expect(guessSource("walk-in")).toBe("WALK_IN");
    expect(guessSource("Referral from a friend")).toBe("REFERRAL");
    expect(guessSource("instagram DM")).toBe("INSTAGRAM");
    expect(guessSource("Facebook")).toBe("FACEBOOK");
    expect(guessSource("Bayut")).toBe("OTHER_PORTAL");
    expect(guessSource("Property Finder")).toBe("OTHER_PORTAL");
    expect(guessSource("some billboard")).toBe("OTHER");
    expect(guessSource("")).toBeUndefined();
    expect(guessSource(undefined)).toBeUndefined();
  });
});
