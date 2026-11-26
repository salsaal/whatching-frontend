import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.test/api/v1";

type Handler = (payload?: unknown) => void;
const handlers: Record<string, Handler> = {};
const socket = {
  connected: false,
  on: vi.fn((event: string, handler: Handler) => {
    handlers[event] = handler;
  }),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn()
};
const io = vi.fn<(...args: unknown[]) => typeof socket>(() => socket);
vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => io(...args)
}));

const getConversations = vi.fn();
vi.mock("@/client-api/functions/chat", () => ({
  getConversations: (params: unknown) => getConversations(params)
}));

const access = { chats: true };
vi.mock("@/hooks/useCurrentMembership", () => ({
  useCurrentMembership: () => ({
    can: (permission: string) =>
      permission === "conversations:view" ? access.chats : true
  })
}));
vi.mock("@/stores/organizationStore", () => ({
  useOrganizationStore: (
    selector: (state: { activeOrganization: { _id: string } }) => unknown
  ) => selector({ activeOrganization: { _id: "org-1" } })
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { token: string }) => unknown) =>
    selector({ token: "token-1" })
}));

const { RealtimeProvider } = await import("@/components/app/RealtimeProvider");
const { formatUnreadBadge, selectUnreadChatCount, useInboxUnreadStore } =
  await import("@/stores/inboxUnreadStore");

function Badge() {
  const count = useInboxUnreadStore(selectUnreadChatCount);
  return <span data-testid="badge">{formatUnreadBadge(count)}</span>;
}

const wrap = (ui: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  );

afterEach(cleanup);
beforeEach(() => {
  Object.keys(handlers).forEach((key) => delete handlers[key]);
  io.mockClear();
  socket.emit.mockClear();
  socket.disconnect.mockClear();
  getConversations.mockReset();
  access.chats = true;
  useInboxUnreadStore.getState().clear();
});

describe("live unread badge", () => {
  it("loads the unread chats once connected and follows the events", async () => {
    getConversations.mockResolvedValue({
      pagination: { total: 2 },
      data: {
        summary: { unread: 2 },
        conversations: [{ _id: "c1" }, { _id: "c2" }]
      }
    });
    wrap(
      <RealtimeProvider>
        <Badge />
      </RealtimeProvider>
    );

    expect(io).toHaveBeenCalledTimes(1);
    expect(io.mock.calls[0][0]).toBe("https://api.example.test");
    expect(screen.getByTestId("badge").textContent).toBe("");

    act(() => handlers.connect());
    expect(socket.emit).toHaveBeenCalledWith("org:join", { orgId: "org-1" });
    expect(getConversations).toHaveBeenCalledWith({
      unreadOnly: true,
      limit: 100
    });
    await waitFor(() =>
      expect(screen.getByTestId("badge").textContent).toBe("2")
    );

    act(() =>
      handlers["conversation.updated"]({
        conversation: { _id: "c3", unreadCount: 4 }
      })
    );
    expect(screen.getByTestId("badge").textContent).toBe("3");

    act(() =>
      handlers["conversation.updated"]({
        conversation: { _id: "c1", unreadCount: 0 }
      })
    );
    act(() => handlers["conversation.read"]({ conversationId: "c2" }));
    expect(screen.getByTestId("badge").textContent).toBe("1");
  });

  it("loads again after a reconnect, when events may have been missed", async () => {
    getConversations.mockResolvedValue({
      pagination: { total: 1 },
      data: { summary: { unread: 1 }, conversations: [{ _id: "c1" }] }
    });
    wrap(
      <RealtimeProvider>
        <Badge />
      </RealtimeProvider>
    );
    act(() => handlers.connect());
    await waitFor(() =>
      expect(screen.getByTestId("badge").textContent).toBe("1")
    );

    getConversations.mockResolvedValue({
      pagination: { total: 120 },
      data: {
        summary: { unread: 120 },
        conversations: [{ _id: "c1" }, { _id: "c9" }]
      }
    });
    act(() => handlers.connect());
    await waitFor(() =>
      expect(screen.getByTestId("badge").textContent).toBe("99+")
    );
  });

  it("doesn't connect for someone who can't see chats", () => {
    access.chats = false;
    wrap(
      <RealtimeProvider>
        <Badge />
      </RealtimeProvider>
    );
    expect(io).not.toHaveBeenCalled();
    expect(screen.getByTestId("badge").textContent).toBe("");
  });

  it("closes the connection and clears the badge when it goes away", async () => {
    getConversations.mockResolvedValue({
      pagination: { total: 1 },
      data: { summary: { unread: 1 }, conversations: [{ _id: "c1" }] }
    });
    const view = wrap(
      <RealtimeProvider>
        <Badge />
      </RealtimeProvider>
    );
    act(() => handlers.connect());
    await waitFor(() =>
      expect(selectUnreadChatCount(useInboxUnreadStore.getState())).toBe(1)
    );
    view.unmount();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(selectUnreadChatCount(useInboxUnreadStore.getState())).toBe(0);
  });
});
