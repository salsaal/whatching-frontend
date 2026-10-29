"use client";

import {
  ArrowRight,
  Building2,
  CreditCard,
  MessageCircle,
  Plug,
  Plus,
  Smartphone,
  Users
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getMyOrganizations,
  setupOrganization
} from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { UserMenu } from "@/components/account/UserMenu";
import { Input } from "@/components/ui/input";
import { CardGridLoadingSkeleton } from "@/components/ui/loading-skeletons";
import assets from "@/json/assets";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { Organization, useOrganizationStore } from "@/stores/organizationStore";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(date));

const roleLabel: Record<NonNullable<Organization["myRole"]>, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agent"
};

function Chip({
  dot,
  children
}: {
  dot?: "green" | "grey" | "amber";
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium">
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            dot === "green" && "bg-emerald-500",
            dot === "grey" && "bg-slate-400",
            dot === "amber" && "bg-amber-500"
          )}
        />
      )}
      {children}
    </span>
  );
}

const relativeTime = (value?: string | null) => {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};

// Only owners can start Meta's signup; the overview's ?connectMeta=1 opens
// it straight away.
const setupPathFor = (organization: Organization) =>
  organization.myRole === "owner" ? "/overview?connectMeta=1" : "/overview";

const isOrgConnected = (organization: Organization) =>
  organization.metaConfig?.status === "ready";
const hasOrgPlan = (organization: Organization) =>
  Boolean(organization.planTier) && organization.planTier !== "none";

const greetingFor = (hour: number | null) =>
  hour === null
    ? "Hello"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

const plural = (count: number, word: string) =>
  `${count.toLocaleString("en-IN")} ${word}${count === 1 ? "" : "s"}`;

type AttentionItem = {
  key: string;
  kind: "setup" | "unread";
  icon: React.ElementType;
  text: string;
  action: string;
  organization: Organization;
  path: string;
  unread: number;
};

function SummaryTile({
  icon: Icon,
  label,
  value,
  onClick
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block font-heading text-2xl font-semibold">
          {value.toLocaleString("en-IN")}
        </span>
      </span>
    </>
  );
  const className =
    "flex items-center gap-3 rounded-lg bg-white p-4 text-left shadow-xs";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        className,
        "cursor-pointer transition hover:shadow-md hover:ring-1 hover:ring-primary/30"
      )}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

const lastMessageTime = (organization: Organization) => {
  const value = organization.usage?.lastMessageAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

function Stat({
  label,
  value,
  highlight,
  onClick
}: {
  label: string;
  value: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "block truncate text-sm font-semibold",
          highlight && "text-emerald-700"
        )}
      >
        {value}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={(event) => {
        // The whole card opens the org; this opens its inbox instead.
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "min-w-0 cursor-pointer rounded-md px-2 py-1.5 text-left transition hover:bg-muted",
        highlight && "bg-emerald-50 hover:bg-emerald-100"
      )}
    >
      {content}
    </button>
  ) : (
    <div className="min-w-0 px-2 py-1.5">{content}</div>
  );
}

function OrganisationCard({
  organization,
  isLastOpened,
  onOpen
}: {
  organization: Organization;
  isLastOpened: boolean;
  /** Opens the org, optionally on a specific page. */
  onOpen: (path?: string) => void;
}) {
  const isConnected = isOrgConnected(organization);
  const hasPlan = hasOrgPlan(organization);
  const numberCount = organization.activePhoneNumberCount || 0;
  const displayNumber = organization.metaConfig?.displayPhoneNumber;
  const unread = organization.unreadConversationCount || 0;
  const lastMessage = relativeTime(organization.usage?.lastMessageAt);
  // Only owners can start Meta's signup; the overview's ?connectMeta=1
  // opens it straight away.
  const setupPath = setupPathFor(organization);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => onOpen()}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full w-full cursor-pointer flex-col rounded-lg border border-transparent bg-white p-5 text-left shadow-xs transition hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate font-heading text-lg font-semibold group-hover:text-primary">
          {organization.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {isLastOpened && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              Last opened
            </span>
          )}
          {organization.myRole && (
            <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {roleLabel[organization.myRole]}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip dot={isConnected ? "green" : "grey"}>
          {isConnected ? "Connected" : "Not connected"}
        </Chip>
        {hasPlan ? (
          <Chip>{organization.planTier.toUpperCase()}</Chip>
        ) : (
          <Chip dot="amber">No plan</Chip>
        )}
        {numberCount > 0 && (
          <Chip>
            {numberCount} number{numberCount === 1 ? "" : "s"}
          </Chip>
        )}
      </div>

      {isConnected && hasPlan ? (
        <div className="mt-4 grid grid-cols-3 gap-1 border-t pt-3">
          <Stat
            label="Contacts"
            value={(organization.usage?.subscribersCount || 0).toLocaleString(
              "en-IN"
            )}
          />
          <Stat
            label="Unread"
            value={unread.toLocaleString("en-IN")}
            highlight={unread > 0}
            onClick={() => onOpen("/conversations")}
          />
          <Stat label="Last message" value={lastMessage || "No messages yet"} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          {!isConnected && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(setupPath);
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
            >
              Finish setup
              <ArrowRight className="size-3.5" />
            </button>
          )}
          {!hasPlan && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen("/plans");
              }}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              Choose a plan
              <ArrowRight className="size-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {displayNumber || ""}
        </span>
        <span className="shrink-0">
          Created {formatDate(organization.createdAt)}
        </span>
      </div>
    </div>
  );
}

function Organisations() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const user = useAuthStore((state) => state.user);
  const {
    organizations,
    activeOrganization,
    setOrganizations,
    addOrganization,
    setActiveOrganization
  } = useOrganizationStore();

  const { data: organizationsData, isLoading } = useQuery({
    queryKey: ["organizations", user?._id],
    queryFn: getMyOrganizations,
    enabled: Boolean(user?._id)
  });

  const { mutate: createOrganization, isPending: isCreating } = useMutation({
    mutationFn: setupOrganization,
    onSuccess: (data) => {
      addOrganization(data.data.organization);
      setName("");
      setIsCreateOpen(false);
      toast.success("Organisation created");
    }
  });

  const handleOpen = (organization: Organization, path = "/overview") => {
    setActiveOrganization(organization);
    queryClient.invalidateQueries({ queryKey: ["membership"] });
    router.push(path);
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Organisation name is required");
      return;
    }
    createOrganization({ name: name.trim() });
  };

  useEffect(() => {
    if (organizationsData?.data.organizations) {
      setOrganizations(organizationsData.data.organizations);
    }
  }, [organizationsData, setOrganizations]);

  // Last opened first (the org in the store), then orgs with unread
  // conversations, then everything else by most recent message.
  const lastOpenedId = activeOrganization?._id;
  const sortedOrganizations = useMemo(
    () =>
      [...organizations].sort((a, b) => {
        const lastOpened =
          Number(b._id === lastOpenedId) - Number(a._id === lastOpenedId);
        if (lastOpened) return lastOpened;
        const unread =
          Number((b.unreadConversationCount || 0) > 0) -
          Number((a.unreadConversationCount || 0) > 0);
        if (unread) return unread;
        return lastMessageTime(b) - lastMessageTime(a);
      }),
    [lastOpenedId, organizations]
  );

  // Hour is read after mount so the server render can't disagree with it.
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";

  const totals = useMemo(() => {
    let busiest: Organization | null = null;
    let unread = 0;
    let orgsWithUnread = 0;
    let contacts = 0;
    let numbers = 0;
    organizations.forEach((organization) => {
      const count = organization.unreadConversationCount || 0;
      unread += count;
      if (count > 0) orgsWithUnread += 1;
      if (count > (busiest?.unreadConversationCount || 0))
        busiest = organization;
      contacts += organization.usage?.subscribersCount || 0;
      numbers += organization.activePhoneNumberCount || 0;
    });
    return { unread, orgsWithUnread, contacts, numbers, busiest } as {
      unread: number;
      orgsWithUnread: number;
      contacts: number;
      numbers: number;
      busiest: Organization | null;
    };
  }, [organizations]);

  // Setup problems first, then the busiest inboxes; five rows at most.
  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = [];
    organizations.forEach((organization) => {
      if (!isOrgConnected(organization)) {
        items.push({
          key: `${organization._id}:connect`,
          kind: "setup",
          icon: Plug,
          text: `${organization.name} isn't connected to WhatsApp yet.`,
          action: "Finish setup",
          organization,
          path: setupPathFor(organization),
          unread: 0
        });
      }
      if (!hasOrgPlan(organization)) {
        items.push({
          key: `${organization._id}:plan`,
          kind: "setup",
          icon: CreditCard,
          text: `${organization.name} has no active plan.`,
          action: "Choose a plan",
          organization,
          path: "/plans",
          unread: 0
        });
      }
      const unread = organization.unreadConversationCount || 0;
      if (unread > 0) {
        items.push({
          key: `${organization._id}:unread`,
          kind: "unread",
          icon: MessageCircle,
          text: `${organization.name} has ${plural(unread, "unread conversation")}.`,
          action: "Open inbox",
          organization,
          path: "/conversations",
          unread
        });
      }
    });
    return items
      .sort((a, b) =>
        a.kind === b.kind ? b.unread - a.unread : a.kind === "setup" ? -1 : 1
      )
      .slice(0, 5);
  }, [organizations]);

  const isCompact = organizations.length <= 1 && attentionItems.length === 0;

  const addButton = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus className="size-4" />
      Add organisation
    </Button>
  );

  return (
    <div className="min-h-screen bg-[#f7faf8] text-foreground">
      <header className="sticky top-0 z-20 bg-white/95 shadow-xs backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Image
            src={assets.whatchingLogo}
            alt="Whatching"
            width={150}
            height={42}
          />

          <UserMenu />
        </div>
      </header>

      <main
        className={cn(
          "mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6",
          // One org and nothing to act on: centre the column so the page
          // isn't top-heavy.
          isCompact &&
            "flex min-h-[calc(100vh-4.5rem)] flex-col justify-center space-y-0 gap-6"
        )}
      >
        <section
          className="relative overflow-hidden rounded-2xl px-6 py-12 shadow-xs sm:px-10"
          style={{
            backgroundImage:
              // Dot pattern over a soft green wash; both are background
              // images, so they're layered in one declaration.
              "radial-gradient(rgba(16,185,129,0.12) 1px, transparent 1px), linear-gradient(135deg, #ecfdf5 0%, #ffffff 50%, rgba(209,250,229,0.7) 100%)",
            backgroundSize: "18px 18px, 100% 100%"
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
                {greetingFor(hour)}, {firstName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                {isLoading
                  ? "Loading your organisations…"
                  : !organizations.length
                    ? "Let's set up your first organisation."
                    : totals.unread > 0
                      ? `You have ${plural(totals.unread, "unread conversation")} across ${plural(totals.orgsWithUnread, "organisation")}.`
                      : "All caught up. No unread conversations."}
              </p>
            </div>
            <div className="shrink-0">{addButton}</div>
          </div>
        </section>

        {isLoading ? (
          <CardGridLoadingSkeleton count={4} />
        ) : sortedOrganizations.length ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <SummaryTile
                icon={MessageCircle}
                label="Unread conversations"
                value={totals.unread}
                onClick={
                  totals.busiest
                    ? () => handleOpen(totals.busiest!, "/conversations")
                    : undefined
                }
              />
              <SummaryTile
                icon={Users}
                label="Contacts"
                value={totals.contacts}
              />
              <SummaryTile
                icon={Smartphone}
                label="WhatsApp numbers"
                value={totals.numbers}
              />
            </section>

            {attentionItems.length > 0 && (
              <section className="rounded-lg bg-white p-5 shadow-xs">
                <h2 className="font-heading text-base font-semibold">
                  Needs attention
                </h2>
                <ul className="mt-3 divide-y">
                  {attentionItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={item.key}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full",
                            item.kind === "setup"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <p className="min-w-0 flex-1 text-sm">{item.text}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() =>
                            handleOpen(item.organization, item.path)
                          }
                        >
                          {item.action}
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-2 font-heading text-xl font-semibold">
                Your organisations
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {sortedOrganizations.length}
                </span>
              </h2>
              <div
                className={cn(
                  "grid gap-4 sm:grid-cols-2",
                  sortedOrganizations.length > 4 && "lg:grid-cols-3"
                )}
              >
                {sortedOrganizations.map((organization) => (
                  <OrganisationCard
                    key={organization._id}
                    organization={organization}
                    isLastOpened={organization._id === lastOpenedId}
                    onOpen={(path) => handleOpen(organization, path)}
                  />
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-lg bg-white px-6 py-12 text-center shadow-xs">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="size-7" />
            </div>
            <h2 className="mt-5 font-heading text-2xl font-semibold">
              Create your first organisation
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              An organisation is your workspace: WhatsApp numbers, contacts,
              flows and billing live inside it.
            </p>
            <div className="mt-6">{addButton}</div>
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organisation</DialogTitle>
            <DialogDescription>
              Start with a name. You can connect WhatsApp Business API after
              entering the workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Organisation name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Support"
                autoFocus
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isCreating}>
                <Plus className="size-4" />
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Organisations;
