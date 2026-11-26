import { create } from "zustand";

/**
 * Chats with unread messages, for the badge on "Conversations" in the nav.
 * Loaded from the unread chat list, then kept live by socket events (see
 * RealtimeProvider). `extra` counts unread chats past the loaded page; the
 * badge already reads "99+" by then, so it doesn't need their IDs.
 */
interface InboxUnreadState {
  orgId: string | null;
  ids: Set<string>;
  extra: number;
  /**
   * The chat open on screen (picked, tab showing, window focused), or "".
   * Set by the inbox. It's marked read within a second, so a late "unread"
   * update for it would only make the badge blink; those are skipped.
   */
  readingId: string;
  setReading: (conversationId: string) => void;
  reset: (orgId: string, ids: string[], total: number) => void;
  setUnread: (orgId: string, conversationId: string, unread: boolean) => void;
  /** Read here or elsewhere (another agent or tab). */
  markRead: (orgId: string, conversationId: string) => void;
  clear: () => void;
}

export const useInboxUnreadStore = create<InboxUnreadState>()((set) => ({
  orgId: null,
  ids: new Set(),
  extra: 0,
  readingId: "",
  setReading: (conversationId) =>
    set((state) =>
      state.readingId === conversationId ? state : { readingId: conversationId }
    ),
  reset: (orgId, ids, total) =>
    set({
      orgId,
      ids: new Set(ids),
      extra: Math.max(0, total - new Set(ids).size)
    }),
  setUnread: (orgId, conversationId, unread) =>
    set((state) => {
      if (state.orgId !== orgId) return state;
      if (unread && conversationId === state.readingId) return state;
      if (unread === state.ids.has(conversationId)) return state;
      const ids = new Set(state.ids);
      if (unread) ids.add(conversationId);
      else ids.delete(conversationId);
      return { ids };
    }),
  markRead: (orgId, conversationId) =>
    set((state) => {
      if (state.orgId !== orgId) return state;
      if (state.ids.has(conversationId)) {
        const ids = new Set(state.ids);
        ids.delete(conversationId);
        return { ids };
      }
      // Not loaded, so likely one of the chats past the loaded page.
      return state.extra > 0 ? { extra: state.extra - 1 } : state;
    }),
  // Keeps readingId: that belongs to the inbox, which may still be open.
  clear: () => set({ orgId: null, ids: new Set(), extra: 0 })
}));

export const selectUnreadChatCount = (state: InboxUnreadState) =>
  state.ids.size + state.extra;

/** WhatsApp-style: hidden at 0, "99+" above 99. */
export const formatUnreadBadge = (count: number) =>
  count <= 0 ? "" : count > 99 ? "99+" : String(count);
