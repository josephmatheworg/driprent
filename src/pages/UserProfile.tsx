import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Star, MapPin } from 'lucide-react';
import type { Profile, Fit, Review } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { haversineDistance, formatDistance } from '@/lib/distance';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [fits, setFits] = useState<Fit[]>([]);
  const [reviews, setReviews] = useState<(Review & { fit_title?: string })[]>([]);
  const [totalCompletedRentals, setTotalCompletedRentals] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);

    // Fetch profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!prof) { setLoading(false); return; }
    setProfileData(prof as unknown as Profile);

    // Fetch fits
    const { data: fitsData } = await supabase
      .from('fits')
      .select('*')
      .eq('owner_id', id)
      .order('created_at', { ascending: false });

    setFits((fitsData || []) as unknown as Fit[]);

    // Fetch completed rental count (as owner)
    const { count } = await supabase
      .from('rentals')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', id)
      .eq('status', 'completed');

    setTotalCompletedRentals(count || 0);

    // Fetch reviews for this user's fits
    const fitIds = (fitsData || []).map((f: any) => f.id);
    if (fitIds.length > 0) {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, username, avatar_url)')
        .in('reviewed_fit_id', fitIds)
        .order('created_at', { ascending: false });

      // Map fit titles onto reviews
      const fitMap = new Map((fitsData || []).map((f: any) => [f.id, f.title]));
      setReviews(
        (reviewsData || []).map((r: any) => ({
          ...r,
          fit_title: fitMap.get(r.reviewed_fit_id) || 'Unknown Outfit',
        }))
      );
    }

    setLoading(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
      />
    ));
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="h-24 w-24 mx-auto animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-8 w-48 mx-auto animate-pulse rounded bg-muted" />
        </div>
      </Layout>
    );
  }

  if (!profileData) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-4xl">USER NOT FOUND</h1>
          <p className="mt-2 text-muted-foreground">This profile may have been removed.</p>
        </div>
      </Layout>
    );
  }

  const displayLocation = [profileData.location_city, profileData.location_state, profileData.location_country].filter(Boolean).join(', ');
  const overallRating = profileData.rating ?? 0;
  const totalReviews = profileData.total_reviews ?? 0;

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Profile Header */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profileData.avatar_url || ''} />
            <AvatarFallback className="text-3xl">
              {profileData.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl sm:text-4xl">{profileData.username}</h1>
            {profileData.bio && (
              <p className="mt-1 text-muted-foreground max-w-md">{profileData.bio}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:justify-start sm:gap-4">
              {displayLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {displayLocation}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {overallRating > 0 ? overallRating.toFixed(1) : '0.0'}
              </span>
              <span>{totalReviews} reviews</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
              <span><strong className="text-foreground">{fits.length}</strong> fits listed</span>
              <span><strong className="text-foreground">{totalCompletedRentals}</strong> completed rentals</span>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Listed Fits */}
        <section>
          <h2 className="font-display text-2xl mb-4">LISTED FITS</h2>
          {fits.length === 0 ? (
            <p className="text-muted-foreground">No fits listed yet.</p>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {fits.map((fit) => (
                <Link key={fit.id} to={`/fit/${fit.id}`}>
                  <Card className="group overflow-hidden border-0 bg-card shadow-card transition-all duration-300 hover:shadow-card-hover">
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={fit.images?.[0] || '/placeholder.svg'}
                        alt={fit.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute left-2 top-2 flex gap-1">
                        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs">{fit.size}</Badge>
                      </div>
                      {!fit.is_available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
                          <Badge className="bg-background text-foreground text-xs">Rented</Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">{fit.title}</h3>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">₹{fit.daily_price}<span className="text-xs text-muted-foreground font-normal">/day</span></span>
                        {fit.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {fit.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <Separator className="my-8" />

        {/* Customer Reviews */}
        <section>
          <h2 className="font-display text-2xl mb-1">CUSTOMER REVIEWS</h2>
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <div className="flex">{renderStars(overallRating)}</div>
            <span>{overallRating > 0 ? overallRating.toFixed(1) : '0.0'} ({totalReviews} reviews)</span>
          </div>

          {reviews.length === 0 ? (
            <p className="text-muted-foreground">No reviews yet.</p>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="border-0 bg-card shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={review.reviewer?.avatar_url || ''} />
                        <AvatarFallback className="text-xs">
                          {(review.reviewer as any)?.username?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="font-medium text-sm text-foreground">{(review.reviewer as any)?.username || 'User'}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {renderStars(review.rating)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">for "{review.fit_title}"</p>
                        {review.comment && (
                          <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
