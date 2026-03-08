import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Camera, RotateCcw, Check } from 'lucide-react';

const setupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  bio: z.string().trim().min(1, 'Bio is required').max(200, 'Bio must be less than 200 characters'),
  phone: z.string().trim().min(1, 'Phone number is required').regex(/^\+?[\d]{10,15}$/, 'Phone must be 10-15 digits, only numbers and + allowed'),
  location: z.string().trim().min(1, 'Location is required').max(100),
});

type SetupFormData = z.infer<typeof setupSchema>;

export default function ProfileSetup() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      username: profile?.username || '',
      bio: '',
      phone: '',
      location: '',
    },
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (profile) {
      reset({
        username: profile.username || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
      });
    }
  }, [profile, reset]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      // Use timeout to ensure videoRef is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(
        'Could not access camera. Please allow camera permissions in your browser settings and reload this page.'
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  // Auto-start camera on mount
  useEffect(() => {
    if (user && !capturedImage && !cameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
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
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(dataUrl);
      setConfirmed(false);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setConfirmed(false);
    startCamera();
  };

  const confirmPhoto = () => {
    setConfirmed(true);
  };

  const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
    return new Blob([u8arr], { type: mime });
  };

  const onSubmit = async (data: SetupFormData) => {
    if (!capturedImage || !confirmed) {
      toast({ variant: 'destructive', title: 'Photo required', description: 'Please capture and confirm your selfie.' });
      return;
    }
    if (!profile || !user) return;

    setIsSaving(true);
    try {
      const blob = dataURLtoBlob(capturedImage);
      const fileName = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio,
          phone: data.phone,
          location: data.location,
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
              {/* Photo Section — Selfie Camera Only */}
              <div>
                <Label>Profile Selfie</Label>
                <div className="mt-2 flex flex-col items-center gap-3">
                  {capturedImage ? (
                    <>
                      <img
                        src={capturedImage}
                        alt="Selfie preview"
                        className="h-32 w-32 rounded-full object-cover border-2 border-primary sm:h-40 sm:w-40"
                      />
                      {confirmed ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary flex items-center gap-1">
                            <Check className="h-4 w-4" /> Photo confirmed
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Retake Selfie
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Retake Selfie
                          </Button>
                          <Button type="button" size="sm" onClick={confirmPhoto}>
                            <Check className="mr-2 h-4 w-4" />
                            Confirm Photo
                          </Button>
                        </div>
                      )}
                    </>
                  ) : cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-32 w-32 rounded-full object-cover border-2 border-muted sm:h-40 sm:w-40"
                      />
                      <Button type="button" variant="default" size="sm" onClick={capturePhoto}>
                        <Camera className="mr-2 h-4 w-4" />
                        Capture Selfie
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted sm:h-40 sm:w-40">
                        <Camera className="h-10 w-10 text-muted-foreground" />
                      </div>
                      {cameraError && (
                        <p className="text-sm text-destructive text-center max-w-xs">{cameraError}</p>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                        <Camera className="mr-2 h-4 w-4" />
                        Open Camera
                      </Button>
                    </>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div>
                <Label htmlFor="setup-username">Username</Label>
                <Input id="setup-username" {...register('username')} className="mt-1.5" />
                {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
              </div>

              <div>
                <Label htmlFor="setup-bio">Bio</Label>
                <Textarea id="setup-bio" placeholder="Tell us about yourself..." {...register('bio')} className="mt-1.5" maxLength={300} />
                {errors.bio && <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              <div>
                <Label htmlFor="setup-phone">Phone Number</Label>
                <Input id="setup-phone" type="tel" placeholder="+1 (555) 000-0000" {...register('phone')} className="mt-1.5" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <div>
                <Label htmlFor="setup-location">Location</Label>
                <Input id="setup-location" placeholder="City, Country" {...register('location')} className="mt-1.5" />
                {errors.location && <p className="mt-1 text-sm text-destructive">{errors.location.message}</p>}
              </div>

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
