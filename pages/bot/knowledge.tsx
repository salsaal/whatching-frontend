"use client";

import BotLayout from "@/components/bot/BotLayout";
import { KnowledgeBaseSection } from "@/components/settings/KnowledgeBaseSection";

export default function BotKnowledgePage() {
  return (
    <BotLayout activeTab="knowledge">
      <section className="rounded-lg bg-white p-5 shadow-xs">
        <KnowledgeBaseSection />
      </section>
    </BotLayout>
  );
}
