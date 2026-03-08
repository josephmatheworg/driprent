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
import { Camera, RotateCcw, Upload, ImagePlus } from 'lucide-react';

const setupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(20),
  bio: z.string().trim().min(1, 'Bio is required').max(300, 'Bio must be less than 300 characters'),
  phone: z.string().trim().min(1, 'Phone number is required').regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number format'),
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

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
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('Could not access camera. Please allow camera permissions or upload a photo instead.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

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
      setUploadedFile(null);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setUploadedFile(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image file.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please upload an image under 5MB.' });
      return;
    }

    setUploadedFile(file);
    stopCamera();

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
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
    if (!capturedImage) {
      toast({ variant: 'destructive', title: 'Photo required', description: 'Please upload or capture a profile photo.' });
      return;
    }
    if (!profile || !user) return;

    setIsSaving(true);
    try {
      const blob = uploadedFile || dataURLtoBlob(capturedImage);
      const ext = uploadedFile ? uploadedFile.name.split('.').pop() || 'jpg' : 'jpg';
      const fileName = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error } = await supabase
        .from('profiles')
        .update({
          username: data.username,
          bio: data.bio,
          phone: data.phone,
          location: data.location,
          avatar_url: urlData.publicUrl,
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
              {/* Photo Section */}
              <div>
                <Label>Profile Picture</Label>
                <div className="mt-2 flex flex-col items-center gap-3">
                  {capturedImage ? (
                    <>
                      <img
                        src={capturedImage}
                        alt="Profile preview"
                        className="h-32 w-32 rounded-full object-cover border-2 border-primary sm:h-40 sm:w-40"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Change Photo
                      </Button>
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
                        Capture
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted sm:h-40 sm:w-40">
                        <ImagePlus className="h-10 w-10 text-muted-foreground" />
                      </div>
                      {cameraError && <p className="text-sm text-destructive text-center">{cameraError}</p>}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Photo
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                          <Camera className="mr-2 h-4 w-4" />
                          Take Photo
                        </Button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
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
