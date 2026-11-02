import { describe, expect, it } from "vitest";

import { InstagramCanvasState } from "@/client-api/types/instagram.type";
import {
  assignOptionIds,
  buildDraftState,
  describeInstagramEntryPoint,
  getInstagramFlowStatus,
  getOutputs,
  loadFlow,
  nextBlockName,
  nextOptionLabel,
  pauseParts
} from "./instagramFlow";

const legacyState = (): InstagramCanvasState => ({
  version: 1,
  defaultTriggerKey: "MENU",
  nodes: [
    {
      id: "menu",
      type: "instagramBlock",
      position: { x: 0, y: 0 },
      data: {
        name: "Menu",
        triggerType: "default",
        triggerKey: "MENU",
        blockType: "quick_replies",
        content: {
          text: "Pick one",
          quickReplies: [
            { label: "Prices", replyId: "PRICES" },
            { label: "Help", replyId: "HELP" }
          ]
        },
        actions: []
      }
    },
    {
      id: "prices",
      type: "instagramBlock",
      position: { x: 300, y: 0 },
      data: {
        name: "Prices",
        triggerType: "keyword",
        triggerKey: "PRICE",
        blockType: "send_text",
        content: { text: "Our prices" },
        actions: []
      }
    },
    {
      id: "story",
      type: "instagramBlock",
      position: { x: 300, y: 200 },
      data: {
        name: "Story",
        triggerType: "story_reply",
        triggerKey: "*",
        blockType: "send_text",
        content: { text: "Thanks!" },
        actions: []
      }
    },
    {
      id: "manual",
      type: "instagramBlock",
      position: { x: 300, y: 400 },
      data: {
        name: "Manual",
        triggerType: "manual_start",
        blockType: "follow_condition",
        content: { followsTriggerKey: "PRICE" },
        actions: []
      }
    }
  ],
  edges: [
    {
      id: "e1",
      source: "menu",
      target: "prices",
      sourceHandle: "PRICES",
      replyId: "PRICES"
    }
  ]
});

describe("loadFlow", () => {
  it("keeps an old option's wire by using its reply id as its action id", () => {
    const { nodes, edges } = loadFlow(legacyState());
    const menu = nodes.find((node) => node.id === "menu")!;
    expect(menu.data.content.quickReplies?.[0].actionId).toBe("PRICES");
    expect(edges.find((edge) => edge.source === "menu")).toMatchObject({
      sourceHandle: "PRICES",
      target: "prices"
    });
  });

  it("fixes older starts: keyword in the key, story reply '*', manual_start", () => {
    const { nodes } = loadFlow(legacyState());
    const byId = new Map(nodes.map((node) => [node.id, node]));
    expect(byId.get("menu")!.data.triggerType).toBe("default");
    expect(byId.get("prices")!.data.keywords).toEqual(["price"]);
    expect(byId.get("prices")!.data.triggerKey).toBe("PRICE");
    expect(byId.get("story")!.data.keywords).toEqual([]);
    expect(byId.get("story")!.data.triggerKey).toMatch(/^IG_/);
    expect(byId.get("manual")!.data.triggerType).toBeUndefined();
    expect(byId.get("manual")!.data.triggerKey).toMatch(/^IG_/);
  });

  it("turns a follower check's old content routes into wires", () => {
    const { nodes, edges } = loadFlow(legacyState());
    expect(edges).toContainEqual(
      expect.objectContaining({
        source: "manual",
        sourceHandle: "follows",
        target: "prices"
      })
    );
    const manual = nodes.find((node) => node.id === "manual")!;
    expect(manual.data.content.followsTriggerKey).toBeUndefined();
  });

  it("makes exactly one main menu", () => {
    const state = legacyState();
    state.defaultTriggerKey = "PRICE";
    const { nodes } = loadFlow(state);
    expect(
      nodes
        .filter((node) => node.data.triggerType === "default")
        .map((n) => n.id)
    ).toEqual(["prices"]);
  });

  it("drops wires from outputs a block doesn't have", () => {
    const state = legacyState();
    state.edges.push({
      id: "bad",
      source: "menu",
      target: "story",
      sourceHandle: "next"
    });
    const { edges } = loadFlow(state);
    expect(edges.find((edge) => edge.id === "bad")).toBeUndefined();
  });
});

describe("buildDraftState", () => {
  it("keeps the wire when a wired option is renamed", () => {
    const { nodes, edges } = loadFlow(legacyState());
    const renamed = nodes.map((node) =>
      node.id === "menu"
        ? {
            ...node,
            data: {
              ...node.data,
              content: {
                ...node.data.content,
                quickReplies: node.data.content.quickReplies!.map(
                  (reply, index) =>
                    index === 0 ? { ...reply, label: "See prices" } : reply
                )
              }
            }
          }
        : node
    );
    const draft = buildDraftState(renamed, edges);
    const menu = draft.nodes.find((node) => node.id === "menu")!;
    expect(menu.data!.actions![0]).toMatchObject({
      actionId: "PRICES",
      replyId: "PRICES",
      label: "See prices"
    });
    expect(draft.edges).toContainEqual(
      expect.objectContaining({ source: "menu", sourceHandle: "PRICES" })
    );
  });

  it("saves starts, keywords and wires the way the backend reads them", () => {
    const { nodes, edges } = loadFlow(legacyState());
    const draft = buildDraftState(nodes, edges);
    expect(draft.defaultTriggerKey).toBe("MENU");
    const byId = new Map(draft.nodes.map((node) => [node.id, node.data!]));
    expect(byId.get("menu")!.triggerType).toBe("default");
    expect(byId.get("prices")!.keywords).toEqual(["price"]);
    expect(byId.get("manual")!.triggerType).toBeUndefined();
    expect(byId.get("manual")!.keywords).toBeUndefined();
    draft.nodes.forEach((node) =>
      node.data!.actions!.forEach((action) => {
        expect(action.nextNodeId).toBeUndefined();
        expect(action.nextTriggerKey).toBeUndefined();
      })
    );
    draft.edges.forEach((edge) => {
      expect(edge.actionId).toBe(edge.sourceHandle);
      expect(edge.targetHandle).toBe("in");
    });
  });
});

describe("getOutputs", () => {
  it("gives Message, Image, Video and Add tag a Then output, and not menus", () => {
    expect(getOutputs({ blockType: "send_text", content: {} })).toEqual([
      expect.objectContaining({ id: "next", label: "Then" })
    ]);
    expect(getOutputs({ blockType: "tag_subscriber", content: {} })[0].id).toBe(
      "next"
    );
    expect(
      getOutputs({
        blockType: "quick_replies",
        content: { quickReplies: [{ actionId: "a", label: "Yes" }] }
      }).map((output) => output.id)
    ).toEqual(["a"]);
  });

  it("gives the follower check its three answers", () => {
    expect(
      getOutputs({ blockType: "follow_condition", content: {} }).map(
        (output) => output.id
      )
    ).toEqual(["follows", "not_follows", "unknown"]);
  });
});

describe("assignOptionIds", () => {
  it("gives a repeated id a new one and keeps the first", () => {
    const content = assignOptionIds("button_template", {
      buttons: [
        { label: "A", replyId: "X" },
        { label: "B", replyId: "X" },
        { label: "Site", type: "web_url", url: "https://a.com" }
      ]
    });
    const [first, second, site] = content.buttons!;
    expect(first.actionId).toBe("X");
    expect(second.actionId).not.toBe("X");
    expect(second.replyId).not.toBe("X");
    expect(site.actionId).toBeTruthy();
    expect(site.replyId).toBeUndefined();
  });
});

describe("names", () => {
  it("numbers new blocks after the first", () => {
    const nodes = [
      { data: { label: "Message" } },
      { data: { label: "Message 2" } }
    ];
    expect(nextBlockName("send_text", [])).toBe("Message");
    expect(nextBlockName("send_text", nodes)).toBe("Message 3");
  });

  it("picks an option label not used in the block", () => {
    expect(nextOptionLabel(["Option 1", "option 2"])).toBe("Option 3");
  });

  it("shows a pause in its largest whole unit", () => {
    expect(pauseParts(60)).toEqual({ value: 1, unit: "hours" });
    expect(pauseParts(2880)).toEqual({ value: 2, unit: "days" });
    expect(pauseParts(90)).toEqual({ value: 90, unit: "minutes" });
  });
});

describe("getInstagramFlowStatus", () => {
  const base = {
    automationEnabled: true,
    applied: true,
    isActive: true,
    pendingCount: 0,
    username: "shop"
  };

  it("checks in order: paused, draft, ready, pending, active", () => {
    expect(
      getInstagramFlowStatus({ ...base, automationEnabled: false }).label
    ).toBe("Paused · automation is off");
    expect(getInstagramFlowStatus({ ...base, applied: false }).label).toBe(
      "Draft"
    );
    expect(getInstagramFlowStatus({ ...base, isActive: false }).label).toBe(
      "Ready · switched off"
    );
    expect(getInstagramFlowStatus({ ...base, pendingCount: 2 }).label).toBe(
      "Active · 2 pending changes"
    );
    expect(getInstagramFlowStatus(base).label).toBe("Active on @shop");
    expect(getInstagramFlowStatus({ ...base, username: null }).label).toBe(
      "Active"
    );
  });
});

describe("describeInstagramEntryPoint", () => {
  it("says how people reach a block", () => {
    expect(
      describeInstagramEntryPoint({
        kind: "start",
        greetings: ["hi", "hello", "menu", "start"]
      })
    ).toBe("Main menu: when someone says hi, hello, menu or start");
    expect(
      describeInstagramEntryPoint({
        kind: "keyword",
        keywords: ["SALE", "OFFER"]
      })
    ).toBe('Messages containing "sale", "offer"');
    expect(
      describeInstagramEntryPoint({ kind: "story_reply", keywords: [] })
    ).toBe("Replies to your stories");
    expect(
      describeInstagramEntryPoint({
        kind: "next",
        fromNodeId: "a",
        fromBlockName: "Welcome"
      })
    ).toBe("Then, after Welcome");
    expect(
      describeInstagramEntryPoint({
        kind: "follower_check",
        fromNodeId: "a",
        fromBlockName: "Check",
        condition: "follows you"
      })
    ).toBe("Check: if the person follows you");
  });
});
