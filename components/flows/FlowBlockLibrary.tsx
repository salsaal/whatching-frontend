import {
  Boxes,
  ContactRound,
  FileUp,
  ImageIcon,
  List,
  LocateFixed,
  MapPin,
  MessageSquareText,
  MousePointerClick,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserRound,
  Video
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { BotFlowReactNode } from "@/components/flows/BotFlowNode";
import { WhatsAppFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { defaultContent, getContentActions } from "@/lib/flowBuilder";
import { cn } from "@/lib/utils";

type PaletteItem = {
  type: BotBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
};

export const blockPalette: Array<{ group: string; items: PaletteItem[] }> = [
  {
    group: "Messages",
    items: [
      {
        type: "text",
        label: "Text",
        description: "Send a plain message",
        icon: MessageSquareText
      },
      {
        type: "image",
        label: "Image",
        description: "Send an image from your media library",
        icon: ImageIcon
      },
      {
        type: "video",
        label: "Video",
        description: "Send a video from your media library",
        icon: Video
      },
      {
        type: "document",
        label: "Document",
        description: "Send a file, such as a PDF",
        icon: FileUp
      }
    ]
  },
  {
    group: "Menus",
    items: [
      {
        type: "buttons",
        label: "Buttons",
        description: "Up to 3 reply buttons, or one website button",
        icon: MousePointerClick
      },
      {
        type: "list",
        label: "List menu",
        description: "A menu of up to 10 options in sections",
        icon: List
      },
      {
        type: "generic_carousel",
        label: "Carousel",
        description: "Swipeable cards with an image or video and buttons",
        icon: Boxes
      }
    ]
  },
  {
    group: "Ask the customer",
    items: [
      {
        type: "location_request",
        label: "Ask for location",
        description: "Ask the customer to share where they are",
        icon: LocateFixed
      },
      {
        type: "address_request",
        label: "Ask for address (India)",
        description: "Ask for a delivery address in India",
        icon: MapPin
      }
    ]
  },
  {
    group: "Share",
    items: [
      {
        type: "location",
        label: "Send location",
        description: "Send a place on the map",
        icon: MapPin
      },
      {
        type: "contacts",
        label: "Send contact",
        description: "Send a contact the customer can save",
        icon: ContactRound
      }
    ]
  },
  {
    group: "Actions",
    items: [
      {
        type: "handoff_to_agent",
        label: "Hand to team",
        description: "Pass the chat to your team",
        icon: UserRound
      }
    ]
  }
];

const paletteByType = new Map(
  blockPalette.flatMap((group) => group.items.map((item) => [item.type, item]))
);

export const getBlockLabel = (type: BotBlockType) =>
  paletteByType.get(type)?.label ||
  (type === "product_carousel" ? "Product carousel" : "Block");

export const getBlockIcon = (type: BotBlockType) =>
  paletteByType.get(type)?.icon || Package;

const SYSTEM_TRIGGER_KEYS = new Set(["OPT_IN", "OPT_OUT"]);
const isSystemNode = (node: BotFlowReactNode) =>
  SYSTEM_TRIGGER_KEYS.has(node.data.triggerKey);
const isStartNode = (node: BotFlowReactNode) =>
  Boolean(node.data.metadata?.isDefault);

/**
 * Blocks in the order the Outline shows them: the start block, the rest in
 * flow order, then opt-in/opt-out. Hidden follow-up messages are left out.
 */
export const outlineOrder = <N extends BotFlowReactNode>(nodes: N[]): N[] => {
  const visible = nodes.filter((node) => !node.hidden);
  return [
    ...visible.filter((node) => isStartNode(node) && !isSystemNode(node)),
    ...visible.filter((node) => !isStartNode(node) && !isSystemNode(node)),
    ...visible.filter(isSystemNode)
  ];
};

// Each block type's default content, built once, for the hover preview.
const previewByType = new Map<
  BotBlockType,
  { content: BotCanvasNodeContent; actions: BotAction[] }
>();
const getPalettePreview = (type: BotBlockType) => {
  let preview = previewByType.get(type);
  if (!preview) {
    const content = defaultContent(type);
    preview = {
      content,
      actions:
        type === "buttons"
          ? [
              {
                actionId: "preview_option",
                type: "go_to_trigger",
                replyId: "preview_option",
                label: "Option 1"
              }
            ]
          : getContentActions(type, content)
    };
    previewByType.set(type, preview);
  }
  return preview;
};

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

const dragBlock = (event: React.DragEvent, type: BotBlockType) => {
  event.dataTransfer.setData("application/whatching-block", type);
  event.dataTransfer.effectAllowed = "move";
};

function PaletteTile({
  item,
  readOnly,
  onAdd
}: {
  item: PaletteItem;
  readOnly: boolean;
  onAdd: (type: BotBlockType) => void;
}) {
  const preview = getPalettePreview(item.type);
  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable={!readOnly}
          disabled={readOnly}
          onDragStart={(event) => dragBlock(event, item.type)}
          onClick={() => onAdd(item.type)}
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm transition hover:bg-white hover:shadow-xs",
            readOnly ? "cursor-not-allowed opacity-50" : "cursor-grab"
          )}
        >
          <item.icon className="size-4 shrink-0 text-primary" />
          <span className="truncate">{item.label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="max-w-none border-0 bg-transparent p-0 shadow-none"
      >
        <div className="w-64 space-y-1.5 rounded-lg border bg-white p-2 shadow-md">
          <p className="px-1 text-xs text-muted-foreground">
            {item.description}
          </p>
          <WhatsAppFlowBlockPreview
            blockType={item.type}
            content={preview.content}
            actions={preview.actions}
            showClose={false}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function AddTab({
  readOnly,
  onAdd
}: {
  readOnly: boolean;
  onAdd: (type: BotBlockType) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = blockPalette
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !query.trim() ||
          matches(item.label, query) ||
          matches(item.description, query)
      )
    }))
    .filter((group) => group.items.length);

  return (
    <div className="space-y-3">
      {readOnly && (
        <p className="text-xs text-muted-foreground">
          Go back to editing to add blocks.
        </p>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="h-8 bg-white pl-8 text-sm"
          disabled={readOnly}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {groups.map((group) => (
        <div key={group.group} className="space-y-0.5">
          <p className="px-2 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </p>
          {group.items.map((item) => (
            <PaletteTile
              key={item.type}
              item={item}
              readOnly={readOnly}
              onAdd={onAdd}
            />
          ))}
        </div>
      ))}
      {!groups.length && (
        <p className="text-xs text-muted-foreground">No block matches.</p>
      )}
    </div>
  );
}

function OutlineTab({
  nodes,
  selectedNodeId,
  onSelectNode
}: {
  nodes: BotFlowReactNode[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { main, system } = useMemo(() => {
    const ordered = outlineOrder(nodes).filter(
      (node) => !query.trim() || matches(node.data.label, query)
    );
    return {
      main: ordered.filter((node) => !isSystemNode(node)),
      system: ordered.filter(isSystemNode)
    };
  }, [nodes, query]);

  const renderItem = (node: BotFlowReactNode) => {
    const Icon = getBlockIcon(node.data.blockType);
    return (
      <li key={node.id}>
        <button
          type="button"
          onClick={() => onSelectNode(node.id)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white",
            selectedNodeId === node.id && "bg-white font-medium shadow-xs"
          )}
        >
          <Icon className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{node.data.label}</span>
          {isStartNode(node) && (
            <span className="shrink-0 text-[10px] font-semibold uppercase text-primary">
              Start
            </span>
          )}
          {node.data.issueSeverity && (
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                node.data.issueSeverity === "error"
                  ? "bg-destructive"
                  : "bg-amber-500"
              )}
              aria-label={
                node.data.issueSeverity === "error"
                  ? "Has problems to fix"
                  : "Has warnings"
              }
            />
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Find a block"
          aria-label="Find a block"
          className="h-8 bg-white pl-8 text-sm"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ul className="space-y-0.5">{main.map(renderItem)}</ul>
      {system.length > 0 && (
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            System
          </p>
          <ul className="space-y-0.5">{system.map(renderItem)}</ul>
        </div>
      )}
      {!main.length && !system.length && (
        <p className="px-2 text-xs text-muted-foreground">No block matches.</p>
      )}
    </div>
  );
}

// The rail shrunk to icons: expand, plus one button per block type.
function IconStrip({
  readOnly,
  onAdd,
  onExpand
}: {
  readOnly: boolean;
  onAdd: (type: BotBlockType) => void;
  onExpand: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        tooltip="Show the block list"
        aria-label="Show the block list"
        onClick={onExpand}
      >
        <PanelLeftOpen className="size-4" />
      </Button>
      <span className="my-1 h-px w-6 bg-border" />
      {blockPalette.flatMap((group) =>
        group.items.map((item) => (
          <Button
            key={item.type}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            draggable={!readOnly}
            disabled={readOnly}
            tooltip={`Add ${item.label}`}
            aria-label={`Add ${item.label}`}
            onDragStart={(event) => dragBlock(event, item.type)}
            onClick={() => onAdd(item.type)}
          >
            <item.icon className="size-4 text-primary" />
          </Button>
        ))
      )}
    </div>
  );
}

/** The left rail: add blocks, or find one already in the flow. */
export function FlowBlockLibrary({
  readOnly,
  nodes,
  selectedNodeId,
  issueCounts,
  collapsed,
  onCollapsedChange,
  onAdd,
  onSelectNode
}: {
  readOnly: boolean;
  nodes: BotFlowReactNode[];
  selectedNodeId: string | null;
  issueCounts: { errors: number; warnings: number };
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAdd: (type: BotBlockType) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  const blockCount = nodes.filter((node) => !node.hidden).length;
  // Chosen once the flow has loaded: a flow beyond the 3 system blocks
  // opens on its outline, a new one on the palette.
  const [tab, setTab] = useState<"add" | "outline" | null>(null);
  useEffect(() => {
    if (tab === null && blockCount > 0) {
      setTab(blockCount > 3 ? "outline" : "add");
    }
  }, [blockCount, tab]);

  if (collapsed) {
    return (
      <IconStrip
        readOnly={readOnly}
        onAdd={onAdd}
        onExpand={() => onCollapsedChange(false)}
      />
    );
  }

  return (
    <Tabs
      value={tab ?? "add"}
      onValueChange={(value) => setTab(value as "add" | "outline")}
      className="gap-3"
    >
      <div className="flex items-center gap-1">
        <TabsList className="min-w-0 flex-1">
          <TabsTrigger value="add">Add</TabsTrigger>
          <TabsTrigger value="outline" className="gap-1.5">
            Outline · {blockCount}
            {issueCounts.errors > 0 && (
              <span
                className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-4 text-white"
                aria-label={`${issueCounts.errors} to fix`}
              >
                {issueCounts.errors}
              </span>
            )}
            {issueCounts.warnings > 0 && (
              <span
                className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white"
                aria-label={`${issueCounts.warnings} warnings`}
              >
                {issueCounts.warnings}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          tooltip="Hide the block list"
          aria-label="Hide the block list"
          onClick={() => onCollapsedChange(true)}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <TabsContent value="add">
        <AddTab readOnly={readOnly} onAdd={onAdd} />
      </TabsContent>
      <TabsContent value="outline">
        <OutlineTab
          nodes={nodes}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      </TabsContent>
    </Tabs>
  );
}
