import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check } from 'lucide-react';

interface SelfieCameraProps {
  onPhotoConfirmed: (dataUrl: string) => void;
  currentAvatarUrl?: string | null;
  /** If true, auto-start camera on mount */
  autoStart?: boolean;
}

export function SelfieCamera({ onPhotoConfirmed, currentAvatarUrl, autoStart }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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

  useEffect(() => {
    if (autoStart && !capturedImage && !cameraActive) {
      startCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

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
    if (capturedImage) {
      setConfirmed(true);
      onPhotoConfirmed(capturedImage);
    }
  };

  const previewSrc = capturedImage || currentAvatarUrl || '';

  return (
    <div className="flex flex-col items-center gap-3">
      {cameraActive ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-32 w-32 rounded-full object-cover border-2 border-muted sm:h-40 sm:w-40"
          />
          <Button type="button" size="sm" onClick={capturePhoto}>
            <Camera className="mr-2 h-4 w-4" /> Capture Selfie
          </Button>
        </>
      ) : capturedImage ? (
        <>
          <img src={capturedImage} alt="Selfie preview" className="h-32 w-32 rounded-full object-cover border-2 border-primary sm:h-40 sm:w-40" />
          {confirmed ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-primary flex items-center gap-1">
                <Check className="h-4 w-4" /> Photo confirmed
              </span>
              <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                <RotateCcw className="mr-2 h-4 w-4" /> Retake Selfie
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                <RotateCcw className="mr-2 h-4 w-4" /> Retake Selfie
              </Button>
              <Button type="button" size="sm" onClick={confirmPhoto}>
                <Check className="mr-2 h-4 w-4" /> Confirm Photo
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted sm:h-40 sm:w-40">
            {previewSrc ? (
              <img src={previewSrc} alt="Avatar" className="h-full w-full rounded-full object-cover" />
            ) : (
              <Camera className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {cameraError && <p className="text-sm text-destructive text-center max-w-xs">{cameraError}</p>}
          <Button type="button" variant="outline" size="sm" onClick={startCamera}>
            <Camera className="mr-2 h-4 w-4" /> {currentAvatarUrl ? 'Retake Selfie' : 'Open Camera'}
          </Button>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}
