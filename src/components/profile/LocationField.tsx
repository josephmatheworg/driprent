import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationFieldProps {
  city: string;
  state: string;
  country: string;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onCoordsChange?: (lat: number, lng: number) => void;
  disabled?: boolean;
}

export function LocationField({ city, state, country, onCityChange, onStateChange, onCountryChange, onCoordsChange, disabled }: LocationFieldProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const { toast } = useToast();

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Geolocation not supported' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
          const data = await res.json();
          onCityChange(data.address?.city || data.address?.town || data.address?.village || '');
          onStateChange(data.address?.state || '');
          onCountryChange(data.address?.country || '');
          onCoordsChange?.(position.coords.latitude, position.coords.longitude);
        } catch {
          toast({ variant: 'destructive', title: 'Location failed', description: 'Could not detect your location.' });
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        toast({ variant: 'destructive', title: 'Location denied', description: 'Please allow location access or enter manually.' });
        setGeoLoading(false);
      }
    );
  };

  return (
    <div className="space-y-3">
      <Label>Location</Label>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Input placeholder="City" value={city} onChange={(e) => onCityChange(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Input placeholder="State" value={state} onChange={(e) => onStateChange(e.target.value)} disabled={disabled} />
        </div>
        <div>
          <Input placeholder="Country" value={country} onChange={(e) => onCountryChange(e.target.value)} disabled={disabled} />
        </div>
      </div>
      {!disabled && (
        <Button type="button" variant="outline" size="sm" className="whitespace-nowrap" onClick={handleUseCurrentLocation} disabled={geoLoading}>
          {geoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
          Use Your Current Location
        </Button>
      )}
    </div>
  );
}
