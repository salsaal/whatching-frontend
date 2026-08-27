import { Target } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listCampaigns } from "@/client-api/functions/campaigns";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";

const numberFormat = new Intl.NumberFormat("en-IN");

export default function CampaignsTab() {
  const [sort, setSort] = useState<"recent" | "leads">("recent");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaigns", sort],
    queryFn: () => listCampaigns({ sort, limit: 50 })
  });

  const campaigns = data?.data.campaigns || [];

  return (
    <section className="rounded-lg bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">
          Click-to-WhatsApp campaigns
        </h2>
        <div className="flex rounded-sm bg-muted p-1">
          <Button
            type="button"
            size="sm"
            variant={sort === "recent" ? "default" : "ghost"}
            onClick={() => setSort("recent")}
          >
            Recent
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sort === "leads" ? "default" : "ghost"}
            onClick={() => setSort("leads")}
          >
            Most leads
          </Button>
        </div>
      </div>

      {isError && (
        <QueryErrorState message="Campaigns could not be loaded for this organisation." />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : campaigns.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-primary">
                <th className="p-3">Campaign</th>
                <th className="p-3">Type</th>
                <th className="p-3">Contacts</th>
                <th className="p-3">Touches</th>
                <th className="p-3 text-right">Last touch</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.sourceId} className="border-t">
                  <td className="p-3 font-medium">{campaign.label}</td>
                  <td className="p-3 capitalize">{campaign.sourceType}</td>
                  <td className="p-3">
                    {numberFormat.format(campaign.subscriberCount)}
                  </td>
                  <td className="p-3">
                    {numberFormat.format(campaign.touchCount)}
                  </td>
                  <td className="p-3 text-right">
                    {new Date(campaign.lastTouchAt).toLocaleDateString(
                      "en-IN"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="No campaigns detected yet"
          description="Click-to-WhatsApp campaigns appear here once ads start driving contacts into your inbox."
        />
      )}
    </section>
  );
}
