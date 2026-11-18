// One unit offered two ways: for sale AND for rent. Instead of typing the whole listing a second time, the agent gives the other price and
// the platform copies everything else (photos, description, size, features, location) into a second listing, linked to the first. Each
// stays an ordinary listing, so search, the area pages, price reports and the market tools all keep working with one deal per listing.

import type { Property } from "../types.js";
import { ListingStatus, TransactionType, VerificationStatus } from "../types.js";

/** The other way a listing can be offered, or null when it has no other way (off-plan and land are sold, never also let). */
export function twinTransactionType(t: string): TransactionType | null {
  switch (t) {
    case TransactionType.FOR_SALE: return TransactionType.FOR_RENT;
    case TransactionType.FOR_RENT: return TransactionType.FOR_SALE;
    case TransactionType.COMMERCIAL_SALE: return TransactionType.COMMERCIAL_LEASE;
    case TransactionType.COMMERCIAL_LEASE: return TransactionType.COMMERCIAL_SALE;
    default: return null;
  }
}

export const isRentType = (t: string) => t === TransactionType.FOR_RENT || t === TransactionType.COMMERCIAL_LEASE;

/** What the agent may ask for. Returns an error message, or null when the request is fine. */
export function validateTwinRequest(source: Pick<Property, "transactionType" | "twinId">, body: { price?: unknown; rentalPeriod?: unknown }): string | null {
  if (source.twinId) return "This listing is already offered the other way too.";
  if (!twinTransactionType(String(source.transactionType))) return "This kind of listing cannot also be offered for sale or rent.";
  const price = Number(body.price);
  if (body.price === undefined || body.price === null || body.price === "" || !Number.isFinite(price) || price <= 0) return "Enter a valid price for the other offer.";
  if (price > 10_000_000_000) return "That price is too large.";
  if (body.rentalPeriod !== undefined && !["MONTHLY", "YEARLY", "WEEKLY", "DAILY"].includes(String(body.rentalPeriod))) return "The rental period must be monthly, yearly, weekly or daily.";
  return null;
}

/** Things that belong to one offer, not to the unit: they are not copied. */
const NOT_COPIED = [
  "views", "uniqueViews", "viewsByDay", "shareVisitsByDay", "recentViewers", "savedCount", "reportCount",
  "sourceFeedId", "externalListingId", "isFeedImported", "sourceFeedImageUrls", "importIncomplete", "importPhotos",
  "staleReminderSentDate", "staleAutoPausedFromStatus", "flaggedForReview", "flagReason", "flaggedDate", "lastVerifiedDate", "referenceNumber"
] as const;
/** Terms of a letting that make no sense on a sale. */
const RENT_ONLY = ["deposit", "cheques", "contractLength", "commissions", "rentalPeriod"] as const;
/** Terms of a sale that make no sense on a letting. */
const SALE_ONLY = ["tenureType", "paymentPlan"] as const;

export interface TwinInput {
  price: number;
  rentalPeriod?: "MONTHLY" | "YEARLY" | "WEEKLY" | "DAILY";
  id: string;
  listingId: string;
  now: Date;
}

/** The second listing for the same unit: everything copied, the other deal and price, a fresh history, linked to the first. */
export function buildTwin(source: Property, input: TwinInput): Property {
  const other = twinTransactionType(String(source.transactionType));
  if (!other) throw new Error("This listing has no other way to be offered.");
  const nowIso = input.now.toISOString();
  const published = source.listingStatus === ListingStatus.PUBLISHED;
  const copy: Record<string, unknown> = { ...source };
  for (const k of NOT_COPIED) delete copy[k];
  for (const k of isRentType(other) ? SALE_ONLY : RENT_ONLY) delete copy[k];
  return {
    ...(copy as unknown as Property),
    id: input.id,
    listingId: input.listingId,
    transactionType: other,
    price: input.price,
    rentalPeriod: isRentType(other) ? input.rentalPeriod || "MONTHLY" : undefined,
    // an unpublished source (draft, paused, sold) gives an unpublished twin: the agent publishes each deliberately
    listingStatus: published ? ListingStatus.PUBLISHED : ListingStatus.DRAFT,
    verificationStatus: published ? VerificationStatus.APPROVED : VerificationStatus.PENDING,
    statusChangedDate: nowIso,
    createdDate: nowIso,
    updatedDate: nowIso,
    lastConfirmedAvailableDate: nowIso,
    priceHistory: [{ price: input.price, date: nowIso.slice(0, 10) }],
    twinId: source.id
  };
}
