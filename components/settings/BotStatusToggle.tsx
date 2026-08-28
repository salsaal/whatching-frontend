import { useMutation, useQuery } from "@tanstack/react-query";

import { getBotSettings, updateBotSettings } from "@/client-api/functions/bot";
import { Switch } from "@/components/ui/switch";
import { useOrganizationStore } from "@/stores/organizationStore";

export function BotStatusToggle() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ["bot-settings", activeOrganization?._id],
    queryFn: getBotSettings,
    enabled: Boolean(activeOrganization?._id)
  });

  const { mutate: updateSettingsMutate, isPending: isUpdatingSettings } =
    useMutation({
      mutationFn: updateBotSettings
    });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">Active bot</p>
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
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium">AI fallback</p>
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
