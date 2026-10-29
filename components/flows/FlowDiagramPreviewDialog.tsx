import {
  Background,
  ControlButton,
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
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow
} from "@xyflow/react";
import {
  AlertTriangle,
  Eye,
  Map as MapIcon,
  PauseCircle,
  Tags,
  UserRound,
  Workflow
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { FlowSimulator } from "@/components/flows/FlowSimulator";
import {
  FlowPlatform,
  getDeadEnds,
  getStartNodeId,
  isSystemEntryNode,
  layoutFlow
} from "@/components/flows/flowGraph";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FlowDiagramPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  platform: FlowPlatform;
  nodes: Node[];
  edges: Edge[];
};

interface MessagePreviewNodeData extends Record<string, unknown> {
  platform: FlowPlatform;
  sourceData: Record<string, unknown>;
  isStart: boolean;
  isUnreachable: boolean;
}

type MessagePreviewNode = Node<MessagePreviewNodeData, "messagePreview">;

// Light, distinct strokes so lines from different blocks are easy to tell
// apart; picked by the source block's position in the flow.
const edgePalette = [
  "#34d399",
  "#38bdf8",
  "#a78bfa",
  "#fbbf24",
  "#f472b6",
  "#2dd4bf",
  "#818cf8",
  "#fb923c"
];
const FADED_OPACITY = 0.25;
const READABLE_ZOOM = 0.8;
const OPENING_ZOOM = 0.9;
// Room kept around the start block on open (the Start badge sits ~24px
// above the block, so the top gets a little extra).
const EDGE_PADDING = 48;
const BADGE_ROOM = 24;

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
      {data.isStart && (
        <span className="absolute -top-6 left-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xs">
          Start
        </span>
      )}
      {data.isUnreachable && (
        <span
          className="absolute -top-6 left-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
          title="No button leads here. It can still start from a broadcast quick reply."
        >
          Unreachable
        </span>
      )}
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

type Mode = "diagram" | "try";

function FlowPreviewBody({
  title,
  platform,
  nodes,
  edges
}: Omit<FlowDiagramPreviewDialogProps, "open" | "onOpenChange">) {
  const { fitView, getInternalNode, setViewport } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [mode, setMode] = useState<Mode>("diagram");
  const [isLaidOut, setIsLaidOut] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [problemIndex, setProblemIndex] = useState(-1);

  const startNodeId = useMemo(() => getStartNodeId(nodes), [nodes]);
  const incoming = useMemo(
    () => new Set(edges.map((edge) => edge.target)),
    [edges]
  );
  const deadEnds = useMemo(
    () => getDeadEnds(nodes, edges, platform),
    [edges, nodes, platform]
  );
  const deadEndCount = deadEnds.reduce(
    (count, entry) => count + entry.options.length,
    0
  );

  // A copy for the preview only: positions are replaced by the auto layout,
  // the editor's nodes and saved data are never touched.
  const [previewNodes, setPreviewNodes, onNodesChange] =
    useNodesState<MessagePreviewNode>(
      nodes.map((node) => ({
        id: node.id,
        type: "messagePreview" as const,
        position: node.position,
        data: {
          platform,
          sourceData: node.data as Record<string, unknown>,
          isStart: node.id === startNodeId,
          isUnreachable:
            node.id !== startNodeId &&
            !incoming.has(node.id) &&
            !isSystemEntryNode(node)
        },
        draggable: false,
        connectable: false,
        deletable: false,
        selectable: false
      }))
    );
  const nodesInitialized = useNodesInitialized();

  const focusNode = useCallback(
    (nodeId: string) =>
      fitView({
        nodes: [{ id: nodeId }],
        minZoom: READABLE_ZOOM,
        maxZoom: 1,
        padding: 0.4,
        duration: 300
      }),
    [fitView]
  );

  // Once every block has rendered (so sizes and option rows are real), lay
  // the graph out and open on the start block at a readable zoom.
  useEffect(() => {
    if (!nodesInitialized || isLaidOut) return;
    let cancelled = false;
    const sizes = new Map<string, { width: number; height: number }>();
    const handles = new Map<string, Array<{ id: string; y: number }>>();
    previewNodes.forEach((node) => {
      const internal = getInternalNode(node.id);
      sizes.set(node.id, {
        width: internal?.measured.width || 292,
        height: internal?.measured.height || 160
      });
      handles.set(
        node.id,
        (internal?.internals.handleBounds?.source || [])
          .filter((handle) => handle.id)
          .map((handle) => ({
            id: String(handle.id),
            y: handle.y + handle.height / 2
          }))
      );
    });

    layoutFlow({ nodes: previewNodes, edges, sizes, handles })
      .then((positions) => {
        if (cancelled) return;
        setPreviewNodes((current) =>
          current.map((node) => ({
            ...node,
            position: positions.get(node.id) || node.position
          }))
        );
        setIsLaidOut(true);
        requestAnimationFrame(() => {
          const start = startNodeId ? positions.get(startNodeId) : undefined;
          const size = startNodeId ? sizes.get(startNodeId) : undefined;
          const bounds = canvasRef.current?.getBoundingClientRect();
          if (!start || !size || !bounds) {
            fitView({ padding: 0.2 });
            return;
          }
          // Pin the start block to the left edge (what follows reads to the
          // right) at a readable zoom, shrinking only if it wouldn't fit.
          const zoom = Math.max(
            0.3,
            Math.min(
              OPENING_ZOOM,
              (bounds.width - EDGE_PADDING * 2) / size.width,
              (bounds.height - EDGE_PADDING * 2 - BADGE_ROOM) / size.height
            )
          );
          const blockHeight = size.height * zoom;
          const top =
            blockHeight + EDGE_PADDING * 2 + BADGE_ROOM < bounds.height
              ? (bounds.height - blockHeight + BADGE_ROOM) / 2
              : EDGE_PADDING + BADGE_ROOM;
          setViewport({
            x: EDGE_PADDING - start.x * zoom,
            y: top - start.y * zoom,
            zoom
          });
        });
      })
      .catch(() => {
        // Fall back to the editor's positions rather than an empty canvas.
        if (!cancelled) {
          setIsLaidOut(true);
          fitView({ padding: 0.2, maxZoom: 0.9 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    edges,
    fitView,
    getInternalNode,
    isLaidOut,
    setViewport,
    nodesInitialized,
    previewNodes,
    setPreviewNodes,
    startNodeId
  ]);

  const activeId = pinnedId || hoveredId;
  const related = useMemo(() => {
    if (!activeId) return null;
    const nodeIds = new Set([activeId]);
    const edgeIds = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === activeId || edge.target === activeId) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    });
    return { nodeIds, edgeIds };
  }, [activeId, edges]);

  const displayNodes = useMemo(
    () =>
      previewNodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity: related && !related.nodeIds.has(node.id) ? FADED_OPACITY : 1,
          transition: "opacity 150ms"
        }
      })),
    [previewNodes, related]
  );

  const colorBySource = useMemo(
    () =>
      new Map(
        nodes.map((node, index) => [
          node.id,
          edgePalette[index % edgePalette.length]
        ])
      ),
    [nodes]
  );
  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const color = colorBySource.get(edge.source) || edgePalette[0];
        const isRelated = related?.edgeIds.has(edge.id);
        return {
          ...edge,
          type: "default",
          animated: false,
          selectable: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color
          },
          style: {
            stroke: color,
            strokeWidth: isRelated ? 2.5 : 1.75,
            opacity: related && !isRelated ? FADED_OPACITY : 1,
            transition: "opacity 150ms"
          }
        };
      }),
    [colorBySource, edges, related]
  );

  const cycleProblems = () => {
    if (!deadEnds.length) return;
    const next = (problemIndex + 1) % deadEnds.length;
    setProblemIndex(next);
    setMode("diagram");
    setPinnedId(deadEnds[next].nodeId);
    focusNode(deadEnds[next].nodeId);
  };

  return (
    <>
      <DialogHeader className="shrink-0 border-b bg-white px-5 py-4 pr-14 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
            <Workflow className="size-4" />
          </span>
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription className="mt-1">
              {mode === "diagram"
                ? "Hover or click a block to trace its connections."
                : "Tap buttons to walk through the flow like a customer."}
            </DialogDescription>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {deadEndCount > 0 && (
              <button
                type="button"
                onClick={cycleProblems}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100"
                title="Show each block with an unconnected button"
              >
                <AlertTriangle className="size-3.5" />
                {deadEndCount} button{deadEndCount === 1 ? " leads" : "s lead"}{" "}
                nowhere
              </button>
            )}
            <Badge variant="secondary">
              <Eye className="size-3" /> {nodes.length} blocks · {edges.length}{" "}
              connections
            </Badge>
            <div
              role="radiogroup"
              aria-label="Preview mode"
              className="inline-flex rounded-md bg-muted p-0.5"
            >
              {(
                [
                  ["diagram", "Diagram"],
                  ["try", "Try it"]
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "cursor-pointer rounded-sm px-3 py-1 text-xs font-medium transition",
                    mode === value
                      ? "bg-white text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogHeader>

      {nodes.length === 0 && (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 text-sm text-muted-foreground">
          Add a block to preview this flow.
        </div>
      )}
      {/* Both views stay mounted so switching back keeps the layout. */}
      <div
        ref={canvasRef}
        className={cn(
          "min-h-0 flex-1 bg-slate-50",
          (mode !== "diagram" || nodes.length === 0) && "hidden"
        )}
      >
        <ReactFlow
          className={cn(
            "transition-opacity",
            isLaidOut ? "opacity-100" : "opacity-0"
          )}
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          nodeTypes={previewNodeTypes}
          minZoom={0.3}
          maxZoom={1.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onNodeClick={(_, node) =>
            setPinnedId((current) => (current === node.id ? null : node.id))
          }
          onPaneClick={() => setPinnedId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="#cbd5e1" />
          <Controls showInteractive={false} fitViewOptions={{ padding: 0.2 }}>
            <ControlButton
              onClick={() => setIsMinimapVisible((current) => !current)}
              title={isMinimapVisible ? "Hide minimap" : "Show minimap"}
              aria-label={isMinimapVisible ? "Hide minimap" : "Show minimap"}
              aria-pressed={isMinimapVisible}
            >
              <MapIcon />
            </ControlButton>
          </Controls>
          {isMinimapVisible && (
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              style={{ width: 160, height: 110 }}
              className="!m-3 !overflow-hidden !rounded-lg !border !bg-white/60 !shadow-sm backdrop-blur-sm"
              maskColor="rgba(241, 245, 249, 0.55)"
            />
          )}
        </ReactFlow>
      </div>
      {mode === "try" && nodes.length > 0 && (
        <div className="min-h-0 flex-1 bg-slate-100">
          <FlowSimulator
            platform={platform}
            nodes={nodes}
            edges={edges}
            startNodeId={startNodeId}
          />
        </div>
      )}
    </>
  );
}

export default function FlowDiagramPreviewDialog({
  open,
  onOpenChange,
  ...props
}: FlowDiagramPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[86vh] max-h-[900px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(94vw,1400px)]">
        {open && (
          <ReactFlowProvider>
            <FlowPreviewBody {...props} />
          </ReactFlowProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
