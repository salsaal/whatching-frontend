import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Unlink } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  getInstagramAutomationSettings,
  updateInstagramAutomationSettings
} from "@/client-api/functions/instagram";
import { InstagramCanvasRecord } from "@/client-api/types/instagram.type";
import {
  BUILT_IN_OPT_OUT_KEYWORDS,
  KeywordsSection
} from "@/components/bot/KeywordsSection";
import {
  dependentPillState,
  MasterSwitchCard,
  StatusPill
} from "@/components/bot/MasterSwitchCard";
import { PausedNote, SettingRow } from "@/components/bot/SettingRow";
import { SpamProtectionPresets } from "@/components/bot/SpamProtectionPresets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const PAUSED_LABEL = "Paused while automation is off";

// Instagram's counterpart of Bot → Settings: the automation master switch,
// AI replies, spam protection, keywords, and the disconnect danger zone.
export function InstagramSettingsTab({
  canvases,
  onOpenMessageFlow,
  onDisconnect
}: {
  canvases: InstagramCanvasRecord[];
  onOpenMessageFlow: () => void;
  onDisconnect: () => void;
}) {
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const queryClient = useQueryClient();
  const queryKey = ["instagram-automation-settings", orgId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: getInstagramAutomationSettings,
    enabled: Boolean(orgId)
  });

  const { mutate: updateSettings, isPending: isUpdating } = useMutation({
    mutationFn: updateInstagramAutomationSettings,
    meta: { showToast: false },
    onSuccess: (response) => queryClient.setQueryData(queryKey, response),
    onError: () => toast.error("Couldn't update that setting. Try again.")
  });

  const settings = data?.data?.settings;

  if (isLoading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const isOn = Boolean(settings.isAutomationEnabled);
  const pausedLabel = isOn ? undefined : PAUSED_LABEL;
  // Instagram runs the one published canvas marked active.
  const hasLiveFlow = canvases.some(
    (canvas) =>
      canvas.status === "active" &&
      Boolean(canvas.latestPublishedVersionId || canvas.publishedState)
  );

  return (
    <div className="space-y-4">
      <MasterSwitchCard
        title="Active automation"
        isOn={isOn}
        onText="Instagram automation is replying to new DMs."
        offText="Automation is off. Every DM goes to your team's inbox."
        note="Turning this off also pauses AI replies and spam protection. Opt-out keywords keep working."
        confirmTitle="Turn off Instagram automation?"
        confirmDescription="Flows, AI replies and spam protection stop until you turn it back on."
        disabled={isUpdating}
        onChange={(next) => updateSettings({ isAutomationEnabled: next })}
      />

      <div className="flex flex-wrap gap-2">
        <StatusPill label="Automation" state={isOn ? "on" : "off"} />
        <StatusPill
          label="AI replies"
          state={dependentPillState(isOn, Boolean(settings.isAiEnabled))}
        />
        <StatusPill
          label="Spam protection"
          state={dependentPillState(
            isOn,
            Boolean(settings.spamProtectionEnabled)
          )}
        />
      </div>

      <SettingRow
        title="AI replies"
        description={
          <>
            When a DM doesn&apos;t match anything in your live Instagram flow,
            AI answers using your knowledge base.{" "}
            <Link
              href="/bot/ai#knowledge"
              className="font-medium text-primary hover:underline"
            >
              Manage knowledge base →
            </Link>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Tooltip open={isOn ? false : undefined}>
              {/* The trigger sets its own data-state, which would clobber the
                  switch's checked/unchecked styling, so it wraps a span. */}
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Switch
                    checked={Boolean(settings.isAiEnabled)}
                    disabled={isUpdating}
                    aria-label="AI replies"
                    className={cn(!isOn && "data-[state=checked]:bg-slate-500")}
                    onCheckedChange={(checked) =>
                      updateSettings({ isAiEnabled: checked })
                    }
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Saved, but paused while automation is off.
              </TooltipContent>
            </Tooltip>
            <span className="text-sm font-medium">
              {settings.isAiEnabled
                ? "AI replies are on"
                : "AI replies are off"}
            </span>
            {!isOn && <PausedNote label="Paused" />}
          </div>
          {!hasLiveFlow && (
            <p className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="size-4 shrink-0" />
              AI replies only run inside a live Instagram flow.
              <button
                type="button"
                className="cursor-pointer font-medium underline"
                onClick={onOpenMessageFlow}
              >
                Go to Message Flow
              </button>
            </p>
          )}
        </div>
      </SettingRow>

      <SettingRow
        title="Spam protection"
        description="When one contact sends too many DMs too fast, AI reviews what they sent. If it's clearly spam or abuse, automation stops replying to them for 24 hours. Your team can still reply."
        pausedLabel={pausedLabel}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <Switch
              checked={Boolean(settings.spamProtectionEnabled)}
              disabled={isUpdating}
              onCheckedChange={(checked) =>
                updateSettings({ spamProtectionEnabled: checked })
              }
            />
            <span className="text-sm font-medium">
              {settings.spamProtectionEnabled
                ? "Spam protection is on"
                : "Spam protection is off"}
            </span>
          </label>
          {settings.spamProtectionEnabled && (
            <SpamProtectionPresets
              threshold={settings.spamFloodThreshold}
              windowSeconds={settings.spamFloodWindowSeconds}
              onSave={(patch) => updateSettings(patch)}
            />
          )}
        </div>
      </SettingRow>

      <SettingRow
        title="Keywords"
        description="Words that trigger an action when a contact sends exactly that word."
      >
        <KeywordsSection
          greetingPausedLabel={pausedLabel}
          greeting={{
            value: settings.greetingKeywords || [],
            onSave: (next) => updateSettings({ greetingKeywords: next })
          }}
          optOut={{
            value: settings.optOutKeywords || [],
            builtIns: BUILT_IN_OPT_OUT_KEYWORDS,
            onSave: (next) => updateSettings({ optOutKeywords: next })
          }}
        />
      </SettingRow>

      <SettingRow
        title="Connection"
        description="Automations, comment rules and AI replies stop until you reconnect. Conversations and contacts are kept."
        className="border border-destructive/20"
      >
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onDisconnect}
        >
          <Unlink className="size-4" />
          Disconnect Instagram
        </Button>
      </SettingRow>
    </div>
  );
}
