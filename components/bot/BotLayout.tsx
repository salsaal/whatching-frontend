import { Bot } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { PermissionGate } from "@/components/common/NoAccess";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AppLayout from "@/layouts/AppLayout";

export type BotTab = "flows" | "ai" | "knowledge" | "settings";

const tabs: Array<{ value: BotTab; label: string; href: string }> = [
  { value: "flows", label: "Flows", href: "/bot/flows" },
  { value: "ai", label: "AI", href: "/bot/ai" },
  { value: "knowledge", label: "Knowledge", href: "/bot/knowledge" },
  { value: "settings", label: "Settings", href: "/bot/settings" }
];

// Shell for every /bot tab. Each tab is a real link with its own URL, so
// back/refresh keep the user on the same tab. The whole section sits behind
// flows:manage, matching the backend's /bot/* routes.
export default function BotLayout({
  activeTab,
  children
}: {
  activeTab: BotTab;
  children: ReactNode;
}) {
  return (
    <PermissionGate permission="flows:manage" feature="the Bot">
      <AppLayout>
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="rounded-lg bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading text-xl font-semibold">Bot</h1>
                <p className="text-sm text-muted-foreground">
                  Flows, AI replies and automation settings for WhatsApp
                </p>
              </div>
            </div>
            <Tabs value={activeTab} className="mt-4">
              <TabsList>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} asChild>
                    <Link href={tab.href}>{tab.label}</Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </section>
          {children}
        </div>
      </AppLayout>
    </PermissionGate>
  );
}
