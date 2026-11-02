import {
  CheckCircle2,
  GalleryHorizontal,
  ImageIcon,
  MessageCircle,
  MousePointerClick,
  PauseCircle,
  Reply,
  Tags,
  UserCheck,
  UserRound,
  Video
} from "lucide-react";

import { InstagramBlockType } from "@/client-api/types/instagram.type";
import type { PickerPalette } from "@/components/flows/FlowBlockPicker";

import { BLOCK_LABELS, IgFlowNode, isMainMenu } from "./instagramFlow";

export const BLOCK_ICONS: Record<InstagramBlockType, React.ElementType> = {
  send_text: MessageCircle,
  send_image: ImageIcon,
  send_video: Video,
  quick_replies: Reply,
  button_template: MousePointerClick,
  generic_template: GalleryHorizontal,
  follow_condition: UserCheck,
  tag_subscriber: Tags,
  handoff_to_agent: UserRound,
  pause_automation: PauseCircle,
  end_flow: CheckCircle2
};

export const getBlockIcon = (type: InstagramBlockType) =>
  BLOCK_ICONS[type] || MessageCircle;

export const getBlockLabel = (type: InstagramBlockType) =>
  BLOCK_LABELS[type] || "Block";

type CatalogItem = {
  type: InstagramBlockType;
  label: string;
  description: string;
  icon: React.ElementType;
};

const item = (type: InstagramBlockType, description: string): CatalogItem => ({
  type,
  label: BLOCK_LABELS[type],
  description,
  icon: BLOCK_ICONS[type]
});

/** The Add tab, and "Create a new block…" in the block picker. */
export const blockCatalog: Array<{ group: string; items: CatalogItem[] }> = [
  {
    group: "Send",
    items: [
      item("send_text", "A text message"),
      item("send_image", "An image from your media library"),
      item("send_video", "A video from your media library"),
      item("quick_replies", "A message with up to 13 tappable answers"),
      item(
        "button_template",
        "A message with up to 3 buttons: an answer or a link"
      ),
      item(
        "generic_template",
        "Up to 10 swipeable cards with images and buttons"
      )
    ]
  },
  {
    group: "Decide",
    items: [
      item(
        "follow_condition",
        "Send followers and non-followers different messages"
      ),
      item("tag_subscriber", "Label the person for later, e.g. 'lead'")
    ]
  },
  {
    group: "Finish",
    items: [
      item("handoff_to_agent", "Stop automation and alert your team"),
      item("pause_automation", "Stop automated replies for a while"),
      item("end_flow", "Mark the chat as resolved")
    ]
  }
];

export const pickerPalette: PickerPalette<InstagramBlockType> = blockCatalog;

/**
 * Blocks in flow order: the main menu, then each block the first time it is
 * reached by following wires, then the rest as they were added.
 */
export const flowOrder = <
  N extends Pick<IgFlowNode, "id" | "hidden"> & {
    data: Pick<IgFlowNode["data"], "triggerType">;
  }
>(
  nodes: N[],
  edges: Array<{ source: string; target: string }> = []
): N[] => {
  const visible = nodes.filter((node) => !node.hidden);
  const byId = new Map(visible.map((node) => [node.id, node]));
  const targets = new Map<string, string[]>();
  edges.forEach((edge) =>
    targets.set(edge.source, [...(targets.get(edge.source) || []), edge.target])
  );
  const ordered: N[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const queue = [id];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current) || !byId.has(current)) continue;
      seen.add(current);
      ordered.push(byId.get(current)!);
      queue.push(...(targets.get(current) || []));
    }
  };
  visible
    .filter((node) => isMainMenu(node.data))
    .forEach((node) => visit(node.id));
  visible
    .filter((node) => node.data.triggerType)
    .forEach((node) => visit(node.id));
  visible.forEach((node) => visit(node.id));
  return ordered;
};
