import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { FitCard } from '@/components/fits/FitCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Fit } from '@/types/database';
import { Plus } from 'lucide-react';

export default function MyFits() {
  const [fits, setFits] = useState<Fit[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile) {
      fetchMyFits();
    }
  }, [user, profile, navigate]);

  const fetchMyFits = async () => {
    if (!profile) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('fits')
      .select(`
        *,
        owner:profiles!fits_owner_id_fkey(*)
      `)
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFits(data as unknown as Fit[]);
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-5xl text-foreground">MY FITS</h1>
            <p className="mt-2 text-muted-foreground">
              Manage the fits you've listed for rent
            </p>
          </div>
          <Button variant="terracotta" asChild>
            <Link to="/upload">
              <Plus className="mr-2 h-4 w-4" />
              Add New Fit
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : fits.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="font-display text-3xl text-foreground">NO FITS YET</h3>
            <p className="mt-2 text-muted-foreground">
              Start sharing your style by listing your first fit
            </p>
            <Button variant="terracotta" asChild className="mt-4">
              <Link to="/upload">
                <Plus className="mr-2 h-4 w-4" />
                List Your First Fit
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fits.map((fit) => (
              <FitCard key={fit.id} fit={fit} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
