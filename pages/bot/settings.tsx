"use client";

import { Power, Zap } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";

import BotLayout from "@/components/bot/BotLayout";
import {
  BUILT_IN_OPT_IN_KEYWORDS,
  BUILT_IN_OPT_OUT_KEYWORDS,
  KeywordsSection
} from "@/components/bot/KeywordsSection";
import { SettingRow } from "@/components/bot/SettingRow";
import { SpamProtectionPresets } from "@/components/bot/SpamProtectionPresets";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBotSettings } from "@/hooks/useBotSettings";
import { cn } from "@/lib/utils";

const PAUSED_LABEL = "Paused while the bot is off";

type PillState = "on" | "off" | "paused";

function StatusPill({
  label,
  state,
  href
}: {
  label: string;
  state: PillState;
  href?: string;
}) {
  const content: ReactNode = (
    <>
      <span
        className={cn(
          "size-2 rounded-full",
          state === "on" ? "bg-primary" : "bg-muted-foreground/40"
        )}
      />
      {label}: {state === "on" ? "On" : state === "off" ? "Off" : "Paused"}
    </>
  );
  const className = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
    state === "paused" ? "bg-slate-50 text-muted-foreground" : "bg-white"
  );
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
  const [isConfirmingOff, setIsConfirmingOff] = useState(false);
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
  // The bot switch is the master switch: AI replies and spam protection
  // only run while it's on, whatever their own switches say.
  const dependentState = (isOn: boolean): PillState =>
    !isBotOn ? "paused" : isOn ? "on" : "off";

  return (
    <div className="space-y-4">
      <section
        className={cn(
          "rounded-lg border-2 bg-white p-5 shadow-xs",
          isBotOn ? "border-primary/30" : "border-slate-200"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-md",
              isBotOn
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Power className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold">Active bot</h2>
            <p className="mt-0.5 text-sm font-medium">
              {isBotOn
                ? "The bot is replying to new messages."
                : "The bot is off. Every message goes to your team's inbox."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Turning this off also pauses AI replies and spam protection.
              Opt-out keywords keep working.
            </p>
          </div>
          <Switch
            checked={isBotOn}
            disabled={controlsDisabled}
            aria-label="Active bot"
            className="h-7 w-12 [&>span]:size-6"
            onCheckedChange={(checked) => {
              if (checked) updateSettings({ isBotEnabled: true });
              else setIsConfirmingOff(true);
            }}
          />
        </div>
      </section>

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

      <AlertDialog open={isConfirmingOff} onOpenChange={setIsConfirmingOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off the bot?</AlertDialogTitle>
            <AlertDialogDescription>
              Flows, AI replies and spam protection stop until you turn it back
              on.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => updateSettings({ isBotEnabled: false })}
            >
              Turn off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
