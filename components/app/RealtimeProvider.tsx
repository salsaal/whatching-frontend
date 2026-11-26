import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from "react";
import { io, Socket } from "socket.io-client";

import { getConversations } from "@/client-api/functions/chat";
import { Conversation } from "@/client-api/types/chat.type";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useAuthStore } from "@/stores/authStore";
import { useInboxUnreadStore } from "@/stores/inboxUnreadStore";
import { useOrganizationStore } from "@/stores/organizationStore";

/** How many unread chats are loaded by ID; past this the badge is "99+". */
const UNREAD_PAGE = 100;

const RealtimeContext = createContext<Socket | null>(null);

/**
 * The app's one live connection for the active workspace, or null (logged
 * out, no workspace, or no permission to see chats). The inbox listens on
 * it too; it must remove its own listeners rather than disconnect.
 */
export const useRealtimeSocket = () => useContext(RealtimeContext);

/**
 * Mounted once for the whole app (not per page), so the unread badge on
 * "Conversations" stays live on every page without reconnecting on each
 * navigation.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const token = useAuthStore((state) => state.token);
  const { can } = useCurrentMembership();
  const canViewChats = can("conversations:view");
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const authToken =
      token ||
      (typeof window !== "undefined"
        ? localStorage.getItem("accessToken")
        : null);
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!orgId || !authToken || !apiBase || !canViewChats) return;

    const unread = useInboxUnreadStore.getState();
    const next: Socket = io(apiBase.replace(/\/api\/v1\/?$/, ""), {
      auth: { token: authToken },
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    let active = true;
    const loadUnread = async () => {
      try {
        const response = await getConversations({
          unreadOnly: true,
          limit: UNREAD_PAGE
        });
        if (!active) return;
        const ids = response.data.conversations.map(
          (conversation) => conversation._id
        );
        unread.reset(
          orgId,
          ids,
          response.data.summary?.unread ?? response.pagination?.total ?? 0
        );
      } catch {
        // Leave the badge as it is; the next reconnect tries again.
      }
    };

    // Also fires after every reconnect, when events may have been missed.
    next.on("connect", () => {
      next.emit("org:join", { orgId });
      loadUnread();
    });
    next.on(
      "conversation.updated",
      (payload: { conversation?: Conversation }) => {
        const conversation = payload.conversation;
        if (!conversation?._id) return;
        useInboxUnreadStore
          .getState()
          .setUnread(orgId, conversation._id, conversation.unreadCount > 0);
      }
    );
    next.on("conversation.read", (payload: { conversationId?: string }) => {
      if (payload.conversationId) {
        useInboxUnreadStore.getState().markRead(orgId, payload.conversationId);
      }
    });

    setSocket(next);
    return () => {
      active = false;
      setSocket(null);
      useInboxUnreadStore.getState().clear();
      next.disconnect();
    };
  }, [canViewChats, orgId, token]);

  return (
    <RealtimeContext.Provider value={socket}>
      {children}
    </RealtimeContext.Provider>
  );
}
