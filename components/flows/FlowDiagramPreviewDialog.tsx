import {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeProps,
  NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider
} from "@xyflow/react";
import { Eye, PauseCircle, Tags, UserRound, Workflow } from "lucide-react";
import { useMemo } from "react";

import {
  BotAction,
  BotBlockType,
  BotCanvasNodeContent
} from "@/client-api/types/bot.type";
import {
  InstagramBlockType,
  InstagramCanvasContent
} from "@/client-api/types/instagram.type";
import {
  InstagramFlowBlockPreview,
  WhatsAppFlowBlockPreview
} from "@/components/flows/FlowBlockPreview";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

type FlowDiagramPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  platform: "WhatsApp" | "Instagram";
  nodes: Node[];
  edges: Edge[];
};

interface MessagePreviewNodeData extends Record<string, unknown> {
  platform: "WhatsApp" | "Instagram";
  sourceData: Record<string, unknown>;
}

type MessagePreviewNode = Node<MessagePreviewNodeData, "messagePreview">;

const instagramMessageTypes = new Set<InstagramBlockType>([
  "send_text",
  "send_image",
  "send_video",
  "quick_replies",
  "button_template",
  "generic_template"
]);

const instagramOperationMeta: Partial<
  Record<InstagramBlockType, { label: string; icon: React.ElementType }>
> = {
  tag_subscriber: { label: "Tag subscriber", icon: Tags },
  handoff_to_agent: { label: "Handoff to agent", icon: UserRound },
  pause_automation: { label: "Pause automation", icon: PauseCircle },
  end_flow: { label: "End flow", icon: Workflow }
};

function MessagePreviewDiagramNode({ data }: NodeProps<MessagePreviewNode>) {
  const sourceData = data.sourceData;
  const blockType = sourceData.blockType as BotBlockType | InstagramBlockType;
  const content = (sourceData.content || {}) as Record<string, unknown>;
  const cards = Array.isArray(content.cards) ? content.cards : [];
  const productCount = Array.isArray(content.sections)
    ? (content.sections as Array<Record<string, unknown>>).reduce(
        (count, section) =>
          count +
          (Array.isArray(section.productRetailerIds)
            ? section.productRetailerIds.length
            : 0),
        0
      )
    : 0;
  const carouselCount = Math.max(
    1,
    blockType === "product_carousel" ? productCount : cards.length
  );
  const previewWidth =
    blockType === "generic_carousel" ||
    blockType === "product_carousel" ||
    blockType === "generic_template"
      ? Math.min(1120, Math.max(292, carouselCount * 184 + 24))
      : data.platform === "Instagram"
        ? 280
        : 292;

  return (
    <div className="nodrag nopan nowheel relative">
      <Handle
        id="in"
        type="target"
        position={Position.Left}
        className={
          data.platform === "Instagram"
            ? "!left-[-7px] !size-3.5 !border-2 !border-white !bg-pink-500 !shadow-sm"
            : "!left-[-7px] !size-3.5 !border-2 !border-white !bg-emerald-500 !shadow-sm"
        }
      />

      {data.platform === "WhatsApp" ? (
        <div style={{ width: previewWidth }}>
          <WhatsAppFlowBlockPreview
            blockType={blockType as BotBlockType}
            content={sourceData.content as BotCanvasNodeContent}
            actions={(sourceData.actions as BotAction[]) || []}
            showClose={false}
            showRouteHandles
          />
        </div>
      ) : instagramMessageTypes.has(blockType as InstagramBlockType) ? (
        <div style={{ width: previewWidth }}>
          <InstagramFlowBlockPreview
            blockType={blockType as InstagramBlockType}
            content={sourceData.content as InstagramCanvasContent}
            showClose={false}
            showRouteHandles
          />
        </div>
      ) : (
        <InstagramOperationPreview
          blockType={blockType as InstagramBlockType}
          content={sourceData.content as InstagramCanvasContent}
        />
      )}
    </div>
  );
}

function InstagramOperationPreview({
  blockType,
  content
}: {
  blockType: InstagramBlockType;
  content: InstagramCanvasContent;
}) {
  const meta = instagramOperationMeta[blockType] || {
    label: "Instagram action",
    icon: Workflow
  };
  const Icon = meta.icon;
  const detail =
    blockType === "tag_subscriber"
      ? ((content.tags as string[] | undefined) || []).join(", ") ||
        "No tags configured"
      : blockType === "pause_automation"
        ? `${content.minutes || content.pauseMinutes || 60} minutes`
        : String(content.reason || "Automation step").replaceAll("_", " ");

  return (
    <div className="w-60 rounded-xl border border-pink-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-pink-50 text-pink-600">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
          <p className="truncate text-[10px] capitalize text-slate-500">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

const previewNodeTypes: NodeTypes = {
  messagePreview: MessagePreviewDiagramNode
};

export default function FlowDiagramPreviewDialog({
  open,
  onOpenChange,
  title,
  platform,
  nodes,
  edges
}: FlowDiagramPreviewDialogProps) {
  const previewNodes = useMemo(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: "messagePreview" as const,
        position: node.position,
        data: {
          platform,
          sourceData: node.data as Record<string, unknown>
        },
        selected: false,
        draggable: false,
        connectable: false,
        deletable: false
      })),
    [nodes, platform]
  );
  const previewEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: false,
        selectable: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: platform === "Instagram" ? "#db2777" : "#16a34a"
        },
        style: {
          ...edge.style,
          stroke: platform === "Instagram" ? "#db2777" : "#16a34a",
          strokeWidth: 1.75
        }
      })),
    [edges, platform]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] max-h-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,1400px)]">
        <DialogHeader className="shrink-0 border-b bg-white px-5 py-4 pr-14 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
              <Workflow className="size-4" />
            </span>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                Live message previews with each connection originating from its
                button, reply, list row, or carousel item.
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="ml-auto mr-2">
              <Eye className="size-3" /> {nodes.length} blocks · {edges.length}{" "}
              connections
            </Badge>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-slate-50">
          <ReactFlowProvider>
            <ReactFlow
              nodes={previewNodes}
              edges={previewEdges}
              nodeTypes={previewNodeTypes}
              fitView
              fitViewOptions={{ padding: 0.22, maxZoom: 0.9 }}
              minZoom={0.15}
              maxZoom={1.2}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnDoubleClick={false}
              deleteKeyCode={null}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                className="!h-28 !w-40 !rounded-lg !border !bg-white/90"
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
