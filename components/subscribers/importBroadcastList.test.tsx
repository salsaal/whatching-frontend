import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const importSubscribers = vi.fn();
vi.mock("@/client-api/functions/subscribers", () => ({
  importSubscribers: (payload: unknown) => importSubscribers(payload)
}));

const { default: ImportSubscribersModal } = await import(
  "@/components/subscribers/ImportSubscribersModal"
);

const csv = new File(
  ["phoneNumber,firstName\n+919800000001,Asha\n+919800000002,Ravi\n"],
  "contacts.csv",
  { type: "text/csv" }
);

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ImportSubscribersModal
        open
        isImporting={false}
        onOpenChange={() => {}}
        onImport={() => {}}
      />
    </QueryClientProvider>
  );

const chooseFile = () => {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [csv] } });
};

const NOTE =
  "After this import you'll have 10,001 contacts. Broadcasts and drips go to your 10,000 most recently active contacts.";

// Braces matter: a function returned from beforeEach runs as cleanup.
beforeEach(() => {
  importSubscribers.mockReset();
});
afterEach(cleanup);

describe("import preview and the broadcast list", () => {
  it("runs a dry run and notes when the file goes past the list size", async () => {
    importSubscribers.mockResolvedValue({
      data: {
        summary: { contactsAfterImport: 10001, subscriberLimit: 10000 }
      }
    });
    renderDialog();
    chooseFile();

    await waitFor(() => expect(screen.getByText(NOTE)).toBeTruthy());
    expect(importSubscribers).toHaveBeenCalledWith({
      dryRun: true,
      subscribers: [
        expect.objectContaining({ firstName: "Asha" }),
        expect.objectContaining({ firstName: "Ravi" })
      ]
    });
    // A note, not a block: the import button stays on.
    expect(
      (screen.getByRole("button", { name: /Import 2/ }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it("stays quiet when the file fits", async () => {
    importSubscribers.mockResolvedValue({
      data: { summary: { contactsAfterImport: 900, subscriberLimit: 10000 } }
    });
    renderDialog();
    chooseFile();
    await waitFor(() => expect(importSubscribers).toHaveBeenCalled());
    await screen.findByText("Asha");
    expect(screen.queryByText(/After this import/)).toBeNull();
  });

  it("stays quiet when the dry run fails", async () => {
    importSubscribers.mockRejectedValue({
      response: { status: 403, data: { message: "Choose a plan first." } }
    });
    renderDialog();
    chooseFile();
    await waitFor(() => expect(importSubscribers).toHaveBeenCalled());
    await screen.findByText("Asha");
    expect(screen.queryByText(/After this import/)).toBeNull();
  });
});
