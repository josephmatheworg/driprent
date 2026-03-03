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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Camera, MapPin, Star } from 'lucide-react';

const profileSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  full_name: z.string().trim().max(100, 'Name must be less than 100 characters').optional(),
  bio: z.string().trim().max(300, 'Bio must be less than 300 characters').optional(),
  location: z.string().trim().max(100, 'Location must be less than 100 characters').optional(),
  phone: z.string().trim().max(20, 'Phone must be less than 20 characters').regex(/^(\+?[\d\s\-()]*)?$/, 'Invalid phone number format').optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().trim().max(50).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile) {
      reset({
        username: profile.username,
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        phone: profile.phone || '',
        date_of_birth: profile.date_of_birth || '',
        gender: profile.gender || '',
      });
    }
  }, [user, profile, navigate, reset]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file',
          description: 'Please select an image file.',
        });
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Avatar must be less than 2MB.',
        });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return;

    setIsSaving(true);
    let avatarUrl = profile.avatar_url;

    try {
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user!.id}/avatar.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          full_name: data.full_name || null,
          bio: data.bio || null,
          location: data.location || null,
          phone: data.phone || null,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          avatar_url: avatarUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="h-20 w-20 mx-auto animate-pulse rounded-full bg-muted" />
          <div className="mt-4 h-8 w-48 mx-auto animate-pulse rounded bg-muted" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-5xl text-foreground">PROFILE</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || profile.avatar_url || ''} />
                <AvatarFallback className="text-2xl">
                  {profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-full bg-primary p-2 text-primary-foreground shadow-lg">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h2 className="font-display text-2xl">{profile.username}</h2>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profile.location}
                  </span>
                )}
                {profile.rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-drip-gold text-drip-gold" />
                    {profile.rating.toFixed(1)} ({profile.total_reviews} reviews)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...register('username')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...register('full_name')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell others about yourself and your style..."
                {...register('bio')}
                disabled={!isEditing}
                className="mt-1.5"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City, Country"
                  {...register('location')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  {...register('phone')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  {...register('date_of_birth')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="gender">Gender</Label>
                <Input
                  id="gender"
                  placeholder="e.g. Male, Female, Non-binary"
                  {...register('gender')}
                  disabled={!isEditing}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            {isEditing ? (
              <>
                <Button type="submit" variant="terracotta" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setAvatarFile(null);
                    setAvatarPreview(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
