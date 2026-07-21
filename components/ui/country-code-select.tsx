"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import React, { useMemo, useState } from "react";
import {
  getCountries,
  getCountryCallingCode
} from "react-phone-number-input/input";
import en from "react-phone-number-input/locale/en.json";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CountryCodeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  onCountryIsoChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export function CountryCodeSelect({
  value,
  onValueChange,
  onCountryIsoChange,
  placeholder = "Select country code...",
  className,
  compact = false
}: CountryCodeSelectProps) {
  const [open, setOpen] = useState(false);

  const countries = useMemo(() => {
    return getCountries().map((country) => ({
      value: `+${getCountryCallingCode(country)}`,
      label: `${en[country]} (+${getCountryCallingCode(country)})`,
      country: country,
      code: `+${getCountryCallingCode(country)}`,
      name: en[country]
    }));
  }, []);

  const selectedCountry = countries.find((country) => country.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between border-input bg-background hover:bg-muted/50 focus:border-ring",
            className
          )}
        >
          {selectedCountry ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="text-lg">
                {String.fromCodePoint(
                  ...selectedCountry.country
                    .split("")
                    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
                )}
              </span>
              <span className="font-mono text-sm">{selectedCountry.code}</span>
              {!compact && (
                <span className="truncate text-sm text-muted-foreground">
                  {selectedCountry.name}
                </span>
              )}
            </span>
          ) : (
            <span className="truncate text-muted-foreground">
              {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 border bg-popover p-0 text-popover-foreground shadow-lg"
      >
        <Command className="h-auto max-h-[22rem] overflow-visible">
          <CommandInput
            placeholder="Search country..."
            className="border-none focus:ring-0"
          />
          <CommandList
            className="h-72 max-h-72 overflow-y-scroll overscroll-contain [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup className="overflow-visible">
              {countries.map((country) => (
                <CommandItem
                  key={country.value}
                  value={`${country.name} ${country.code}`}
                  onSelect={() => {
                    onValueChange(country.value);
                    onCountryIsoChange?.(country.country);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === country.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-lg">
                      {String.fromCodePoint(
                        ...country.country
                          .split("")
                          .map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
                      )}
                    </span>
                    <span className="font-mono text-sm font-medium text-primary">
                      {country.code}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {country.name}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
