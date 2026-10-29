import { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  getDeadEnds,
  getRouteOptions,
  getStartNodeId,
  layoutFlow
} from "./flowGraph";

const whatsappNode = (
  id: string,
  actions: Array<Record<string, unknown>> = [],
  extra: Record<string, unknown> = {}
): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {
    blockType: "buttons",
    triggerKey: id.toUpperCase(),
    actions,
    ...extra
  }
});

describe("getStartNodeId", () => {
  it("prefers the block marked as default", () => {
    const nodes = [
      whatsappNode("a"),
      whatsappNode("b", [], { metadata: { isDefault: true } })
    ];
    expect(getStartNodeId(nodes)).toBe("b");
  });

  it("skips opt-in/opt-out blocks when nothing is marked", () => {
    const nodes = [
      whatsappNode("x", [], { triggerKey: "OPT_OUT" }),
      whatsappNode("menu")
    ];
    expect(getStartNodeId(nodes)).toBe("menu");
  });
});

describe("getRouteOptions", () => {
  it("lists only WhatsApp actions that route to a block", () => {
    const node = whatsappNode("a", [
      { type: "go_to_trigger", actionId: "act1", label: "Prices" },
      { type: "open_url", actionId: "act2", label: "Website" }
    ]);
    expect(getRouteOptions(node, "WhatsApp")).toEqual([
      { id: "act1", label: "Prices" }
    ]);
  });

  it("reads Instagram quick replies and skips link buttons", () => {
    const replies: Node = {
      id: "q",
      position: { x: 0, y: 0 },
      data: {
        blockType: "quick_replies",
        content: { quickReplies: [{ replyId: "r1", label: "Yes" }] }
      }
    };
    const buttons: Node = {
      id: "b",
      position: { x: 0, y: 0 },
      data: {
        blockType: "button_template",
        content: {
          buttons: [
            { type: "web_url", title: "Site" },
            { type: "postback", payload: "p1", title: "Talk to us" }
          ]
        }
      }
    };
    expect(getRouteOptions(replies, "Instagram")).toEqual([
      { id: "r1", label: "Yes" }
    ]);
    expect(getRouteOptions(buttons, "Instagram")).toEqual([
      { id: "p1", label: "Talk to us" }
    ]);
  });
});

describe("getDeadEnds", () => {
  it("returns options with no outgoing connection", () => {
    const nodes = [
      whatsappNode("a", [
        { type: "go_to_trigger", actionId: "act1", label: "One" },
        { type: "go_to_trigger", actionId: "act2", label: "Two" }
      ]),
      whatsappNode("b")
    ];
    const edges: Edge[] = [
      { id: "e1", source: "a", sourceHandle: "act1", target: "b" }
    ];
    expect(getDeadEnds(nodes, edges, "WhatsApp")).toEqual([
      { nodeId: "a", options: [{ id: "act2", label: "Two" }] }
    ]);
  });
});

describe("layoutFlow", () => {
  it("places connected blocks left to right", async () => {
    const nodes = [whatsappNode("a"), whatsappNode("b")];
    const edges: Edge[] = [
      { id: "e1", source: "a", sourceHandle: "act1", target: "b" }
    ];
    const positions = await layoutFlow({
      nodes,
      edges,
      sizes: new Map([
        ["a", { width: 300, height: 200 }],
        ["b", { width: 300, height: 200 }]
      ]),
      handles: new Map([["a", [{ id: "act1", y: 150 }]]])
    });
    expect(positions.get("b")!.x).toBeGreaterThanOrEqual(
      positions.get("a")!.x + 300 + 80
    );
  });
});
