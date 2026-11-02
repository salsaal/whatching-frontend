// Pure helpers for the Instagram flow editor: loading a saved draft into
// editor blocks and wires, turning them back into the draft the backend
// expects, each block's outputs, and the words the editor shows.
import type { Edge, Node } from "@xyflow/react";

import {
  InstagramBlockType,
  InstagramCanvasAction,
  InstagramCanvasContent,
  InstagramCanvasLiveInfo,
  InstagramCanvasNode,
  InstagramCanvasState,
  InstagramDraftChanges,
  InstagramFlowEntryPoint,
  InstagramGenericCard,
  InstagramQuickReply,
  InstagramTemplateButton,
  InstagramTriggerType
} from "@/client-api/types/instagram.type";
import type { FlowStatus } from "@/lib/flowBuilder";

// Meta's limits, as the backend checks them.
export const IG_TEXT_MAX = 1000;
export const IG_BUTTONS_TEXT_MAX = 640;
export const IG_QUICK_REPLIES_MAX = 13;
export const IG_OPTION_LABEL_MAX = 20;
export const IG_BUTTONS_MAX = 3;
export const IG_CARDS_MAX = 10;
export const IG_CARD_TITLE_MAX = 80;
export const IG_CARD_SUBTITLE_MAX = 80;
export const IG_KEYWORDS_MAX = 20;
export const IG_PAUSE_MAX_MINUTES = 7 * 24 * 60;

/** The handle of a block's "Then" step. */
export const NEXT_HANDLE = "next";

/** Blocks that carry on to a "Then" step without waiting for a reply. */
export const CHAINABLE_BLOCK_TYPES = new Set<InstagramBlockType>([
  "send_text",
  "send_image",
  "send_video",
  "tag_subscriber"
]);

export const FOLLOW_OUTPUTS = [
  { id: "follows", label: "Follows you" },
  { id: "not_follows", label: "Doesn't follow you" },
  { id: "unknown", label: "Couldn't check" }
] as const;

/** How a block starts. Undefined: only from other blocks. */
export type IgStart = "default" | "first_dm" | "keyword" | "story_reply";

export interface IgNodeData extends Record<string, unknown> {
  /** The block's name (saved as `name`). */
  label: string;
  blockType: InstagramBlockType;
  /** Set once when the block is made; never shown or derived from the name. */
  triggerKey: string;
  triggerType?: IgStart | "comment_private_reply_opened";
  keywords: string[];
  content: InstagramCanvasContent;
  actions: InstagramCanvasAction[];
  metadata?: Record<string, unknown>;
  // Display only: worked out by the editor, never saved.
  /** Target block name for each wired output, by handle. */
  targets?: Record<string, string>;
  issueSeverity?: "error" | "warning";
  /** Changed since the version customers get. */
  changed?: boolean;
}

export type IgFlowNode = Node<IgNodeData, "instagramBlock">;

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

const randomPart = (length: number) =>
  Math.random()
    .toString(36)
    .slice(2, 2 + length)
    .padEnd(length, "0");

export const newNodeId = () =>
  `ig_node_${Date.now().toString(36)}${randomPart(5)}`;

export const newEdgeId = () =>
  `ig_edge_${Date.now().toString(36)}${randomPart(5)}`;

/** An internal key like "IG_K3X9Q2AB", unique in this flow. */
export const newTriggerKey = (used: Iterable<string> = []) => {
  const taken = new Set(used);
  let key = "";
  do {
    key = `IG_${randomPart(8).toUpperCase()}`;
  } while (taken.has(key));
  return key;
};

/** An option id like "opt_k3x9q2", unique among `used`. */
export const newOptionId = (used: Iterable<string> = []) => {
  const taken = new Set(used);
  let id = "";
  do {
    id = `opt_${randomPart(6)}`;
  } while (taken.has(id));
  return id;
};

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeKey = (value: unknown) =>
  trimmed(value).replace(/\s+/g, " ").toUpperCase();

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export const BLOCK_LABELS: Record<InstagramBlockType, string> = {
  send_text: "Message",
  send_image: "Image",
  send_video: "Video",
  quick_replies: "Quick replies",
  button_template: "Buttons",
  generic_template: "Carousel",
  follow_condition: "Check if they follow you",
  tag_subscriber: "Add tag",
  handoff_to_agent: "Hand to a person",
  pause_automation: "Pause automation",
  end_flow: "End conversation"
};

export const START_LABELS: Record<IgStart, string> = {
  default: "Main menu",
  first_dm: "Welcome",
  keyword: "Keyword",
  story_reply: "Story reply"
};

export const startOf = (data: Pick<IgNodeData, "triggerType">) =>
  data.triggerType && data.triggerType in START_LABELS
    ? (data.triggerType as IgStart)
    : undefined;

export const isMainMenu = (data: Pick<IgNodeData, "triggerType">) =>
  data.triggerType === "default";

/** "Message", then "Message 2", "Message 3"…: the first name not in use. */
export const nextBlockName = (
  blockType: InstagramBlockType,
  nodes: Array<{ data: { label: string } }>
) => {
  const base = BLOCK_LABELS[blockType];
  const used = new Set(nodes.map((node) => node.data.label.trim()));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
};

const makeQuickReply = (label: string, used: string[]): InstagramQuickReply => {
  const id = newOptionId(used);
  used.push(id);
  return { actionId: id, replyId: id, label, contentType: "text" };
};

const makeButton = (label: string, used: string[]): InstagramTemplateButton => {
  const id = newOptionId(used);
  used.push(id);
  return { actionId: id, replyId: id, type: "postback", label };
};

export const makeOption = (
  blockType: InstagramBlockType,
  label: string,
  used: string[]
) =>
  blockType === "quick_replies"
    ? makeQuickReply(label, used)
    : makeButton(label, used);

export const makeCard = (
  index: number,
  used: string[] = []
): InstagramGenericCard => ({
  title: `Card ${index + 1}`,
  subtitle: "",
  mediaType: "image",
  buttons: [makeButton("Learn more", used)]
});

export const defaultContent = (
  blockType: InstagramBlockType
): InstagramCanvasContent => {
  const used: string[] = [];
  switch (blockType) {
    case "send_text":
      return { text: "Write your message here." };
    case "quick_replies":
      return {
        text: "What would you like to do?",
        quickReplies: [
          makeQuickReply("View products", used),
          makeQuickReply("Talk to us", used)
        ]
      };
    case "button_template":
      return {
        text: "Choose an option:",
        buttons: [makeButton("Option 1", used)]
      };
    case "generic_template":
      return { cards: [makeCard(0, used)] };
    case "tag_subscriber":
      return { tags: [] };
    case "pause_automation":
      return { minutes: 60 };
    case "handoff_to_agent":
      return { reason: "" };
    default:
      return {};
  }
};

// ---------------------------------------------------------------------------
// Options: quick replies, buttons and carousel buttons
// ---------------------------------------------------------------------------

type OptionRecord = Record<string, unknown>;

const isUrlButton = (button: OptionRecord) =>
  String(button.type || (button.url ? "web_url" : "postback")) === "web_url";

/**
 * Applies `visit` to every option (quick reply, button, carousel button)
 * of a block, keeping the rest of the content as it is.
 */
const mapOptions = (
  blockType: InstagramBlockType,
  content: InstagramCanvasContent,
  visit: (option: OptionRecord, isUrl: boolean) => OptionRecord
): InstagramCanvasContent => {
  if (blockType === "quick_replies" && Array.isArray(content.quickReplies)) {
    return {
      ...content,
      quickReplies: content.quickReplies.map(
        (reply) => visit(reply as OptionRecord, false) as InstagramQuickReply
      )
    };
  }
  if (blockType === "button_template" && Array.isArray(content.buttons)) {
    return {
      ...content,
      buttons: content.buttons.map(
        (button) =>
          visit(
            button as OptionRecord,
            isUrlButton(button as OptionRecord)
          ) as InstagramTemplateButton
      )
    };
  }
  if (blockType === "generic_template" && Array.isArray(content.cards)) {
    return {
      ...content,
      cards: content.cards.map((card) =>
        Array.isArray(card.buttons)
          ? {
              ...card,
              buttons: card.buttons.map(
                (button) =>
                  visit(
                    button as OptionRecord,
                    isUrlButton(button as OptionRecord)
                  ) as InstagramTemplateButton
              )
            }
          : card
      )
    };
  }
  return content;
};

/**
 * Gives every option a stable actionId (its wire leaves from it) and every
 * answer a replyId. Existing values are kept. An option saved before ids
 * were stored takes its replyId as actionId, which is the handle its old
 * wire used. A repeated id gets a new one: the first copy keeps the wire.
 */
export const assignOptionIds = (
  blockType: InstagramBlockType,
  content: InstagramCanvasContent
): InstagramCanvasContent => {
  const reserved = new Set<string>();
  mapOptions(blockType, content, (option) => {
    [option.actionId, option.replyId, option.payload].forEach((value) => {
      if (trimmed(value)) reserved.add(trimmed(value));
    });
    return option;
  });

  const usedActionIds = new Set<string>();
  const usedReplyIds = new Set<string>();
  const fresh = () => {
    const id = newOptionId(reserved);
    reserved.add(id);
    return id;
  };
  return mapOptions(blockType, content, (option, isUrl) => {
    const next: OptionRecord = { ...option };
    let actionId =
      trimmed(option.actionId) ||
      trimmed(option.replyId) ||
      trimmed(option.payload);
    if (!actionId || usedActionIds.has(actionId)) actionId = fresh();
    usedActionIds.add(actionId);
    next.actionId = actionId;

    if (!isUrl) {
      let replyId = trimmed(option.replyId) || trimmed(option.payload);
      if (!replyId || usedReplyIds.has(replyId)) {
        replyId = usedReplyIds.has(actionId) ? fresh() : actionId;
      }
      usedReplyIds.add(replyId);
      next.replyId = replyId;
    }
    return next;
  });
};

/**
 * A copy of a block's content for "Duplicate": every option gets new ids
 * (two blocks answering the same reply id would clash), nothing is wired.
 */
export const cloneContent = (
  blockType: InstagramBlockType,
  content: InstagramCanvasContent
): InstagramCanvasContent => {
  const copied = JSON.parse(JSON.stringify(content)) as InstagramCanvasContent;
  return assignOptionIds(
    blockType,
    mapOptions(blockType, copied, (option) => ({
      ...option,
      actionId: undefined,
      replyId: undefined,
      payload: undefined
    }))
  );
};

/** The actions behind a block's outputs, derived from its content. */
export const deriveActions = (
  blockType: InstagramBlockType,
  content: InstagramCanvasContent
): InstagramCanvasAction[] => {
  if (blockType === "follow_condition") {
    return FOLLOW_OUTPUTS.map((output) => ({
      actionId: output.id,
      type: "go_to_node" as const,
      label: output.label,
      condition: output.id,
      metadata: { condition: output.id }
    }));
  }

  const actions: InstagramCanvasAction[] = [];
  const add = (option: OptionRecord, metadata: Record<string, unknown>) => {
    const actionId = trimmed(option.actionId);
    if (!actionId) return;
    const label = trimmed(option.label) || trimmed(option.title);
    if (isUrlButton(option)) {
      actions.push({
        actionId,
        type: "open_url",
        label,
        url: trimmed(option.url),
        metadata
      });
      return;
    }
    const replyId = trimmed(option.replyId) || trimmed(option.payload);
    if (!replyId) return;
    actions.push({
      actionId,
      type: "go_to_node",
      label: label || replyId,
      replyId,
      metadata
    });
  };

  if (blockType === "quick_replies") {
    (content.quickReplies || []).forEach((reply) =>
      add(
        { ...(reply as OptionRecord), type: "postback" },
        { contentType: reply.contentType || "text" }
      )
    );
  }
  if (blockType === "button_template") {
    (content.buttons || []).forEach((button) =>
      add(button as OptionRecord, {})
    );
  }
  if (blockType === "generic_template") {
    (content.cards || []).forEach((card, cardIndex) =>
      (card.buttons || []).forEach((button) =>
        add(button as OptionRecord, { cardIndex })
      )
    );
  }
  return actions;
};

/** One output of a block: a wire can leave from each, except websites. */
export type IgOutput = {
  /** The handle id. */
  id: string;
  label: string;
  kind: "next" | "option" | "url" | "follow";
  /** The carousel card it is on. */
  group?: string;
  cardIndex?: number;
  url?: string;
  /** Leading nowhere is fine. */
  optional?: boolean;
};

export const getOutputs = (
  data: Pick<IgNodeData, "blockType" | "content">
): IgOutput[] => {
  const { blockType, content } = data;
  if (CHAINABLE_BLOCK_TYPES.has(blockType)) {
    return [{ id: NEXT_HANDLE, label: "Then", kind: "next", optional: true }];
  }
  if (blockType === "follow_condition") {
    return FOLLOW_OUTPUTS.map((output) => ({
      id: output.id,
      label: output.label,
      kind: "follow" as const,
      optional: output.id === "unknown"
    }));
  }
  const fromButton = (
    button: InstagramTemplateButton,
    fallback: string,
    extra: Partial<IgOutput> = {}
  ): IgOutput | null => {
    const id = trimmed(button.actionId);
    if (!id) return null;
    const url = isUrlButton(button as OptionRecord);
    return {
      id,
      label: trimmed(button.label) || trimmed(button.title) || fallback,
      kind: url ? "url" : "option",
      url: url ? trimmed(button.url) : undefined,
      ...extra
    };
  };
  if (blockType === "quick_replies") {
    return (content.quickReplies || []).flatMap((reply, index) => {
      const id = trimmed(reply.actionId);
      return id
        ? [
            {
              id,
              label:
                trimmed(reply.label) ||
                trimmed(reply.title) ||
                `Answer ${index + 1}`,
              kind: "option" as const
            }
          ]
        : [];
    });
  }
  if (blockType === "button_template") {
    return (content.buttons || []).flatMap((button, index) => {
      const output = fromButton(button, `Button ${index + 1}`);
      return output ? [output] : [];
    });
  }
  if (blockType === "generic_template") {
    return (content.cards || []).flatMap((card, cardIndex) =>
      (card.buttons || []).flatMap((button, index) => {
        const output = fromButton(button, `Button ${index + 1}`, {
          group: trimmed(card.title) || `Card ${cardIndex + 1}`,
          cardIndex
        });
        return output ? [output] : [];
      })
    );
  }
  return [];
};

/** Handles a wire can leave from: every output except website buttons. */
export const wireHandles = (data: Pick<IgNodeData, "blockType" | "content">) =>
  new Set(
    getOutputs(data)
      .filter((output) => output.kind !== "url")
      .map((output) => output.id)
  );

/** Labels typed more than once in a block, compared as people read them. */
export const matchText = (value: unknown) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** A label not used by another option in this block: "Option 3". */
export const nextOptionLabel = (labels: string[], base = "Option") => {
  const used = new Set(labels.map(matchText));
  let index = labels.length + 1;
  while (used.has(matchText(`${base} ${index}`))) index += 1;
  return `${base} ${index}`;
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const LEGACY_FOLLOW_KEYS: Record<string, string[]> = {
  follows: [
    "followsTriggerKey",
    "followTriggerKey",
    "whenFollowingTriggerKey",
    "followingTriggerKey",
    "trueTriggerKey"
  ],
  not_follows: [
    "notFollowsTriggerKey",
    "notFollowTriggerKey",
    "whenNotFollowingTriggerKey",
    "notFollowingTriggerKey",
    "falseTriggerKey"
  ],
  unknown: ["unknownTriggerKey", "fallbackTriggerKey"]
};
const LEGACY_FOLLOW_FIELDS = Object.values(LEGACY_FOLLOW_KEYS).flat();

const withoutLegacyFollowKeys = (content: InstagramCanvasContent) => {
  const next = { ...content };
  LEGACY_FOLLOW_FIELDS.forEach((key) => delete next[key]);
  return next;
};

// Saved nodes keep their fields under `data`; the applied version keeps
// them at the top level.
const rawData = (node: InstagramCanvasNode) => {
  const data = node.data || {};
  return {
    name: data.name || data.label || node.name || "",
    triggerType: data.triggerType || node.triggerType,
    triggerKey: data.triggerKey || node.triggerKey,
    keywords: data.keywords || node.keywords,
    blockType: data.blockType || node.blockType || "send_text",
    content: data.content || node.content || {},
    actions: data.actions || node.actions || [],
    metadata: data.metadata || node.metadata || {}
  };
};

const cleanKeywords = (keywords: unknown): string[] => {
  const seen = new Set<string>();
  return (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => trimmed(String(keyword ?? "")))
    .filter((keyword) => {
      const key = matchText(keyword);
      if (!key || keyword === "*" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * A saved draft (or the applied version) as editor blocks and wires. Fixes
 * what older drafts lack: internal keys, option ids, keyword lists and a
 * single main menu. Wires that start from an output the block doesn't have
 * are dropped.
 */
export const loadFlow = (
  state?: InstagramCanvasState | null
): { nodes: IgFlowNode[]; edges: Edge[] } => {
  const rawNodes = state?.nodes || [];
  const usedKeys = new Set<string>();
  const usedIds = new Set<string>();
  const savedActions = new Map<string, InstagramCanvasAction[]>();
  const defaultKey = normalizeKey(state?.defaultTriggerKey);
  const markedDefault = new Set<string>();

  const nodes: IgFlowNode[] = rawNodes.map((rawNode, index) => {
    const raw = rawData(rawNode);
    let id = trimmed(rawNode.id);
    if (!id || usedIds.has(id)) id = newNodeId();
    usedIds.add(id);

    const legacyKey = normalizeKey(raw.triggerKey);
    let triggerType = raw.triggerType as
      | IgNodeData["triggerType"]
      | "manual_start";
    if (triggerType === "manual_start") triggerType = undefined;
    // "*" meant "every story reply", not a key.
    let triggerKey = legacyKey && legacyKey !== "*" ? legacyKey : "";
    if (!triggerKey || usedKeys.has(triggerKey)) {
      triggerKey = newTriggerKey(usedKeys);
    }
    usedKeys.add(triggerKey);

    let keywords = cleanKeywords(raw.keywords);
    if (
      !keywords.length &&
      (triggerType === "keyword" || triggerType === "story_reply") &&
      legacyKey &&
      legacyKey !== "*"
    ) {
      // Older blocks kept their one keyword in the key.
      keywords = [legacyKey.toLowerCase()];
    }

    const blockType = raw.blockType as InstagramBlockType;
    const content = assignOptionIds(
      blockType,
      blockType === "generic_template" && Array.isArray(raw.content.cards)
        ? {
            ...raw.content,
            cards: raw.content.cards.map((card) => ({
              ...card,
              mediaType: card.mediaType || "image"
            }))
          }
        : raw.content
    );
    savedActions.set(id, raw.actions);
    // isDefault was the old start marker; the main menu is a start now.
    const metadata = { ...raw.metadata };
    if (metadata.isDefault) markedDefault.add(id);
    delete metadata.isDefault;

    return {
      id,
      type: "instagramBlock" as const,
      position: rawNode.position || {
        x: 120 + index * 80,
        y: 120 + index * 100
      },
      data: {
        label: trimmed(raw.name) || BLOCK_LABELS[blockType] || "Block",
        blockType,
        triggerKey,
        triggerType:
          triggerType === "default"
            ? undefined
            : (triggerType as IgNodeData["triggerType"]),
        keywords,
        content,
        actions: deriveActions(blockType, content),
        metadata
      }
    };
  });

  // Exactly one main menu: the block the draft names, else one marked as
  // the start, else the first block.
  if (nodes.length) {
    const rawById = new Map(
      rawNodes.map((node, index) => [nodes[index].id, rawData(node)])
    );
    const main =
      nodes.find(
        (node) =>
          defaultKey &&
          normalizeKey(rawById.get(node.id)?.triggerKey) === defaultKey
      ) ||
      nodes.find((node) => rawById.get(node.id)?.triggerType === "default") ||
      nodes.find((node) => markedDefault.has(node.id)) ||
      nodes[0];
    main.data.triggerType = "default";
    main.data.keywords = [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIdByKey = new Map<string, string>();
  rawNodes.forEach((rawNode, index) => {
    const key = normalizeKey(rawData(rawNode).triggerKey);
    if (key && !nodeIdByKey.has(key)) nodeIdByKey.set(key, nodes[index].id);
  });
  nodes.forEach((node) => {
    if (!nodeIdByKey.has(node.data.triggerKey)) {
      nodeIdByKey.set(node.data.triggerKey, node.id);
    }
  });

  const edges: Edge[] = [];
  const wired = new Set<string>();
  const addWire = (
    source: string,
    handle: string,
    target: string,
    id?: string
  ) => {
    const key = `${source}:${handle}`;
    if (wired.has(key) || !nodeById.has(target)) return;
    wired.add(key);
    edges.push({
      id: id || `ig_edge_${source}_${handle}`,
      source,
      sourceHandle: handle,
      target,
      targetHandle: "in",
      type: "smoothstep"
    });
  };

  (state?.edges || []).forEach((edge) => {
    const source = nodeById.get(edge.source);
    if (!source || !nodeById.has(edge.target)) return;
    const handles = wireHandles(source.data);
    let handle =
      trimmed(edge.sourceHandle) ||
      trimmed(edge.actionId) ||
      trimmed(edge.replyId);
    if (!handles.has(handle)) {
      // An older wire may name the option by its reply id.
      const option = source.data.actions.find(
        (action) => action.replyId && action.replyId === handle
      );
      handle = option?.actionId || handle;
    }
    if (handles.has(handle)) addWire(source.id, handle, edge.target, edge.id);
  });

  nodes.forEach((node) => {
    const handles = wireHandles(node.data);
    // Follower checks once kept their routes as keys in the content.
    if (node.data.blockType === "follow_condition") {
      Object.entries(LEGACY_FOLLOW_KEYS).forEach(([handle, fields]) => {
        const key = fields
          .map((field) => normalizeKey(node.data.content[field]))
          .find(Boolean);
        const target = key ? nodeIdByKey.get(key) : undefined;
        if (target) addWire(node.id, handle, target);
      });
      node.data.content = withoutLegacyFollowKeys(node.data.content);
    }
    // Saved targets without a wire get one, so the block shows where it goes.
    (savedActions.get(node.id) || []).forEach((action) => {
      const handle = trimmed(action.actionId);
      if (!handles.has(handle)) return;
      const target =
        (action.nextNodeId && nodeById.has(action.nextNodeId)
          ? action.nextNodeId
          : undefined) ||
        (action.nextTriggerKey
          ? nodeIdByKey.get(normalizeKey(action.nextTriggerKey))
          : undefined);
      if (target) addWire(node.id, handle, target);
    });
  });

  return { nodes, edges };
};

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/**
 * The draft as the backend stores it. Wires are the only record of where
 * outputs lead: actions never carry a target.
 */
export const buildDraftState = (
  nodes: IgFlowNode[],
  edges: Edge[]
): InstagramCanvasState => {
  const main = nodes.find((node) => isMainMenu(node.data)) || nodes[0];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();

  return {
    version: 1,
    defaultTriggerKey: main?.data.triggerKey || "",
    nodes: nodes.map((node) => {
      const start = node.id === main?.id ? "default" : node.data.triggerType;
      const content =
        node.data.blockType === "follow_condition"
          ? withoutLegacyFollowKeys(node.data.content)
          : node.data.content;
      const keywords =
        start === "keyword" || start === "story_reply"
          ? cleanKeywords(node.data.keywords)
          : undefined;
      return {
        id: node.id,
        type: "instagramBlock",
        position: { x: node.position.x, y: node.position.y },
        data: {
          name: node.data.label,
          blockType: node.data.blockType,
          triggerKey: node.data.triggerKey,
          ...(start ? { triggerType: start as InstagramTriggerType } : {}),
          ...(keywords ? { keywords } : {}),
          content,
          actions: deriveActions(node.data.blockType, content),
          metadata: node.data.metadata || {}
        }
      };
    }),
    edges: edges.flatMap((edge) => {
      const source = nodeById.get(edge.source);
      const handle = edge.sourceHandle || "";
      const key = `${edge.source}:${handle}`;
      if (
        !source ||
        !nodeById.has(edge.target) ||
        !wireHandles(source.data).has(handle) ||
        seen.has(key)
      ) {
        return [];
      }
      seen.add(key);
      return [
        {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: handle,
          targetHandle: "in",
          actionId: handle
        }
      ];
    })
  };
};

/** Compares drafts by content: the order of keys never differs. */
export const draftSignature = (draft: InstagramCanvasState) =>
  JSON.stringify(draft);

// ---------------------------------------------------------------------------
// Pause duration
// ---------------------------------------------------------------------------

export type PauseUnit = "minutes" | "hours" | "days";

export const PAUSE_UNIT_MINUTES: Record<PauseUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60
};

/** The largest unit that shows the pause as a whole number. */
export const pauseParts = (
  minutes: number,
  unit?: unknown
): { value: number; unit: PauseUnit } => {
  if (unit === "minutes" || unit === "hours" || unit === "days") {
    return { value: minutes / PAUSE_UNIT_MINUTES[unit], unit };
  }
  const best: PauseUnit =
    minutes > 0 && minutes % PAUSE_UNIT_MINUTES.days === 0
      ? "days"
      : minutes > 0 && minutes % PAUSE_UNIT_MINUTES.hours === 0
        ? "hours"
        : "minutes";
  return { value: minutes / PAUSE_UNIT_MINUTES[best], unit: best };
};

export const pauseMinutesOf = (content: InstagramCanvasContent) =>
  Number(content.minutes ?? content.pauseMinutes ?? 60);

export const formatPause = (minutes: number) => {
  const { value, unit } = pauseParts(minutes);
  const name =
    unit === "minutes" ? "minute" : unit === "hours" ? "hour" : "day";
  return `${value} ${name}${value === 1 ? "" : "s"}`;
};

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** Two lines about what the block sends or does, for the canvas. */
export const summarizeBlock = (
  data: Pick<IgNodeData, "blockType" | "content">
) => {
  const { blockType, content } = data;
  switch (blockType) {
    case "send_text":
    case "quick_replies":
    case "button_template":
      return trimmed(content.text) || "No message yet.";
    case "send_image":
    case "send_video":
      return (
        trimmed(content.mediaName) ||
        (content.mediaId
          ? `${BLOCK_LABELS[blockType]} chosen`
          : `No ${blockType === "send_image" ? "image" : "video"} chosen yet.`)
      );
    case "generic_template": {
      const cards = content.cards || [];
      const first = trimmed(cards[0]?.title);
      return `${cards.length} card${cards.length === 1 ? "" : "s"}${first ? ` · ${first}` : ""}`;
    }
    case "follow_condition":
      return "Followers and non-followers get different messages.";
    case "tag_subscriber": {
      const tags = (content.tags || []).filter(Boolean);
      return tags.length ? `Tags: ${tags.join(", ")}` : "No tag yet.";
    }
    case "pause_automation":
      return `Stops automated replies for ${formatPause(pauseMinutesOf(content))}.`;
    case "handoff_to_agent":
      return (
        trimmed(content.reason) || "Stops automation and alerts your team."
      );
    case "end_flow":
      return "Marks the chat as resolved.";
    default:
      return "";
  }
};

const quoteList = (words: string[]) =>
  words.map((word) => `"${word.toLowerCase()}"`).join(", ");

/** "hi, hello, menu or start". */
export const joinWithOr = (words: string[]) => {
  const list = words.map((word) => word.toLowerCase());
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} or ${list[list.length - 1]}`;
};

/** One line of a block's "Reached from" list. */
export const describeInstagramEntryPoint = (entry: InstagramFlowEntryPoint) => {
  switch (entry.kind) {
    case "start":
      return entry.greetings.length
        ? `Main menu: when someone says ${joinWithOr(entry.greetings)}`
        : "Main menu";
    case "welcome":
      return "First message from a new person";
    case "keyword":
      return `Messages containing ${quoteList(entry.keywords)}`;
    case "story_reply":
      return entry.keywords.length
        ? `Replies to your stories containing ${quoteList(entry.keywords)}`
        : "Replies to your stories";
    case "ai":
      return "AI replies can send people here";
    case "option":
      return entry.label
        ? `${entry.fromBlockName} › ${entry.label}`
        : entry.fromBlockName;
    case "next":
      return `Then, after ${entry.fromBlockName}`;
    case "follower_check":
      return `${entry.fromBlockName}: if the person ${entry.condition}`;
    default:
      return "Another part of your account";
  }
};

/**
 * The status pill, for the editor and the list cards. First match wins:
 * Paused (automation off), Draft (never applied), Ready (applied, switched
 * off), Active with pending changes, Active.
 */
export const getInstagramFlowStatus = ({
  automationEnabled,
  applied,
  isActive,
  pendingCount,
  username
}: {
  automationEnabled: boolean;
  applied: boolean;
  isActive: boolean;
  /** Pending changes on an applied flow; null or 0 for none. */
  pendingCount?: number | null;
  username?: string | null;
}): FlowStatus => {
  if (!automationEnabled) {
    return {
      tone: "paused",
      label: "Paused · automation is off",
      href: "/instagram?tab=settings"
    };
  }
  if (!applied) return { tone: "draft", label: "Draft" };
  if (!isActive) return { tone: "ready", label: "Ready · switched off" };
  if (pendingCount) {
    return {
      tone: "pending",
      label: `Active · ${pendingCount} pending change${pendingCount === 1 ? "" : "s"}`
    };
  }
  return {
    tone: "active",
    label: username ? `Active on @${username}` : "Active"
  };
};

/** The editor's status, from the flow's live info and change summary. */
export const getEditorFlowStatus = (
  live: InstagramCanvasLiveInfo | undefined,
  changes: InstagramDraftChanges | undefined
) =>
  getInstagramFlowStatus({
    automationEnabled: live ? live.automationEnabled !== false : true,
    applied: changes ? !changes.neverPublished : Boolean(live?.hasLiveVersion),
    isActive: Boolean(live?.isActive),
    pendingCount: changes?.hasUnpublishedChanges
      ? Math.max(1, changes.changedBlockCount + (changes.startChanged ? 1 : 0))
      : 0,
    username: live?.account?.username
  });
