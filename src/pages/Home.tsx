import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIES } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { haversineDistance, formatDistance } from '@/lib/distance';
import { MapPin } from 'lucide-react';
import heroFashion from '@/assets/hero-fashion.jpg';
import categoryDresses from '@/assets/category-dresses.jpg';
import categorySuits from '@/assets/category-suits.jpg';
import categoryStreetwear from '@/assets/category-streetwear.jpg';
import categoryFormal from '@/assets/category-formal.jpg';
import categoryCasual from '@/assets/category-casual.jpg';
import categoryAccessories from '@/assets/category-accessories.jpg';
import categoryShoes from '@/assets/category-shoes.jpg';
import categoryOuterwear from '@/assets/category-outerwear.jpg';
import categoryVintage from '@/assets/category-vintage.jpg';
import categoryDesigner from '@/assets/category-designer.jpg';

const categoryImages: Record<string, string> = {
  dresses: categoryDresses,
  suits: categorySuits,
  streetwear: categoryStreetwear,
  formal: categoryFormal,
  casual: categoryCasual,
  accessories: categoryAccessories,
  shoes: categoryShoes,
  outerwear: categoryOuterwear,
  vintage: categoryVintage,
  designer: categoryDesigner,
};

function FitCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-full mt-2" />
      </div>
    </div>
  );
}

function HomeFitCard({ fit, myLat, myLng }: { fit: any; myLat?: number | null; myLng?: number | null }) {
  const imageUrl = fit.images?.[0] || '/placeholder.svg';
  const ownerUsername = fit.profiles?.username || 'Unknown';
  const ownerAvatar = fit.profiles?.avatar_url || '';
  const ownerLat = fit.profiles?.latitude;
  const ownerLng = fit.profiles?.longitude;

  const distanceText = (ownerLat && ownerLng && myLat && myLng)
    ? formatDistance(haversineDistance(myLat, myLng, ownerLat, ownerLng))
    : null;

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/30">
      <Link to={`/fit/${fit.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={imageUrl}
            alt={fit.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-foreground backdrop-blur-sm">
            ₹{fit.daily_price} / day
          </div>
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <Link to={`/fit/${fit.id}`}>
          <h3 className="font-medium text-foreground line-clamp-1 transition-colors group-hover:text-primary">
            {fit.title}
          </h3>
        </Link>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={ownerAvatar} />
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {ownerUsername.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{ownerUsername}</span>
          </div>
          {distanceText && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
              <MapPin className="h-3 w-3" />{distanceText}
            </span>
          )}
        </div>
        <Button variant="default" size="sm" className="mt-3 w-full" asChild>
          <Link to={`/fit/${fit.id}`}>Rent Fit</Link>
        </Button>
      </div>
    </div>
  );
}

function TrendingFitCard({ fit }: { fit: any }) {
  const imageUrl = fit.images?.[0] || '/placeholder.svg';
  const ownerUsername = fit.profiles?.username || 'Unknown';
  const ownerAvatar = fit.profiles?.avatar_url || '';

  return (
    <div className="group w-56 shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover hover:border-primary/30 sm:w-64">
      <Link to={`/fit/${fit.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden">
          <img src={imageUrl} alt={fit.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-3 py-1 text-sm font-semibold text-foreground backdrop-blur-sm">
            ₹{fit.daily_price} / day
          </div>
        </div>
      </Link>
      <div className="p-3">
        <h3 className="font-medium text-foreground line-clamp-1 text-sm">{fit.title}</h3>
        <div className="mt-1.5 flex items-center gap-2">
          <Avatar className="h-4 w-4">
            <AvatarImage src={ownerAvatar} />
            <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">{ownerUsername.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{ownerUsername}</span>
        </div>
      </div>
    </div>
  );
}

function CommunityCard({ fit }: { fit: any }) {
  const imageUrl = fit.images?.[0] || '/placeholder.svg';
  const ownerUsername = fit.profiles?.username || 'Unknown';
  const ownerAvatar = fit.profiles?.avatar_url || '';

  return (
    <Link to={`/fit/${fit.id}`} className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover">
      <div className="aspect-square overflow-hidden">
        <img src={imageUrl} alt={fit.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
      </div>
      <div className="flex items-center gap-2 p-3">
        <Avatar className="h-6 w-6">
          <AvatarImage src={ownerAvatar} />
          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">{ownerUsername.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-foreground truncate font-medium">{ownerUsername}</span>
      </div>
    </Link>
  );
}

export default function Home() {
  const { data: recentFits, isLoading: recentLoading } = useQuery({
    queryKey: ['recent-fits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fits')
        .select('*, profiles!fits_owner_id_fkey(username, avatar_url)')
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const { data: trendingFits, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending-fits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fits')
        .select('*, profiles!fits_owner_id_fkey(username, avatar_url)')
        .eq('is_available', true)
        .order('total_rentals', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const { data: communityFits, isLoading: communityLoading } = useQuery({
    queryKey: ['community-fits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fits')
        .select('*, profiles!fits_owner_id_fkey(username, avatar_url)')
        .eq('is_available', true)
        .limit(20);
      if (error) throw error;
      return (data || []).sort(() => Math.random() - 0.5).slice(0, 6);
    },
  });

  return (
    <Layout>
      {/* Section 1 — Hero Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroFashion} alt="Fashion" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent" />
        </div>
        <div className="container relative mx-auto flex min-h-[320px] items-center px-4 py-16 sm:min-h-[400px] sm:py-20">
          <div className="max-w-lg">
            <h1 className="font-display text-4xl text-white sm:text-5xl md:text-6xl">
              DISCOVER UNIQUE FITS FROM YOUR COMMUNITY
            </h1>
            <p className="mt-3 text-base text-white/80 sm:mt-4 sm:text-lg">
              Rent designer outfits, streetwear, and more from people near you.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link to="/browse">Browse Fits</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6 space-y-12 sm:py-8 sm:space-y-16">
        {/* Section 2 — Recently Added Fits */}
        <section>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">RECENTLY ADDED</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Fresh fits just listed on the platform</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {recentLoading
              ? Array.from({ length: 8 }).map((_, i) => <FitCardSkeleton key={i} />)
              : recentFits && recentFits.length > 0
                ? recentFits.map((fit) => <HomeFitCard key={fit.id} fit={fit} />)
                : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No fits listed yet. Be the first to upload!
                  </div>
                )}
          </div>
        </section>

        {/* Section 3 — Trending Fits */}
        <section>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">TRENDING FITS</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Most popular outfits on the platform</p>
          <div className="mt-6">
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-4 sm:gap-4">
                {trendingLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="w-56 shrink-0 sm:w-64">
                        <Skeleton className="aspect-[3/4] w-full rounded-2xl" />
                        <div className="mt-2 space-y-1">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))
                  : trendingFits && trendingFits.length > 0
                    ? trendingFits.map((fit) => <TrendingFitCard key={fit.id} fit={fit} />)
                    : (
                      <div className="py-12 text-center text-muted-foreground w-full">
                        No trending fits yet.
                      </div>
                    )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </section>

        {/* Section 4 — Browse Outfits Categories */}
        <section>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">BROWSE OUTFITS</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Find the perfect fit for any occasion</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category, index) => (
              <Link
                key={category.value}
                to={`/browse?category=${category.value}`}
                className="group relative aspect-square overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:shadow-card-hover"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <img
                  src={categoryImages[category.value]}
                  alt={category.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20 transition-opacity group-hover:from-black/90" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display text-xl text-background sm:text-2xl md:text-3xl">
                    {category.label.toUpperCase()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Section 5 — Community Showcase */}
        <section>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">COMMUNITY SHOWCASE</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">See what others are sharing</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {communityLoading
              ? Array.from({ length: 6 }).map((_, i) => <FitCardSkeleton key={i} />)
              : communityFits && communityFits.length > 0
                ? communityFits.map((fit) => <CommunityCard key={fit.id} fit={fit} />)
                : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No community fits to show yet.
                  </div>
                )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
