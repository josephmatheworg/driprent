import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, ShirtIcon, Navigation } from 'lucide-react';
import { format } from 'date-fns';

interface DealSummaryCardProps {
  fitTitle?: string;
  startDate: string;
  endDate: string;
  status: string;
  ownerLatitude?: number | null;
  ownerLongitude?: number | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  accepted: 'bg-accent text-accent-foreground',
  confirmed: 'bg-primary/15 text-primary',
  active: 'bg-primary text-primary-foreground',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/15 text-destructive',
};

export function DealSummaryCard({ fitTitle, startDate, endDate, status, ownerLatitude, ownerLongitude }: DealSummaryCardProps) {
  const isConfirmedOrActive = ['confirmed', 'active'].includes(status);
  const hasCoords = ownerLatitude != null && ownerLongitude != null;

  const handleGetDirections = () => {
    if (hasCoords) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${ownerLatitude},${ownerLongitude}`, '_blank');
    }
  };

  return (
    <Card className="mx-auto my-3 max-w-[90%] border-primary/20 bg-card">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal Summary</span>
          <Badge variant="outline" className={`text-[10px] capitalize ${statusColors[status] || ''}`}>
            {status}
          </Badge>
        </div>
        {fitTitle && (
          <div className="flex items-center gap-1.5 text-sm">
            <ShirtIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{fitTitle}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>{format(new Date(startDate), 'MMM d')} – {format(new Date(endDate), 'MMM d, yyyy')}</span>
        </div>
        {isConfirmedOrActive && hasCoords && (
          <Button variant="outline" size="sm" className="w-full mt-1 gap-2" onClick={handleGetDirections}>
            <Navigation className="h-3.5 w-3.5" /> Get Directions
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
