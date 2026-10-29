"use client";

import { CountryCodeSelect } from "@/components/ui/country-code-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneNumberInputProps {
  countryCode: string;
  countryIso: string;
  phoneNumber: string;
  disabled?: boolean;
  placeholder?: string;
  onCountryCodeChange: (value: string) => void;
  onCountryIsoChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  /** Optional overrides so a page can match its own field style. */
  id?: string;
  inputClassName?: string;
  selectClassName?: string;
}

export const buildInternationalPhoneNumber = (
  countryCode: string,
  phoneNumber: string
) => {
  const trimmed = phoneNumber.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");

  const digits = trimmed.replace(/[^\d]/g, "");
  const callingCode = countryCode.replace(/[^\d+]/g, "");
  return `${callingCode}${digits}`;
};

export default function PhoneNumberInput({
  countryCode,
  countryIso,
  phoneNumber,
  disabled = false,
  placeholder = "Phone number",
  onCountryCodeChange,
  onCountryIsoChange,
  onPhoneNumberChange,
  id,
  inputClassName,
  selectClassName
}: PhoneNumberInputProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[112px_1fr]">
      <CountryCodeSelect
        value={countryCode}
        onValueChange={onCountryCodeChange}
        onCountryIsoChange={onCountryIsoChange}
        compact
        className={cn("h-10 px-2", selectClassName)}
      />
      <Input
        id={id}
        className={inputClassName}
        value={phoneNumber}
        disabled={disabled}
        inputMode="tel"
        placeholder={placeholder}
        onChange={(event) => onPhoneNumberChange(event.target.value)}
      />
      <input type="hidden" value={countryIso} readOnly />
    </div>
  );
}
