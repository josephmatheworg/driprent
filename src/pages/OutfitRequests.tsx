import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SIZES, REQUEST_CATEGORIES } from '@/types/database';
import type { OutfitRequest } from '@/types/database';
import { Search, SlidersHorizontal, X, Plus, MessageSquare, Calendar, MapPin, IndianRupee, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type SortOption = 'newest' | 'most_replies' | 'urgent';

export default function OutfitRequests() {
  const [requests, setRequests] = useState<OutfitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [size, setSize] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  useEffect(() => {
    fetchRequests();
  }, [category, size, sortBy]);

  const fetchRequests = async () => {
    setLoading(true);

    let query = supabase
      .from('outfit_requests')
      .select(`*, user:profiles!outfit_requests_user_id_fkey(*)`)
      .order('created_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category as any);
    }
    if (size && size !== 'all') {
      query = query.eq('size', size);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch reply counts
      const requestIds = data.map((r: any) => r.id);
      let replyCounts: Record<string, number> = {};
      if (requestIds.length > 0) {
        const { data: counts } = await supabase
          .from('request_replies')
          .select('request_id')
          .in('request_id', requestIds);
        if (counts) {
          counts.forEach((c: any) => {
            replyCounts[c.request_id] = (replyCounts[c.request_id] || 0) + 1;
          });
        }
      }

      let enriched = data.map((r: any) => ({
        ...r,
        reply_count: replyCounts[r.id] || 0,
      })) as OutfitRequest[];

      // Sort
      if (sortBy === 'most_replies') {
        enriched.sort((a, b) => (b.reply_count || 0) - (a.reply_count || 0));
      } else if (sortBy === 'urgent') {
        enriched.sort((a, b) => {
          if (!a.date_needed) return 1;
          if (!b.date_needed) return -1;
          return new Date(a.date_needed).getTime() - new Date(b.date_needed).getTime();
        });
      }

      setRequests(enriched);
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRequests();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setSize('all');
    setSortBy('newest');
  };

  const hasActiveFilters = category !== 'all' || size !== 'all' || search;

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-primary/10 text-primary border-primary/20';
      case 'negotiating': return 'bg-drip-gold/10 text-drip-gold border-drip-gold/20';
      case 'fulfilled': return 'bg-muted text-muted-foreground border-border';
      case 'closed': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return '';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-4xl text-foreground sm:text-5xl">OUTFIT REQUESTS</h1>
            <p className="mt-2 text-muted-foreground">Find what you need or help others find their perfect fit</p>
          </div>
          <Button asChild variant="terracotta" size="lg">
            <Link to="/requests/create">
              <Plus className="mr-2 h-4 w-4" />
              Post Request
            </Link>
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="most_replies">Most Replies</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Active</span>
              )}
            </Button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-card animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Filters</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" /> Clear all
                </Button>
              )}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {REQUEST_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
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
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="font-display text-3xl text-foreground">NO REQUESTS FOUND</h3>
            <p className="mt-2 text-muted-foreground">Be the first to post an outfit request!</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/requests/create">Post a Request</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {requests.length} request{requests.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {requests.map((req) => (
                <Link key={req.id} to={`/requests/${req.id}`}>
                  <Card className="group overflow-hidden border-0 bg-card shadow-card transition-all duration-300 hover:shadow-card-hover h-full">
                    {/* Reference image */}
                    {req.reference_image_url ? (
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <img
                          src={req.reference_image_url}
                          alt={req.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute left-3 top-3">
                          <Badge className={`${statusColor(req.status)} border`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex aspect-[16/9] items-center justify-center bg-muted">
                        <span className="text-4xl text-muted-foreground/30">👗</span>
                        <div className="absolute left-3 top-3">
                          <Badge className={`${statusColor(req.status)} border`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <CardContent className="p-4">
                      <h3 className="line-clamp-2 font-medium text-foreground group-hover:text-primary transition-colors">
                        {req.title}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">{req.size}</Badge>
                        <Badge variant="secondary" className="capitalize">{req.category}</Badge>
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        {req.date_needed && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Needed by {new Date(req.date_needed).toLocaleDateString()}</span>
                          </div>
                        )}
                        {req.budget && (
                          <div className="flex items-center gap-1.5">
                            <IndianRupee className="h-3.5 w-3.5" />
                            <span>₹{req.budget}/day budget</span>
                          </div>
                        )}
                        {req.location && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{req.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {req.user && (
                            <>
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={req.user.avatar_url || ''} />
                                <AvatarFallback className="text-xs">
                                  {req.user.username?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{req.user.username}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {req.reply_count || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
