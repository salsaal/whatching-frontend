"use client";

import {
  Check,
  Clock3,
  CreditCard,
  Rocket,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useRouter } from "next/router";
import type { ElementType } from "react";

import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/AppLayout";
import {
  buildPlanAction,
  formatDate,
  isSubscriptionCanceledWithAccess,
  plans,
  PlanDefinition
} from "@/lib/billing";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

const iconByPlan: Record<PlanDefinition["id"], ElementType> = {
  basic: Zap,
  pro: Rocket,
  enterprise: CreditCard
};

export default function PlansPage() {
  const router = useRouter();
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const currentPlan = activeOrganization?.planTier || "none";
  const isTrialing = activeOrganization?.subscriptionStatus === "trialing";
  const canceledWithAccess =
    isSubscriptionCanceledWithAccess(activeOrganization);

  const openCheckout = (plan: PlanDefinition) => {
    if (plan.id === "enterprise") {
      router.push({
        pathname: "/settings/help",
        query: {
          category: "billing",
          subject: "Enterprise plan enquiry"
        }
      });
      return;
    }

    router.push({
      pathname: "/checkout",
      query: { tier: plan.id }
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">Plans</p>
              <h1 className="mt-1 font-heading text-3xl font-semibold">
                Choose Whatching plan
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Review subscriber limits, team access, automation features, GST,
                and checkout requirements before starting or changing a plan.
              </p>
            </div>
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">Current plan</p>
              <p className="mt-1 font-heading font-semibold uppercase">
                {currentPlan === "none" ? "No plan" : currentPlan}
                {isTrialing ? " trial" : ""}
              </p>
            </div>
          </div>
        </section>

        {canceledWithAccess && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p>
                Your current subscription is cancelled and remains usable until{" "}
                <span className="font-semibold">
                  {formatDate(activeOrganization?.subscriptionCurrentPeriodEnd)}
                </span>
                . Backend billing prevents starting another paid subscription
                before this period ends.
              </p>
            </div>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const Icon = iconByPlan[plan.id];
            const action = buildPlanAction(plan, activeOrganization);
            const isCurrentPlan =
              plan.id === currentPlan && !isTrialing && !canceledWithAccess;
            const isBlockedByCancellation =
              canceledWithAccess && plan.id !== "enterprise";

            return (
              <article
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-lg bg-white p-6 shadow-xs",
                  plan.highlighted && !isCurrentPlan && "bg-emerald-50",
                  isCurrentPlan && "bg-primary/10 ring-1 ring-primary/20"
                )}
              >
                <div>
                  <div className="mb-4 flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="font-heading text-xl font-semibold">
                    {plan.name}
                  </h2>
                  <p className="mt-2 min-h-10 text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                  <p className="mt-6 font-heading text-3xl font-semibold">
                    {plan.priceLabel}
                    {plan.monthlyPrice ? (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        /month
                      </span>
                    ) : null}
                  </p>
                  {plan.monthlyPrice ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      GST is calculated on the checkout page.
                    </p>
                  ) : null}
                </div>

                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  className="mt-6 w-full"
                  disabled={isCurrentPlan || isBlockedByCancellation}
                  onClick={() => openCheckout(plan)}
                >
                  {isCurrentPlan
                    ? "Current plan"
                    : isBlockedByCancellation
                      ? "Available after period ends"
                      : action.label}
                </Button>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.comingSoon?.length ? (
                  <div className="mt-5 border-t pt-5">
                    <p className="mb-3 text-sm font-semibold">
                      Coming Pretty Soon
                    </p>
                    <ul className="space-y-3">
                      {plan.comingSoon.map((feature) => (
                        <li key={feature} className="flex gap-2 text-sm">
                          <Clock3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      </div>
    </AppLayout>
  );
}
