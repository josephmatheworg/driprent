import { useState, useRef, useCallback, useEffect } from 'react';
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
import { Camera, MapPin, Star, RotateCcw, Check, Loader2 } from 'lucide-react';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

const profileSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  gender: z.string().optional(),
  bio: z.string().trim().max(200, 'Bio must be less than 200 characters').optional(),
  phone: z.string().trim().regex(/^(\+?[\d]{10,15})?$/, 'Phone must be 10-15 digits, only numbers and + allowed').optional(),
  location: z.string().trim().min(1, 'Location is required').max(100, 'Location must be less than 100 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [confirmedImage, setConfirmedImage] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue: setFormValue } = useForm<ProfileFormData>({
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
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
      });
    }
  }, [user, profile, navigate, reset]);

  // Camera helpers
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      }, 100);
    } catch {
      setCameraError('Could not access camera. Please allow camera permissions in your browser settings.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
      setConfirmedImage(false);
      setPhotoChanged(true);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setConfirmedImage(false);
    startCamera();
  };

  const confirmPhoto = () => {
    setConfirmedImage(true);
  };

  const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  };

  // Geolocation
  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Geolocation not supported', description: 'Your browser does not support location detection.' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          const country = data.address?.country || '';
          const location = [city, state, country].filter(Boolean).join(', ');
          setFormValue('location', location);
        } catch {
          toast({ variant: 'destructive', title: 'Location failed', description: 'Could not detect your location.' });
        } finally {
          setGeoLoading(false);
        }
      },
      () => {
        toast({ variant: 'destructive', title: 'Location denied', description: 'Please allow location access or enter manually.' });
        setGeoLoading(false);
      }
    );
  };

  const enterEditMode = () => {
    setIsEditing(true);
    setCapturedImage(null);
    setConfirmedImage(false);
    setPhotoChanged(false);
    setCameraActive(false);
    setCameraError(null);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    stopCamera();
    setCapturedImage(null);
    setConfirmedImage(false);
    setPhotoChanged(false);
    if (profile) {
      reset({
        username: profile.username,
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
      });
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile || !user) return;

    if (photoChanged && capturedImage && !confirmedImage) {
      toast({ variant: 'destructive', title: 'Photo not confirmed', description: 'Please confirm your selfie before saving.' });
      return;
    }

    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (photoChanged && capturedImage && confirmedImage) {
        const blob = dataURLtoBlob(capturedImage);
        const fileName = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio || null,
          phone: data.phone || null,
          location: data.location || null,
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

  const displayImage = capturedImage || profile.avatar_url || '';

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-5xl text-foreground">PROFILE</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8">
          {/* Avatar Section */}
          <div className="flex items-center gap-6">
            <div className="relative">
              {isEditing && cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-24 w-24 rounded-full object-cover border-2 border-muted"
                />
              ) : (
                <Avatar className="h-24 w-24">
                  <AvatarImage src={displayImage} />
                  <AvatarFallback className="text-2xl">
                    {profile.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
                {(profile.rating ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-drip-gold text-drip-gold" />
                    {(profile.rating ?? 0).toFixed(1)} ({profile.total_reviews} reviews)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Camera controls when editing */}
          {isEditing && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {cameraActive ? (
                <Button type="button" size="sm" onClick={capturePhoto}>
                  <Camera className="mr-2 h-4 w-4" /> Capture Selfie
                </Button>
              ) : capturedImage && !confirmedImage ? (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Retake Selfie
                  </Button>
                  <Button type="button" size="sm" onClick={confirmPhoto}>
                    <Check className="mr-2 h-4 w-4" /> Confirm Photo
                  </Button>
                </>
              ) : capturedImage && confirmedImage ? (
                <>
                  <span className="text-sm font-medium text-primary flex items-center gap-1">
                    <Check className="h-4 w-4" /> Photo confirmed
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Retake Selfie
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                    <Camera className="mr-2 h-4 w-4" /> Retake Selfie
                  </Button>
                  {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Form Fields */}
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" {...register('username')} disabled={!isEditing} className="mt-1.5" />
                {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" placeholder="+919876543210" {...register('phone')} disabled={!isEditing} className="mt-1.5" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
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
                maxLength={200}
              />
              {errors.bio && <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>}
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <div className="mt-1.5 flex gap-2">
                <Input id="location" placeholder="City, Country" {...register('location')} disabled={!isEditing} className="flex-1" />
                {isEditing && (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 whitespace-nowrap" onClick={handleUseCurrentLocation} disabled={geoLoading}>
                    {geoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                    Use Your Current Location
                  </Button>
                )}
              </div>
              {errors.location && <p className="mt-1 text-sm text-destructive">{errors.location.message}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex gap-4">
            {isEditing ? (
              <>
                <Button type="submit" variant="terracotta" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" onClick={enterEditMode}>
                Edit Profile
              </Button>
            )}
          </div>
        </form>
      </div>
    </Layout>
  );
}
