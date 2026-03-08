import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { Fit } from '@/types/database';

interface FitCardProps {
  fit: Fit;
}

export function FitCard({ fit }: FitCardProps) {
  const primaryImage = fit.images?.[0] || '/placeholder.svg';
  const { profile } = useAuth();

  return (
    <Link to={`/fit/${fit.id}`}>
      <Card className="group overflow-hidden border-0 bg-card shadow-card transition-all duration-300 hover:shadow-card-hover">
        <div className="relative aspect-[3/4] overflow-hidden">
          <img
            src={primaryImage}
            alt={fit.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">{fit.size}</Badge>
            {fit.brand && (
              <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">{fit.brand}</Badge>
            )}
          </div>

          {!fit.is_available && (
            <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
              <Badge className="bg-background text-foreground">Currently Rented</Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="line-clamp-1 font-medium text-foreground group-hover:text-primary transition-colors">
              {fit.title}
            </h3>
            {fit.rating > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-drip-gold text-drip-gold" />
                <span>{fit.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          <p className="text-sm capitalize text-muted-foreground">{fit.category}</p>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-lg font-semibold text-foreground">₹{fit.daily_price}</span>
              <span className="text-sm text-muted-foreground"> / day</span>
            </div>

            {fit.owner && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={fit.owner.avatar_url || ''} />
                  <AvatarFallback className="text-xs">
                    {fit.owner.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{fit.owner.username}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
