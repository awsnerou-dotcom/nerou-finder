import { describe, it, expect } from "vitest";
import { diffCollection, RowSnapshot, PendingSnapshotUpdate } from "../../server-db.js";

interface Item {
  id: string;
  value: string;
}

describe("diffCollection", () => {
  it("upserts every item when the snapshot starts empty", () => {
    const ops: any[] = [];
    const pending: PendingSnapshotUpdate[] = [];
    const prev: RowSnapshot = new Map();
    const items: Item[] = [
      { id: "a", value: "1" },
      { id: "b", value: "2" },
    ];
    const upserted: Item[] = [];

    diffCollection(
      ops,
      pending,
      prev,
      items,
      (item) => {
        upserted.push(item);
        return {} as any;
      },
      () => {
        throw new Error("should not delete anything here");
      }
    );

    expect(upserted).toEqual(items);
    expect(ops.length).toBe(2);
    expect(pending.length).toBe(2);
  });

  it("skips items whose serialized value is unchanged since the last snapshot", () => {
    const item: Item = { id: "a", value: "1" };
    const prev: RowSnapshot = new Map([["a", JSON.stringify(item)]]);
    const ops: any[] = [];
    const pending: PendingSnapshotUpdate[] = [];
    let upsertCalls = 0;

    diffCollection(
      ops,
      pending,
      prev,
      [item],
      () => {
        upsertCalls++;
        return {} as any;
      },
      () => {
        throw new Error("should not delete anything here");
      }
    );

    expect(upsertCalls).toBe(0);
    expect(ops.length).toBe(0);
    expect(pending.length).toBe(0);
  });

  it("upserts an item whose content actually changed", () => {
    const prev: RowSnapshot = new Map([["a", JSON.stringify({ id: "a", value: "old" })]]);
    const ops: any[] = [];
    const pending: PendingSnapshotUpdate[] = [];
    const updated: Item = { id: "a", value: "new" };

    diffCollection(
      ops,
      pending,
      prev,
      [updated],
      (item) => item as any,
      () => {
        throw new Error("should not delete anything here");
      }
    );

    expect(ops).toEqual([updated]);
    expect(pending).toEqual([{ map: prev, id: "a", json: JSON.stringify(updated) }]);
  });

  it("deletes ids that are no longer present in the new item list", () => {
    const prev: RowSnapshot = new Map([
      ["a", JSON.stringify({ id: "a" })],
      ["b", JSON.stringify({ id: "b" })],
    ]);
    const ops: any[] = [];
    const pending: PendingSnapshotUpdate[] = [];
    let deletedIds: string[] = [];

    diffCollection(
      ops,
      pending,
      prev,
      [{ id: "a" }],
      () => ({} as any),
      (ids) => {
        deletedIds = ids;
        return {} as any;
      }
    );

    expect(deletedIds).toEqual(["b"]);
    expect(pending).toContainEqual({ map: prev, id: "b", json: null });
  });

  it("never mutates the snapshot map directly - only records intent in `pending`", () => {
    // This is the core data-safety invariant of the sync engine: if diffCollection mutated
    // `prev` eagerly, a Postgres transaction that fails downstream would still leave the
    // snapshot claiming the change was synced, and the next write would never retry it.
    const prev: RowSnapshot = new Map([["a", JSON.stringify({ id: "a", value: "old" })]]);
    const originalSize = prev.size;

    diffCollection(
      [],
      [],
      prev,
      [{ id: "a", value: "new" }, { id: "c", value: "3" }],
      (item) => item as any,
      () => ({} as any)
    );

    expect(prev.size).toBe(originalSize);
    expect(prev.get("a")).toBe(JSON.stringify({ id: "a", value: "old" }));
    expect(prev.has("c")).toBe(false);
  });

  it("applying `pending` after the fact reproduces the expected end state (simulates a successful sync)", () => {
    const prev: RowSnapshot = new Map([
      ["a", JSON.stringify({ id: "a", value: "old" })],
      ["b", JSON.stringify({ id: "b", value: "gone-soon" })],
    ]);
    const ops: any[] = [];
    const pending: PendingSnapshotUpdate[] = [];
    const nextItems: Item[] = [
      { id: "a", value: "new" },
      { id: "c", value: "brand-new" },
    ];

    diffCollection(ops, pending, prev, nextItems, (item) => item as any, (ids) => ids as any);

    // Simulate syncStateToDb committing `pending` after a successful transaction.
    for (const update of pending) {
      if (update.json === null) update.map.delete(update.id);
      else update.map.set(update.id, update.json);
    }

    expect(prev.get("a")).toBe(JSON.stringify({ id: "a", value: "new" }));
    expect(prev.get("c")).toBe(JSON.stringify({ id: "c", value: "brand-new" }));
    expect(prev.has("b")).toBe(false);
    expect(prev.size).toBe(2);
  });
});
