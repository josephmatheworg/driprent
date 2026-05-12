import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface AwaitingPaymentCardProps {
  rental: {
    advance_amount?: number | null;
    payment_deadline?: string | null;
    fit_title?: string;
  };
}

function fmt(secs: number) {
  const m = Math.max(0, Math.floor(secs / 60));
  const s = Math.max(0, secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AwaitingPaymentCard({ rental }: AwaitingPaymentCardProps) {
  const [secsLeft, setSecsLeft] = useState<number>(() => {
    if (!rental.payment_deadline) return 0;
    return Math.max(0, Math.floor((new Date(rental.payment_deadline).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!rental.payment_deadline) return;
    const tick = () => {
      setSecsLeft(Math.max(0, Math.floor((new Date(rental.payment_deadline!).getTime() - Date.now()) / 1000)));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [rental.payment_deadline]);

  return (
    <Card className="mx-auto my-3 max-w-[92%] border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-3 space-y-1 text-center">
        <Badge className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
          <Clock className="h-3 w-3" /> Awaiting payment
        </Badge>
        <p className="text-sm">
          Waiting for renter to pay <span className="font-semibold">₹{Number(rental.advance_amount ?? 0).toFixed(0)}</span>
        </p>
        <div className={`font-mono text-xl font-bold tabular-nums ${secsLeft < 60 ? 'text-destructive' : 'text-foreground'}`}>
          {fmt(secsLeft)}
        </div>
        <p className="text-[10px] text-muted-foreground">Booking auto-expires when timer hits 0.</p>
      </CardContent>
    </Card>
  );
}
