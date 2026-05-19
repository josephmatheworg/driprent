import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { BookingCalendar } from '@/components/booking/BookingCalendar';

interface ConfirmDealPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: {
    id: string;
    fit_id: string;
    start_date: string;
    end_date: string;
    fit_title?: string;
    renter_id?: string;
  };
  onConfirmed: () => void;
}

const PAYMENT_WINDOW_MINUTES = 5;
const upiRegex = /^[\w.\-]{2,256}@[A-Za-z]{2,64}$/;

export function ConfirmDealPanel({ open, onOpenChange, rental, onConfirmed }: ConfirmDealPanelProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [blockedDates, setBlockedDates] = useState<Date[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(rental.start_date),
    to: new Date(rental.end_date),
  });
  const [advanceAmount, setAdvanceAmount] = useState<string>('500');
  const [lenderUpi, setLenderUpi] = useState<string>('');
  const [activeRentalBlock, setActiveRentalBlock] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fetchBlocked = async () => {
      const { data } = await supabase
        .from('fit_booked_ranges')
        .select('start_date, end_date, rental_id')
        .eq('fit_id', rental.fit_id);

      if (data) {
        const dates: Date[] = [];
        data.filter((r: any) => r.rental_id !== rental.id).forEach((r: any) => {
          eachDayOfInterval({ start: new Date(r.start_date), end: new Date(r.end_date) }).forEach(d => dates.push(d));
        });
        setBlockedDates(dates);
      }
    };
    fetchBlocked();
    setDateRange({ from: new Date(rental.start_date), to: new Date(rental.end_date) });
    setOverlapError(null);
  }, [open, rental.fit_id, rental.id, rental.start_date, rental.end_date]);

  useEffect(() => {
    if (!open || !rental.fit_id || !rental.renter_id) return;
    const checkActiveRental = async () => {
      const { data } = await supabase
        .from('rentals')
        .select('id, status')
        .eq('fit_id', rental.fit_id)
        .eq('renter_id', rental.renter_id!)
        .in('status', ['confirmed', 'active'] as any);
      if (data && data.some(r => r.id !== rental.id)) {
        setActiveRentalBlock('Already rented – return first');
      } else {
        setActiveRentalBlock(null);
      }
    };
    checkActiveRental();
  }, [open, rental.fit_id, rental.id, rental.renter_id]);

  const checkOverlap = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to || blockedDates.length === 0) {
      setOverlapError(null);
      return false;
    }
    const hasOverlap = blockedDates.some(d => isWithinInterval(d, { start: range.from!, end: range.to! }));
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

    const amt = Number(advanceAmount);
    if (!amt || amt < 1 || amt > 100000) {
      toast({ variant: 'destructive', title: 'Invalid advance', description: 'Enter ₹1 – ₹100000.' });
      return;
    }
    if (!upiRegex.test(lenderUpi.trim())) {
      toast({ variant: 'destructive', title: 'Invalid UPI ID', description: 'Format: name@bank (e.g. lender@oksbi)' });
      return;
    }

    setSubmitting(true);
    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');
    const totalDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const deadline = new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('rentals')
      .update({
        status: 'awaiting_payment' as any,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        advance_amount: amt,
        lender_upi: lenderUpi.trim(),
        payment_deadline: deadline,
        payment_status: 'unpaid',
        razorpay_order_id: null,
        razorpay_payment_id: null,
        payment_timestamp: null,
      })
      .eq('id', rental.id);

    setSubmitting(false);

    if (error) {
      if (error.code === '23505' || error.message?.includes('overlapping')) {
        setOverlapError('Cannot confirm: another rental overlaps these dates.');
        toast({ variant: 'destructive', title: 'Date conflict', description: 'These dates are reserved by another booking.' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to confirm', description: error.message });
      }
      return;
    }

    toast({ title: 'Booking sent for payment', description: `Renter has ${PAYMENT_WINDOW_MINUTES} minutes to pay the advance.` });
    onOpenChange(false);
    onConfirmed();
  };

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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Set the advance amount and your UPI ID. The renter will get {PAYMENT_WINDOW_MINUTES} minutes to pay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {overlapError && <p className="text-sm text-destructive font-medium">{overlapError}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Advance Amount (₹)</Label>
              <Input
                type="number"
                min={1}
                max={100000}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="500"
              />
            </div>
            <div>
              <Label className="text-xs">Your UPI ID</Label>
              <Input
                value={lenderUpi}
                onChange={(e) => setLenderUpi(e.target.value)}
                placeholder="lender@oksbi"
              />
            </div>
          </div>

          {dateRange?.from && dateRange?.to && !overlapError && (
            <div className="space-y-1 text-sm">
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-medium">{format(dateRange.from, 'MMM d')} – {format(dateRange.to, 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}

          {activeRentalBlock && <p className="text-sm text-destructive font-medium">{activeRentalBlock}</p>}

          <Button
            onClick={handleConfirm}
            disabled={submitting || !dateRange?.from || !dateRange?.to || !!overlapError || !!activeRentalBlock}
            className="w-full"
          >
            {submitting ? 'Sending...' : 'Confirm Booking & Request Payment'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Payment is collected via Razorpay. Your UPI is shared with the renter as a reference.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
