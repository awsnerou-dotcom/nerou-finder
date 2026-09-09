# Nerou Finder — Partner Feed Format (v1)

This document is for the technical team at a real-estate agency or developer that has
**already agreed** with Nerou Finder to share a live listings feed. It is handed out by a
Nerou Finder platform admin when setting up your organization's `FeedSource` — it is never
used to pull data from a company that hasn't agreed to this integration.

## How it works

1. You host a single HTTP(S) endpoint (`feedUrl`) that Nerou Finder's servers can reach.
2. That endpoint must return a **plain JSON array** (not XML, not CSV — see "Future
   enhancements" below) of listing objects in the shape described below.
3. A Nerou Finder platform admin registers your `feedUrl` against your organization's account.
4. Nerou Finder fetches and imports/updates your listings automatically every 6 hours, and a
   platform admin can also trigger an immediate one-off sync at any time.
5. Every sync is capped at the first 500 entries in the array as a safety limit against a
   runaway or malformed feed — if your feed regularly carries more than 500 active listings,
   let your Nerou Finder contact know.

## Response format

`GET <feedUrl>` must return `HTTP 200` with a `Content-Type` of `application/json` (or close
enough that the body parses as JSON) and a body that is a JSON array, e.g.:

```json
[
  {
    "externalId": "AFP-10293",
    "title": "Modern 2BR Apartment in Lusail Marina",
    "titleAr": "شقة عصرية غرفتين في مارينا لوسيل",
    "description": "A bright, fully-furnished two bedroom apartment with marina views...",
    "descriptionAr": "شقة مضيئة مفروشة بالكامل بغرفتين نوم مع إطلالة على المارينا...",
    "propertyType": "APARTMENT",
    "transactionType": "FOR_RENT",
    "price": 8500,
    "currency": "QAR",
    "area": 110,
    "bedrooms": 2,
    "bathrooms": 2,
    "city": "Lusail",
    "district": "Marina District",
    "images": [
      "https://cdn.example.com/listings/afp-10293/1.jpg",
      "https://cdn.example.com/listings/afp-10293/2.jpg"
    ],
    "agentName": "Fatima Al-Suwaidi",
    "agentEmail": "fatima@example-agency.qa",
    "agentPhone": "+974 5555 1234"
  }
]
```

## Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `externalId` | string | **Required** | Stable, unique identifier for this listing in your own system. This is the key Nerou Finder uses to match a re-synced entry back to the same listing (so it updates in place instead of duplicating). Never reuse an `externalId` for a different unit. |
| `title` | string | **Required** | English listing title. |
| `titleAr` | string | Optional | Arabic listing title. Falls back to `title` if omitted. |
| `description` | string | **Required** | English listing description. |
| `descriptionAr` | string | Optional | Arabic description. Falls back to `description` if omitted. |
| `propertyType` | string | **Required** | Must be one of the exact `PropertyType` values listed below. |
| `transactionType` | string | **Required** | Must be one of the exact `TransactionType` values listed below. |
| `price` | number | **Required** | Non-negative. |
| `currency` | string | Optional | Defaults to `"QAR"` if omitted. |
| `area` | number | **Required** | Unit size in square meters (sqm), non-negative. |
| `bedrooms` | number | **Required** | |
| `bathrooms` | number | **Required** | |
| `city` | string | **Required** | Must be a real Qatar municipality/city name (e.g. `"Doha"`, `"Lusail"`, `"Al Rayyan"`). |
| `district` | string | **Required** | Must be a real district/area name within that city (e.g. `"Pearl Qatar"`, `"West Bay"`, `"Marina District"`). |
| `images` | string[] | Optional | Publicly reachable image URLs. |
| `agentName` | string | Optional | Display name of the listing agent at your company. |
| `agentEmail` | string | Optional | If this doesn't match any existing Nerou Finder user's email, an agent account is created for them automatically under your organization, and their listings are attributed to them directly from the first sync (see below). |
| `agentPhone` | string | Optional | |

An entry missing any required field, or carrying an unrecognized `propertyType` /
`transactionType`, is skipped and counted as an error for that sync — it never aborts the
rest of the sync.

### Valid `propertyType` values

`APARTMENT`, `VILLA`, `TOWNHOUSE`, `PENTHOUSE`, `COMPOUND`, `STUDIO`, `ROOM`, `OFFICE`,
`RETAIL`, `SHOP`, `WAREHOUSE`, `BUILDING`, `LAND`, `HOTEL_APARTMENT`, `COMMERCIAL`,
`RESIDENTIAL`, `FARM`, `CHALET`, `OTHER`

### Valid `transactionType` values

`FOR_SALE`, `FOR_RENT`, `OFF_PLAN`, `COMMERCIAL_SALE`, `COMMERCIAL_LEASE`, `LAND_SALE`

## What happens to your listings on Nerou Finder

- A new `externalId` becomes a new, fully live (`PUBLISHED`) Property listing, attributed to
  your organization's account on the platform.
- An `externalId` Nerou Finder has already imported before is updated in place — title,
  price, description, images, etc. all refresh to match your feed, and a price change is
  recorded in that listing's price history.
- Listings are never duplicated across syncs.
- A listing's `agentEmail` determines who it's attributed to: if the agent already has a
  Nerou Finder account, their existing account is reused; otherwise one is created for them
  automatically (see below). Re-syncing an existing `externalId` with a different `agentEmail`
  reassigns that listing to the new agent, matching whatever your own system currently shows.

## Agent accounts

Setting up this feed means your organization is vouching for the agents named in it, the same
way any team you'd add manually to your Nerou Finder dashboard would be — so when an entry's
`agentEmail` doesn't match any existing account, one is created for them automatically under
your organization (not gated behind an acceptance step, since your organization has already
agreed to this integration on their behalf). They receive a real email with their login and a
temporary password, and are prompted to set their own password after first logging in. This
only ever happens once per email — every later sync reuses that same account.

## Future enhancements (not supported in v1)

CSV and XML feed formats are not supported yet — `feedUrl` must return JSON. This may be
added in a future version if there's demand.

---

Questions about this integration? Contact your Nerou Finder platform admin contact directly —
this document is only ever set up per-organization after a direct agreement, never
self-service.
