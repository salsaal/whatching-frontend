"use client";

import { Zap } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import BotLayout from "@/components/bot/BotLayout";
import {
  BUILT_IN_OPT_IN_KEYWORDS,
  BUILT_IN_OPT_OUT_KEYWORDS,
  KeywordsSection
} from "@/components/bot/KeywordsSection";
import { SettingRow } from "@/components/bot/SettingRow";
import { SpamProtectionPresets } from "@/components/bot/SpamProtectionPresets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBotSettings } from "@/hooks/useBotSettings";
import { cn } from "@/lib/utils";

function StatusPill({
  label,
  isOn,
  href
}: {
  label: string;
  isOn: boolean;
  href?: string;
}) {
  const content: ReactNode = (
    <>
      <span
        className={cn(
          "size-2 rounded-full",
          isOn ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
      {label}: {isOn ? "On" : "Off"}
    </>
  );
  const className =
    "inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm font-medium";
  return href ? (
    <Link href={href} className={cn(className, "hover:border-primary/40")}>
      {content}
    </Link>
  ) : (
    <span className={className}>{content}</span>
  );
}

function BotSettingsTab() {
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();
  const controlsDisabled = isLoading || isUpdating || !planAllowed;

  if (isLoading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Bot" isOn={Boolean(settings.isBotEnabled)} />
        <StatusPill
          label="AI replies"
          isOn={Boolean(settings.isAiEnabled)}
          href="/bot/ai"
        />
        <StatusPill
          label="Spam protection"
          isOn={Boolean(settings.spamProtectionEnabled)}
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
        title="Active bot"
        description="When on, the bot answers new messages with your published flows. When off, every message goes to your team's inbox."
      >
        <label className="flex items-center gap-3">
          <Switch
            checked={Boolean(settings.isBotEnabled)}
            disabled={controlsDisabled}
            onCheckedChange={(checked) =>
              updateSettings({ isBotEnabled: checked })
            }
          />
          <span className="text-sm font-medium">
            {settings.isBotEnabled ? "Bot is on" : "Bot is off"}
          </span>
        </label>
      </SettingRow>

      <SettingRow
        title="Spam protection"
        description="When one contact sends too many messages too fast, AI reviews what they sent. If it's clearly spam or abuse, the bot stops replying to them for 24 hours. Your team can still reply."
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
