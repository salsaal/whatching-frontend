import { BarChart3, Pencil, Target } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getCampaignPerformance,
  listCampaigns,
  updateCampaignSource
} from "@/client-api/functions/campaigns";
import { CampaignSource } from "@/client-api/types/campaigns.type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { QueryErrorState } from "@/components/shared/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";

const numberFormat = new Intl.NumberFormat("en-IN");
const decimalFormat = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const labelSourceBadge: Record<
  CampaignSource["labelSource"],
  { text: string; className: string }
> = {
  meta_api: {
    text: "Ads Manager name",
    className: "bg-primary/10 text-primary"
  },
  ref: { text: "From ref tag", className: "bg-primary/10 text-primary" },
  manual: { text: "Manually set", className: "bg-muted text-muted-foreground" },
  headline: {
    text: "Guessed (headline)",
    className: "bg-amber-100 text-amber-800"
  },
  fallback: {
    text: "Guessed (fallback)",
    className: "bg-amber-100 text-amber-800"
  }
};

function EditCampaignLabelDialog({
  campaign,
  onOpenChange
}: {
  campaign: CampaignSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(campaign?.label || "");

  const { mutate: saveLabel, isPending } = useMutation({
    mutationFn: updateCampaignSource,
    onSuccess: () => {
      toast.success("Campaign name updated.");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Couldn't update the campaign name.")
  });

  return (
    <Dialog
      open={Boolean(campaign)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename campaign</DialogTitle>
          <DialogDescription>
            Overrides the guessed label for every subscriber attributed to this
            source. This can&apos;t be undone automatically.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Campaign name"
          maxLength={300}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!label.trim() || isPending}
            isLoading={isPending}
            onClick={() =>
              campaign &&
              saveLabel({ campaignSourceId: campaign._id, label: label.trim() })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignPerformanceDialog({
  campaign,
  onOpenChange
}: {
  campaign: CampaignSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaign-performance", campaign?._id],
    queryFn: () => getCampaignPerformance(campaign!._id, { range: "30d" }),
    enabled: Boolean(campaign)
  });
  const performance = data?.data;

  return (
    <Dialog
      open={Boolean(campaign)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign?.campaignName || campaign?.label}</DialogTitle>
          <DialogDescription>
            Meta ad spend against your own WhatsApp funnel outcomes, last 30
            days.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : isError ? (
          <QueryErrorState message="Performance could not be loaded for this campaign." />
        ) : !performance?.spendAvailable ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {performance?.message ||
              "Ad spend is not available yet -- connect an ad account and grant ads_read, then it resolves on the next scheduled sync."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Spend</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {decimalFormat.format(performance.spend?.amount || 0)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {numberFormat.format(performance.spend?.impressions || 0)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Clicks</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {numberFormat.format(performance.spend?.clicks || 0)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Reach</p>
                <p className="mt-1 font-heading text-lg font-semibold">
                  {numberFormat.format(performance.spend?.reach || 0)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Cost per conversation
                </p>
                <p className="mt-1 font-heading text-lg font-semibold text-primary">
                  {performance.costPerConversation != null
                    ? decimalFormat.format(performance.costPerConversation)
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {numberFormat.format(performance.touches.subscriberCount)}{" "}
                  contacts from this campaign
                </p>
              </div>
              <div className="rounded-md bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Cost per conversion
                </p>
                <p className="mt-1 font-heading text-lg font-semibold text-primary">
                  {performance.costPerConversion != null
                    ? decimalFormat.format(performance.costPerConversion)
                    : "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {performance.conversions.reduce(
                    (sum, row) => sum + row.subscriberCount,
                    0
                  )}{" "}
                  conversions tagged
                </p>
              </div>
            </div>

            {performance.conversions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Conversions by event
                </p>
                {performance.conversions.map((row) => (
                  <div
                    key={row.eventName}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{row.eventName}</span>
                    <span className="text-muted-foreground">
                      {numberFormat.format(row.subscriberCount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CampaignsTab() {
  const [sort, setSort] = useState<"recent" | "leads">("recent");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<CampaignSource | null>(
    null
  );
  const [performanceCampaign, setPerformanceCampaign] =
    useState<CampaignSource | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["campaigns", sort, needsReviewOnly],
    queryFn: () =>
      listCampaigns({
        sort,
        limit: 50,
        needsReview: needsReviewOnly || undefined
      })
  });

  const campaigns = data?.data.campaigns || [];

  return (
    <section className="rounded-lg bg-white p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Click-to-WhatsApp campaigns
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={needsReviewOnly ? "default" : "outline"}
            onClick={() => setNeedsReviewOnly((current) => !current)}
          >
            Needs review
          </Button>
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
                <th className="p-3">Last touch</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const badge = labelSourceBadge[campaign.labelSource];
                return (
                  <tr key={campaign.sourceId} className="border-t">
                    <td className="max-w-xs p-3">
                      <p className="truncate font-medium">
                        {campaign.campaignName || campaign.label}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`mt-1 ${badge.className}`}
                      >
                        {badge.text}
                      </Badge>
                    </td>
                    <td className="p-3 capitalize">{campaign.sourceType}</td>
                    <td className="p-3">
                      {numberFormat.format(campaign.subscriberCount)}
                    </td>
                    <td className="p-3">
                      {numberFormat.format(campaign.touchCount)}
                    </td>
                    <td className="p-3">
                      {new Date(campaign.lastTouchAt).toLocaleDateString(
                        "en-IN"
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          tooltip="Rename campaign"
                          onClick={() => setEditingCampaign(campaign)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          tooltip="View spend & cost-per-outcome"
                          onClick={() => setPerformanceCampaign(campaign)}
                        >
                          <BarChart3 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title={
            needsReviewOnly
              ? "Nothing needs review"
              : "No campaigns detected yet"
          }
          description={
            needsReviewOnly
              ? "Every campaign here already has a trustworthy name."
              : "Click-to-WhatsApp campaigns appear here once ads start driving contacts into your inbox."
          }
        />
      )}

      <EditCampaignLabelDialog
        campaign={editingCampaign}
        onOpenChange={(open) => !open && setEditingCampaign(null)}
      />
      <CampaignPerformanceDialog
        campaign={performanceCampaign}
        onOpenChange={(open) => !open && setPerformanceCampaign(null)}
      />
    </section>
  );
}
