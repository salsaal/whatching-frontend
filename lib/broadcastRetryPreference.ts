const retryPreferenceKey = (broadcastId: string) =>
  `whatching:broadcast-retry:${broadcastId}`;

export const setBroadcastRetryPreference = (
  broadcastId: string,
  enabled: boolean
) => {
  if (typeof window === "undefined") return;
  if (enabled) {
    localStorage.setItem(retryPreferenceKey(broadcastId), "enabled");
  } else {
    localStorage.removeItem(retryPreferenceKey(broadcastId));
  }
};

export const hasBroadcastRetryPreference = (broadcastId: string) =>
  typeof window !== "undefined" &&
  localStorage.getItem(retryPreferenceKey(broadcastId)) === "enabled";
