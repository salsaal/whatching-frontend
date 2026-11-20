import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type {
  StoreResponse,
  UpdateStoreSettingsPayload
} from "@/client-api/types/stores.type";
import { useStoreApi } from "@/components/store/StoreApiContext";
import { storeErrorMessage } from "@/lib/store";

/**
 * Saves one change to the store's settings (only the fields that changed).
 * `save` resolves to the API's message when the change is refused, so the
 * control that made it can show the reason next to itself, or null.
 */
export function useStoreSettings(connectionId: string) {
  const queryClient = useQueryClient();
  const api = useStoreApi();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (payload: UpdateStoreSettingsPayload) =>
      api.updateSettings({ connectionId, payload }),
    meta: { showToast: false },
    onSuccess: (response) => {
      // The Shopify screens' store data has more fields; only the
      // connection changes, so the rest is kept as it is.
      queryClient.setQueryData<StoreResponse>(api.storeKey, (current) =>
        current
          ? {
              ...current,
              data: { ...current.data, connection: response.data.connection }
            }
          : current
      );
    }
  });

  const save = async (
    payload: UpdateStoreSettingsPayload,
    { quiet = false }: { quiet?: boolean } = {}
  ): Promise<string | null> => {
    try {
      const response = await mutateAsync(payload);
      const warnings = response.data.warnings || [];
      warnings.forEach((warning) => toast.warning(warning));
      if (!quiet && !warnings.length) toast.success("Saved.");
      return null;
    } catch (error) {
      return storeErrorMessage(
        error,
        "That change couldn't be saved. Please try again."
      );
    }
  };

  return { save, isSaving: isPending };
}
