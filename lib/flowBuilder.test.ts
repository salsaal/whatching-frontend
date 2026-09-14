import { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { BotAction } from "@/client-api/types/bot.type";
import {
  BuilderNode,
  BuilderNodeData,
  defaultContent,
  getCarouselCards,
  getListRowCount,
  getListSections,
  localValidate,
  slugifyTrigger
} from "./flowBuilder";

const action = (overrides: Partial<BotAction> = {}): BotAction => ({
  actionId: "action_1",
  type: "go_to_trigger",
  label: "Option 1",
  replyId: "OPTION_1",
  ...overrides
});

const buildNode = (
  id: string,
  overrides: Partial<BuilderNodeData> = {}
): BuilderNode => ({
  id,
  type: "botBlock",
  position: { x: 0, y: 0 },
  data: {
    label: "Block",
    triggerKey: id,
    blockType: "text",
    actions: [],
    content: { text: "Hello there" },
    locked: false,
    metadata: {},
    ...overrides
  }
});

// The three system nodes every canvas requires -- most tests start from this
// base set and layer their own node(s)/edges on top.
const requiredNodes = (): BuilderNode[] => [
  buildNode("node_default", {
    label: "Main Menu",
    triggerKey: "DEFAULT",
    blockType: "buttons",
    content: { bodyText: "Welcome" },
    actions: [action({ actionId: "a1", replyId: "GO_NEXT" })],
    locked: true
  }),
  buildNode("node_opt_in", {
    label: "Opt In",
    triggerKey: "OPT_IN",
    locked: true
  }),
  buildNode("node_opt_out", {
    label: "Opt Out",
    triggerKey: "OPT_OUT",
    locked: true
  })
];

describe("slugifyTrigger", () => {
  it("uppercases and underscore-joins, falling back when nothing alphanumeric remains", () => {
    expect(slugifyTrigger("Talk to team")).toBe("TALK_TO_TEAM");
    expect(slugifyTrigger("  ***  ")).toBe("FLOW_NODE");
  });
});

describe("getListSections / getListRowCount", () => {
  it("falls back to a single default section+row when none are provided", () => {
    const sections = getListSections({});
    expect(sections).toHaveLength(1);
    expect(getListRowCount(sections)).toBe(1);
  });

  it("normalizes row ids from title when no explicit id is set", () => {
    const sections = getListSections({
      sections: [{ title: "Menu", rows: [{ title: "Talk to team" }] }]
    });
    expect(sections[0].rows?.[0].id).toBe("TALK_TO_TEAM");
  });
});

describe("defaultContent / getCarouselCards", () => {
  it("returns block-specific starter content", () => {
    expect(defaultContent("text")).toEqual({ text: "Write your message here." });
    expect(defaultContent("image")).toEqual({ mediaType: "image", mediaId: "" });
  });

  it("getCarouselCards passes through real cards and falls back to the 2-card default otherwise", () => {
    expect(getCarouselCards({ cards: [{ title: "A" }] })).toEqual([{ title: "A" }]);
    expect(getCarouselCards({})).toHaveLength(2);
  });
});

describe("localValidate: required system nodes", () => {
  it("flags a canvas missing the DEFAULT/OPT_IN/OPT_OUT trigger keys", () => {
    const { invalidIds, messages } = localValidate(
      [buildNode("n1", { triggerKey: "SOMETHING_ELSE" })],
      []
    );
    expect(messages).toContain("Main Menu must keep trigger key DEFAULT.");
    expect(messages).toContain("Opt-out block must keep trigger key OPT_OUT.");
    expect(messages).toContain("Opt-in block must keep trigger key OPT_IN.");
    expect(invalidIds.size).toBeGreaterThan(0);
  });

  it("passes a minimal valid canvas with no unresolved messages", () => {
    const nodes = requiredNodes();
    const edges: Edge[] = [
      {
        id: "e1",
        source: "node_default",
        target: "node_opt_out",
        sourceHandle: "a1",
        targetHandle: "in"
      }
    ];
    const { invalidIds, messages } = localValidate(nodes, edges);
    expect(invalidIds.size).toBe(0);
    expect(messages).toEqual([]);
  });
});

describe("localValidate: per-block content requirements", () => {
  it("flags an empty text block message", () => {
    const nodes = [...requiredNodes(), buildNode("n1", { content: { text: "" } })];
    const { invalidIds, messages } = localValidate(nodes, []);
    expect(invalidIds.has("n1")).toBe(true);
    expect(messages).toContain("Block: message text is required.");
  });

  it("flags a duplicated trigger key across two nodes", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", { triggerKey: "DUPE" }),
      buildNode("n2", { triggerKey: "DUPE" })
    ];
    const { messages } = localValidate(nodes, []);
    expect(messages.some((message) => message.includes("is duplicated"))).toBe(true);
  });

  it("flags a buttons block with more than 3 reply actions", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", {
        blockType: "buttons",
        content: { bodyText: "Pick one" },
        actions: [action({ actionId: "a" }), action({ actionId: "b" }), action({ actionId: "c" }), action({ actionId: "d" })]
      })
    ];
    const { messages } = localValidate(nodes, []);
    expect(
      messages.some((message) => message.includes("at most 3 buttons"))
    ).toBe(true);
  });

  it("flags a list block with a duplicated row id", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", {
        blockType: "list",
        content: {
          bodyText: "Choose",
          buttonText: "Open",
          sections: [
            {
              title: "Menu",
              rows: [
                { id: "SAME", title: "One" },
                { id: "SAME", title: "Two" }
              ]
            }
          ]
        }
      })
    ];
    const { messages } = localValidate(nodes, []);
    expect(messages.some((message) => message.includes("is duplicated"))).toBe(true);
  });

  it("flags a generic_carousel with fewer than 2 cards and mismatched button shapes", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", {
        blockType: "generic_carousel",
        content: {
          cards: [
            {
              bodyText: "Only card",
              mediaType: "image",
              mediaId: "media_1",
              buttons: [{ type: "quick_reply", label: "Go" }]
            }
          ]
        }
      })
    ];
    const { messages } = localValidate(nodes, []);
    expect(messages.some((message) => message.includes("2-10 cards"))).toBe(true);
  });

  it("flags an open_url action with an invalid URL", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", {
        blockType: "buttons",
        content: { bodyText: "Visit us" },
        actions: [action({ type: "open_url", url: "not-a-url" })]
      })
    ];
    const { messages } = localValidate(nodes, []);
    expect(
      messages.some((message) => message.includes("needs a valid http(s) URL"))
    ).toBe(true);
  });
});

describe("localValidate: routing connectivity", () => {
  it("flags a go_to_trigger action with no matching edge", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("n1", {
        blockType: "buttons",
        content: { bodyText: "Pick" },
        actions: [action({ actionId: "unrouted", replyId: "UNROUTED" })]
      })
    ];
    const { messages } = localValidate(nodes, []);
    expect(messages.some((message) => message.includes("is not connected"))).toBe(true);
  });

  it("does not require OPT_IN/OPT_OUT routes to be connected", () => {
    const nodes = requiredNodes();
    // Strip the DEFAULT node's own action first -- otherwise its unrelated
    // unrouted action (also present with no edges) would trip the same
    // message and this test wouldn't isolate the OPT_OUT exemption at all.
    nodes[0].data.actions = [];
    nodes[2].data.actions = [action({ actionId: "unrouted", replyId: "UNROUTED" })];
    const { messages } = localValidate(nodes, []);
    expect(messages.some((message) => message.includes("is not connected"))).toBe(false);
  });
});

describe("localValidate: orphan detection", () => {
  it("warns (without invalidating) about a node unreachable from DEFAULT", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("orphan", { label: "Orphan Block", triggerKey: "ORPHAN" })
    ];
    const { invalidIds, messages } = localValidate(nodes, []);
    expect(invalidIds.has("orphan")).toBe(false);
    expect(
      messages.some((message) => message.includes("Orphan Block: unreachable"))
    ).toBe(true);
  });

  it("treats a node reachable only via an enabled automatic follow-up as reachable", () => {
    const nodes = [
      ...requiredNodes(),
      buildNode("source", {
        label: "Source",
        triggerKey: "SOURCE",
        followUp: {
          enabled: true,
          delayMinutes: 30,
          targetTriggerKey: "FOLLOW_UP_TARGET"
        }
      }),
      buildNode("target", { label: "Follow Up Target", triggerKey: "FOLLOW_UP_TARGET" })
    ];
    // SOURCE itself must be reachable via a normal edge for this to prove
    // anything about the follow-up hop specifically.
    const edges: Edge[] = [
      {
        id: "e1",
        source: "node_default",
        target: "source",
        sourceHandle: "a1",
        targetHandle: "in"
      }
    ];
    const { messages } = localValidate(nodes, edges);
    expect(
      messages.some((message) => message.includes("Follow Up Target: unreachable"))
    ).toBe(false);
  });
});
