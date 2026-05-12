import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentPanelProps {
  rental: {
    id: string;
    fit_title?: string;
    advance_amount?: number | null;
    payment_deadline?: string | null;
    payment_status?: string | null;
    status?: string;
    lender_upi?: string | null;
  };
  onPaid: () => void;
}

declare global {
  interface Window { Razorpay: any }
}

function fmt(secs: number) {
  const m = Math.max(0, Math.floor(secs / 60));
  const s = Math.max(0, secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PaymentPanel({ rental, onPaid }: PaymentPanelProps) {
  const { toast } = useToast();
  const [secsLeft, setSecsLeft] = useState<number>(() => {
    if (!rental.payment_deadline) return 0;
    return Math.max(0, Math.floor((new Date(rental.payment_deadline).getTime() - Date.now()) / 1000));
  });
  const [paying, setPaying] = useState(false);
  const expired = secsLeft <= 0;
  const isFailed = rental.payment_status === 'failed';

  useEffect(() => {
    if (!rental.payment_deadline) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(rental.payment_deadline!).getTime() - Date.now()) / 1000));
      setSecsLeft(left);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [rental.payment_deadline]);

  const handlePay = useCallback(async () => {
    if (paying || expired) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('razorpay-create-order', {
        body: { rental_id: rental.id },
      });
      if (error || !data?.orderId) {
        throw new Error(error?.message || data?.error || 'Failed to create payment order');
      }

      if (typeof window.Razorpay !== 'function') {
        throw new Error('Razorpay SDK not loaded. Please refresh.');
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        order_id: data.orderId,
        name: 'Drip Rent',
        description: rental.fit_title ? `Advance for ${rental.fit_title}` : 'Booking advance',
        prefill: {
          name: data.renterName || '',
          contact: data.renterPhone || '',
        },
        theme: { color: '#046A4E' },
        method: { upi: true, card: true, netbanking: true, wallet: true },
        handler: async (resp: any) => {
          try {
            const { data: vData, error: vErr } = await supabase.functions.invoke('razorpay-verify-payment', {
              body: {
                rental_id: rental.id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            });
            if (vErr || !vData?.ok) {
              toast({ variant: 'destructive', title: 'Verification failed', description: vErr?.message || vData?.error || 'Payment could not be verified' });
              return;
            }
            toast({ title: 'Payment successful', description: 'Booking confirmed!' });
            onPaid();
          } catch (e: any) {
            toast({ variant: 'destructive', title: 'Verification error', description: e.message });
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.on('payment.failed', (resp: any) => {
        toast({ variant: 'destructive', title: 'Payment failed', description: resp.error?.description || 'Try again' });
        setPaying(false);
      });
      rzp.open();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Payment error', description: e.message });
      setPaying(false);
    }
  }, [paying, expired, rental.id, rental.fit_title, onPaid, toast]);

  return (
    <Card className="mx-auto my-3 max-w-[92%] border-primary/30 bg-gradient-to-br from-primary/5 to-card shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Advance Payment</span>
          {expired ? (
            <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>
          ) : isFailed ? (
            <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" /> Failed — retry</Badge>
          ) : (
            <Badge className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"><Clock className="h-3 w-3" /> Pending</Badge>
          )}
        </div>

        <div className="text-center py-2">
          <div className="text-3xl font-bold text-foreground">₹{Number(rental.advance_amount ?? 0).toFixed(0)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {expired
              ? 'Booking expired due to payment timeout.'
              : `Pay within ${fmt(secsLeft)} to confirm your booking`}
          </p>
        </div>

        {!expired && (
          <div className="text-center">
            <div className={`inline-block font-mono text-2xl font-bold tabular-nums ${secsLeft < 60 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
              {fmt(secsLeft)}
            </div>
          </div>
        )}

        {rental.lender_upi && !expired && (
          <p className="text-[11px] text-muted-foreground text-center">
            Lender UPI (reference): <span className="font-mono">{rental.lender_upi}</span>
          </p>
        )}

        {!expired && (
          <Button onClick={handlePay} disabled={paying} className="w-full" size="lg">
            {paying ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening payment…</>) : (
              <>{isFailed ? 'Retry Payment' : 'Pay Now'} · ₹{Number(rental.advance_amount ?? 0).toFixed(0)}</>
            )}
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          Supports GPay, PhonePe, Paytm and all UPI apps · Secured by Razorpay
        </p>
      </CardContent>
    </Card>
  );
}
