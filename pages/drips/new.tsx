"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";

import { PermissionGate } from "@/components/common/NoAccess";
import { DripBuilder } from "@/components/drips/DripBuilder";
import { DripPlanNotice } from "@/components/drips/DripIntro";
import AppLayout from "@/layouts/AppLayout";
import { useOrganizationStore } from "@/stores/organizationStore";

function NewDripContent() {
  const router = useRouter();
  const hasPlan = useOrganizationStore(
    (state) => (state.activeOrganization?.planTier || "none") !== "none"
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href="/drips"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Drip campaigns
        </Link>
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <h1 className="font-heading text-2xl font-semibold">New drip</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Set up the messages and the wait before each one. Next, you choose
            who joins and when it starts.
          </p>
        </section>
        {hasPlan ? (
          <DripBuilder
            onSaved={(drip, intent) =>
              router.replace(
                `/drips/${drip.id}${intent === "next" ? "?start=1" : ""}`
              )
            }
          />
        ) : (
          <DripPlanNotice />
        )}
      </div>
    </AppLayout>
  );
}

export default function NewDripPage() {
  return (
    <PermissionGate permission="broadcasts:manage" feature="Drip campaigns">
      <NewDripContent />
    </PermissionGate>
  );
}
