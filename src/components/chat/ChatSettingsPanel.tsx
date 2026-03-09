import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Settings, Handshake, CalendarDays, XCircle, PackageCheck, CalendarPlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RentalInfo {
  id: string;
  fit_id: string;
  start_date: string;
  end_date: string;
  status: string;
  owner_id: string;
  renter_id: string;
  fit_title?: string;
}

interface ChatSettingsPanelProps {
  rental: RentalInfo | null;
  isOwner: boolean;
  onConfirmDeal: () => void;
  onRentalUpdated: () => void;
}

export function ChatSettingsPanel({ rental, isOwner, onConfirmDeal, onRentalUpdated }: ChatSettingsPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [newEndDate, setNewEndDate] = useState<Date | undefined>(undefined);
  const [extendError, setExtendError] = useState<string | null>(null);

  const canConfirm = isOwner && rental && rental.status === 'accepted';
  const canCancel = isOwner && rental && ['accepted', 'confirmed'].includes(rental.status) &&
    new Date(rental.start_date) > new Date();
  const canMarkReturned = isOwner && rental && ['confirmed', 'active'].includes(rental.status);
  const canExtend = isOwner && rental && ['confirmed', 'active'].includes(rental.status);

  const handleCancel = async () => {
    if (!rental) return;
    setProcessing(true);
    const { error } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' as any })
      .eq('id', rental.id);
    setProcessing(false);
    setShowCancelDialog(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to cancel', description: error.message });
      return;
    }
    toast({ title: 'Deal cancelled', description: 'The rental has been cancelled and dates released.' });
    setOpen(false);
    onRentalUpdated();
  };

  const handleMarkReturned = async () => {
    if (!rental) return;
    setProcessing(true);
    const { error } = await supabase
      .from('rentals')
      .update({
        status: 'completed' as any,
        returned_at: new Date().toISOString(),
        return_notes: 'Marked as returned early by owner',
      })
      .eq('id', rental.id);
    setProcessing(false);
    setShowReturnDialog(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to update', description: error.message });
      return;
    }
    toast({ title: 'Outfit returned', description: 'The rental is complete and dates have been released.' });
    setOpen(false);
    onRentalUpdated();
  };

  const handleExtend = async () => {
    if (!rental || !newEndDate) return;
    setExtendError(null);
    setProcessing(true);

    const newEnd = format(newEndDate, 'yyyy-MM-dd');

    // Check for overlapping rentals on this outfit
    const { data: overlaps } = await supabase
      .from('rentals')
      .select('id')
      .eq('fit_id', rental.fit_id)
      .neq('id', rental.id)
      .in('status', ['confirmed', 'active'] as any)
      .lte('start_date', newEnd)
      .gte('end_date', rental.end_date);

    if (overlaps && overlaps.length > 0) {
      setExtendError('Outfit unavailable for selected dates — another rental overlaps.');
      setProcessing(false);
      return;
    }

    const totalDays = Math.ceil((newEndDate.getTime() - new Date(rental.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { error } = await supabase
      .from('rentals')
      .update({ end_date: newEnd, total_days: totalDays })
      .eq('id', rental.id);

    setProcessing(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to extend', description: error.message });
      return;
    }

    toast({ title: 'Rental extended', description: `New end date: ${format(newEndDate, 'MMM d, yyyy')}` });
    setShowExtendDialog(false);
    setOpen(false);
    onRentalUpdated();
  };

  if (!rental) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] sm:w-[360px]">
          <SheetHeader>
            <SheetTitle className="font-display text-lg">DEAL SETTINGS</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {canConfirm && (
              <Button
                variant="terracotta"
                className="w-full justify-start gap-2 min-h-[44px]"
                onClick={() => { setOpen(false); onConfirmDeal(); }}
              >
                <Handshake className="h-4 w-4" /> Confirm Deal
              </Button>
            )}

            {canExtend && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 min-h-[44px]"
                onClick={() => {
                  setNewEndDate(new Date(rental.end_date));
                  setExtendError(null);
                  setShowExtendDialog(true);
                }}
              >
                <CalendarPlus className="h-4 w-4" /> Extend Rental
              </Button>
            )}

            {canCancel && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 min-h-[44px] text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setShowCancelDialog(true)}
              >
                <XCircle className="h-4 w-4" /> Cancel Deal
              </Button>
            )}

            {canMarkReturned && (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 min-h-[44px]"
                onClick={() => setShowReturnDialog(true)}
              >
                <PackageCheck className="h-4 w-4" /> Mark Outfit Returned
              </Button>
            )}

            {!canConfirm && !canCancel && !canMarkReturned && !canExtend && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No actions available for this rental.
              </p>
            )}

            <Separator />
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Rental Status</p>
              <p className="font-medium capitalize">{rental.status}</p>
            </div>
            {rental.fit_title && (
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Outfit</p>
                <p className="font-medium">{rental.fit_title}</p>
              </div>
            )}
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Dates</p>
              <p className="font-medium">
                {format(new Date(rental.start_date), 'MMM d')} – {format(new Date(rental.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this rental?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this rental? The blocked calendar dates will be released and the outfit will become available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Keep Deal</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={processing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {processing ? 'Cancelling…' : 'Yes, Cancel Deal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return Confirmation */}
      <AlertDialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark outfit as returned?</AlertDialogTitle>
            <AlertDialogDescription>
              This will complete the rental and release any remaining blocked dates so the outfit becomes available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Not Yet</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkReturned} disabled={processing}>
              {processing ? 'Updating…' : 'Yes, Mark Returned'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Extend Rental Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Extend Rental</DialogTitle>
            <DialogDescription>
              Select a new end date for {rental.fit_title ? `"${rental.fit_title}"` : 'this rental'}.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label className="mb-2 block text-sm font-medium">New End Date</Label>
            <Calendar
              mode="single"
              selected={newEndDate}
              onSelect={setNewEndDate}
              disabled={(date) => date <= new Date(rental.end_date)}
              className={cn("rounded-md border pointer-events-auto")}
            />
          </div>

          {extendError && (
            <p className="text-sm text-destructive">{extendError}</p>
          )}

          {newEndDate && (
            <div className="text-sm">
              <Separator className="mb-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">New end date</span>
                <span className="font-medium">{format(newEndDate, 'MMM d, yyyy')}</span>
              </div>
            </div>
          )}

          <Button onClick={handleExtend} disabled={processing || !newEndDate} className="w-full">
            {processing ? 'Extending…' : 'Extend Rental'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
