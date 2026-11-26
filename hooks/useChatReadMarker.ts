import { useCallback, useEffect, useRef } from "react";

import { isChatOnScreen } from "@/lib/inbox";

/** At most one "mark read" call this often. */
export const MARK_READ_INTERVAL_MS = 1000;

/**
 * When to mark the open chat read: only a chat the person picked, only
 * while they can see it (tab showing, window focused), and at most once a
 * second. Asked while they're away, it waits until they come back.
 * Returns `request(conversationId)`, called on opening the chat and for
 * each new customer message in it.
 */
export function useChatReadMarker({
  selectedId,
  isSelectionDeliberate,
  onMarkRead
}: {
  selectedId: string;
  isSelectionDeliberate: boolean;
  onMarkRead: (conversationId: string) => void;
}) {
  const selectedIdRef = useRef(selectedId);
  const deliberateRef = useRef(isSelectionDeliberate);
  const onMarkReadRef = useRef(onMarkRead);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The chat the pending call is for, and the last chat marked (and when).
  const pendingRef = useRef("");
  const lastMarkedRef = useRef({ id: "", at: 0 });
  const waitingRef = useRef("");

  useEffect(() => {
    selectedIdRef.current = selectedId;
    deliberateRef.current = isSelectionDeliberate;
    onMarkReadRef.current = onMarkRead;
  }, [isSelectionDeliberate, onMarkRead, selectedId]);

  const request = useCallback((conversationId: string) => {
    const isOpenAndPicked = (id: string) =>
      Boolean(id) && id === selectedIdRef.current && deliberateRef.current;
    if (!isOpenAndPicked(conversationId)) return;
    if (!isChatOnScreen()) {
      waitingRef.current = conversationId;
      return;
    }
    if (timerRef.current) {
      if (pendingRef.current === conversationId) return;
      // They moved to another chat: that one goes now, not after the wait.
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = conversationId;
    const last = lastMarkedRef.current;
    const wait =
      last.id === conversationId
        ? Math.max(0, last.at + MARK_READ_INTERVAL_MS - Date.now())
        : 0;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const id = pendingRef.current;
      pendingRef.current = "";
      if (!isOpenAndPicked(id)) return;
      if (!isChatOnScreen()) {
        waitingRef.current = id;
        return;
      }
      lastMarkedRef.current = { id, at: Date.now() };
      waitingRef.current = "";
      onMarkReadRef.current(id);
    }, wait);
  }, []);

  // Back to the tab or window: read what came in while they were away.
  useEffect(() => {
    const onReturn = () => {
      const waiting = waitingRef.current;
      if (waiting && isChatOnScreen()) {
        waitingRef.current = "";
        request(waiting);
      }
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [request]);

  return request;
}
