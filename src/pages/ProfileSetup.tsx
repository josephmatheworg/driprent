import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SelfieCamera, dataURLtoBlob } from '@/components/profile/SelfieCamera';
import { LocationField } from '@/components/profile/LocationField';
import { BackgroundDecor } from '@/components/layout/BackgroundDecor';
import { ArrowLeft, ArrowRight, Check, PartyPopper, Search } from 'lucide-react';

const STORAGE_KEY = 'driprent_setup_draft';
const TOTAL_STEPS = 4;

interface DraftData {
  phone: string;
  locationCity: string;
  locationState: string;
  locationCountry: string;
  bio: string;
}

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(data: DraftData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmedPhoto, setConfirmedPhoto] = useState<string | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Step 2 fields
  const [phone, setPhone] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');

  // Step 3 fields
  const [bio, setBio] = useState('');

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setPhone(draft.phone || '');
      setLocationCity(draft.locationCity || '');
      setLocationState(draft.locationState || '');
      setLocationCountry(draft.locationCountry || '');
      setBio(draft.bio || '');
    }
  }, []);

  // Also populate from existing profile
  useEffect(() => {
    if (profile) {
      if (!phone && profile.phone) setPhone(profile.phone);
      if (!locationCity && profile.location_city) setLocationCity(profile.location_city);
      if (!locationState && profile.location_state) setLocationState(profile.location_state);
      if (!locationCountry && profile.location_country) setLocationCountry(profile.location_country);
      if (!bio && profile.bio) setBio(profile.bio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Persist draft on field changes
  useEffect(() => {
    saveDraft({ phone, locationCity, locationState, locationCountry, bio });
  }, [phone, locationCity, locationState, locationCountry, bio]);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const progressPercent = ((step - 1) / TOTAL_STEPS) * 100;

  const validateStep = useCallback((): boolean => {
    if (step === 1) {
      if (!confirmedPhoto) {
        toast({ variant: 'destructive', title: 'Photo required', description: 'Please capture and confirm your selfie.' });
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!/^\+?[\d]{10,15}$/.test(phone.trim())) {
        toast({ variant: 'destructive', title: 'Invalid phone', description: 'Phone must be 10-15 digits.' });
        return false;
      }
      if (!locationCity.trim()) {
        toast({ variant: 'destructive', title: 'Location required', description: 'Please enter at least a city.' });
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!bio.trim() || bio.trim().length > 200) {
        toast({ variant: 'destructive', title: 'Bio required', description: 'Write a short bio (1-200 characters).' });
        return false;
      }
      return true;
    }
    return true;
  }, [step, confirmedPhoto, phone, locationCity, bio, toast]);

  const goNext = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 1));

  const hasPartialProgress = !!(confirmedPhoto || phone.trim() || locationCity.trim() || bio.trim());

  const handleBackToSignup = async () => {
    if (hasPartialProgress) {
      setShowLeaveDialog(true);
      return;
    }
    await performLeave();
  };

  const performLeave = async () => {
    clearDraft();
    await signOut();
    navigate('/signup');
  };

  const handleComplete = async () => {
    if (!profile || !user || !confirmedPhoto) return;
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
          bio: bio.trim(),
          phone: phone.trim(),
          location,
          location_city: locationCity.trim(),
          location_state: locationState.trim(),
          location_country: locationCountry.trim(),
          avatar_url: `${urlData.publicUrl}?t=${Date.now()}`,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      clearDraft();
      setStep(5); // success screen
    } catch (error: any) {
      console.error('Profile setup error:', error);
      toast({ variant: 'destructive', title: 'Setup failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  // Step 5 = success
  if (step === 5) {
    return (
      <BackgroundDecor>
        <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg">
            <div className="glass-card rounded-2xl p-6 shadow-soft-lg sm:p-8 text-center space-y-6">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>
              <h1 className="font-display text-2xl text-foreground sm:text-3xl">Your profile is ready!</h1>
              <p className="text-sm text-muted-foreground sm:text-base">You're all set to start browsing and renting outfits on DripRent.</p>
              <Button variant="hero" size="lg" className="w-full" onClick={() => navigate('/browse')}>
                <Search className="mr-2 h-4 w-4" /> Browse Fits
              </Button>
            </div>
          </div>
        </div>
      </BackgroundDecor>
    );
  }

  return (
    <BackgroundDecor>
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="glass-card rounded-2xl p-6 shadow-soft-lg sm:p-8">
            {/* Progress indicator */}
            <div className="mb-6 space-y-2">
              <p className="text-sm font-medium text-muted-foreground text-center">
                Step {step} of {TOTAL_STEPS}
              </p>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <div className="mb-6 text-center">
              <h1 className="font-display text-2xl text-foreground sm:text-3xl">
                {step === 1 && 'Profile Photo'}
                {step === 2 && 'Basic Information'}
                {step === 3 && 'About You'}
                {step === 4 && 'Review Profile'}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {step === 1 && 'Verify your face and capture a profile picture'}
                {step === 2 && 'Add your phone number and location'}
                {step === 3 && 'Write a short bio about yourself'}
                {step === 4 && 'Review your info before completing setup'}
              </p>
            </div>

            {/* Step 1 — Photo */}
            {step === 1 && (
              <div className="flex flex-col items-center">
                <SelfieCamera
                  autoStart
                  onPhotoConfirmed={setConfirmedPhoto}
                  currentAvatarUrl={profile?.avatar_url}
                />
              </div>
            )}

            {/* Step 2 — Phone & Location */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="setup-phone">Phone Number</Label>
                  <Input
                    id="setup-phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5"
                  />
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
            )}

            {/* Step 3 — Bio */}
            {step === 3 && (
              <div>
                <Label htmlFor="setup-bio">Bio</Label>
                <Textarea
                  id="setup-bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1.5"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">{bio.length}/200</p>
              </div>
            )}

            {/* Step 4 — Review */}
            {step === 4 && (
              <div className="space-y-4">
                {confirmedPhoto && (
                  <div className="flex justify-center">
                    <img
                      src={confirmedPhoto}
                      alt="Your selfie"
                      className="h-24 w-24 rounded-full object-cover border-2 border-primary sm:h-28 sm:w-28"
                    />
                  </div>
                )}
                <div className="divide-y divide-border rounded-lg border border-border">
                  <ReviewRow label="Phone" value={phone} />
                  <ReviewRow label="Location" value={[locationCity, locationState, locationCountry].filter(Boolean).join(', ')} />
                  <ReviewRow label="Bio" value={bio} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  You can edit these details later from your profile page.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 flex items-center gap-3">
              {step > 1 && (
                <Button type="button" variant="outline" className="flex-1" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button type="button" variant="hero" className="flex-1" onClick={goNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="hero"
                  className="flex-1"
                  onClick={handleComplete}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : <><Check className="mr-2 h-4 w-4" /> Complete Setup</>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </BackgroundDecor>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-xs font-medium text-muted-foreground sm:w-24 shrink-0">{label}</span>
      <span className="text-sm text-foreground break-words">{value || '—'}</span>
    </div>
  );
}
