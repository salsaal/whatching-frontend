import type { QueryClient } from "@tanstack/react-query";

import type { Drip, DripReport } from "@/client-api/types/drips.type";

/**
 * Keep a drip the server just returned after a change. Those responses
 * don't count people (they read 0), so the counts already shown stay until
 * the report reloads.
 */
export const rememberDrip = (queryClient: QueryClient, saved: Drip) => {
  queryClient.setQueryData<Drip>(["drip", saved.id], (old) => ({
    ...saved,
    contacts: old?.contacts ?? saved.contacts
  }));
  queryClient.setQueryData<DripReport>(["drip-report", saved.id], (old) =>
    old ? { ...old, drip: { ...saved, contacts: old.drip.contacts } } : old
  );
  queryClient.invalidateQueries({ queryKey: ["drip-report", saved.id] });
  queryClient.invalidateQueries({ queryKey: ["drips"] });
};
