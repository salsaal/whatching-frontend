"use client";

import { Zap } from "lucide-react";
import Link from "next/link";

import BotLayout from "@/components/bot/BotLayout";
import {
  ActiveBotSwitch,
  SpamProtectionSwitch
} from "@/components/bot/BotSwitches";
import {
  BUILT_IN_OPT_IN_KEYWORDS,
  BUILT_IN_OPT_OUT_KEYWORDS,
  KeywordsSection
} from "@/components/bot/KeywordsSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBotSettings } from "@/hooks/useBotSettings";

function BotSettingsTab() {
  const { settings, planAllowed, isLoading, updateSettings } = useBotSettings();

  return (
    <div className="space-y-4">
      {!isLoading && !planAllowed && (
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

      <section className="rounded-lg bg-white p-4 shadow-xs">
        <h2 className="mb-3 font-heading text-base font-semibold">
          Active bot
        </h2>
        <ActiveBotSwitch />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-xs">
        <h2 className="mb-3 font-heading text-base font-semibold">
          Spam protection
        </h2>
        <SpamProtectionSwitch />
      </section>

      <section className="rounded-lg bg-white p-4 shadow-xs">
        <h2 className="mb-3 font-heading text-base font-semibold">Keywords</h2>
        {isLoading || !settings ? (
          <div className="space-y-3">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        ) : (
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
        )}
      </section>
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
