import { Fragment, memo, useEffect, useMemo } from "react";
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
  CircleOff,
  ContactRound,
  ExternalLink,
  FileText,
  ImageIcon,
  List,
  LocateFixed,
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
  BotActionType,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import { Badge } from "@/components/ui/badge";
import { formatDelay, getNodeOptions } from "@/lib/flowBuilder";
import { cn } from "@/lib/utils";

export interface BotFlowNodeData extends Record<string, unknown> {
  label: string;
  triggerKey: string;
  blockType: BotBlockType;
  actions: BotAction[];
  content?: BotCanvasNodeContent;
  metadata?: Record<string, unknown>;
  locked?: boolean;
  summary?: string;
  // Display only: worked out by the editor, never saved.
  /** Target block name for each wired option, by actionId. */
  targets?: Record<string, string>;
  /** The worst problem the backend found on this block. */
  issueSeverity?: "error" | "warning";
  /** Changed since the live version. */
  changed?: boolean;
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
  list: "List menu",
  image: "Image",
  document: "Document",
  video: "Video",
  location: "Location pin",
  location_request: "Ask for location",
  address_request: "Ask for address",
  contacts: "Contact card",
  handoff_to_agent: "Hand to team",
  product_carousel: "Product carousel",
  generic_carousel: "Carousel"
};

// Options that end here instead of going to another block.
const terminalActions: Partial<
  Record<BotActionType, { label: string; icon: React.ElementType }>
> = {
  escalate_to_agent: { label: "Hand to team", icon: UserRound },
  open_url: { label: "Open website", icon: ExternalLink },
  end_conversation: { label: "End chat", icon: CircleOff }
};

function BotFlowNode({ id, data, selected }: NodeProps<BotFlowReactNode>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const Icon = iconByType[data.blockType] || Bot;
  const isStartNode = Boolean(data.metadata?.isDefault);
  const followUp = data.followUp as
    | { enabled?: boolean; delayMinutes?: number }
    | undefined;
  const followUpMinutes =
    followUp?.enabled && data.metadata?.automaticFollowUp
      ? Number(followUp.delayMinutes) || 0
      : 0;
  const options = useMemo(
    () => getNodeOptions(data.blockType, data.content, data.actions),
    [data.actions, data.blockType, data.content]
  );
  const isCarousel = data.blockType === "generic_carousel";
  const isList = data.blockType === "list";
  const outputHandleKey = useMemo(
    () =>
      options
        .filter((option) => option.type === "go_to_trigger")
        .map((option) => option.actionId)
        .join("|"),
    [options]
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, outputHandleKey, updateNodeInternals]);

  return (
    <div
      className={cn(
        "relative min-w-72 max-w-80 rounded-xl border bg-white shadow-sm transition",
        isStartNode && "border-2 border-primary shadow-md",
        selected && "border-primary shadow-md ring-2 ring-primary/15",
        data.issueSeverity === "error" &&
          "border-destructive ring-2 ring-destructive/15"
      )}
    >
      {data.issueSeverity && (
        <span
          className={cn(
            "absolute -right-1.5 -top-1.5 z-20 size-3.5 rounded-full border-2 border-white shadow-sm",
            data.issueSeverity === "error" ? "bg-destructive" : "bg-amber-500"
          )}
          title={
            data.issueSeverity === "error"
              ? "Has problems to fix"
              : "Has warnings"
          }
          aria-label={
            data.issueSeverity === "error"
              ? "Has problems to fix"
              : "Has warnings"
          }
        />
      )}
      {isStartNode && (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Start
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
            {data.changed && (
              <span
                className="size-2 shrink-0 rounded-full bg-sky-500"
                title="Changed, not live yet"
                aria-label="Changed, not live yet"
              />
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {labelByType[data.blockType]}
            </Badge>
            {followUpMinutes > 0 && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Timer className="size-3" />
                Follow-up in {formatDelay(followUpMinutes)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {data.summary || "Configure this block from the properties panel."}
        </p>
      </div>

      {options.length > 0 && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-3 pr-6">
          {options.map((option, index) => {
            const terminal = terminalActions[option.type];
            const target = data.targets?.[option.actionId];
            const showGroup =
              isList &&
              option.group &&
              option.group !== options[index - 1]?.group;
            return (
              <Fragment key={option.actionId}>
                {showGroup && (
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {option.group}
                  </p>
                )}
                <div className="relative flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs shadow-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {isCarousel && option.group
                        ? `${option.group} · ${option.label}`
                        : option.label}
                    </p>
                    {option.description && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {terminal ? (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <terminal.icon className="size-3" />
                      {terminal.label}
                    </span>
                  ) : target ? (
                    <span className="max-w-32 shrink-0 truncate text-[11px] font-medium text-primary">
                      → {target}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                      Choose next step
                    </span>
                  )}
                  {option.type === "go_to_trigger" && (
                    <Handle
                      id={option.actionId}
                      type="source"
                      position={Position.Right}
                      style={{
                        right: -18,
                        top: "50%",
                        transform: "translate(50%, -50%)"
                      }}
                      className="!size-3.5 !border-2 !border-white !bg-primary !shadow-sm"
                    />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(BotFlowNode);
