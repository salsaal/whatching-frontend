import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Drip, DripReport } from "@/client-api/types/drips.type";
import type { MessageTemplate } from "@/client-api/types/templates.type";

// Radix measures itself; jsdom has neither of these.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const createDrip = vi.fn();
const updateDrip = vi.fn();
const startDrip = vi.fn();
const previewDripAudience = vi.fn();
const listDripContacts = vi.fn();
const listContactDrips = vi.fn();
const removeDripContact = vi.fn();
const updateSubscriber = vi.fn();

vi.mock("@/client-api/functions/drips", () => ({
  createDrip: (payload: unknown) => createDrip(payload),
  updateDrip: (args: unknown) => updateDrip(args),
  startDrip: (args: unknown) => startDrip(args),
  addDripContacts: vi.fn(),
  previewDripAudience: (args: unknown) => previewDripAudience(args),
  listDripContacts: (id: string, params: unknown) =>
    listDripContacts(id, params),
  listContactDrips: (id: string) => listContactDrips(id),
  removeDripContact: (args: unknown) => removeDripContact(args)
}));
vi.mock("@/client-api/functions/subscribers", () => ({
  getSubscriberById: vi.fn(),
  getAllSubscribers: vi.fn(),
  getTags: () =>
    Promise.resolve({
      status: "success",
      data: { tags: [{ name: "Lead" }, { name: "Purchased" }] }
    }),
  updateSubscriber: (args: unknown) => updateSubscriber(args)
}));

const template = (
  overrides: Partial<MessageTemplate> & Pick<MessageTemplate, "templateId">
): MessageTemplate => ({
  _id: overrides.templateId,
  orgId: "org-1",
  name: "template",
  language: "en_US",
  category: "MARKETING",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Hello" }],
  wabaId: "waba-1",
  createdAt: "",
  updatedAt: "",
  ...overrides
});

const TEMPLATES = [
  template({
    templateId: "meta-1",
    name: "welcome_offer",
    components: [{ type: "BODY", text: "Hi {{1}}, 10% off today." }]
  }),
  template({
    templateId: "meta-2",
    name: "order_tips",
    category: "UTILITY"
  }),
  template({
    templateId: "meta-3",
    name: "header_variable",
    components: [
      { type: "HEADER", format: "TEXT", text: "Hi {{1}}" },
      { type: "BODY", text: "Hello" }
    ]
  })
];

vi.mock("@/client-api/functions/templates", () => ({
  getAllTemplates: () =>
    Promise.resolve({
      status: "success",
      results: TEMPLATES.length,
      data: { templates: TEMPLATES }
    })
}));

const NUMBER = {
  _id: "n1",
  id: "n1",
  orgId: "org-1",
  wabaId: "waba-1",
  phoneNumberId: "pn-1",
  displayPhoneNumber: "+91 98765 43210",
  status: "active",
  connectionStatus: "ready",
  isDefault: true
};

vi.mock("@/components/whatsapp/WhatsAppNumberSwitcher", () => ({
  isUsableWhatsAppNumber: () => true,
  useWhatsAppNumberContext: () => ({
    numbers: [NUMBER],
    effectiveNumber: NUMBER
  })
}));
vi.mock("@/hooks/useCurrentMembership", () => ({
  useCurrentMembership: () => ({ can: () => true, isLoading: false })
}));
vi.mock("@/stores/organizationStore", () => ({
  useOrganizationStore: (
    selector: (state: {
      activeOrganization: { _id: string; timezone: string };
    }) => unknown
  ) =>
    selector({ activeOrganization: { _id: "org-1", timezone: "Asia/Kolkata" } })
}));

const { DripBuilder } = await import("@/components/drips/DripBuilder");
const { DripResults } = await import("@/components/drips/DripResults");
const { DripAudienceDialog, previewLines } = await import(
  "@/components/drips/DripAudienceDialog"
);
const { DripPeople } = await import("@/components/drips/DripPeople");
const { ContactDrips } = await import("@/components/drips/ContactDrips");
const { OffersStoppedControl } = await import(
  "@/components/subscribers/OffersStoppedControl"
);

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
};

const savedDrip = (overrides: Partial<Drip> = {}): Drip => ({
  id: "drip-1",
  name: "Welcome series",
  status: "draft",
  pausedBy: null,
  pausedReason: null,
  pausedReasonText: null,
  phoneNumberId: "pn-1",
  steps: [],
  sendWindow: { startHour: 10, endHour: 20, timezone: "Asia/Kolkata" },
  trigger: { type: "manual", tag: null },
  stopTags: [],
  onReply: "stop",
  stopOnReply: true,
  activatedAt: null,
  createdAt: "",
  updatedAt: "",
  contacts: { active: 0, completed: 0, stopped: 0, total: 0 },
  ...overrides
});

const chooseTemplate = async (button: HTMLElement, name: string) => {
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("option", { name: new RegExp(name) })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
};

afterEach(cleanup);
beforeEach(() => {
  createDrip.mockReset();
  updateDrip.mockReset();
  startDrip.mockReset();
  previewDripAudience.mockReset();
  listDripContacts.mockReset();
  listContactDrips.mockReset();
  removeDripContact.mockReset();
  updateSubscriber.mockReset();
});

describe("DripBuilder", () => {
  it("starts with two messages on a timeline and says what's missing", async () => {
    wrap(<DripBuilder onSaved={vi.fn()} />);

    expect(screen.getByText("Someone joins the drip")).toBeTruthy();
    expect(screen.getByText("Message 1")).toBeTruthy();
    expect(screen.getByText("Message 2")).toBeTruthy();
    expect(screen.getByText("after the previous message")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next: choose who/ }));
    expect(screen.getByText("Give the drip a name.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Welcome series" }
    });
    expect(screen.getByText("Message 1: Choose a template.")).toBeTruthy();
    expect(createDrip).not.toHaveBeenCalled();
  });

  it("creates the drip with each wait in minutes", async () => {
    const onSaved = vi.fn();
    createDrip.mockResolvedValue(savedDrip());
    wrap(<DripBuilder onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Welcome series" }
    });
    const [first, second] = screen.getAllByRole("button", {
      name: /Choose a template/
    });
    await chooseTemplate(first, "welcome_offer");
    await chooseTemplate(second, "order_tips");
    fireEvent.change(screen.getByLabelText("How long to wait"), {
      target: { value: "2" }
    });

    // An offer without a Stop promotions button, and the once-a-day rule.
    expect(
      screen.getByText(/This offer has no Stop promotions button/)
    ).toBeTruthy();
    expect(
      screen.getByText(/A contact gets at most one offer a day/)
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Next: choose who/ }));
    await waitFor(() => expect(createDrip).toHaveBeenCalledTimes(1));
    expect(createDrip.mock.calls[0][0]).toEqual({
      name: "Welcome series",
      phoneNumberId: "pn-1",
      steps: [
        {
          templateId: "meta-1",
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  value: {
                    source: "subscriber_field",
                    path: "firstName",
                    fallback: "there"
                  }
                }
              ]
            }
          ],
          delayMinutes: 0
        },
        { templateId: "meta-2", components: [], delayMinutes: 2880 }
      ],
      sendWindow: { startHour: 10, endHour: 20, timezone: "Asia/Kolkata" },
      trigger: { type: "manual" },
      stopTags: [],
      onReply: "stop"
    });
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(savedDrip(), "next")
    );
  });

  it("sends a text header's value like a broadcast does", async () => {
    createDrip.mockResolvedValue(savedDrip());
    wrap(<DripBuilder onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Header drip" }
    });
    const [first, second] = screen.getAllByRole("button", {
      name: /Choose a template/
    });
    await chooseTemplate(first, "header_variable");
    await chooseTemplate(second, "order_tips");

    // An empty header value stops the save.
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(screen.getByText("Message 1: Fill in every value.")).toBeTruthy();
    expect(createDrip).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Type the text"), {
      target: { value: "Priya" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(createDrip).toHaveBeenCalledTimes(1));
    expect(createDrip.mock.calls[0][0].steps[0]).toEqual({
      templateId: "meta-3",
      components: [
        {
          type: "header",
          parameters: [
            { type: "text", value: { source: "literal", text: "Priya" } }
          ]
        }
      ],
      delayMinutes: 0
    });
  });

  it("reads a saved text header's value back", async () => {
    const draft = savedDrip({
      steps: [
        {
          step: 1,
          templateId: "meta-3",
          templateName: "header_variable",
          templateLanguage: "en_US",
          templateCategory: "MARKETING",
          hasStopButton: false,
          components: [
            {
              type: "header",
              parameters: [
                { type: "text", value: { source: "literal", text: "Priya" } }
              ]
            }
          ],
          delayMinutes: 0
        }
      ]
    });
    wrap(<DripBuilder drip={draft} onSaved={vi.fn()} />);
    expect(
      (
        (await screen.findByPlaceholderText(
          "Type the text"
        )) as HTMLInputElement
      ).value
    ).toBe("Priya");
  });

  it("keeps a started drip's messages and number, and lets one be added", async () => {
    const started = savedDrip({
      status: "active",
      activatedAt: "2026-11-20T10:00:00.000Z",
      steps: [
        {
          step: 1,
          templateId: "meta-2",
          templateName: "order_tips",
          templateLanguage: "en_US",
          templateCategory: "UTILITY",
          hasStopButton: false,
          components: [],
          delayMinutes: 0
        },
        {
          step: 2,
          templateId: "meta-2",
          templateName: "order_tips",
          templateLanguage: "en_US",
          templateCategory: "UTILITY",
          hasStopButton: false,
          components: [],
          delayMinutes: 1440
        }
      ]
    });
    updateDrip.mockResolvedValue(started);
    wrap(<DripBuilder drip={started} onSaved={vi.fn()} />);

    expect(
      screen.getByText("The number can't change after the drip has started.")
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Remove message 1" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Remove message 2" })
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Add another message/ })
    );
    expect(
      screen.getByText(
        "People who finished the drip will get the new message too."
      )
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Remove message 3" })
    ).toBeTruthy();

    await screen.findAllByText("Order tips");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateDrip).toHaveBeenCalledTimes(1));
    const { payload } = updateDrip.mock.calls[0][0];
    expect(payload.phoneNumberId).toBeUndefined();
    // How people join can't change after the start.
    expect(payload.trigger).toBeUndefined();
    // The empty new message isn't sent; the saved ones are.
    expect(
      payload.steps.map((step: { delayMinutes: number }) => step.delayMinutes)
    ).toEqual([0, 1440]);
  });
});

describe("DripResults", () => {
  const report = (overrides: Partial<DripReport> = {}): DripReport => ({
    drip: savedDrip({
      status: "active",
      contacts: { active: 5, completed: 3, stopped: 2, total: 10 }
    }),
    stopReasons: [
      { reason: "replied", text: "Replied on WhatsApp.", count: 2 }
    ],
    waiting: { sending_hours: 4 },
    steps: [
      {
        step: 1,
        templateName: "welcome_offer",
        sent: 10,
        delivered: 9,
        read: 6,
        replied: 2,
        stoppedOffers: 0,
        notDelivered: 1,
        failed: 0,
        skipped: 0,
        retrying: 0
      }
    ],
    ...overrides
  });

  it("shows the counts, hides empty columns and explains Not delivered", () => {
    wrap(<DripResults report={report()} onShowPeople={vi.fn()} />);
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.getByText(/Waiting for sending hours/)).toBeTruthy();
    expect(screen.getAllByText("Not delivered").length).toBeGreaterThan(0);
    expect(screen.queryByText("Failed")).toBeNull();
    expect(screen.queryByText("Retrying")).toBeNull();
    expect(
      screen.getByText(/WhatsApp limits how many offers one person gets/)
    ).toBeTruthy();
  });

  it("opens the people who left for a reason", () => {
    const onShowPeople = vi.fn();
    wrap(<DripResults report={report()} onShowPeople={onShowPeople} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Replied on WhatsApp/ })
    );
    expect(onShowPeople).toHaveBeenCalledWith("stopped", "replied");
  });
});

describe("audience preview lines", () => {
  it("leaves out the lines that are 0", () => {
    expect(
      previewLines({
        matched: 12,
        willJoin: 9,
        stoppedOffers: 1,
        usNumbers: 0,
        cantMessage: 2,
        warnings: []
      })
    ).toEqual([
      "1 person asked not to get offers, so they're left out.",
      "2 people can't be messaged (they opted out, have no WhatsApp number, or are outside your plan's contact limit)."
    ]);
  });
});

describe("OffersStoppedControl", () => {
  it("shows why offers stopped and turns them back on", async () => {
    updateSubscriber.mockResolvedValue({
      status: "success",
      data: { subscriber: { offersStopped: false, offersStoppedReason: null } }
    });
    wrap(
      <OffersStoppedControl
        subscriberId="sub-1"
        initial={{ offersStopped: true, offersStoppedReason: "stop_button" }}
      />
    );
    expect(screen.getByText("Stopped offers")).toBeTruthy();
    expect(screen.getByText("Tapped Stop promotions")).toBeTruthy();
    expect(
      screen.getByText("They'll still get order updates and replies.")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("switch", { name: "Stop offers for this contact" })
    );
    await waitFor(() =>
      expect(updateSubscriber).toHaveBeenCalledWith({
        subscriberId: "sub-1",
        payload: { offersStopped: false }
      })
    );
    await waitFor(() =>
      expect(screen.queryByText("Stopped offers")).toBeNull()
    );
  });

  it("keeps the change when the dialog around it re-renders", async () => {
    updateSubscriber.mockResolvedValue({
      status: "success",
      data: {
        subscriber: { offersStopped: true, offersStoppedReason: "manual" }
      }
    });
    // Like the contact dialog: a new `initial` object on every render.
    function Dialog() {
      const [, setTyped] = useState("");
      return (
        <>
          <input aria-label="Name" onChange={(e) => setTyped(e.target.value)} />
          <OffersStoppedControl
            subscriberId="sub-1"
            initial={{ offersStopped: false, offersStoppedReason: null }}
          />
        </>
      );
    }
    wrap(<Dialog />);
    fireEvent.click(
      screen.getByRole("switch", { name: "Stop offers for this contact" })
    );
    await screen.findByText("Marked by you");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Priya" }
    });
    expect(screen.getByText("Marked by you")).toBeTruthy();
    expect(
      screen
        .getByRole("switch", { name: "Stop offers for this contact" })
        .getAttribute("aria-checked")
    ).toBe("true");
  });
});

describe("automatic drips", () => {
  const tagDrip = (overrides: Partial<Drip> = {}) =>
    savedDrip({
      trigger: { type: "tag_added", tag: "Lead" },
      onReply: "pause",
      stopOnReply: false,
      ...overrides
    });
  const replySelect = () =>
    screen.getByRole("combobox", { name: "When they reply" });

  it("defaults the reply setting from Starts when, until it's picked", async () => {
    wrap(<DripBuilder onSaved={vi.fn()} />);
    expect(replySelect().textContent).toContain("Stop the drip");

    fireEvent.click(
      screen.getByRole("radio", { name: /A contact gets a tag/ })
    );
    expect(replySelect().textContent).toContain(
      "Pause while they're chatting (recommended)"
    );
    expect(screen.getByText("Tag")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Lead nurture" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Next: start the drip/ })
    );
    expect(
      screen.getAllByText("Choose the tag that starts the drip.").length
    ).toBeGreaterThan(0);
    expect(createDrip).not.toHaveBeenCalled();
  });

  it("saves a tag drip's trigger, goal and reply setting", async () => {
    const draft = tagDrip({ stopTags: ["Purchased"] });
    updateDrip.mockResolvedValue(draft);
    wrap(<DripBuilder drip={draft} onSaved={vi.fn()} />);

    expect(screen.getByText("Someone gets the tag “Lead”")).toBeTruthy();
    expect(replySelect().textContent).toContain("Pause while");

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(updateDrip).toHaveBeenCalledTimes(1));
    expect(updateDrip.mock.calls[0][0].payload).toMatchObject({
      trigger: { type: "tag_added", tag: "Lead" },
      stopTags: ["Purchased"],
      onReply: "pause"
    });
    expect(updateDrip.mock.calls[0][0].payload.stopOnReply).toBeUndefined();
  });

  it("shows how a started tag drip starts, without changing it", () => {
    wrap(
      <DripBuilder
        drip={tagDrip({
          status: "active",
          activatedAt: "2026-11-24T10:00:00.000Z"
        })}
        onSaved={vi.fn()}
      />
    );
    expect(
      screen.getByText("This can't change after the drip has started.")
    ).toBeTruthy();
    expect(
      screen.queryByRole("radio", { name: /A contact gets a tag/ })
    ).toBeNull();
  });

  it("starts a tag drip with no audience, offering those who have the tag", async () => {
    previewDripAudience.mockResolvedValue({
      matched: 3,
      willJoin: 3,
      stoppedOffers: 0,
      usNumbers: 0,
      cantMessage: 0,
      warnings: []
    });
    startDrip.mockResolvedValue({
      drip: tagDrip({ status: "active" }),
      startAt: "2026-11-24T10:00:00.000Z"
    });
    wrap(
      <DripAudienceDialog
        drip={tagDrip()}
        mode="start"
        open
        onOpenChange={vi.fn()}
      />
    );

    const existing = await screen.findByText(
      "3 contacts already have this tag. Add them now too?"
    );
    expect(previewDripAudience).toHaveBeenCalledWith({
      dripId: "drip-1",
      audience: { mode: "tags", tags: ["Lead"], tagMatch: "any" }
    });
    expect(screen.queryByText("All contacts")).toBeNull();
    expect(screen.queryByText("Start now")).toBeNull();

    const start = screen.getByRole("button", { name: "Start drip" });
    expect(start.hasAttribute("disabled")).toBe(true);
    fireEvent.click(existing);
    fireEvent.click(
      screen.getByText(
        "These contacts agreed to get messages from us on WhatsApp"
      )
    );
    fireEvent.click(start);
    await waitFor(() =>
      expect(startDrip).toHaveBeenCalledWith({
        dripId: "drip-1",
        payload: { consentConfirmed: true, includeExisting: true }
      })
    );
  });

  it("hides the offer when nobody has the tag yet", async () => {
    previewDripAudience.mockResolvedValue({
      matched: 0,
      willJoin: 0,
      stoppedOffers: 0,
      usNumbers: 0,
      cantMessage: 0,
      warnings: []
    });
    wrap(
      <DripAudienceDialog
        drip={tagDrip()}
        mode="start"
        open
        onOpenChange={vi.fn()}
      />
    );
    await waitFor(() => expect(previewDripAudience).toHaveBeenCalled());
    expect(screen.queryByText(/already have this tag/)).toBeNull();
    expect(screen.queryByText(/already has this tag/)).toBeNull();
  });

  it("reports how people joined and the goal", () => {
    wrap(
      <DripResults
        report={{
          drip: tagDrip({
            status: "active",
            stopTags: ["Purchased"],
            contacts: { active: 4, completed: 1, stopped: 3, total: 8 }
          }),
          stopReasons: [
            {
              reason: "goal_reached",
              text: "Reached the goal (got a goal tag).",
              count: 2
            }
          ],
          waiting: { chatting: 1 },
          joined: { total: 8, byHand: 3, byTag: 5 },
          goal: { reached: 2, rate: 25 },
          steps: []
        }}
        onShowPeople={vi.fn()}
      />
    );
    expect(screen.getByText("5 by tag, 3 added by you")).toBeTruthy();
    expect(screen.getByText("Goal reached")).toBeTruthy();
    expect(screen.getByText("25% of everyone who joined")).toBeTruthy();
    expect(screen.getByText(/Waiting, they're chatting/)).toBeTruthy();
    expect(screen.getByText("Reached the goal (got a goal tag).")).toBeTruthy();
  });

  it("leaves Goal reached out when the drip has no goal tags", () => {
    wrap(
      <DripResults
        report={{
          drip: savedDrip({ status: "active" }),
          stopReasons: [],
          waiting: {},
          joined: { total: 4, byHand: 4, byTag: 0 },
          goal: { reached: 0, rate: 0 },
          steps: []
        }}
        onShowPeople={vi.fn()}
      />
    );
    expect(screen.queryByText("Goal reached")).toBeNull();
    expect(screen.getByText("Everyone who has joined so far")).toBeTruthy();
  });

  it("marks people who joined again", async () => {
    listDripContacts.mockResolvedValue({
      contacts: [
        {
          id: "row-1",
          contact: { id: "c1", name: "Priya", phone: "+91 98765 43210" },
          status: "active",
          round: 2,
          joinedBy: "tag",
          nextStep: 1,
          nextRunAt: null,
          waitingReason: null,
          stepsSent: 0,
          stopReason: null,
          stopReasonText: null,
          enrolledAt: "2026-11-24T10:00:00.000Z",
          lastSentAt: null,
          completedAt: null,
          stoppedAt: null
        }
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 }
    });
    wrap(
      <DripPeople
        drip={tagDrip({ status: "active" })}
        status="active"
        stopReason=""
        stopReasons={[]}
        onFilterChange={vi.fn()}
      />
    );
    expect(await screen.findByText("Joined again")).toBeTruthy();
  });
});

describe("ContactDrips", () => {
  const row = (overrides: Record<string, unknown>) => ({
    id: "row",
    drip: { id: "drip-1", name: "Welcome series", status: "active", steps: 3 },
    status: "active",
    round: 1,
    nextStep: 2,
    nextRunAt: null,
    waitingReason: null,
    stepsSent: 1,
    stopReasonText: null,
    enrolledAt: "2026-11-20T10:00:00.000Z",
    endedAt: null,
    ...overrides
  });

  it("lists drips in progress with Remove, then the last ones left", async () => {
    listContactDrips.mockResolvedValue([
      row({ id: "a" }),
      row({
        id: "b",
        drip: { id: "drip-2", name: "Old offer", status: "archived", steps: 2 },
        status: "completed",
        endedAt: "2026-11-10T10:00:00.000Z"
      }),
      row({
        id: "c",
        drip: {
          id: "drip-3",
          name: "Lead nurture",
          status: "active",
          steps: 2
        },
        status: "stopped",
        stopReasonText: "Replied on WhatsApp.",
        endedAt: "2026-11-22T10:00:00.000Z"
      })
    ]);
    removeDripContact.mockResolvedValue(undefined);
    wrap(<ContactDrips subscriberId="sub-1" />);

    expect(await screen.findByText("Drips")).toBeTruthy();
    expect(screen.getByText(/in progress/)).toBeTruthy();
    const items = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    // The most recent ending first, whatever its kind.
    expect(items[1]).toContain(
      "Lead nurture: left early: Replied on WhatsApp."
    );
    expect(items[2]).toContain("Old offer: finished");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(removeDripContact).toHaveBeenCalledWith({
        dripId: "drip-1",
        contactRowId: "a"
      })
    );
  });

  it("shows nothing when the contact has no drips", async () => {
    listContactDrips.mockResolvedValue([]);
    const { container } = wrap(<ContactDrips subscriberId="sub-1" />);
    await waitFor(() => expect(listContactDrips).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});
