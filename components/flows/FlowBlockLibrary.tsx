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
  Search,
  UserRound,
  Video
} from "lucide-react";
import { useMemo, useState } from "react";

import { BotBlockType } from "@/client-api/types/bot.type";
import { BotFlowReactNode } from "@/components/flows/BotFlowNode";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
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
        label: "Location",
        description: "Ask the customer to share where they are",
        icon: LocateFixed
      },
      {
        type: "address_request",
        label: "Address (India)",
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
        label: "Location pin",
        description: "Send a place on the map",
        icon: MapPin
      },
      {
        type: "contacts",
        label: "Contact card",
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

const matches = (text: string, query: string) =>
  text.toLowerCase().includes(query.trim().toLowerCase());

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
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="h-8 bg-white pl-8 text-sm"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {groups.map((group) => (
        <div key={group.group} className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip key={item.type}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      draggable={!readOnly}
                      disabled={readOnly}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "application/whatching-block",
                          item.type
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => onAdd(item.type)}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border bg-white p-2 text-center text-xs font-medium shadow-xs transition hover:border-primary/40 hover:bg-primary/5",
                        readOnly
                          ? "cursor-not-allowed opacity-55"
                          : "cursor-grab"
                      )}
                    >
                      <Icon className="size-4 text-primary" />
                      {item.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.description}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
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
    const visible = nodes.filter(
      (node) =>
        !node.hidden && (!query.trim() || matches(node.data.label, query))
    );
    const isSystem = (node: BotFlowReactNode) =>
      SYSTEM_TRIGGER_KEYS.has(node.data.triggerKey);
    const isStart = (node: BotFlowReactNode) =>
      Boolean(node.data.metadata?.isDefault);
    return {
      // The start block first, then the rest in flow order.
      main: [
        ...visible.filter((node) => isStart(node) && !isSystem(node)),
        ...visible.filter((node) => !isStart(node) && !isSystem(node))
      ],
      system: visible.filter(isSystem)
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
          {Boolean(node.data.metadata?.isDefault) && (
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

/** The left rail: add blocks, or find one already in the flow. */
export function FlowBlockLibrary({
  readOnly,
  nodes,
  selectedNodeId,
  onAdd,
  onSelectNode
}: {
  readOnly: boolean;
  nodes: BotFlowReactNode[];
  selectedNodeId: string | null;
  onAdd: (type: BotBlockType) => void;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <Tabs defaultValue="add" className="gap-3">
      <TabsList className="w-full">
        <TabsTrigger value="add">Add</TabsTrigger>
        <TabsTrigger value="outline">Outline</TabsTrigger>
      </TabsList>
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
