import { describe, expect, it } from "vitest";

import {
  draftSignature,
  parseCachedDraft,
  shouldOfferCachedDraft,
  shouldReplaceWithStarter
} from "./flowStarter";

const node = (triggerKey: string, blockType: string) => ({
  data: { triggerKey, blockType }
});

describe("shouldReplaceWithStarter", () => {
  it("keeps a real flow whose DEFAULT block is buttons", () => {
    const nodes = [
      node("DEFAULT", "buttons"),
      node("OPT_IN", "text"),
      node("OPT_OUT", "text"),
      ...Array.from({ length: 9 }, (_, index) => node(`STEP_${index}`, "text"))
    ];
    const edges = nodes.slice(1).map((_, index) => ({ id: `e${index}` }));
    expect(nodes.length).toBeGreaterThanOrEqual(10);
    expect(shouldReplaceWithStarter(nodes, edges)).toBe(false);
  });

  it("keeps a small buttons-DEFAULT draft once it has connections", () => {
    const nodes = [node("DEFAULT", "buttons"), node("NEXT", "text")];
    expect(shouldReplaceWithStarter(nodes, [{ id: "e1" }])).toBe(false);
  });

  it("still replaces the legacy 3-block buttons starter", () => {
    const nodes = [
      node("DEFAULT", "buttons"),
      node("OPT_IN", "text"),
      node("OPT_OUT", "text")
    ];
    expect(shouldReplaceWithStarter(nodes, [])).toBe(true);
  });

  it("still replaces the backend's empty text canvas", () => {
    const nodes = [
      node("DEFAULT", "text"),
      node("OPT_IN", "text"),
      node("OPT_OUT", "text")
    ];
    expect(shouldReplaceWithStarter(nodes, [])).toBe(true);
  });
});

describe("parseCachedDraft", () => {
  it("reads the { draft, baseRevision, savedAt } shape", () => {
    const value = {
      draft: { nodes: [1] },
      baseRevision: 4,
      savedAt: "2026-11-01T07:24:00Z"
    };
    expect(parseCachedDraft(JSON.stringify(value))).toEqual(value);
  });

  it("drops the older bare-draft cache and anything unreadable", () => {
    expect(
      parseCachedDraft(
        JSON.stringify({ nodes: [1], updatedAt: "2026-10-29T00:00:00Z" })
      )
    ).toBeNull();
    expect(parseCachedDraft("{not json")).toBeNull();
    expect(parseCachedDraft(null)).toBeNull();
  });
});

describe("shouldOfferCachedDraft", () => {
  const server = { nodes: [1, 2], updatedAt: "2026-10-01T00:00:00Z" };
  const cached = (baseRevision: number, nodes = [1, 2, 3]) => ({
    draft: { nodes, updatedAt: "2026-11-01T00:00:00Z" },
    baseRevision,
    savedAt: "2026-11-01T07:24:00Z"
  });

  it("offers edits made on the revision the server still has", () => {
    expect(shouldOfferCachedDraft(cached(7), 7, server)).toBe(true);
  });

  it("drops edits made before someone else saved", () => {
    expect(shouldOfferCachedDraft(cached(6), 7, server)).toBe(false);
  });

  it("drops a cache that matches the server draft", () => {
    expect(shouldOfferCachedDraft(cached(7, [1, 2]), 7, server)).toBe(false);
  });

  it("drops it when the server sends no revision", () => {
    expect(shouldOfferCachedDraft(cached(7), undefined, server)).toBe(false);
    expect(shouldOfferCachedDraft(null, 7, server)).toBe(false);
  });
});

describe("draftSignature", () => {
  it("ignores the save timestamp", () => {
    expect(
      draftSignature({ nodes: [1], updatedAt: "2026-10-01T00:00:00Z" })
    ).toBe(draftSignature({ nodes: [1], updatedAt: "2026-10-29T00:00:00Z" }));
  });
});
