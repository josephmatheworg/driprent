import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SIZES, REQUEST_CATEGORIES } from '@/types/database';
import { ImagePlus, X, Upload } from 'lucide-react';

const requestSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80, 'Title must be less than 80 characters'),
  description: z.string().trim().max(500, 'Description must be less than 500 characters').optional(),
  size: z.string().min(1, 'Please select a size'),
  category: z.enum(['menswear', 'womenswear', 'unisex']),
  date_needed: z.string().optional(),
  budget: z.number().min(50, 'Budget must be at least ₹50').max(10000, 'Budget must be less than ₹10,000').optional().or(z.literal(0)),
  location: z.string().trim().max(100).optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function CreateRequest() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) navigate('/auth');
  }, [user, navigate]);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 5MB.' });
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImage(null);
    setImagePreview(null);
  };

  const onSubmit = async (data: RequestFormData) => {
    if (!profile) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please complete your profile first.' });
      return;
    }

    setIsSubmitting(true);

    try {
      let referenceImageUrl: string | null = null;

      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user!.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('requests')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('requests').getPublicUrl(filePath);
        referenceImageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('outfit_requests').insert({
        user_id: profile.id,
        title: data.title,
        description: data.description || null,
        reference_image_url: referenceImageUrl,
        size: data.size,
        category: data.category,
        date_needed: data.date_needed || null,
        budget: data.budget && data.budget > 0 ? data.budget : null,
        location: data.location || null,
      });

      if (error) throw error;

      toast({ title: 'Request posted!', description: 'Your outfit request is now live.' });
      navigate('/requests');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Failed to post', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">POST A REQUEST</h1>
        <p className="mt-2 text-muted-foreground">
          Describe the outfit you're looking for and let the community help you find it.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          {/* Reference Photo */}
          <div>
            <Label className="text-base font-semibold">Reference Photo (optional)</Label>
            <p className="mt-1 text-sm text-muted-foreground">Upload an inspiration image. JPG or PNG, max 5MB.</p>
            <div className="mt-4">
              {imagePreview ? (
                <div className="group relative inline-block overflow-hidden rounded-xl">
                  <img src={imagePreview} alt="Reference" className="h-48 w-auto rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted transition-colors hover:border-primary hover:bg-accent">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">Add Photo</span>
                  <input type="file" accept="image/jpeg,image/png" onChange={handleImageSelect} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Request Title</Label>
            <Input
              id="title"
              placeholder='e.g., "Looking for a black blazer for a wedding"'
              {...register('title')}
              className="mt-1.5"
            />
            {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the event, preferred style, color, brand, and any special requirements..."
              {...register('description')}
              className="mt-1.5 min-h-32"
            />
            {errors.description && <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {/* Category & Size */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select onValueChange={(v) => setValue('category', v as any)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>}
            </div>

            <div>
              <Label>Size</Label>
              <Select onValueChange={(v) => setValue('size', v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {errors.size && <p className="mt-1 text-sm text-destructive">{errors.size.message}</p>}
            </div>
          </div>

          {/* Date & Budget */}
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <Label htmlFor="date_needed">Date Needed (optional)</Label>
              <Input
                id="date_needed"
                type="date"
                {...register('date_needed')}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="budget">Budget Per Day (₹) (optional)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 500"
                {...register('budget', { valueAsNumber: true })}
                className="mt-1.5"
              />
              {errors.budget && <p className="mt-1 text-sm text-destructive">{errors.budget.message}</p>}
            </div>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              placeholder="e.g., Mumbai, Delhi"
              {...register('location')}
              className="mt-1.5"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              variant="terracotta"
              size="lg"
              className="flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post Request'
              )}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
