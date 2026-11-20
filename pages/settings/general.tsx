"use client";

import { Loader2, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
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
import { useCurrentMembership } from "@/hooks/useCurrentMembership";
import { useOrganizationStore } from "@/stores/organizationStore";

const NAME_MIN = 2;
const NAME_MAX = 80;

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

  const queryClient = useQueryClient();
  const { isOwnerOrAdmin } = useCurrentMembership();
  const [timezone, setTimezone] = useState(
    activeOrganization?.timezone || "Asia/Kolkata"
  );
  const [name, setName] = useState(activeOrganization?.name || "");
  // The organisation can load (or change) after the first render.
  useEffect(() => {
    setName(activeOrganization?.name || "");
    setTimezone(activeOrganization?.timezone || "Asia/Kolkata");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?._id]);
  const trimmedName = name.trim();
  const nameChanged = trimmedName !== (activeOrganization?.name || "").trim();
  const timezoneChanged = timezone !== activeOrganization?.timezone;
  const nameProblem =
    trimmedName.length < NAME_MIN
      ? `Use at least ${NAME_MIN} characters.`
      : trimmedName.length > NAME_MAX
        ? `Keep it to ${NAME_MAX} characters.`
        : "";

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
      // Keep what the organisation list added (role, numbers); the response
      // carries the saved fields.
      const saved = res.data.organization;
      upsertOrganization(
        activeOrganization ? { ...activeOrganization, ...saved } : saved
      );
      setName(saved.name || trimmedName);
      // The organisation switcher and Account page list names too.
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Settings saved.");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message ||
          "Settings couldn't be saved. Try again."
      );
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
                Your business name and timezone.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg bg-white p-5 shadow-xs">
          <div>
            <Label htmlFor="business-name">Business name</Label>
            <Input
              id="business-name"
              value={name}
              maxLength={NAME_MAX}
              disabled={!isOwnerOrAdmin}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 sm:w-80"
            />
            {isOwnerOrAdmin && nameChanged && nameProblem ? (
              <p className="mt-1.5 text-xs text-destructive">{nameProblem}</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {isOwnerOrAdmin
                  ? "This is how your business appears inside Whatching. It doesn't change your WhatsApp display name or past invoices."
                  : "Only the organisation owner or an admin can change this."}
              </p>
            )}
          </div>
          <div>
            <Label>Timezone</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for scheduled broadcasts and the days in Analytics.
            </p>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger
                className="mt-2 w-full sm:w-80"
                disabled={!isOwnerOrAdmin}
              >
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

          {isOwnerOrAdmin && (
            <Button
              type="button"
              disabled={
                isSaving ||
                (!nameChanged && !timezoneChanged) ||
                (nameChanged && Boolean(nameProblem)) ||
                !timezone
              }
              onClick={() =>
                saveSettings({
                  ...(nameChanged ? { name: trimmedName } : {}),
                  ...(timezoneChanged ? { timezone } : {})
                })
              }
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
