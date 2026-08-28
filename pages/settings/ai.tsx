"use client";

import { Bot } from "lucide-react";

import { AiUsageTopUp } from "@/components/settings/AiUsageTopUp";
import { BotStatusToggle } from "@/components/settings/BotStatusToggle";
import { KnowledgeBaseSection } from "@/components/settings/KnowledgeBaseSection";
import AppLayout from "@/layouts/AppLayout";

export default function AiSettingsPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Automation</p>
              <h1 className="font-heading text-3xl font-semibold">
                AI Assistant
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Bot status, token usage, top-ups, and the knowledge base it
                answers from — all in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="mb-4 font-heading text-lg font-semibold">Status</h2>
          <BotStatusToggle />
        </section>

        <section id="knowledge" className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Knowledge base
          </h2>
          <KnowledgeBaseSection />
        </section>

        <section id="usage" className="rounded-lg bg-white p-5 shadow-xs">
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Usage &amp; top-up
          </h2>
          <AiUsageTopUp />
        </section>
      </div>
    </AppLayout>
  );
}
