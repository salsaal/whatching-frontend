import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

interface GoogleLatLng {
  lat: () => number;
  lng: () => number;
}

interface GoogleGeocodeResult {
  formatted_address?: string;
  address_components?: Array<{ long_name?: string }>;
  geometry?: { location?: GoogleLatLng };
}

interface GoogleMap {
  panTo: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (
    event: string,
    handler: (event: { latLng: GoogleLatLng }) => void
  ) => void;
}

interface GoogleMarker {
  setMap: (map: GoogleMap | null) => void;
}

interface GoogleGeocoder {
  geocode: (
    request:
      | { address: string }
      | { location: { lat: number; lng: number } },
    callback: (results: GoogleGeocodeResult[], status: string) => void
  ) => void;
}

interface GoogleMapsNamespace {
  maps: {
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>
    ) => GoogleMap;
    Marker: new (options: {
      map: GoogleMap;
      position: { lat: number; lng: number };
    }) => GoogleMarker;
    Geocoder: new () => GoogleGeocoder;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __whatchingGoogleMapsPromise?: Promise<void>;
  }
}

const loadGoogleMaps = () => {
  if (window.google?.maps) return Promise.resolve();
  if (window.__whatchingGoogleMapsPromise) {
    return window.__whatchingGoogleMapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is missing"));
  }

  window.__whatchingGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-whatching-google-maps="true"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly`;
    script.async = true;
    script.dataset.whatchingGoogleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__whatchingGoogleMapsPromise;
};

export default function LocationPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: Partial<PickedLocation>;
  onSelect: (location: PickedLocation) => void;
}) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const geocoderRef = useRef<GoogleGeocoder | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<PickedLocation | null>(null);

  const placeMarker = (location: PickedLocation, zoom = 16) => {
    if (!window.google || !mapRef.current) return;
    const position = { lat: location.latitude, lng: location.longitude };
    markerRef.current?.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      map: mapRef.current,
      position
    });
    mapRef.current.panTo(position);
    mapRef.current.setZoom(zoom);
    setSelected(location);
  };

  const reverseGeocode = (latitude: number, longitude: number) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode(
      { location: { lat: latitude, lng: longitude } },
      (results, status) => {
        const result = status === "OK" ? results?.[0] : undefined;
        placeMarker({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          name:
            result?.address_components?.[0]?.long_name || "Selected location",
          address:
            result?.formatted_address ||
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        });
      }
    );
  };

  useEffect(() => {
    if (!open || !mapElementRef.current) return;
    setIsLoading(true);
    loadGoogleMaps()
      .then(() => {
        if (!window.google || !mapElementRef.current) return;
        const initial = {
          lat: Number(value?.latitude) || 20.5937,
          lng: Number(value?.longitude) || 78.9629
        };
        mapRef.current = new window.google.maps.Map(mapElementRef.current, {
          center: initial,
          zoom: value?.latitude ? 15 : 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false
        });
        geocoderRef.current = new window.google.maps.Geocoder();
        mapRef.current.addListener("click", (event) => {
          reverseGeocode(event.latLng.lat(), event.latLng.lng());
        });
        if (value?.latitude && value?.longitude) {
          placeMarker({
            latitude: Number(value.latitude),
            longitude: Number(value.longitude),
            name: value.name || "Selected location",
            address: value.address || ""
          });
        } else {
          setSelected(null);
        }
      })
      .catch(() =>
        toast.error(
          "Google Maps could not load. Check the API key, billing, referrer restrictions, and Maps JavaScript API."
        )
      )
      .finally(() => setIsLoading(false));

    // The current value is sampled whenever the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const searchLocation = () => {
    if (!query.trim() || !geocoderRef.current) return;
    setIsLoading(true);
    geocoderRef.current.geocode(
      { address: query.trim() },
      (results, status) => {
        setIsLoading(false);
        const result = status === "OK" ? results?.[0] : undefined;
        const location = result?.geometry?.location;
        if (!result || !location) {
          toast.error("No matching location found.");
          return;
        }
        placeMarker({
          latitude: location.lat(),
          longitude: location.lng(),
          name:
            result.address_components?.[0]?.long_name || query.trim(),
          address: result.formatted_address || query.trim()
        });
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Choose location</DialogTitle>
        </DialogHeader>
        <div className="px-5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchLocation();
                  }
                }}
                placeholder="Search for an address or place"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={searchLocation}>
              Search
            </Button>
          </div>
        </div>
        <div className="relative h-[430px] bg-muted">
          <div ref={mapElementRef} className="absolute inset-0" />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
        </div>
        <DialogFooter className="items-center px-5 pb-5 sm:justify-between">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">
              {selected?.address || "Search or click the map to place a pin"}
            </span>
          </p>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
              onOpenChange(false);
            }}
          >
            Use location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
