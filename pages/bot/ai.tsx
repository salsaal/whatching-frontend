"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { listKnowledgeSources } from "@/client-api/functions/bot";
import { AiUsageCard } from "@/components/bot/AiUsageCard";
import BotLayout from "@/components/bot/BotLayout";
import { BotOffBanner } from "@/components/bot/BotOffBanner";
import { KnowledgeTestButton } from "@/components/bot/KnowledgeTestDialog";
import { PausedNote } from "@/components/bot/SettingRow";
import { AiUsageTopUp } from "@/components/settings/AiUsageTopUp";
import { KnowledgeBaseSection } from "@/components/settings/KnowledgeBaseSection";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useBotSettings } from "@/hooks/useBotSettings";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useLiveFlows } from "@/hooks/useLiveFlows";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

function BotAiTab() {
  const { isOwner } = useCurrentMembership();
  const orgId = useOrganizationStore((state) => state.activeOrganization?._id);
  const { settings, planAllowed, isLoading, isUpdating, updateSettings } =
    useBotSettings();

  // Same query key as KnowledgeBaseSection, so the list and this health
  // line share one request.
  const { data: sourcesData, isLoading: isSourcesLoading } = useQuery({
    queryKey: ["bot-knowledge-sources", orgId],
    queryFn: listKnowledgeSources,
    enabled: Boolean(orgId)
  });
  const sources = sourcesData?.data?.sources || [];
  // A disabled source isn't used for answers even when it's ready.
  const readyCount = sources.filter(
    (source) => source.status === "ready" && !source.disabledAt
  ).length;
  const isAiEnabled = Boolean(settings?.isAiEnabled);
  // AI replies need the bot on; the switch still saves while it's off.
  const isPaused = Boolean(settings) && !settings?.isBotEnabled;
  // AI only replies inside a live flow, so with nothing live it never runs.
  const {
    isNothingLive,
    isLoading: isLiveLoading,
    isError: isLiveError
  } = useLiveFlows();

  // The page renders behind the permission gate, after the browser's own
  // #hash jump has already happened -- so jump to #knowledge / #usage here.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div className="space-y-4">
      <BotOffBanner message="AI replies are paused because the bot is off." />
      {settings?.isBotEnabled &&
        !isLiveLoading &&
        !isLiveError &&
        isNothingLive && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center">
            <AlertTriangle className="hidden size-4 shrink-0 text-amber-600 sm:block" />
            <p className="min-w-0 flex-1">
              The AI Assistant answers inside your live flow. Publish a flow and
              set it live to start AI replies.
            </p>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/bot/flows">Go to Flows</Link>
            </Button>
          </div>
        )}

      <section className="space-y-3 rounded-lg bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-base font-semibold">
                AI replies
              </h2>
              {isPaused && <PausedNote label="Paused" />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              When a message doesn&apos;t match anything in your live flow, the
              AI answers using your knowledge base.
            </p>
            {!isSourcesLoading && (
              <p className="mt-1 text-xs text-muted-foreground">
                {sources.length} source{sources.length === 1 ? "" : "s"} ·{" "}
                {readyCount} ready
              </p>
            )}
          </div>
          <Tooltip open={isPaused ? undefined : false}>
            <TooltipTrigger asChild>
              <Switch
                checked={isAiEnabled}
                disabled={isLoading || isUpdating || !planAllowed}
                aria-label="AI replies"
                className={cn(
                  isPaused &&
                    "opacity-50 saturate-0 data-[state=checked]:bg-slate-400"
                )}
                onCheckedChange={(checked) =>
                  updateSettings({ isAiEnabled: checked })
                }
              />
            </TooltipTrigger>
            <TooltipContent>
              Saved, but paused while the bot is off.
            </TooltipContent>
          </Tooltip>
        </div>
        {isAiEnabled && !isSourcesLoading && readyCount === 0 && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>AI is on but has nothing to answer from. Add a source below.</p>
          </div>
        )}
      </section>

      {isOwner && <AiUsageCard />}

      <div
        className={cn(
          "grid gap-4 lg:items-start",
          isOwner && "lg:grid-cols-[minmax(0,1fr)_360px]"
        )}
      >
        <section
          id="knowledge"
          className="scroll-mt-24 rounded-lg bg-white p-5 shadow-xs"
        >
          <KnowledgeBaseSection headerActions={<KnowledgeTestButton />} />
        </section>
        {isOwner && (
          // Above the knowledge base on mobile, beside it on desktop.
          <section className="order-first space-y-3 rounded-lg bg-white p-5 shadow-xs lg:order-none">
            <div>
              <h2 className="font-heading text-base font-semibold">
                Top up AI tokens
              </h2>
              <p className="text-sm text-muted-foreground">
                Buy extra tokens for AI replies.
              </p>
            </div>
            <AiUsageTopUp />
          </section>
        )}
      </div>
    </div>
  );
}

export default function BotAiPage() {
  return (
    <BotLayout activeTab="ai">
      <BotAiTab />
    </BotLayout>
  );
}
