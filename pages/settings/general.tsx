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
import AppLayout from "@/layouts/AppLayout";
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
    try {
      const supported = Intl.supportedValuesOf("timeZone");
      return supported.length ? supported : curatedTimezones;
    } catch {
      return curatedTimezones;
    }
  }, []);

  const { mutate: saveSettings, isPending: isSaving } = useMutation({
    mutationFn: updateOrganizationSettings,
    meta: { showToast: false },
    onSuccess: (res) => {
      upsertOrganization(res.data.organization);
      toast.success("Workspace settings updated.");
    }
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-lg bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-sm bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Settings</p>
              <h1 className="font-heading text-3xl font-semibold">General</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Basic workspace details and timezone.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
          <div>
            <Label>Workspace name</Label>
            <Input
              value={activeOrganization?.name || ""}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label>Workspace slug</Label>
            <Input
              value={activeOrganization?.slug || ""}
              disabled
              className="mt-2"
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for scheduling broadcasts and analytics reporting.
            </p>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="mt-2 w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            disabled={
              isSaving ||
              !timezone ||
              timezone === activeOrganization?.timezone
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
