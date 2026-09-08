import { Bot, Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getBotSettings, updateBotSettings } from "@/client-api/functions/bot";
import { Switch } from "@/components/ui/switch";
import { useOrganizationStore } from "@/stores/organizationStore";

export function BotStatusToggle() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const queryClient = useQueryClient();
  const settingsQueryKey = ["bot-settings", activeOrganization?._id];

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: settingsQueryKey,
    queryFn: getBotSettings,
    enabled: Boolean(activeOrganization?._id)
  });

  const { mutate: updateSettingsMutate, isPending: isUpdatingSettings } =
    useMutation({
      mutationFn: updateBotSettings,
      meta: { showToast: false },
      onSuccess: (response) => {
        // The switch's `checked` state derives entirely from this cache --
        // without writing the response back into it, a successful toggle
        // had no visible effect until something else happened to refetch.
        queryClient.setQueryData(settingsQueryKey, response);
      },
      onError: () => {
        toast.error("Couldn't update that setting. Try again.");
      }
    });

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Active bot</p>
          <p className="text-xs text-muted-foreground">
            Global switch for automation across every WhatsApp number.
          </p>
        </div>
        <Switch
          checked={Boolean(settingsData?.data?.settings.isBotEnabled)}
          disabled={isSettingsLoading || isUpdatingSettings}
          title="Turn the active WhatsApp flow on or off"
          onCheckedChange={(checked) =>
            updateSettingsMutate({ isBotEnabled: checked })
          }
        />
      </div>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">AI fallback</p>
          <p className="text-xs text-muted-foreground">
            Let AI answer when no flow route matches.
          </p>
        </div>
        <Switch
          checked={Boolean(settingsData?.data?.settings.isAiEnabled)}
          disabled={isSettingsLoading || isUpdatingSettings}
          title="Allow AI fallback when no flow route matches"
          onCheckedChange={(checked) =>
            updateSettingsMutate({ isAiEnabled: checked })
          }
        />
      </div>
    </div>
  );
}
