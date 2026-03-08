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
import { CATEGORIES, SIZES, type FitCategory, type FitSize } from '@/types/database';
import { Upload, X, ImagePlus } from 'lucide-react';

const uploadSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(80, 'Title must be less than 80 characters'),
  description: z.string().trim().max(500, 'Description must be less than 500 characters').optional(),
  category: z.enum(['dresses', 'suits', 'streetwear', 'formal', 'casual', 'accessories', 'shoes', 'outerwear', 'vintage', 'designer']),
  size: z.enum(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']),
  brand: z.string().trim().max(50, 'Brand must be less than 50 characters').optional(),
  color: z.string().trim().max(30, 'Color must be less than 30 characters').optional(),
  daily_price: z.number().min(50, 'Price must be at least ₹50').max(10000, 'Price must be less than ₹10,000'),
  deposit_amount: z.number().min(0, 'Deposit cannot be negative').max(10000, 'Deposit must be less than ₹10,000'),
  condition: z.string().trim().optional(),
  care_instructions: z.string().trim().max(500, 'Care instructions must be less than 500 characters').optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function UploadFit() {
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      daily_price: 0,
      deposit_amount: 0,
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast({
        variant: 'destructive',
        title: 'Too many images',
        description: 'You can upload a maximum of 5 images.',
      });
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file',
          description: `${file.name} is not an image.`,
        });
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} is larger than 5MB.`,
        });
        return false;
      }
      return true;
    });

    setImages(prev => [...prev, ...validFiles]);
    validFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      setImageUrls(prev => [...prev, url]);
    });
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imageUrls[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const image of images) {
      const fileExt = image.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user!.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fits')
        .upload(filePath, image);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('fits').getPublicUrl(filePath);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  };

  const onSubmit = async (data: UploadFormData) => {
    if (!profile) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please complete your profile first.',
      });
      return;
    }

    if (images.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Images required',
        description: 'Please add at least one image of your fit.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrls = await uploadImages();

      const { error } = await supabase.from('fits').insert({
        owner_id: profile.id,
        title: data.title,
        description: data.description || null,
        category: data.category as FitCategory,
        size: data.size as FitSize,
        brand: data.brand || null,
        color: data.color || null,
        daily_price: data.daily_price,
        deposit_amount: data.deposit_amount,
        condition: data.condition || 'Excellent',
        care_instructions: data.care_instructions || null,
        images: uploadedUrls,
      });

      if (error) throw error;

      toast({
        title: 'Fit listed!',
        description: 'Your fit is now available for rent.',
      });
      navigate('/my-fits');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-5xl text-foreground">LIST YOUR FIT</h1>
        <p className="mt-2 text-muted-foreground">
          Share your style with the community and earn money from your wardrobe.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          {/* Images */}
          <div>
            <Label className="text-base font-semibold">Photos (up to 5)</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Add clear, well-lit photos of your fit from multiple angles.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {imageUrls.map((url, index) => (
                <div key={index} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <img src={url} alt={`Fit ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {images.length < 5 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted transition-colors hover:border-primary hover:bg-accent">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="mt-2 text-sm text-muted-foreground">Add Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g., Vintage Versace Silk Shirt"
                {...register('title')}
                className="mt-1.5"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select onValueChange={(value) => setValue('category', value as any)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="size">Size</Label>
              <Select onValueChange={(value) => setValue('size', value as any)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {SIZES.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.size && (
                <p className="mt-1 text-sm text-destructive">{errors.size.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="brand">Brand (optional)</Label>
              <Input
                id="brand"
                placeholder="e.g., Gucci, Nike, Vintage"
                {...register('brand')}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="color">Color (optional)</Label>
              <Input
                id="color"
                placeholder="e.g., Black, Multi-color"
                {...register('color')}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="condition">Condition</Label>
              <Select onValueChange={(value) => setValue('condition', value)} defaultValue="Excellent">
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New with tags">New with tags</SelectItem>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Tell renters about your fit - styling tips, occasions, etc."
              {...register('description')}
              className="mt-1.5 min-h-32"
            />
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display text-2xl">PRICING</h3>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="daily_price">Daily Rental Price ($)</Label>
                <Input
                  id="daily_price"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="50"
                  {...register('daily_price', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                {errors.daily_price && (
                  <p className="mt-1 text-sm text-destructive">{errors.daily_price.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="deposit_amount">Security Deposit ($)</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="100"
                  {...register('deposit_amount', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Refunded when the fit is returned in good condition
                </p>
              </div>
            </div>
          </div>

          {/* Care Instructions */}
          <div>
            <Label htmlFor="care_instructions">Care Instructions (optional)</Label>
            <Textarea
              id="care_instructions"
              placeholder="e.g., Dry clean only, Hand wash cold"
              {...register('care_instructions')}
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
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'List Fit'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
