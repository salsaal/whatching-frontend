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
const updateSubscriber = vi.fn();

vi.mock("@/client-api/functions/drips", () => ({
  createDrip: (payload: unknown) => createDrip(payload),
  updateDrip: (args: unknown) => updateDrip(args)
}));
vi.mock("@/client-api/functions/subscribers", () => ({
  getSubscriberById: vi.fn(),
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
const { previewLines } = await import("@/components/drips/DripAudienceDialog");
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
      stopOnReply: true
    });
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(savedDrip(), "next")
    );
  });

  it("doesn't offer templates with a variable in a text header", async () => {
    wrap(<DripBuilder onSaved={vi.fn()} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /Choose a template/ })[0]
    );
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("option", { name: /welcome_offer/ });
    expect(
      within(dialog).queryByRole("option", { name: /header_variable/ })
    ).toBeNull();
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
