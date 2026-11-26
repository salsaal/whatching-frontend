import { BarChart3, MessageSquareReply, Pencil, Target } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getCampaignPerformance,
  listCampaigns,
  updateCampaignSource
} from "@/client-api/functions/campaigns";
import { CampaignSource } from "@/client-api/types/campaigns.type";
import { AdReplyDialog } from "@/components/campaigns/AdReplyDialog";
import { useAdReplyFlows } from "@/components/campaigns/AdReplyChoice";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { adReplyLabel } from "@/lib/adReplies";
import { formatDate } from "@/lib/displayFormat";
import { formatOrderTotal } from "@/lib/store";
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

// The ad's own name: "Campaign · Ad" from Meta, or the name you gave it.
const adName = (campaign: CampaignSource) =>
  campaign.label || campaign.campaignName || "Unnamed ad";

// Only names that might be wrong get a note; a name from Meta, or one set
// in the ad's link, is just the name.
const labelSourceBadge: Record<
  CampaignSource["labelSource"],
  { text: string; className: string } | null
> = {
  meta_api: null,
  ref: null,
  manual: {
    text: "Renamed by you",
    className: "bg-muted text-muted-foreground"
  },
  headline: {
    text: "Name taken from the ad's headline",
    className: "bg-amber-100 text-amber-800"
  },
  fallback: {
    text: "No name yet. Rename it",
    className: "bg-amber-100 text-amber-800"
  }
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  ad: "Ad",
  post: "Post",
  unknown: "Not known"
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
    meta: { showToast: false },
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
            Overrides the guessed label for every contact attributed to this
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

function PerformanceTile({
  label,
  value,
  highlight = false
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight ? "rounded-md bg-primary/5 p-3" : "rounded-md border p-3"
      }
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-heading text-lg font-semibold ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
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
  const currency = performance?.spend?.currency || undefined;
  const money = (amount: number) => formatOrderTotal(String(amount), currency);
  const adsInCampaign = performance?.adsInCampaign || 0;

  return (
    <Dialog
      open={Boolean(campaign)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{campaign ? adName(campaign) : ""}</DialogTitle>
          <DialogDescription>
            Last 30 days. Meta counts ad spend per campaign, so these numbers
            cover every ad in the campaign.
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
        ) : performance ? (
          <div className="space-y-4">
            {performance.scope === "campaign" && (
              <p className="text-sm">
                <span className="text-muted-foreground">Campaign:</span>{" "}
                <span className="font-medium">
                  {performance.campaignName || "Not named"}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({numberFormat.format(adsInCampaign)}{" "}
                  {adsInCampaign === 1 ? "ad" : "ads"})
                </span>
              </p>
            )}

            {performance.spendAvailable && performance.spend ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <PerformanceTile
                  label="Spend"
                  value={money(performance.spend.amount || 0)}
                />
                <PerformanceTile
                  label="Leads"
                  value={numberFormat.format(performance.leadsInRange || 0)}
                />
                <PerformanceTile
                  label="Cost per lead"
                  value={
                    performance.costPerConversation != null
                      ? money(performance.costPerConversation)
                      : "–"
                  }
                  highlight
                />
                <PerformanceTile
                  label="Impressions"
                  value={numberFormat.format(
                    performance.spend.impressions || 0
                  )}
                />
                <PerformanceTile
                  label="Clicks"
                  value={numberFormat.format(performance.spend.clicks || 0)}
                />
                <PerformanceTile
                  label="Reach"
                  value={numberFormat.format(performance.spend.reach || 0)}
                />
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {performance.scope === "campaign"
                  ? "No ad spend for these dates yet."
                  : "We can't see the spend for this ad yet. Connect your Meta ad account at the top of this page; spend shows after the next daily update."}
                {performance.scope === "campaign" &&
                  ` Leads in these dates: ${numberFormat.format(
                    performance.leadsInRange || 0
                  )}.`}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              All-time leads from this ad:{" "}
              {numberFormat.format(performance.touches.subscriberCount)}
            </p>
          </div>
        ) : null}

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
  const [replyCampaign, setReplyCampaign] = useState<CampaignSource | null>(
    null
  );
  // Ad replies are bot work: changing one needs flows:manage.
  const { can } = useCurrentMembership();
  const canManageReplies = can("flows:manage");

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
  const { flows } = useAdReplyFlows(canManageReplies && campaigns.length > 0);

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
                <th className="p-3">Chats started</th>
                <th className="p-3">Latest chat</th>
                {canManageReplies && <th className="p-3">Reply</th>}
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const badge = labelSourceBadge[campaign.labelSource];
                return (
                  <tr key={campaign.sourceId} className="border-t">
                    <td className="max-w-xs p-3">
                      <p className="truncate font-medium">{adName(campaign)}</p>
                      {badge && (
                        <Badge
                          variant="secondary"
                          className={`mt-1 ${badge.className}`}
                        >
                          {badge.text}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      {SOURCE_TYPE_LABELS[campaign.sourceType] ||
                        campaign.sourceType}
                    </td>
                    <td className="p-3">
                      {numberFormat.format(campaign.subscriberCount)}
                    </td>
                    <td className="p-3">
                      {numberFormat.format(campaign.touchCount)}
                    </td>
                    <td className="p-3">{formatDate(campaign.lastTouchAt)}</td>
                    {canManageReplies && (
                      <td className="p-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="max-w-48 justify-start"
                          onClick={() => setReplyCampaign(campaign)}
                        >
                          <MessageSquareReply className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {adReplyLabel(campaign.reply, flows)}
                          </span>
                        </Button>
                      </td>
                    )}
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
        key={editingCampaign?._id || "none"}
        campaign={editingCampaign}
        onOpenChange={(open) => !open && setEditingCampaign(null)}
      />
      <CampaignPerformanceDialog
        campaign={performanceCampaign}
        onOpenChange={(open) => !open && setPerformanceCampaign(null)}
      />
      {canManageReplies && (
        <AdReplyDialog
          campaign={replyCampaign}
          onOpenChange={(open) => !open && setReplyCampaign(null)}
        />
      )}
    </section>
  );
}
