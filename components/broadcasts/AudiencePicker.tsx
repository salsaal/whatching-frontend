import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { listCampaigns } from "@/client-api/functions/campaigns";
import { getAllSubscribers, getTags } from "@/client-api/functions/subscribers";
import { BroadcastAudience } from "@/client-api/types/broadcasts.type";
import { Subscriber } from "@/client-api/types/subscribers.type";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { formatCount } from "@/lib/displayFormat";
import { whatsappContactLine, whatsappContactName } from "@/lib/inbox";
import { cn } from "@/lib/utils";

export const EMPTY_AUDIENCE: BroadcastAudience = {
  mode: "all",
  tags: [],
  tagMatch: "any",
  subscriberIds: [],
  campaignSourceIds: []
};

/**
 * What the audience picker lists: tags, ad campaigns and a searchable page
 * of contacts. Loaded only for the mode in use.
 */
export function useAudienceSources(
  audience: BroadcastAudience,
  enabled: boolean
) {
  const { can } = useCurrentMembership();
  const [contactSearch, setContactSearch] = useState("");

  const { data: tagsData } = useQuery({
    queryKey: ["subscriber-tags"],
    queryFn: getTags,
    enabled: enabled && audience.mode === "tags"
  });
  const { data: campaignsData } = useQuery({
    queryKey: ["campaigns", "broadcast-audience"],
    queryFn: () => listCampaigns({ sort: "recent", limit: 100 }),
    enabled: enabled && audience.mode === "campaign" && can("contacts:view")
  });
  const {
    data: contactsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ["broadcast-subscribers", contactSearch],
    queryFn: ({ pageParam }) =>
      getAllSubscribers({
        channel: "whatsapp",
        page: pageParam,
        limit: 50,
        q: contactSearch,
        broadcastEligibility: "eligible"
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    enabled: enabled && audience.mode === "specific" && can("contacts:view")
  });
  const contacts = useMemo(
    () =>
      Array.from(
        new Map(
          (contactsData?.pages || [])
            .flatMap((page) => page.data.subscribers || [])
            .map((contact) => [contact._id, contact])
        ).values()
      ),
    [contactsData?.pages]
  );

  return {
    tags: tagsData?.data.tags || [],
    campaigns: campaignsData?.data.campaigns || [],
    contacts,
    contactSearch,
    setContactSearch,
    fetchMoreContacts: fetchNextPage,
    hasMoreContacts: hasNextPage,
    isFetchingMoreContacts: isFetchingNextPage
  };
}

export type AudienceSources = ReturnType<typeof useAudienceSources>;

const toggleInList = (list: string[] = [], value: string) =>
  list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];

const contactName = (contact: Subscriber) => whatsappContactName(contact);

/**
 * All contacts / By tags / Specific contacts / Campaign. Shared by the
 * broadcast wizard and the drip start and add-people dialogs.
 */
export function AudiencePicker({
  audience,
  onChange,
  sources,
  campaignLabel = "Campaign",
  campaignEmptyText = "No campaigns found."
}: {
  audience: BroadcastAudience;
  onChange: (update: (current: BroadcastAudience) => BroadcastAudience) => void;
  sources: AudienceSources;
  campaignLabel?: string;
  campaignEmptyText?: string;
}) {
  const {
    tags,
    campaigns,
    contacts,
    contactSearch,
    setContactSearch,
    fetchMoreContacts,
    hasMoreContacts,
    isFetchingMoreContacts
  } = sources;

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Audience"
        className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 sm:grid-cols-4"
      >
        {(
          [
            ["all", "All contacts"],
            ["tags", "By tags"],
            ["specific", "Specific contacts"],
            ["campaign", campaignLabel]
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={audience.mode === mode}
            onClick={() => onChange((current) => ({ ...current, mode }))}
            className={cn(
              "cursor-pointer rounded-sm px-2 py-2 text-sm font-medium transition",
              audience.mode === mode
                ? "bg-white text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {audience.mode === "tags" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const isOn = audience.tags?.includes(tag.name);
              return (
                <button
                  key={tag.name}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() =>
                    onChange((current) => ({
                      ...current,
                      tags: toggleInList(current.tags, tag.name)
                    }))
                  }
                  className={cn(
                    "cursor-pointer rounded-full border px-3 py-1 text-sm transition",
                    isOn
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-white hover:border-primary/40"
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
            {!tags.length && (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Match</span>
            {(["any", "all"] as const).map((match) => (
              <button
                key={match}
                type="button"
                aria-pressed={audience.tagMatch === match}
                onClick={() =>
                  onChange((current) => ({ ...current, tagMatch: match }))
                }
                className={cn(
                  "cursor-pointer rounded-sm px-2.5 py-1 font-medium",
                  audience.tagMatch === match
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {match === "any" ? "Any tag" : "All tags"}
              </button>
            ))}
          </div>
        </div>
      )}

      {audience.mode === "specific" && (
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 border-b p-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search name or phone"
                className="h-9 pl-9"
              />
            </div>
            <span className="shrink-0 px-2 text-xs text-muted-foreground">
              {audience.subscriberIds?.length || 0} selected
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {contacts.map((contact) => (
              <label
                key={contact._id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
              >
                <Checkbox
                  checked={audience.subscriberIds?.includes(contact._id)}
                  onCheckedChange={() =>
                    onChange((current) => ({
                      ...current,
                      subscriberIds: toggleInList(
                        current.subscriberIds,
                        contact._id
                      )
                    }))
                  }
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {contactName(contact)}
                  </span>
                  {whatsappContactLine(contact) &&
                    whatsappContactLine(contact) !== contactName(contact) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {whatsappContactLine(contact)}
                      </span>
                    )}
                </span>
              </label>
            ))}
            {!contacts.length && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No eligible contacts found.
              </p>
            )}
            {hasMoreContacts && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                isLoading={isFetchingMoreContacts}
                onClick={() => fetchMoreContacts()}
              >
                Load more
              </Button>
            )}
          </div>
        </div>
      )}

      {audience.mode === "campaign" && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
          {campaigns.map((campaign) => (
            <label
              key={campaign.sourceId}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
            >
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={audience.campaignSourceIds?.includes(
                    campaign.sourceId
                  )}
                  onCheckedChange={() =>
                    onChange((current) => ({
                      ...current,
                      campaignSourceIds: toggleInList(
                        current.campaignSourceIds,
                        campaign.sourceId
                      )
                    }))
                  }
                />
                {campaign.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatCount(campaign.subscriberCount)} contacts
              </span>
            </label>
          ))}
          {!campaigns.length && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {campaignEmptyText}
            </p>
          )}
        </div>
      )}
    </>
  );
}
