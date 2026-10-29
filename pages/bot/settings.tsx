"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

import BotLayout from "@/components/bot/BotLayout";
import {
  BUILT_IN_OPT_IN_KEYWORDS,
  BUILT_IN_OPT_OUT_KEYWORDS,
  KeywordsSection
} from "@/components/bot/KeywordsSection";
import {
  dependentPillState,
  MasterSwitchCard,
  StatusPill
} from "@/components/bot/MasterSwitchCard";
import { SettingRow } from "@/components/bot/SettingRow";
import { SpamProtectionPresets } from "@/components/bot/SpamProtectionPresets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBotSettings } from "@/hooks/useBotSettings";

const PAUSED_LABEL = "Paused while the bot is off";

function BotSettingsTab() {
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();
  const controlsDisabled = isLoading || isUpdating || !planAllowed;

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

  const isBotOn = Boolean(settings.isBotEnabled);
  const dependentState = (isOn: boolean) => dependentPillState(isBotOn, isOn);

  return (
    <div className="space-y-4">
      <MasterSwitchCard
        title="Active bot"
        isOn={isBotOn}
        onText="The bot is replying to new messages."
        offText="The bot is off. Every message goes to your team's inbox."
        note="Turning this off also pauses AI replies and spam protection. Opt-out keywords keep working."
        confirmTitle="Turn off the bot?"
        confirmDescription="Flows, AI replies and spam protection stop until you turn it back on."
        disabled={controlsDisabled}
        onChange={(next) => updateSettings({ isBotEnabled: next })}
      />

      <div className="flex flex-wrap gap-2">
        <StatusPill label="Bot" state={isBotOn ? "on" : "off"} />
        <StatusPill
          label="AI replies"
          state={dependentState(Boolean(settings.isAiEnabled))}
          href="/bot/ai"
        />
        <StatusPill
          label="Spam protection"
          state={dependentState(Boolean(settings.spamProtectionEnabled))}
        />
      </div>

      {!planAllowed && (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <Zap className="size-4 shrink-0 text-amber-600" />
          <p className="min-w-0 flex-1">
            Bot settings are available on plans with the chatbot builder.
            They&apos;re shown read-only until you upgrade.
          </p>
          <Button asChild size="sm" className="h-8 shrink-0">
            <Link href="/plans">View plans</Link>
          </Button>
        </div>
      )}

      <SettingRow
        title="Spam protection"
        description="When one contact sends too many messages too fast, AI reviews what they sent. If it's clearly spam or abuse, the bot stops replying to them for 24 hours. Your team can still reply."
        pausedLabel={isBotOn ? undefined : PAUSED_LABEL}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <Switch
              checked={Boolean(settings.spamProtectionEnabled)}
              disabled={controlsDisabled}
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
              disabled={!planAllowed}
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
          readOnly={!planAllowed}
          greetingPausedLabel={isBotOn ? undefined : PAUSED_LABEL}
          greeting={{
            value: settings.greetingKeywords || [],
            onSave: (next) => updateSettings({ greetingKeywords: next })
          }}
          optOut={{
            value: settings.optOutKeywords || [],
            builtIns: BUILT_IN_OPT_OUT_KEYWORDS,
            onSave: (next) => updateSettings({ optOutKeywords: next })
          }}
          optIn={{
            value: settings.optInKeywords || [],
            builtIns: BUILT_IN_OPT_IN_KEYWORDS,
            onSave: (next) => updateSettings({ optInKeywords: next })
          }}
        />
      </SettingRow>

    </div>
  );
}

export default function BotSettingsPage() {
  return (
    <BotLayout activeTab="settings">
      <BotSettingsTab />
    </BotLayout>
  );
}
