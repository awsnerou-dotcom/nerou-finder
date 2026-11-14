import { describe, it, expect } from "vitest";
import { parseXml, XmlError } from "../../src/lib/xmlLite.js";
import { flattenRecord, readImportRecords, xmlTreeToRecords } from "../../src/lib/listingImport.js";

describe("reading XML", () => {
  it("reads elements, repeated elements, attributes and text", () => {
    const t = parseXml(`<?xml version="1.0"?><list count="2"><property id="7"><ref>A1</ref><price><yearly>84000</yearly></price></property><property id="8"><ref>A2</ref></property></list>`) as any;
    expect(t.list["@_count"]).toBe("2");
    expect(t.list.property).toHaveLength(2);
    expect(t.list.property[0]).toMatchObject({ "@_id": "7", ref: "A1", price: { yearly: "84000" } });
  });

  it("keeps the text of an element that also has attributes, and reads self-closing tags", () => {
    const t = parseXml(`<a><url watermark="no">https://x.qa/1.jpg</url><empty/><flag on="1"/></a>`) as any;
    expect(t.a.url).toEqual({ "@_watermark": "no", "#text": "https://x.qa/1.jpg" });
    expect(t.a.empty).toBe("");
    expect(t.a.flag).toEqual({ "@_on": "1" });
  });

  it("decodes entities and keeps CDATA literal, including Arabic text", () => {
    const t = parseXml(`<a><t>Tom &amp; Jerry &lt;3 &#1593;&#x631;&#1576;&#1610;</t><d><![CDATA[Bright <b>flat</b> & quiet]]></d></a>`) as any;
    expect(t.a.t).toBe("Tom & Jerry <3 عربي");
    expect(t.a.d).toBe("Bright <b>flat</b> & quiet");
  });

  it("ignores comments and the XML declaration", () => {
    expect(parseXml(`<?xml version="1.0"?><!-- a comment --><a><b>1</b></a>`)).toEqual({ a: { b: "1" } });
  });

  it("refuses a DOCTYPE, so no custom or external entity can ever be defined", () => {
    expect(() => parseXml(`<!DOCTYPE a [<!ENTITY x "boom">]><a>&x;</a>`)).toThrow(/DOCTYPE/);
  });

  it("never expands an entity it does not know", () => {
    expect((parseXml(`<a>&x;&amp;</a>`) as any).a).toBe("&x;&");
  });

  it("rejects malformed input with a plain error", () => {
    for (const bad of ["<a><b></a>", "<a>", "</a>", "<a><b>1</c></a>", "<a b=></a>x", "", "just text", "<1a></1a>", "<a><!-- no end </a>"]) {
      expect(() => parseXml(bad), bad).toThrow(XmlError);
    }
  });

  it("refuses a file that is too big or nested too deeply", () => {
    expect(() => parseXml(`<a>${"x".repeat(2 * 1024 * 1024 + 1)}</a>`)).toThrow(/too large/);
    expect(() => parseXml("<a>".repeat(40) + "</a>".repeat(40))).toThrow(/deeply/);
    expect(() => parseXml("<r>" + "<i/>".repeat(60_100) + "</r>")).toThrow(/too many/);
  });
});

describe("a Property Finder style feed, end to end", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<list last_update="2026-11-14 10:00:00" listing_count="2">
  <property last_update="2026-11-14 09:00:00" id="1001">
    <reference_number><![CDATA[PF-1001]]></reference_number>
    <offering_type>RR</offering_type>
    <property_type>AP</property_type>
    <price><yearly>96000</yearly></price>
    <city>Doha</city>
    <community>Lusail</community>
    <title_en><![CDATA[Marina view 2BR]]></title_en>
    <description_en><![CDATA[Bright flat. Call +974 5551 2345]]></description_en>
    <size>120</size>
    <bedroom>2</bedroom>
    <bathroom>2</bathroom>
    <photo>
      <url last_updated="2026-11-01" watermark="no">https://cdn.example.com/1.jpg</url>
      <url>https://cdn.example.com/2.jpg</url>
    </photo>
  </property>
  <property id="1002"><reference_number>PF-1002</reference_number><offering_type>RS</offering_type><property_type>VH</property_type><price><sale>4500000</sale></price><community>West Bay</community><size>450</size><bedroom>5</bedroom><bathroom>6</bathroom></property>
</list>`;
  const places = [
    { id: "m-doha", name: "Doha", nameAr: "الدوحة", type: "MUNICIPALITY" },
    { id: "a-lusail", name: "Lusail", nameAr: "لوسيل", type: "AREA", parentId: "m-doha" },
    { id: "a-westbay", name: "West Bay", nameAr: "الخليج الغربي", type: "AREA", parentId: "m-doha" }
  ];

  it("turns the feed into listings with prices, places, photos and a cleaned description", () => {
    const recs = xmlTreeToRecords(parseXml(xml));
    expect(recs).toHaveLength(2);
    expect(Object.keys(flattenRecord(recs[0]))).toEqual(expect.arrayContaining(["reference_number", "price_yearly", "photo_url"]));
    const r = readImportRecords(recs, places, "xml");
    expect(r.skipped).toEqual([]);
    expect(r.listings[0]).toMatchObject({ externalId: "PF-1001", transactionType: "FOR_RENT", propertyType: "APARTMENT", price: 8000, district: "Lusail", city: "Doha", area: 120, bedrooms: 2, bathrooms: 2, complete: true });
    expect(r.listings[0].images).toEqual(["https://cdn.example.com/1.jpg", "https://cdn.example.com/2.jpg"]);
    expect(r.listings[0].description).not.toMatch(/5551/);
    expect(r.listings[1]).toMatchObject({ externalId: "PF-1002", transactionType: "FOR_SALE", propertyType: "VILLA", price: 4_500_000, district: "West Bay", complete: true });
  });
});
