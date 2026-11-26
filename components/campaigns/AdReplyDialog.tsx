import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateCampaignSource } from "@/client-api/functions/campaigns";
import {
  AdSourceReplySetting,
  CampaignSource
} from "@/client-api/types/campaigns.type";
import {
  AdReplyChoice,
  useAdReplyFlows
} from "@/components/campaigns/AdReplyChoice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  AdReplyDraft,
  adReplyProblem,
  draftFromAd,
  draftToSetting,
  sameDraft
} from "@/lib/adReplies";

/** One ad's own reply, or "Same as all ads". */
export function AdReplyDialog({
  campaign,
  onOpenChange
}: {
  campaign: CampaignSource | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AdReplyDraft>(() =>
    draftFromAd(campaign?.reply)
  );
  const [showProblem, setShowProblem] = useState(false);
  const { flows, isLoading: flowsLoading } = useAdReplyFlows(Boolean(campaign));

  useEffect(() => {
    setDraft(draftFromAd(campaign?.reply));
    setShowProblem(false);
  }, [campaign]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: updateCampaignSource,
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Reply saved.");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onOpenChange(false);
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      toast.error(
        error.response?.data?.message ||
          "The reply couldn't be saved. Please try again."
      )
  });

  const problem = adReplyProblem(draft);
  const changed = !sameDraft(draft, draftFromAd(campaign?.reply));

  return (
    <Dialog
      open={Boolean(campaign)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reply to people from this ad</DialogTitle>
          <DialogDescription>
            {campaign?.label || campaign?.campaignName || "This ad"}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <AdReplyChoice
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setShowProblem(false);
            }}
            flows={flows}
            flowsLoading={flowsLoading}
            withDefault
            disabled={isPending}
            problem={showProblem ? problem : ""}
            idPrefix={`ad-reply-${campaign?._id || "none"}`}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!changed || isPending}
            isLoading={isPending}
            onClick={() => {
              if (!campaign) return;
              if (problem) {
                setShowProblem(true);
                return;
              }
              save({
                campaignSourceId: campaign._id,
                reply: draftToSetting(draft) as AdSourceReplySetting
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
