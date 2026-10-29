import { WhatsAppPhoneNumber } from "@/client-api/types/organizations.type";
import { isPaymentBlocked } from "@/components/whatsapp/PaymentBlockedCallout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

function SenderOption({ number }: { number: WhatsAppPhoneNumber }) {
  const blocked = isPaymentBlocked(number);
  return (
    <span className="flex min-w-0 flex-col items-start text-left">
      <span className="flex items-center gap-2 font-medium">
        {!blocked && <span className="size-2 rounded-full bg-emerald-500" />}
        {number.displayPhoneNumber || number.phoneNumberId}
        {blocked && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
            Payment needed
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {blocked
          ? "Add a payment method first"
          : number.verifiedName ||
            number.businessAccountName ||
            "WhatsApp number"}
      </span>
    </span>
  );
}

// Full number and business name on two lines, with billing-blocked numbers
// shown but not selectable.
export function BroadcastSenderSelect({
  numbers,
  value,
  onValueChange
}: {
  numbers: WhatsAppPhoneNumber[];
  value: string;
  onValueChange: (phoneNumberId: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={numbers.length === 0}
    >
      <SelectTrigger className="h-auto min-h-11 w-full py-2 [&>span]:line-clamp-none">
        <SelectValue placeholder="Select sender" />
      </SelectTrigger>
      <SelectContent>
        {numbers.map((number) => {
          const blocked = isPaymentBlocked(number);
          return (
            <SelectItem
              key={number.id}
              value={number.phoneNumberId}
              disabled={blocked}
              title={blocked ? "Add a payment method first" : undefined}
            >
              <SenderOption number={number} />
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
