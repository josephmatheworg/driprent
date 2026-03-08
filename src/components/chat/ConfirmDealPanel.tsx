import { useState } from 'react';
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
import { format } from 'date-fns';
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(rental.start_date),
    to: new Date(rental.end_date),
  });

  const handleConfirm = async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({ variant: 'destructive', title: 'Please select dates' });
      return;
    }

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
      toast({ variant: 'destructive', title: 'Failed to confirm', description: error.message });
      return;
    }

    toast({ title: 'Deal confirmed!', description: 'The rental dates are now locked.' });
    onOpenChange(false);
    onConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Deal</DialogTitle>
          <DialogDescription>
            Confirm the rental dates for {rental.fit_title ? `"${rental.fit_title}"` : 'this outfit'}. Adjust if needed.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label className="mb-2 block text-sm font-medium">Rental Dates</Label>
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={setDateRange}
            disabled={(date) => date < new Date()}
            className={cn("rounded-md border pointer-events-auto")}
            numberOfMonths={1}
          />
        </div>

        {dateRange?.from && dateRange?.to && (
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
          disabled={confirming || !dateRange?.from || !dateRange?.to}
          className="w-full"
        >
          {confirming ? 'Confirming...' : 'Confirm Deal & Lock Dates'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
