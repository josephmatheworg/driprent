import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface ConfirmDealPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: {
    id: string;
    fit_id: string;
    start_date: string;
    end_date: string;
    fit_title?: string;
  };
  onConfirmed: () => void;
}

export function ConfirmDealPanel({ open, onOpenChange, rental, onConfirmed }: ConfirmDealPanelProps) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(rental.start_date),
    to: new Date(rental.end_date),
  });

  // Fetch existing confirmed/active rentals for this outfit to show blocked dates
  useEffect(() => {
    if (!open) return;
    const fetchBlocked = async () => {
      const { data } = await supabase
        .from('fit_booked_ranges')
        .select('start_date, end_date')
        .eq('fit_id', rental.fit_id);

      if (data) {
        const dates: Date[] = [];
        data.forEach((r: any) => {
          eachDayOfInterval({ start: new Date(r.start_date), end: new Date(r.end_date) }).forEach(d => dates.push(d));
        });
        setBlockedDates(dates);
      }
    };
    fetchBlocked();
    // Reset to rental defaults when opening
    setDateRange({ from: new Date(rental.start_date), to: new Date(rental.end_date) });
    setOverlapError(null);
  }, [open, rental.fit_id, rental.id, rental.start_date, rental.end_date]);

  const checkOverlap = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to || blockedDates.length === 0) {
      setOverlapError(null);
      return false;
    }
    const hasOverlap = blockedDates.some(d =>
      isWithinInterval(d, { start: range.from!, end: range.to! })
    );
    if (hasOverlap) {
      setOverlapError('Outfit unavailable for selected dates — another rental overlaps.');
      return true;
    }
    setOverlapError(null);
    return false;
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    checkOverlap(range);
  };

  const [activeRentalBlock, setActiveRentalBlock] = useState<string | null>(null);

  // Check if renter already has an active rental for this outfit
  useEffect(() => {
    if (!open || !rental.fit_id) return;
    const checkActiveRental = async () => {
      const { data } = await supabase
        .from('rentals')
        .select('id, status')
        .eq('fit_id', rental.fit_id)
        .eq('renter_id', rental.renter_id ?? '')
        .in('status', ['confirmed', 'active'] as any);

      if (data && data.length > 0 && data.some(r => r.id !== rental.id)) {
        console.log('Blocked: active rental exists for this outfit');
        setActiveRentalBlock('Already rented – return first');
      } else {
        setActiveRentalBlock(null);
      }
    };
    checkActiveRental();
  }, [open, rental.fit_id, rental.id]);

  const handleConfirm = async () => {
    if (activeRentalBlock) {
      toast({ variant: 'destructive', title: 'Cannot confirm', description: 'This renter already has an active rental for this outfit.' });
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Please select dates' });
      return;
    }

    if (checkOverlap(dateRange)) return;

    setConfirming(true);

    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');
    const totalDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { error } = await supabase
      .from('rentals')
      .update({
        status: 'confirmed' as any,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
      })
      .eq('id', rental.id);

    setConfirming(false);

    if (error) {
      if (error.code === '23505' || error.message?.includes('overlapping')) {
        setOverlapError('Cannot confirm: another rental overlaps these dates.');
        toast({ variant: 'destructive', title: 'Date conflict', description: 'These dates are already booked by another confirmed rental.' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to confirm', description: error.message });
      }
      return;
    }

    toast({ title: 'Deal confirmed!', description: 'The rental dates are now locked.' });
    onOpenChange(false);
    onConfirmed();
  };

  // Mark blocked dates as disabled in the calendar
  const isDateBlocked = (date: Date) => {
    if (date < new Date()) return true;
    return blockedDates.some(d =>
      d.getFullYear() === date.getFullYear() &&
      d.getMonth() === date.getMonth() &&
      d.getDate() === date.getDate()
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Deal</DialogTitle>
          <DialogDescription>
            Confirm the rental dates for {rental.fit_title ? `"${rental.fit_title}"` : 'this outfit'}. Adjust if needed. Dates in red are already booked.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="mb-2 block text-sm font-medium">Rental Dates</Label>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateSelect}
            disabled={isDateBlocked}
            className={cn("rounded-md border pointer-events-auto")}
            numberOfMonths={1}
            modifiers={{ booked: blockedDates }}
            modifiersClassNames={{ booked: 'bg-destructive/20 text-destructive line-through' }}
          />
        </div>

        {overlapError && (
          <p className="text-sm text-destructive font-medium">{overlapError}</p>
        )}

        {dateRange?.from && dateRange?.to && !overlapError && (
          <div className="space-y-1 text-sm">
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start</span>
              <span className="font-medium">{format(dateRange.from, 'MMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End</span>
              <span className="font-medium">{format(dateRange.to, 'MMM d, yyyy')}</span>
            </div>
          </div>
        )}

        <Button
          onClick={handleConfirm}
          disabled={confirming || !dateRange?.from || !dateRange?.to || !!overlapError}
          className="w-full"
        >
          {confirming ? 'Confirming...' : 'Confirm Deal & Lock Dates'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
