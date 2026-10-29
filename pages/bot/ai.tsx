"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useEffect } from "react";

import { listKnowledgeSources } from "@/client-api/functions/bot";
import { AiUsageStrip } from "@/components/bot/AiUsageStrip";
import BotLayout from "@/components/bot/BotLayout";
import { KnowledgeTestPanel } from "@/components/bot/KnowledgeTestPanel";
import { KnowledgeBaseSection } from "@/components/settings/KnowledgeBaseSection";
import { Switch } from "@/components/ui/switch";
import { useBotSettings } from "@/hooks/useBotSettings";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
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

  // The page renders behind the permission gate, after the browser's own
  // #hash jump has already happened -- so jump to #knowledge / #usage here.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-lg bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-base font-semibold">AI replies</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              When a message doesn&apos;t match any flow, AI answers using only
              your knowledge base below.
            </p>
            {!isSourcesLoading && (
              <p className="mt-1 text-xs text-muted-foreground">
                {sources.length} source{sources.length === 1 ? "" : "s"} ·{" "}
                {readyCount} ready
              </p>
            )}
          </div>
          <Switch
            checked={isAiEnabled}
            disabled={isLoading || isUpdating || !planAllowed}
            title="Allow AI replies when no flow matches"
            onCheckedChange={(checked) =>
              updateSettings({ isAiEnabled: checked })
            }
          />
        </div>
        {isAiEnabled && !isSourcesLoading && readyCount === 0 && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>AI is on but has nothing to answer from. Add a source below.</p>
          </div>
        )}
      </section>

      {isOwner && <AiUsageStrip />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section
          id="knowledge"
          className="scroll-mt-24 rounded-lg bg-white p-5 shadow-xs"
        >
          <KnowledgeBaseSection />
        </section>
        <KnowledgeTestPanel />
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
