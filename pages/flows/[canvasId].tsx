"use client";

import {
  addEdge,
  Background,
  Connection,
  ConnectionLineType,
  Controls,
  Edge,
  MiniMap,
  NodeChange,
  ReactFlow,
  ReactFlowInstance,
  ReactFlowProvider,
  ViewportPortal,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import {
  ArrowLeft,
  Bot,
  ContactRound,
  Eye,
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
  Plus,
  RefreshCcw,
  Save,
  Send,
  Timer,
  Trash2,
  UserRound,
  Video,
  Workflow,
  X,
  XCircle
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getBotCanvas,
  getBotStatus,
  publishBotCanvasDraftById,
  saveBotCanvasDraftById,
  validateBotCanvasById
} from "@/client-api/functions/bot";
import {
  BotAction,
  BotActionType,
  BotBlockType,
  BotCanvasDraftState,
  BotCanvasEdge,
  BotCanvasNode,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { MediaAsset } from "@/client-api/types/media.type";
import BotFlowNode, {
  BotFlowNodeData,
  BotFlowReactNode
} from "@/components/flows/BotFlowNode";
import FlowDiagramPreviewDialog from "@/components/flows/FlowDiagramPreviewDialog";
import { WhatsAppFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import LocationPickerDialog from "@/components/location/LocationPickerDialog";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

type BuilderNodeData = BotFlowNodeData & {
  content: BotCanvasNodeContent;
  followUp?: BotCanvasNode["followUp"];
};
type BuilderNode = BotFlowReactNode & { data: BuilderNodeData };
type MediaPickerTarget =
  | { kind: "node"; nodeId?: string }
  | { kind: "carousel-card"; cardIndex: number; nodeId?: string };
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
const flowEdgeStyle = { strokeWidth: 1.25, strokeDasharray: "4 5" };
const selectedFlowEdgeStyle = {
  stroke: "#16a34a",
  strokeWidth: 2,
  strokeDasharray: "4 5"
};
const REPLY_BUTTON_LABEL_MAX = 20;
const LIST_ROW_TITLE_MAX = 24;
const LIST_ROW_DESCRIPTION_MAX = 72;
const LIST_ROW_ID_MAX = 200;
const LIST_SECTION_TITLE_MAX = 24;
const LIST_BUTTON_TEXT_MAX = 20;
const LIST_MAX_SECTIONS = 10;
const LIST_MAX_ROWS_PER_SECTION = 10;

const blockTypes: Array<{
  type: BotBlockType | "automatic_follow_up";
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
    type: "contacts",
    label: "Contacts",
    description: "Share contact cards",
    icon: ContactRound
  },
  {
    type: "handoff_to_agent",
    label: "Agent Trigger",
    description: "Hand over to a human agent",
    icon: UserRound
  },
  {
    type: "generic_carousel",
    label: "Generic Carousel",
    description: "Media cards with actions",
    icon: Layers3
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
  }
];

const actionTypeOptions: Array<{ value: BotActionType; label: string }> = [
  { value: "go_to_trigger", label: "Send Message" },
  { value: "escalate_to_agent", label: "Talk to Human Agent" },
  { value: "open_url", label: "Open Website" },
  { value: "end_conversation", label: "End Conversation" }
];
const buttonActionTypeOptions = actionTypeOptions.filter((option) =>
  ["go_to_trigger", "open_url"].includes(option.value)
);

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

const getListRowCount = (sections: ListSection[]) =>
  sections.reduce(
    (count, section) =>
      count + (Array.isArray(section.rows) ? section.rows.length : 0),
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
      const title =
        typeof row.title === "string"
          ? row.title
          : typeof row.label === "string"
            ? row.label
            : `Option ${rowIndex + 1}`;
      const replyId = String(row.replyId || row.id || slugifyTrigger(title));
      const existing = existingByReplyId.get(replyId);
      const type: BotActionType = "go_to_trigger";
      return {
        actionId: existing?.actionId || newId("list_row"),
        type,
        label: title,
        replyId,
        nextTriggerKey:
          type === "go_to_trigger" ? existing?.nextTriggerKey : undefined,
        url: undefined,
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

const makeCarouselReplyId = (
  nodeTriggerKey: string,
  cardIndex: number,
  buttonIndex: number
) =>
  slugifyTrigger(
    `${nodeTriggerKey || "CAROUSEL"}_CARD_${cardIndex + 1}_ACTION_${buttonIndex + 1}`
  );

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

const normalizeGenericCarouselContent = (
  content: BotCanvasNodeContent,
  nodeTriggerKey: string
): BotCanvasNodeContent => {
  const usedReplyIds = new Set<string>();
  const cards = getCarouselCards(content).map((card, cardIndex) => {
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
            id: undefined
          };
        }

        const normalizedExisting = slugifyTrigger(
          String(button.replyId || button.id || "")
        );
        const expectedPrefix = slugifyTrigger(
          `${nodeTriggerKey || "CAROUSEL"}_CARD_${cardIndex + 1}_ACTION_`
        );
        const replyId =
          normalizedExisting.startsWith(expectedPrefix) &&
          !usedReplyIds.has(normalizedExisting)
            ? normalizedExisting
            : makeCarouselReplyId(nodeTriggerKey, cardIndex, buttonIndex);

        usedReplyIds.add(replyId);

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

const normalizeGenericCarouselNode = (node: BotCanvasNode): BotCanvasNode => {
  if (node.blockType !== "generic_carousel") return node;

  const content = normalizeGenericCarouselContent(
    node.content || {},
    node.triggerKey
  );
  const existingActions = new Map<string, BotAction>();
  (node.actions || []).forEach((action) => {
    existingActions.set(action.actionId, action);
  });

  const actions = getContentActions("generic_carousel", content).map(
    (action) => {
      const existing = existingActions.get(action.actionId);
      return {
        ...action,
        nextTriggerKey: existing?.nextTriggerKey || action.nextTriggerKey,
        metadata: existing?.metadata || action.metadata
      };
    }
  );

  return { ...node, content, actions };
};

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
      label: typeof label === "string" ? label : normalizedReplyId,
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
  const node = normalizeGenericCarouselNode(normalizeBackendNode(rawNode));
  const mergedActions = mergeActions(
    node.actions || [],
    getContentActions(node.blockType, node.content || {})
  );
  const actions =
    node.blockType === "list"
      ? mergedActions.map((action) => ({
          ...action,
          type: "go_to_trigger" as const,
          url: undefined
        }))
      : mergedActions;

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
      content: node.content || {},
      locked: lockedNodeIds.has(node.id) || Boolean(node.metadata?.locked),
      metadata: node.metadata || {},
      followUp: node.followUp,
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
  const content =
    node.data.blockType === "generic_carousel"
      ? normalizeGenericCarouselContent(
          { ...node.data.content },
          node.data.triggerKey
        )
      : { ...node.data.content };
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
              .slice(0, LIST_MAX_ROWS_PER_SECTION)
              .map((action, index) => ({
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
  const handleByNodeAndReply = new Map<string, string>();
  nodes.forEach((node) => {
    node.data.actions.forEach((action) => {
      handleByNodeAndReply.set(
        `${node.id}:${action.actionId}`,
        action.actionId
      );
      if (action.replyId)
        handleByNodeAndReply.set(
          `${node.id}:${action.replyId}`,
          action.actionId
        );
    });
  });

  return (edges || []).map((edge) => ({
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
    type: "smoothstep",
    animated: false,
    data: edge.metadata
  }));
};

const localValidate = (nodes: BuilderNode[], edges: Edge[]) => {
  const invalidIds = new Set<string>();
  const messages: string[] = [];
  const byHandle = new Set(
    edges.map((edge) => `${edge.source}:${edge.sourceHandle}`)
  );
  const triggerKeys = new Set(nodes.map((node) => node.data.triggerKey));
  const triggerCounts = nodes.reduce((counts, node) => {
    counts.set(
      node.data.triggerKey,
      (counts.get(node.data.triggerKey) || 0) + 1
    );
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
      messages.push(
        `${title}: trigger key "${node.data.triggerKey}" is duplicated.`
      );
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
    if (
      node.data.blockType === "handoff_to_agent" &&
      !String(content.message || content.text || "").trim()
    ) {
      invalidIds.add(node.id);
      messages.push(`${title}: agent handoff message is required.`);
    }
    if (node.data.blockType === "address_request") {
      if (!String(content.bodyText || "").trim()) {
        invalidIds.add(node.id);
        messages.push(`${title}: address request message is required.`);
      }
      if (
        String(content.country || "IN")
          .trim()
          .toUpperCase() !== "IN"
      ) {
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
      const hasValidPhone = contacts.some((contact) => {
        const phones = contact.phones as
          | Array<Record<string, unknown>>
          | undefined;
        return String(phones?.[0]?.phone || "").replace(/\D/g, "").length >= 7;
      });
      if (!hasNamedContact) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: add at least one contact with a formatted name.`
        );
      }
      if (!hasValidPhone) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: select a country code and enter a valid phone number.`
        );
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
        messages.push(
          `${title}: media header requires media from the library.`
        );
      }
      if (!["image", "document", "video"].includes(String(content.mediaType))) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: media header must be image, document, or video.`
        );
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
      sections.forEach((section, sectionIndex) => {
        if ((section.rows || []).length > LIST_MAX_ROWS_PER_SECTION) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: section ${sectionIndex + 1} supports at most ${LIST_MAX_ROWS_PER_SECTION} rows.`
          );
        }
      });
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
        if (
          node.data.blockType !== "generic_carousel" &&
          node.data.blockType !== "buttons"
        ) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: Open Website is only supported by button and carousel blocks.`
          );
        } else if (!/^https?:\/\//i.test(String(action.url || "").trim())) {
          invalidIds.add(node.id);
          messages.push(
            `${title}: URL action "${action.label || "button"}" needs a valid http(s) URL.`
          );
        }
      });
    if (node.data.blockType === "buttons") {
      const websiteButtons = node.data.actions.filter(
        (action) => action.type === "open_url"
      );
      const replyButtons = node.data.actions.filter(
        (action) => action.type !== "open_url"
      );
      if (websiteButtons.length && replyButtons.length) {
        invalidIds.add(node.id);
        messages.push(
          `${title}: website buttons cannot be mixed with quick replies.`
        );
      }
      if (websiteButtons.length > 1) {
        invalidIds.add(node.id);
        messages.push(`${title}: only one website button is supported.`);
      }
    }
  });

  if (invalidIds.size && messages.length === 0) {
    messages.push("Some blocks are missing required content.");
  }
  return { invalidIds, messages };
};

function FlowsBuilder() {
  const router = useRouter();
  const canvasId =
    typeof router.query.canvasId === "string" ? router.query.canvasId : "";
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [publishedNodes, setPublishedNodes] = useState<BuilderNode[]>([]);
  const [publishedEdges, setPublishedEdges] = useState<Edge[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("draft");
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<
    BuilderNode,
    Edge
  > | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  const [flowPreviewOpen, setFlowPreviewOpen] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
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

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ["bot-status", activeOrganization?._id],
    queryFn: getBotStatus,
    enabled: Boolean(activeOrganization?._id)
  });

  const status = statusData?.data?.status;
  const selectedNode = useMemo(
    () =>
      (canvasMode === "draft" ? nodes : publishedNodes).find(
        (node) => node.id === selectedNodeId
      ) || null,
    [canvasMode, nodes, publishedNodes, selectedNodeId]
  );
  const selectedFollowUpNode = useMemo(() => {
    if (!selectedNode?.data.followUp?.enabled) return null;
    const sourceNodes = canvasMode === "draft" ? nodes : publishedNodes;
    return (
      sourceNodes.find(
        (node) =>
          node.data.triggerKey === selectedNode.data.followUp?.targetTriggerKey
      ) || null
    );
  }, [canvasMode, nodes, publishedNodes, selectedNode]);
  const visibleNodes = canvasMode === "draft" ? nodes : publishedNodes;
  const rawVisibleEdges = canvasMode === "draft" ? edges : publishedEdges;
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
          style:
            connectedToSelected || selected
              ? { ...edge.style, ...selectedFlowEdgeStyle }
              : { ...edge.style, ...flowEdgeStyle }
        };
      }),
    [rawVisibleEdges, selectedEdgeId, selectedNodeId]
  );
  const isPublishedMode = canvasMode === "published";
  const previewNode = useMemo(
    () => visibleNodes.find((node) => node.id === previewNodeId) || null,
    [previewNodeId, visibleNodes]
  );

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
                    ? targetByAction.get(action.replyId || action.actionId) ||
                      targetByAction.get(action.actionId) ||
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

  const { mutateAsync: saveDraft } = useMutation({
    mutationFn: (draftState: BotCanvasDraftState) =>
      saveBotCanvasDraftById({ canvasId, draftState }),
    meta: { showToast: false }
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
      ? ensureUniqueNodeTriggers(
          ensureRequiredNodes(draft.nodes.map(toReactNode))
        )
      : defaultCanvasNodes();
    const loadedEdges = canvasEdgesToFlow(draft?.edges, loadedNodes);
    const useStarter =
      isBackendDefaultCanvas(loadedNodes, loadedEdges) ||
      isLegacyButtonStarterCanvas(loadedNodes);
    const nextNodes = decorateAutomaticFollowUps(
      applyDefaultMarker(
        useStarter ? defaultCanvasNodes() : loadedNodes,
        draft?.defaultTriggerKey
      )
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
      ? decorateAutomaticFollowUps(
          applyDefaultMarker(
            published.nodes.map(toReactNode),
            published.defaultTriggerKey
          )
        )
      : [];
    setPublishedNodes(nextPublishedNodes);
    setPublishedEdges(canvasEdgesToFlow(published?.edges, nextPublishedNodes));
  }, [publishedData]);

  useEffect(() => {
    if (isPublishedMode || !hydratedRef.current || !nodes.length) return;
    const draft = buildDraftState();
    latestDraftRef.current = draft;
    writeCachedDraft(activeOrganization?._id, canvasId, draft);
  }, [
    activeOrganization?._id,
    buildDraftState,
    canvasId,
    edges,
    isPublishedMode,
    nodes
  ]);

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
    canvasId,
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

  const addAutomaticFollowUp = useCallback(() => {
    if (isPublishedMode) {
      toast.info("Switch to Draft canvas to add a follow-up.");
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
  }, [isPublishedMode, nodes, selectedNode, setNodes]);

  const removeAutomaticFollowUp = useCallback(() => {
    if (isPublishedMode || !selectedNode?.data.followUp?.enabled) return;
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
  }, [isPublishedMode, nodes, selectedNode, setEdges, setNodes]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/whatching-block") as
        | BotBlockType
        | "automatic_follow_up";
      if (!type || !reactFlow) return;
      if (isPublishedMode) {
        toast.info("Switch to Draft canvas to add blocks.");
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
    [addAutomaticFollowUp, addBlock, isPublishedMode, reactFlow]
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
      toast.error(
        "Choose another block as default before deleting this block."
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
    const nodeIdsToDelete = new Set([
      selectedNode.id,
      ...(followUpTarget?.data.metadata?.automaticFollowUpTarget
        ? [followUpTarget.id]
        : [])
    ]);
    setNodes((current) =>
      current.filter((node) => !nodeIdsToDelete.has(node.id))
    );
    setEdges((current) =>
      current.filter(
        (edge) =>
          !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target)
      )
    );
    setSelectedNodeId(null);
    setPreviewNodeId(null);
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
          "Choose another block as default before deleting this block."
        );
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
        const errors = backendValidation.errors || [
          "Backend validation failed."
        ];
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
                setPreviewNodeId(null);
              }}
              className="mr-1"
            >
              <TabsList>
                <TabsTrigger value="draft">Draft canvas</TabsTrigger>
                <TabsTrigger value="published">Published canvas</TabsTrigger>
              </TabsList>
            </Tabs>
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
                <Save className="size-4" />
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
            <Button onClick={publish} disabled={isPublishing || isValidating}>
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
                    onClick={() =>
                      item.type === "automatic_follow_up"
                        ? addAutomaticFollowUp()
                        : addBlock(item.type)
                    }
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
              <CanvasLoadingSkeleton />
            ) : (
              <ReactFlow
                nodes={visibleNodes}
                edges={visibleEdges}
                nodeTypes={nodeTypes}
                onInit={setReactFlow}
                onNodesChange={isPublishedMode ? undefined : handleNodesChange}
                onEdgesChange={isPublishedMode ? undefined : onEdgesChange}
                onConnect={onConnect}
                connectionLineType={ConnectionLineType.SmoothStep}
                defaultEdgeOptions={{
                  type: "smoothstep",
                  style: flowEdgeStyle
                }}
                onlyRenderVisibleElements
                onNodeClick={(_, node) => {
                  setSelectedEdgeId(null);
                  if (node.id !== selectedNodeId) setPreviewNodeId(null);
                  setSelectedNodeId(node.id);
                  setRightPanelOpen(true);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setPreviewNodeId(null);
                }}
                onEdgeClick={(_, edge) => {
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                  setPreviewNodeId(null);
                }}
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
                <ViewportPortal>
                  {previewNode && (
                    <div
                      className="nodrag nopan nowheel absolute z-[1000] w-[292px] max-w-[calc(100vw-2rem)]"
                      style={{
                        transform: `translate(${previewNode.position.x - 36}px, ${previewNode.position.y - 18}px) translateY(-100%)`
                      }}
                    >
                      <WhatsAppFlowBlockPreview
                        blockType={previewNode.data.blockType}
                        content={previewNode.data.content}
                        actions={previewNode.data.actions}
                        onClose={() => setPreviewNodeId(null)}
                      />
                    </div>
                  )}
                </ViewportPortal>
              </ReactFlow>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute right-4 top-4 z-10 bg-white/95 shadow-xs backdrop-blur"
              tooltip="Open a read-only diagram of every block and connection"
              disabled={!visibleNodes.length}
              onClick={() => setFlowPreviewOpen(true)}
            >
              <Workflow className="size-4" />
              Preview flow
            </Button>
            {selectedEdgeId && !isPublishedMode && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="absolute right-4 top-16 z-10 border-destructive/30 bg-white/95 text-destructive shadow-xs"
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
            {validationMessages.length > 0 && (
              <div className="absolute bottom-4 left-4 max-w-md rounded-lg border border-destructive/30 bg-white p-3 shadow-md">
                <div className="flex items-center justify-between gap-3 text-sm font-medium text-destructive">
                  <span className="flex items-center gap-2">
                    <XCircle className="size-4" />
                    Publish checks
                  </span>
                  <button
                    type="button"
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss publish checks"
                    onClick={() => setValidationMessages([])}
                  >
                    <X className="size-4" />
                  </button>
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
            followUpNode={selectedFollowUpNode}
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
            previewOpen={previewNodeId === selectedNode?.id}
            togglePreview={() =>
              setPreviewNodeId((current) =>
                current === selectedNode?.id ? null : selectedNode?.id || null
              )
            }
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
            status={status}
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
        title="WhatsApp flow preview"
        platform="WhatsApp"
        nodes={visibleNodes}
        edges={visibleEdges}
      />
    </AppLayout>
  );
}

function PropertiesPanel({
  open,
  node,
  followUpNode,
  readOnly,
  updateNode,
  removeEdgesForAction,
  deleteNode,
  previewOpen,
  togglePreview,
  setDefaultNode,
  openMediaPicker,
  openLocationPicker,
  addAutomaticFollowUp,
  removeAutomaticFollowUp,
  status
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
  deleteNode: () => void;
  previewOpen: boolean;
  togglePreview: () => void;
  setDefaultNode: (nodeId: string) => void;
  openMediaPicker: (
    type: "IMAGE" | "DOCUMENT" | "VIDEO",
    target?: MediaPickerTarget
  ) => void;
  openLocationPicker: () => void;
  addAutomaticFollowUp: () => void;
  removeAutomaticFollowUp: () => void;
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
  const hasAutomaticFollowUp = Boolean(
    node.data.followUp?.enabled && followUpNode
  );
  const updateFollowUpContent = (patch: BotCanvasNodeContent) => {
    if (!followUpNode) return;
    updateNode(followUpNode.id, (data) => ({
      ...data,
      content: { ...data.content, ...patch }
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
        <Button
          type="button"
          variant={previewOpen ? "secondary" : "outline"}
          className="w-full"
          tooltip={
            previewOpen
              ? "Hide the live WhatsApp message preview"
              : "Preview this block with its current WhatsApp message data"
          }
          onClick={togglePreview}
        >
          <Eye className="size-4" />
          {previewOpen ? "Hide preview" : "Show preview"}
        </Button>

        {!hasAutomaticFollowUp &&
          !["OPT_IN", "OPT_OUT"].includes(node.data.triggerKey) &&
          node.data.blockType !== "handoff_to_agent" && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={readOnly}
              onClick={() => addAutomaticFollowUp()}
            >
              <Timer className="size-4" />
              Add automatic follow-up
            </Button>
          )}

        {hasAutomaticFollowUp && followUpNode && (
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Timer className="size-4 text-primary" />
                <p className="text-sm font-semibold">Automatic follow-up</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                disabled={readOnly}
                tooltip="Remove automatic follow-up"
                onClick={removeAutomaticFollowUp}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Field label="Send after">
              <div className="grid grid-cols-[1fr_120px] gap-2">
                <Input
                  type="number"
                  min={1}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={(() => {
                    const minutes = Number(
                      node.data.followUp?.delayMinutes || 60
                    );
                    const unit = String(
                      node.data.metadata?.followUpDelayUnit || "minutes"
                    );
                    return unit === "hours" ? minutes / 60 : minutes;
                  })()}
                  disabled={readOnly}
                  onChange={(event) => {
                    const unit = String(
                      node.data.metadata?.followUpDelayUnit || "minutes"
                    );
                    const value = Math.max(1, Number(event.target.value) || 1);
                    const minutes = unit === "hours" ? value * 60 : value;
                    updateNode(node.id, (data) => ({
                      ...data,
                      followUp: data.followUp
                        ? {
                            ...data.followUp,
                            delayMinutes: Math.max(
                              1,
                              Math.min(1380, Math.round(minutes))
                            )
                          }
                        : data.followUp,
                      metadata: {
                        ...data.metadata
                      }
                    }));
                  }}
                />
                <Select
                  value={String(
                    node.data.metadata?.followUpDelayUnit || "minutes"
                  )}
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
            </Field>
            <Field label="Message type">
              <Select
                value={followUpNode.data.blockType}
                disabled={readOnly}
                onValueChange={(value) => {
                  const blockType = value as BotBlockType;
                  updateNode(followUpNode.id, (data) => ({
                    ...data,
                    blockType,
                    content: defaultContent(blockType),
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
                  value={String(followUpNode.data.content.text || "")}
                  disabled={readOnly}
                  placeholder="Write the message to send automatically"
                  onChange={(event) =>
                    updateFollowUpContent({ text: event.target.value })
                  }
                />
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
                      updateFollowUpContent({ caption: event.target.value })
                    }
                  />
                </Field>
              </>
            )}
          </div>
        )}

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
              disabled={readOnly}
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
                Meta address request messages currently support India only. This
                block will publish with{" "}
                <span className="font-semibold">country: IN</span>.
              </div>
            )}
          </div>
        )}

        {node.data.blockType === "handoff_to_agent" && (
          <div className="grid gap-3">
            <Field label="Agent handoff message">
              <Textarea
                className="min-h-28"
                value={String(content.message || content.text || "")}
                disabled={readOnly}
                maxLength={1024}
                onChange={(event) =>
                  updateContent({ message: event.target.value })
                }
              />
            </Field>
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
                    )?.[0]?.emails as Array<Record<string, unknown>> | undefined
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
                    )?.[0]?.urls as Array<Record<string, unknown>> | undefined
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
              nodeTriggerKey={node.data.triggerKey}
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
                    ? node.data.actions.some(
                        (action) => action.type === "open_url"
                      )
                      ? "Website mode supports exactly one URL button."
                      : "Quick reply mode supports up to 3 buttons."
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
                    node.data.actions.some(
                      (action) => action.type === "open_url"
                    )
                  ) {
                    toast.error(
                      "Website button mode supports only one button."
                    );
                    return;
                  }
                  if (
                    node.data.blockType === "buttons" &&
                    node.data.actions.length >= 3
                  ) {
                    toast.error(
                      "WhatsApp reply button messages support at most 3 buttons."
                    );
                    return;
                  }
                  if (
                    node.data.blockType === "list" &&
                    node.data.actions.length >= 10
                  ) {
                    toast.error(
                      "WhatsApp list messages support at most 10 rows."
                    );
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
                      label: event.target.value
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
                  onValueChange={(value) => {
                    const nextType = value as BotActionType;
                    const switchingUrlMode =
                      (action.type === "open_url") !==
                      (nextType === "open_url");
                    if (!switchingUrlMode) {
                      updateAction(action.actionId, { type: nextType });
                      return;
                    }

                    node.data.actions.forEach((item) =>
                      removeEdgesForAction(item.actionId)
                    );
                    updateNode(node.id, (data) => ({
                      ...data,
                      actions:
                        nextType === "open_url"
                          ? [
                              {
                                ...action,
                                type: "open_url",
                                replyId: undefined,
                                nextTriggerKey: undefined,
                                url: action.url || ""
                              }
                            ]
                          : data.actions.map((item) => ({
                              ...item,
                              type: nextType,
                              url: undefined,
                              replyId:
                                item.replyId || item.actionId || newId("reply")
                            }))
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(node.data.blockType === "buttons"
                      ? buttonActionTypeOptions
                      : actionTypeOptions
                    ).map((option) => (
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
    if (
      (sections[sectionIndex]?.rows || []).length >= LIST_MAX_ROWS_PER_SECTION
    ) {
      toast.error(
        `Each WhatsApp list section supports at most ${LIST_MAX_ROWS_PER_SECTION} rows.`
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
            Sections organize the menu. Rows are the choices customers tap.
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

      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {sections.length}/{LIST_MAX_SECTIONS} sections · {totalRows} rows total
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
              Remove section
            </Button>
          </div>

          <div className="space-y-2">
            {(section.rows || []).map((row, rowIndex) => {
              const replyId = String(row.replyId || row.id || "");
              return (
                <div
                  key={`${replyId}-${rowIndex}`}
                  className="space-y-3 rounded-md bg-white p-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Row {rowIndex + 1}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={readOnly || totalRows <= 1}
                      onClick={() => removeRow(sectionIndex, rowIndex)}
                    >
                      Remove row
                    </Button>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Row title</Label>
                    <Input
                      value={
                        typeof row.title === "string"
                          ? row.title
                          : String(row.label || "")
                      }
                      disabled={readOnly}
                      maxLength={LIST_ROW_TITLE_MAX}
                      placeholder="Example: Track my order"
                      onChange={(event) =>
                        updateRow(sectionIndex, rowIndex, {
                          title: event.target.value,
                          label: event.target.value
                        })
                      }
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
                      placeholder="Short detail shown below the row title"
                      onChange={(event) =>
                        updateRow(sectionIndex, rowIndex, {
                          description: event.target.value
                        })
                      }
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
            disabled={readOnly}
            onClick={() => addRow(sectionIndex)}
          >
            <Plus className="size-4" />
            Add row to section {sectionIndex + 1}
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
        onClick={() => openMediaPicker(requiredType)}
      >
        Select {requiredType.toLowerCase()}
      </Button>
    </div>
  );
}

function GenericCarouselEditor({
  nodeTriggerKey,
  cards,
  onChange,
  openMediaPicker,
  readOnly
}: {
  nodeTriggerKey: string;
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
            id: makeCarouselReplyId(nodeTriggerKey, index, buttonCount),
            replyId: makeCarouselReplyId(nodeTriggerKey, index, buttonCount),
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
            ? { url: "", replyId: undefined, id: undefined }
            : (() => {
                const existingReplyId = slugifyTrigger(
                  String(
                    buttons[buttonIndex]?.replyId ||
                      buttons[buttonIndex]?.id ||
                      ""
                  )
                );
                const expectedPrefix = slugifyTrigger(
                  `${nodeTriggerKey || "CAROUSEL"}_CARD_${cardIndex + 1}_ACTION_`
                );
                const replyId = existingReplyId.startsWith(expectedPrefix)
                  ? existingReplyId
                  : makeCarouselReplyId(nodeTriggerKey, cardIndex, buttonIndex);

                return {
                  id: replyId,
                  replyId,
                  url: undefined
                };
              })())
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
          : makeCarouselReplyId(nodeTriggerKey, cards.length, buttonIndex),
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
                      ) : null}
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
