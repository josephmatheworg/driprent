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
import { Settings, Handshake, CalendarDays, XCircle, PackageCheck } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [processing, setProcessing] = useState(false);

  const canConfirm = isOwner && rental && rental.status === 'accepted';
  const canCancel = isOwner && rental && ['accepted', 'confirmed'].includes(rental.status) &&
    new Date(rental.start_date) > new Date();
  const canMarkReturned = isOwner && rental && ['confirmed', 'active'].includes(rental.status);

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

            {!canConfirm && !canCancel && !canMarkReturned && (
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
    </>
  );
}
