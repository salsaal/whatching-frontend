"use client";

import { Loader2, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateOrganizationSettings } from "@/client-api/functions/organizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { SettingsBackLink } from "@/components/settings/SettingsBackLink";
import AppLayout from "@/layouts/AppLayout";
import { formatTimezoneOption } from "@/lib/displayFormat";
import Link from "next/link";
import { useOrganizationStore } from "@/stores/organizationStore";

const curatedTimezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Asia/Colombo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC"
];

export default function GeneralSettingsPage() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const upsertOrganization = useOrganizationStore(
    (state) => state.upsertOrganization
  );

  const [timezone, setTimezone] = useState(
    activeOrganization?.timezone || "Asia/Kolkata"
  );

  const timezones = useMemo(() => {
    let zones = curatedTimezones;
    try {
      const supported = Intl.supportedValuesOf("timeZone");
      if (supported.length) zones = supported;
    } catch {
      // Older browsers: the curated list.
    }
    // The saved zone may be an older name ("Asia/Calcutta") the list
    // doesn't include; keep it selectable.
    const saved = activeOrganization?.timezone;
    if (saved && !zones.includes(saved)) zones = [saved, ...zones];
    return zones.map((zone) => ({
      value: zone,
      label: formatTimezoneOption(zone)
    }));
  }, [activeOrganization?.timezone]);

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: updateOrganizationSettings,
    meta: { showToast: false },
    onSuccess: (res) => {
      upsertOrganization(res.data.organization);
      toast.success("Settings saved.");
    }
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <SettingsBackLink />
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">General</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your organisation&apos;s name and timezone.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
          <div>
            <Label>Organisation name</Label>
            <Input
              value={activeOrganization?.name || ""}
              disabled
              className="mt-2"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              To change the name,{" "}
              <Link
                href="/settings/help"
                className="font-medium text-primary hover:underline"
              >
                contact support
              </Link>
              .
            </p>
          </div>
          <div>
            <Label>Timezone</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for scheduled broadcasts and the days in Analytics.
            </p>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-2 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            disabled={
              isSaving || !timezone || timezone === activeOrganization?.timezone
            }
            onClick={() => saveSettings({ timezone })}
          >
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </section>
      </div>
    </AppLayout>
  );
}
