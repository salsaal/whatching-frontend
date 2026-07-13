"use client";

import { CreditCard, Settings, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import AppLayout from "@/layouts/AppLayout";

const settingsLinks = [
  {
    href: "/settings/agents",
    title: "Agents",
    description:
      "Invite staff, manage team access, and prepare agents for inbox assignment.",
    icon: UsersRound,
    badge: "Team"
  },
  {
    href: "/settings/billing",
    title: "Billing",
    description:
      "Review billing activity, subscription status, and cancellation controls.",
    icon: CreditCard,
    badge: "Plan"
  }
];

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <Settings className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">
                Workspace settings
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage team access and commercial settings from one place.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {settingsLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Card className="h-full rounded-lg transition hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex h-full gap-4 p-5">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-heading text-xl font-semibold">
                          {item.title}
                        </h2>
                        <Badge variant="secondary">{item.badge}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>

        <section className="rounded-lg border border-dashed bg-muted/30 p-5">
          <div className="flex gap-3">
            <UserPlus className="mt-0.5 size-5 text-primary" />
            <div>
              <p className="font-medium">Agent assignment starts here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add agents first, then assign conversations to them from the new
                Conversations inbox.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
