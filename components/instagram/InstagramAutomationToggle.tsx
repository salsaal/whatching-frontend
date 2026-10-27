import { Bot, ShieldAlert } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getInstagramAutomationSettings,
  updateInstagramAutomationSettings
} from "@/client-api/functions/instagram";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useOrganizationStore } from "@/stores/organizationStore";

export function InstagramAutomationToggle() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const queryClient = useQueryClient();
  const settingsQueryKey = [
    "instagram-automation-settings",
    activeOrganization?._id
  ];

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: settingsQueryKey,
    queryFn: getInstagramAutomationSettings,
    enabled: Boolean(activeOrganization?._id)
  });

  const { mutate: updateSettingsMutate, isPending: isUpdatingSettings } =
    useMutation({
      mutationFn: updateInstagramAutomationSettings,
      meta: { showToast: false },
      onSuccess: (response) => {
        queryClient.setQueryData(settingsQueryKey, response);
      },
      onError: () => {
        toast.error("Couldn't update that setting. Try again.");
      }
    });

  const settings = settingsData?.data?.settings;

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Active automation</p>
          <p className="text-xs text-muted-foreground">
            Global switch for Instagram DM and comment automation.
          </p>
        </div>
        <Switch
          checked={Boolean(settings?.isAutomationEnabled)}
          disabled={isSettingsLoading || isUpdatingSettings}
          title="Turn Instagram automation on or off"
          onCheckedChange={(checked) =>
            updateSettingsMutate({ isAutomationEnabled: checked })
          }
        />
      </div>
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <ShieldAlert className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Spam protection</p>
            <p className="text-xs text-muted-foreground">
              Automatically mute automated replies to a subscriber who sends too
              many messages too quickly.
            </p>
          </div>
          <Switch
            checked={Boolean(settings?.spamProtectionEnabled)}
            disabled={isSettingsLoading || isUpdatingSettings}
            title="Turn spam-flood muting on or off"
            onCheckedChange={(checked) =>
              updateSettingsMutate({ spamProtectionEnabled: checked })
            }
          />
        </div>
        {settings?.spamProtectionEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <label className="text-xs text-muted-foreground">Messages</label>
              <Input
                type="number"
                min={3}
                max={100}
                className="mt-1"
                value={settings.spamFloodThreshold}
                disabled={isUpdatingSettings}
                onChange={(event) =>
                  updateSettingsMutate({
                    spamFloodThreshold: Math.max(
                      3,
                      Math.min(100, Number(event.target.value) || 3)
                    )
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Within (seconds)
              </label>
              <Input
                type="number"
                min={10}
                max={3600}
                className="mt-1"
                value={settings.spamFloodWindowSeconds}
                disabled={isUpdatingSettings}
                onChange={(event) =>
                  updateSettingsMutate({
                    spamFloodWindowSeconds: Math.max(
                      10,
                      Math.min(3600, Number(event.target.value) || 10)
                    )
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
