import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SelfieCamera, dataURLtoBlob } from '@/components/profile/SelfieCamera';
import { LocationField } from '@/components/profile/LocationField';
import { BackgroundDecor } from '@/components/layout/BackgroundDecor';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const setupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  gender: z.string().min(1, 'Gender is required'),
  bio: z.string().trim().min(1, 'Bio is required').max(200, 'Bio must be less than 200 characters'),
  phone: z.string().trim().min(1, 'Phone number is required').regex(/^\+?[\d]{10,15}$/, 'Phone must be 10-15 digits, only numbers and + allowed'),
});

type SetupFormData = z.infer<typeof setupSchema>;

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [confirmedPhoto, setConfirmedPhoto] = useState<string | null>(null);

  // Location state
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');

  const { register, handleSubmit, formState: { errors }, reset, setValue: setFormValue } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: { username: '', gender: '', bio: '', phone: '' },
  });

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      reset({
        username: profile.username || '',
        gender: profile.gender || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
      });
      setLocationCity(profile.location_city || '');
      setLocationState(profile.location_state || '');
      setLocationCountry(profile.location_country || '');
    }
  }, [profile, reset]);

  const onSubmit = async (data: SetupFormData) => {
    if (!confirmedPhoto) {
      toast({ variant: 'destructive', title: 'Photo required', description: 'Please capture and confirm your selfie.' });
      return;
    }
    if (!locationCity.trim()) {
      toast({ variant: 'destructive', title: 'Location required', description: 'Please enter at least a city.' });
      return;
    }
    if (!profile || !user) return;

    setIsSaving(true);
    try {
      const blob = dataURLtoBlob(confirmedPhoto);
      const fileName = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const location = [locationCity, locationState, locationCountry].filter(Boolean).join(', ');

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          gender: data.gender,
          bio: data.bio,
          phone: data.phone,
          location,
          location_city: locationCity.trim(),
          location_state: locationState.trim(),
          location_country: locationCountry.trim(),
          avatar_url: `${urlData.publicUrl}?t=${Date.now()}`,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: 'Profile setup complete!' });
      navigate('/home');
    } catch (error: any) {
      console.error('Profile setup error:', error);
      toast({ variant: 'destructive', title: 'Setup failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-hero-gradient">
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-8 text-center">
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">SET UP YOUR PROFILE</h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">Complete your profile to access the platform</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Selfie Camera */}
              <div>
                <Label>Profile Selfie</Label>
                <div className="mt-2">
                  <SelfieCamera
                    autoStart
                    onPhotoConfirmed={setConfirmedPhoto}
                    currentAvatarUrl={profile?.avatar_url}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="setup-username">Username</Label>
                  <Input id="setup-username" {...register('username')} className="mt-1.5" />
                  {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
                </div>
                <div>
                  <Label htmlFor="setup-gender">Gender</Label>
                  <Select onValueChange={(v) => setFormValue('gender', v)} defaultValue="">
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.gender && <p className="mt-1 text-sm text-destructive">{errors.gender.message}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="setup-bio">Bio</Label>
                <Textarea id="setup-bio" placeholder="Tell us about yourself..." {...register('bio')} className="mt-1.5" maxLength={200} />
                {errors.bio && <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              <div>
                <Label htmlFor="setup-phone">Phone Number</Label>
                <Input id="setup-phone" type="tel" placeholder="+91 9876543210" {...register('phone')} className="mt-1.5" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <LocationField
                city={locationCity}
                state={locationState}
                country={locationCountry}
                onCityChange={setLocationCity}
                onStateChange={setLocationState}
                onCountryChange={setLocationCountry}
              />

              <Button type="submit" variant="hero" className="mt-6 w-full" size="lg" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Complete Setup'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
