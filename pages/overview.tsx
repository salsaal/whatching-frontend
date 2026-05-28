import { Bot, MessageSquareText, Send, Users, Wallet } from "lucide-react";

import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

export default function OverviewPage() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );

  const stats = [
    {
      label: "Subscribers",
      value: activeOrganization?.usage?.subscribersCount || 0,
      icon: Users
    },
    {
      label: "AI tokens used",
      value: activeOrganization?.usage?.aiTokensUsed || 0,
      icon: Bot
    },
    {
      label: "Wallet balance",
      value: `Rs. ${activeOrganization?.walletBalance || 0}`,
      icon: Wallet
    },
    {
      label: "Templates queued",
      value: 0,
      icon: Send
    }
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Overview</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold">
                {activeOrganization?.name || "Organisation overview"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Track your WhatsApp workspace activity, usage, wallet, and setup
                progress.
              </p>
            </div>
            <div className="flex size-14 items-center justify-center rounded-sm bg-primary/10">
              <MessageSquareText className="size-7 text-primary" />
            </div>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-lg border bg-white p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-2 font-heading text-2xl font-semibold">
                      {stat.value}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-lg border bg-white p-6 shadow-xs">
            <h2 className="font-heading text-xl font-semibold">
              Setup checklist
            </h2>
            <div className="mt-5 space-y-3">
              {[
                "Create organisation",
                "Connect WhatsApp Business API",
                "Sync templates",
                "Import contacts"
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-sm border px-4 py-3"
                >
                  <span className="text-sm font-medium">{item}</span>
                  <span
                    className={
                      index === 0 ? "text-primary" : "text-muted-foreground"
                    }
                  >
                    {index === 0 ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-6 shadow-xs">
            <h2 className="font-heading text-xl font-semibold">
              WhatsApp number
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              {activeOrganization?.metaConfig?.displayPhoneNumber ||
                "No number connected yet."}
            </p>
            <div className="mt-6 rounded-sm bg-emerald-50 p-4 text-sm text-emerald-900">
              Connect your WhatsApp Business API to start sending template
              messages from this workspace.
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
