import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LocationData {
  address: string;
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
}

interface LocationFieldProps {
  value: LocationData;
  onChange: (location: LocationData) => void;
  disabled?: boolean;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

export function LocationField({ value, onChange, disabled }: LocationFieldProps) {
  const [query, setQuery] = useState(value.address || '');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const { toast } = useToast();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync display when value changes externally
  useEffect(() => {
    if (value.address && value.address !== query) {
      setQuery(value.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.address]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchPlaces = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(text), 400);
  };

  const selectSuggestion = (item: NominatimResult) => {
    const city = item.address?.city || item.address?.town || item.address?.village || '';
    const state = item.address?.state || '';
    const country = item.address?.country || '';
    const address = item.display_name;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    console.log('[LocationField] Selected:', { address, city, state, country, lat, lng });

    setQuery(address);
    setShowDropdown(false);
    setSuggestions([]);
    onChange({ address, city, state, country, lat, lng });
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    onChange({ address: '', city: '', state: '', country: '', lat: null, lng: null });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Geolocation not supported', description: 'Your browser does not support geolocation.' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          console.log('[LocationField] Got coords:', latitude, longitude);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          const country = data.address?.country || '';
          const address = data.display_name || [city, state, country].filter(Boolean).join(', ');

          console.log('[LocationField] Reverse geocoded:', { address, city, state, country, lat: latitude, lng: longitude });

          setQuery(address);
          onChange({ address, city, state, country, lat: latitude, lng: longitude });
        } catch {
          toast({ variant: 'destructive', title: 'Location failed', description: 'Could not detect your location.' });
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        console.log('[LocationField] Geolocation error:', err.message);
        toast({ variant: 'destructive', title: 'Location denied', description: 'Please allow location access or search manually.' });
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <Label>Location</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Enter your location"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          disabled={disabled}
          className="pl-9 pr-9"
        />
        {query && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Autocomplete dropdown */}
        {showDropdown && !disabled && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-y-auto">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching...
              </div>
            )}
            {suggestions.map((item, i) => (
              <button
                key={`${item.lat}-${item.lon}-${i}`}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-0"
                onClick={() => selectSuggestion(item)}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="line-clamp-2">{item.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected address display */}
      {value.lat != null && value.lng != null && value.address && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {value.city && <span>{value.city}</span>}
          {value.state && <span>, {value.state}</span>}
          {value.country && <span>, {value.country}</span>}
        </p>
      )}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          onClick={handleUseCurrentLocation}
          disabled={geoLoading}
        >
          {geoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
          Use Current Location
        </Button>
      )}
    </div>
  );
}
