import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateConversation } from '@/hooks/useConversations';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';
import type { Rental, RentalStatus } from '@/types/database';
import { format } from 'date-fns';
import { Calendar, Package, CheckCircle, XCircle, Clock, AlertTriangle, MessageSquare, Star, RotateCcw, Handshake } from 'lucide-react';

const STATUS_CONFIG: Record<RentalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
  accepted: { label: 'Accepted', color: 'bg-blue-100 text-blue-800', icon: <Handshake className="h-4 w-4" /> },
  confirmed: { label: 'Confirmed', color: 'bg-indigo-100 text-indigo-800', icon: <CheckCircle className="h-4 w-4" /> },
  active: { label: 'Active', color: 'bg-green-100 text-green-800', icon: <Package className="h-4 w-4" /> },
  returned: { label: 'Returned', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="h-4 w-4" /> },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-800', icon: <AlertTriangle className="h-4 w-4" /> },
};

export default function Rentals() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('renting');
  const [reviewTarget, setReviewTarget] = useState<{
    rentalId: string;
    reviewType: 'owner' | 'renter';
    reviewedUserId: string;
    reviewedFitId?: string;
  } | null>(null);
  const [existingReviews, setExistingReviews] = useState<Set<string>>(new Set());
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    if (profile) {
      fetchRentals();
      fetchMyReviews();
    }
  }, [user, profile, navigate]);

  const fetchRentals = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('rentals')
      .select(`*, fit:fits(*), renter:profiles!rentals_renter_id_fkey(*), owner:profiles!rentals_owner_id_fkey(*)`)
      .or(`renter_id.eq.${profile.id},owner_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    if (!error && data) setRentals(data as unknown as Rental[]);
    setLoading(false);
  };

  const fetchMyReviews = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('reviews')
      .select('rental_id, review_type')
      .eq('reviewer_id', profile.id);
    if (data) {
      setExistingReviews(new Set(data.map(r => `${r.rental_id}-${r.review_type}`)));
    }
  };

  const updateRentalStatus = async (rentalId: string, status: RentalStatus) => {
    const rental = rentals.find(r => r.id === rentalId);
    const { error } = await supabase
      .from('rentals')
      .update({ status: status as any })
      .eq('id', rentalId);

    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
      return;
    }

    if (status === 'accepted' && rental && profile) {
      await getOrCreateConversation(rental.owner_id, rental.renter_id);
    }

    toast({ title: 'Status updated', description: `Rental has been ${status}.` });
    fetchRentals();
  };

  const handleEarlyReturn = async (rental: Rental) => {
    const { error } = await supabase
      .from('rentals')
      .update({
        status: 'completed' as any,
        returned_at: new Date().toISOString(),
        end_date: format(new Date(), 'yyyy-MM-dd'),
      })
      .eq('id', rental.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed', description: error.message });
      return;
    }
    toast({ title: 'Outfit returned early', description: 'Remaining dates are now available.' });
    fetchRentals();
  };

  const handleMessage = async (rental: Rental) => {
    if (!profile) return;
    const otherId = profile.id === rental.owner_id ? rental.renter_id : rental.owner_id;
    const convoId = await getOrCreateConversation(profile.id, otherId);
    if (convoId) navigate(`/messages?conversation=${convoId}`);
  };

  const myRentals = rentals.filter(r => r.renter_id === profile?.id);
  const myListings = rentals.filter(r => r.owner_id === profile?.id);

  const canMessage = (rental: Rental) =>
    ['accepted', 'confirmed', 'active'].includes(rental.status);

  const canReview = (rental: Rental, isOwner: boolean) => {
    if (!['completed', 'returned'].includes(rental.status)) return false;
    const reviewType = isOwner ? 'renter' : 'owner';
    return !existingReviews.has(`${rental.id}-${reviewType}`);
  };

  const RentalCard = ({ rental, isOwner }: { rental: Rental; isOwner: boolean }) => {
    const statusConfig = STATUS_CONFIG[rental.status];
    const fit = rental.fit;

    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {fit && (
            <div className="aspect-square w-full sm:w-32 shrink-0">
              <img src={fit.images?.[0] || '/placeholder.svg'} alt={fit.title} className="h-full w-full object-cover" />
            </div>
          )}
          <CardContent className="flex-1 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{fit?.title || 'Fit'}</h3>
                <p className="text-sm text-muted-foreground">
                  {isOwner ? `Renter: ${rental.renter?.username}` : `Owner: ${rental.owner?.username}`}
                </p>
              </div>
              <Badge className={statusConfig.color}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {format(new Date(rental.start_date), 'MMM d')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}
              </div>
              <div className="font-medium">₹{rental.total_amount.toFixed(2)} total</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {isOwner && rental.status === 'pending' && (
                <>
                  <Button size="sm" variant="terracotta" onClick={() => updateRentalStatus(rental.id, 'accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateRentalStatus(rental.id, 'cancelled')}>
                    Decline
                  </Button>
                </>
              )}

              {isOwner && rental.status === 'confirmed' && (
                <Button size="sm" onClick={() => updateRentalStatus(rental.id, 'active')}>
                  Mark as Active
                </Button>
              )}

              {isOwner && rental.status === 'active' && (
                <>
                  <Button size="sm" onClick={() => updateRentalStatus(rental.id, 'completed')}>
                    Mark as Returned
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handleEarlyReturn(rental)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Returned Early
                  </Button>
                </>
              )}

              {canMessage(rental) && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleMessage(rental)}>
                  <MessageSquare className="h-4 w-4" /> Message
                </Button>
              )}

              {canReview(rental, isOwner) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setReviewTarget({
                      rentalId: rental.id,
                      reviewType: isOwner ? 'renter' : 'owner',
                      reviewedUserId: isOwner ? rental.renter_id : rental.owner_id,
                      reviewedFitId: isOwner ? undefined : rental.fit_id,
                    })
                  }
                >
                  <Star className="h-4 w-4" /> Leave Review
                </Button>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">RENTALS</h1>
        <p className="mt-2 text-muted-foreground">Track your rental activity</p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="renting">I'm Renting ({myRentals.length})</TabsTrigger>
            <TabsTrigger value="lending">I'm Lending ({myListings.length})</TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="mt-8 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="renting" className="mt-8">
                {myRentals.length === 0 ? (
                  <div className="py-12 text-center">
                    <h3 className="font-display text-2xl">NO RENTALS YET</h3>
                    <p className="mt-2 text-muted-foreground">Browse fits and make your first rental</p>
                    <Button variant="terracotta" asChild className="mt-4"><a href="/browse">Browse Fits</a></Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myRentals.map(rental => <RentalCard key={rental.id} rental={rental} isOwner={false} />)}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="lending" className="mt-8">
                {myListings.length === 0 ? (
                  <div className="py-12 text-center">
                    <h3 className="font-display text-2xl">NO LENDING ACTIVITY</h3>
                    <p className="mt-2 text-muted-foreground">List a fit to start earning</p>
                    <Button variant="terracotta" asChild className="mt-4"><a href="/upload">List a Fit</a></Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myListings.map(rental => <RentalCard key={rental.id} rental={rental} isOwner={true} />)}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {reviewTarget && (
        <ReviewDialog
          open={!!reviewTarget}
          onOpenChange={(open) => { if (!open) setReviewTarget(null); }}
          rentalId={reviewTarget.rentalId}
          reviewType={reviewTarget.reviewType}
          reviewedUserId={reviewTarget.reviewedUserId}
          reviewedFitId={reviewTarget.reviewedFitId}
          onReviewSubmitted={() => { fetchMyReviews(); setReviewTarget(null); }}
        />
      )}
    </Layout>
  );
}
