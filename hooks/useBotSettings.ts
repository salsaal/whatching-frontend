import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";

import { getBotSettings, updateBotSettings } from "@/client-api/functions/bot";
import { useOrganizationStore } from "@/stores/organizationStore";

// One cached copy of GET /bot/settings shared by every Bot control (the
// switches on different tabs and the keywords editor), all saving through
// PATCH /bot/settings with only the field that changed.
export function useBotSettings() {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const queryClient = useQueryClient();
  const queryKey = ["bot-settings", orgId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: getBotSettings,
    enabled: Boolean(orgId)
  });

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: updateBotSettings,
    meta: { showToast: false },
    onSuccess: (response) => {
      // Controls derive their state from this cache, so write the saved
      // settings back rather than waiting on a refetch.
      queryClient.setQueryData(queryKey, (current: typeof data) => ({
        ...current,
        ...response,
        data: {
          ...current?.data,
          ...response.data
        }
      }));
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message ||
          "Couldn't update that setting. Try again."
      );
    }
  });

  return {
    settings: data?.data?.settings,
    // Treat "unknown" as allowed so controls don't flash a lock while the
    // settings load; the backend is the real gate either way.
    planAllowed: data?.data?.planAllowed !== false,
    isLoading,
    isUpdating,
    updateSettings
  };
}
