import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { FitCard } from '@/components/fits/FitCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIES, SIZES, type Fit, type FitCategory, type FitSize } from '@/types/database';
import { Search, SlidersHorizontal, X, Camera, ImageIcon, MapPin } from 'lucide-react';
import { ImageSearchModal } from '@/components/browse/ImageSearchModal';
import { useAuth } from '@/contexts/AuthContext';
import { haversineDistance, formatDistance } from '@/lib/distance';

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fits, setFits] = useState<Fit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<Fit[] | null>(null);

  // Filter states
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState<string>(searchParams.get('category') || 'all');
  const [size, setSize] = useState<string>(searchParams.get('size') || 'all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);

  useEffect(() => {
    fetchFits();
  }, [category, size, priceRange]);

  const fetchFits = async () => {
    setLoading(true);
    
    let query = supabase
      .from('fits')
      .select(`
        *,
        owner:profiles!fits_owner_id_fkey(*)
      `)
      .eq('is_available', true)
      .gte('daily_price', priceRange[0])
      .lte('daily_price', priceRange[1])
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category as FitCategory);
    }

    if (size && size !== 'all') {
      query = query.eq('size', size as FitSize);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,brand.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setFits(data as unknown as Fit[]);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFits();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setSize('all');
    setPriceRange([0, 500]);
    setSearchParams({});
    setImageSearchResults(null);
  };

  const handleImageSearchResults = (results: Fit[]) => {
    setImageSearchResults(results);
  };

  const clearImageSearch = () => {
    setImageSearchResults(null);
  };

  const hasActiveFilters = category !== 'all' || size !== 'all' || search || priceRange[0] > 0 || priceRange[1] < 500;
  
  const displayFits = imageSearchResults || fits;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-4xl text-foreground sm:text-5xl">BROWSE FITS</h1>
          <p className="mt-2 text-muted-foreground">Discover unique styles from our community</p>
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search fits, brands, styles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setImageSearchOpen(true)}
              title="Search by photo"
            >
              <Camera className="h-4 w-4" />
            </Button>
          </form>

          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="lg:ml-4"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                Active
              </span>
            )}
          </Button>
        </div>

        {/* Image Search Results Banner */}
        {imageSearchResults && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <span className="font-medium">Showing similar outfits from photo search</span>
              <span className="text-sm text-muted-foreground">({imageSearchResults.length} results)</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearImageSearch}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-card animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Filters</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Size</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All sizes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sizes</SelectItem>
                    {SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Label>Price Range: ${priceRange[0]} - ${priceRange[1]}/day</Label>
                <Slider
                  value={priceRange}
                  onValueChange={(value) => setPriceRange(value as [number, number])}
                  min={0}
                  max={500}
                  step={10}
                  className="mt-4"
                />
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading && !imageSearchResults ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : displayFits.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="font-display text-3xl text-foreground">NO FITS FOUND</h3>
            <p className="mt-2 text-muted-foreground">
              {imageSearchResults ? 'No similar outfits found. Try a different photo.' : 'Try adjusting your filters or search terms'}
            </p>
            {(hasActiveFilters || imageSearchResults) && (
              <Button variant="outline" onClick={imageSearchResults ? clearImageSearch : clearFilters} className="mt-4">
                {imageSearchResults ? 'Clear Photo Search' : 'Clear Filters'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {displayFits.length} fit{displayFits.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayFits.map((fit) => (
                <FitCard key={fit.id} fit={fit} />
              ))}
            </div>
          </>
        )}
      </div>

      <ImageSearchModal
        open={imageSearchOpen}
        onOpenChange={setImageSearchOpen}
        onResults={handleImageSearchResults}
      />
    </Layout>
  );
}
