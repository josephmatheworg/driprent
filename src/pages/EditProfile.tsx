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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Camera, Upload, RotateCcw, ImagePlus, MapPin, Loader2 } from 'lucide-react';

const editSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(30, 'Username must be less than 30 characters').regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
  bio: z.string().trim().max(200, 'Bio must be less than 200 characters').optional(),
  phone: z.string().trim().regex(/^(\+?[\d]{10,15})?$/, 'Phone must be 10-15 digits, only numbers and + allowed').optional(),
  location: z.string().trim().min(1, 'Location is required').max(100),
});

type EditFormData = z.infer<typeof editSchema>;

export default function EditProfile() {
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
  const [photoChanged, setPhotoChanged] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue: setFormValue } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
  });

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

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (profile) {
      reset({
        username: profile.username || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
      });
    }
  }, [user, profile, navigate, reset]);

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
      setCameraError('Could not access camera. Please allow camera permissions or upload a photo instead.');
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
      setUploadedFile(null);
      setPhotoChanged(true);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setUploadedFile(null);
    setPhotoChanged(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload an image.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Max 5MB.' });
      return;
    }
    setUploadedFile(file);
    setPhotoChanged(true);
    stopCamera();
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedImage(ev.target?.result as string);
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

  const onSubmit = async (data: EditFormData) => {
    if (!profile || !user) return;
    setIsSaving(true);
    try {
      let avatarUrl = profile.avatar_url;

      if (photoChanged && capturedImage) {
        const blob = uploadedFile || dataURLtoBlob(capturedImage);
        const ext = uploadedFile ? uploadedFile.name.split('.').pop() || 'jpg' : 'jpg';
        const fileName = `${user.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
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
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      navigate('/profile');
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
        </div>
      </Layout>
    );
  }

  const displayImage = capturedImage || profile.avatar_url || '';

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-4xl text-foreground sm:text-5xl">EDIT PROFILE</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          {/* Photo Section */}
          <div>
            <Label>Profile Picture</Label>
            <div className="mt-3 flex flex-col items-center gap-4">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-36 w-36 rounded-full object-cover border-2 border-muted sm:h-44 sm:w-44"
                  />
                  <Button type="button" onClick={capturePhoto} size="sm">
                    <Camera className="mr-2 h-4 w-4" /> Capture
                  </Button>
                </>
              ) : displayImage ? (
                <>
                  <Avatar className="h-36 w-36 sm:h-44 sm:w-44">
                    <AvatarImage src={displayImage} />
                    <AvatarFallback className="text-3xl">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Retake Selfie
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload Photo
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-36 w-36 items-center justify-center rounded-full bg-muted sm:h-44 sm:w-44">
                    <ImagePlus className="h-10 w-10 text-muted-foreground" />
                  </div>
                  {cameraError && <p className="text-sm text-destructive text-center">{cameraError}</p>}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Upload Photo
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                      <Camera className="mr-2 h-4 w-4" /> Take Selfie
                    </Button>
                  </div>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-5">
            <div>
              <Label htmlFor="edit-username">Username</Label>
              <Input id="edit-username" {...register('username')} className="mt-1.5" />
              {errors.username && <p className="mt-1 text-sm text-destructive">{errors.username.message}</p>}
            </div>

            <div>
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea id="edit-bio" placeholder="Tell others about yourself..." {...register('bio')} className="mt-1.5" maxLength={300} />
              {errors.bio && <p className="mt-1 text-sm text-destructive">{errors.bio.message}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" type="tel" placeholder="+1 (555) 000-0000" {...register('phone')} className="mt-1.5" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone.message}</p>}
              </div>
              <div>
                <Label htmlFor="edit-location">Location</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input id="edit-location" placeholder="City, Country" {...register('location')} className="flex-1" />
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleUseCurrentLocation} disabled={geoLoading}>
                    {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.location && <p className="mt-1 text-sm text-destructive">{errors.location.message}</p>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
