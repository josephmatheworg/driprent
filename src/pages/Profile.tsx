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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Star } from 'lucide-react';
import { SelfieCamera, dataURLtoBlob } from '@/components/profile/SelfieCamera';
import { LocationField } from '@/components/profile/LocationField';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const profileSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  gender: z.string().optional(),
  bio: z.string().trim().max(200, 'Bio must be less than 200 characters').optional(),
  phone: z.string().trim().regex(/^(\+?[\d]{10,15})?$/, 'Phone must be 10-15 digits').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Photo state
  const [confirmedPhoto, setConfirmedPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  // Location state
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, setValue: setFormValue } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const resetFormFromProfile = () => {
    if (!profile) return;
    reset({
      username: profile.username,
      gender: profile.gender || '',
      bio: profile.bio || '',
      phone: profile.phone || '',
    });
    setLocationCity(profile.location_city || '');
    setLocationState(profile.location_state || '');
    setLocationCountry(profile.location_country || '');
  };

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    resetFormFromProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, navigate]);

  const enterEditMode = () => {
    setIsEditing(true);
    setConfirmedPhoto(null);
    setPhotoChanged(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setConfirmedPhoto(null);
    setPhotoChanged(false);
    resetFormFromProfile();
  };

  const handlePhotoConfirmed = (dataUrl: string) => {
    setConfirmedPhoto(dataUrl);
    setPhotoChanged(true);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile || !user) return;

    if (photoChanged && !confirmedPhoto) {
      toast({ variant: 'destructive', title: 'Photo not confirmed', description: 'Please confirm your selfie before saving.' });
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (photoChanged && confirmedPhoto) {
        const blob = dataURLtoBlob(confirmedPhoto);
        const fileName = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const location = [locationCity, locationState, locationCountry].filter(Boolean).join(', ');

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          gender: data.gender || null,
          bio: data.bio || null,
          phone: data.phone || null,
          location,
          location_city: locationCity.trim() || null,
          location_state: locationState.trim() || null,
          location_country: locationCountry.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      setPhotoChanged(false);
      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
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

  const displayLocation = [profile.location_city, profile.location_state, profile.location_country].filter(Boolean).join(', ') || profile.location;

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">PROFILE</h1>

        {/* Avatar Section */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
            <AvatarImage src={confirmedPhoto || profile.avatar_url || ''} />
            <AvatarFallback className="text-2xl">
              {profile.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h2 className="font-display text-2xl">{profile.username}</h2>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:justify-start sm:gap-4">
              {displayLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {displayLocation}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {((profile.rating ?? 0) > 0 ? (profile.rating ?? 0).toFixed(1) : '0.0')} rating
              </span>
              <span>{profile.total_reviews ?? 0} reviews</span>
            </div>
          </div>
        </div>

        {/* Camera in edit mode */}
        {isEditing && (
          <div className="mt-4">
            <SelfieCamera
              onPhotoConfirmed={handlePhotoConfirmed}
              currentAvatarUrl={profile.avatar_url}
            />
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Editable Fields */}
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" {...register('username')} className="mt-1.5" />
                  {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select onValueChange={(v) => setFormValue('gender', v)} defaultValue={profile.gender || ''}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+91 9876543210" {...register('phone')} className="mt-1.5" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" placeholder="Tell others about yourself..." {...register('bio')} className="mt-1.5" maxLength={200} />
                {errors.bio && <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              <LocationField
                city={locationCity}
                state={locationState}
                country={locationCountry}
                onCityChange={setLocationCity}
                onStateChange={setLocationState}
                onCountryChange={setLocationCountry}
              />
            </div>

            {/* Edit Mode Actions */}
            <div className="mt-8 flex gap-4">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            {/* Read-only Fields */}
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Username</Label>
                  <Input value={profile.username} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Input value={profile.gender || 'Not set'} disabled className="mt-1.5" />
                </div>
              </div>

              <div>
                <Label>Phone</Label>
                <Input value={profile.phone || 'Not set'} disabled className="mt-1.5" />
              </div>

              <div>
                <Label>Bio</Label>
                <Textarea value={profile.bio || 'Not set'} disabled className="mt-1.5" />
              </div>

              <LocationField
                city={profile.location_city || ''}
                state={profile.location_state || ''}
                country={profile.location_country || ''}
                onCityChange={() => {}}
                onStateChange={() => {}}
                onCountryChange={() => {}}
                disabled
              />
            </div>

            {/* View Mode Action */}
            <div className="mt-8">
              <Button type="button" onClick={enterEditMode}>
                Edit Profile
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
