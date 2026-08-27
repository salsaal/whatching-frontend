"use client";

import { Target } from "lucide-react";

import CampaignsTab from "@/components/analytics/CampaignsTab";
import AppLayout from "@/layouts/AppLayout";

export default function CampaignsPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex items-center gap-3 rounded-lg bg-white p-5 shadow-xs">
          <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <Target className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Campaigns</p>
            <h1 className="font-heading text-3xl font-semibold">
              Click-to-WhatsApp campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ad-driven contacts and leads, attributed by campaign.
            </p>
          </div>
        </section>

        <CampaignsTab />
      </div>
    </AppLayout>
  );
}
