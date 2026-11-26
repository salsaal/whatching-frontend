import { MessageSquareReply } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AdReplyChoice,
  useAdReplyFlows
} from "@/components/campaigns/AdReplyChoice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBotSettings } from "@/hooks/useBotSettings";
import {
  AdReplyDraft,
  adReplyProblem,
  draftFromAllAds,
  draftToSetting,
  sameDraft
} from "@/lib/adReplies";
import { AdReplySetting } from "@/client-api/types/campaigns.type";

/**
 * "Reply to people from your ads": the reply every ad uses unless it has
 * its own. Shown to people who can manage the bot (flows:manage).
 */
export function AdReplyCard() {
  const { settings, isLoading, isUpdating, updateSettings } = useBotSettings();
  const saved = useMemo(
    () => draftFromAllAds(settings?.adReply),
    [settings?.adReply]
  );
  const [draft, setDraft] = useState<AdReplyDraft>(saved);
  const [showProblem, setShowProblem] = useState(false);
  const { flows, isLoading: flowsLoading } = useAdReplyFlows(true);

  useEffect(() => {
    setDraft(saved);
    setShowProblem(false);
  }, [saved]);

  const problem = adReplyProblem(draft);
  const changed = !sameDraft(draft, saved);

  const save = () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    updateSettings(
      { adReply: draftToSetting(draft) as AdReplySetting },
      { onSuccess: () => toast.success("Ad reply saved.") }
    );
  };

  return (
    <section className="rounded-lg bg-white p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
          <MessageSquareReply className="size-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">
            Reply to people from your ads
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We answer the first message someone sends after tapping your ad.
            After that, your bot and team carry on as usual. New ads use this
            until you set a reply for them.
          </p>
        </div>
      </div>

      <div className="mt-4 max-w-2xl space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        ) : (
          <AdReplyChoice
            value={draft}
            onChange={(next) => {
              setDraft(next);
              setShowProblem(false);
            }}
            flows={flows}
            flowsLoading={flowsLoading}
            disabled={isUpdating}
            problem={showProblem ? problem : ""}
            idPrefix="all-ads-reply"
          />
        )}

        {settings?.isBotEnabled === false && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Your bot is off, so ads get no automatic reply. Turn it on in{" "}
            <Link
              href="/bot/settings"
              className="font-medium underline underline-offset-2"
            >
              Bot settings
            </Link>
            .
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={isLoading || !changed || isUpdating}
            isLoading={isUpdating}
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
