import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Fit } from '@/types/database';
import { Star, ChevronLeft, ChevronRight, Shield, MapPin, Navigation } from 'lucide-react';
import { format, differenceInDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export default function FitDetail() {
  const { id } = useParams<{ id: string }>();
  const [fit, setFit] = useState<Fit | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isBooking, setIsBooking] = useState(false);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchFit();
      fetchBookedDates();
    }
  }, [id]);

  const fetchFit = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('fits')
      .select(`*, owner:profiles!fits_owner_id_fkey(*)`)
      .eq('id', id)
      .maybeSingle();
    if (!error && data) setFit(data as unknown as Fit);
    setLoading(false);
  };

  const fetchBookedDates = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('rentals')
      .select('start_date, end_date')
      .eq('fit_id', id)
      .in('status', ['confirmed', 'active'] as any);

    if (data) {
      const dates: Date[] = [];
      data.forEach(r => {
        const interval = eachDayOfInterval({
          start: new Date(r.start_date),
          end: new Date(r.end_date),
        });
        dates.push(...interval);
      });
      setBookedDates(dates);
    }
  };

  const isDateBooked = (date: Date) => bookedDates.some(d => isSameDay(d, date));

  const calculateTotal = () => {
    if (!dateRange?.from || !dateRange?.to || !fit) return null;
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    const rentalFee = days * fit.daily_price;
    const serviceFee = rentalFee * 0.1;
    const total = rentalFee + serviceFee + fit.deposit_amount;
    return { days, rentalFee, serviceFee, deposit: fit.deposit_amount, total };
  };

  const handleBooking = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!dateRange?.from || !dateRange?.to || !fit || !profile) {
      toast({ variant: 'destructive', title: 'Please select dates', description: 'Select your rental start and end dates to continue.' });
      return;
    }
    if (profile.id === fit.owner_id) {
      toast({ variant: 'destructive', title: 'Cannot rent your own fit', description: "You can't rent a fit that you own." });
      return;
    }

    // Check for overlap
    const selectedDays = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    const hasOverlap = selectedDays.some(d => isDateBooked(d));
    if (hasOverlap) {
      toast({ variant: 'destructive', title: 'Dates unavailable', description: 'Some selected dates are already booked.' });
      return;
    }

    setIsBooking(true);
    const totals = calculateTotal();
    if (!totals) return;

    const { error } = await supabase.from('rentals').insert({
      fit_id: fit.id,
      renter_id: profile.id,
      owner_id: fit.owner_id,
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
      total_days: totals.days,
      rental_fee: totals.rentalFee,
      deposit_amount: totals.deposit,
      service_fee: totals.serviceFee,
      total_amount: totals.total,
      status: 'pending',
    });

    setIsBooking(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Booking failed', description: error.message });
    } else {
      toast({ title: 'Booking submitted!', description: 'The owner will review your request.' });
      navigate('/rentals');
    }
  };

  const nextImage = () => {
    if (fit && fit.images.length > 1) setCurrentImageIndex((prev) => (prev + 1) % fit.images.length);
  };
  const prevImage = () => {
    if (fit && fit.images.length > 1) setCurrentImageIndex((prev) => (prev - 1 + fit.images.length) % fit.images.length);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            <div className="space-y-4">
              <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!fit) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-4xl">FIT NOT FOUND</h1>
          <p className="mt-2 text-muted-foreground">This fit may have been removed.</p>
          <Button asChild className="mt-4"><Link to="/browse">Browse Other Fits</Link></Button>
        </div>
      </Layout>
    );
  }

  const totals = calculateTotal();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Link to="/browse" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Browse
        </Link>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-card">
            <img src={fit.images[currentImageIndex] || '/placeholder.svg'} alt={fit.title} className="h-full w-full object-cover" />
            {fit.images.length > 1 && (
              <>
                <button onClick={prevImage} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextImage} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                  {fit.images.map((_, i) => (
                    <button key={i} onClick={() => setCurrentImageIndex(i)} className={`h-2 w-2 rounded-full transition-colors ${i === currentImageIndex ? 'bg-background' : 'bg-background/50'}`} />
                  ))}
                </div>
              </>
            )}
            {!fit.is_available && (
              <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                <Badge className="bg-background text-foreground text-lg px-4 py-2">Currently Rented</Badge>
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="secondary">{fit.size}</Badge>
              <Badge variant="secondary" className="capitalize">{fit.category}</Badge>
              {fit.brand && <Badge variant="outline">{fit.brand}</Badge>}
              {fit.condition && <Badge variant="outline">{fit.condition}</Badge>}
            </div>

            <h1 className="font-display text-3xl text-foreground sm:text-4xl lg:text-5xl">{fit.title}</h1>

            <div className="mt-4 flex items-center gap-4">
              <div>
                <span className="text-3xl font-bold text-foreground">₹{fit.daily_price}</span>
                <span className="text-muted-foreground"> / day</span>
              </div>
              {fit.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{fit.rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({fit.total_reviews} reviews)</span>
                </div>
              )}
            </div>

            {fit.deposit_amount > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">+ ₹{fit.deposit_amount} refundable deposit</p>
            )}

            <Separator className="my-6" />

            {/* Owner Info */}
            {fit.owner && (
              <div className="flex items-center gap-4 rounded-xl bg-card p-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={fit.owner.avatar_url || ''} />
                  <AvatarFallback>{fit.owner.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{fit.owner.username}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {fit.owner.location && (<><MapPin className="h-3 w-3" />{fit.owner.location}</>)}
                    {fit.owner.rating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {fit.owner.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {fit.description && (
              <div className="mb-6">
                <h3 className="mb-2 font-semibold">Description</h3>
                <p className="text-muted-foreground">{fit.description}</p>
              </div>
            )}
            {fit.care_instructions && (
              <div className="mb-6">
                <h3 className="mb-2 font-semibold">Care Instructions</h3>
                <p className="text-muted-foreground">{fit.care_instructions}</p>
              </div>
            )}

            {/* Booking Section */}
            {fit.is_available && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-card">
                <h3 className="mb-4 font-display text-2xl">SELECT DATES</h3>

                <div className="overflow-x-auto -mx-2 px-2">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={(date) => date < new Date() || isDateBooked(date)}
                    modifiers={{ booked: bookedDates }}
                    modifiersClassNames={{ booked: 'bg-destructive/20 text-destructive line-through' }}
                    className={cn("rounded-md border pointer-events-auto mx-auto")}
                    numberOfMonths={1}
                  />
                </div>

                {bookedDates.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="inline-block h-3 w-3 rounded bg-destructive/20 mr-1 align-middle" />
                    Dates marked in red are unavailable
                  </p>
                )}

                {totals && (
                  <div className="mt-6 space-y-2 border-t border-border pt-4">
                    <div className="flex justify-between text-sm">
                      <span>₹{fit.daily_price} x {totals.days} days</span>
                      <span>₹{totals.rentalFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Service fee (10%)</span>
                      <span>₹{totals.serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Refundable deposit</span>
                      <span>₹{totals.deposit.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>₹{totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <Button variant="terracotta" size="lg" className="mt-6 w-full" onClick={handleBooking} disabled={!dateRange?.from || !dateRange?.to || isBooking}>
                  {isBooking ? 'Submitting...' : user ? 'Request to Rent' : 'Sign In to Rent'}
                </Button>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  <span>Your payment is protected</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
