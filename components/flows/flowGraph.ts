import { Edge, Node } from "@xyflow/react";

export type FlowPlatform = "WhatsApp" | "Instagram";

type LooseRecord = Record<string, unknown>;

export interface RouteOption {
  /** The handle id connections leave from. */
  id: string;
  label: string;
}

// Keyword entry points the backend starts directly (not via a button), so
// they're never "unreachable".
const SYSTEM_TRIGGER_KEYS = new Set(["OPT_IN", "OPT_OUT"]);

const nodeData = (node: Node) => (node.data || {}) as LooseRecord;
const triggerKeyOf = (node: Node) => String(nodeData(node).triggerKey || "");

export const isSystemEntryNode = (node: Node) =>
  SYSTEM_TRIGGER_KEYS.has(triggerKeyOf(node));

/** The flow's default block: where a new conversation starts. */
export const getStartNodeId = (nodes: Node[]) => {
  const marked = nodes.find(
    (node) =>
      (nodeData(node).metadata as LooseRecord | undefined)?.isDefault === true
  );
  return (
    marked?.id ||
    nodes.find((node) => !isSystemEntryNode(node))?.id ||
    nodes[0]?.id ||
    null
  );
};

const label = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

/**
 * The tappable options on a block that can lead somewhere, in display order,
 * keyed by the same handle ids FlowBlockPreview renders.
 */
export const getRouteOptions = (
  node: Node,
  platform: FlowPlatform
): RouteOption[] => {
  const data = nodeData(node);
  if (platform === "WhatsApp") {
    const actions = Array.isArray(data.actions)
      ? (data.actions as LooseRecord[])
      : [];
    return actions
      .filter((action) => action.type === "go_to_trigger" && action.actionId)
      .map((action, index) => ({
        id: String(action.actionId),
        label: label(action.label, `Option ${index + 1}`)
      }));
  }

  const content = (data.content || {}) as LooseRecord;
  const options: RouteOption[] = [];
  const pushButtons = (buttons: unknown) => {
    if (!Array.isArray(buttons)) return;
    (buttons as LooseRecord[]).slice(0, 3).forEach((button, index) => {
      if (button.type === "web_url") return;
      const id = button.actionId || button.replyId || button.payload;
      if (id)
        options.push({
          id: String(id),
          label: label(button.label || button.title, `Button ${index + 1}`)
        });
    });
  };
  if (
    data.blockType === "quick_replies" &&
    Array.isArray(content.quickReplies)
  ) {
    (content.quickReplies as LooseRecord[]).forEach((reply, index) => {
      const id = reply.replyId || reply.payload;
      if (id)
        options.push({
          id: String(id),
          label: label(reply.label || reply.title, `Reply ${index + 1}`)
        });
    });
  }
  if (data.blockType === "button_template") pushButtons(content.buttons);
  if (data.blockType === "generic_template" && Array.isArray(content.cards)) {
    (content.cards as LooseRecord[]).forEach((card) =>
      pushButtons(card.buttons)
    );
  }
  return options;
};

export const edgeKey = (source: string, handle?: string | null) =>
  `${source}::${handle || ""}`;

/** Options with no connection, grouped by block, in node order. */
export const getDeadEnds = (
  nodes: Node[],
  edges: Edge[],
  platform: FlowPlatform
) => {
  const wired = new Set(
    edges.map((edge) => edgeKey(edge.source, edge.sourceHandle))
  );
  return nodes
    .map((node) => ({
      nodeId: node.id,
      options: getRouteOptions(node, platform).filter(
        (option) => !wired.has(edgeKey(node.id, option.id))
      )
    }))
    .filter((entry) => entry.options.length > 0);
};

type Size = { width: number; height: number };
type HandlePoint = { id: string; y: number };

/**
 * Left-to-right layered layout. Each option is a fixed port at its real
 * rendered height, so lines leave from the right row and ELK orders the
 * next column to match.
 */
export const layoutFlow = async ({
  nodes,
  edges,
  sizes,
  handles
}: {
  nodes: Node[];
  edges: Edge[];
  sizes: Map<string, Size>;
  handles: Map<string, HandlePoint[]>;
}) => {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const nodeIds = new Set(nodes.map((node) => node.id));

  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.spacing.nodeNode": "40",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.semiInteractive": "true",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": "80"
    },
    children: nodes.map((node) => {
      const size = sizes.get(node.id) || { width: 292, height: 160 };
      const ports = handles.get(node.id) || [];
      return {
        id: node.id,
        width: size.width,
        height: size.height,
        layoutOptions: { "elk.portConstraints": "FIXED_POS" },
        ports: [
          {
            id: `${node.id}::in`,
            x: 0,
            y: Math.min(40, size.height / 2),
            width: 1,
            height: 1,
            layoutOptions: { "elk.port.side": "WEST" }
          },
          ...ports.map((port) => ({
            id: edgeKey(node.id, port.id),
            x: size.width,
            y: port.y,
            width: 1,
            height: 1,
            layoutOptions: { "elk.port.side": "EAST" }
          }))
        ]
      };
    }),
    edges: edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => {
        const sourcePort = (handles.get(edge.source) || []).some(
          (port) => port.id === edge.sourceHandle
        )
          ? edgeKey(edge.source, edge.sourceHandle)
          : edge.source;
        return {
          id: edge.id,
          sources: [sourcePort],
          targets: [`${edge.target}::in`]
        };
      })
  });

  return new Map(
    (graph.children || []).map((child) => [
      child.id,
      { x: child.x || 0, y: child.y || 0 }
    ])
  );
};
