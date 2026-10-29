import { describe, expect, it } from "vitest";

import {
  draftSignature,
  pickDraftToLoad,
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

describe("pickDraftToLoad", () => {
  const draft = (count: number, updatedAt: string) => ({
    updatedAt,
    nodes: Array.from({ length: count }, () => ({}))
  });

  it("never lets a starter-sized cache shadow a bigger backend draft", () => {
    const backend = draft(32, "2026-10-01T00:00:00Z");
    const cached = draft(3, "2026-10-29T00:00:00Z");
    expect(pickDraftToLoad(backend, cached)).toBe(backend);
  });

  it("prefers a newer cache with real edits", () => {
    const backend = draft(32, "2026-10-01T00:00:00Z");
    const cached = draft(30, "2026-10-29T00:00:00Z");
    expect(pickDraftToLoad(backend, cached)).toBe(cached);
  });

  it("falls back to whichever exists", () => {
    const backend = draft(5, "2026-10-01T00:00:00Z");
    expect(pickDraftToLoad(backend, null)).toBe(backend);
    expect(pickDraftToLoad(null, backend)).toBe(backend);
  });
});

describe("draftSignature", () => {
  it("ignores the save timestamp", () => {
    expect(
      draftSignature({ nodes: [1], updatedAt: "2026-10-01T00:00:00Z" })
    ).toBe(draftSignature({ nodes: [1], updatedAt: "2026-10-29T00:00:00Z" }));
  });
});
