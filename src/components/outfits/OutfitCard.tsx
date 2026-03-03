import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import type { Fit } from '@/types/database';

interface OutfitCardProps {
  outfit: { id: string; name: string; item_ids: string[]; created_at: string };
  fits: Fit[];
  onEdit: () => void;
  onDelete: () => void;
}

export function OutfitCard({ outfit, fits, onEdit, onDelete }: OutfitCardProps) {
  const items = outfit.item_ids
    .map(id => fits.find(f => f.id === id))
    .filter(Boolean) as Fit[];

  const previews = items.slice(0, 4);

  return (
    <Card className="overflow-hidden border-0 bg-card shadow-card transition-all duration-300 hover:shadow-card-hover">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {previews.length > 0 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {previews.map((fit, i) => (
              <img
                key={fit.id}
                src={fit.images?.[0] || '/placeholder.svg'}
                alt={fit.title}
                className="h-full w-full object-cover"
                style={previews.length === 1 ? { gridColumn: '1 / -1', gridRow: '1 / -1' } : undefined}
              />
            ))}
            {previews.length === 2 && <div className="col-span-2 bg-muted" />}
            {previews.length === 3 && <div className="bg-muted" />}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No items
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/60 to-transparent p-3 pt-8">
          <span className="text-sm font-medium text-background">{items.length} items</span>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="line-clamp-1 font-medium text-foreground">{outfit.name}</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
