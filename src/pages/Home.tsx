import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORIES } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

function HomeFitCard({ fit }: { fit: any }) {
  const imageUrl = fit.images?.[0] || '/placeholder.svg';
  const ownerUsername = fit.profiles?.username || 'Unknown';
  const ownerAvatar = fit.profiles?.avatar_url || '';

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
            ${fit.daily_price}/day
          </div>
        </div>
      </Link>
      <div className="p-3 sm:p-4">
        <Link to={`/fit/${fit.id}`}>
          <h3 className="font-medium text-foreground line-clamp-1 transition-colors group-hover:text-primary">
            {fit.title}
          </h3>
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarImage src={ownerAvatar} />
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {ownerUsername.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{ownerUsername}</span>
        </div>
        <Button
          variant="default"
          size="sm"
          className="mt-3 w-full"
          asChild
        >
          <Link to={`/fit/${fit.id}`}>Rent Fit</Link>
        </Button>
      </div>
    </div>
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

  const { data: randomFits, isLoading: randomLoading } = useQuery({
    queryKey: ['random-fits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fits')
        .select('*, profiles!fits_owner_id_fkey(username, avatar_url)')
        .eq('is_available', true)
        .limit(20);
      if (error) throw error;
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 6);
    },
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-12 sm:py-8 sm:space-y-16">
        {/* Section 1 — Recently Added Fits */}
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

        {/* Section 2 — Discover More Styles */}
        <section>
          <h2 className="font-display text-3xl text-foreground sm:text-4xl">DISCOVER MORE STYLES</h2>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2 sm:text-base">Explore new looks every time you visit</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {randomLoading
              ? Array.from({ length: 6 }).map((_, i) => <FitCardSkeleton key={i} />)
              : randomFits && randomFits.length > 0
                ? randomFits.map((fit) => <HomeFitCard key={fit.id} fit={fit} />)
                : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No fits to explore yet.
                  </div>
                )}
          </div>
        </section>

        {/* Bottom Section — Browse Outfits */}
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
      </div>
    </Layout>
  );
}
