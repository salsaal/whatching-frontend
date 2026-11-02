import type { Edge, Node, NodeChange } from "@xyflow/react";

import {
  BotAction,
  BotActionType,
  BotBlockType,
  BotCanvasLiveInfo,
  BotCanvasNode,
  BotCanvasNodeContent,
  BotDraftChanges,
  BotFlowEntryPoint
} from "@/client-api/types/bot.type";
import type {
  BotFlowNodeData,
  BotFlowReactNode
} from "@/components/flows/BotFlowNode";

export type BuilderNodeData = BotFlowNodeData & {
  content: BotCanvasNodeContent;
  followUp?: BotCanvasNode["followUp"];
};
export type BuilderNode = BotFlowReactNode & { data: BuilderNodeData };

export type GenericCarouselCard = {
  title?: string;
  bodyText?: string;
  mediaType?: "image" | "document" | "video";
  mediaId?: string;
  mediaName?: string;
  buttons?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
export type ListRow = {
  id?: string;
  replyId?: string;
  actionId?: string;
  title?: string;
  label?: string;
  description?: string;
  type?: BotActionType;
  url?: string;
  [key: string]: unknown;
};
export type ListSection = {
  title?: string;
  rows?: ListRow[];
  [key: string]: unknown;
};

// WhatsApp's limits, as the backend checks them (characters as people see
// them: an emoji counts as 1).
export const REPLY_BUTTON_LABEL_MAX = 20;
export const LIST_ROW_TITLE_MAX = 24;
export const LIST_ROW_DESCRIPTION_MAX = 72;
export const LIST_ROW_ID_MAX = 200;
export const LIST_SECTION_TITLE_MAX = 24;
export const LIST_BUTTON_TEXT_MAX = 20;
export const LIST_MAX_SECTIONS = 10;
/** Across all sections, not per section. */
export const LIST_MAX_OPTIONS = 10;
export const TEXT_MESSAGE_MAX = 4096;
export const INTERACTIVE_BODY_MAX = 1024;
export const HEADER_FOOTER_MAX = 60;
export const CAROUSEL_CARD_TEXT_MAX = 160;
export const CAROUSEL_CARD_MAX_LINE_BREAKS = 2;
/** WhatsApp only allows messages within 24 h of the customer's last one. */
export const FOLLOW_UP_MAX_MINUTES = 23 * 60;

export const slugifyTrigger = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "FLOW_NODE";

export const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * A reply ID for a new option, e.g. "opt_k3x9q2". Never derived from the
 * label: "Option N" names repeat after a delete and add.
 */
export const newOptionReplyId = (used: Iterable<string> = []) => {
  const taken = new Set(used);
  let replyId = "";
  do {
    replyId = `opt_${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
  } while (taken.has(replyId));
  return replyId;
};

export const makeListRow = (
  label = "Option 1",
  usedReplyIds: Iterable<string> = []
): ListRow => {
  const replyId = newOptionReplyId(usedReplyIds);
  return {
    id: replyId,
    replyId,
    actionId: newId("opt"),
    title: label,
    description: ""
  };
};

export const makeCarouselButton = (
  label = "Learn more",
  usedReplyIds: Iterable<string> = []
): Record<string, unknown> => {
  const replyId = newOptionReplyId(usedReplyIds);
  return {
    type: "quick_reply",
    id: replyId,
    replyId,
    actionId: newId("opt"),
    label,
    title: label
  };
};

export const makeCarouselCard = (
  index: number,
  usedReplyIds: Iterable<string> = []
): GenericCarouselCard => ({
  title: `Card ${index + 1}`,
  bodyText: "Card description",
  mediaType: "image",
  mediaId: "",
  buttons: [makeCarouselButton("Learn more", usedReplyIds)]
});

export const getListSections = (
  content: BotCanvasNodeContent
): ListSection[] => {
  const rawSections = Array.isArray(content.sections)
    ? (content.sections as ListSection[])
    : [];
  const sections = rawSections.map((section, sectionIndex) => ({
    ...section,
    title:
      typeof section.title === "string"
        ? section.title
        : `Section ${sectionIndex + 1}`,
    rows: Array.isArray(section.rows)
      ? section.rows.map((row, rowIndex) => {
          const label =
            typeof row.title === "string"
              ? row.title
              : typeof row.label === "string"
                ? row.label
                : `Option ${rowIndex + 1}`;
          const id = String(
            row.id ||
              row.replyId ||
              slugifyTrigger(label || `ITEM_${rowIndex + 1}`)
          );
          return {
            ...row,
            id,
            replyId: String(row.replyId || id),
            title: label,
            description:
              typeof row.description === "string" ? row.description : ""
          };
        })
      : []
  }));

  return sections.length
    ? sections
    : [{ title: "Main options", rows: [makeListRow()] }];
};

export const getListRowCount = (sections: ListSection[]) =>
  sections.reduce(
    (count, section) =>
      count + (Array.isArray(section.rows) ? section.rows.length : 0),
    0
  );

export const defaultContent = (
  blockType: BotBlockType
): BotCanvasNodeContent => {
  if (blockType === "text") return { text: "Write your message here." };
  if (blockType === "buttons") return { bodyText: "Choose an option:" };
  if (blockType === "list") {
    return {
      bodyText: "Select from the menu:",
      buttonText: "Open menu",
      sections: [{ title: "Main options", rows: [makeListRow()] }]
    };
  }
  if (blockType === "image") return { mediaType: "image", mediaId: "" };
  if (blockType === "document") return { mediaType: "document", mediaId: "" };
  if (blockType === "video") return { mediaType: "video", mediaId: "" };
  // No coordinates until a location is picked: 0,0 is a real place.
  if (blockType === "location") return { name: "", address: "" };
  if (blockType === "location_request") {
    return {
      bodyText: "Please share your current location."
    };
  }
  if (blockType === "address_request") {
    return {
      bodyText: "Please share your delivery address.",
      country: "IN"
    };
  }
  if (blockType === "contacts") {
    return {
      contacts: [
        {
          name: {
            formatted_name: "Support Team",
            first_name: "Support"
          },
          phones: [
            {
              phone: "",
              type: "WORK",
              wa_id: ""
            }
          ],
          emails: [
            {
              email: "",
              type: "WORK"
            }
          ],
          urls: [
            {
              url: "",
              type: "WORK"
            }
          ]
        }
      ]
    };
  }
  if (blockType === "handoff_to_agent") {
    return {
      message: "I’m connecting you to a human agent now.",
      reason: "canvas_handoff_to_agent"
    };
  }
  if (blockType === "product_carousel") {
    return {
      catalogId: "",
      sections: [{ title: "Products", productRetailerIds: [] }]
    };
  }
  const firstCard = makeCarouselCard(0);
  const firstReplyId = String(firstCard.buttons?.[0]?.replyId || "");
  return {
    bodyText: "Browse these options:",
    cards: [firstCard, makeCarouselCard(1, [firstReplyId])]
  };
};

let fallbackCarouselCards: GenericCarouselCard[] | null = null;

export const getCarouselCards = (
  content: BotCanvasNodeContent
): GenericCarouselCard[] => {
  if (Array.isArray(content.cards)) {
    return content.cards as GenericCarouselCard[];
  }
  // Built once so the fallback keeps the same IDs across renders.
  fallbackCarouselCards ??= defaultContent("generic_carousel")
    .cards as GenericCarouselCard[];
  return fallbackCarouselCards;
};

// ---------------------------------------------------------------------------
// Option identity
//
// Every option (reply button, list row, carousel button) keeps an actionId on
// its own object. Handles and wires use that ID, so deleting a card or row
// never moves another option's wire. replyIds are what WhatsApp sends back
// when a customer taps, so an existing one is never changed.
// ---------------------------------------------------------------------------

type OptionRecord = Record<string, unknown>;

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isUrlButton = (button: OptionRecord) =>
  String(button.type || (button.url ? "url" : "quick_reply")) === "url";

const replyActionTypes = new Set<BotActionType>([
  "go_to_trigger",
  "escalate_to_agent",
  "end_conversation"
]);

/**
 * What tapping an option does. List rows keep it in `type`; carousel quick
 * replies in `actionType` (their `type` is WhatsApp's button type).
 */
export const getOptionActionType = (
  blockType: BotBlockType,
  option: Record<string, unknown>
): BotActionType => {
  if (blockType === "generic_carousel" && isUrlButton(option)) {
    return "open_url";
  }
  const value = String(
    (blockType === "generic_carousel" ? option.actionType : option.type) || ""
  ) as BotActionType;
  return replyActionTypes.has(value) ? value : "go_to_trigger";
};

/** The reply ID an option already has; URL buttons fall back to their URL. */
const optionKey = (option: OptionRecord, isUrl: boolean) =>
  trimmed(option.replyId) ||
  trimmed(option.id) ||
  (isUrl ? trimmed(option.url) : "");

/**
 * Only for content that never went through assignOptionIds. Keyed by the
 * reply ID, so it survives reordering and deletion.
 */
const fallbackActionId = (replyId: string) => `option_${replyId}`;

type OptionVisitor = (option: OptionRecord, isUrl: boolean) => OptionRecord;

const mapContentOptions = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent,
  visit: OptionVisitor
): BotCanvasNodeContent => {
  if (blockType === "list" && Array.isArray(content.sections)) {
    return {
      ...content,
      sections: content.sections.map((section) => {
        const rows = (section as ListSection).rows;
        return Array.isArray(rows)
          ? { ...section, rows: rows.map((row) => visit(row, false)) }
          : section;
      })
    };
  }
  if (blockType === "generic_carousel" && Array.isArray(content.cards)) {
    return {
      ...content,
      cards: content.cards.map((card) => {
        const buttons = (card as GenericCarouselCard).buttons;
        return Array.isArray(buttons)
          ? {
              ...card,
              buttons: buttons.map((button) =>
                visit(button, isUrlButton(button))
              )
            }
          : card;
      })
    };
  }
  return content;
};

/**
 * Gives every list row and carousel button a stable actionId and a unique
 * replyId. Existing values are kept; a missing actionId is taken from the
 * saved action with the same reply ID (older flows kept it only there), and
 * generated only when there is none. A reply ID repeated within the block is
 * an error on WhatsApp, so the later copy gets a new one.
 */
export const assignOptionIds = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent,
  existingActions: BotAction[] = []
): BotCanvasNodeContent => {
  const actionIdByReplyId = new Map<string, string>();
  existingActions.forEach((action) => {
    const replyId = trimmed(action.replyId);
    if (replyId && !actionIdByReplyId.has(replyId)) {
      actionIdByReplyId.set(replyId, action.actionId);
    }
  });

  const reservedReplyIds = new Set<string>();
  mapContentOptions(blockType, content, (option, isUrl) => {
    if (!isUrl) {
      const replyId = optionKey(option, false);
      if (replyId) reservedReplyIds.add(replyId);
    }
    return option;
  });

  const usedReplyIds = new Set<string>();
  const usedActionIds = new Set<string>();
  return mapContentOptions(blockType, content, (option, isUrl) => {
    const next: OptionRecord = { ...option };
    if (!isUrl) {
      let replyId = optionKey(option, false);
      if (!replyId || usedReplyIds.has(replyId)) {
        replyId = newOptionReplyId(reservedReplyIds);
        reservedReplyIds.add(replyId);
        next.id = replyId;
      } else if (!trimmed(option.id)) {
        next.id = replyId;
      }
      next.replyId = replyId;
      usedReplyIds.add(replyId);
    }

    let actionId = trimmed(option.actionId);
    if (!actionId || usedActionIds.has(actionId)) {
      const adopted = actionIdByReplyId.get(optionKey(next, isUrl));
      actionId =
        adopted && !usedActionIds.has(adopted) ? adopted : newId("opt");
    }
    usedActionIds.add(actionId);
    next.actionId = actionId;
    return next;
  });
};

/**
 * Reply buttons live on the block's actions. Gives a repeated or missing
 * reply ID a new one; every other reply ID stays as it is.
 */
export const assignActionReplyIds = (actions: BotAction[]): BotAction[] => {
  const reserved = new Set(
    actions.map((action) => trimmed(action.replyId)).filter(Boolean)
  );
  const used = new Set<string>();
  return actions.map((action) => {
    if (action.type === "open_url") return action;
    const replyId = trimmed(action.replyId);
    if (replyId && !used.has(replyId)) {
      used.add(replyId);
      return action;
    }
    const nextReplyId = newOptionReplyId(reserved);
    reserved.add(nextReplyId);
    used.add(nextReplyId);
    return { ...action, replyId: nextReplyId };
  });
};

/** The actions behind a block's options, each with its stored actionId. */
export const getContentActions = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent
): BotAction[] => {
  const actions: BotAction[] = [];
  const addAction = (
    option: OptionRecord,
    type: BotActionType,
    metadata: Record<string, unknown> = {}
  ) => {
    const replyId = optionKey(option, type === "open_url");
    if (!replyId) return;
    const label = option.label || option.title;
    actions.push({
      actionId: trimmed(option.actionId) || fallbackActionId(replyId),
      type,
      replyId,
      label: typeof label === "string" ? label : replyId,
      url: typeof option.url === "string" ? option.url : undefined,
      metadata
    });
  };

  if (blockType === "buttons" && Array.isArray(content.buttons)) {
    content.buttons.forEach((button) =>
      addAction(button as OptionRecord, "go_to_trigger")
    );
  }

  if (blockType === "list" && Array.isArray(content.sections)) {
    content.sections.forEach((section) => {
      const rows = (section as ListSection).rows;
      if (!Array.isArray(rows)) return;
      rows.forEach((row) =>
        addAction(row, getOptionActionType("list", row), {
          description:
            typeof row.description === "string" ? row.description : "",
          sectionTitle:
            typeof section.title === "string" ? String(section.title) : ""
        })
      );
    });
  }

  if (blockType === "generic_carousel" && Array.isArray(content.cards)) {
    content.cards.forEach((card) => {
      const buttons = (card as GenericCarouselCard).buttons;
      if (!Array.isArray(buttons)) return;
      buttons.forEach((button) =>
        addAction(button, getOptionActionType("generic_carousel", button))
      );
    });
  }

  return actions;
};

/** One row on the canvas node: an option and where it leads. */
export type FlowNodeOption = {
  actionId: string;
  type: BotActionType;
  label: string;
  /** List section title, or the carousel card's name. */
  group?: string;
  description?: string;
};

/**
 * The options a block shows on the canvas, in order. List rows come from the
 * sections (so each appears once) and carousel buttons carry their card name.
 */
export const getNodeOptions = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent | undefined,
  actions: BotAction[]
): FlowNodeOption[] => {
  const options: FlowNodeOption[] = [];
  const handleFor = (option: OptionRecord, isUrl: boolean) => {
    const replyId = optionKey(option, isUrl);
    return (
      trimmed(option.actionId) || (replyId ? fallbackActionId(replyId) : "")
    );
  };

  if (blockType === "list" && Array.isArray(content?.sections)) {
    content.sections.forEach((section, sectionIndex) => {
      const rows = (section as ListSection).rows;
      if (!Array.isArray(rows)) return;
      const group = trimmed(section.title) || `Section ${sectionIndex + 1}`;
      rows.forEach((row) => {
        const actionId = handleFor(row, false);
        if (!actionId) return;
        options.push({
          actionId,
          type: getOptionActionType("list", row),
          label: trimmed(row.title) || trimmed(row.label) || "Untitled option",
          group,
          description: trimmed(row.description) || undefined
        });
      });
    });
    return options;
  }

  if (blockType === "generic_carousel" && Array.isArray(content?.cards)) {
    content.cards.forEach((card, cardIndex) => {
      const buttons = (card as GenericCarouselCard).buttons;
      if (!Array.isArray(buttons)) return;
      const group = trimmed(card.title) || `Card ${cardIndex + 1}`;
      buttons.forEach((button) => {
        const isUrl = isUrlButton(button);
        const actionId = handleFor(button, isUrl);
        if (!actionId) return;
        options.push({
          actionId,
          type: getOptionActionType("generic_carousel", button),
          label: trimmed(button.label) || trimmed(button.title) || "Button",
          group
        });
      });
    });
    return options;
  }

  return actions.map((action) => ({
    actionId: action.actionId,
    type: action.type,
    label: trimmed(action.label) || "Untitled option"
  }));
};

/**
 * The node changes a read-only canvas (the live version) accepts: React
 * Flow's measurements, without which nodes stay hidden, and selection.
 * Moves and deletions are dropped.
 */
export const readOnlyNodeChanges = <N extends Node>(
  changes: NodeChange<N>[]
): NodeChange<N>[] =>
  changes.filter(
    (change) => change.type === "dimensions" || change.type === "select"
  );

// ---------------------------------------------------------------------------
// Wires
// ---------------------------------------------------------------------------

const outputHandles = (actions: BotAction[]) =>
  actions
    .filter((action) => action.type === "go_to_trigger")
    .map((action) => action.actionId);

/**
 * Handles a block no longer has after an edit: options that were removed, or
 * that stopped going to a block (e.g. now "Hand to team").
 */
export const removedOutputHandles = (
  previousActions: BotAction[],
  nextActions: BotAction[]
) => {
  const remaining = new Set(outputHandles(nextActions));
  return outputHandles(previousActions).filter(
    (handle) => !remaining.has(handle)
  );
};

/** Removes the wires of exactly these options of this one block. */
export const removeEdgesForActions = <E extends Edge>(
  edges: E[],
  nodeId: string,
  actionIds: Iterable<string>
): E[] => {
  const handles = new Set(actionIds);
  if (!handles.size) return edges;
  return edges.filter(
    (edge) =>
      !(
        edge.source === nodeId &&
        edge.sourceHandle &&
        handles.has(edge.sourceHandle)
      )
  );
};

export const removeEdgesForAction = <E extends Edge>(
  edges: E[],
  nodeId: string,
  actionId: string
): E[] => removeEdgesForActions(edges, nodeId, [actionId]);

/**
 * Where each option's wire leads, keyed by `${sourceNodeId}:${handle}`.
 * Handle IDs repeat across blocks, so the source is part of the key.
 */
export const buildTargetByAction = (
  edges: Edge[],
  nodes: Array<{ id: string; data: { triggerKey: string } }>
) => {
  const triggerKeyById = new Map(
    nodes.map((node) => [node.id, node.data.triggerKey])
  );
  const targetByAction = new Map<string, string>();
  edges.forEach((edge) => {
    if (!edge.sourceHandle) return;
    const triggerKey = triggerKeyById.get(edge.target);
    if (triggerKey) {
      targetByAction.set(`${edge.source}:${edge.sourceHandle}`, triggerKey);
    }
  });
  return targetByAction;
};

/**
 * Wires for options that have a saved target but no wire, so the canvas
 * shows where they already go instead of "Choose next step". Only options
 * with a handle on the block get one; the IDs are fixed so reloading the
 * same flow gives the same wires.
 */
export const addMissingWires = (
  nodes: Array<{
    id: string;
    data: {
      triggerKey: string;
      blockType: BotBlockType;
      content?: BotCanvasNodeContent;
      actions: BotAction[];
    };
  }>,
  edges: Edge[]
): Edge[] => {
  const nodeIdByTriggerKey = new Map<string, string>();
  nodes.forEach((node) => {
    if (!nodeIdByTriggerKey.has(node.data.triggerKey)) {
      nodeIdByTriggerKey.set(node.data.triggerKey, node.id);
    }
  });
  const wired = new Set(
    edges.map((edge) => `${edge.source}:${edge.sourceHandle}`)
  );
  const added: Edge[] = [];
  nodes.forEach((node) => {
    const handles = new Set(
      getNodeOptions(node.data.blockType, node.data.content, node.data.actions)
        .filter((option) => option.type === "go_to_trigger")
        .map((option) => option.actionId)
    );
    node.data.actions.forEach((action) => {
      if (action.type !== "go_to_trigger" || !action.nextTriggerKey) return;
      const target = nodeIdByTriggerKey.get(action.nextTriggerKey);
      const key = `${node.id}:${action.actionId}`;
      if (!target || !handles.has(action.actionId) || wired.has(key)) return;
      wired.add(key);
      added.push({
        id: `edge_saved_${node.id}_${action.actionId}`,
        source: node.id,
        sourceHandle: action.actionId,
        target,
        targetHandle: "in",
        type: "smoothstep",
        animated: false
      });
    });
  });
  return added.length ? [...edges, ...added] : edges;
};

// ---------------------------------------------------------------------------
// Counting and formatting
// ---------------------------------------------------------------------------

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Characters as people see them: an emoji counts as 1. */
export const countChars = (value: unknown) => {
  const text = typeof value === "string" ? value : "";
  if (!text) return 0;
  if (!graphemeSegmenter) return Array.from(text).length;
  let count = 0;
  for (const segment of graphemeSegmenter.segment(text)) {
    if (segment) count += 1;
  }
  return count;
};

export const countLineBreaks = (value: unknown) =>
  typeof value === "string" ? (value.match(/\n/g) || []).length : 0;

/** "45 min", "1 h", "1 h 30 min". */
export const formatDelay = (minutes: number) => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

// ---------------------------------------------------------------------------
// Duplicating
// ---------------------------------------------------------------------------

/**
 * A copy of a block's content and actions for "Duplicate": every option gets
 * a new actionId and reply ID (two blocks answering the same reply ID would
 * clash), and nothing is wired yet.
 */
export const cloneBlockOptions = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent,
  actions: BotAction[]
): { content: BotCanvasNodeContent; actions: BotAction[] } => {
  const copied = JSON.parse(JSON.stringify(content)) as BotCanvasNodeContent;
  if (blockType === "list" || blockType === "generic_carousel") {
    const usedReplyIds: string[] = [];
    const nextContent = mapContentOptions(
      blockType,
      copied,
      (option, isUrl) => {
        const next: OptionRecord = { ...option, actionId: newId("opt") };
        if (!isUrl) {
          const replyId = newOptionReplyId(usedReplyIds);
          usedReplyIds.push(replyId);
          next.replyId = replyId;
          next.id = replyId;
        }
        return next;
      }
    );
    return {
      content: nextContent,
      actions: getContentActions(blockType, nextContent)
    };
  }

  // Reply buttons live on the actions; content.buttons is rebuilt on save.
  if (blockType === "buttons") delete copied.buttons;
  const usedReplyIds: string[] = [];
  return {
    content: copied,
    actions: actions.map((action) => {
      const replyId =
        action.type === "open_url"
          ? action.replyId
          : newOptionReplyId(usedReplyIds);
      if (replyId) usedReplyIds.push(replyId);
      return {
        ...action,
        actionId: newId("action"),
        replyId,
        nextTriggerKey: undefined,
        metadata: action.metadata ? { ...action.metadata } : undefined
      };
    })
  };
};

// ---------------------------------------------------------------------------
// Status and wording
// ---------------------------------------------------------------------------

export type FlowStatus = {
  tone: "grey" | "amber" | "green";
  label: string;
  /** Where clicking the pill takes you, if anywhere. */
  href?: string;
  /** The numbers the flow answers on, for the tooltip. */
  numbers?: string[];
};

/** The header's status pill: the first rule that matches wins. */
export const getFlowStatus = (
  live: BotCanvasLiveInfo | undefined,
  changes: BotDraftChanges | undefined
): FlowStatus => {
  if (live && !live.botEnabled) {
    return { tone: "grey", label: "Bot is off", href: "/bot/settings" };
  }
  const neverLive = changes ? changes.neverPublished : !live?.hasLiveVersion;
  if (neverLive) return { tone: "grey", label: "Not live yet" };
  if (live && live.phoneNumbers.length === 0) {
    return {
      tone: "amber",
      label: "Live, but no number uses it",
      href: "/bot/flows#flows-per-number"
    };
  }
  if (changes?.hasUnpublishedChanges) {
    const count = changes.changedBlockCount;
    return {
      tone: "amber",
      label:
        count > 0
          ? `Live · ${count} change${count === 1 ? "" : "s"} not live yet`
          : "Live · changes not live yet"
    };
  }
  const numbers = (live?.phoneNumbers || []).map(
    (number) =>
      number.displayPhoneNumber || number.verifiedName || "a WhatsApp number"
  );
  return {
    tone: "green",
    label:
      numbers.length === 1
        ? `Live on ${numbers[0]}`
        : numbers.length > 1
          ? `Live on ${numbers.length} numbers`
          : "Live",
    numbers
  };
};

/** The header's main button. */
export const getPrimaryAction = (
  changes: BotDraftChanges | undefined,
  hasLiveVersion: boolean,
  hasUnsavedEdits: boolean
): { label: string; disabled: boolean } => {
  if (changes ? changes.neverPublished : !hasLiveVersion) {
    return { label: "Go live", disabled: false };
  }
  if (hasUnsavedEdits || !changes || changes.hasUnpublishedChanges) {
    return { label: "Update live flow", disabled: false };
  }
  return { label: "Up to date", disabled: true };
};

/** One line of a block's "Reached from" list. */
export const describeEntryPoint = (entry: BotFlowEntryPoint) => {
  switch (entry.kind) {
    case "start":
      return "Start of the flow";
    case "opt_in":
      return "When a customer opts back in";
    case "opt_out":
      return "When a customer opts out";
    case "ai":
      return "AI replies can send customers here";
    case "option":
      return entry.label
        ? `${entry.fromBlockName} › ${entry.label}`
        : entry.fromBlockName;
    case "follow_up":
      return `Follow-up of ${entry.fromBlockName} after ${formatDelay(entry.delayMinutes)}`;
    case "template":
      return `Template ${entry.templateName} › ${entry.label}`;
    case "broadcast":
      return `Broadcast ${entry.broadcastName} › ${entry.label}`;
    default:
      return "Another part of your account";
  }
};
