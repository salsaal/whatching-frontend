"use client";

import { AiFallbackSwitch } from "@/components/bot/BotSwitches";
import BotLayout from "@/components/bot/BotLayout";
import { AiUsageSummary } from "@/components/settings/AiUsageSummary";
import { AiUsageTopUp } from "@/components/settings/AiUsageTopUp";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";

function BotAiTab() {
  // Token usage and top-ups are owner-only on the backend; everyone else
  // with Bot access just gets the AI fallback switch.
  const { isOwner } = useCurrentMembership();

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-white p-4 shadow-xs">
        <h2 className="mb-3 font-heading text-base font-semibold">
          AI replies
        </h2>
        <AiFallbackSwitch />
      </section>

      {isOwner && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <section className="rounded-lg bg-white p-4 shadow-xs">
            <h2 className="mb-3 font-heading text-base font-semibold">Usage</h2>
            <AiUsageSummary />
          </section>
          <section id="usage" className="rounded-lg bg-white p-4 shadow-xs">
            <h2 className="mb-3 font-heading text-base font-semibold">
              Top-up
            </h2>
            <AiUsageTopUp />
          </section>
        </div>
      )}
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
