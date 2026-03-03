import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Fit } from '@/types/database';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

interface CreateOutfitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  editOutfit?: { id: string; name: string; item_ids: string[] } | null;
}

export function CreateOutfitModal({ open, onOpenChange, onCreated, editOutfit }: CreateOutfitModalProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [fits, setFits] = useState<Fit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && profile) {
      fetchMyFits();
      if (editOutfit) {
        setName(editOutfit.name);
        setSelectedIds(editOutfit.item_ids);
      } else {
        setName('');
        setSelectedIds([]);
      }
      setError('');
    }
  }, [open, profile, editOutfit]);

  const fetchMyFits = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('fits')
      .select('*')
      .eq('owner_id', profile.id)
      .order('created_at', { ascending: false });
    if (data) setFits(data as unknown as Fit[]);
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
    setError('');
  };

  const handleSave = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setError('Please enter an outfit name.');
      return;
    }
    if (selectedIds.length < 2) {
      setError('Select at least 2 items to create an outfit.');
      return;
    }

    setLoading(true);
    if (editOutfit) {
      const { error: dbError } = await supabase
        .from('outfits')
        .update({ name: name.trim(), item_ids: selectedIds })
        .eq('id', editOutfit.id);
      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }
      toast.success('Outfit updated');
    } else {
      const { error: dbError } = await supabase
        .from('outfits')
        .insert({ user_id: profile.id, name: name.trim(), item_ids: selectedIds });
      if (dbError) {
        setError(dbError.message);
        setLoading(false);
        return;
      }
      toast.success('Outfit created');
    }

    setLoading(false);
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editOutfit ? 'EDIT OUTFIT' : 'CREATE OUTFIT'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="outfit-name">Outfit Name</Label>
            <Input
              id="outfit-name"
              placeholder="e.g. Summer Vibes"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
            />
          </div>

          <div>
            <Label>Select Items (min 2)</Label>
            {fits.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                You have no fits yet. Upload some first!
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {fits.map(fit => {
                  const selected = selectedIds.includes(fit.id);
                  return (
                    <button
                      key={fit.id}
                      type="button"
                      onClick={() => toggleItem(fit.id)}
                      className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-muted-foreground'
                      }`}
                    >
                      <img
                        src={fit.images?.[0] || '/placeholder.svg'}
                        alt={fit.title}
                        className="h-full w-full object-cover"
                      />
                      {selected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <div className="rounded-full bg-primary p-1">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5 backdrop-blur-sm">
                        <p className="truncate text-xs font-medium text-foreground">{fit.title}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="terracotta" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : editOutfit ? 'Update Outfit' : 'Save Outfit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
