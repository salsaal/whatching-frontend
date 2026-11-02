import { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  BotAction,
  BotCanvasLiveInfo,
  BotCanvasNodeContent,
  BotDraftChanges
} from "@/client-api/types/bot.type";
import {
  addMissingWires,
  assignActionReplyIds,
  cloneBlockOptions,
  describeEntryPoint,
  getFlowStatus,
  getOptionActionType,
  getPrimaryAction,
  readOnlyNodeChanges,
  assignOptionIds,
  buildTargetByAction,
  countChars,
  countLineBreaks,
  defaultContent,
  formatDelay,
  getCarouselCards,
  getContentActions,
  getListRowCount,
  getListSections,
  getNodeOptions,
  makeListRow,
  newOptionReplyId,
  removedOutputHandles,
  removeEdgesForAction,
  removeEdgesForActions,
  slugifyTrigger
} from "./flowBuilder";

const edge = (
  id: string,
  source: string,
  sourceHandle: string,
  target: string
): Edge => ({ id, source, sourceHandle, target, targetHandle: "in" });

const quickReply = (actionId: string, replyId: string, label = "Go") => ({
  type: "quick_reply",
  actionId,
  id: replyId,
  replyId,
  label
});

// Three cards whose buttons each lead somewhere different.
const threeCardCarousel = (): BotCanvasNodeContent => ({
  cards: [
    { title: "Plans", buttons: [quickReply("a1", "r1", "See plans")] },
    { title: "Pricing", buttons: [quickReply("a2", "r2", "See prices")] },
    { title: "Support", buttons: [quickReply("a3", "r3", "Get help")] }
  ]
});

const fourRowList = (): BotCanvasNodeContent => ({
  sections: [
    {
      title: "Menu",
      rows: [
        { actionId: "row1", id: "R1", replyId: "R1", title: "One" },
        { actionId: "row2", id: "R2", replyId: "R2", title: "Two" },
        { actionId: "row3", id: "R3", replyId: "R3", title: "Three" },
        { actionId: "row4", id: "R4", replyId: "R4", title: "Four" }
      ]
    }
  ]
});

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
    expect(defaultContent("text")).toEqual({
      text: "Write your message here."
    });
    expect(defaultContent("image")).toEqual({
      mediaType: "image",
      mediaId: ""
    });
  });

  it("starts a location empty instead of at 0,0", () => {
    const content = defaultContent("location");
    expect(content.latitude).toBeUndefined();
    expect(content.longitude).toBeUndefined();
  });

  it("gives a new carousel's buttons their own IDs", () => {
    const cards = defaultContent("generic_carousel").cards as Array<{
      buttons: Array<{ actionId: string; replyId: string }>;
    }>;
    const [first, second] = cards.map((card) => card.buttons[0]);
    expect(first.actionId).not.toBe(second.actionId);
    expect(first.replyId).not.toBe(second.replyId);
  });

  it("getCarouselCards passes through real cards and falls back to the 2-card default otherwise", () => {
    expect(getCarouselCards({ cards: [{ title: "A" }] })).toEqual([
      { title: "A" }
    ]);
    expect(getCarouselCards({})).toHaveLength(2);
    expect(getCarouselCards({})).toBe(getCarouselCards({}));
  });
});

describe("newOptionReplyId", () => {
  it("is random, not derived from a label, and avoids IDs already used", () => {
    const replyId = newOptionReplyId();
    expect(replyId).toMatch(/^opt_[a-z0-9]{6}$/);
    const used = Array.from({ length: 50 }, () => newOptionReplyId());
    const next = newOptionReplyId(used);
    expect(used).not.toContain(next);
  });

  it("re-adding an option after a delete gets a fresh reply ID", () => {
    const first = makeListRow("Option 1");
    const second = makeListRow("Option 2", [String(first.replyId)]);
    // The old scheme gave the re-added row "OPTION_2" again.
    const readded = makeListRow("Option 2", [String(second.replyId)]);
    expect(readded.replyId).not.toBe(second.replyId);
    expect(readded.actionId).not.toBe(second.actionId);
  });
});

describe("assignOptionIds", () => {
  it("keeps the actionId and replyId an option already has", () => {
    const content = fourRowList();
    expect(assignOptionIds("list", content)).toEqual(content);
  });

  it("takes a missing actionId from the saved action with the same reply ID", () => {
    // Older flows stored positional IDs only on the block's actions.
    const content = {
      sections: [
        { title: "Menu", rows: [{ id: "R1", title: "One" }, { id: "R2" }] }
      ]
    };
    const saved: BotAction[] = [
      { actionId: "content_action_2", type: "go_to_trigger", replyId: "R2" },
      { actionId: "content_action_1", type: "go_to_trigger", replyId: "R1" }
    ];
    const rows = (
      assignOptionIds("list", content, saved).sections as Array<{
        rows: Array<Record<string, unknown>>;
      }>
    )[0].rows;
    expect(rows.map((row) => row.actionId)).toEqual([
      "content_action_1",
      "content_action_2"
    ]);
    expect(rows.map((row) => row.replyId)).toEqual(["R1", "R2"]);
  });

  it("generates IDs only for options that have none", () => {
    const content = {
      cards: [{ buttons: [quickReply("a1", "r1"), { label: "New" }] }]
    };
    const buttons = (
      assignOptionIds("generic_carousel", content).cards as Array<{
        buttons: Array<Record<string, unknown>>;
      }>
    )[0].buttons;
    expect(buttons[0]).toMatchObject({ actionId: "a1", replyId: "r1" });
    expect(buttons[1].actionId).toEqual(expect.any(String));
    expect(buttons[1].replyId).toMatch(/^opt_/);
    expect(buttons[1].id).toBe(buttons[1].replyId);
  });

  it("is stable: running it again changes nothing", () => {
    const once = assignOptionIds("generic_carousel", {
      cards: [{ buttons: [{ label: "A" }] }, { buttons: [{ label: "B" }] }]
    });
    expect(assignOptionIds("generic_carousel", once)).toEqual(once);
  });

  it("gives only the later copy of a repeated reply ID a new one", () => {
    const content = {
      sections: [
        {
          title: "Menu",
          rows: [
            { actionId: "x", id: "SAME", replyId: "SAME", title: "One" },
            { actionId: "y", id: "SAME", replyId: "SAME", title: "Two" }
          ]
        }
      ]
    };
    const rows = (
      assignOptionIds("list", content).sections as Array<{
        rows: Array<Record<string, unknown>>;
      }>
    )[0].rows;
    expect(rows[0].replyId).toBe("SAME");
    expect(rows[1].replyId).not.toBe("SAME");
    expect(rows[1].actionId).toBe("y");
  });

  it("gives website buttons an actionId but no reply ID", () => {
    const content = {
      cards: [
        { buttons: [{ type: "url", url: "https://a.example", label: "Open" }] }
      ]
    };
    const button = (
      assignOptionIds("generic_carousel", content).cards as Array<{
        buttons: Array<Record<string, unknown>>;
      }>
    )[0].buttons[0];
    expect(button.actionId).toEqual(expect.any(String));
    expect(button.replyId).toBeUndefined();
  });
});

describe("assignActionReplyIds", () => {
  it("fixes a repeated reply-button ID and leaves the rest alone", () => {
    const actions: BotAction[] = [
      { actionId: "a", type: "go_to_trigger", replyId: "OPTION_2" },
      { actionId: "b", type: "go_to_trigger", replyId: "OPTION_2" },
      { actionId: "c", type: "go_to_trigger", replyId: "OPTION_3" }
    ];
    const result = assignActionReplyIds(actions);
    expect(result[0].replyId).toBe("OPTION_2");
    expect(result[1].replyId).toMatch(/^opt_/);
    expect(result[2].replyId).toBe("OPTION_3");
  });
});

describe("getContentActions", () => {
  it("reads each option's stored actionId instead of its position", () => {
    const content = threeCardCarousel();
    expect(
      getContentActions("generic_carousel", content).map(
        (action) => action.actionId
      )
    ).toEqual(["a1", "a2", "a3"]);

    // Delete card 2: card 3 keeps its own ID (it used to become
    // content_action_2 and inherit card 2's wire).
    const cards = content.cards as Array<Record<string, unknown>>;
    const withoutCard2 = { cards: [cards[0], cards[2]] };
    expect(
      getContentActions("generic_carousel", withoutCard2).map((action) => [
        action.actionId,
        action.replyId
      ])
    ).toEqual([
      ["a1", "r1"],
      ["a3", "r3"]
    ]);
  });

  it("keeps list row IDs when an earlier row is deleted", () => {
    const content = fourRowList();
    const section = (content.sections as Array<{ rows: unknown[] }>)[0];
    const withoutFirst = {
      sections: [{ ...section, rows: section.rows.slice(1) }]
    };
    expect(
      getContentActions("list", withoutFirst).map((action) => action.actionId)
    ).toEqual(["row2", "row3", "row4"]);
  });
});

describe("wire removal", () => {
  it("deleting a carousel card removes only that card's wires", () => {
    const content = threeCardCarousel();
    const before = getContentActions("generic_carousel", content);
    const cards = content.cards as Array<Record<string, unknown>>;
    const after = getContentActions("generic_carousel", {
      cards: [cards[0], cards[2]]
    });
    const edges = [
      edge("e1", "carousel", "a1", "plans"),
      edge("e2", "carousel", "a2", "prices"),
      edge("e3", "carousel", "a3", "help")
    ];

    const removed = removedOutputHandles(before, after);
    expect(removed).toEqual(["a2"]);
    const remaining = removeEdgesForActions(edges, "carousel", removed);
    expect(remaining.map((item) => [item.sourceHandle, item.target])).toEqual([
      ["a1", "plans"],
      ["a3", "help"]
    ]);
  });

  it("deleting the first of 4 list rows keeps the other 3 wires and another list's wires", () => {
    const content = fourRowList();
    const section = (content.sections as Array<{ rows: unknown[] }>)[0];
    const before = getContentActions("list", content);
    const after = getContentActions("list", {
      sections: [{ ...section, rows: section.rows.slice(1) }]
    });
    const edges = [
      edge("e1", "menu", "row1", "one"),
      edge("e2", "menu", "row2", "two"),
      edge("e3", "menu", "row3", "three"),
      edge("e4", "menu", "row4", "four"),
      // A second list whose options happen to share the handle IDs.
      edge("e5", "other_menu", "row1", "elsewhere"),
      edge("e6", "other_menu", "row2", "elsewhere")
    ];

    const remaining = removeEdgesForActions(
      edges,
      "menu",
      removedOutputHandles(before, after)
    );
    expect(remaining.map((item) => item.id)).toEqual([
      "e2",
      "e3",
      "e4",
      "e5",
      "e6"
    ]);
  });

  it("removeEdgesForAction only touches the given block", () => {
    const edges = [
      edge("e1", "block_a", "opt_1", "x"),
      edge("e2", "block_b", "opt_1", "y")
    ];
    expect(
      removeEdgesForAction(edges, "block_a", "opt_1").map((item) => item.id)
    ).toEqual(["e2"]);
  });

  it("an option that stops going to a block loses its handle", () => {
    const before: BotAction[] = [
      { actionId: "a", type: "go_to_trigger", replyId: "A" },
      { actionId: "b", type: "go_to_trigger", replyId: "B" }
    ];
    const after: BotAction[] = [
      { actionId: "a", type: "escalate_to_agent", replyId: "A" },
      { actionId: "b", type: "go_to_trigger", replyId: "B" }
    ];
    expect(removedOutputHandles(before, after)).toEqual(["a"]);
  });
});

describe("addMissingWires", () => {
  const block = (
    id: string,
    triggerKey: string,
    actions: BotAction[] = [],
    blockType: "buttons" | "list" | "text" = "buttons",
    content: BotCanvasNodeContent = {}
  ) => ({ id, data: { triggerKey, blockType, content, actions } });

  it("wires an option that has a saved target but no wire", () => {
    const nodes = [
      block("menu", "MENU", [
        {
          actionId: "a1",
          type: "go_to_trigger",
          replyId: "R1",
          nextTriggerKey: "PRICING"
        }
      ]),
      block("pricing", "PRICING", [], "text")
    ];
    const wires = addMissingWires(nodes, []);
    expect(wires).toEqual([
      expect.objectContaining({
        source: "menu",
        sourceHandle: "a1",
        target: "pricing",
        targetHandle: "in"
      })
    ]);
    // Same flow, same wire: reloading doesn't look like a change.
    expect(addMissingWires(nodes, [])).toEqual(wires);
  });

  it("leaves wired options, missing targets and non-routing options alone", () => {
    const nodes = [
      block("menu", "MENU", [
        {
          actionId: "wired",
          type: "go_to_trigger",
          nextTriggerKey: "PRICING"
        },
        { actionId: "gone", type: "go_to_trigger", nextTriggerKey: "DELETED" },
        {
          actionId: "team",
          type: "escalate_to_agent",
          nextTriggerKey: "PRICING"
        }
      ]),
      block("pricing", "PRICING", [], "text")
    ];
    const existing = [edge("e1", "menu", "wired", "pricing")];
    expect(addMissingWires(nodes, existing)).toBe(existing);
  });

  it("skips actions with no handle on the block", () => {
    // A leftover list action whose row was deleted has no handle to wire.
    const nodes = [
      block(
        "menu",
        "MENU",
        [
          { actionId: "row1", type: "go_to_trigger", nextTriggerKey: "A" },
          { actionId: "orphan", type: "go_to_trigger", nextTriggerKey: "A" }
        ],
        "list",
        {
          sections: [
            {
              title: "Menu",
              rows: [{ actionId: "row1", replyId: "R1", title: "One" }]
            }
          ]
        }
      ),
      block("a", "A", [], "text")
    ];
    expect(addMissingWires(nodes, []).map((item) => item.sourceHandle)).toEqual(
      ["row1"]
    );
  });
});

describe("buildTargetByAction", () => {
  it("keys targets by source block and handle, so equal handle IDs don't collide", () => {
    const nodes = [
      { id: "a", data: { triggerKey: "A" } },
      { id: "b", data: { triggerKey: "B" } },
      { id: "x", data: { triggerKey: "X" } },
      { id: "y", data: { triggerKey: "Y" } }
    ];
    const targets = buildTargetByAction(
      [edge("e1", "a", "opt_1", "x"), edge("e2", "b", "opt_1", "y")],
      nodes
    );
    expect(targets.get("a:opt_1")).toBe("X");
    expect(targets.get("b:opt_1")).toBe("Y");
  });
});

describe("getNodeOptions", () => {
  it("lists each list row once, with its section", () => {
    const options = getNodeOptions(
      "list",
      {
        sections: [
          {
            title: "Sales",
            rows: [{ actionId: "r1", replyId: "R1", title: "Pricing" }]
          },
          {
            title: "Help",
            rows: [{ actionId: "r2", replyId: "R2", title: "Support" }]
          }
        ]
      },
      []
    );
    expect(
      options.map((option) => [option.actionId, option.group, option.label])
    ).toEqual([
      ["r1", "Sales", "Pricing"],
      ["r2", "Help", "Support"]
    ]);
  });

  it("names carousel options by card, falling back to the card number", () => {
    const options = getNodeOptions(
      "generic_carousel",
      {
        cards: [
          { title: "Plans", buttons: [quickReply("a1", "r1", "See")] },
          { title: "", buttons: [quickReply("a2", "r2", "More")] }
        ]
      },
      []
    );
    expect(options.map((option) => option.group)).toEqual(["Plans", "Card 2"]);
  });
});

describe("counting and formatting", () => {
  it("counts characters as people see them", () => {
    expect(countChars("hi 👋🏽")).toBe(4);
    expect(countChars(undefined)).toBe(0);
  });

  it("counts line breaks", () => {
    expect(countLineBreaks("a\nb\nc\nd")).toBe(3);
  });

  it("formats follow-up delays", () => {
    expect(formatDelay(45)).toBe("45 min");
    expect(formatDelay(60)).toBe("1 h");
    expect(formatDelay(90)).toBe("1 h 30 min");
  });
});

describe("option actions", () => {
  it("reads what a tap does from list rows and carousel buttons", () => {
    expect(getOptionActionType("list", { type: "escalate_to_agent" })).toBe(
      "escalate_to_agent"
    );
    expect(getOptionActionType("list", {})).toBe("go_to_trigger");
    // A list row can't open a website.
    expect(getOptionActionType("list", { type: "open_url" })).toBe(
      "go_to_trigger"
    );
    expect(
      getOptionActionType("generic_carousel", {
        type: "quick_reply",
        actionType: "end_conversation"
      })
    ).toBe("end_conversation");
    expect(
      getOptionActionType("generic_carousel", { type: "url", url: "https://a" })
    ).toBe("open_url");
  });

  it("carries a row's type into its action, so it has no handle", () => {
    const content = {
      sections: [
        {
          title: "Menu",
          rows: [
            {
              actionId: "r1",
              replyId: "R1",
              title: "Team",
              type: "escalate_to_agent"
            }
          ]
        }
      ]
    };
    expect(getContentActions("list", content)[0].type).toBe(
      "escalate_to_agent"
    );
    expect(getNodeOptions("list", content, [])[0].type).toBe(
      "escalate_to_agent"
    );
  });
});

describe("cloneBlockOptions", () => {
  it("gives a duplicated carousel new IDs and keeps the rest", () => {
    const content = threeCardCarousel();
    const copy = cloneBlockOptions("generic_carousel", content, []);
    const before = getContentActions("generic_carousel", content);
    const after = copy.actions;
    expect(after).toHaveLength(3);
    after.forEach((action, index) => {
      expect(action.actionId).not.toBe(before[index].actionId);
      expect(action.replyId).not.toBe(before[index].replyId);
      expect(action.label).toBe(before[index].label);
      expect(action.nextTriggerKey).toBeUndefined();
    });
    // The original is untouched.
    expect(getContentActions("generic_carousel", content)).toEqual(before);
  });

  it("gives duplicated reply buttons new IDs and no wiring", () => {
    const actions: BotAction[] = [
      {
        actionId: "a",
        type: "go_to_trigger",
        replyId: "R",
        label: "Go",
        nextTriggerKey: "NEXT"
      },
      { actionId: "t", type: "escalate_to_agent", replyId: "T", label: "Team" }
    ];
    const copy = cloneBlockOptions(
      "buttons",
      { bodyText: "Pick", buttons: [{ id: "R" }] },
      actions
    );
    expect(copy.content.buttons).toBeUndefined();
    expect(copy.actions.map((action) => action.type)).toEqual([
      "go_to_trigger",
      "escalate_to_agent"
    ]);
    copy.actions.forEach((action, index) => {
      expect(action.actionId).not.toBe(actions[index].actionId);
      expect(action.replyId).not.toBe(actions[index].replyId);
      expect(action.nextTriggerKey).toBeUndefined();
    });
  });
});

describe("getFlowStatus", () => {
  const live = (
    overrides: Partial<BotCanvasLiveInfo> = {}
  ): BotCanvasLiveInfo => ({
    hasLiveVersion: true,
    isOrgDefault: false,
    botEnabled: true,
    phoneNumbers: [
      { _id: "n1", displayPhoneNumber: "+91 98765 43210", source: "assigned" }
    ],
    ...overrides
  });
  const changes = (
    overrides: Partial<BotDraftChanges> = {}
  ): BotDraftChanges => ({
    neverPublished: false,
    hasUnpublishedChanges: false,
    changedBlockCount: 0,
    addedBlockIds: [],
    removedBlockIds: [],
    changedBlockIds: [],
    startChanged: false,
    ...overrides
  });

  it("follows the rules in order, first match wins", () => {
    expect(getFlowStatus(live({ botEnabled: false }), changes()).label).toBe(
      "Bot is off"
    );
    expect(getFlowStatus(live(), changes({ neverPublished: true })).label).toBe(
      "Not live yet"
    );
    expect(getFlowStatus(live({ phoneNumbers: [] }), changes())).toMatchObject({
      tone: "amber",
      label: "Live, but no number uses it"
    });
    expect(
      getFlowStatus(
        live(),
        changes({ hasUnpublishedChanges: true, changedBlockCount: 3 })
      )
    ).toMatchObject({ tone: "amber", label: "Live · 3 changes not live yet" });
    expect(getFlowStatus(live(), changes())).toMatchObject({
      tone: "green",
      label: "Live on +91 98765 43210"
    });
  });

  it("counts numbers when there are several", () => {
    const status = getFlowStatus(
      live({
        phoneNumbers: [
          { _id: "a", displayPhoneNumber: "+91 1", source: "assigned" },
          { _id: "b", displayPhoneNumber: "+91 2", source: "org_default" }
        ]
      }),
      changes()
    );
    expect(status.label).toBe("Live on 2 numbers");
    expect(status.numbers).toEqual(["+91 1", "+91 2"]);
  });
});

describe("getPrimaryAction", () => {
  const changes = (
    overrides: Partial<BotDraftChanges> = {}
  ): BotDraftChanges => ({
    neverPublished: false,
    hasUnpublishedChanges: false,
    changedBlockCount: 0,
    addedBlockIds: [],
    removedBlockIds: [],
    changedBlockIds: [],
    startChanged: false,
    ...overrides
  });

  it("names the button for the flow's state", () => {
    expect(
      getPrimaryAction(changes({ neverPublished: true }), false, false)
    ).toEqual({ label: "Go live", disabled: false });
    expect(
      getPrimaryAction(changes({ hasUnpublishedChanges: true }), true, false)
    ).toEqual({ label: "Update live flow", disabled: false });
    expect(getPrimaryAction(changes(), true, false)).toEqual({
      label: "Up to date",
      disabled: true
    });
  });

  it("treats unsaved edits as changes", () => {
    expect(getPrimaryAction(changes(), true, true).label).toBe(
      "Update live flow"
    );
  });
});

describe("describeEntryPoint", () => {
  it("words each way in for the Reached from list", () => {
    expect(describeEntryPoint({ kind: "start" })).toBe("Start of the flow");
    expect(describeEntryPoint({ kind: "ai" })).toBe(
      "AI replies can send customers here"
    );
    expect(
      describeEntryPoint({
        kind: "option",
        fromNodeId: "m",
        fromBlockName: "Main menu",
        label: "Pricing"
      })
    ).toBe("Main menu › Pricing");
    expect(
      describeEntryPoint({
        kind: "follow_up",
        fromNodeId: "w",
        fromBlockName: "Welcome",
        delayMinutes: 60
      })
    ).toBe("Follow-up of Welcome after 1 h");
    expect(
      describeEntryPoint({
        kind: "template",
        templateName: "setup_call",
        label: "I'll be there"
      })
    ).toBe("Template setup_call › I'll be there");
    expect(
      describeEntryPoint({
        kind: "broadcast",
        broadcastName: "Diwali",
        label: "See prices"
      })
    ).toBe("Broadcast Diwali › See prices");
  });
});

describe("readOnlyNodeChanges", () => {
  it("lets measuring and selecting through, so the live view renders", () => {
    const changes = readOnlyNodeChanges([
      {
        id: "a",
        type: "dimensions",
        dimensions: { width: 300, height: 200 }
      },
      { id: "a", type: "select", selected: true },
      { id: "a", type: "position", position: { x: 10, y: 10 } },
      { id: "a", type: "remove" }
    ]);
    expect(changes.map((change) => change.type)).toEqual([
      "dimensions",
      "select"
    ]);
  });
});
