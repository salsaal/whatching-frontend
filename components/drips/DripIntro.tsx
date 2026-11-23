import { Droplets, ListOrdered, Send, Users, Zap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const HOW_IT_WORKS = [
  {
    icon: ListOrdered,
    title: "Write the messages",
    text: "Pick 2 to 5 approved templates and how long to wait between them."
  },
  {
    icon: Users,
    title: "Choose who joins",
    text: "All contacts, a tag, people you pick, or people who came from an ad."
  },
  {
    icon: Send,
    title: "We send them on time",
    text: "Each person gets the next message when their wait is up, within your sending hours. Anyone who replies or stops offers leaves on their own."
  }
];

/** Three steps explaining what a drip does, for the empty list. */
export function DripHowItWorks({ action }: { action?: React.ReactNode }) {
  return (
    <div className="space-y-6 px-6 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Droplets className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-heading text-lg font-semibold">
            Follow up automatically, one message at a time
          </p>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            A drip is a short series of WhatsApp messages. For example: a
            welcome today, a tip in 2 days, and an offer a week later.
          </p>
        </div>
      </div>
      <ol className="mx-auto grid max-w-4xl gap-3 md:grid-cols-3">
        {HOW_IT_WORKS.map((item, index) => (
          <li key={item.title} className="rounded-lg border bg-muted/30 p-4">
            <span className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <item.icon className="size-4 text-primary" />
              <span className="text-sm font-semibold">{item.title}</span>
            </span>
            <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
          </li>
        ))}
      </ol>
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  );
}

/** Drips need a paid plan (the server says the same if asked). */
export function DripPlanNotice() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
      <Zap className="size-5 shrink-0 text-amber-600" />
      <p className="flex-1 text-sm text-amber-950">
        Drip campaigns come with every paid plan. Choose a plan to create one.
      </p>
      <Button asChild size="sm">
        <Link href="/plans">View plans</Link>
      </Button>
    </section>
  );
}
