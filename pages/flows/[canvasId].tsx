"use client";

import {
  addEdge,
  Background,
  Connection,
  Controls,
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
  Bot,
  ContactRound,
  FileUp,
  ImageIcon,
  Layers3,
  List,
  LocateFixed,
  Loader2,
  Lock,
  MapPin,
  MessageSquareText,
  MousePointerClick,
  Package,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  Video,
  XCircle
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { toast } from "sonner";

import {
  getBotCanvas,
  getBotSettings,
  getBotStatus,
  publishBotCanvasDraftById,
  saveBotCanvasDraftById,
  updateBotSettings,
  validateBotCanvasById
} from "@/client-api/functions/bot";
import {
  BotAction,
  BotActionType,
  BotBlockType,
  BotCanvasDraftState,
  BotCanvasEdge,
  BotCanvasNode,
  BotCanvasNodeContent,
  BotSettings
} from "@/client-api/types/bot.type";
import { MediaAsset } from "@/client-api/types/media.type";
import BotFlowNode, {
  BotFlowNodeData,
  BotFlowReactNode
} from "@/components/flows/BotFlowNode";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

type BuilderNodeData = BotFlowNodeData & {
  content: BotCanvasNodeContent;
};
type BuilderNode = BotFlowReactNode & { data: BuilderNodeData };
type MediaPickerTarget =
  | { kind: "node" }
  | { kind: "carousel-card"; cardIndex: number };
type GenericCarouselCard = {
  title?: string;
  bodyText?: string;
  mediaType?: "image" | "document" | "video";
  mediaId?: string;
  mediaName?: string;
  buttons?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
type ListRow = {
  id?: string;
  replyId?: string;
  title?: string;
  label?: string;
  description?: string;
  type?: BotActionType;
  url?: string;
  [key: string]: unknown;
};
type ListSection = {
  title?: string;
  rows?: ListRow[];
  [key: string]: unknown;
};
type CanvasMode = "draft" | "published";

const nodeTypes = { botBlock: BotFlowNode };
const REPLY_BUTTON_LABEL_MAX = 20;
const LIST_ROW_TITLE_MAX = 24;
const LIST_ROW_DESCRIPTION_MAX = 72;
const LIST_ROW_ID_MAX = 200;
const LIST_SECTION_TITLE_MAX = 24;
const LIST_BUTTON_TEXT_MAX = 20;
const LIST_MAX_SECTIONS = 10;
const LIST_MAX_ROWS = 10;

const blockTypes: Array<{
  type: BotBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    type: "text",
    label: "Text",
    description: "Send a plain message",
    icon: MessageSquareText
  },
  {
    type: "buttons",
    label: "Buttons",
    description: "Reply buttons with routes",
    icon: MousePointerClick
  },
  {
    type: "list",
    label: "List Menu",
    description: "Sectioned menu choices",
    icon: List
  },
  {
    type: "image",
    label: "Image",
    description: "Send an uploaded image",
    icon: ImageIcon
  },
  {
    type: "document",
    label: "Document",
    description: "Send a file/document",
    icon: FileUp
  },
  {
    type: "video",
    label: "Video",
    description: "Send an uploaded video",
    icon: Video
  },
  {
    type: "location",
    label: "Location",
    description: "Share map coordinates",
    icon: MapPin
  },
  {
    type: "location_request",
    label: "Location Request",
    description: "Ask customer to share location",
    icon: LocateFixed
  },
  {
    type: "address_request",
    label: "Address Request",
    description: "Collect an India address",
    icon: MapPin
  },
  {
    type: "contacts",
    label: "Contacts",
    description: "Share contact cards",
    icon: ContactRound
  },
  {
    type: "product_carousel",
    label: "Product Carousel",
    description: "Catalog product cards",
    icon: Package
  },
  {
    type: "generic_carousel",
    label: "Generic Carousel",
    description: "Media cards with actions",
    icon: Layers3
  }
];

const actionTypeOptions: Array<{ value: BotActionType; label: string }> = [
  { value: "go_to_trigger", label: "Send Message" },
  { value: "escalate_to_agent", label: "Talk to Human Agent" },
  { value: "open_url", label: "Open Website" },
  { value: "end_conversation", label: "End Conversation" }
];

const listActionTypeOptions: Array<{ value: BotActionType; label: string }> = [
  { value: "go_to_trigger", label: "Send Message" },
  { value: "escalate_to_agent", label: "Talk to Human Agent" },
  { value: "end_conversation", label: "End Conversation" }
];

const lockedNodeIds = new Set([
  "main-menu",
  "compliance-opt-out",
  "node_default",
  "node_opt_in",
  "node_opt_out"
]);
const isRoutingBlock = (type: BotBlockType) =>
  ["buttons", "list", "product_carousel", "generic_carousel"].includes(type);

const slugifyTrigger = (value: string) =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "FLOW_NODE";

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

const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const makeAction = (label = "New option"): BotAction => ({
  actionId: newId("action"),
  type: "go_to_trigger",
  label,
  replyId: slugifyTrigger(label)
});

const makeListRow = (label = "Option 1", index = 0): ListRow => ({
  id: slugifyTrigger(label || `ITEM_${index + 1}`),
  replyId: slugifyTrigger(label || `ITEM_${index + 1}`),
  title: label,
  description: ""
});

const getListSections = (content: BotCanvasNodeContent): ListSection[] => {
  const rawSections = Array.isArray(content.sections)
    ? (content.sections as ListSection[])
    : [];
  const sections = rawSections.map((section, sectionIndex) => ({
    ...section,
    title: String(section.title || `Section ${sectionIndex + 1}`),
    rows: Array.isArray(section.rows)
      ? section.rows.map((row, rowIndex) => {
          const label = String(row.title || row.label || `Option ${rowIndex + 1}`);
          const id = String(
            row.id || row.replyId || slugifyTrigger(label || `ITEM_${rowIndex + 1}`)
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

const getListRowCount = (sections: ListSection[]) =>
  sections.reduce(
    (count, section) => count + (Array.isArray(section.rows) ? section.rows.length : 0),
    0
  );

const buildListActionsFromSections = (
  sections: ListSection[],
  existingActions: BotAction[]
): BotAction[] => {
  const existingByReplyId = new Map<string, BotAction>();
  existingActions.forEach((action) => {
    if (action.replyId) existingByReplyId.set(action.replyId, action);
  });

  return sections.flatMap((section) =>
    (section.rows || []).map((row, rowIndex) => {
      const title = String(row.title || row.label || `Option ${rowIndex + 1}`);
      const replyId = String(row.replyId || row.id || slugifyTrigger(title));
      const existing = existingByReplyId.get(replyId);
      const type = ((row.type || existing?.type || "go_to_trigger") as BotActionType);
      return {
        actionId: existing?.actionId || newId("list_row"),
        type,
        label: title,
        replyId,
        nextTriggerKey:
          type === "go_to_trigger" ? existing?.nextTriggerKey : undefined,
        url: type === "open_url" ? existing?.url || row.url : undefined,
        metadata: {
          ...(existing?.metadata || {}),
          description:
            typeof row.description === "string" ? row.description : "",
          sectionTitle: section.title || ""
        }
      };
    })
  );
};

const defaultContent = (blockType: BotBlockType): BotCanvasNodeContent => {
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
  if (blockType === "location") {
    return {
      latitude: 0,
      longitude: 0,
      name: "",
      address: ""
    };
  }
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
  if (blockType === "product_carousel") {
    return {
      catalogId: "",
      sections: [{ title: "Products", productRetailerIds: [] }]
    };
  }
  return {
    bodyText: "Browse these options:",
    cards: [
      {
        title: "Card 1",
        bodyText: "Card description",
        mediaType: "image",
        mediaId: "",
        buttons: [
          { type: "quick_reply", replyId: "CARD_1", label: "Learn more" }
        ]
      },
      {
        title: "Card 2",
        bodyText: "Card description",
        mediaType: "image",
        mediaId: "",
        buttons: [
          { type: "quick_reply", replyId: "CARD_2", label: "Learn more" }
        ]
      }
    ]
  };
};

const getCarouselCards = (
  content: BotCanvasNodeContent
): GenericCarouselCard[] =>
  Array.isArray(content.cards)
    ? (content.cards as GenericCarouselCard[])
    : (defaultContent("generic_carousel").cards as GenericCarouselCard[]);

const makeCarouselCard = (index: number): GenericCarouselCard => ({
  title: `Card ${index + 1}`,
  bodyText: "Card description",
  mediaType: "image",
  mediaId: "",
  buttons: [
    {
      type: "quick_reply",
      replyId: `CARD_${index + 1}`,
      label: "Learn more"
    }
  ]
});

const getContentActions = (
  blockType: BotBlockType,
  content: BotCanvasNodeContent
): BotAction[] => {
  const actions: BotAction[] = [];
  const addAction = (
    replyId: unknown,
    label: unknown,
    type: BotActionType = "go_to_trigger",
    url?: unknown
  ) => {
    const normalizedReplyId = String(replyId || "").trim();
    if (!normalizedReplyId) return;
    actions.push({
      actionId: `content_action_${actions.length + 1}`,
      type,
      replyId: normalizedReplyId,
      label: String(label || normalizedReplyId),
      url: typeof url === "string" ? url : undefined,
      metadata: {}
    });
  };

  if (blockType === "buttons" && Array.isArray(content.buttons)) {
    content.buttons.forEach((button) => {
      const item = button as Record<string, unknown>;
      addAction(item.replyId || item.id, item.label || item.title);
    });
  }

  if (blockType === "list" && Array.isArray(content.sections)) {
    content.sections.forEach((section) => {
      const rows = (section as { rows?: unknown[] })?.rows;
      if (!Array.isArray(rows)) return;
      rows.forEach((row) => {
        const item = row as Record<string, unknown>;
        const rowType = String(item.type || "go_to_trigger") as BotActionType;
        addAction(
          item.replyId || item.id,
          item.label || item.title,
          rowType,
          item.url
        );
        const addedAction = actions[actions.length - 1];
        if (addedAction) {
          addedAction.metadata = {
            description:
              typeof item.description === "string" ? item.description : "",
            sectionTitle:
              typeof (section as Record<string, unknown>).title === "string"
                ? String((section as Record<string, unknown>).title)
                : ""
          };
        }
      });
    });
  }

  if (blockType === "generic_carousel" && Array.isArray(content.cards)) {
    content.cards.forEach((card) => {
      const buttons = (card as { buttons?: unknown[] })?.buttons;
      if (!Array.isArray(buttons)) return;
      buttons.forEach((button) => {
        const item = button as Record<string, unknown>;
        const buttonType = String(
          item.type || (item.url ? "url" : "quick_reply")
        );
        addAction(
          item.replyId || item.id || item.url,
          item.label || item.title,
          buttonType === "url" ? "open_url" : "go_to_trigger",
          item.url
        );
      });
    });
  }

  return actions;
};

const mergeActions = (
  explicitActions: BotAction[],
  contentActions: BotAction[]
) => {
  const seen = new Set<string>();
  const merged: BotAction[] = [];
  [...explicitActions, ...contentActions].forEach((action) => {
    const key = action.replyId || action.actionId;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(action);
  });
  return merged;
};

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
    return `${content.name || content.locationName || "Location"} (${content.latitude ?? 0}, ${content.longitude ?? 0})`;
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
    metadata: (data.metadata || node.metadata || {}) as Record<string, unknown>
  };
};

const toReactNode = (rawNode: unknown): BuilderNode => {
  const node = normalizeBackendNode(rawNode);
  const actions = mergeActions(
    node.actions || [],
    getContentActions(node.blockType, node.content || {})
  );

  return {
    id: node.id,
    type: "botBlock",
    position: node.position || { x: 0, y: 0 },
    data: {
      label: node.name,
      triggerKey: node.triggerKey,
      blockType: node.blockType,
      actions,
      content: node.content || {},
      locked: lockedNodeIds.has(node.id) || Boolean(node.metadata?.locked),
      metadata: node.metadata || {},
      invalid: false,
      summary: summarizeNode(node.blockType, node.content || {})
    }
  };
};

const createNode = (
  blockType: BotBlockType,
  position: { x: number; y: number },
  name?: string,
  overrides?: Partial<BotCanvasNode>
): BuilderNode => {
  const label =
    name ||
    blockTypes.find((item) => item.type === blockType)?.label ||
    "Block";
  const content = overrides?.content || defaultContent(blockType);
  const actions =
    overrides?.actions ||
    (blockType === "generic_carousel"
      ? getContentActions(blockType, content)
      : blockType === "list"
        ? getContentActions(blockType, content)
      : isRoutingBlock(blockType)
        ? [makeAction("Option 1")]
        : []);
  return toReactNode({
    id: overrides?.id || newId("node"),
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
              description: "Ask us for help"
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
  if (!byTrigger.has("DEFAULT") && !byTrigger.has("OPT_IN") && !byTrigger.has("OPT_OUT")) {
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
        node.data.triggerKey !== "OPT_IN" &&
        node.data.triggerKey !== "OPT_OUT"
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

const defaultCanvasEdges = (): Edge[] => [
  {
    id: "edge_default_opt_out",
    source: "node_default",
    target: "node_opt_out",
    sourceHandle: "action_opt_out",
    targetHandle: "in",
    animated: false
  }
];

const isBackendDefaultCanvas = (nodes: BuilderNode[], edges: Edge[]) =>
  nodes.length <= 3 &&
  edges.length === 0 &&
  nodes.some(
    (node) =>
      node.data.triggerKey === "DEFAULT" && node.data.blockType === "text"
  ) &&
  nodes.some(
    (node) =>
      node.data.triggerKey === "OPT_IN" && node.data.blockType === "text"
  ) &&
  nodes.some(
    (node) =>
      node.data.triggerKey === "OPT_OUT" && node.data.blockType === "text"
  );

const isLegacyButtonStarterCanvas = (nodes: BuilderNode[]) =>
  nodes.some(
    (node) =>
      node.data.triggerKey === "DEFAULT" && node.data.blockType === "buttons"
  );

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

const getMediaPreviewUrl = (content: BotCanvasNodeContent | GenericCarouselCard) =>
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
        <video src={url} controls className="aspect-video w-full object-cover" />
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
            <p className="truncate font-medium">{label || "Selected document"}</p>
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
  data?: ReturnType<typeof getBotCanvas> extends Promise<infer R>
    ? R
    : never
) => data?.data?.canvas?.draftState || data?.data?.draftState;

const getPublishedStateFromResponse = (
  data?: ReturnType<typeof getBotCanvas> extends Promise<infer R>
    ? R
    : never
) => data?.data?.canvas?.publishedState || data?.data?.publishedState;

const getSettingsFromResponse = (settings?: BotSettings) => settings;

const draftCacheKey = (orgId?: string, canvasId?: string) =>
  orgId && canvasId ? `whatching:bot-flow-draft:${orgId}:${canvasId}` : "";

const readCachedDraft = (
  orgId?: string,
  canvasId?: string
): BotCanvasDraftState | null => {
  if (typeof window === "undefined") return null;
  const key = draftCacheKey(orgId, canvasId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as BotCanvasDraftState) : null;
  } catch {
    return null;
  }
};

const writeCachedDraft = (
  orgId: string | undefined,
  canvasId: string | undefined,
  draft: BotCanvasDraftState
) => {
  if (typeof window === "undefined") return;
  const key = draftCacheKey(orgId, canvasId);
  if (!key) return;
  window.localStorage.setItem(key, JSON.stringify(draft));
};

const getDraftTime = (draft?: BotCanvasDraftState | null) => {
  const value = draft?.updatedAt ? Date.parse(draft.updatedAt) : 0;
  return Number.isFinite(value) ? value : 0;
};

const getBackendValidation = (data: unknown) => {
  const validationData = data as
    | { valid?: boolean; errors?: string[] }
    | { validation?: { valid?: boolean; errors?: string[] } }
    | undefined;

  return validationData && "validation" in validationData
    ? validationData.validation
    : (validationData as { valid?: boolean; errors?: string[] } | undefined);
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
  const content = { ...node.data.content };
  const visibleActions = node.data.actions.filter((action) =>
    ["go_to_trigger", "escalate_to_agent", "end_conversation"].includes(
      action.type
    )
  );

  if (node.data.blockType === "buttons") {
    content.buttons = visibleActions.slice(0, 3).map((action, index) => ({
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
            const title = String(row.title || row.label || `Item ${rowIndex + 1}`);
            const id = String(
              row.id || row.replyId || slugifyTrigger(title || `ITEM_${rowIndex + 1}`)
            );
            return {
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
            rows: visibleActions.slice(0, LIST_MAX_ROWS).map((action, index) => ({
              id: action.replyId || action.actionId || `ITEM_${index + 1}`,
              replyId: action.replyId || action.actionId || `ITEM_${index + 1}`,
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
  const handleByNodeAndReply = new Map<string, string>();
  nodes.forEach((node) => {
    node.data.actions.forEach((action) => {
      handleByNodeAndReply.set(`${node.id}:${action.actionId}`, action.actionId);
      if (action.replyId)
        handleByNodeAndReply.set(`${node.id}:${action.replyId}`, action.actionId);
    });
  });

  return (
  (edges || []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle:
      handleByNodeAndReply.get(
        `${edge.source}:${edge.actionId || edge.replyId || edge.sourceHandle}`
      ) ||
      handleByNodeAndReply.get(
        `${edge.source}:${edge.sourceHandle || edge.replyId || edge.actionId}`
      ) ||
      edge.actionId ||
      edge.sourceHandle ||
      edge.replyId ||
      undefined,
    targetHandle: edge.targetHandle || "in",
    animated: false,
    data: edge.metadata
  }))
  );
};

const localValidate = (nodes: BuilderNode[], edges: Edge[]) => {
  const invalidIds = new Set<string>();
  const messages: string[] = [];
  const byHandle = new Set(
    edges.map((edge) => `${edge.source}:${edge.sourceHandle}`)
  );
  const triggerKeys = new Set(nodes.map((node) => node.data.triggerKey));
  const triggerCounts = nodes.reduce((counts, node) => {
    counts.set(node.data.triggerKey, (counts.get(node.data.triggerKey) || 0) + 1);
    return counts;
  }, new Map<string, number>());

  if (!triggerKeys.has("DEFAULT")) {
    messages.push("Main Menu must keep trigger key DEFAULT.");
    invalidIds.add(nodes[0]?.id || "");
  }
  if (!triggerKeys.has("OPT_OUT")) {
    messages.push("Opt-out block must keep trigger key OPT_OUT.");
    invalidIds.add(nodes[0]?.id || "");
  }
  if (!triggerKeys.has("OPT_IN")) {
    messages.push("Opt-in block must keep trigger key OPT_IN.");
    invalidIds.add(nodes[0]?.id || "");
  }

  nodes.forEach((node) => {
    const content = node.data.content;
    const title = node.data.label;
    if ((triggerCounts.get(node.data.triggerKey) || 0) > 1) {
      invalidIds.add(node.id);
      messages.push(`${title}: trigger key "${node.data.triggerKey}" is duplicated.`);
    }
    if (!node.data.label?.trim() || !node.data.triggerKey.trim())
      invalidIds.add(node.id);
    if (node.data.blockType === "text" && !String(content.text || "").trim())
      invalidIds.add(node.id);
    if (
      node.data.blockType === "buttons" &&
      !String(content.bodyText || "").trim()
    )
      invalidIds.add(node.id);
    if (
      node.data.blockType === "list" &&
      (!String(content.bodyText || "").trim() ||
        !String(content.buttonText || "").trim())
    ) {
      invalidIds.add(node.id);
    }
    if (
      ["image", "document", "video"].includes(node.data.blockType) &&
      !String(content.mediaId || "").trim()
    ) {
      invalidIds.add(node.id);
    }
    if (
      node.data.blockType === "location" &&
      (content.latitude === undefined || content.longitude === undefined)
    ) {
      invalidIds.add(node.id);
    }
    if (
      node.data.blockType === "location_request" &&
      !String(content.bodyText || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: location request message is required.`);
    }
    if (node.data.blockType === "address_request") {
      if (!String(content.bodyText || "").trim()) {
        invalidIds.add(node.id);
        messages.push(`${title}: address request message is required.`);
      }
      if (String(content.country || "IN").trim().toUpperCase() !== "IN") {
        invalidIds.add(node.id);
        messages.push(`${title}: address request supports country IN only.`);
      }
    }
    if (node.data.blockType === "contacts") {
      const contacts = Array.isArray(content.contacts)
        ? (content.contacts as Array<Record<string, unknown>>)
        : [];
      const hasNamedContact = contacts.some((contact) => {
        const name = contact.name as Record<string, unknown> | undefined;
        return String(name?.formatted_name || "").trim();
      });
      if (!hasNamedContact) {
        invalidIds.add(node.id);
        messages.push(`${title}: add at least one contact with a formatted name.`);
      }
    }
    if (
      node.data.blockType === "product_carousel" &&
      !String(content.catalogId || "").trim()
    )
      invalidIds.add(node.id);
    if (node.data.blockType === "buttons" && node.data.actions.length > 3) {
      invalidIds.add(node.id);
      messages.push(
        `${title}: WhatsApp reply button messages support at most 3 buttons.`
      );
    }
    if (node.data.blockType === "buttons" && content.mediaType) {
      if (!String(content.mediaId || "").trim()) {
        invalidIds.add(node.id);
        messages.push(`${title}: media header requires media from the library.`);
      }
      if (
        !["image", "document", "video"].includes(String(content.mediaType))
      ) {
        invalidIds.add(node.id);
        messages.push(`${title}: media header must be image, document, or video.`);
      }
    }
    if (node.data.blockType === "buttons") {
      node.data.actions.forEach((action) => {
        const label = String(action.label || "").trim();
        if (label.length < 1 || label.length > REPLY_BUTTON_LABEL_MAX) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: button "${label || "Untitled"}" must be 1-${REPLY_BUTTON_LABEL_MAX} characters.`
          );
        }
      });
    }
    if (node.data.blockType === "list") {
      const sections = getListSections(content);
      const rowCount = getListRowCount(sections);
      const rowIds = new Set<string>();
      if (sections.length > LIST_MAX_SECTIONS) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: WhatsApp list messages support at most ${LIST_MAX_SECTIONS} sections.`
        );
      }
      if (rowCount < 1) {
        invalidIds.add(node.id);
        messages.push(`${title}: list block requires at least 1 row.`);
      }
      if (rowCount > LIST_MAX_ROWS) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: WhatsApp list messages support at most ${LIST_MAX_ROWS} rows total.`
        );
      }
      if (String(content.buttonText || "").length > LIST_BUTTON_TEXT_MAX) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: list button text must be ${LIST_BUTTON_TEXT_MAX} characters or less.`
        );
      }
      sections.forEach((section, sectionIndex) => {
        const sectionTitle = String(section.title || "").trim();
        if (
          sectionTitle.length < 1 ||
          sectionTitle.length > LIST_SECTION_TITLE_MAX
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: section ${sectionIndex + 1} title must be 1-${LIST_SECTION_TITLE_MAX} characters.`
          );
        }
        (section.rows || []).forEach((row) => {
        const label = String(row.title || row.label || "").trim();
        const rowId = String(row.id || row.replyId || "").trim();
        const description = String(row.description || "");
        if (label.length < 1 || label.length > LIST_ROW_TITLE_MAX) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: list row "${label || "Untitled"}" must be 1-${LIST_ROW_TITLE_MAX} characters.`
          );
        }
        if (rowId.length < 1 || rowId.length > LIST_ROW_ID_MAX) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: list row "${label || "Untitled"}" id must be 1-${LIST_ROW_ID_MAX} characters.`
          );
        }
        if (rowIds.has(rowId)) {
          invalidIds.add(node.id);
          messages.push(`${title}: list row id "${rowId}" is duplicated.`);
        }
        rowIds.add(rowId);
        if (description.length > LIST_ROW_DESCRIPTION_MAX) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: list row "${label || "Untitled"}" description must be ${LIST_ROW_DESCRIPTION_MAX} characters or less.`
          );
        }
        });
      });
    }
    if (node.data.blockType === "generic_carousel") {
      const cards = getCarouselCards(content);
      if (cards.length < 2 || cards.length > 10) {
        invalidIds.add(node.id);
        messages.push(`${title}: carousel must include 2-10 cards.`);
      }
      const firstButtons = (cards[0]?.buttons || []) as Array<
        Record<string, unknown>
      >;
      const firstTypes = firstButtons.map((button) =>
        String(button.type || (button.url ? "url" : "quick_reply"))
      );
      cards.forEach((card, cardIndex) => {
        if (!String(card.bodyText || "").trim()) invalidIds.add(node.id);
        if (!["image", "video"].includes(String(card.mediaType || ""))) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: card ${cardIndex + 1} needs image or video media.`
          );
        }
        if (!String(card.mediaId || "").trim()) invalidIds.add(node.id);
        const buttons = (card.buttons || []) as Array<Record<string, unknown>>;
        if (!buttons.length) invalidIds.add(node.id);
        buttons.forEach((button) => {
          const label = String(button.label || button.title || "").trim();
          if (label.length < 1 || label.length > REPLY_BUTTON_LABEL_MAX) {
            invalidIds.add(node.id);
            messages.push(
              `${title}: carousel button "${label || "Untitled"}" must be 1-${REPLY_BUTTON_LABEL_MAX} characters.`
            );
          }
        });
        if (
          buttons.length !== firstTypes.length ||
          buttons.some(
            (button, buttonIndex) =>
              String(button.type || (button.url ? "url" : "quick_reply")) !==
              firstTypes[buttonIndex]
          )
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: carousel button count and type must match on every card.`
          );
        }
      });
    }

    node.data.actions
      .filter((action) => action.type === "go_to_trigger")
      .forEach((action) => {
        if (
          node.data.triggerKey === "OPT_IN" ||
          node.data.triggerKey === "OPT_OUT"
        ) {
          return;
        }
        const possibleHandleIds = [action.actionId, action.replyId].filter(
          Boolean
        );
        const isConnected = possibleHandleIds.some((handleId) =>
          byHandle.has(`${node.id}:${handleId}`)
        );
        if (!isConnected) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: route "${action.label || "option"}" is not connected.`
          );
        }
      });
    node.data.actions
      .filter((action) => action.type === "open_url")
      .forEach((action) => {
        if (node.data.blockType !== "generic_carousel") {
          invalidIds.add(node.id);
          messages.push(
            `${title}: Open Website is only supported by carousel URL buttons with the current backend.`
          );
        } else if (!String(action.url || "").trim()) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: URL action "${action.label || "button"}" needs a URL.`
          );
        }
      });
  });

  if (invalidIds.size && messages.length === 0) {
    messages.push("Some blocks are missing required content.");
  }
  return { invalidIds, messages };
};

function FlowsBuilder() {
  const router = useRouter();
  const canvasId = typeof router.query.canvasId === "string" ? router.query.canvasId : "";
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [publishedNodes, setPublishedNodes] = useState<BuilderNode[]>([]);
  const [publishedEdges, setPublishedEdges] = useState<Edge[]>([]);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("draft");
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<
    BuilderNode,
    Edge
  > | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
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
  const latestDraftRef = useRef<BotCanvasDraftState | null>(null);

  const {
    data: draftData,
    isLoading: isDraftLoading,
    refetch: refetchDraft
  } = useQuery({
    queryKey: ["bot-canvas", activeOrganization?._id, canvasId, "draft"],
    queryFn: () => getBotCanvas(canvasId),
    enabled: Boolean(activeOrganization?._id && canvasId),
    refetchOnMount: "always"
  });

  const {
    data: publishedData,
    isLoading: isPublishedLoading,
    refetch: refetchPublished
  } = useQuery({
    queryKey: ["bot-canvas", activeOrganization?._id, canvasId, "published"],
    queryFn: () => getBotCanvas(canvasId),
    enabled: Boolean(activeOrganization?._id && canvasId),
    refetchOnMount: "always"
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ["bot-settings", activeOrganization?._id],
    queryFn: getBotSettings,
    enabled: Boolean(activeOrganization?._id)
  });

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["bot-status", activeOrganization?._id],
    queryFn: getBotStatus,
    enabled: Boolean(activeOrganization?._id)
  });

  const settings = getSettingsFromResponse(settingsData?.data?.settings);
  const status = statusData?.data?.status;
  const selectedNode = useMemo(
    () =>
      (canvasMode === "draft" ? nodes : publishedNodes).find(
        (node) => node.id === selectedNodeId
      ) || null,
    [canvasMode, nodes, publishedNodes, selectedNodeId]
  );
  const visibleNodes = canvasMode === "draft" ? nodes : publishedNodes;
  const visibleEdges = canvasMode === "draft" ? edges : publishedEdges;
  const isPublishedMode = canvasMode === "published";

  const buildDraftState = useCallback(
    (currentNodes = nodes, currentEdges = edges): BotCanvasDraftState => {
      const publishNodes = ensureUniqueNodeTriggers(
        ensureRequiredNodes(currentNodes)
      );
      const targetByAction = new Map<string, string>();
      currentEdges.forEach((edge) => {
        if (edge.sourceHandle) {
          const target = publishNodes.find((node) => node.id === edge.target);
          if (target)
            targetByAction.set(edge.sourceHandle, target.data.triggerKey);
        }
      });

      return {
        version: 1,
        defaultTriggerKey:
          publishNodes.find(
            (node) =>
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
        nodes: publishNodes.map((node, index) => ({
          id: node.id,
          type: "botBlock",
          position: node.position,
          data: {
            triggerKey: node.data.triggerKey,
            blockType: node.data.blockType,
            name: node.data.label,
            sortOrder: index,
            content: prepareNodeContent(node),
            actions: node.data.actions.map((action) => ({
              ...action,
              nextTriggerKey:
                action.type === "go_to_trigger"
                  ? targetByAction.get(action.replyId || action.actionId) ||
                    targetByAction.get(action.actionId) ||
                    action.nextTriggerKey
                  : undefined
            })),
            metadata: {
              locked: node.data.locked || undefined
            }
          }
        })) as unknown as BotCanvasNode[],
        edges: flowEdgesToBackend(currentEdges, publishNodes),
        updatedAt: new Date().toISOString()
      };
    },
    [edges, nodes]
  );

  const { mutateAsync: saveDraft } = useMutation({
    mutationFn: (draftState: BotCanvasDraftState) =>
      saveBotCanvasDraftById({ canvasId, draftState }),
    meta: { showToast: false }
  });

  const { mutate: updateSettingsMutate, isPending: isUpdatingSettings } =
    useMutation({
      mutationFn: updateBotSettings,
      onSuccess: () => {
        refetchSettings();
        refetchStatus();
      }
    });

  const { mutateAsync: publishDraft, isPending: isPublishing } = useMutation({
    mutationFn: () => publishBotCanvasDraftById({ canvasId }),
    onSuccess: () => {
      refetchStatus();
      toast.success("Flow published to WhatsApp automation.");
    }
  });

  const { mutateAsync: validateDraft, isPending: isValidating } = useMutation({
    mutationFn: () => validateBotCanvasById(canvasId),
    meta: { showToast: false }
  });

  useEffect(() => {
    if (!draftData || hydratedRef.current) return;
    const backendDraft = getDraftStateFromResponse(draftData);
    const cachedDraft = readCachedDraft(activeOrganization?._id, canvasId);
    const draft =
      getDraftTime(cachedDraft) > getDraftTime(backendDraft)
        ? cachedDraft
        : backendDraft;
    const loadedNodes = draft?.nodes?.length
      ? ensureUniqueNodeTriggers(ensureRequiredNodes(draft.nodes.map(toReactNode)))
      : defaultCanvasNodes();
    const loadedEdges = canvasEdgesToFlow(draft?.edges, loadedNodes);
    const useStarter =
      isBackendDefaultCanvas(loadedNodes, loadedEdges) ||
      isLegacyButtonStarterCanvas(loadedNodes);
    const nextNodes = applyDefaultMarker(
      useStarter ? defaultCanvasNodes() : loadedNodes,
      draft?.defaultTriggerKey
    );
    const nextEdges = useStarter
      ? defaultCanvasEdges()
      : canvasEdgesToFlow(draft?.edges, nextNodes);
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelectedNodeId(nextNodes[0]?.id || null);
    hydratedRef.current = true;
  }, [activeOrganization?._id, canvasId, draftData, setEdges, setNodes]);

  useEffect(() => {
    const published = getPublishedStateFromResponse(publishedData);
    const nextPublishedNodes = published?.nodes?.length
      ? applyDefaultMarker(published.nodes.map(toReactNode), published.defaultTriggerKey)
      : [];
    setPublishedNodes(nextPublishedNodes);
    setPublishedEdges(canvasEdgesToFlow(published?.edges, nextPublishedNodes));
  }, [publishedData]);

  useEffect(() => {
    if (isPublishedMode || !hydratedRef.current || !nodes.length) return;
    const draft = buildDraftState();
    latestDraftRef.current = draft;
    writeCachedDraft(activeOrganization?._id, canvasId, draft);
  }, [activeOrganization?._id, buildDraftState, canvasId, edges, isPublishedMode, nodes]);

  useEffect(() => {
    if (!activeOrganization?._id || !canvasId) return;
    const saveLatestDraft = () => {
      const draft = latestDraftRef.current;
      if (!draft) return;
      writeCachedDraft(activeOrganization._id, canvasId, draft);
      void saveBotCanvasDraftById({ canvasId, draftState: draft }).catch(
        () => undefined
      );
    };

    router.events.on("routeChangeStart", saveLatestDraft);
    window.addEventListener("beforeunload", saveLatestDraft);
    return () => {
      saveLatestDraft();
      router.events.off("routeChangeStart", saveLatestDraft);
      window.removeEventListener("beforeunload", saveLatestDraft);
    };
  }, [activeOrganization?._id, canvasId, router.events]);

  useEffect(() => {
    if (isPublishedMode || !hydratedRef.current || !nodes.length) return;
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const draft = latestDraftRef.current || buildDraftState();
        writeCachedDraft(activeOrganization?._id, canvasId, draft);
        await saveDraft(draft);
        setSaveState("saved");
        setLastSavedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })
        );
      } catch {
        setSaveState("error");
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    activeOrganization?._id,
    buildDraftState,
    edges,
    isPublishedMode,
    nodes,
    saveDraft
  ]);

  const updateNode = useCallback(
    (nodeId: string, updater: (data: BuilderNodeData) => BuilderNodeData) => {
      if (isPublishedMode) {
        toast.info("Switch to Draft canvas to edit this flow.");
        return;
      }
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId) return node;
          const nextData = updater(node.data);
          const triggerKey =
            node.data.locked || nextData.triggerKey === node.data.triggerKey
              ? nextData.triggerKey
              : makeUniqueTrigger(nextData.triggerKey, current, node.id);
          const nextActions =
            nextData.blockType === "generic_carousel" ||
            nextData.blockType === "list"
              ? getContentActions(nextData.blockType, nextData.content)
              : nextData.actions;
          return {
            ...node,
            data: {
              ...nextData,
              triggerKey,
              actions: nextActions,
              summary: summarizeNode(nextData.blockType, nextData.content)
            }
          };
        })
      );
    },
    [isPublishedMode, setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isPublishedMode) {
        toast.info("Switch to Draft canvas to connect blocks.");
        return;
      }
      if (!connection.sourceHandle) return;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: newId("edge"),
            animated: false
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
    [isPublishedMode, setEdges]
  );

  const addBlock = useCallback(
    (
      type: BotBlockType,
      position = { x: 260 + nodes.length * 24, y: 260 + nodes.length * 24 }
    ) => {
      if (isPublishedMode) {
        toast.info("Switch to Draft canvas to add blocks.");
        return;
      }
      const node = createNode(type, position);
      node.data.triggerKey = makeUniqueTrigger(node.data.triggerKey, nodes);
      setNodes((current) => [...current, node]);
      setSelectedNodeId(node.id);
      setRightPanelOpen(true);
    },
    [isPublishedMode, nodes, setNodes]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(
        "application/whatching-block"
      ) as BotBlockType;
      if (!type || !reactFlow) return;
      if (isPublishedMode) {
        toast.info("Switch to Draft canvas to add blocks.");
        return;
      }
      addBlock(
        type,
        reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      );
    },
    [addBlock, isPublishedMode, reactFlow]
  );

  const deleteSelectedNode = () => {
    if (isPublishedMode) {
      toast.info("Switch to Draft canvas to delete blocks.");
      return;
    }
    if (!selectedNode) return;
    if (
      Boolean(
        (selectedNode.data.metadata as Record<string, unknown> | undefined)
          ?.isDefault
      )
    ) {
      toast.error("Choose another block as default before deleting this block.");
      return;
    }
    if (selectedNode.data.locked) {
      toast.error("System blocks cannot be deleted.");
      return;
    }
    setNodes((current) =>
      current.filter((node) => node.id !== selectedNode.id)
    );
    setEdges((current) =>
      current.filter(
        (edge) =>
          edge.source !== selectedNode.id && edge.target !== selectedNode.id
      )
    );
    setSelectedNodeId(null);
  };

  const handleNodesChange = useCallback(
    (changes: NodeChange<BuilderNode>[]) => {
      const lockedNodeIds = new Set(
        nodes.filter((node) => node.data.locked).map((node) => node.id)
      );
      const defaultNodeIds = new Set(
        nodes
          .filter(
            (node) => Boolean(
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
        toast.error("Choose another block as default before deleting this block.");
      } else if (lockedRemoval) {
        toast.error("System blocks cannot be deleted.");
      }

      const allowedChanges = changes.filter(
        (change) =>
          change.type !== "remove" ||
          (!defaultNodeIds.has(change.id) && !lockedNodeIds.has(change.id))
      );
      if (!allowedChanges.length) return;
      onNodesChange(allowedChanges);
    },
    [nodes, onNodesChange]
  );

  const saveCurrentDraft = async () => {
    if (isPublishedMode) {
      toast.info("Switch to Draft canvas to save changes.");
      return;
    }
    const validation = localValidate(nodes, edges);
    markInvalid(validation.invalidIds);
    setValidationMessages(validation.messages);
    if (validation.invalidIds.size) {
      toast.error(
        validation.messages[0] || "Fix highlighted blocks before saving."
      );
      return;
    }

    setSaveState("saving");
    try {
      const draft = buildDraftState();
      latestDraftRef.current = draft;
      writeCachedDraft(activeOrganization?._id, canvasId, draft);
      await saveDraft(draft);
      const validationResponse = await validateDraft();
      const backendValidation = getBackendValidation(validationResponse.data);
      if (backendValidation && backendValidation.valid === false) {
        const errors = backendValidation.errors || ["Backend validation failed."];
        setValidationMessages(errors);
        setSaveState("error");
        toast.error(errors[0]);
        return;
      }
      setSaveState("saved");
      setLastSavedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      );
      toast.success("Draft saved");
    } catch {
      setSaveState("error");
      toast.error("Unable to save draft");
    }
  };

  const markInvalid = (invalidIds: Set<string>) => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        data: { ...node.data, invalid: invalidIds.has(node.id) }
      }))
    );
  };

  const publish = async () => {
    if (isPublishedMode) {
      toast.info("Switch to Draft canvas to publish changes.");
      return;
    }
    const validation = localValidate(nodes, edges);
    markInvalid(validation.invalidIds);
    setValidationMessages(validation.messages);
    if (validation.invalidIds.size) {
      toast.error(
        validation.messages[0] || "Fix highlighted blocks before publishing."
      );
      return;
    }
    const draft = buildDraftState();
    latestDraftRef.current = draft;
    writeCachedDraft(activeOrganization?._id, canvasId, draft);
    try {
      await saveDraft(draft);
      const validationResponse = await validateDraft();
      const backendValidation = getBackendValidation(validationResponse.data);
      if (backendValidation && backendValidation.valid === false) {
        const errors = backendValidation.errors || [
          "Backend validation failed."
        ];
        setValidationMessages(errors);
        toast.error(errors[0]);
        return;
      }
      await publishDraft();
      await refetchPublished();
      setCanvasMode("published");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Backend rejected the publish request.";
      setValidationMessages([message]);
      toast.error(message);
    }
  };

  const selectMedia = (media: MediaAsset) => {
    if (isPublishedMode) {
      toast.info("Switch to Draft canvas to change media.");
      return;
    }
    if (!selectedNode) return;
    if (mediaPicker.target.kind === "carousel-card") {
      const cardIndex = mediaPicker.target.cardIndex;
      updateNode(selectedNode.id, (data) => {
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
      updateNode(selectedNode.id, (data) => ({
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

  const toggleSetting = (
    field: keyof Pick<BotSettings, "isBotEnabled" | "isAiEnabled">,
    checked: boolean
  ) => {
    updateSettingsMutate({ [field]: checked });
  };

  return (
    <AppLayout hideHeader fullBleed>
      <div className="flex h-dvh flex-col overflow-hidden border bg-white shadow-xs">
        <header className="shrink-0 flex flex-col gap-3 border-b bg-white px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer"
                onClick={() => router.push("/flows")}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Bot className="size-5 text-primary" />
              <h1 className="font-heading text-2xl font-semibold">Flows</h1>
              <Badge
                variant={
                  status?.defaultFlowReady && status?.optOutFlowReady
                    ? "default"
                    : "secondary"
                }
              >
                {status?.publishedFlowCount || 0} published
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground max-w-[250px]">
              Build WhatsApp automation visually. Drafts autosave; publishing is
              explicit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={canvasMode}
              onValueChange={(value) => {
                setCanvasMode(value as CanvasMode);
                setSelectedNodeId(null);
              }}
              className="mr-1"
            >
              <TabsList>
                <TabsTrigger value="draft">Draft canvas</TabsTrigger>
                <TabsTrigger value="published">Published canvas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Switch
                checked={Boolean(settings?.isBotEnabled)}
                disabled={isUpdatingSettings}
                onCheckedChange={(checked) =>
                  toggleSetting("isBotEnabled", checked)
                }
              />
              Flow Active
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <Switch
                checked={Boolean(settings?.isAiEnabled)}
                disabled={isUpdatingSettings}
                onCheckedChange={(checked) =>
                  toggleSetting("isAiEnabled", checked)
                }
              />
              AI Responses
            </div>
            <Button
              variant="outline"
              onClick={() => {
                refetchDraft();
                refetchPublished();
              }}
            >
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={saveCurrentDraft}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Save draft
            </Button>
            {/* <Button
              variant="outline"
              onClick={() => setRightPanelOpen((open) => !open)}
            >
              {rightPanelOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
              Properties
            </Button> */}
            <Button
              onClick={publish}
              disabled={isPublishing || isValidating}
            >
              {isPublishing || isValidating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Publish
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_320px]">
          <aside className="overflow-y-auto border-r bg-muted/30 p-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
            <div className="mb-3 rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Autosave</p>
                <Badge
                  variant={saveState === "error" ? "destructive" : "secondary"}
                >
                  {saveState === "saving"
                    ? "Saving"
                    : saveState === "saved"
                      ? "Saved"
                      : saveState === "error"
                        ? "Error"
                        : "Idle"}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Draft saves 2.5 seconds after changes stop
                {lastSavedAt ? `, last at ${lastSavedAt}` : ""}.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Component Library</p>
              {blockTypes.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    draggable={!isPublishedMode}
                    onDragStart={(event) => {
                      if (isPublishedMode) return;
                      event.dataTransfer.setData(
                        "application/whatching-block",
                        item.type
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => addBlock(item.type)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-xl border bg-white p-2.5 text-left shadow-xs transition hover:border-primary/40 hover:bg-primary/5",
                      isPublishedMode
                        ? "cursor-not-allowed opacity-55"
                        : "cursor-grab"
                    )}
                  >
                    <Icon className="mt-0.5 size-[18px] shrink-0 text-primary" />
                    <span>
                      <span className="block text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

          </aside>

          <main
            className="relative min-h-[560px] bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] [background-size:24px_24px]"
            onDrop={handleDrop}
            onDragOver={(event) => {
              if (isPublishedMode) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
          >
            {(canvasMode === "draft" ? isDraftLoading : isPublishedLoading) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading {canvasMode} canvas...
              </div>
            ) : (
              <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                onInit={setReactFlow}
                onNodesChange={isPublishedMode ? undefined : handleNodesChange}
                onEdgesChange={isPublishedMode ? undefined : onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setRightPanelOpen(true);
                }}
                onPaneClick={() => setSelectedNodeId(null)}
                fitView
                minZoom={0.2}
                maxZoom={1.4}
                nodesDraggable={!isPublishedMode}
                nodesConnectable={!isPublishedMode}
                elementsSelectable
                deleteKeyCode={
                  isPublishedMode || selectedNode?.data.locked
                    ? null
                    : ["Backspace", "Delete"]
                }
              >
                <Background />
                <Controls />
                <MiniMap
                  zoomable
                  pannable
                  nodeStrokeWidth={3}
                  style={{ width: 116, height: 82 }}
                  className="!rounded-lg !border !bg-white/90 !shadow-sm"
                />
              </ReactFlow>
            )}
            {validationMessages.length > 0 && (
              <div className="absolute bottom-4 left-4 max-w-md rounded-lg border border-destructive/30 bg-white p-3 shadow-md">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <XCircle className="size-4" />
                  Publish checks
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {validationMessages.slice(0, 4).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          <PropertiesPanel
            open={rightPanelOpen}
            node={selectedNode}
            readOnly={isPublishedMode}
            updateNode={updateNode}
            removeEdgesForAction={(actionId) => {
              const action = selectedNode?.data.actions.find(
                (item) => item.actionId === actionId
              );
              setEdges((current) =>
                current.filter(
                  (edge) =>
                    edge.sourceHandle !== actionId &&
                    edge.sourceHandle !== action?.replyId
                )
              );
            }}
            deleteNode={deleteSelectedNode}
            setDefaultNode={(nodeId) => {
              setNodes((current) =>
                current.map((item) => ({
                  ...item,
                  data: {
                    ...item.data,
                    metadata: {
                      ...((item.data.metadata as Record<string, unknown>) || {}),
                      isDefault: item.id === nodeId || undefined
                    }
                  }
                }))
              );
            }}
            openMediaPicker={(type, target = { kind: "node" }) =>
              setMediaPicker({ open: true, type, target })
            }
            status={status}
          />
        </div>
      </div>

      <MediaPickerDialog
        open={mediaPicker.open}
        requiredType={mediaPicker.type}
        selectedMediaId={getSelectedMediaId(selectedNode, mediaPicker.target)}
        onOpenChange={(open) =>
          setMediaPicker((current) => ({ ...current, open }))
        }
        onSelect={selectMedia}
      />
    </AppLayout>
  );
}

function PropertiesPanel({
  open,
  node,
  readOnly,
  updateNode,
  removeEdgesForAction,
  deleteNode,
  setDefaultNode,
  openMediaPicker,
  status
}: {
  open: boolean;
  node: BuilderNode | null;
  readOnly: boolean;
  updateNode: (
    nodeId: string,
    updater: (data: BuilderNodeData) => BuilderNodeData
  ) => void;
  removeEdgesForAction: (actionId: string) => void;
  deleteNode: () => void;
  setDefaultNode: (nodeId: string) => void;
  openMediaPicker: (
    type: "IMAGE" | "DOCUMENT" | "VIDEO",
    target?: MediaPickerTarget
  ) => void;
  status?: {
    defaultFlowReady?: boolean;
    optOutFlowReady?: boolean;
    geminiConfigured?: boolean;
  };
}) {
  if (!open) return <aside className="hidden border-l bg-white lg:block" />;
  if (!node) {
    return (
      <aside className="overflow-y-auto border-l bg-white p-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <p className="text-sm font-semibold">Properties</p>
        <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {readOnly
            ? "Published canvas is read-only. Switch to Draft canvas to make changes."
            : "Select a block to edit content, actions, routes, and media."}
        </div>
        <div className="mt-4 rounded-xl border bg-white p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Publish readiness
          </p>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Default menu</span>
              <Badge
                variant={status?.defaultFlowReady ? "default" : "secondary"}
              >
                {status?.defaultFlowReady ? "Ready" : "Draft"}
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

  const updateListSections = (sections: ListSection[]) => {
    updateNode(node.id, (data) => ({
      ...data,
      content: {
        ...data.content,
        sections
      },
      actions: buildListActionsFromSections(sections, data.actions)
    }));
  };

  return (
    <aside className="overflow-y-auto border-l bg-white p-4 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Properties</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {readOnly
              ? "Published canvas is read-only."
              : "Edits update the draft canvas automatically."}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "text-destructive",
            node.data.locked && "text-muted-foreground"
          )}
          disabled={readOnly}
          onClick={deleteNode}
        >
          {node.data.locked ? (
            <Lock className="size-4" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Block name">
          <Input
            value={node.data.label}
            disabled={readOnly}
            onChange={(event) =>
              updateNode(node.id, (data) => ({
                ...data,
                label: event.target.value,
                triggerKey: data.locked
                  ? data.triggerKey
                  : slugifyTrigger(event.target.value)
              }))
            }
          />
        </Field>

        {node.data.triggerKey !== "OPT_IN" &&
          node.data.triggerKey !== "OPT_OUT" && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Default start block</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Incoming chats start from one default block in each canvas.
                  </p>
                </div>
                <Switch
                  checked={Boolean(
                    (node.data.metadata as Record<string, unknown> | undefined)
                      ?.isDefault
                  )}
                  disabled={readOnly}
                  onCheckedChange={(checked) => {
                    if (checked) setDefaultNode(node.id);
                  }}
                />
              </div>
            </div>
          )}

        {(node.data.blockType === "text" ||
          node.data.blockType === "buttons" ||
          node.data.blockType === "list") && (
          <Field
            label={node.data.blockType === "text" ? "Message" : "Body message"}
          >
            <Textarea
              className="min-h-28"
              value={String(content.text || content.bodyText || "")}
              disabled={readOnly}
              onChange={(event) =>
                updateContent(
                  node.data.blockType === "text"
                    ? { text: event.target.value }
                    : { bodyText: event.target.value }
                )
              }
            />
          </Field>
        )}

        {node.data.blockType === "list" && (
          <div className="space-y-3">
            <Field label="Optional header">
              <Input
                value={String(content.headerText || "")}
                disabled={readOnly}
                maxLength={60}
                placeholder="Choose Shipping Option"
                onChange={(event) =>
                  updateContent({ headerText: event.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {String(content.headerText || "").length}/60 characters
              </p>
            </Field>
            <Field label="List button text">
              <Input
                value={String(content.buttonText || "")}
                disabled={readOnly}
                maxLength={LIST_BUTTON_TEXT_MAX}
                placeholder="Open menu"
                onChange={(event) =>
                  updateContent({ buttonText: event.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {String(content.buttonText || "").length}/{LIST_BUTTON_TEXT_MAX}{" "}
                characters
              </p>
            </Field>
            <Field label="Optional footer">
              <Input
                value={String(content.footerText || "")}
                disabled={readOnly}
                maxLength={60}
                placeholder="Your business name"
                onChange={(event) =>
                  updateContent({ footerText: event.target.value })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                {String(content.footerText || "").length}/60 characters
              </p>
            </Field>
            <ListSectionsEditor
              sections={getListSections(content)}
              actions={node.data.actions}
              readOnly={readOnly}
              onChange={updateListSections}
              removeEdgesForAction={removeEdgesForAction}
            />
          </div>
        )}

        {node.data.blockType === "buttons" && (
          <div className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Optional media header</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reply button messages can include image, video, or document
                  headers.
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
                onChange={(event) =>
                  updateContent({ name: event.target.value })
                }
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={readOnly}
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error("Geolocation is not available in this browser.");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    updateContent({
                      latitude: Number(position.coords.latitude.toFixed(6)),
                      longitude: Number(position.coords.longitude.toFixed(6))
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
                  value={Number(content.latitude || 0)}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateContent({ latitude: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Longitude">
                <Input
                  type="number"
                  value={Number(content.longitude || 0)}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateContent({ longitude: Number(event.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="Address">
              <Textarea
                value={String(content.address || content.locationAddress || "")}
                disabled={readOnly}
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
                maxLength={1024}
                onChange={(event) =>
                  updateContent({ bodyText: event.target.value })
                }
              />
            </Field>
            {node.data.blockType === "address_request" && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Meta address request messages currently support India only.
                This block will publish with <span className="font-semibold">country: IN</span>.
              </div>
            )}
          </div>
        )}

        {node.data.blockType === "contacts" && (
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-semibold">Contact card</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Backend requires at least one contact with name.formatted_name.
              </p>
            </div>
            <Field label="Formatted name">
              <Input
                value={String(
                  ((content.contacts as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.name as Record<string, unknown> | undefined)?.formatted_name ||
                    ""
                )}
                disabled={readOnly}
                onChange={(event) => {
                  const currentContact =
                    ((content.contacts as Array<Record<string, unknown>> | undefined)?.[0] as
                      | Record<string, unknown>
                      | undefined) || {};
                  const currentName =
                    (currentContact.name as Record<string, unknown> | undefined) || {};
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
              <Input
                value={String(
                  (((content.contacts as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.phones as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.phone as string | undefined) || ""
                )}
                disabled={readOnly}
                placeholder="+91..."
                onChange={(event) => {
                  const currentContact =
                    ((content.contacts as Array<Record<string, unknown>> | undefined)?.[0] as
                      | Record<string, unknown>
                      | undefined) || {};
                  const currentPhones =
                    (currentContact.phones as Array<Record<string, unknown>> | undefined) || [];
                  updateContent({
                    contacts: [
                      {
                        ...currentContact,
                        phones: [
                          {
                            ...(currentPhones[0] || {}),
                            phone: event.target.value,
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
                  (((content.contacts as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.emails as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.email as string | undefined) || ""
                )}
                disabled={readOnly}
                placeholder="support@example.com"
                onChange={(event) => {
                  const currentContact =
                    ((content.contacts as Array<Record<string, unknown>> | undefined)?.[0] as
                      | Record<string, unknown>
                      | undefined) || {};
                  const currentEmails =
                    (currentContact.emails as Array<Record<string, unknown>> | undefined) || [];
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
                  (((content.contacts as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.urls as Array<Record<string, unknown>> | undefined)?.[0]
                    ?.url as string | undefined) || ""
                )}
                disabled={readOnly}
                placeholder="https://example.com"
                onChange={(event) => {
                  const currentContact =
                    ((content.contacts as Array<Record<string, unknown>> | undefined)?.[0] as
                      | Record<string, unknown>
                      | undefined) || {};
                  const currentUrls =
                    (currentContact.urls as Array<Record<string, unknown>> | undefined) || [];
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
                onChange={(event) =>
                  updateContent({ bodyText: event.target.value })
                }
              />
            </Field>
            <GenericCarouselEditor
              cards={getCarouselCards(content)}
              onChange={(cards) => updateContent({ cards })}
              openMediaPicker={openMediaPicker}
              readOnly={readOnly}
            />
          </div>
        )}

        {(node.data.blockType === "buttons" ||
          node.data.blockType === "product_carousel") && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Button / item actions</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {node.data.blockType === "buttons"
                      ? "Reply button messages support up to 3 buttons."
                      : "Configure route actions for this block."}
                  </p>
                </div>
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly}
                onClick={() => {
                  if (
                    node.data.blockType === "buttons" &&
                    node.data.actions.length >= 3
                  ) {
                    toast.error("WhatsApp reply button messages support at most 3 buttons.");
                    return;
                  }
                  if (
                    node.data.blockType === "list" &&
                    node.data.actions.length >= 10
                  ) {
                    toast.error("WhatsApp list messages support at most 10 rows.");
                    return;
                  }
                  updateNode(node.id, (data) => ({
                    ...data,
                    actions: [
                      ...data.actions,
                      makeAction(`Option ${data.actions.length + 1}`)
                    ]
                  }));
                }}
              >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>

              {node.data.actions.map((action) => (
                <div
                  key={action.actionId}
                  className="space-y-2 rounded-md bg-muted/40 p-2"
                >
                  <Input
                    value={action.label || ""}
                    placeholder="Button or item label"
                    disabled={readOnly}
                    maxLength={
                      node.data.blockType === "buttons"
                        ? REPLY_BUTTON_LABEL_MAX
                        : LIST_ROW_TITLE_MAX
                    }
                    onChange={(event) =>
                      updateAction(action.actionId, {
                        label: event.target.value,
                        replyId: slugifyTrigger(event.target.value)
                      })
                    }
                  />
                  <p
                    className={cn(
                      "text-[11px]",
                      String(action.label || "").length >
                        (node.data.blockType === "buttons"
                          ? REPLY_BUTTON_LABEL_MAX
                          : LIST_ROW_TITLE_MAX)
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {String(action.label || "").length}/
                    {node.data.blockType === "buttons"
                      ? REPLY_BUTTON_LABEL_MAX
                      : LIST_ROW_TITLE_MAX}{" "}
                    characters
                  </p>
                  <Select
                    value={action.type}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      updateAction(action.actionId, {
                        type: value as BotActionType
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {action.type === "open_url" && (
                    <Input
                      value={action.url || ""}
                      placeholder="https://example.com"
                      disabled={readOnly}
                      onChange={(event) =>
                        updateAction(action.actionId, {
                          url: event.target.value
                        })
                      }
                    />
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {action.type === "go_to_trigger"
                        ? "Output dot visible on canvas"
                        : "No output dot for this action"}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive"
                      disabled={readOnly}
                      onClick={() => removeAction(action.actionId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </aside>
  );
}

function ListSectionsEditor({
  sections,
  actions,
  readOnly,
  onChange,
  removeEdgesForAction
}: {
  sections: ListSection[];
  actions: BotAction[];
  readOnly: boolean;
  onChange: (sections: ListSection[]) => void;
  removeEdgesForAction: (actionId: string) => void;
}) {
  const totalRows = getListRowCount(sections);
  const actionByReplyId = new Map(
    actions
      .filter((action) => action.replyId)
      .map((action) => [action.replyId as string, action])
  );

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
    (sections[sectionIndex]?.rows || []).forEach((row) => {
      const replyId = String(row.replyId || row.id || "");
      const action = actionByReplyId.get(replyId);
      if (action) removeEdgesForAction(action.actionId);
    });
    onChange(sections.filter((_, index) => index !== sectionIndex));
  };

  const addRow = (sectionIndex: number) => {
    if (totalRows >= LIST_MAX_ROWS) {
      toast.error(
        `WhatsApp list messages support at most ${LIST_MAX_ROWS} rows total.`
      );
      return;
    }
    const nextLabel = `Option ${totalRows + 1}`;
    onChange(
      sections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              rows: [...(section.rows || []), makeListRow(nextLabel, totalRows)]
            }
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
      toast.error("List messages must keep at least 1 row.");
      return;
    }
    const row = sections[sectionIndex]?.rows?.[rowIndex];
    const replyId = String(row?.replyId || row?.id || "");
    const action = actionByReplyId.get(replyId);
    if (action) removeEdgesForAction(action.actionId);
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
          <p className="text-sm font-semibold">List sections and rows</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Meta supports {LIST_MAX_SECTIONS} sections and {LIST_MAX_ROWS} rows
            total. Rows can include optional descriptions.
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
          Section
        </Button>
      </div>

      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {sections.length}/{LIST_MAX_SECTIONS} sections · {totalRows}/
        {LIST_MAX_ROWS} rows
      </div>

      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="space-y-3 rounded-lg bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={String(section.title || "")}
                disabled={readOnly}
                maxLength={LIST_SECTION_TITLE_MAX}
                placeholder="Section title"
                onChange={(event) =>
                  updateSection(sectionIndex, { title: event.target.value })
                }
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {String(section.title || "").length}/{LIST_SECTION_TITLE_MAX}{" "}
                characters
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={readOnly || sections.length <= 1}
              onClick={() => removeSection(sectionIndex)}
            >
              Remove
            </Button>
          </div>

          <div className="space-y-2">
            {(section.rows || []).map((row, rowIndex) => {
              const replyId = String(row.replyId || row.id || "");
              const action = actionByReplyId.get(replyId);
              const actionType = (row.type || action?.type || "go_to_trigger") as BotActionType;
              return (
                <div
                  key={`${replyId}-${rowIndex}`}
                  className="space-y-2 rounded-md border bg-white p-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={String(row.title || row.label || "")}
                      disabled={readOnly}
                      maxLength={LIST_ROW_TITLE_MAX}
                      placeholder="Row title"
                      onChange={(event) =>
                        updateRow(sectionIndex, rowIndex, {
                          title: event.target.value,
                          label: event.target.value
                        })
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={readOnly || totalRows <= 1}
                      onClick={() => removeRow(sectionIndex, rowIndex)}
                    >
                      Remove
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {String(row.title || row.label || "").length}/
                    {LIST_ROW_TITLE_MAX} characters
                  </p>
                  <Input
                    value={String(row.description || "")}
                    disabled={readOnly}
                    maxLength={LIST_ROW_DESCRIPTION_MAX}
                    placeholder="Optional row description"
                    onChange={(event) =>
                      updateRow(sectionIndex, rowIndex, {
                        description: event.target.value
                      })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {String(row.description || "").length}/
                    {LIST_ROW_DESCRIPTION_MAX} characters
                  </p>
                  <Select
                    value={actionType}
                    disabled={readOnly}
                    onValueChange={(value) => {
                      const nextType = value as BotActionType;
                      if (nextType !== "go_to_trigger" && action) {
                        removeEdgesForAction(action.actionId);
                      }
                      updateRow(sectionIndex, rowIndex, {
                        type: nextType
                      });
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {listActionTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {actionType === "go_to_trigger"
                      ? "Output dot visible on canvas for this row"
                      : "No output dot for this row"}
                  </p>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => addRow(sectionIndex)}
          >
            <Plus className="size-4" />
            Row
          </Button>
        </div>
      ))}
    </div>
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
    onChange(
      cards.map((card, index) => ({
        ...card,
        buttons: [
          ...((card.buttons || []) as Array<Record<string, unknown>>),
          {
            type: "quick_reply",
            replyId: `CARD_${index + 1}_ACTION_${buttonCount + 1}`,
            label: `Action ${buttonCount + 1}`
          }
        ]
      }))
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
  const updateButtonTypeForAllCards = (
    buttonIndex: number,
    type: "quick_reply" | "url"
  ) => {
    onChange(
      cards.map((card, cardIndex) => {
        const buttons = [
          ...((card.buttons || []) as Array<Record<string, unknown>>)
        ];
        buttons[buttonIndex] = {
          ...(buttons[buttonIndex] || {}),
          type,
          ...(type === "url"
            ? { url: "", replyId: undefined }
            : {
                replyId:
                  buttons[buttonIndex]?.replyId ||
                  `CARD_${cardIndex + 1}_ACTION_${buttonIndex + 1}`,
                url: undefined
              })
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
    const templateButtons = (
      (cards[0]?.buttons || []) as Array<Record<string, unknown>>
    ).map((button, buttonIndex) => ({
      ...button,
      replyId:
        button.type === "url"
          ? undefined
          : `CARD_${cards.length + 1}_ACTION_${buttonIndex + 1}`,
      url: button.type === "url" ? button.url || "" : undefined
    }));
    onChange([
      ...cards,
      {
        ...makeCarouselCard(cards.length),
        buttons: templateButtons.length
          ? templateButtons
          : makeCarouselCard(cards.length).buttons
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
          <div key={index} className="space-y-2 rounded-lg bg-muted/40 p-3">
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
            <Input
              value={card.title || ""}
              placeholder="Card title"
              disabled={readOnly}
              onChange={(event) =>
                updateCard(index, { title: event.target.value })
              }
            />
            <Textarea
              className="min-h-20"
              value={card.bodyText || ""}
              placeholder="Card description"
              disabled={readOnly}
              onChange={(event) =>
                updateCard(index, { bodyText: event.target.value })
              }
            />
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
                    <div key={buttonIndex} className="space-y-2">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Input
                          value={String(button.label || "")}
                          placeholder="Button label"
                          disabled={readOnly}
                          maxLength={REPLY_BUTTON_LABEL_MAX}
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
                      <p
                        className={cn(
                          "text-[11px]",
                          String(button.label || "").length >
                            REPLY_BUTTON_LABEL_MAX
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {String(button.label || "").length}/
                        {REPLY_BUTTON_LABEL_MAX} characters
                      </p>
                      <Select
                        value={type}
                        disabled={readOnly}
                        onValueChange={(value) =>
                          updateButtonTypeForAllCards(
                            buttonIndex,
                            value as "quick_reply" | "url"
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick_reply">
                            Quick reply
                          </SelectItem>
                          <SelectItem value="url">URL button</SelectItem>
                        </SelectContent>
                      </Select>
                      {type === "url" ? (
                        <Input
                          value={String(button.url || "")}
                          placeholder="https://example.com"
                          disabled={readOnly}
                          onChange={(event) =>
                            updateButton(index, buttonIndex, {
                              url: event.target.value
                            })
                          }
                        />
                      ) : (
                        <Input
                          value={String(button.replyId || "")}
                          placeholder="Reply ID"
                          disabled={readOnly}
                          onChange={(event) =>
                            updateButton(index, buttonIndex, {
                              replyId: slugifyTrigger(event.target.value)
                            })
                          }
                        />
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

export default function FlowsPage() {
  return (
    <ReactFlowProvider>
      <FlowsBuilder />
    </ReactFlowProvider>
  );
}
