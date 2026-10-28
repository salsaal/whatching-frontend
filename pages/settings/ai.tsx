"use client";

import { Bot } from "lucide-react";

import { AiUsageSummary } from "@/components/settings/AiUsageSummary";
import { AiUsageTopUp } from "@/components/settings/AiUsageTopUp";
import { BotStatusToggle } from "@/components/settings/BotStatusToggle";
import { KnowledgeBaseSection } from "@/components/settings/KnowledgeBaseSection";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import AppLayout from "@/layouts/AppLayout";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/common/NoAccess";

function AiSettingsPageContent() {
  // Token usage and top-ups are owner-only on the backend; other members
  // get the bot controls and knowledge base without those widgets.
  const { isOwner } = useCurrentMembership();
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-4">
        <section className="rounded-lg bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold">
                AI Assistant
              </h1>
              <p className="text-sm text-muted-foreground">
                Bot status, token usage, top-ups, and the knowledge base it
                answers from.
              </p>
            </div>
          </div>
        </section>

        {/* Status + usage stay pinned at the top so they're always visible;
            top-up and the knowledge base sit side by side below. */}
        <section
          className={cn(
            "grid gap-5 rounded-lg bg-white p-4 shadow-xs",
            isOwner && "divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0"
          )}
        >
          <div className={cn(isOwner && "sm:pr-5")}>
            <h2 className="mb-3 font-heading text-base font-semibold">
              Status
            </h2>
            <BotStatusToggle />
          </div>
          {isOwner && (
            <div className="pt-5 sm:pt-0 sm:pl-5">
              <h2 className="mb-3 font-heading text-base font-semibold">
                Usage
              </h2>
              <AiUsageSummary />
            </div>
          )}
        </section>

        <div
          className={cn(
            "grid gap-4 lg:items-start",
            isOwner && "lg:grid-cols-[360px_minmax(0,1fr)]"
          )}
        >
          {isOwner && (
            <section id="usage" className="rounded-lg bg-white p-4 shadow-xs">
              <h2 className="mb-3 font-heading text-base font-semibold">
                Top-up
              </h2>
              <AiUsageTopUp />
            </section>
          )}

          <section id="knowledge" className="rounded-lg bg-white p-5 shadow-xs">
            <KnowledgeBaseSection />
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

export default function AiSettingsPage() {
  return (
    <PermissionGate permission="flows:manage" feature="the AI Assistant">
      <AiSettingsPageContent />
    </PermissionGate>
  );
}
