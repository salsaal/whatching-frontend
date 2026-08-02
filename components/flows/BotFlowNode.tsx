import { memo, useEffect, useMemo } from "react";
import {
  Handle,
  Node,
  NodeProps,
  Position,
  useUpdateNodeInternals
} from "@xyflow/react";
import {
  Bot,
  Boxes,
  FileText,
  ContactRound,
  ImageIcon,
  LocateFixed,
  List,
  Lock,
  MapPin,
  MessageSquareText,
  MousePointerClick,
  Package,
  Timer,
  UserRound,
  Video
} from "lucide-react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { Badge } from "@/components/ui/badge";
import { WhatsAppFlowBlockPreview } from "@/components/flows/FlowBlockPreview";
import { cn } from "@/lib/utils";

export interface BotFlowNodeData extends Record<string, unknown> {
  label: string;
  triggerKey: string;
  blockType: BotBlockType;
  actions: BotAction[];
  content?: BotCanvasNodeContent;
  metadata?: Record<string, unknown>;
  locked?: boolean;
  invalid?: boolean;
  summary?: string;
}

export type BotFlowReactNode = Node<BotFlowNodeData, "botBlock">;

const iconByType: Record<BotBlockType, React.ElementType> = {
  text: MessageSquareText,
  buttons: MousePointerClick,
  list: List,
  image: ImageIcon,
  document: FileText,
  video: Video,
  location: MapPin,
  location_request: LocateFixed,
  address_request: MapPin,
  contacts: ContactRound,
  handoff_to_agent: UserRound,
  product_carousel: Package,
  generic_carousel: Boxes
};

const labelByType: Record<BotBlockType, string> = {
  text: "Text",
  buttons: "Buttons",
  list: "List Menu",
  image: "Image",
  document: "Document",
  video: "Video",
  location: "Location",
  location_request: "Location Request",
  address_request: "Address Request",
  contacts: "Contacts",
  handoff_to_agent: "Agent Trigger",
  product_carousel: "Product Carousel",
  generic_carousel: "Generic Carousel"
};

function BotFlowNode({ id, data, selected }: NodeProps<BotFlowReactNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const hasAutomaticFollowUp = Boolean(data.metadata?.automaticFollowUp);
  const Icon = iconByType[data.blockType] || Bot;
  const isDefaultNode = Boolean(data.metadata?.isDefault);
  const outputActions = useMemo(
    () => data.actions.filter((action) => action.type === "go_to_trigger"),
    [data.actions]
  );
  const outputHandleKey = useMemo(
    () => outputActions.map((action) => action.actionId).join("|"),
    [outputActions]
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputHandleKey, updateNodeInternals]);

  if (
    (data.blockType === "buttons" || data.blockType === "list") &&
    data.content
  ) {
    return (
      <div
        className={cn(
          "relative w-[320px] rounded-xl transition",
          selected && "ring-2 ring-primary/30",
          data.invalid && "ring-2 ring-destructive/30"
        )}
      >
        {isDefaultNode && (
          <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            Default
          </div>
        )}
        {hasAutomaticFollowUp && (
          <div
            className="absolute -right-2 -top-2 z-20 flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-sm"
            title="Automatic follow-up configured"
          >
            <Timer className="size-3.5" />
          </div>
        )}
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          className="!left-[-1px] !size-3.5 !border-2 !border-white !bg-primary !shadow-sm"
        />
        <WhatsAppFlowBlockPreview
          blockType={data.blockType}
          content={data.content}
          actions={data.actions}
          showClose={false}
          showRouteHandles
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative min-w-72 max-w-80 rounded-xl border bg-white shadow-sm transition",
        isDefaultNode && "border-2 border-primary shadow-md",
        selected && "border-primary shadow-md ring-2 ring-primary/15",
        data.invalid && "border-destructive ring-2 ring-destructive/15"
      )}
    >
      {hasAutomaticFollowUp && (
        <div
          className="absolute -right-2 -top-2 z-20 flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-sm"
          title="Automatic follow-up configured"
        >
          <Timer className="size-3.5" />
        </div>
      )}
      {isDefaultNode && (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Default
        </div>
      )}
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className="!size-3.5 !border-2 !border-white !bg-primary !shadow-sm"
      />

      <div className="flex items-start gap-3 border-b px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {data.label}
            </p>
            {data.locked && <Lock className="size-3.5 shrink-0 text-primary" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {labelByType[data.blockType]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {data.summary || "Configure this block from the properties panel."}
        </p>
      </div>

      {outputActions.length > 0 && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pr-6">
          {outputActions.map((action) => (
            <div
              key={action.actionId}
              className="relative flex items-center justify-between gap-3 rounded-md bg-white px-2 py-1.5 text-xs shadow-xs"
            >
              <span className="truncate">{action.label || "Send message"}</span>
              <Badge variant="secondary" className="text-[10px]">
                route
              </Badge>
              <Handle
                id={action.actionId}
                type="source"
                position={Position.Right}
                style={{
                  right: -18,
                  top: "50%",
                  transform: "translate(50%, -50%)"
                }}
                className="!size-3.5 !border-2 !border-white !bg-primary !shadow-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(BotFlowNode);
