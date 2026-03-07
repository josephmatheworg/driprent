import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { CATEGORIES } from '@/types/database';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
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
      </div>
    </div>
  );
}

function FitCard({ fit }: { fit: any }) {
  const imageUrl = fit.images?.[0] || '/placeholder.svg';
  return (
    <Link
      to={`/fit/${fit.id}`}
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:shadow-card-hover"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={imageUrl}
          alt={fit.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute bottom-2 right-2 rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground">
          ${fit.daily_price}/day
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-foreground line-clamp-1">{fit.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {fit.profiles?.username || 'Unknown'}
        </p>
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

  const { data: randomFits, isLoading: randomLoading } = useQuery({
    queryKey: ['random-fits'],
    queryFn: async () => {
      // Fetch more and shuffle client-side for randomness
      const { data, error } = await supabase
        .from('fits')
        .select('*, profiles!fits_owner_id_fkey(username, avatar_url)')
        .eq('is_available', true)
        .limit(20);
      if (error) throw error;
      // Shuffle
      const shuffled = (data || []).sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 6);
    },
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-16">
        {/* Section 1 — Recently Added Fits */}
        <section>
          <h2 className="font-display text-4xl text-foreground">RECENTLY ADDED</h2>
          <p className="mt-2 text-muted-foreground">Fresh fits just listed on the platform</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {recentLoading
              ? Array.from({ length: 8 }).map((_, i) => <FitCardSkeleton key={i} />)
              : recentFits && recentFits.length > 0
                ? recentFits.map((fit) => <FitCard key={fit.id} fit={fit} />)
                : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No fits listed yet. Be the first to upload!
                  </div>
                )}
          </div>
        </section>

        {/* Section 2 — Random Outfits */}
        <section>
          <h2 className="font-display text-4xl text-foreground">EXPLORE STYLES</h2>
          <p className="mt-2 text-muted-foreground">Discover something new every time</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
            {randomLoading
              ? Array.from({ length: 6 }).map((_, i) => <FitCardSkeleton key={i} />)
              : randomFits && randomFits.length > 0
                ? randomFits.map((fit) => <FitCard key={fit.id} fit={fit} />)
                : (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    No fits to explore yet.
                  </div>
                )}
          </div>
        </section>

        {/* Bottom Section — Browse Outfits */}
        <section>
          <h2 className="font-display text-4xl text-foreground">BROWSE OUTFITS</h2>
          <p className="mt-2 text-muted-foreground">Find the perfect fit for any occasion</p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
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
                  <span className="font-display text-2xl text-background md:text-3xl">
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
