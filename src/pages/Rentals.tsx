import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Rental, RentalStatus } from '@/types/database';
import { format } from 'date-fns';
import { Calendar, Package, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG: Record<RentalStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-4 w-4" /> },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="h-4 w-4" /> },
  active: { label: 'Active', color: 'bg-green-100 text-green-800', icon: <Package className="h-4 w-4" /> },
  returned: { label: 'Returned', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="h-4 w-4" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
  disputed: { label: 'Disputed', color: 'bg-orange-100 text-orange-800', icon: <AlertTriangle className="h-4 w-4" /> },
};

export default function Rentals() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('renting');
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile) {
      fetchRentals();
    }
  }, [user, profile, navigate]);

  const fetchRentals = async () => {
    if (!profile) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        fit:fits(*),
        renter:profiles!rentals_renter_id_fkey(*),
        owner:profiles!rentals_owner_id_fkey(*)
      `)
      .or(`renter_id.eq.${profile.id},owner_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRentals(data as unknown as Rental[]);
    }
    setLoading(false);
  };

  const updateRentalStatus = async (rentalId: string, status: RentalStatus) => {
    const { error } = await supabase
      .from('rentals')
      .update({ status })
      .eq('id', rentalId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message,
      });
    } else {
      toast({
        title: 'Status updated',
        description: `Rental has been ${status}.`,
      });
      fetchRentals();
    }
  };

  const myRentals = rentals.filter(r => r.renter_id === profile?.id);
  const myListings = rentals.filter(r => r.owner_id === profile?.id);

  const RentalCard = ({ rental, isOwner }: { rental: Rental; isOwner: boolean }) => {
    const statusConfig = STATUS_CONFIG[rental.status];
    const fit = rental.fit;

    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {fit && (
            <div className="aspect-square w-full sm:w-32 shrink-0">
              <img
                src={fit.images?.[0] || '/placeholder.svg'}
                alt={fit.title}
                className="h-full w-full object-cover"
              />
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
              <div className="font-medium">
                ₹{rental.total_amount.toFixed(2)} total
              </div>
            </div>

            {isOwner && rental.status === 'pending' && (
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="terracotta"
                  onClick={() => updateRentalStatus(rental.id, 'confirmed')}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateRentalStatus(rental.id, 'cancelled')}
                >
                  Decline
                </Button>
              </div>
            )}

            {isOwner && rental.status === 'confirmed' && (
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => updateRentalStatus(rental.id, 'active')}
                >
                  Mark as Active
                </Button>
              </div>
            )}

            {rental.status === 'active' && (
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={() => updateRentalStatus(rental.id, 'returned')}
                >
                  Mark as Returned
                </Button>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-display text-5xl text-foreground">RENTALS</h1>
        <p className="mt-2 text-muted-foreground">
          Track your rental activity
        </p>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="renting">
              I'm Renting ({myRentals.length})
            </TabsTrigger>
            <TabsTrigger value="lending">
              I'm Lending ({myListings.length})
            </TabsTrigger>
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
                    <p className="mt-2 text-muted-foreground">
                      Browse fits and make your first rental
                    </p>
                    <Button variant="terracotta" asChild className="mt-4">
                      <a href="/browse">Browse Fits</a>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myRentals.map((rental) => (
                      <RentalCard key={rental.id} rental={rental} isOwner={false} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lending" className="mt-8">
                {myListings.length === 0 ? (
                  <div className="py-12 text-center">
                    <h3 className="font-display text-2xl">NO LENDING ACTIVITY</h3>
                    <p className="mt-2 text-muted-foreground">
                      List a fit to start earning
                    </p>
                    <Button variant="terracotta" asChild className="mt-4">
                      <a href="/upload">List a Fit</a>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myListings.map((rental) => (
                      <RentalCard key={rental.id} rental={rental} isOwner={true} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}
