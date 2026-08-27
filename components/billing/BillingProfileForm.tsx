import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getBillingProfile,
  updateBillingProfile
} from "@/client-api/functions/organizations";
import type { BillingProfile } from "@/client-api/types/organizations.type";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { emptyBillingProfile, indiaStates, validateBillingProfile } from "@/lib/billing";

const normalizeBillingProfile = (profile: BillingProfile): BillingProfile => ({
  legalName: profile.legalName.trim(),
  billingEmail: profile.billingEmail.trim(),
  address: profile.address.trim(),
  state: profile.state.trim(),
  pinCode: profile.pinCode.trim(),
  gstin: profile.gstin?.trim().toUpperCase() || ""
});

export default function BillingProfileForm() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<BillingProfile>(emptyBillingProfile);
  const [touched, setTouched] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["billing-profile"],
    queryFn: getBillingProfile
  });

  useEffect(() => {
    const backendProfile = data?.data.billingProfile;
    if (backendProfile && !touched) {
      setProfile({
        legalName: backendProfile.legalName || "",
        billingEmail: backendProfile.billingEmail || "",
        address: backendProfile.address || "",
        state: backendProfile.state || "",
        pinCode: backendProfile.pinCode || "",
        gstin: backendProfile.gstin || ""
      });
    }
  }, [data, touched]);

  const validation = validateBillingProfile(profile);
  const hasErrors = Object.values(validation).some(Boolean);

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: (payload: BillingProfile) => updateBillingProfile(payload),
    meta: { showToast: false },
    onSuccess: () => {
      toast.success("Billing profile updated.");
      setTouched(false);
      queryClient.invalidateQueries({ queryKey: ["billing-profile"] });
    }
  });

  const updateField = (key: keyof BillingProfile, value: string) => {
    setTouched(true);
    setProfile((current) => ({ ...current, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="billing-legal-name">Legal name *</Label>
          <Input
            id="billing-legal-name"
            placeholder="Acme Private Limited"
            value={profile.legalName}
            onChange={(event) => updateField("legalName", event.target.value)}
            aria-invalid={Boolean(validation.legalName)}
          />
          {validation.legalName && (
            <p className="text-xs text-destructive">{validation.legalName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-email">Billing email *</Label>
          <Input
            id="billing-email"
            type="email"
            placeholder="billing@example.com"
            value={profile.billingEmail}
            onChange={(event) =>
              updateField("billingEmail", event.target.value)
            }
            aria-invalid={Boolean(validation.billingEmail)}
          />
          {validation.billingEmail && (
            <p className="text-xs text-destructive">
              {validation.billingEmail}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-state">State *</Label>
          <Select
            value={profile.state}
            onValueChange={(value) => updateField("state", value)}
          >
            <SelectTrigger id="billing-state" className="h-11 w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {indiaStates.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {validation.state && (
            <p className="text-xs text-destructive">{validation.state}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-pincode">PIN code *</Label>
          <Input
            id="billing-pincode"
            inputMode="numeric"
            maxLength={6}
            placeholder="560001"
            value={profile.pinCode}
            onChange={(event) => updateField("pinCode", event.target.value)}
            aria-invalid={Boolean(validation.pinCode)}
          />
          {validation.pinCode && (
            <p className="text-xs text-destructive">{validation.pinCode}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="billing-address">Billing address *</Label>
          <Textarea
            id="billing-address"
            placeholder="12 MG Road, Bengaluru"
            className="max-h-[180px] min-h-24 resize-y overflow-y-auto"
            value={profile.address}
            onChange={(event) => updateField("address", event.target.value)}
            aria-invalid={Boolean(validation.address)}
          />
          {validation.address && (
            <p className="text-xs text-destructive">{validation.address}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="billing-gstin">GSTIN (optional)</Label>
          <Input
            id="billing-gstin"
            placeholder="29ABCDE1234F1Z5"
            value={profile.gstin || ""}
            onChange={(event) => updateField("gstin", event.target.value)}
            aria-invalid={Boolean(validation.gstin)}
          />
          {validation.gstin && (
            <p className="text-xs text-destructive">{validation.gstin}</p>
          )}
        </div>
      </div>

      <Button
        type="button"
        disabled={isSaving || (touched && hasErrors)}
        onClick={() => saveProfile(normalizeBillingProfile(profile))}
      >
        Save billing profile
      </Button>
    </div>
  );
}
