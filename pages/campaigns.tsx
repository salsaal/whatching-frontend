"use client";

import { Target } from "lucide-react";
import Script from "next/script";
import { useEffect } from "react";

import CampaignsTab from "@/components/analytics/CampaignsTab";
import AdAccountConnection from "@/components/whatsapp/AdAccountConnection";
import AppLayout from "@/layouts/AppLayout";

const facebookGraphVersion =
  process.env.NEXT_PUBLIC_META_GRAPH_VERSION || "v20.0";
const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID;

export default function CampaignsPage() {
  // AdAccountConnection's Meta login only needs window.FB to exist by the
  // time it's clicked -- no readiness state to track here, unlike the
  // embedded signup flow on the overview page.
  useEffect(() => {
    if (!metaAppId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: metaAppId,
        autoLogAppEvents: true,
        xfbml: true,
        version: facebookGraphVersion
      });
    };

    if (window.FB) {
      window.fbAsyncInit();
    }
  }, []);

  return (
    <AppLayout>
      {metaAppId && (
        <Script
          id="facebook-jssdk"
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
        />
      )}
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

        <AdAccountConnection />
        <CampaignsTab />
      </div>
    </AppLayout>
  );
}
