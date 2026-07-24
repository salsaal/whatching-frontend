import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, Settings2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";

import { getWhatsAppPhoneNumbers } from "@/client-api/functions/organizations";
import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useOrganizationStore } from "@/stores/organizationStore";

export const ALL_WHATSAPP_NUMBERS = "all";

export const isUsableWhatsAppNumber = (number: WhatsAppPhoneNumber) =>
  number.status === "active" && number.connectionStatus === "ready";

export const getDefaultUsableWhatsAppNumber = (
  numbers: WhatsAppPhoneNumber[]
) =>
  numbers.find(
    (number) => number.isDefault && isUsableWhatsAppNumber(number)
  ) ||
  numbers.find(isUsableWhatsAppNumber) ||
  null;

export function useWhatsAppNumberContext() {
  const activeOrganization = useOrganizationStore(
    (state) => state.activeOrganization
  );
  const selectedByOrg = useOrganizationStore(
    (state) => state.selectedWhatsAppPhoneNumberByOrg
  );
  const setSelected = useOrganizationStore(
    (state) => state.setSelectedWhatsAppPhoneNumber
  );
  const organizationId = activeOrganization?._id || "";
  const query = useQuery({
    queryKey: ["whatsapp-phone-numbers", organizationId],
    queryFn: getWhatsAppPhoneNumbers,
    enabled: Boolean(organizationId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true
  });
  const numbers = useMemo(
    () => query.data?.data.phoneNumbers || [],
    [query.data?.data.phoneNumbers]
  );
  const selectedPhoneNumberId =
    selectedByOrg[organizationId] || ALL_WHATSAPP_NUMBERS;
  const selectedNumber =
    numbers.find((number) => number.phoneNumberId === selectedPhoneNumberId) ||
    null;
  const defaultNumber = getDefaultUsableWhatsAppNumber(numbers);

  useEffect(() => {
    if (!organizationId || !query.isSuccess) return;
    if (
      selectedPhoneNumberId !== ALL_WHATSAPP_NUMBERS &&
      !numbers.some(
        (number) =>
          number.phoneNumberId === selectedPhoneNumberId &&
          isUsableWhatsAppNumber(number)
      )
    ) {
      setSelected(
        organizationId,
        defaultNumber?.phoneNumberId || ALL_WHATSAPP_NUMBERS
      );
    }
  }, [
    defaultNumber?.phoneNumberId,
    numbers,
    organizationId,
    query.isSuccess,
    selectedPhoneNumberId,
    setSelected
  ]);

  return {
    ...query,
    summary: query.data?.data,
    numbers,
    selectedPhoneNumberId,
    selectedNumber,
    defaultNumber,
    effectiveNumber: selectedNumber || defaultNumber,
    setSelectedPhoneNumberId: (phoneNumberId: string) =>
      organizationId && setSelected(organizationId, phoneNumberId)
  };
}

export function WhatsAppNumberSwitcher({
  className,
  includeAll = true,
  value,
  onValueChange,
  showManage = false
}: {
  className?: string;
  includeAll?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  showManage?: boolean;
}) {
  const router = useRouter();
  const {
    numbers,
    selectedPhoneNumberId,
    setSelectedPhoneNumberId,
    isLoading
  } = useWhatsAppNumberContext();
  const currentValue = value ?? selectedPhoneNumberId;
  const usableNumbers = numbers.filter(isUsableWhatsAppNumber);

  return (
    <Select
      value={currentValue}
      onValueChange={(nextValue) => {
        if (onValueChange) onValueChange(nextValue);
        else setSelectedPhoneNumberId(nextValue);
      }}
      disabled={isLoading || (!includeAll && usableNumbers.length === 0)}
    >
      <SelectTrigger
        className={cn("min-w-52 bg-white", className)}
        aria-label="Select WhatsApp phone number"
      >
        <MessageCircle className="size-4 text-emerald-600" />
        <SelectValue
          placeholder={isLoading ? "Loading numbers..." : "Select number"}
        />
      </SelectTrigger>
      <SelectContent>
        {includeAll && (
          <SelectItem value={ALL_WHATSAPP_NUMBERS}>
            All WhatsApp numbers
          </SelectItem>
        )}
        {includeAll && usableNumbers.length > 0 && <SelectSeparator />}
        {usableNumbers.map((number) => (
          <SelectItem key={number.id} value={number.phoneNumberId}>
            <span className="flex min-w-0 items-center gap-2">
              {number.isDefault && (
                <CheckCircle2 className="size-3.5 text-emerald-600" />
              )}
              <span className="truncate">
                {number.displayPhoneNumber || number.phoneNumberId}
              </span>
              {number.verifiedName && (
                <span className="truncate text-xs text-muted-foreground">
                  {number.verifiedName}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
        {showManage && (
          <>
            <SelectSeparator />
            <SelectItem
              value="__manage__"
              onSelect={(event) => {
                event.preventDefault();
                router.push("/overview#whatsapp-numbers");
              }}
            >
              <Settings2 className="size-4" />
              Manage numbers
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
