"use client";

import {
  addEdge,
  Background,
  Connection,
  ConnectionLineType,
  Edge,
  MiniMap,
  NodeChange,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CopyPlus,
  Eye,
  FileUp,
  History,
  Loader2,
  Lock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Send,
  Timer,
  Trash2,
  Undo2
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  discardBotCanvasDraftById,
  getApiErrorMessage,
  getBotCanvas,
  getBotStatus,
  getDraftConflict,
  getFlowInvalid,
  publishBotCanvasDraftById,
  restoreBotCanvasVersionById,
  saveBotCanvasDraftById,
  updateBotCanvas,
  validateBotCanvasById
} from "@/client-api/functions/bot";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { InlineEditableTitle } from "@/components/shared/InlineEditableTitle";
import {
  BotAction,
  BotActionType,
  BotBlockType,
  BotCanvasDraftState,
  BotCanvasEdge,
  BotCanvasNode,
  BotCanvasNodeContent,
  BotCanvasResponse,
  BotCanvasValidation,
  BotDraftChanges,
  BotDraftConflictDetails,
  BotFlowEntryPoint,
  BotFlowIssue
} from "@/client-api/types/bot.type";
import { MediaAsset } from "@/client-api/types/media.type";
import BotFlowNode from "@/components/flows/BotFlowNode";
import {
  blockPalette,
  FlowBlockLibrary,
  getBlockLabel
} from "@/components/flows/FlowBlockLibrary";
import { FlowCanvasToolbar } from "@/components/flows/FlowCanvasToolbar";
import { FlowVersionHistoryDialog } from "@/components/flows/FlowVersionHistoryDialog";
import { layoutFlow } from "@/components/flows/flowGraph";
import FlowDiagramPreviewDialog from "@/components/flows/FlowDiagramPreviewDialog";
import { WhatsAppFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import LocationPickerDialog from "@/components/location/LocationPickerDialog";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import PhoneNumberInput, {
  buildInternationalPhoneNumber
} from "@/components/ui/phone-number-input";
import { Label } from "@/components/ui/label";
import { CanvasLoadingSkeleton } from "@/components/ui/loading-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import {
  CachedDraft,
  draftSignature,
  parseCachedDraft,
  shouldOfferCachedDraft,
  shouldReplaceWithStarter
} from "@/lib/flowStarter";
import { cn } from "@/lib/utils";
import {
  addMissingWires,
  assignActionReplyIds,
  cloneBlockOptions,
  describeEntryPoint,
  getFlowStatus,
  getNodeOptions,
  getOptionActionType,
  getPrimaryAction,
  assignOptionIds,
  buildTargetByAction,
  BuilderNode,
  BuilderNodeData,
  CAROUSEL_CARD_MAX_LINE_BREAKS,
  CAROUSEL_CARD_TEXT_MAX,
  countChars,
  countLineBreaks,
  defaultContent,
  FOLLOW_UP_MAX_MINUTES,
  GenericCarouselCard,
  getCarouselCards,
  getContentActions,
  getListRowCount,
  getListSections,
  HEADER_FOOTER_MAX,
  INTERACTIVE_BODY_MAX,
  LIST_BUTTON_TEXT_MAX,
  LIST_MAX_OPTIONS,
  LIST_MAX_SECTIONS,
  LIST_ROW_DESCRIPTION_MAX,
  LIST_ROW_TITLE_MAX,
  LIST_SECTION_TITLE_MAX,
  ListRow,
  ListSection,
  makeCarouselButton,
  makeCarouselCard,
  makeListRow,
  newId,
  newOptionReplyId,
  removedOutputHandles,
  removeEdgesForAction,
  removeEdgesForActions,
  REPLY_BUTTON_LABEL_MAX,
  slugifyTrigger,
  TEXT_MESSAGE_MAX
} from "@/lib/flowBuilder";
import {
  emptyHistory,
  FlowHistory,
  recordHistory,
  redoHistory,
  undoHistory
} from "@/lib/flowHistory";
import { useOrganizationStore } from "@/stores/organizationStore";
import { PermissionGate } from "@/components/common/NoAccess";

type MediaPickerTarget =
  | { kind: "node"; nodeId?: string }
  | { kind: "carousel-card"; cardIndex: number; nodeId?: string };
// "live" shows the version customers get, read-only.
type CanvasMode = "draft" | "live";

const nodeTypes = { botBlock: BotFlowNode };
// Wires are faint until their block is selected.
const flowEdgeStyle = {
  strokeWidth: 1.25,
  strokeDasharray: "4 5",
  opacity: 0.45
};
const selectedFlowEdgeStyle = {
  stroke: "#16a34a",
  strokeWidth: 2,
  strokeDasharray: "4 5",
  opacity: 1
};
const actionTypeOptions: Array<{ value: BotActionType; label: string }> = [
  { value: "go_to_trigger", label: "Go to block" },
  { value: "escalate_to_agent", label: "Hand to team" },
  { value: "open_url", label: "Open website" },
  { value: "end_conversation", label: "End chat" }
];
// What a tap can do, per kind of block. "Open website" is a different
// WhatsApp button, so only buttons and carousels have it.
const allowedActionTypes = (blockType: BotBlockType): BotActionType[] =>
  blockType === "buttons" || blockType === "generic_carousel"
    ? ["go_to_trigger", "escalate_to_agent", "open_url", "end_conversation"]
    : ["go_to_trigger", "escalate_to_agent", "end_conversation"];

// Sets what tapping one carousel button does. Switching to or from a
// website button changes that button on every card, since WhatsApp needs
// the same button types on each card.
const setCarouselOptionType = (
  cards: GenericCarouselCard[],
  cardIndex: number,
  buttonIndex: number,
  type: BotActionType
): GenericCarouselCard[] => {
  const buttonsOf = (card: GenericCarouselCard) =>
    (card.buttons || []) as Array<Record<string, unknown>>;
  const used = cards.flatMap((card) =>
    buttonsOf(card).map((button) => String(button.replyId || button.id || ""))
  );
  const current = buttonsOf(cards[cardIndex] || {})[buttonIndex] || {};
  const isUrl =
    String(current.type || (current.url ? "url" : "quick_reply")) === "url";
  const wantsUrl = type === "open_url";
  let next = cards;
  if (wantsUrl !== isUrl) {
    next = cards.map((card) => {
      const buttons = [...buttonsOf(card)];
      const button = buttons[buttonIndex] || {};
      if (wantsUrl) {
        buttons[buttonIndex] = {
          ...button,
          type: "url",
          url: button.url || "",
          replyId: undefined,
          id: undefined,
          actionType: undefined
        };
      } else {
        const replyId =
          String(button.replyId || button.id || "") || newOptionReplyId(used);
        used.push(replyId);
        buttons[buttonIndex] = {
          ...button,
          type: "quick_reply",
          id: replyId,
          replyId,
          url: undefined
        };
      }
      return { ...card, buttons };
    });
  }
  if (wantsUrl) return next;
  return next.map((card, index) =>
    index === cardIndex
      ? {
          ...card,
          buttons: buttonsOf(card).map((button, currentIndex) =>
            currentIndex === buttonIndex
              ? {
                  ...button,
                  actionType: type === "go_to_trigger" ? undefined : type
                }
              : button
          )
        }
      : card
  );
};

const lockedNodeIds = new Set([
  "main-menu",
  "compliance-opt-out",
  "node_default",
  "node_opt_in",
  "node_opt_out"
]);
const isRoutingBlock = (type: BotBlockType) =>
  ["buttons", "list", "product_carousel", "generic_carousel"].includes(type);

const makeUniqueTrigger = (
  baseValue: string,
  nodes: BuilderNode[],
  excludeNodeId?: string
) => {
  const base = slugifyTrigger(baseValue);
  const used = new Set(
    nodes
      .filter((node) => node.id !== excludeNodeId)
      .map((node) => node.data.triggerKey)
  );
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
};

const makeAction = (
  label = "New option",
  usedReplyIds: Iterable<string> = []
): BotAction => ({
  actionId: newId("action"),
  type: "go_to_trigger",
  label,
  replyId: newOptionReplyId(usedReplyIds)
});

// Tidies button types and labels. Reply IDs are kept as they are: WhatsApp
// sends them back when a customer taps, so changing one breaks old messages.
const normalizeGenericCarouselContent = (
  content: BotCanvasNodeContent
): BotCanvasNodeContent => {
  const cards = getCarouselCards(content).map((card) => {
    const buttons = Array.isArray(card.buttons)
      ? (card.buttons as Array<Record<string, unknown>>)
      : [];

    return {
      ...card,
      buttons: buttons.map((button, buttonIndex) => {
        const buttonType = String(
          button.type || (button.url ? "url" : "quick_reply")
        );
        const label =
          typeof button.label === "string" && button.label.trim()
            ? button.label
            : typeof button.title === "string" && button.title.trim()
              ? button.title
              : `Action ${buttonIndex + 1}`;

        if (buttonType === "url") {
          return {
            ...button,
            type: "url",
            label,
            title: label,
            replyId: undefined,
            id: undefined,
            actionType: undefined
          };
        }

        const replyId =
          String(button.replyId || button.id || "").trim() || undefined;
        return {
          ...button,
          type: "quick_reply",
          id: replyId,
          replyId,
          label,
          title: label,
          url: undefined
        };
      })
    };
  });

  return { ...content, cards };
};

// Saved actions win over content options with the same ID or reply ID.
const mergeActions = (
  explicitActions: BotAction[],
  contentActions: BotAction[]
) => {
  const seenActionIds = new Set<string>();
  const seenReplyIds = new Set<string>();
  const merged: BotAction[] = [];
  [...explicitActions, ...contentActions].forEach((action) => {
    if (
      seenActionIds.has(action.actionId) ||
      (action.replyId && seenReplyIds.has(action.replyId))
    ) {
      return;
    }
    seenActionIds.add(action.actionId);
    if (action.replyId) seenReplyIds.add(action.replyId);
    merged.push(action);
  });
  return merged;
};

const hasLocation = (content: BotCanvasNodeContent) =>
  typeof content.latitude === "number" && typeof content.longitude === "number";

const summarizeNode = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent
) => {
  if (blockType === "text") return String(content.text || "");
  if (
    blockType === "buttons" ||
    blockType === "list" ||
    blockType === "generic_carousel"
  ) {
    return String(content.bodyText || "");
  }
  if (
    blockType === "image" ||
    blockType === "document" ||
    blockType === "video"
  ) {
    return content.mediaName
      ? `Media: ${content.mediaName}`
      : "Select media from the properties panel.";
  }
  if (blockType === "location") {
    if (!hasLocation(content)) return "Pick the location on the map.";
    return `${content.name || content.locationName || "Location"} (${content.latitude}, ${content.longitude})`;
  }
  if (blockType === "location_request") {
    return String(content.bodyText || "Ask customer to share location.");
  }
  if (blockType === "address_request") {
    return String(content.bodyText || "Ask customer to share address.");
  }
  if (blockType === "contacts") {
    const contacts = Array.isArray(content.contacts)
      ? (content.contacts as Array<Record<string, unknown>>)
      : [];
    const first = contacts[0] as { name?: Record<string, unknown> } | undefined;
    const name = String(
      first?.name?.formatted_name || first?.name?.first_name || "Contact card"
    );
    return `Contact: ${name}`;
  }
  if (blockType === "handoff_to_agent") {
    return String(content.message || content.text || "Connect to an agent.");
  }
  return content.catalogId
    ? `Catalog: ${content.catalogId}`
    : "Configure catalog details.";
};

const normalizeBackendNode = (rawNode: unknown): BotCanvasNode => {
  const node = rawNode as Partial<BotCanvasNode> & {
    data?: Record<string, unknown>;
    type?: string;
  };
  const data =
    node.data && typeof node.data === "object" && !Array.isArray(node.data)
      ? (node.data as Record<string, unknown>)
      : {};
  const blockType = String(
    data.blockType || node.blockType || node.type || "text"
  ) as BotBlockType;
  const content = (data.content ||
    node.content ||
    defaultContent(blockType)) as BotCanvasNodeContent;
  const name = String(data.name || data.label || node.name || "Block");
  const triggerKey = String(
    data.triggerKey || node.triggerKey || slugifyTrigger(name)
  );

  return {
    id: String(node.id || data.id || triggerKey),
    triggerKey,
    name,
    blockType,
    sortOrder: Number(node.sortOrder || data.sortOrder || 0),
    content,
    actions: ((data.actions || node.actions || []) as BotAction[]) || [],
    position: (node.position || data.position) as
      | { x: number; y: number }
      | undefined,
    metadata: (data.metadata || node.metadata || {}) as Record<string, unknown>,
    followUp: (data.followUp || node.followUp) as
      | BotCanvasNode["followUp"]
      | undefined
  };
};

const toReactNode = (rawNode: unknown): BuilderNode => {
  const node = normalizeBackendNode(rawNode);
  const savedActions = node.actions || [];
  const content = assignOptionIds(
    node.blockType,
    node.blockType === "generic_carousel"
      ? normalizeGenericCarouselContent(node.content || {})
      : node.content || {},
    savedActions
  );
  const contentActions = getContentActions(node.blockType, content);
  let actions: BotAction[];
  if (node.blockType === "generic_carousel" || node.blockType === "list") {
    // These options live only in the content (which also says what a tap
    // does); keep the saved routing.
    const savedById = new Map(
      savedActions.map((action) => [action.actionId, action])
    );
    actions = contentActions.map((action) => ({
      ...action,
      nextTriggerKey: savedById.get(action.actionId)?.nextTriggerKey,
      metadata: {
        ...(savedById.get(action.actionId)?.metadata || {}),
        ...action.metadata
      }
    }));
  } else {
    actions = mergeActions(
      node.blockType === "buttons"
        ? assignActionReplyIds(savedActions)
        : savedActions,
      contentActions
    );
  }

  return {
    id: node.id,
    type: "botBlock",
    position: node.position || { x: 0, y: 0 },
    hidden: Boolean(
      node.metadata?.automaticFollowUpTarget ||
        (node.metadata?.automaticFollowUp && !node.followUp?.enabled)
    ),
    data: {
      label: node.name,
      triggerKey: node.triggerKey,
      blockType: node.blockType,
      actions,
      content,
      locked: lockedNodeIds.has(node.id) || Boolean(node.metadata?.locked),
      metadata: node.metadata || {},
      followUp: node.followUp,
      summary: summarizeNode(node.blockType, content)
    }
  };
};

const createNode = (
  blockType: BotBlockType,
  position: { x: number; y: number },
  name?: string,
  overrides?: Partial<BotCanvasNode>
): BuilderNode => {
  const label = name || getBlockLabel(blockType);
  const content = overrides?.content || defaultContent(blockType);
  const actions =
    overrides?.actions ||
    (blockType === "generic_carousel" || blockType === "list"
      ? getContentActions(blockType, content)
      : isRoutingBlock(blockType)
        ? [makeAction("Option 1")]
        : []);
  return toReactNode({
    id: overrides?.id || newId("node"),
    // Set once here; renaming the block never changes it (templates,
    // broadcasts, follow-ups and sent buttons point at this key).
    triggerKey: overrides?.triggerKey || slugifyTrigger(label),
    name: label,
    blockType,
    content,
    actions,
    position,
    metadata: overrides?.metadata
  });
};

const defaultCanvasNodes = (): BuilderNode[] => [
  createNode("list", { x: 120, y: 120 }, "Main Menu", {
    id: "node_default",
    triggerKey: "DEFAULT",
    content: {
      bodyText: "Hi, how can we help you today?",
      buttonText: "Open menu",
      sections: [
        {
          title: "Start here",
          rows: [
            {
              id: "TALK_TO_TEAM",
              title: "Talk to team",
              description: "Ask us for help",
              type: "escalate_to_agent"
            },
            {
              id: "OPT_OUT",
              title: "Opt out",
              description: "Stop promotional messages"
            }
          ]
        }
      ]
    },
    actions: [
      {
        ...makeAction("Talk to team"),
        actionId: "action_talk_to_team",
        replyId: "TALK_TO_TEAM",
        type: "escalate_to_agent"
      },
      {
        ...makeAction("Opt out"),
        actionId: "action_opt_out",
        replyId: "OPT_OUT"
      }
    ],
    metadata: { locked: true }
  }),
  optInNode(),
  complianceNode()
];

const optInNode = () =>
  createNode("text", { x: 520, y: 20 }, "Opt In Confirmation", {
    id: "node_opt_in",
    triggerKey: "OPT_IN",
    content: {
      text: "You are opted in and can receive messages from us again."
    },
    actions: [],
    metadata: { locked: true }
  });

const complianceNode = () =>
  createNode("text", { x: 520, y: 160 }, "Opt Out Confirmation", {
    id: "node_opt_out",
    triggerKey: "OPT_OUT",
    content: { text: "You are unsubscribed. Reply START to opt back in." },
    actions: [],
    metadata: { locked: true }
  });

const ensureRequiredNodes = (nodes: BuilderNode[]) => {
  const byTrigger = new Set(nodes.map((node) => node.data.triggerKey));
  if (
    !byTrigger.has("DEFAULT") &&
    !byTrigger.has("OPT_IN") &&
    !byTrigger.has("OPT_OUT")
  ) {
    return [...nodes, ...defaultCanvasNodes()];
  }
  const required: BuilderNode[] = [];
  if (!byTrigger.has("DEFAULT")) {
    required.push(
      createNode("list", { x: 120, y: 120 }, "Main Menu", {
        id: "node_default",
        triggerKey: "DEFAULT",
        content: defaultCanvasNodes()[0].data.content,
        actions: defaultCanvasNodes()[0].data.actions,
        metadata: { locked: true }
      })
    );
  }
  if (!byTrigger.has("OPT_IN")) required.push(optInNode());
  if (!byTrigger.has("OPT_OUT")) required.push(complianceNode());

  return required.length ? [...nodes, ...required] : nodes;
};

const ensureUniqueNodeTriggers = (nodes: BuilderNode[]) => {
  const nextNodes: BuilderNode[] = [];
  nodes.forEach((node) => {
    if (node.data.locked) {
      nextNodes.push(node);
      return;
    }
    nextNodes.push({
      ...node,
      data: {
        ...node.data,
        triggerKey: makeUniqueTrigger(node.data.triggerKey, nextNodes, node.id)
      }
    });
  });
  return nextNodes;
};

const applyDefaultMarker = (
  nodes: BuilderNode[],
  defaultTriggerKey?: string
): BuilderNode[] => {
  const fallbackTrigger =
    defaultTriggerKey ||
    nodes.find(
      (node) =>
        node.data.triggerKey !== "OPT_IN" && node.data.triggerKey !== "OPT_OUT"
    )?.data.triggerKey ||
    "DEFAULT";

  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      metadata: {
        ...((node.data.metadata as Record<string, unknown> | undefined) || {}),
        isDefault: node.data.triggerKey === fallbackTrigger || undefined
      }
    }
  }));
};

const decorateAutomaticFollowUps = (nodes: BuilderNode[]) =>
  nodes.map((node) => {
    const followUpTarget = node.data.followUp?.enabled
      ? nodes.find(
          (candidate) =>
            candidate.data.triggerKey === node.data.followUp?.targetTriggerKey
        )
      : undefined;
    if (followUpTarget) {
      return {
        ...node,
        hidden: false,
        data: {
          ...node.data,
          metadata: {
            ...node.data.metadata,
            automaticFollowUp: true,
            followUpDelayUnit:
              node.data.metadata?.followUpDelayUnit || "minutes"
          }
        }
      };
    }

    const source = nodes.find(
      (candidate) =>
        candidate.data.followUp?.enabled &&
        candidate.data.followUp.targetTriggerKey === node.data.triggerKey
    );
    const isGeneratedTarget = Boolean(
      node.data.metadata?.automaticFollowUpTarget ||
        node.data.metadata?.automaticFollowUp ||
        node.data.metadata?.followUpSourceId
    );
    if (!source || !isGeneratedTarget) return node;

    return {
      ...node,
      hidden: true,
      data: {
        ...node.data,
        metadata: {
          ...node.data.metadata,
          automaticFollowUp: undefined,
          automaticFollowUpTarget: true,
          followUpSourceId: source.id
        }
      }
    };
  });

const defaultCanvasEdges = (): Edge[] => [
  {
    id: "edge_default_opt_out",
    source: "node_default",
    target: "node_opt_out",
    sourceHandle: "action_opt_out",
    targetHandle: "in",
    type: "smoothstep",
    animated: false,
    style: flowEdgeStyle
  }
];

const getSelectedMediaId = (
  node: BuilderNode | null,
  target: MediaPickerTarget
) => {
  if (!node) return "";
  if (target.kind === "carousel-card") {
    return String(
      getCarouselCards(node.data.content)[target.cardIndex]?.mediaId || ""
    );
  }
  return String(node.data.content.mediaId || "");
};

const getMediaPreviewUrl = (
  content: BotCanvasNodeContent | GenericCarouselCard
) =>
  String(
    content.mediaUrl ||
      (content.media &&
      typeof content.media === "object" &&
      "cloudinaryUrl" in content.media
        ? (content.media as { cloudinaryUrl?: string }).cloudinaryUrl
        : "") ||
      ""
  );

function MediaPreview({
  mediaType,
  url,
  label
}: {
  mediaType?: string;
  url?: string;
  label?: string;
}) {
  if (!url && mediaType !== "document") {
    return null;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-muted/30">
      {mediaType === "video" ? (
        <video
          src={url}
          controls
          className="aspect-video w-full object-cover"
        />
      ) : mediaType === "image" ? (
        <img
          src={url}
          alt={label || "Selected media"}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex min-h-24 items-center gap-3 p-3 text-sm">
          <FileUp className="size-8 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {label || "Selected document"}
            </p>
            {url && (
              <p className="truncate text-xs text-muted-foreground">{url}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const getDraftStateFromResponse = (
  data?: ReturnType<typeof getBotCanvas> extends Promise<infer R> ? R : never
) => data?.data?.canvas?.draftState || data?.data?.draftState;

const getPublishedStateFromResponse = (
  data?: ReturnType<typeof getBotCanvas> extends Promise<infer R> ? R : never
) => data?.data?.canvas?.publishedState || data?.data?.publishedState;

const draftCacheKey = (orgId?: string, canvasId?: string) =>
  orgId && canvasId ? `whatching:bot-flow-draft:${orgId}:${canvasId}` : "";

const readCachedDraft = (orgId?: string, canvasId?: string) => {
  if (typeof window === "undefined") return null;
  const key = draftCacheKey(orgId, canvasId);
  if (!key) return null;
  try {
    return parseCachedDraft<BotCanvasDraftState>(
      window.localStorage.getItem(key)
    );
  } catch {
    return null;
  }
};

// Unsaved edits, kept so a crash or closed tab doesn't lose them. Only
// offered back while the server is still on baseRevision.
const writeCachedDraft = (
  orgId: string | undefined,
  canvasId: string | undefined,
  draft: BotCanvasDraftState,
  baseRevision: number | undefined
) => {
  if (typeof window === "undefined" || typeof baseRevision !== "number") {
    return;
  }
  const key = draftCacheKey(orgId, canvasId);
  if (!key) return;
  const value: CachedDraft<BotCanvasDraftState> = {
    draft,
    baseRevision,
    savedAt: new Date().toISOString()
  };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: autosave still covers the edit.
  }
};

const clearCachedDraft = (orgId?: string, canvasId?: string) => {
  if (typeof window === "undefined") return;
  const key = draftCacheKey(orgId, canvasId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
};

const flowEdgesToBackend = (
  edges: Edge[],
  nodes: BuilderNode[]
): BotCanvasEdge[] => {
  const actionByNodeAndHandle = new Map<string, BotAction>();
  nodes.forEach((node) => {
    node.data.actions.forEach((action) => {
      actionByNodeAndHandle.set(`${node.id}:${action.actionId}`, action);
      if (action.replyId)
        actionByNodeAndHandle.set(`${node.id}:${action.replyId}`, action);
    });
  });

  return edges.map((edge) => {
    const action = edge.sourceHandle
      ? actionByNodeAndHandle.get(`${edge.source}:${edge.sourceHandle}`)
      : undefined;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: action?.replyId || edge.sourceHandle,
      targetHandle: edge.targetHandle,
      actionId: action?.actionId || edge.sourceHandle || undefined,
      replyId: action?.replyId || edge.sourceHandle || undefined,
      metadata: edge.data as Record<string, unknown> | undefined
    };
  });
};

const prepareNodeContent = (node: BuilderNode): BotCanvasNodeContent => {
  const content =
    node.data.blockType === "generic_carousel"
      ? normalizeGenericCarouselContent({ ...node.data.content })
      : { ...node.data.content };
  const visibleActions = node.data.actions.filter((action) =>
    ["go_to_trigger", "escalate_to_agent", "end_conversation"].includes(
      action.type
    )
  );

  if (node.data.blockType === "buttons") {
    content.buttons = visibleActions.slice(0, 3).map((action, index) => ({
      actionId: action.actionId,
      id: action.replyId || action.actionId || `BUTTON_${index + 1}`,
      replyId: action.replyId || action.actionId || `BUTTON_${index + 1}`,
      label: action.label || `Option ${index + 1}`,
      title: action.label || `Option ${index + 1}`
    }));
  }

  if (node.data.blockType === "list") {
    const sections = getListSections(content);
    const hasRows = getListRowCount(sections) > 0;
    content.sections = hasRows
      ? sections.map((section, sectionIndex) => ({
          title: String(section.title || `Section ${sectionIndex + 1}`),
          rows: (section.rows || []).map((row, rowIndex) => {
            const title =
              typeof row.title === "string"
                ? row.title
                : typeof row.label === "string"
                  ? row.label
                  : `Item ${rowIndex + 1}`;
            const id = String(
              row.id ||
                row.replyId ||
                slugifyTrigger(title || `ITEM_${rowIndex + 1}`)
            );
            return {
              ...(row.actionId ? { actionId: row.actionId } : {}),
              ...(row.type && row.type !== "go_to_trigger"
                ? { type: row.type }
                : {}),
              id,
              replyId: String(row.replyId || id),
              title,
              ...(String(row.description || "").trim()
                ? { description: String(row.description).trim() }
                : {})
            };
          })
        }))
      : [
          {
            title: "Menu",
            rows: visibleActions
              .slice(0, LIST_MAX_OPTIONS)
              .map((action, index) => ({
                actionId: action.actionId,
                id: action.replyId || action.actionId || `ITEM_${index + 1}`,
                replyId:
                  action.replyId || action.actionId || `ITEM_${index + 1}`,
                title: action.label || `Item ${index + 1}`,
                description:
                  typeof action.metadata?.description === "string"
                    ? action.metadata.description
                    : undefined
              }))
          }
        ];
  }

  return content;
};

const canvasEdgesToFlow = (
  edges?: BotCanvasEdge[],
  nodes: BuilderNode[] = []
): Edge[] => {
  // Each handle is its option's actionId. A saved wire is matched by reply ID
  // first (what WhatsApp routes on), then by actionId.
  const handleByReplyId = new Map<string, string>();
  const handleByActionId = new Map<string, string>();
  nodes.forEach((node) => {
    node.data.actions.forEach((action) => {
      handleByActionId.set(`${node.id}:${action.actionId}`, action.actionId);
      if (
        action.replyId &&
        !handleByReplyId.has(`${node.id}:${action.replyId}`)
      )
        handleByReplyId.set(`${node.id}:${action.replyId}`, action.actionId);
    });
  });
  const resolveHandle = (edge: BotCanvasEdge) =>
    [edge.replyId, edge.sourceHandle]
      .map((id) => id && handleByReplyId.get(`${edge.source}:${id}`))
      .find(Boolean) ||
    [edge.actionId, edge.sourceHandle]
      .map((id) => id && handleByActionId.get(`${edge.source}:${id}`))
      .find(Boolean) ||
    edge.actionId ||
    edge.sourceHandle ||
    edge.replyId ||
    undefined;

  return (edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: resolveHandle(edge),
    targetHandle: edge.targetHandle || "in",
    type: "smoothstep",
    animated: false,
    data: edge.metadata
  }));
};

// Loads a saved draft into editor nodes and wires. A backend starter is
// swapped for the built-in one (see lib/flowStarter). Options with a saved
// target but no wire get one, so the canvas shows where they go; this is
// part of what loaded, so it never counts as an unsaved change.
const buildEditorState = (draft?: BotCanvasDraftState | null) => {
  const loadedNodes = draft?.nodes?.length
    ? ensureUniqueNodeTriggers(
        ensureRequiredNodes(draft.nodes.map(toReactNode))
      )
    : defaultCanvasNodes();
  const loadedEdges = canvasEdgesToFlow(draft?.edges, loadedNodes);
  const useStarter = shouldReplaceWithStarter(loadedNodes, loadedEdges);
  const nodes = decorateAutomaticFollowUps(
    applyDefaultMarker(
      useStarter ? defaultCanvasNodes() : loadedNodes,
      draft?.defaultTriggerKey
    )
  );
  const edges = useStarter
    ? defaultCanvasEdges()
    : addMissingWires(nodes, canvasEdgesToFlow(draft?.edges, nodes));
  return { nodes, edges, useStarter };
};

// The backend's name for a flow nobody has named yet.
const DEFAULT_FLOW_NAME = "Untitled Bot Canvas";
const RENAME_HINT_KEY = "whatching:flow-rename-hint-seen";

const formatLiveDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));

const formatTime = (value: string | number | Date = Date.now()) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

type SaveState = "idle" | "saving" | "saved" | "error";
type FlowSnapshot = { nodes: BuilderNode[]; edges: Edge[]; signature: string };
// Changes this close together (typing, nudging) share one undo step.
const HISTORY_COALESCE_MS = 1000;
const ARRANGE_DURATION_MS = 350;
type FocusRequest = {
  nodeId: string;
  field?: string;
  actionId?: string;
  /** Opens this editor tab regardless of field. */
  tab?: PanelTab;
  nonce: number;
};
type DraftConflict = {
  details: BotDraftConflictDetails;
  /** What to retry after "Keep mine". */
  retry:
    | { kind: "save" }
    | { kind: "go-live" }
    | { kind: "discard" }
    | { kind: "restore"; versionId: string };
};
type PanelTab = "message" | "next" | "settings";

// The editor tab an issue's field or option lives on.
const tabForFocus = (request: FocusRequest): PanelTab => {
  if (request.tab) return request.tab;
  if (request.field?.startsWith("followUp")) return "next";
  if (request.field === "name") return "settings";
  if (request.field && !request.field.startsWith("action.")) {
    return "message";
  }
  return request.actionId ? "next" : "message";
};

const formatHint = (
  <p className="text-[11px] text-muted-foreground">
    <span className="font-mono">*bold*</span>{" "}
    <span className="font-mono">_italic_</span>{" "}
    <span className="font-mono">~strike~</span>
  </p>
);

function IssuesBar({
  issues,
  open,
  onOpenChange,
  onSelect,
  className
}: {
  issues: BotFlowIssue[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (issue: BotFlowIssue) => void;
  className?: string;
}) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity !== "error");
  const summary = [
    errors.length ? `${errors.length} to fix` : "",
    warnings.length
      ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "absolute bottom-4 left-16 z-10 rounded-lg border bg-white shadow-md",
        className
      )}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm font-medium"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="flex items-center gap-2">
          {errors.length > 0 && (
            <span className="size-2 rounded-full bg-destructive" />
          )}
          {warnings.length > 0 && (
            <span className="size-2 rounded-full bg-amber-500" />
          )}
          {summary}
        </span>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ul className="max-h-56 overflow-y-auto border-t py-1 text-sm">
          {[...errors, ...warnings].map((issue, index) => (
            <li
              key={`${issue.code}-${issue.nodeId}-${issue.actionId}-${issue.field}-${index}`}
            >
              <button
                type="button"
                disabled={!issue.nodeId}
                className="flex w-full cursor-pointer items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => onSelect(issue)}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    issue.severity === "error"
                      ? "bg-destructive"
                      : "bg-amber-500"
                  )}
                />
                <span>{issue.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowsBuilder() {
  const router = useRouter();
  const canvasId =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const orgId = activeOrganization?._id;
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("draft");
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<
    BuilderNode,
    Edge
  > | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowPreviewOpen, setFlowPreviewOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [issues, setIssues] = useState<BotFlowIssue[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [conflict, setConflict] = useState<DraftConflict | null>(null);
  const [cachedOffer, setCachedOffer] =
    useState<CachedDraft<BotCanvasDraftState> | null>(null);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const [analysis, setAnalysis] = useState<BotCanvasValidation["analysis"]>();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [wiresVisible, setWiresVisible] = useState(true);
  const [minimapVisible, setMinimapVisible] = useState(false);
  const [isArranging, setIsArranging] = useState(false);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false
  });
  // Bumped whenever there are edits the server doesn't have; restarts the
  // autosave timer.
  const [pendingVersion, setPendingVersion] = useState(0);
  const [nodeDeletionRequest, setNodeDeletionRequest] = useState<{
    ids: Set<string>;
    label: string;
    cascadesFollowUp: boolean;
    /** How customers reach the block now; these stop working. */
    reachedFrom?: string[];
  } | null>(null);
  const [mediaPicker, setMediaPicker] = useState<{
    open: boolean;
    type: "IMAGE" | "DOCUMENT" | "VIDEO";
    target: MediaPickerTarget;
  }>({
    open: false,
    type: "IMAGE",
    target: { kind: "node" }
  });
  const hydratedRef = useRef(false);
  const nodesRef = useRef<BuilderNode[]>([]);
  const latestDraftRef = useRef<BotCanvasDraftState | null>(null);
  // Signature of the draft the server has. Null until the first pass after
  // loading records it, so opening a flow never saves it back.
  const savedSignatureRef = useRef<string | null>(null);
  const hasPendingEditsRef = useRef(false);
  // The server's draftRevision our edits build on; sent as baseRevision.
  const draftRevisionRef = useRef<number | undefined>(undefined);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const conflictRef = useRef(false);
  const validateTimerRef = useRef<number | undefined>(undefined);
  const validateRequestRef = useRef(0);
  // Undo/redo: the last recorded state and the stacks around it. Drags and
  // auto-arrange record once, when they finish; quick edits in a row (like
  // typing) share one step.
  const historyRef = useRef<FlowHistory<FlowSnapshot>>(emptyHistory());
  const snapshotRef = useRef<FlowSnapshot | null>(null);
  const lastRecordAtRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isArrangingRef = useRef(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // One request: the draft, the live version, revision and change summary.
  const {
    data: canvasData,
    isLoading: isCanvasLoading,
    refetch: refetchCanvas
  } = useQuery({
    queryKey: ["bot-canvas", orgId, canvasId],
    queryFn: () => getBotCanvas(canvasId),
    enabled: Boolean(orgId && canvasId),
    refetchOnMount: "always"
  });

  // Shown once, while the flow still has the default name.
  const [hasSeenRenameHint, setHasSeenRenameHint] = useState(true);
  useEffect(() => {
    try {
      setHasSeenRenameHint(localStorage.getItem(RENAME_HINT_KEY) === "1");
    } catch {
      setHasSeenRenameHint(true);
    }
  }, []);
  const dismissRenameHint = () => {
    setHasSeenRenameHint(true);
    try {
      localStorage.setItem(RENAME_HINT_KEY, "1");
    } catch {
      // Storage unavailable: the hint just shows again next time.
    }
  };

  const { mutate: renameCanvasMutate } = useMutation({
    mutationFn: updateBotCanvas,
    meta: { showToast: false },
    onSuccess: () => {
      dismissRenameHint();
      toast.success("Flow renamed.");
      refetchCanvas();
      queryClient.invalidateQueries({
        queryKey: ["bot-canvases", orgId]
      });
    },
    onError: () => {
      toast.error("Could not rename this flow.");
    }
  });

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["bot-status", orgId],
    queryFn: getBotStatus,
    enabled: Boolean(orgId)
  });

  const status = statusData?.data?.status;
  const isLiveView = canvasMode === "live";
  const publishedState = getPublishedStateFromResponse(canvasData);
  const draftChanges = canvasData?.data?.draftChanges;
  const hasLiveVersion =
    canvasData?.data?.live?.hasLiveVersion ?? Boolean(publishedState);
  const neverLive = draftChanges?.neverPublished ?? !hasLiveVersion;

  const { publishedNodes, publishedEdges } = useMemo(() => {
    const nextNodes = publishedState?.nodes?.length
      ? decorateAutomaticFollowUps(
          applyDefaultMarker(
            publishedState.nodes.map(toReactNode),
            publishedState.defaultTriggerKey
          )
        )
      : [];
    return {
      publishedNodes: nextNodes,
      publishedEdges: addMissingWires(
        nextNodes,
        canvasEdgesToFlow(publishedState?.edges, nextNodes)
      )
    };
  }, [publishedState]);

  const selectedNode = useMemo(
    () =>
      (isLiveView ? publishedNodes : nodes).find(
        (node) => node.id === selectedNodeId
      ) || null,
    [isLiveView, nodes, publishedNodes, selectedNodeId]
  );
  const selectedFollowUpNode = useMemo(() => {
    if (!selectedNode?.data.followUp?.enabled) return null;
    const sourceNodes = isLiveView ? publishedNodes : nodes;
    return (
      sourceNodes.find(
        (node) =>
          node.data.triggerKey === selectedNode.data.followUp?.targetTriggerKey
      ) || null
    );
  }, [isLiveView, nodes, publishedNodes, selectedNode]);

  const rawVisibleEdges = isLiveView ? publishedEdges : edges;
  const visibleEdges = useMemo(
    () =>
      rawVisibleEdges.map((edge) => {
        const connectedToSelected =
          Boolean(selectedNodeId) &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const selected = edge.id === selectedEdgeId;
        return {
          ...edge,
          type: "smoothstep",
          selected,
          hidden: !wiresVisible && !connectedToSelected && !selected,
          style:
            connectedToSelected || selected
              ? { ...edge.style, ...selectedFlowEdgeStyle }
              : { ...edge.style, ...flowEdgeStyle }
        };
      }),
    [rawVisibleEdges, selectedEdgeId, selectedNodeId, wiresVisible]
  );

  // Display-only extras for each block: where its options lead, the worst
  // problem on it, and whether it differs from the live version.
  const visibleNodes = useMemo(() => {
    const sourceNodes = isLiveView ? publishedNodes : nodes;
    const nameById = new Map(
      sourceNodes.map((node) => [node.id, node.data.label])
    );
    const targetsByNode = new Map<string, Record<string, string>>();
    rawVisibleEdges.forEach((edge) => {
      const targetName = nameById.get(edge.target);
      if (!edge.sourceHandle || !targetName) return;
      const targets = targetsByNode.get(edge.source) || {};
      targets[edge.sourceHandle] = targetName;
      targetsByNode.set(edge.source, targets);
    });

    const severityByNode = new Map<string, "error" | "warning">();
    if (!isLiveView) {
      issues.forEach((issue) => {
        if (!issue.nodeId) return;
        // A hidden follow-up message reports on the block that sends it.
        const node = sourceNodes.find((item) => item.id === issue.nodeId);
        const nodeId =
          node?.hidden && node.data.metadata?.followUpSourceId
            ? String(node.data.metadata.followUpSourceId)
            : issue.nodeId;
        if (severityByNode.get(nodeId) !== "error") {
          severityByNode.set(nodeId, issue.severity);
        }
      });
    }
    const changedIds = new Set(
      isLiveView || draftChanges?.neverPublished
        ? []
        : [
            ...(draftChanges?.changedBlockIds || []),
            ...(draftChanges?.addedBlockIds || [])
          ]
    );

    return sourceNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        targets: targetsByNode.get(node.id),
        issueSeverity: severityByNode.get(node.id),
        changed: changedIds.has(node.id)
      }
    }));
  }, [
    draftChanges,
    isLiveView,
    issues,
    nodes,
    publishedNodes,
    rawVisibleEdges
  ]);

  const buildDraftState = useCallback(
    (currentNodes = nodes, currentEdges = edges): BotCanvasDraftState => {
      const publishNodes = ensureUniqueNodeTriggers(
        ensureRequiredNodes(currentNodes)
      );
      const targetByAction = buildTargetByAction(currentEdges, publishNodes);

      return {
        version: 1,
        defaultTriggerKey:
          publishNodes.find((node) =>
            Boolean(
              (node.data.metadata as Record<string, unknown> | undefined)
                ?.isDefault
            )
          )?.data.triggerKey ||
          publishNodes.find(
            (node) =>
              node.data.triggerKey !== "OPT_IN" &&
              node.data.triggerKey !== "OPT_OUT"
          )?.data.triggerKey ||
          "DEFAULT",
        nodes: publishNodes.map((node, index) => {
          const content = prepareNodeContent(node);
          const actions =
            node.data.blockType === "generic_carousel"
              ? getContentActions(node.data.blockType, content)
              : node.data.actions;

          return {
            id: node.id,
            type: "botBlock",
            position: node.position,
            data: {
              triggerKey: node.data.triggerKey,
              blockType: node.data.blockType,
              name: node.data.label,
              sortOrder: index,
              content,
              actions: actions.map((action) => ({
                ...action,
                nextTriggerKey:
                  action.type === "go_to_trigger"
                    ? targetByAction.get(`${node.id}:${action.actionId}`) ||
                      action.nextTriggerKey
                    : undefined
              })),
              followUp: node.data.followUp,
              metadata: {
                ...node.data.metadata,
                locked: node.data.locked || undefined
              }
            }
          };
        }) as unknown as BotCanvasNode[],
        edges: flowEdgesToBackend(currentEdges, publishNodes),
        updatedAt: new Date().toISOString()
      };
    },
    [edges, nodes]
  );

  const openConflict = useCallback(
    (details: BotDraftConflictDetails, retry: DraftConflict["retry"]) => {
      conflictRef.current = true;
      setConflict({ details, retry });
      setSaveState("error");
    },
    []
  );

  // Runs the backend's checks on the saved draft. Debounced, and a response
  // that a newer check has overtaken is dropped.
  const scheduleValidate = useCallback(
    (delay = 600, refreshCanvas = true) => {
      window.clearTimeout(validateTimerRef.current);
      validateTimerRef.current = window.setTimeout(async () => {
        const requestId = ++validateRequestRef.current;
        // Refreshes the change markers alongside.
        if (refreshCanvas) void refetchCanvas();
        try {
          const response = await validateBotCanvasById(canvasId);
          if (requestId !== validateRequestRef.current) return;
          setIssues(response.data?.validation?.issues || []);
          setAnalysis(response.data?.validation?.analysis);
        } catch {
          // Keep the last result; the next save checks again.
        }
      }, delay);
    },
    [canvasId, refetchCanvas]
  );

  useEffect(() => () => window.clearTimeout(validateTimerRef.current), []);

  // A save returns the new change summary, so the change markers update
  // without fetching the canvas again.
  const applyDraftChanges = useCallback(
    (changes: BotDraftChanges) => {
      queryClient.setQueryData<BotCanvasResponse>(
        ["bot-canvas", orgId, canvasId],
        (current) =>
          current
            ? {
                ...current,
                data: { ...current.data, draftChanges: changes }
              }
            : current
      );
    },
    [canvasId, orgId, queryClient]
  );

  const markSaved = useCallback(
    (signature: string, revision: number | undefined) => {
      if (typeof revision === "number") draftRevisionRef.current = revision;
      savedSignatureRef.current = signature;
      const latest = latestDraftRef.current;
      const stillPending = latest
        ? draftSignature(latest) !== signature
        : false;
      hasPendingEditsRef.current = stillPending;
      setHasUnsavedEdits(stillPending);
      if (stillPending && latest) {
        writeCachedDraft(orgId, canvasId, latest, draftRevisionRef.current);
        setPendingVersion((value) => value + 1);
      } else {
        clearCachedDraft(orgId, canvasId);
      }
      setSaveState("saved");
      setLastSavedAt(formatTime());
    },
    [canvasId, orgId]
  );

  // The only save: autosave, the header's Retry and "Keep mine" all run
  // this. Saves never overlap, so each one sends the revision the last
  // one returned.
  const saveNow = useCallback(async (): Promise<boolean> => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    const draft = latestDraftRef.current;
    if (conflictRef.current || !draft || !hasPendingEditsRef.current) {
      return !conflictRef.current;
    }
    const signature = draftSignature(draft);
    const run = (async () => {
      setSaveState("saving");
      try {
        const response = await saveBotCanvasDraftById({
          canvasId,
          draftState: draft,
          baseRevision: draftRevisionRef.current
        });
        markSaved(
          signature,
          response.data?.draftRevision ?? response.data?.canvas?.draftRevision
        );
        const savedChanges = response.data?.draftChanges;
        if (savedChanges) {
          applyDraftChanges(savedChanges);
          scheduleValidate(600, false);
        } else {
          // Older backends don't return draftChanges: refetch the canvas.
          scheduleValidate();
        }
        return true;
      } catch (error) {
        const draftConflict = getDraftConflict(error);
        if (draftConflict) {
          openConflict(draftConflict.details, { kind: "save" });
        } else {
          setSaveState("error");
        }
        return false;
      }
    })();
    saveInFlightRef.current = run;
    try {
      return await run;
    } finally {
      if (saveInFlightRef.current === run) saveInFlightRef.current = null;
    }
  }, [applyDraftChanges, canvasId, markSaved, openConflict, scheduleValidate]);

  const applyDraft = useCallback(
    (draft: BotCanvasDraftState | null | undefined) => {
      const loaded = buildEditorState(draft);
      setNodes(loaded.nodes);
      setEdges(loaded.edges);
      setSelectedNodeId(loaded.nodes[0]?.id || null);
      setSelectedEdgeId(null);
      return loaded;
    },
    [setEdges, setNodes]
  );

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0
    });
  }, []);

  // Called on every committed change. Only a change to what's saved (not
  // selection) becomes an undo step.
  const recordSnapshot = useCallback(
    (snapshot: FlowSnapshot) => {
      if (isDraggingRef.current || isArrangingRef.current) return;
      const previous = snapshotRef.current;
      snapshotRef.current = snapshot;
      if (!previous || previous.signature === snapshot.signature) return;
      const now = Date.now();
      historyRef.current =
        now - lastRecordAtRef.current > HISTORY_COALESCE_MS
          ? recordHistory(historyRef.current, previous)
          : { ...historyRef.current, future: [] };
      lastRecordAtRef.current = now;
      syncHistoryState();
    },
    [syncHistoryState]
  );

  // A different draft came from the server; there's nothing to undo to.
  const resetHistory = useCallback(() => {
    historyRef.current = emptyHistory();
    snapshotRef.current = null;
    lastRecordAtRef.current = 0;
    syncHistoryState();
  }, [syncHistoryState]);

  const stepHistory = (direction: "undo" | "redo") => {
    const current = snapshotRef.current;
    if (isLiveView || !current) return;
    const result =
      direction === "undo"
        ? undoHistory(historyRef.current, current)
        : redoHistory(historyRef.current, current);
    if (!result) return;
    historyRef.current = result.history;
    // Already the recorded state, so restoring it isn't a new step.
    snapshotRef.current = result.snapshot;
    lastRecordAtRef.current = 0;
    setNodes(result.snapshot.nodes);
    setEdges(result.snapshot.edges);
    syncHistoryState();
  };

  useEffect(() => {
    if (!canvasData || hydratedRef.current) return;
    hydratedRef.current = true;
    const serverDraft = getDraftStateFromResponse(canvasData);
    const serverRevision =
      canvasData.data?.draftRevision ?? canvasData.data?.canvas?.draftRevision;
    draftRevisionRef.current = serverRevision;
    // Whatever just loaded (including a starter swap) is the baseline;
    // nothing is saved or cached until the user changes it.
    savedSignatureRef.current = null;
    hasPendingEditsRef.current = false;
    resetHistory();
    const loaded = applyDraft(serverDraft);

    const cached = readCachedDraft(orgId, canvasId);
    if (shouldOfferCachedDraft(cached, serverRevision, serverDraft)) {
      setCachedOffer(cached);
    } else {
      clearCachedDraft(orgId, canvasId);
    }
    // A starter swap isn't saved yet, so the server's checks would be about
    // blocks that aren't on screen.
    if (!loaded.useStarter) scheduleValidate(0, false);
  }, [applyDraft, canvasData, canvasId, orgId, resetHistory, scheduleValidate]);

  useEffect(() => {
    if (isLiveView || !hydratedRef.current || !nodes.length) return;
    const draft = buildDraftState();
    const signature = draftSignature(draft);
    latestDraftRef.current = draft;
    recordSnapshot({ nodes, edges, signature });
    if (savedSignatureRef.current === null) {
      savedSignatureRef.current = signature;
      return;
    }
    const wasPending = hasPendingEditsRef.current;
    hasPendingEditsRef.current = signature !== savedSignatureRef.current;
    setHasUnsavedEdits(hasPendingEditsRef.current);
    if (hasPendingEditsRef.current) {
      writeCachedDraft(orgId, canvasId, draft, draftRevisionRef.current);
      setPendingVersion((value) => value + 1);
    } else if (wasPending) {
      clearCachedDraft(orgId, canvasId);
    }
    // nodes/edges change exactly when buildDraftState does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildDraftState, canvasId, isLiveView, orgId, recordSnapshot]);

  // Autosave, 2.5 s after the last change. Paused while a conflict is open.
  useEffect(() => {
    if (!pendingVersion || conflict) return;
    const timer = window.setTimeout(() => void saveNow(), 2500);
    return () => window.clearTimeout(timer);
  }, [conflict, pendingVersion, saveNow]);

  // In-app navigation flushes a pending save. Closing the tab can't (the
  // request is usually dropped), so the browser asks "Leave site?" instead;
  // the edits stay in this browser's cache either way.
  useEffect(() => {
    if (!orgId || !canvasId) return;
    const flushPendingSave = () => {
      const draft = latestDraftRef.current;
      if (!draft || !hasPendingEditsRef.current || conflictRef.current) return;
      hasPendingEditsRef.current = false;
      const send = () =>
        saveBotCanvasDraftById({
          canvasId,
          draftState: draft,
          baseRevision: draftRevisionRef.current
        }).catch(() => undefined);
      const inFlight = saveInFlightRef.current;
      void (inFlight ? inFlight.then(send, send) : send());
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasPendingEditsRef.current && !saveInFlightRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    router.events.on("routeChangeStart", flushPendingSave);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      flushPendingSave();
      router.events.off("routeChangeStart", flushPendingSave);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [canvasId, orgId, router.events]);

  // Selects a block and centres it on the canvas.
  const focusNode = useCallback(
    (nodeId: string, request?: Omit<FocusRequest, "nodeId" | "nonce">) => {
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      setCanvasMode("draft");
      setSelectedEdgeId(null);
      setSelectedNodeId(node.id);
      setRightPanelOpen(true);
      const width = node.measured?.width ?? 300;
      const height = node.measured?.height ?? 200;
      void reactFlow?.setCenter(
        node.position.x + width / 2,
        node.position.y + height / 2,
        { zoom: Math.max(reactFlow.getZoom(), 0.9), duration: 300 }
      );
      if (request) {
        setFocusRequest({ ...request, nodeId: node.id, nonce: Date.now() });
      }
    },
    [reactFlow]
  );

  const focusIssue = useCallback(
    (issue: BotFlowIssue) => {
      if (!issue.nodeId) return;
      const node = nodesRef.current.find((item) => item.id === issue.nodeId);
      // A follow-up message is edited from the block that sends it.
      const followUpSourceId = node?.data.metadata?.followUpSourceId;
      if (node?.hidden && followUpSourceId) {
        focusNode(String(followUpSourceId), { field: "followUp" });
        return;
      }
      focusNode(issue.nodeId, {
        field: issue.field,
        actionId: issue.actionId
      });
    },
    [focusNode]
  );

  // One request saves, checks and makes the flow live.
  const runGoLive = async () => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (conflictRef.current) return;
    const draft = buildDraftState();
    const signature = draftSignature(draft);
    const wasNeverLive = neverLive;
    try {
      const response = await publishBotCanvasDraftById({
        canvasId,
        draftState: draft,
        baseRevision: draftRevisionRef.current
      });
      markSaved(
        signature,
        response.data?.canvas?.draftRevision ?? response.data?.draftRevision
      );
      setIssues(response.data?.validation?.issues || []);
      setAnalysis(response.data?.validation?.analysis);
      await Promise.all([refetchCanvas(), refetchStatus()]);
      queryClient.invalidateQueries({ queryKey: ["bot-canvases", orgId] });
      toast.success(
        wasNeverLive
          ? "Your flow is live. Customers get the new version from their next message."
          : "Live flow updated."
      );
    } catch (error) {
      const draftConflict = getDraftConflict(error);
      if (draftConflict) {
        openConflict(draftConflict.details, { kind: "go-live" });
        return;
      }
      const invalid = getFlowInvalid(error);
      if (invalid) {
        setIssues(invalid.issues);
        setIssuesOpen(true);
        const first =
          invalid.issues.find((issue) => issue.severity === "error") ||
          invalid.issues[0];
        if (first) focusIssue(first);
        toast.error(invalid.message);
        return;
      }
      toast.error(getApiErrorMessage(error, "Couldn't go live. Try again."));
    }
  };

  const goLive = async () => {
    if (isLiveView || isGoingLive) return;
    // With nothing unsaved, the last check is current: show its errors
    // instead of asking the backend again.
    const errors = issues.filter((issue) => issue.severity === "error");
    if (
      errors.length &&
      !hasPendingEditsRef.current &&
      !saveInFlightRef.current
    ) {
      setIssuesOpen(true);
      focusIssue(errors[0]);
      return;
    }
    setIsGoingLive(true);
    try {
      await runGoLive();
    } finally {
      setIsGoingLive(false);
    }
  };

  // Shows a draft the server just sent (reload, discard, restore) as the
  // new baseline: nothing unsaved, nothing to undo.
  const showServerDraft = (data: BotCanvasResponse["data"]) => {
    draftRevisionRef.current =
      data?.draftRevision ?? data?.canvas?.draftRevision;
    savedSignatureRef.current = null;
    hasPendingEditsRef.current = false;
    setHasUnsavedEdits(false);
    resetHistory();
    applyDraft(data?.canvas?.draftState || data?.draftState);
    clearCachedDraft(orgId, canvasId);
    setCachedOffer(null);
    setCanvasMode("draft");
    if (data?.draftChanges) {
      applyDraftChanges(data.draftChanges);
    } else {
      void refetchCanvas();
    }
    scheduleValidate(0, false);
  };

  const reloadTheirVersion = async () => {
    const result = await refetchCanvas();
    if (!result.data) {
      toast.error("Couldn't load the latest version. Try again.");
      return;
    }
    showServerDraft(result.data.data);
    conflictRef.current = false;
    setConflict(null);
    setSaveState("idle");
  };

  // Discard changes, or copy a version that went live into the editor.
  const replaceDraft = async (
    target: { kind: "discard" } | { kind: "restore"; versionId: string }
  ) => {
    while (saveInFlightRef.current) {
      await saveInFlightRef.current;
    }
    if (conflictRef.current) return false;
    try {
      const response =
        target.kind === "discard"
          ? await discardBotCanvasDraftById({
              canvasId,
              baseRevision: draftRevisionRef.current
            })
          : await restoreBotCanvasVersionById({
              canvasId,
              versionId: target.versionId,
              baseRevision: draftRevisionRef.current
            });
      showServerDraft(response.data);
      setSaveState("saved");
      setLastSavedAt(formatTime());
      toast.success(
        target.kind === "discard"
          ? "Back to the live version."
          : "Version copied into your editor. Update the live flow when you're ready."
      );
      return true;
    } catch (error) {
      const draftConflict = getDraftConflict(error);
      if (draftConflict) {
        openConflict(draftConflict.details, target);
      } else {
        toast.error(
          getApiErrorMessage(
            error,
            target.kind === "discard"
              ? "Couldn't discard the changes. Try again."
              : "Couldn't restore that version. Try again."
          )
        );
      }
      return false;
    }
  };

  const keepMyVersion = () => {
    if (!conflict) return;
    draftRevisionRef.current = conflict.details.draftRevision;
    const { retry } = conflict;
    conflictRef.current = false;
    setConflict(null);
    if (retry.kind === "go-live") {
      void goLive();
    } else if (retry.kind === "save") {
      void saveNow();
    } else {
      void replaceDraft(retry);
    }
  };

  const restoreCachedDraft = () => {
    if (!cachedOffer) return;
    // The server draft stays the baseline, so the restored edits count as
    // unsaved and autosave sends them.
    applyDraft(cachedOffer.draft);
    setCanvasMode("draft");
    setCachedOffer(null);
  };

  const discardCachedDraft = () => {
    clearCachedDraft(orgId, canvasId);
    setCachedOffer(null);
  };

  const updateNode = useCallback(
    (nodeId: string, updater: (data: BuilderNodeData) => BuilderNodeData) => {
      if (isLiveView) {
        toast.info("Go back to editing to change this flow.");
        return;
      }
      const applyUpdate = (
        node: BuilderNode,
        current: BuilderNode[]
      ): BuilderNode => {
        const nextData = updater(node.data);
        const triggerKey =
          node.data.locked || nextData.triggerKey === node.data.triggerKey
            ? nextData.triggerKey
            : makeUniqueTrigger(nextData.triggerKey, current, node.id);
        const content = assignOptionIds(
          nextData.blockType,
          nextData.content,
          node.data.actions
        );
        const actions =
          nextData.blockType === "generic_carousel" ||
          nextData.blockType === "list"
            ? getContentActions(nextData.blockType, content)
            : nextData.actions;
        return {
          ...node,
          data: {
            ...nextData,
            triggerKey,
            content,
            actions,
            summary: summarizeNode(nextData.blockType, content)
          }
        };
      };

      // Options that disappear take exactly their own wires with them.
      const previous = nodesRef.current.find((node) => node.id === nodeId);
      if (previous) {
        const removed = removedOutputHandles(
          previous.data.actions,
          applyUpdate(previous, nodesRef.current).data.actions
        );
        if (removed.length) {
          setEdges((current) =>
            removeEdgesForActions(current, nodeId, removed)
          );
        }
      }
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? applyUpdate(node, current) : node
        )
      );
    },
    [isLiveView, setEdges, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isLiveView) {
        toast.info("Go back to editing to connect blocks.");
        return;
      }
      if (!connection.sourceHandle) return;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: newId("edge"),
            type: "smoothstep",
            animated: false,
            style: flowEdgeStyle
          },
          current.filter(
            (edge) =>
              !(
                edge.source === connection.source &&
                edge.sourceHandle === connection.sourceHandle
              )
          )
        )
      );
    },
    [isLiveView, setEdges]
  );

  const addBlock = useCallback(
    (
      type: BotBlockType,
      position = { x: 260 + nodes.length * 24, y: 260 + nodes.length * 24 }
    ) => {
      if (isLiveView) {
        toast.info("Go back to editing to add blocks.");
        return;
      }
      const node = createNode(type, position);
      node.data.triggerKey = makeUniqueTrigger(node.data.triggerKey, nodes);
      setNodes((current) => [...current, node]);
      setSelectedNodeId(node.id);
      setRightPanelOpen(true);
    },
    [isLiveView, nodes, setNodes]
  );

  const addAutomaticFollowUp = useCallback(() => {
    if (isLiveView) {
      toast.info("Go back to editing to add a follow-up.");
      return;
    }
    if (!selectedNode) {
      toast.error("Select the message that should schedule this follow-up.");
      return;
    }
    if (
      ["OPT_IN", "OPT_OUT"].includes(selectedNode.data.triggerKey) ||
      selectedNode.data.blockType === "handoff_to_agent"
    ) {
      toast.error("This block cannot schedule an automatic follow-up.");
      return;
    }
    if (selectedNode.data.followUp?.enabled) {
      toast.error("This block already has an automatic follow-up.");
      return;
    }

    const followUpNode = createNode(
      "text",
      {
        x: selectedNode.position.x + 380,
        y: selectedNode.position.y + 40
      },
      "Automatic Follow-up",
      {
        metadata: {
          automaticFollowUpTarget: true,
          followUpSourceId: selectedNode.id
        }
      }
    );
    followUpNode.data.triggerKey = makeUniqueTrigger(
      `FOLLOW_UP_${selectedNode.data.triggerKey}`,
      nodes
    );
    followUpNode.hidden = true;
    setNodes((current) => [
      ...current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                followUp: {
                  enabled: true as const,
                  delayMinutes: 60,
                  targetTriggerKey: followUpNode.data.triggerKey
                },
                metadata: {
                  ...node.data.metadata,
                  automaticFollowUp: true,
                  followUpDelayUnit: "minutes"
                }
              }
            }
          : node
      ),
      followUpNode
    ]);
    setRightPanelOpen(true);
  }, [isLiveView, nodes, selectedNode, setNodes]);

  const removeAutomaticFollowUp = useCallback(() => {
    if (isLiveView || !selectedNode?.data.followUp?.enabled) return;
    const targetTriggerKey = selectedNode.data.followUp.targetTriggerKey;
    const target = nodes.find(
      (node) => node.data.triggerKey === targetTriggerKey
    );
    const removeGeneratedTarget = Boolean(
      target?.data.metadata?.automaticFollowUpTarget ||
        target?.data.metadata?.followUpSourceId === selectedNode.id
    );

    setNodes((current) =>
      current
        .filter((node) => !removeGeneratedTarget || node.id !== target?.id)
        .map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: {
                  ...node.data,
                  followUp: undefined,
                  metadata: {
                    ...node.data.metadata,
                    automaticFollowUp: undefined,
                    followUpDelayUnit: undefined
                  }
                }
              }
            : node
        )
    );
    if (removeGeneratedTarget && target) {
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== target.id && edge.target !== target.id
        )
      );
    }
    toast.success("Automatic follow-up removed.");
  }, [isLiveView, nodes, selectedNode, setEdges, setNodes]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/whatching-block") as
        | BotBlockType
        | "automatic_follow_up";
      if (!type || !reactFlow) return;
      if (isLiveView) {
        toast.info("Go back to editing to add blocks.");
        return;
      }
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });
      if (type === "automatic_follow_up") {
        addAutomaticFollowUp();
      } else {
        addBlock(type, position);
      }
    },
    [addAutomaticFollowUp, addBlock, isLiveView, reactFlow]
  );

  const deleteSelectedNode = () => {
    if (isLiveView) {
      toast.info("Go back to editing to delete blocks.");
      return;
    }
    if (!selectedNode) return;
    if (
      Boolean(
        (selectedNode.data.metadata as Record<string, unknown> | undefined)
          ?.isDefault
      )
    ) {
      toast.error(
        "Choose another block as the start block before deleting this one."
      );
      return;
    }
    if (selectedNode.data.locked) {
      toast.error("System blocks cannot be deleted.");
      return;
    }
    const followUpTarget = selectedNode.data.followUp?.enabled
      ? nodes.find(
          (node) =>
            node.data.triggerKey ===
            selectedNode.data.followUp?.targetTriggerKey
        )
      : undefined;
    const cascadesFollowUp = Boolean(
      followUpTarget?.data.metadata?.automaticFollowUpTarget
    );
    const nodeIdsToDelete = new Set([
      selectedNode.id,
      ...(cascadesFollowUp ? [followUpTarget!.id] : [])
    ]);
    setNodeDeletionRequest({
      ids: nodeIdsToDelete,
      label: selectedNode.data.label || "This block",
      cascadesFollowUp,
      reachedFrom: (analysis?.[selectedNode.id]?.entryPoints || []).map(
        describeEntryPoint
      )
    });
  };

  const commitNodeDeletion = (nodeIdsToDelete: Set<string>) => {
    setNodes((current) =>
      current.filter((node) => !nodeIdsToDelete.has(node.id))
    );
    setEdges((current) =>
      current.filter(
        (edge) =>
          !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target)
      )
    );
    setSelectedNodeId((current) =>
      current && nodeIdsToDelete.has(current) ? null : current
    );
  };

  const handleNodesChange = useCallback(
    (changes: NodeChange<BuilderNode>[]) => {
      const lockedNodeIds = new Set(
        nodes.filter((node) => node.data.locked).map((node) => node.id)
      );
      const defaultNodeIds = new Set(
        nodes
          .filter((node) =>
            Boolean(
              (node.data.metadata as Record<string, unknown> | undefined)
                ?.isDefault
            )
          )
          .map((node) => node.id)
      );
      const defaultRemoval = changes.some(
        (change) => change.type === "remove" && defaultNodeIds.has(change.id)
      );
      const lockedRemoval = changes.some(
        (change) => change.type === "remove" && lockedNodeIds.has(change.id)
      );

      if (defaultRemoval) {
        toast.error(
          "Choose another block as the start block before deleting this one."
        );
      } else if (lockedRemoval) {
        toast.error("System blocks cannot be deleted.");
      }

      const removableIds = changes
        .filter(
          (
            change
          ): change is Extract<NodeChange<BuilderNode>, { type: "remove" }> =>
            change.type === "remove" &&
            !defaultNodeIds.has(change.id) &&
            !lockedNodeIds.has(change.id)
        )
        .map((change) => change.id);
      // Node deletion (keyboard Delete/Backspace on the canvas) skips
      // straight to removal otherwise -- route it through the same
      // confirmation as the panel's delete button so a follow-up-linked
      // node can't be cascade-deleted with zero warning.
      if (removableIds.length) {
        const removableIdSet = new Set(removableIds);
        const cascadeIds = new Set<string>();
        nodes.forEach((node) => {
          const followUpTarget = node.data.followUp?.enabled
            ? nodes.find(
                (candidate) =>
                  candidate.data.triggerKey ===
                  node.data.followUp?.targetTriggerKey
              )
            : undefined;
          if (
            removableIdSet.has(node.id) &&
            followUpTarget?.data.metadata?.automaticFollowUpTarget
          ) {
            cascadeIds.add(followUpTarget.id);
          }
        });
        const allIds = new Set([...removableIdSet, ...cascadeIds]);
        const label =
          removableIds.length === 1
            ? nodes.find((node) => node.id === removableIds[0])?.data.label ||
              "This block"
            : `${removableIds.length} blocks`;
        setNodeDeletionRequest({
          ids: allIds,
          label,
          cascadesFollowUp: cascadeIds.size > 0,
          reachedFrom:
            removableIds.length === 1
              ? (analysis?.[removableIds[0]]?.entryPoints || []).map(
                  describeEntryPoint
                )
              : undefined
        });
      }

      const allowedChanges = changes.filter(
        (change) => change.type !== "remove"
      );
      if (!allowedChanges.length) return;
      onNodesChange(allowedChanges);
    },
    [analysis, nodes, onNodesChange]
  );

  const selectMedia = (media: MediaAsset) => {
    if (isLiveView) {
      toast.info("Go back to editing to change media.");
      return;
    }
    const targetNode =
      nodes.find((node) => node.id === mediaPicker.target.nodeId) ||
      selectedNode;
    if (!targetNode) return;
    if (mediaPicker.target.kind === "carousel-card") {
      const cardIndex = mediaPicker.target.cardIndex;
      updateNode(targetNode.id, (data) => {
        const cards = getCarouselCards(data.content);
        const card = cards[cardIndex];
        if (!card) return data;
        const nextCards = cards.map((item, index) =>
          index === cardIndex
            ? {
                ...item,
                mediaId: media._id,
                mediaName: media.name,
                mediaType: media.fileType,
                mediaUrl: media.cloudinaryUrl,
                filename: media.fileType === "document" ? media.name : undefined
              }
            : item
        );
        return {
          ...data,
          content: {
            ...data.content,
            cards: nextCards
          }
        };
      });
    } else {
      updateNode(targetNode.id, (data) => ({
        ...data,
        content: {
          ...data.content,
          mediaId: media._id,
          mediaName: media.name,
          mediaType: media.fileType,
          mediaUrl: media.cloudinaryUrl,
          filename: media.fileType === "document" ? media.name : undefined
        }
      }));
    }
    setMediaPicker((current) => ({ ...current, open: false }));
  };

  const enterLiveView = () => {
    setCanvasMode("live");
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };
  const exitLiveView = () => {
    setCanvasMode("draft");
    setSelectedNodeId(null);
  };

  // Points an option at a block (or at nothing). Same as dragging a wire.
  const connectOption = (
    nodeId: string,
    actionId: string,
    targetId: string | null
  ) => {
    if (isLiveView) return;
    setEdges((current) => {
      const rest = removeEdgesForAction(current, nodeId, actionId);
      return targetId
        ? [
            ...rest,
            {
              id: newId("edge"),
              source: nodeId,
              sourceHandle: actionId,
              target: targetId,
              targetHandle: "in",
              type: "smoothstep",
              animated: false,
              style: flowEdgeStyle
            }
          ]
        : rest;
    });
  };

  // "+ New block" on an option: a new block to the right, wired and selected.
  const createConnectedBlock = (
    nodeId: string,
    actionId: string,
    type: BotBlockType
  ) => {
    if (isLiveView) return;
    const source = nodes.find((node) => node.id === nodeId);
    if (!source) return;
    const siblings = edges.filter((edge) => edge.source === nodeId).length;
    const node = createNode(type, {
      x: source.position.x + 380,
      y: source.position.y + siblings * 60
    });
    node.data.triggerKey = makeUniqueTrigger(node.data.triggerKey, nodes);
    setNodes((current) => [...current, node]);
    connectOption(nodeId, actionId, node.id);
    setSelectedNodeId(node.id);
    setFocusRequest({ nodeId: node.id, tab: "message", nonce: Date.now() });
  };

  // A copy with new IDs for the block, its options and reply IDs, and no
  // wires. A follow-up isn't copied: it is a block of its own.
  const duplicateNode = (nodeId: string) => {
    if (isLiveView) return;
    const source = nodes.find((node) => node.id === nodeId);
    if (!source || source.hidden) return;
    const { content, actions } = cloneBlockOptions(
      source.data.blockType,
      source.data.content,
      source.data.actions
    );
    const label = `${source.data.label} copy`;
    // The copy is never the start block, locked, or a follow-up sender.
    const metadata = Object.fromEntries(
      Object.entries(source.data.metadata || {}).filter(
        ([key]) =>
          ![
            "isDefault",
            "locked",
            "automaticFollowUp",
            "followUpDelayUnit"
          ].includes(key)
      )
    );
    const copy = createNode(
      source.data.blockType,
      { x: source.position.x + 40, y: source.position.y + 40 },
      label,
      { content, actions, metadata }
    );
    copy.data.triggerKey = makeUniqueTrigger(slugifyTrigger(label), nodes);
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      { ...copy, selected: true }
    ]);
    setSelectedNodeId(copy.id);
    toast.success(`Duplicated "${source.data.label}".`);
  };

  // Left-to-right layout from the start block; opt-in/opt-out get their own
  // column. Animated, and one undo step.
  const autoArrange = async () => {
    if (isLiveView || !reactFlow || isArrangingRef.current) return;
    const visible = nodes.filter((node) => !node.hidden);
    const isSystem = (node: BuilderNode) =>
      node.data.triggerKey === "OPT_IN" || node.data.triggerKey === "OPT_OUT";
    const main = visible.filter((node) => !isSystem(node));
    const system = visible.filter(isSystem);
    if (!main.length) return;
    const sizeOf = (node: BuilderNode) => {
      const internal = reactFlow.getInternalNode(node.id);
      return {
        width: internal?.measured.width || 300,
        height: internal?.measured.height || 200
      };
    };
    const sizes = new Map(main.map((node) => [node.id, sizeOf(node)]));
    const handles = new Map(
      main.map((node) => [
        node.id,
        (
          reactFlow.getInternalNode(node.id)?.internals.handleBounds?.source ||
          []
        )
          .filter((handle) => handle.id)
          .map((handle) => ({
            id: String(handle.id),
            y: handle.y + handle.height / 2
          }))
      ])
    );
    const startId =
      main.find((node) => Boolean(node.data.metadata?.isDefault))?.id ||
      main[0].id;

    setIsArranging(true);
    isArrangingRef.current = true;
    try {
      const laidOut = await layoutFlow({
        nodes: main,
        edges,
        sizes,
        handles,
        firstNodeId: startId
      });
      // Keep the start block where it is; everything else moves around it.
      const startNode = main.find((node) => node.id === startId)!;
      const startTarget = laidOut.get(startId) || startNode.position;
      const dx = startNode.position.x - startTarget.x;
      const dy = startNode.position.y - startTarget.y;
      const targets = new Map<string, { x: number; y: number }>();
      laidOut.forEach((position, id) =>
        targets.set(id, { x: position.x + dx, y: position.y + dy })
      );
      const right = Math.max(
        ...main.map(
          (node) =>
            (targets.get(node.id)?.x ?? node.position.x) +
            (sizes.get(node.id)?.width || 300)
        )
      );
      let systemY = Math.min(...[...targets.values()].map((point) => point.y));
      system.forEach((node) => {
        targets.set(node.id, { x: right + 160, y: systemY });
        systemY += sizeOf(node).height + 40;
      });

      const starts = new Map(
        visible.map((node) => [node.id, { ...node.position }])
      );
      await new Promise<void>((resolve) => {
        const began = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - began) / ARRANGE_DURATION_MS);
          const eased = 1 - Math.pow(1 - progress, 3);
          setNodes((current) =>
            current.map((node) => {
              const from = starts.get(node.id);
              const to = targets.get(node.id);
              if (!from || !to) return node;
              return {
                ...node,
                position: {
                  x: from.x + (to.x - from.x) * eased,
                  y: from.y + (to.y - from.y) * eased
                }
              };
            })
          );
          if (progress < 1) {
            window.requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        window.requestAnimationFrame(step);
      });
    } catch {
      toast.error("Couldn't arrange the blocks. Try again.");
    } finally {
      isArrangingRef.current = false;
      setIsArranging(false);
      // One more pass so the finished layout is recorded as one undo step.
      setNodes((current) => [...current]);
    }
    void reactFlow.fitView({ padding: 0.2, duration: 300 });
  };

  // Undo/redo and duplicate from the keyboard. Inside a text field the
  // browser's own undo applies.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || isLiveView) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        stepHistory("undo");
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        stepHistory("redo");
      } else if (key === "d" && selectedNodeId) {
        event.preventDefault();
        duplicateNode(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const canvasName = canvasData?.data?.canvas?.name || "";
  const isDefaultFlowName = !canvasName || canvasName === DEFAULT_FLOW_NAME;
  const changeCount = draftChanges?.changedBlockCount ?? 0;
  const conflictName = conflict?.details.updatedBy?.name || "Someone";
  const conflictTime = conflict?.details.updatedAt
    ? formatTime(conflict.details.updatedAt)
    : "just now";
  const flowStatus = getFlowStatus(canvasData?.data?.live, draftChanges);
  const liveSince =
    hasLiveVersion && publishedState?.publishedAt
      ? formatLiveDate(publishedState.publishedAt)
      : "";
  const primaryAction = getPrimaryAction(
    draftChanges,
    hasLiveVersion,
    hasUnsavedEdits
  );
  const canDiscard =
    hasLiveVersion &&
    !neverLive &&
    (hasUnsavedEdits || Boolean(draftChanges?.hasUnpublishedChanges));
  const testStart =
    selectedNode && !selectedNode.hidden && !isLiveView
      ? { nodeId: selectedNode.id, label: selectedNode.data.label }
      : null;
  const blockChoices = nodes
    .filter((node) => !node.hidden)
    .map((node) => ({ id: node.id, label: node.data.label }));
  const selectedTargets = selectedNode
    ? Object.fromEntries(
        edges
          .filter(
            (edge) => edge.source === selectedNode.id && edge.sourceHandle
          )
          .map((edge) => [String(edge.sourceHandle), edge.target])
      )
    : {};

  const statusPill = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        flowStatus.tone === "green" && "bg-emerald-50 text-emerald-800",
        flowStatus.tone === "amber" && "bg-amber-50 text-amber-800",
        flowStatus.tone === "grey" && "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          flowStatus.tone === "green" && "bg-emerald-500",
          flowStatus.tone === "amber" && "bg-amber-500",
          flowStatus.tone === "grey" && "bg-slate-400"
        )}
      />
      {flowStatus.label}
    </span>
  );

  return (
    <AppLayout hideHeader fullBleed>
      <div className="flex h-dvh flex-col overflow-hidden border bg-white shadow-xs">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-white px-4 py-2">
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <Link href="/bot/flows" className="flex items-center gap-1.5">
              <ArrowLeft className="size-4" />
              Flows
            </Link>
          </Button>
          <div className="min-w-0">
            <InlineEditableTitle
              value={isDefaultFlowName ? "" : canvasName}
              placeholder="Untitled flow"
              className="font-heading text-xl font-semibold"
              disabled={!canvasName}
              onSave={(name) => renameCanvasMutate({ canvasId, name })}
            />
            {isDefaultFlowName && !hasSeenRenameHint && (
              <p className="flex items-center gap-2 text-xs text-primary">
                Click the name to give this flow a name your team will
                recognise.
                <button
                  type="button"
                  className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline"
                  onClick={dismissRenameHint}
                >
                  Got it
                </button>
              </p>
            )}
          </div>
          {flowStatus.href ? (
            <Link href={flowStatus.href} className="hover:opacity-80">
              {statusPill}
            </Link>
          ) : liveSince || flowStatus.numbers?.length ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{statusPill}</span>
              </TooltipTrigger>
              <TooltipContent>
                {[
                  flowStatus.numbers?.length
                    ? `Answers on ${flowStatus.numbers.join(", ")}`
                    : "",
                  liveSince ? `Live since ${liveSince}` : ""
                ]
                  .filter(Boolean)
                  .join(". ")}
              </TooltipContent>
            </Tooltip>
          ) : (
            statusPill
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {saveState === "saving" ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </span>
              ) : saveState === "error" ? (
                <span className="text-destructive">
                  Couldn&apos;t save ·{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-medium underline-offset-2 hover:underline"
                    onClick={() => void saveNow()}
                  >
                    Retry
                  </button>
                </span>
              ) : saveState === "saved" && lastSavedAt ? (
                `Saved ${lastSavedAt}`
              ) : null}
            </span>
            <Button
              variant="outline"
              disabled={!visibleNodes.length}
              onClick={() => setFlowPreviewOpen(true)}
            >
              <Play className="size-4" />
              Test
            </Button>
            <Button
              onClick={() => void goLive()}
              disabled={
                isGoingLive ||
                isLiveView ||
                isCanvasLoading ||
                primaryAction.disabled
              }
            >
              {isGoingLive ? (
                <Loader2 className="size-4 animate-spin" />
              ) : primaryAction.disabled ? (
                <Check className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {primaryAction.label}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="More flow actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!hasLiveVersion || isLiveView}
                  onSelect={enterLiveView}
                >
                  <Eye className="size-4" />
                  View live version
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canDiscard || isLiveView}
                  onSelect={() => setDiscardOpen(true)}
                >
                  <Undo2 className="size-4" />
                  Discard changes
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canvasName}
                  onSelect={() => {
                    setRenameValue(isDefaultFlowName ? "" : canvasName);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
                  <History className="size-4" />
                  Version history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {cachedOffer && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-900">
            You have unsaved changes from {formatTime(cachedOffer.savedAt)}.
            <Button
              size="sm"
              variant="outline"
              className="h-7 bg-white"
              onClick={restoreCachedDraft}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={discardCachedDraft}
            >
              Discard
            </Button>
          </div>
        )}

        <div className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 lg:hidden">
          The flow builder is drag-and-drop and works best on a larger screen.
          Some panels may be hard to use here.
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_340px]">
          <aside className="overflow-y-auto border-r bg-muted/30 p-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <FlowBlockLibrary
              readOnly={isLiveView}
              nodes={visibleNodes}
              selectedNodeId={selectedNodeId}
              onAdd={(type) => addBlock(type)}
              onSelectNode={(nodeId) => focusNode(nodeId)}
            />
          </aside>

          <main
            className="relative min-h-[560px] bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:24px_24px]"
            onDrop={handleDrop}
            onDragOver={(event) => {
              if (isLiveView) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
          >
            {isCanvasLoading ? (
              <CanvasLoadingSkeleton />
            ) : (
              <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                onInit={setReactFlow}
                onNodesChange={isLiveView ? undefined : handleNodesChange}
                onEdgesChange={isLiveView ? undefined : onEdgesChange}
                onConnect={onConnect}
                onNodeDragStart={() => {
                  isDraggingRef.current = true;
                }}
                onNodeDragStop={() => {
                  isDraggingRef.current = false;
                }}
                connectionLineType={ConnectionLineType.SmoothStep}
                defaultEdgeOptions={{
                  type: "smoothstep",
                  style: flowEdgeStyle
                }}
                onlyRenderVisibleElements
                onNodeClick={(_, node) => {
                  setSelectedEdgeId(null);
                  setSelectedNodeId(node.id);
                  setRightPanelOpen(true);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                }}
                fitView
                minZoom={0.2}
                maxZoom={1.4}
                nodesDraggable={!isLiveView}
                nodesConnectable={!isLiveView}
                elementsSelectable
                deleteKeyCode={
                  isLiveView || selectedNode?.data.locked
                    ? null
                    : ["Backspace", "Delete"]
                }
              >
                <Background />
                <FlowCanvasToolbar
                  readOnly={isLiveView}
                  canUndo={historyState.canUndo}
                  canRedo={historyState.canRedo}
                  onUndo={() => stepHistory("undo")}
                  onRedo={() => stepHistory("redo")}
                  onZoomIn={() => void reactFlow?.zoomIn({ duration: 200 })}
                  onZoomOut={() => void reactFlow?.zoomOut({ duration: 200 })}
                  onFit={() =>
                    void reactFlow?.fitView({ padding: 0.2, duration: 300 })
                  }
                  onArrange={() => void autoArrange()}
                  isArranging={isArranging}
                  wiresVisible={wiresVisible}
                  onToggleWires={() => setWiresVisible((value) => !value)}
                  minimapVisible={minimapVisible}
                  onToggleMinimap={() => setMinimapVisible((value) => !value)}
                />
                {minimapVisible && (
                  <MiniMap
                    zoomable
                    pannable
                    nodeStrokeWidth={3}
                    style={{ width: 160, height: 110 }}
                    className="!rounded-lg !border !bg-white/90 !shadow-sm"
                  />
                )}
              </ReactFlow>
            )}
            {isLiveView && (
              <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-sky-50 px-4 py-2 text-sm text-sky-900">
                <span>
                  You&apos;re viewing the live version. It&apos;s read-only.
                </span>
                <Button size="sm" variant="outline" onClick={exitLiveView}>
                  Back to editing
                </Button>
              </div>
            )}
            {selectedEdgeId && !isLiveView && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-4 top-4 z-10 border-destructive/30 bg-white/95 text-destructive shadow-xs"
                tooltip="Delete selected connection"
                onClick={() => {
                  setEdges((current) =>
                    current.filter((edge) => edge.id !== selectedEdgeId)
                  );
                  setSelectedEdgeId(null);
                }}
              >
                <Trash2 className="size-4" />
                Delete connection
              </Button>
            )}
            {!isLiveView && issues.length > 0 && (
              <IssuesBar
                issues={issues}
                open={issuesOpen}
                onOpenChange={setIssuesOpen}
                onSelect={focusIssue}
                className={minimapVisible ? "right-48" : "right-4"}
              />
            )}
          </main>

          <PropertiesPanel
            open={rightPanelOpen}
            node={selectedNode}
            followUpNode={selectedFollowUpNode}
            readOnly={isLiveView}
            updateNode={updateNode}
            removeEdgesForAction={(actionId) => {
              if (!selectedNode) return;
              setEdges((current) =>
                removeEdgesForAction(current, selectedNode.id, actionId)
              );
            }}
            setDefaultNode={(nodeId) => {
              setNodes((current) =>
                current.map((item) => ({
                  ...item,
                  data: {
                    ...item.data,
                    metadata: {
                      ...((item.data.metadata as Record<string, unknown>) ||
                        {}),
                      isDefault: item.id === nodeId || undefined
                    }
                  }
                }))
              );
            }}
            openMediaPicker={(type, target = { kind: "node" }) =>
              setMediaPicker({ open: true, type, target })
            }
            openLocationPicker={() => setLocationPickerOpen(true)}
            addAutomaticFollowUp={addAutomaticFollowUp}
            removeAutomaticFollowUp={removeAutomaticFollowUp}
            focusRequest={focusRequest}
            status={status}
            blockChoices={blockChoices}
            targets={selectedTargets}
            connectOption={(actionId, targetId) =>
              selectedNode && connectOption(selectedNode.id, actionId, targetId)
            }
            createConnectedBlock={(actionId, type) =>
              selectedNode &&
              createConnectedBlock(selectedNode.id, actionId, type)
            }
            entryPoints={
              selectedNode
                ? analysis?.[selectedNode.id]?.entryPoints
                : undefined
            }
            onDuplicate={() => selectedNode && duplicateNode(selectedNode.id)}
            onDelete={deleteSelectedNode}
          />
        </div>
      </div>

      <MediaPickerDialog
        open={mediaPicker.open}
        requiredType={mediaPicker.type}
        selectedMediaId={getSelectedMediaId(
          nodes.find((node) => node.id === mediaPicker.target.nodeId) ||
            selectedNode,
          mediaPicker.target
        )}
        onOpenChange={(open) =>
          setMediaPicker((current) => ({ ...current, open }))
        }
        onSelect={selectMedia}
      />
      <LocationPickerDialog
        open={locationPickerOpen}
        onOpenChange={setLocationPickerOpen}
        value={{
          latitude: Number(selectedNode?.data.content.latitude) || undefined,
          longitude: Number(selectedNode?.data.content.longitude) || undefined,
          name: String(
            selectedNode?.data.content.locationName ||
              selectedNode?.data.content.name ||
              ""
          ),
          address: String(
            selectedNode?.data.content.locationAddress ||
              selectedNode?.data.content.address ||
              ""
          )
        }}
        onSelect={(location) => {
          if (!selectedNode) return;
          updateNode(selectedNode.id, (data) => ({
            ...data,
            content: {
              ...data.content,
              latitude: location.latitude,
              longitude: location.longitude,
              name: location.name,
              locationName: location.name,
              address: location.address,
              locationAddress: location.address
            }
          }));
        }}
      />
      <FlowDiagramPreviewDialog
        open={flowPreviewOpen}
        onOpenChange={setFlowPreviewOpen}
        title="Test this flow"
        platform="WhatsApp"
        nodes={visibleNodes}
        edges={rawVisibleEdges}
        defaultMode="try"
        alternateStart={testStart}
      />
      <FlowVersionHistoryDialog
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        canvasId={canvasId}
        readOnly={false}
        onViewLive={enterLiveView}
        onRestore={(version) =>
          replaceDraft({ kind: "restore", versionId: version._id })
        }
      />
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename flow</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = renameValue.trim();
              if (!name) return;
              renameCanvasMutate({ canvasId, name });
              setRenameOpen(false);
            }}
          >
            <Input
              autoFocus
              value={renameValue}
              placeholder="Flow name"
              aria-label="Flow name"
              onChange={(event) => setRenameValue(event.target.value)}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go back to the live version?</AlertDialogTitle>
            <AlertDialogDescription>
              {changeCount > 0
                ? `Your ${changeCount} change${changeCount === 1 ? "" : "s"} will be lost.`
                : "Your changes will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void replaceDraft({ kind: "discard" })}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(nodeDeletionRequest)}
        onOpenChange={(open) => !open && setNodeDeletionRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  &quot;{nodeDeletionRequest?.label}&quot; and any wires
                  pointing to it will be removed.
                  {nodeDeletionRequest?.cascadesFollowUp
                    ? " Its follow-up message will be deleted along with it."
                    : ""}
                </p>
                {nodeDeletionRequest?.reachedFrom &&
                  nodeDeletionRequest.reachedFrom.length > 0 && (
                    <div>
                      <p>These will stop leading anywhere:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {nodeDeletionRequest.reachedFrom.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (nodeDeletionRequest) {
                  commitNodeDeletion(nodeDeletionRequest.ids);
                }
                setNodeDeletionRequest(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Autosave stays paused until one of these is chosen. */}
      <AlertDialog open={Boolean(conflict)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              This flow changed while you were editing
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictName} changed this flow at {conflictTime}. Reload their
              version (your unsaved edits are lost), or keep yours (it
              overwrites theirs).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                event.preventDefault();
                void reloadTheirVersion();
              }}
            >
              Reload their version
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                keepMyVersion();
              }}
            >
              Keep mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

type NextStepOption = {
  actionId: string;
  label: string;
  type: BotActionType;
  url?: string;
  /** Carousel buttons: where the button sits. */
  cardIndex?: number;
  buttonIndex?: number;
};

const actionTypeLabel = (type: BotActionType) =>
  actionTypeOptions.find((option) => option.value === type)?.label || type;

function PropertiesPanel({
  open,
  node,
  followUpNode,
  readOnly,
  updateNode,
  removeEdgesForAction,
  setDefaultNode,
  openMediaPicker,
  openLocationPicker,
  addAutomaticFollowUp,
  removeAutomaticFollowUp,
  focusRequest,
  status,
  blockChoices,
  targets,
  connectOption,
  createConnectedBlock,
  entryPoints,
  onDuplicate,
  onDelete
}: {
  open: boolean;
  node: BuilderNode | null;
  followUpNode: BuilderNode | null;
  readOnly: boolean;
  updateNode: (
    nodeId: string,
    updater: (data: BuilderNodeData) => BuilderNodeData
  ) => void;
  removeEdgesForAction: (actionId: string) => void;
  setDefaultNode: (nodeId: string) => void;
  openMediaPicker: (
    type: "IMAGE" | "DOCUMENT" | "VIDEO",
    target?: MediaPickerTarget
  ) => void;
  openLocationPicker: () => void;
  addAutomaticFollowUp: () => void;
  removeAutomaticFollowUp: () => void;
  focusRequest: FocusRequest | null;
  status?: {
    defaultFlowReady?: boolean;
    optOutFlowReady?: boolean;
    geminiConfigured?: boolean;
  };
  /** Blocks an option can go to. */
  blockChoices: Array<{ id: string; label: string }>;
  /** Where each of this block's options is wired, by actionId. */
  targets: Record<string, string>;
  connectOption: (actionId: string, targetId: string | null) => void;
  createConnectedBlock: (actionId: string, type: BotBlockType) => void;
  /** From the last check; undefined until the block has been checked. */
  entryPoints?: BotFlowEntryPoint[];
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const handledFocusRef = useRef<number | null>(null);
  const [tab, setTab] = useState<PanelTab>("message");
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const nodeId = node?.id;

  // Clicking an issue selects its block; this opens the tab holding the
  // field (or option) it is about, scrolls to it and focuses it.
  useEffect(() => {
    if (
      !focusRequest ||
      focusRequest.nodeId !== nodeId ||
      handledFocusRef.current === focusRequest.nonce
    ) {
      return;
    }
    const wanted = tabForFocus(focusRequest);
    if (tab !== wanted) {
      setTab(wanted);
      return;
    }
    handledFocusRef.current = focusRequest.nonce;
    const frame = window.requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const target = findIssueTarget(root, focusRequest);
      if (!target) {
        root
          .querySelector("[data-panel-scroll]")
          ?.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusRequest, nodeId, tab]);

  if (!open) return <aside className="hidden border-l bg-white lg:block" />;
  if (!node) {
    return (
      <aside className="overflow-y-auto border-l bg-white p-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {readOnly
            ? "You're viewing the live version. Go back to editing to make changes."
            : "Select a block to edit its message and where it leads."}
        </div>
        <div className="mt-4 rounded-xl border bg-white p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Before you go live
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Default menu</span>
              <Badge
                variant={status?.defaultFlowReady ? "default" : "secondary"}
              >
                {status?.defaultFlowReady ? "Ready" : "Not live yet"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>AI config</span>
              <Badge
                variant={status?.geminiConfigured ? "default" : "secondary"}
              >
                {status?.geminiConfigured ? "Ready" : "Not set"}
              </Badge>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const content = node.data.content;
  const blockType = node.data.blockType;
  const isStart = Boolean(
    (node.data.metadata as Record<string, unknown> | undefined)?.isDefault
  );
  const isSystemBlock =
    node.data.triggerKey === "OPT_IN" || node.data.triggerKey === "OPT_OUT";
  const updateContent = (patch: BotCanvasNodeContent) =>
    updateNode(node.id, (data) => ({
      ...data,
      content: { ...data.content, ...patch }
    }));

  const updateAction = (actionId: string, patch: Partial<BotAction>) => {
    if (patch.type && patch.type !== "go_to_trigger") {
      removeEdgesForAction(actionId);
    }
    updateNode(node.id, (data) => ({
      ...data,
      actions: data.actions.map((action) =>
        action.actionId === actionId
          ? {
              ...action,
              ...patch,
              nextTriggerKey:
                patch.type && patch.type !== "go_to_trigger"
                  ? undefined
                  : action.nextTriggerKey
            }
          : action
      )
    }));
  };

  const removeAction = (actionId: string) => {
    removeEdgesForAction(actionId);
    updateNode(node.id, (data) => ({
      ...data,
      actions: data.actions.filter((action) => action.actionId !== actionId)
    }));
  };

  // The block's actions are rebuilt from the rows in updateNode.
  const updateListSections = (sections: ListSection[]) => {
    updateNode(node.id, (data) => ({
      ...data,
      content: {
        ...data.content,
        sections
      }
    }));
  };
  const hasAutomaticFollowUp = Boolean(
    node.data.followUp?.enabled && followUpNode
  );
  const canHaveFollowUp = !isSystemBlock && blockType !== "handoff_to_agent";
  const updateFollowUpContent = (patch: BotCanvasNodeContent) => {
    if (!followUpNode) return;
    updateNode(followUpNode.id, (data) => ({
      ...data,
      content: { ...data.content, ...patch }
    }));
  };

  // ---- Next steps: one row per option, whatever kind of block it is.
  const nextOptions: NextStepOption[] = (() => {
    if (blockType === "list") {
      return getNodeOptions("list", content, node.data.actions).map(
        (option) => ({
          actionId: option.actionId,
          label: option.label,
          type: option.type
        })
      );
    }
    if (blockType === "generic_carousel") {
      return getCarouselCards(content).flatMap((card, cardIndex) =>
        ((card.buttons || []) as Array<Record<string, unknown>>).map(
          (button, buttonIndex) => ({
            actionId: String(button.actionId || ""),
            label: `${String(card.title || "").trim() || `Card ${cardIndex + 1}`} · ${
              String(button.label || button.title || "").trim() || "Button"
            }`,
            type: getOptionActionType("generic_carousel", button),
            url: typeof button.url === "string" ? button.url : "",
            cardIndex,
            buttonIndex
          })
        )
      );
    }
    return node.data.actions.map((action) => ({
      actionId: action.actionId,
      label: action.label?.trim() || "Untitled option",
      type: action.type,
      url: action.url
    }));
  })().filter((option) => option.actionId);

  const setOptionType = (option: NextStepOption, nextType: BotActionType) => {
    if (blockType === "list") {
      updateListSections(
        getListSections(content).map((section) => ({
          ...section,
          rows: (section.rows || []).map((row) =>
            row.actionId === option.actionId
              ? {
                  ...row,
                  type: nextType === "go_to_trigger" ? undefined : nextType
                }
              : row
          )
        }))
      );
      return;
    }
    if (
      blockType === "generic_carousel" &&
      option.cardIndex !== undefined &&
      option.buttonIndex !== undefined
    ) {
      updateContent({
        cards: setCarouselOptionType(
          getCarouselCards(content),
          option.cardIndex,
          option.buttonIndex,
          nextType
        )
      });
      return;
    }
    const switchingUrlMode =
      (option.type === "open_url") !== (nextType === "open_url");
    if (blockType !== "buttons" || !switchingUrlMode) {
      updateAction(option.actionId, { type: nextType });
      return;
    }
    // A website button can't sit next to reply buttons: switching modes
    // turns the block into one website button, or all reply buttons.
    node.data.actions.forEach((item) => removeEdgesForAction(item.actionId));
    updateNode(node.id, (data) => ({
      ...data,
      actions:
        nextType === "open_url"
          ? data.actions
              .filter((item) => item.actionId === option.actionId)
              .map((item) => ({
                ...item,
                type: "open_url" as const,
                replyId: undefined,
                nextTriggerKey: undefined,
                url: item.url || ""
              }))
          : data.actions.map((item) => ({
              ...item,
              type: nextType,
              url: undefined,
              replyId:
                item.replyId ||
                newOptionReplyId(
                  data.actions.map((other) => other.replyId || "")
                )
            }))
    }));
  };

  const setOptionUrl = (option: NextStepOption, url: string) => {
    if (
      blockType === "generic_carousel" &&
      option.cardIndex !== undefined &&
      option.buttonIndex !== undefined
    ) {
      updateContent({
        cards: getCarouselCards(content).map((card, cardIndex) =>
          cardIndex === option.cardIndex
            ? {
                ...card,
                buttons: (
                  (card.buttons || []) as Array<Record<string, unknown>>
                ).map((button, buttonIndex) =>
                  buttonIndex === option.buttonIndex
                    ? { ...button, url }
                    : button
                )
              }
            : card
        )
      });
      return;
    }
    updateAction(option.actionId, { url });
  };

  const targetChoices = blockChoices.map((choice) => ({
    value: choice.id,
    label:
      choice.id === node.id ? `${choice.label} (this block)` : choice.label,
    searchText: choice.label
  }));
  const isWebsiteMode =
    blockType === "buttons" &&
    node.data.actions.some((action) => action.type === "open_url");

  return (
    <aside
      ref={panelRef}
      className="flex min-h-0 flex-col overflow-hidden border-l bg-white"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as PanelTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b px-4 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="message">Message</TabsTrigger>
            <TabsTrigger value="next">Next steps</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          {readOnly && (
            <p className="mt-2 text-xs text-muted-foreground">
              The live version is read-only.
            </p>
          )}
        </div>

        <TabsContent
          value="message"
          data-panel-scroll
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
        >
          <div className="sticky top-0 z-10 -mx-4 border-b bg-white/95 px-4 py-2 backdrop-blur">
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between text-xs font-medium text-muted-foreground"
              aria-expanded={!previewCollapsed}
              onClick={() => setPreviewCollapsed((value) => !value)}
            >
              Preview
              {previewCollapsed ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </button>
            {!previewCollapsed && (
              <div className="mt-2 max-h-[38vh] overflow-y-auto">
                <WhatsAppFlowBlockPreview
                  blockType={blockType}
                  content={content}
                  actions={node.data.actions}
                  showClose={false}
                />
              </div>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {node.data.blockType === "list" && (
              <Field label="Optional header">
                <Input
                  value={String(content.headerText || "")}
                  disabled={readOnly}
                  maxLength={HEADER_FOOTER_MAX}
                  placeholder="Choose Shipping Option"
                  data-issue-field="content.headerText"
                  onChange={(event) =>
                    updateContent({ headerText: event.target.value })
                  }
                />
                <CharCounter
                  value={content.headerText}
                  max={HEADER_FOOTER_MAX}
                />
              </Field>
            )}

            {(node.data.blockType === "text" ||
              node.data.blockType === "buttons" ||
              node.data.blockType === "list") && (
              <Field
                label={
                  node.data.blockType === "text" ? "Message" : "Body message"
                }
              >
                <Textarea
                  className="min-h-28"
                  value={String(content.text || content.bodyText || "")}
                  disabled={readOnly}
                  data-issue-field={
                    node.data.blockType === "text"
                      ? "content.text"
                      : "content.bodyText"
                  }
                  onChange={(event) =>
                    updateContent(
                      node.data.blockType === "text"
                        ? { text: event.target.value }
                        : { bodyText: event.target.value }
                    )
                  }
                />
                <CharCounter
                  value={content.text || content.bodyText}
                  max={
                    node.data.blockType === "text"
                      ? TEXT_MESSAGE_MAX
                      : INTERACTIVE_BODY_MAX
                  }
                />
                {formatHint}
              </Field>
            )}

            {node.data.blockType === "list" && (
              <div className="space-y-3">
                <Field label="List button text">
                  <Input
                    value={String(content.buttonText || "")}
                    disabled={readOnly}
                    maxLength={LIST_BUTTON_TEXT_MAX}
                    placeholder="Open menu"
                    data-issue-field="content.buttonText"
                    onChange={(event) =>
                      updateContent({ buttonText: event.target.value })
                    }
                  />
                  <CharCounter
                    value={content.buttonText}
                    max={LIST_BUTTON_TEXT_MAX}
                  />
                </Field>
                <Field label="Optional footer">
                  <Input
                    value={String(content.footerText || "")}
                    disabled={readOnly}
                    maxLength={HEADER_FOOTER_MAX}
                    placeholder="Your business name"
                    data-issue-field="content.footerText"
                    onChange={(event) =>
                      updateContent({ footerText: event.target.value })
                    }
                  />
                  <CharCounter
                    value={content.footerText}
                    max={HEADER_FOOTER_MAX}
                  />
                </Field>
                <ListSectionsEditor
                  sections={getListSections(content)}
                  readOnly={readOnly}
                  onChange={updateListSections}
                />
              </div>
            )}

            {node.data.blockType === "buttons" && (
              <div className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Optional media header
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Reply button messages can include image, video, or
                      document headers.
                    </p>
                  </div>
                  {content.mediaId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={readOnly}
                      onClick={() =>
                        updateContent({
                          mediaType: undefined,
                          mediaId: undefined,
                          mediaName: undefined,
                          mediaUrl: undefined,
                          filename: undefined,
                          media: undefined
                        })
                      }
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select
                    value={String(content.mediaType || "image")}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      updateContent({
                        mediaType: value as "image" | "document" | "video",
                        mediaId: "",
                        mediaName: "",
                        mediaUrl: "",
                        filename: ""
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={readOnly}
                    onClick={() =>
                      openMediaPicker(
                        String(content.mediaType || "image").toUpperCase() as
                          | "IMAGE"
                          | "DOCUMENT"
                          | "VIDEO"
                      )
                    }
                  >
                    Select media
                  </Button>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {content.mediaName || content.mediaId || "No media selected"}
                </p>
                <MediaPreview
                  mediaType={String(content.mediaType || "")}
                  url={getMediaPreviewUrl(content)}
                  label={String(content.mediaName || "")}
                />
              </div>
            )}

            {["image", "document", "video"].includes(node.data.blockType) && (
              <MediaField
                node={node}
                openMediaPicker={openMediaPicker}
                readOnly={readOnly}
              />
            )}

            {node.data.blockType === "location" && (
              <div className="grid gap-3">
                <Field label="Location name">
                  <Input
                    value={String(content.name || content.locationName || "")}
                    disabled={readOnly}
                    data-issue-field="content.name"
                    onChange={(event) =>
                      updateContent({ name: event.target.value })
                    }
                  />
                </Field>
                {!hasLocation(content) && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Pick the location on the map.
                  </p>
                )}
                <Button
                  type="button"
                  disabled={readOnly}
                  data-issue-field="content.latitude"
                  onClick={openLocationPicker}
                >
                  <MapPin className="size-4" />
                  Choose on map
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={readOnly}
                  onClick={() => {
                    if (!navigator.geolocation) {
                      toast.error(
                        "Geolocation is not available in this browser."
                      );
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        updateContent({
                          latitude: Number(position.coords.latitude.toFixed(6)),
                          longitude: Number(
                            position.coords.longitude.toFixed(6)
                          )
                        });
                        toast.success("Current location added.");
                      },
                      () => toast.error("Unable to read current location.")
                    );
                  }}
                >
                  <MapPin className="size-4" />
                  Use my current location
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Latitude">
                    <Input
                      type="number"
                      value={
                        typeof content.latitude === "number"
                          ? content.latitude
                          : ""
                      }
                      disabled={readOnly}
                      onChange={(event) =>
                        updateContent({
                          latitude:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value)
                        })
                      }
                    />
                  </Field>
                  <Field label="Longitude">
                    <Input
                      type="number"
                      value={
                        typeof content.longitude === "number"
                          ? content.longitude
                          : ""
                      }
                      disabled={readOnly}
                      data-issue-field="content.longitude"
                      onChange={(event) =>
                        updateContent({
                          longitude:
                            event.target.value === ""
                              ? undefined
                              : Number(event.target.value)
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Address">
                  <Textarea
                    value={String(
                      content.address || content.locationAddress || ""
                    )}
                    disabled={readOnly}
                    data-issue-field="content.address"
                    onChange={(event) =>
                      updateContent({ address: event.target.value })
                    }
                  />
                </Field>
              </div>
            )}

            {(node.data.blockType === "location_request" ||
              node.data.blockType === "address_request") && (
              <div className="grid gap-3">
                <Field
                  label={
                    node.data.blockType === "location_request"
                      ? "Location request message"
                      : "Address request message"
                  }
                >
                  <Textarea
                    className="min-h-28"
                    value={String(content.bodyText || "")}
                    disabled={readOnly}
                    maxLength={INTERACTIVE_BODY_MAX}
                    data-issue-field="content.bodyText"
                    onChange={(event) =>
                      updateContent({ bodyText: event.target.value })
                    }
                  />
                  <CharCounter
                    value={content.bodyText}
                    max={INTERACTIVE_BODY_MAX}
                  />
                </Field>
                {node.data.blockType === "address_request" && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Meta address request messages currently support India only.
                    This block always sends{" "}
                    <span className="font-semibold">country: IN</span>.
                  </div>
                )}
              </div>
            )}

            {node.data.blockType === "handoff_to_agent" && (
              <div className="grid gap-3">
                <Field label="Message before handing to your team">
                  <Textarea
                    className="min-h-28"
                    value={String(content.message || content.text || "")}
                    disabled={readOnly}
                    maxLength={TEXT_MESSAGE_MAX}
                    data-issue-field="content.message"
                    onChange={(event) =>
                      updateContent({ message: event.target.value })
                    }
                  />
                  {formatHint}
                </Field>
              </div>
            )}

            {node.data.blockType === "contacts" && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-semibold">Contact card</p>
                <Field label="Name shown on the contact card">
                  <Input
                    data-issue-field="content.contacts.0.name.formatted_name"
                    value={String(
                      (
                        (
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0]?.name as Record<string, unknown> | undefined
                      )?.formatted_name || ""
                    )}
                    disabled={readOnly}
                    onChange={(event) => {
                      const currentContact =
                        ((
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0] as Record<string, unknown> | undefined) || {};
                      const currentName =
                        (currentContact.name as
                          | Record<string, unknown>
                          | undefined) || {};
                      updateContent({
                        contacts: [
                          {
                            ...currentContact,
                            name: {
                              ...currentName,
                              formatted_name: event.target.value,
                              first_name:
                                String(currentName.first_name || "").trim() ||
                                event.target.value.split(" ")[0] ||
                                event.target.value
                            }
                          }
                        ]
                      });
                    }}
                  />
                </Field>
                <Field label="Phone number">
                  <ContactPhoneField
                    content={content}
                    disabled={readOnly}
                    onChange={(phone) => {
                      const currentContact =
                        ((
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0] as Record<string, unknown> | undefined) || {};
                      const currentPhones =
                        (currentContact.phones as
                          | Array<Record<string, unknown>>
                          | undefined) || [];
                      updateContent({
                        contacts: [
                          {
                            ...currentContact,
                            phones: [
                              {
                                ...(currentPhones[0] || {}),
                                phone,
                                type: "WORK"
                              }
                            ]
                          }
                        ]
                      });
                    }}
                  />
                </Field>
                <Field label="Email (optional)">
                  <Input
                    type="email"
                    value={String(
                      ((
                        (
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0]?.emails as
                          | Array<Record<string, unknown>>
                          | undefined
                      )?.[0]?.email as string | undefined) || ""
                    )}
                    disabled={readOnly}
                    placeholder="support@example.com"
                    onChange={(event) => {
                      const currentContact =
                        ((
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0] as Record<string, unknown> | undefined) || {};
                      const currentEmails =
                        (currentContact.emails as
                          | Array<Record<string, unknown>>
                          | undefined) || [];
                      updateContent({
                        contacts: [
                          {
                            ...currentContact,
                            emails: [
                              {
                                ...(currentEmails[0] || {}),
                                email: event.target.value,
                                type: "WORK"
                              }
                            ]
                          }
                        ]
                      });
                    }}
                  />
                </Field>
                <Field label="Website (optional)">
                  <Input
                    type="url"
                    value={String(
                      ((
                        (
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0]?.urls as
                          | Array<Record<string, unknown>>
                          | undefined
                      )?.[0]?.url as string | undefined) || ""
                    )}
                    disabled={readOnly}
                    placeholder="https://example.com"
                    onChange={(event) => {
                      const currentContact =
                        ((
                          content.contacts as
                            | Array<Record<string, unknown>>
                            | undefined
                        )?.[0] as Record<string, unknown> | undefined) || {};
                      const currentUrls =
                        (currentContact.urls as
                          | Array<Record<string, unknown>>
                          | undefined) || [];
                      updateContent({
                        contacts: [
                          {
                            ...currentContact,
                            urls: [
                              {
                                ...(currentUrls[0] || {}),
                                url: event.target.value,
                                type: "WORK"
                              }
                            ]
                          }
                        ]
                      });
                    }}
                  />
                </Field>
              </div>
            )}

            {node.data.blockType === "product_carousel" && (
              <div className="space-y-3">
                <Field label="Catalog ID">
                  <Input
                    data-issue-field="content.catalogId"
                    value={String(content.catalogId || "")}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateContent({ catalogId: event.target.value })
                    }
                  />
                </Field>
                <JsonEditor
                  label="Product sections JSON"
                  value={content.sections || []}
                  onChange={(sections) =>
                    updateContent({
                      sections: sections as Array<Record<string, unknown>>
                    })
                  }
                  readOnly={readOnly}
                />
              </div>
            )}

            {node.data.blockType === "generic_carousel" && (
              <div className="space-y-3">
                <Field label="Intro message">
                  <Textarea
                    value={String(content.bodyText || "")}
                    disabled={readOnly}
                    data-issue-field="content.bodyText"
                    onChange={(event) =>
                      updateContent({ bodyText: event.target.value })
                    }
                  />
                  <CharCounter
                    value={content.bodyText}
                    max={INTERACTIVE_BODY_MAX}
                  />
                  {formatHint}
                </Field>
                <GenericCarouselEditor
                  cards={getCarouselCards(content)}
                  onChange={(cards) => updateContent({ cards })}
                  openMediaPicker={openMediaPicker}
                  readOnly={readOnly}
                />
              </div>
            )}

            {(blockType === "buttons" || blockType === "product_carousel") && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {blockType === "buttons" ? "Buttons" : "Options"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isWebsiteMode
                        ? "One website button. Change it under Next steps."
                        : blockType === "buttons"
                          ? "Up to 3 reply buttons. Choose what each does under Next steps."
                          : "Choose what each option does under Next steps."}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      readOnly ||
                      isWebsiteMode ||
                      (blockType === "buttons" && node.data.actions.length >= 3)
                    }
                    onClick={() =>
                      updateNode(node.id, (data) => ({
                        ...data,
                        actions: [
                          ...data.actions,
                          makeAction(
                            `Option ${data.actions.length + 1}`,
                            data.actions.map((action) => action.replyId || "")
                          )
                        ]
                      }))
                    }
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>

                {node.data.actions.map((action) => (
                  <div
                    key={action.actionId}
                    className="space-y-1 rounded-md bg-muted/40 p-2"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={action.label || ""}
                        placeholder="Button label"
                        disabled={readOnly}
                        data-action-id={action.actionId}
                        maxLength={
                          blockType === "buttons"
                            ? REPLY_BUTTON_LABEL_MAX
                            : LIST_ROW_TITLE_MAX
                        }
                        onChange={(event) =>
                          updateAction(action.actionId, {
                            label: event.target.value
                          })
                        }
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-destructive"
                        aria-label={`Remove ${action.label || "button"}`}
                        disabled={readOnly}
                        onClick={() => removeAction(action.actionId)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <CharCounter
                      value={action.label}
                      max={
                        blockType === "buttons"
                          ? REPLY_BUTTON_LABEL_MAX
                          : LIST_ROW_TITLE_MAX
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="next"
          data-panel-scroll
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
        >
          {nextOptions.length ? (
            <div className="space-y-2">
              {nextOptions.map((option) => (
                <div
                  key={option.actionId}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <p className="truncate text-sm font-medium">
                    &ldquo;{option.label}&rdquo;
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      When tapped:
                    </span>
                    <Select
                      value={option.type}
                      disabled={readOnly}
                      onValueChange={(value) =>
                        setOptionType(option, value as BotActionType)
                      }
                    >
                      <SelectTrigger
                        className="h-8 w-full"
                        data-action-id={option.actionId}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedActionTypes(blockType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {actionTypeLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {option.type === "go_to_trigger" && (
                    <div className="flex gap-2">
                      <Combobox
                        value={targets[option.actionId] || ""}
                        options={targetChoices}
                        placeholder="Choose a block"
                        className="h-8 min-w-0 flex-1 text-xs"
                        disabled={readOnly}
                        onChange={(targetId) =>
                          connectOption(option.actionId, targetId || null)
                        }
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0"
                            disabled={readOnly}
                          >
                            <Plus className="size-3.5" />
                            New block
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {blockPalette.map((group) => (
                            <DropdownMenuGroup key={group.group}>
                              <DropdownMenuLabel className="text-xs text-muted-foreground">
                                {group.group}
                              </DropdownMenuLabel>
                              {group.items.map((item) => (
                                <DropdownMenuItem
                                  key={item.type}
                                  onSelect={() =>
                                    createConnectedBlock(
                                      option.actionId,
                                      item.type
                                    )
                                  }
                                >
                                  <item.icon className="size-4" />
                                  {item.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {option.type === "open_url" && (
                    <Input
                      value={option.url || ""}
                      placeholder="https://example.com"
                      disabled={readOnly}
                      data-issue-field={
                        option.cardIndex !== undefined
                          ? `content.cards.${option.cardIndex}.buttons.${option.buttonIndex}.url`
                          : `action.${option.actionId}.url`
                      }
                      onChange={(event) =>
                        setOptionUrl(option, event.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {blockType === "handoff_to_agent"
                ? "The chat goes to your team after this message."
                : "This message has nothing to tap, so it doesn't lead anywhere by itself."}
            </p>
          )}

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Timer className="size-4 text-primary" />
                Follow-up
              </p>
              {hasAutomaticFollowUp && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  disabled={readOnly}
                  tooltip="Remove follow-up"
                  aria-label="Remove follow-up"
                  onClick={removeAutomaticFollowUp}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {!canHaveFollowUp ? (
              <p className="text-xs text-muted-foreground">
                This block can&apos;t send a follow-up.
              </p>
            ) : !hasAutomaticFollowUp || !followUpNode ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Send another message if the customer doesn&apos;t reply.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={readOnly}
                  data-issue-field="followUp"
                  onClick={() => addAutomaticFollowUp()}
                >
                  <Plus className="size-4" />
                  Add follow-up
                </Button>
              </>
            ) : (
              <>
                <FollowUpDelayField
                  node={node}
                  readOnly={readOnly}
                  updateNode={updateNode}
                />
                <Field label="Message type">
                  <Select
                    value={followUpNode.data.blockType}
                    disabled={readOnly}
                    onValueChange={(value) => {
                      const nextBlockType = value as BotBlockType;
                      updateNode(followUpNode.id, (data) => ({
                        ...data,
                        blockType: nextBlockType,
                        content: defaultContent(nextBlockType),
                        actions: []
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        ["text", "Text"],
                        ["image", "Image"],
                        ["video", "Video"],
                        ["document", "Document"]
                      ].map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {followUpNode.data.blockType === "text" ? (
                  <Field label="Follow-up message">
                    <Textarea
                      className="min-h-28 bg-white"
                      data-issue-field="followUp.text"
                      value={String(followUpNode.data.content.text || "")}
                      disabled={readOnly}
                      placeholder="Write the message to send automatically"
                      onChange={(event) =>
                        updateFollowUpContent({ text: event.target.value })
                      }
                    />
                    <CharCounter
                      value={followUpNode.data.content.text}
                      max={TEXT_MESSAGE_MAX}
                    />
                    {formatHint}
                  </Field>
                ) : (
                  <>
                    <MediaField
                      node={followUpNode}
                      readOnly={readOnly}
                      openMediaPicker={(type) =>
                        openMediaPicker(type, {
                          kind: "node",
                          nodeId: followUpNode.id
                        })
                      }
                    />
                    <Field label="Optional caption">
                      <Textarea
                        className="min-h-20 bg-white"
                        value={String(followUpNode.data.content.caption || "")}
                        disabled={readOnly}
                        onChange={(event) =>
                          updateFollowUpContent({
                            caption: event.target.value
                          })
                        }
                      />
                    </Field>
                  </>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="settings"
          data-panel-scroll
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin]"
        >
          <Field label="Block name">
            {/* Only the name changes: the internal key was set when the
                block was created, and templates, broadcasts, follow-ups and
                sent buttons point at it. */}
            <Input
              value={node.data.label}
              disabled={readOnly}
              data-issue-field="name"
              onChange={(event) =>
                updateNode(node.id, (data) => ({
                  ...data,
                  label: event.target.value
                }))
              }
            />
          </Field>

          {!isSystemBlock && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Start block</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The first message for new chats, and the reply when the bot
                    doesn&apos;t understand.
                  </p>
                </div>
                <Switch
                  checked={isStart}
                  disabled={readOnly}
                  onCheckedChange={(checked) => {
                    if (checked) setDefaultNode(node.id);
                  }}
                />
              </div>
            </div>
          )}

          <Field label="Internal key">
            <div className="flex gap-2">
              <Input
                readOnly
                value={node.data.triggerKey}
                className="font-mono text-xs"
                aria-label="Internal key"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="shrink-0"
                aria-label="Copy internal key"
                tooltip="Copy"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(node.data.triggerKey)
                    .then(() => toast.success("Internal key copied."))
                    .catch(() => toast.error("Couldn't copy the key."));
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Templates, broadcasts and follow-ups use this key. It never
              changes.
            </p>
          </Field>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Reached from
            </Label>
            {entryPoints === undefined ? (
              <p className="text-sm text-muted-foreground">
                Shown after the next save.
              </p>
            ) : entryPoints.length === 0 ? (
              <p className="text-sm text-amber-800">Nothing leads here yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {entryPoints.map((entry, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                    {describeEntryPoint(entry)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={readOnly}
                tooltip={`Duplicate (${typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘D" : "Ctrl+D"})`}
                onClick={onDuplicate}
              >
                <CopyPlus className="size-4" />
                Duplicate block
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={readOnly || node.data.locked || isStart}
                onClick={onDelete}
              >
                {node.data.locked ? (
                  <Lock className="size-4" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete block
              </Button>
            </div>
            {node.data.locked ? (
              <p className="text-xs text-muted-foreground">
                System blocks can&apos;t be deleted.
              </p>
            ) : isStart ? (
              <p className="text-xs text-muted-foreground">
                Make another block the start block to delete this one.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ListSectionsEditor({
  sections,
  readOnly,
  onChange
}: {
  sections: ListSection[];
  readOnly: boolean;
  onChange: (sections: ListSection[]) => void;
}) {
  const totalRows = getListRowCount(sections);
  const atOptionLimit = totalRows >= LIST_MAX_OPTIONS;
  const usedReplyIds = () =>
    sections.flatMap((section) =>
      (section.rows || []).map((row) => String(row.replyId || row.id || ""))
    );

  // Removing a section or option drops exactly its wires (see updateNode).
  const updateSection = (sectionIndex: number, patch: Partial<ListSection>) => {
    onChange(
      sections.map((section, index) =>
        index === sectionIndex ? { ...section, ...patch } : section
      )
    );
  };

  const addSection = () => {
    if (sections.length >= LIST_MAX_SECTIONS) {
      toast.error(
        `WhatsApp list messages support at most ${LIST_MAX_SECTIONS} sections.`
      );
      return;
    }
    onChange([
      ...sections,
      {
        title: `Section ${sections.length + 1}`,
        rows: []
      }
    ]);
  };

  const removeSection = (sectionIndex: number) => {
    if (sections.length <= 1) {
      toast.error("List messages must keep at least 1 section.");
      return;
    }
    onChange(sections.filter((_, index) => index !== sectionIndex));
  };

  const addRow = (sectionIndex: number) => {
    if (atOptionLimit) {
      toast.error(`WhatsApp allows ${LIST_MAX_OPTIONS} options per menu.`);
      return;
    }
    const nextRow = makeListRow(`Option ${totalRows + 1}`, usedReplyIds());
    onChange(
      sections.map((section, index) =>
        index === sectionIndex
          ? { ...section, rows: [...(section.rows || []), nextRow] }
          : section
      )
    );
  };

  const updateRow = (
    sectionIndex: number,
    rowIndex: number,
    patch: Partial<ListRow>
  ) => {
    onChange(
      sections.map((section, index) => {
        if (index !== sectionIndex) return section;
        return {
          ...section,
          rows: (section.rows || []).map((row, currentRowIndex) =>
            currentRowIndex === rowIndex ? { ...row, ...patch } : row
          )
        };
      })
    );
  };

  const removeRow = (sectionIndex: number, rowIndex: number) => {
    if (totalRows <= 1) {
      toast.error("List messages must keep at least 1 option.");
      return;
    }
    onChange(
      sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              rows: (section.rows || []).filter(
                (_, currentRowIndex) => currentRowIndex !== rowIndex
              )
            }
          : section
      )
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">List sections and options</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sections organize the menu. Options are the choices customers tap.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={addSection}
        >
          <Plus className="size-4" />
          Add section
        </Button>
      </div>

      <div
        className={cn(
          "rounded-md bg-muted/40 px-3 py-2 text-xs",
          atOptionLimit ? "text-amber-800" : "text-muted-foreground"
        )}
      >
        {sections.length}/{LIST_MAX_SECTIONS} sections · {totalRows}/
        {LIST_MAX_OPTIONS} options
        {atOptionLimit && (
          <span className="block">
            WhatsApp allows {LIST_MAX_OPTIONS} options per menu.
          </span>
        )}
      </div>

      {sections.map((section, sectionIndex) => (
        <div
          key={sectionIndex}
          className="space-y-3 rounded-lg border bg-muted/20 p-3"
        >
          <div className="flex items-start justify-between gap-2 border-b pb-3">
            <div className="min-w-0 flex-1">
              <Label className="mb-1.5 block text-xs">
                Section {sectionIndex + 1} title
              </Label>
              <Input
                value={typeof section.title === "string" ? section.title : ""}
                disabled={readOnly}
                maxLength={LIST_SECTION_TITLE_MAX}
                placeholder="Example: Services"
                data-issue-field={`content.sections.${sectionIndex}.title`}
                onChange={(event) =>
                  updateSection(sectionIndex, { title: event.target.value })
                }
              />
              <CharCounter
                value={section.title}
                max={LIST_SECTION_TITLE_MAX}
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={readOnly || sections.length <= 1}
              onClick={() => removeSection(sectionIndex)}
            >
              Remove section
            </Button>
          </div>

          <div className="space-y-2">
            {(section.rows || []).map((row, rowIndex) => {
              const replyId = String(row.replyId || row.id || "");
              const fieldPrefix = `content.sections.${sectionIndex}.rows.${rowIndex}`;
              return (
                <div
                  key={row.actionId || `${replyId}-${rowIndex}`}
                  className="space-y-3 rounded-md bg-white p-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Option {rowIndex + 1}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={readOnly || totalRows <= 1}
                      onClick={() => removeRow(sectionIndex, rowIndex)}
                    >
                      Remove option
                    </Button>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Option title</Label>
                    <Input
                      value={
                        typeof row.title === "string"
                          ? row.title
                          : String(row.label || "")
                      }
                      disabled={readOnly}
                      maxLength={LIST_ROW_TITLE_MAX}
                      placeholder="Example: Track my order"
                      data-issue-field={`${fieldPrefix}.title`}
                      data-action-id={row.actionId}
                      onChange={(event) =>
                        updateRow(sectionIndex, rowIndex, {
                          title: event.target.value,
                          label: event.target.value
                        })
                      }
                    />
                    <CharCounter
                      value={row.title ?? row.label}
                      max={LIST_ROW_TITLE_MAX}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">
                      Description{" "}
                      <span className="font-normal">(optional)</span>
                    </Label>
                    <Input
                      value={String(row.description || "")}
                      disabled={readOnly}
                      maxLength={LIST_ROW_DESCRIPTION_MAX}
                      placeholder="Short detail shown below the option title"
                      data-issue-field={`${fieldPrefix}.description`}
                      onChange={(event) =>
                        updateRow(sectionIndex, rowIndex, {
                          description: event.target.value
                        })
                      }
                    />
                    <CharCounter
                      value={row.description}
                      max={LIST_ROW_DESCRIPTION_MAX}
                      className="mt-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || atOptionLimit}
            tooltip={
              atOptionLimit
                ? `WhatsApp allows ${LIST_MAX_OPTIONS} options per menu`
                : undefined
            }
            onClick={() => addRow(sectionIndex)}
          >
            <Plus className="size-4" />
            Add option to section {sectionIndex + 1}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ContactPhoneField({
  content,
  disabled,
  onChange
}: {
  content: BotCanvasNodeContent;
  disabled: boolean;
  onChange: (phone: string) => void;
}) {
  const savedPhone = String(
    (
      (content.contacts as Array<Record<string, unknown>> | undefined)?.[0]
        ?.phones as Array<Record<string, unknown>> | undefined
    )?.[0]?.phone || ""
  );
  const [countryCode, setCountryCode] = useState("+91");
  const [countryIso, setCountryIso] = useState("IN");
  const [nationalNumber, setNationalNumber] = useState(
    savedPhone.startsWith("+91") ? savedPhone.slice(3) : savedPhone
  );

  useEffect(() => {
    setNationalNumber(
      savedPhone.startsWith(countryCode)
        ? savedPhone.slice(countryCode.length)
        : savedPhone
    );
  }, [countryCode, savedPhone]);

  return (
    <PhoneNumberInput
      countryCode={countryCode}
      countryIso={countryIso}
      phoneNumber={nationalNumber}
      disabled={disabled}
      placeholder="9876543210"
      onCountryCodeChange={(value) => {
        setCountryCode(value);
        onChange(buildInternationalPhoneNumber(value, nationalNumber));
      }}
      onCountryIsoChange={setCountryIso}
      onPhoneNumberChange={(value) => {
        const digits = value.replace(/\D/g, "");
        setNationalNumber(digits);
        onChange(buildInternationalPhoneNumber(countryCode, digits));
      }}
    />
  );
}

function MediaField({
  node,
  openMediaPicker,
  readOnly
}: {
  node: BuilderNode;
  openMediaPicker: (
    type: "IMAGE" | "DOCUMENT" | "VIDEO",
    target?: MediaPickerTarget
  ) => void;
  readOnly: boolean;
}) {
  const requiredType =
    node.data.blockType === "document"
      ? "DOCUMENT"
      : node.data.blockType === "video"
        ? "VIDEO"
        : "IMAGE";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-semibold">Media</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {node.data.content.mediaName ||
          node.data.content.mediaId ||
          "No media selected"}
      </p>
      <MediaPreview
        mediaType={String(node.data.content.mediaType || "")}
        url={getMediaPreviewUrl(node.data.content)}
        label={String(node.data.content.mediaName || "")}
      />
      <Button
        className="mt-3 w-full"
        variant="outline"
        disabled={readOnly}
        data-issue-field="content.mediaId"
        onClick={() => openMediaPicker(requiredType)}
      >
        Select {requiredType.toLowerCase()}
      </Button>
    </div>
  );
}

function GenericCarouselEditor({
  cards,
  onChange,
  openMediaPicker,
  readOnly
}: {
  cards: GenericCarouselCard[];
  onChange: (cards: GenericCarouselCard[]) => void;
  openMediaPicker: (
    type: "IMAGE" | "DOCUMENT" | "VIDEO",
    target?: MediaPickerTarget
  ) => void;
  readOnly: boolean;
}) {
  const updateCard = (index: number, patch: GenericCarouselCard) => {
    onChange(
      cards.map((card, cardIndex) =>
        cardIndex === index ? { ...card, ...patch } : card
      )
    );
  };

  // Every button keeps its own actionId and replyId, so removing a card or
  // button drops exactly its wires (see updateNode) and nothing else moves.
  const usedReplyIds = () =>
    cards.flatMap((card) =>
      ((card.buttons || []) as Array<Record<string, unknown>>).map((button) =>
        String(button.replyId || button.id || "")
      )
    );
  const removeCard = (index: number) => {
    if (cards.length <= 2) return;
    onChange(cards.filter((_, cardIndex) => cardIndex !== index));
  };
  const buttonCount = Array.isArray(cards[0]?.buttons)
    ? cards[0].buttons.length
    : 0;
  const addButtonToAllCards = () => {
    if (buttonCount >= 3) {
      toast.error("Carousel cards support at most 3 buttons.");
      return;
    }
    const used = usedReplyIds();
    onChange(
      cards.map((card) => {
        const button = makeCarouselButton(`Action ${buttonCount + 1}`, used);
        used.push(String(button.replyId));
        return {
          ...card,
          buttons: [
            ...((card.buttons || []) as Array<Record<string, unknown>>),
            button
          ]
        };
      })
    );
  };
  const removeButtonFromAllCards = (buttonIndex: number) => {
    if (buttonCount <= 1) {
      toast.error("Carousel cards must keep at least 1 button.");
      return;
    }
    onChange(
      cards.map((card) => ({
        ...card,
        buttons: (
          (card.buttons || []) as Array<Record<string, unknown>>
        ).filter((_, index) => index !== buttonIndex)
      }))
    );
  };
  const updateButton = (
    cardIndex: number,
    buttonIndex: number,
    patch: Record<string, unknown>
  ) => {
    onChange(
      cards.map((card, index) => {
        if (index !== cardIndex) return card;
        const buttons = [
          ...((card.buttons || []) as Array<Record<string, unknown>>)
        ];
        buttons[buttonIndex] = {
          ...(buttons[buttonIndex] || {}),
          ...patch
        };
        return { ...card, buttons };
      })
    );
  };
  const addCard = () => {
    if (cards.length >= 10) {
      toast.error("Carousel messages support at most 10 cards.");
      return;
    }
    // Same buttons as the first card, each with its own IDs.
    const used = usedReplyIds();
    const templateButtons = (
      (cards[0]?.buttons || []) as Array<Record<string, unknown>>
    ).map((button) => {
      const isUrl = button.type === "url";
      const replyId = isUrl ? undefined : newOptionReplyId(used);
      if (replyId) used.push(replyId);
      return {
        ...button,
        actionId: newId("opt"),
        id: replyId,
        replyId,
        url: isUrl ? button.url || "" : undefined
      };
    });
    const card = makeCarouselCard(cards.length, used);
    onChange([
      ...cards,
      {
        ...card,
        buttons: templateButtons.length ? templateButtons : card.buttons
      }
    ]);
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Carousel cards</p>
          <p className="text-xs text-muted-foreground">
            Add 2-10 cards. Each card can pick image or video media.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={addCard}
        >
          <Plus className="size-4" />
          Card
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2">
        <p className="text-xs text-muted-foreground">
          Card buttons: {Math.max(buttonCount, 1)} / 3. Counts and types must
          match across all cards.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={addButtonToAllCards}
        >
          <Plus className="size-4" />
          Button
        </Button>
      </div>

      {cards.map((card, index) => {
        const pickerType = card.mediaType === "video" ? "VIDEO" : "IMAGE";
        return (
          <div
            key={String(card.buttons?.[0]?.actionId || index)}
            className="space-y-2 rounded-lg bg-muted/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Card {index + 1}</p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-destructive"
                disabled={readOnly || cards.length <= 2}
                onClick={() => removeCard(index)}
              >
                Remove
              </Button>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">
                Card name (only you see this)
              </Label>
              <Input
                value={card.title || ""}
                placeholder={`Card ${index + 1}`}
                disabled={readOnly}
                data-issue-field={`content.cards.${index}.title`}
                onChange={(event) =>
                  updateCard(index, { title: event.target.value })
                }
              />
            </div>
            <div>
              <Textarea
                className="min-h-20"
                value={card.bodyText || ""}
                placeholder="Card text"
                disabled={readOnly}
                data-issue-field={`content.cards.${index}.bodyText`}
                onChange={(event) =>
                  updateCard(index, { bodyText: event.target.value })
                }
              />
              <CharCounter
                value={card.bodyText}
                max={CAROUSEL_CARD_TEXT_MAX}
                className="mt-1"
              />
              {countLineBreaks(card.bodyText) >
                CAROUSEL_CARD_MAX_LINE_BREAKS && (
                <p className="text-[11px] text-destructive">
                  Card text can have at most {CAROUSEL_CARD_MAX_LINE_BREAKS}{" "}
                  line breaks.
                </p>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Select
                value={card.mediaType || "image"}
                disabled={readOnly}
                onValueChange={(value) =>
                  updateCard(index, {
                    mediaType: value as "image" | "video",
                    mediaId: "",
                    mediaName: "",
                    mediaUrl: "",
                    filename: ""
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={readOnly}
                data-issue-field={`content.cards.${index}.mediaId`}
                onClick={() =>
                  openMediaPicker(pickerType, {
                    kind: "carousel-card",
                    cardIndex: index
                  })
                }
              >
                Select media
              </Button>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {card.mediaName || card.mediaId || "No media selected"}
            </p>
            <MediaPreview
              mediaType={card.mediaType}
              url={getMediaPreviewUrl(card)}
              label={card.mediaName}
            />
            <div className="space-y-2 rounded-md border bg-white p-2">
              <p className="text-xs font-semibold">Card buttons</p>
              {((card.buttons || []) as Array<Record<string, unknown>>).map(
                (button, buttonIndex) => {
                  const type = String(
                    button.type || (button.url ? "url" : "quick_reply")
                  );
                  return (
                    <div
                      key={String(button.actionId || buttonIndex)}
                      className="space-y-2"
                    >
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Input
                          value={String(button.label || "")}
                          placeholder="Button label"
                          disabled={readOnly}
                          maxLength={REPLY_BUTTON_LABEL_MAX}
                          data-issue-field={`content.cards.${index}.buttons.${buttonIndex}.label`}
                          data-action-id={
                            typeof button.actionId === "string"
                              ? button.actionId
                              : undefined
                          }
                          onChange={(event) =>
                            updateButton(index, buttonIndex, {
                              label: event.target.value
                            })
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={readOnly || buttonCount <= 1}
                          onClick={() => removeButtonFromAllCards(buttonIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                      <CharCounter
                        value={button.label}
                        max={REPLY_BUTTON_LABEL_MAX}
                      />
                      {type === "url" && (
                        <p className="text-[11px] text-muted-foreground">
                          Website button. Set its link under Next steps.
                        </p>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The panel element an issue is about: its exact field, else the closest
// field above or below it in the path, else the option's own input.
const findIssueTarget = (
  root: HTMLElement,
  request: FocusRequest
): HTMLElement | null => {
  const fields = Array.from(
    root.querySelectorAll<HTMLElement>("[data-issue-field]")
  );
  const field = request.field;
  if (field) {
    const exact = fields.find(
      (element) => element.dataset.issueField === field
    );
    if (exact) return exact;
    const related = fields.find((element) => {
      const candidate = element.dataset.issueField || "";
      return (
        candidate.startsWith(`${field}.`) || field.startsWith(`${candidate}.`)
      );
    });
    if (related) return related;
  }
  if (request.actionId) {
    return (
      Array.from(root.querySelectorAll<HTMLElement>("[data-action-id]")).find(
        (element) => element.dataset.actionId === request.actionId
      ) || null
    );
  }
  return null;
};

/** "12/24" under a field, red once over the limit. Emoji count as 1. */
function CharCounter({
  value,
  max,
  className
}: {
  value: unknown;
  max: number;
  className?: string;
}) {
  const count = countChars(value);
  return (
    <p
      className={cn(
        "text-[11px]",
        count > max ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {count}/{max} characters
    </p>
  );
}

// Keeps what was typed, even past the limit, and says what the limit is;
// the backend reports a delay it can't send.
function FollowUpDelayField({
  node,
  readOnly,
  updateNode
}: {
  node: BuilderNode;
  readOnly: boolean;
  updateNode: (
    nodeId: string,
    updater: (data: BuilderNodeData) => BuilderNodeData
  ) => void;
}) {
  const unit = String(node.data.metadata?.followUpDelayUnit || "minutes");
  const minutes = Number(node.data.followUp?.delayMinutes || 60);
  const savedValue = String(unit === "hours" ? minutes / 60 : minutes);
  const [typed, setTyped] = useState(savedValue);

  useEffect(() => {
    setTyped((current) =>
      Number(current) === Number(savedValue) ? current : savedValue
    );
  }, [savedValue]);

  const overLimit = minutes > FOLLOW_UP_MAX_MINUTES;
  const maxLabel =
    unit === "hours"
      ? `Max ${FOLLOW_UP_MAX_MINUTES / 60} hours`
      : `Max ${FOLLOW_UP_MAX_MINUTES.toLocaleString()} minutes (${FOLLOW_UP_MAX_MINUTES / 60} h)`;

  return (
    <Field label="Send after">
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <Input
          type="number"
          min={1}
          max={
            unit === "hours"
              ? FOLLOW_UP_MAX_MINUTES / 60
              : FOLLOW_UP_MAX_MINUTES
          }
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={typed}
          disabled={readOnly}
          data-issue-field="followUp"
          aria-invalid={overLimit || undefined}
          onChange={(event) => {
            setTyped(event.target.value);
            const value = Number(event.target.value);
            if (!event.target.value || !Number.isFinite(value) || value <= 0) {
              return;
            }
            const nextMinutes = Math.max(
              1,
              Math.round(unit === "hours" ? value * 60 : value)
            );
            updateNode(node.id, (data) => ({
              ...data,
              followUp: data.followUp
                ? { ...data.followUp, delayMinutes: nextMinutes }
                : data.followUp
            }));
          }}
        />
        <Select
          value={unit}
          disabled={readOnly}
          onValueChange={(value) =>
            updateNode(node.id, (data) => ({
              ...data,
              metadata: {
                ...data.metadata,
                followUpDelayUnit: value
              }
            }))
          }
        >
          <SelectTrigger className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p
        className={cn(
          "text-[11px]",
          overLimit ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {maxLabel}. WhatsApp only allows messages within 24 hours of the
        customer&apos;s last message.
      </p>
    </Field>
  );
}

function JsonEditor({
  label,
  value,
  onChange,
  readOnly = false
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(JSON.stringify(value, null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(JSON.stringify(value, null, 2));
  }, [value]);

  return (
    <Field label={label}>
      <Textarea
        className="min-h-36 font-mono text-xs"
        value={draft}
        disabled={readOnly}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          try {
            const parsed = JSON.parse(next);
            setError("");
            onChange(parsed);
          } catch {
            setError("Invalid JSON");
          }
        }}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </Field>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FlowsPageContent() {
  const router = useRouter();
  // Remount per flow: the builder hydrates once, so reusing it across a
  // /bot/flows/A -> /bot/flows/B navigation could save A's blocks into B.
  const canvasKey =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";
  return (
    <ReactFlowProvider key={canvasKey}>
      <FlowsBuilder />
    </ReactFlowProvider>
  );
}

export default function FlowsPage() {
  return (
    <PermissionGate permission="flows:manage" feature="Flows">
      <FlowsPageContent />
    </PermissionGate>
  );
}
