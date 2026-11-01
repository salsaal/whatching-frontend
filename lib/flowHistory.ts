// Undo/redo for the flow editor: whole snapshots of nodes and wires. The
// editor records one per finished change (a drag counts once, on drop).

export const HISTORY_LIMIT = 50;

export type FlowHistory<S> = { past: S[]; future: S[] };

export const emptyHistory = <S>(): FlowHistory<S> => ({
  past: [],
  future: []
});

/** Remembers the state before a change. A new change clears redo. */
export const recordHistory = <S>(
  history: FlowHistory<S>,
  previous: S,
  limit = HISTORY_LIMIT
): FlowHistory<S> => ({
  past: [...history.past, previous].slice(-limit),
  future: []
});

/** The state to go back to, or null when there is nothing to undo. */
export const undoHistory = <S>(
  history: FlowHistory<S>,
  current: S,
  limit = HISTORY_LIMIT
): { history: FlowHistory<S>; snapshot: S } | null => {
  if (!history.past.length) return null;
  return {
    snapshot: history.past[history.past.length - 1],
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, limit)
    }
  };
};

export const redoHistory = <S>(
  history: FlowHistory<S>,
  current: S,
  limit = HISTORY_LIMIT
): { history: FlowHistory<S>; snapshot: S } | null => {
  if (!history.future.length) return null;
  return {
    snapshot: history.future[0],
    history: {
      past: [...history.past, current].slice(-limit),
      future: history.future.slice(1)
    }
  };
};
