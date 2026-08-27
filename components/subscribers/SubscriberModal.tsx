import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getSubscriberCampaignTouches } from "@/client-api/functions/campaigns";
import { updateSubscriberBroadcastEligibility } from "@/client-api/functions/subscribers";
import {
  Subscriber,
  SubscriberPayload
} from "@/client-api/types/subscribers.type";
import { Button } from "@/components/ui/button";
import PhoneNumberInput, {
  buildInternationalPhoneNumber
} from "@/components/ui/phone-number-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SubscriberModalProps {
  open: boolean;
  subscriber?: Subscriber | null;
  isSaving: boolean;
  availableTags?: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (payload: SubscriberPayload) => void;
}

export default function SubscriberModal({
  open,
  subscriber,
  isSaving,
  availableTags = [],
  onOpenChange,
  onSave
}: SubscriberModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [countryIso, setCountryIso] = useState("IN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    setPhoneNumber(subscriber?.phoneNumber || "");
    setCountryCode("+91");
    setCountryIso("IN");
    setFirstName(subscriber?.firstName || "");
    setLastName(subscriber?.lastName || "");
    setSelectedTags(subscriber?.tags || []);
  }, [subscriber, open]);

  const { data: campaignTouchesData } = useQuery({
    queryKey: ["subscriber-campaign-touches", subscriber?._id],
    queryFn: () => getSubscriberCampaignTouches(subscriber!._id),
    enabled: open && Boolean(subscriber?._id)
  });

  const { mutate: toggleBroadcastEligibility, isPending: isTogglingEligibility } =
    useMutation({
      mutationFn: updateSubscriberBroadcastEligibility,
      meta: { showToast: false, invalidateQueries: ["subscribers"] }
    });

  const campaignSources = campaignTouchesData?.data.campaignSources || [];
  const campaignTouches = campaignTouchesData?.data.touches || [];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSave({
      phoneNumber: subscriber
        ? phoneNumber.trim()
        : buildInternationalPhoneNumber(countryCode, phoneNumber),
      countryIso: subscriber ? undefined : countryIso,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      tags: selectedTags
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {subscriber ? "Edit subscriber" : "Add subscriber"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone number</Label>
              <div className="mt-2">
                <PhoneNumberInput
                  countryCode={countryCode}
                  countryIso={countryIso}
                  phoneNumber={phoneNumber}
                  disabled={Boolean(subscriber)}
                  onCountryCodeChange={setCountryCode}
                  onCountryIsoChange={setCountryIso}
                  onPhoneNumberChange={setPhoneNumber}
                  placeholder="9876543210"
                />
              </div>
            </div>
            <div>
              <Label>First name</Label>
              <Input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="John"
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Last name</Label>
              <Input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Doe"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Tags</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full justify-start font-normal"
                  >
                    {selectedTags.length
                      ? `${selectedTags.length} selected`
                      : "Select tags"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  {availableTags.length ? (
                    availableTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={(checked) =>
                          setSelectedTags((current) =>
                            checked
                              ? [...current, tag]
                              : current.filter((item) => item !== tag)
                          )
                        }
                        onSelect={(event) => event.preventDefault()}
                      >
                        {tag}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                      No tags found
                    </p>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {subscriber && (
            <div className="flex items-center justify-between rounded-sm border p-3">
              <div>
                <p className="text-sm font-medium">Exclude from broadcasts</p>
                <p className="text-xs text-muted-foreground">
                  {subscriber.broadcastEligibility === "retained_only"
                    ? subscriber.broadcastEligibilityReason
                      ? `Auto-restricted: ${subscriber.broadcastEligibilityReason}`
                      : "Currently restricted from broadcasts."
                    : "Currently eligible for broadcasts."}
                </p>
              </div>
              <Switch
                checked={subscriber.broadcastEligibilityMode === "excluded"}
                disabled={isTogglingEligibility}
                onCheckedChange={(checked) =>
                  toggleBroadcastEligibility({
                    subscriberId: subscriber._id,
                    mode: checked ? "excluded" : "auto"
                  })
                }
              />
            </div>
          )}

          {subscriber && (campaignSources.length > 0 || campaignTouches.length > 0) && (
            <div className="space-y-2 rounded-sm border p-3">
              <p className="text-sm font-medium">Campaign attribution</p>
              {campaignSources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {campaignSources.map((source) => (
                    <span
                      key={source.sourceId}
                      className="inline-flex items-center rounded-sm bg-muted px-2 py-1 text-xs"
                    >
                      {source.label} ({source.touchCount})
                    </span>
                  ))}
                </div>
              )}
              {campaignTouches.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {campaignTouches.map((touch) => (
                    <li key={touch._id}>
                      {new Date(touch.occurredAt).toLocaleDateString("en-IN")}{" "}
                      — {touch.headline || touch.sourceId}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
