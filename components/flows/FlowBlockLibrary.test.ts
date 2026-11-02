import { describe, expect, it } from "vitest";

import { BotFlowReactNode } from "./BotFlowNode";
import { getBlockLabel, outlineOrder } from "./FlowBlockLibrary";

const block = (
  id: string,
  triggerKey: string,
  extra: Partial<BotFlowReactNode> & { isStart?: boolean } = {}
): BotFlowReactNode => ({
  id,
  type: "botBlock",
  position: { x: 0, y: 0 },
  hidden: extra.hidden,
  data: {
    label: id,
    triggerKey,
    blockType: "text",
    actions: [],
    metadata: extra.isStart ? { isDefault: true } : {}
  }
});

describe("outlineOrder", () => {
  it("puts the start block first and opt-in/opt-out last, without hidden blocks", () => {
    const nodes = [
      block("opt_out", "OPT_OUT"),
      block("pricing", "PRICING"),
      block("menu", "MENU", { isStart: true }),
      block("follow_up", "FOLLOW_UP", { hidden: true }),
      block("opt_in", "OPT_IN"),
      block("support", "SUPPORT")
    ];
    expect(outlineOrder(nodes).map((node) => node.id)).toEqual([
      "menu",
      "pricing",
      "support",
      "opt_out",
      "opt_in"
    ]);
  });
});

describe("palette names", () => {
  it("uses the new names for new blocks", () => {
    expect(getBlockLabel("location_request")).toBe("Ask for location");
    expect(getBlockLabel("address_request")).toBe("Ask for address (India)");
    expect(getBlockLabel("location")).toBe("Send location");
    expect(getBlockLabel("contacts")).toBe("Send contact");
  });
});
