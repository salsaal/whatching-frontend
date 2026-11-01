// Decides when the WhatsApp flow editor may swap a loaded draft for the
// built-in starter, and when it may offer this browser's unsaved edits.
// Getting either wrong overwrites real flows, so the checks only match the
// exact shapes the backend and older builds created.

// The starters never had more than DEFAULT, OPT_IN and OPT_OUT.
const STARTER_MAX_NODES = 3;

type StarterNode = {
  data: { triggerKey?: string; blockType?: string };
};

type DraftLike = {
  updatedAt?: string;
  nodes?: unknown[];
};

const hasNode = (nodes: StarterNode[], triggerKey: string, blockType: string) =>
  nodes.some(
    (node) =>
      node.data.triggerKey === triggerKey && node.data.blockType === blockType
  );

/** The backend's empty canvas: DEFAULT, OPT_IN and OPT_OUT text blocks. */
export const isBackendDefaultCanvas = (
  nodes: StarterNode[],
  edges: unknown[]
) =>
  nodes.length <= STARTER_MAX_NODES &&
  edges.length === 0 &&
  hasNode(nodes, "DEFAULT", "text") &&
  hasNode(nodes, "OPT_IN", "text") &&
  hasNode(nodes, "OPT_OUT", "text");

/**
 * The old starter, whose DEFAULT block was a buttons block. A real flow can
 * also start with buttons, so size and wiring must match too.
 */
export const isLegacyButtonStarterCanvas = (
  nodes: StarterNode[],
  edges: unknown[]
) =>
  nodes.length <= STARTER_MAX_NODES &&
  edges.length === 0 &&
  hasNode(nodes, "DEFAULT", "buttons");

export const shouldReplaceWithStarter = (
  nodes: StarterNode[],
  edges: unknown[]
) =>
  isBackendDefaultCanvas(nodes, edges) ||
  isLegacyButtonStarterCanvas(nodes, edges);

/** This browser's copy of edits that hadn't reached the server yet. */
export type CachedDraft<T> = {
  draft: T;
  /** The server draftRevision those edits were made on top of. */
  baseRevision: number;
  savedAt: string;
};

/** Reads the cache; anything in an older shape is treated as absent. */
export const parseCachedDraft = <T extends DraftLike>(
  raw: string | null | undefined
): CachedDraft<T> | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CachedDraft<T>> | null;
    if (
      !value ||
      typeof value !== "object" ||
      !value.draft ||
      typeof value.draft !== "object" ||
      typeof value.baseRevision !== "number" ||
      typeof value.savedAt !== "string"
    ) {
      return null;
    }
    return value as CachedDraft<T>;
  } catch {
    return null;
  }
};

/**
 * Offer the cached edits only when they differ from the server draft and
 * were made on the revision the server still has. If anyone saved since,
 * restoring them would silently undo that save. No clock comparison: client
 * clocks can't be trusted.
 */
export const shouldOfferCachedDraft = <T extends DraftLike>(
  cached: CachedDraft<T> | null,
  serverRevision: number | undefined,
  serverDraft: T | null | undefined
) =>
  Boolean(
    cached &&
      typeof serverRevision === "number" &&
      cached.baseRevision === serverRevision &&
      (!serverDraft ||
        draftSignature(cached.draft) !== draftSignature(serverDraft))
  );

/** Compares drafts while ignoring the save timestamp. */
export const draftSignature = (draft: object) =>
  JSON.stringify({ ...draft, updatedAt: undefined });
