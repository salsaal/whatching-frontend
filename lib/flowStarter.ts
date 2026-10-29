// Decides when the WhatsApp flow editor may swap a loaded draft for the
// built-in starter. Getting this wrong overwrites real flows, so the checks
// only match the exact shapes the backend and older builds created.

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

const draftTime = (draft: DraftLike) => {
  const value = draft?.updatedAt ? Date.parse(draft.updatedAt) : 0;
  return Number.isFinite(value) ? value : 0;
};

/**
 * The newer of the backend draft and this browser's cache, except that a
 * starter-sized cache (3 blocks or fewer) never shadows a bigger backend
 * draft: that cache most likely came from a starter swap, not a real edit.
 * Smaller caches from genuine deletions are still honoured otherwise.
 */
export const pickDraftToLoad = <T extends DraftLike>(
  backendDraft: T | null | undefined,
  cachedDraft: T | null | undefined
): T | null | undefined => {
  if (!cachedDraft) return backendDraft;
  if (!backendDraft) return cachedDraft;
  const cachedCount = cachedDraft.nodes?.length || 0;
  const backendCount = backendDraft.nodes?.length || 0;
  if (cachedCount <= STARTER_MAX_NODES && backendCount > STARTER_MAX_NODES) {
    return backendDraft;
  }
  return draftTime(cachedDraft) > draftTime(backendDraft)
    ? cachedDraft
    : backendDraft;
};

/** Compares drafts while ignoring the save timestamp. */
export const draftSignature = (draft: object) =>
  JSON.stringify({ ...draft, updatedAt: undefined });
