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

interface GooglePlacePrediction {
  description: string;
  place_id?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface GooglePlaceResult {
  formatted_address?: string;
  name?: string;
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
    request: { address: string } | { location: { lat: number; lng: number } },
    callback: (results: GoogleGeocodeResult[], status: string) => void
  ) => void;
}

interface GoogleAutocompleteService {
  getPlacePredictions: (
    request: { input: string },
    callback: (
      predictions: GooglePlacePrediction[] | null,
      status: string
    ) => void
  ) => void;
}

interface GooglePlacesService {
  getDetails: (
    request: { placeId: string; fields: string[] },
    callback: (place: GooglePlaceResult | null, status: string) => void
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
    importLibrary?: (libraryName: "places") => Promise<unknown>;
    places?: {
      AutocompleteService: new () => GoogleAutocompleteService;
      PlacesService: new (map: GoogleMap | HTMLElement) => GooglePlacesService;
    };
    event: {
      trigger: (instance: GoogleMap, eventName: string) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    gm_authFailure?: () => void;
    __whatchingGoogleMapsLoaded?: () => void;
    __whatchingGoogleMapsRejected?: (error: Error) => void;
    __whatchingGoogleMapsPromise?: Promise<void>;
  }
}

const hasRequiredGoogleMaps = () =>
  Boolean(
    window.google?.maps?.Map &&
      window.google.maps.Geocoder &&
      window.google.maps.places?.AutocompleteService &&
      window.google.maps.places.PlacesService
  );

const loadGoogleMaps = () => {
  if (hasRequiredGoogleMaps()) return Promise.resolve();
  if (
    window.google?.maps?.Map &&
    window.google.maps.importLibrary &&
    !window.google.maps.places?.AutocompleteService
  ) {
    return window.google.maps.importLibrary("places").then(() => undefined);
  }
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
      existing.remove();
    }

    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      reject(
        new Error(
          "Google Maps timed out before the API script finished loading"
        )
      );
    }, 12000);

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&v=weekly&libraries=places&callback=__whatchingGoogleMapsLoaded&auth_referrer_policy=origin`;
    script.async = true;
    script.dataset.whatchingGoogleMaps = "true";
    window.__whatchingGoogleMapsLoaded = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    window.__whatchingGoogleMapsRejected = (error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(script);
  });

  return window.__whatchingGoogleMapsPromise.catch((error) => {
    window.__whatchingGoogleMapsPromise = undefined;
    throw error;
  });
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
  const autocompleteServiceRef = useRef<GoogleAutocompleteService | null>(null);
  const placesServiceRef = useRef<GooglePlacesService | null>(null);
  const tilesLoadedRef = useRef(false);
  const predictionRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [predictions, setPredictions] = useState<GooglePlacePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    if (!open) return;
    setLoadError("");
    setSuggestionError("");
    setPredictions([]);
    setShowSuggestions(false);
    setIsLoading(true);
    setMapsReady(false);
    tilesLoadedRef.current = false;
    window.gm_authFailure = () => {
      const errorMessage =
        "Google Maps rejected this API key. Enable Maps JavaScript API, Places API, Geocoding API, billing, and this site's HTTP referrer.";
      setLoadError(errorMessage);
      setIsLoading(false);
      window.__whatchingGoogleMapsRejected?.(new Error(errorMessage));
    };
    loadGoogleMaps()
      .then(() => {
        if (!window.google?.maps || !mapElementRef.current) {
          throw new Error("Google Maps loaded without its map namespace");
        }
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
        const refreshMap = () => {
          if (!window.google?.maps || !mapRef.current) return;
          window.google.maps.event.trigger(mapRef.current, "resize");
          mapRef.current.panTo(initial);
        };
        window.requestAnimationFrame(refreshMap);
        window.setTimeout(refreshMap, 250);
        geocoderRef.current = new window.google.maps.Geocoder();
        const places = window.google.maps.places;
        if (!places) {
          throw new Error("Google Maps loaded without Places support");
        }
        autocompleteServiceRef.current = new places.AutocompleteService();
        placesServiceRef.current = new places.PlacesService(mapRef.current);
        setMapsReady(true);
        mapRef.current.addListener("tilesloaded", () => {
          tilesLoadedRef.current = true;
          setLoadError("");
          setIsLoading(false);
        });
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
        window.setTimeout(() => {
          if (tilesLoadedRef.current) return;
          setIsLoading(false);
          setLoadError(
            "Google Maps loaded, but map tiles were blocked. Allow this localhost origin in the API key's website restrictions and confirm Maps JavaScript API billing is enabled."
          );
        }, 10000);
      })
      .catch(() => {
        setLoadError(
          "Google Maps could not load. Check the API key, billing, enabled APIs, and HTTP referrer restrictions."
        );
        toast.error(
          "Google Maps could not load. Check the API key, billing, referrer restrictions, Maps JavaScript API, and Places API."
        );
        setIsLoading(false);
      });

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      geocoderRef.current = null;
      autocompleteServiceRef.current = null;
      placesServiceRef.current = null;
      setMapsReady(false);
      window.gm_authFailure = undefined;
      window.__whatchingGoogleMapsLoaded = undefined;
      window.__whatchingGoogleMapsRejected = undefined;
    };

    // The current value is sampled whenever the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !mapsReady) return;
    const trimmed = query.trim();
    predictionRequestRef.current += 1;
    const requestId = predictionRequestRef.current;
    setSuggestionError("");

    if (trimmed.length < 2 || !autocompleteServiceRef.current) {
      setPredictions([]);
      setIsSuggesting(false);
      return;
    }

    setIsSuggesting(true);
    const timeoutId = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        { input: trimmed },
        (results, status) => {
          if (requestId !== predictionRequestRef.current) return;
          setIsSuggesting(false);
          if (status === "OK" && results?.length) {
            setPredictions(results.slice(0, 6));
            setShowSuggestions(true);
            return;
          }
          setPredictions([]);
          if (status !== "ZERO_RESULTS") {
            setSuggestionError(
              "Place suggestions are unavailable. Confirm Places API is enabled for this key."
            );
          }
        }
      );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [mapsReady, open, query]);

  const searchLocation = (searchTerm = query) => {
    const trimmed = searchTerm.trim();
    if (!trimmed || !geocoderRef.current) return;
    setIsLoading(true);
    setShowSuggestions(false);
    geocoderRef.current.geocode({ address: trimmed }, (results, status) => {
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
        name: result.address_components?.[0]?.long_name || trimmed,
        address: result.formatted_address || trimmed
      });
    });
  };

  const selectPrediction = (prediction: GooglePlacePrediction) => {
    setQuery(prediction.description);
    setPredictions([]);
    setShowSuggestions(false);
    if (!prediction.place_id || !placesServiceRef.current) {
      searchLocation(prediction.description);
      return;
    }

    setIsLoading(true);
    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["name", "formatted_address", "geometry"]
      },
      (place, status) => {
        setIsLoading(false);
        const location = status === "OK" ? place?.geometry?.location : null;
        if (!place || !location) {
          searchLocation(prediction.description);
          return;
        }
        placeMarker({
          latitude: location.lat(),
          longitude: location.lng(),
          name:
            place.name ||
            prediction.structured_formatting?.main_text ||
            prediction.description,
          address: place.formatted_address || prediction.description
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
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (predictions.length) setShowSuggestions(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchLocation();
                  }
                }}
                placeholder="Search for an address or place"
                className="pl-9"
              />
              {showSuggestions &&
                (predictions.length > 0 || isSuggesting || suggestionError) && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
                    {predictions.map((prediction) => (
                      <button
                        key={prediction.place_id || prediction.description}
                        type="button"
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectPrediction(prediction)}
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {prediction.structured_formatting?.main_text ||
                              prediction.description}
                          </span>
                          {prediction.structured_formatting?.secondary_text && (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {prediction.structured_formatting.secondary_text}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                    {isSuggesting && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Searching places
                      </div>
                    )}
                    {!isSuggesting && suggestionError && (
                      <p className="px-3 py-2 text-sm text-destructive">
                        {suggestionError}
                      </p>
                    )}
                  </div>
                )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => searchLocation()}
            >
              Search
            </Button>
          </div>
        </div>
        <div className="relative h-[430px] bg-muted">
          <div ref={mapElementRef} className="absolute inset-0" />
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted p-8 text-center">
              <div className="max-w-md">
                <MapPin className="mx-auto size-8 text-destructive" />
                <p className="mt-3 text-sm font-medium text-destructive">
                  Map unavailable
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loadError}
                </p>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          )}
        </div>
        <DialogFooter className="items-center px-5 pb-5 sm:justify-between">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground max-w-[500px]">
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
