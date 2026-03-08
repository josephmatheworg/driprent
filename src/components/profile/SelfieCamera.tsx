import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { useFaceDetection, type FaceStatus } from '@/hooks/useFaceDetection';

interface SelfieCameraProps {
  onPhotoConfirmed: (dataUrl: string) => void;
  currentAvatarUrl?: string | null;
  autoStart?: boolean;
}

function StatusBadge({ status }: { status: FaceStatus }) {
  if (status === 'loading')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading face detection…
      </span>
    );
  if (status === 'one-face')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <Check className="h-3 w-3" /> Face Detected ✓
      </span>
    );
  if (status === 'multiple-faces')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertTriangle className="h-3 w-3" /> Only one person should be in the frame
      </span>
    );
  if (status === 'no-face')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <AlertTriangle className="h-3 w-3" /> No face detected — position your face in the frame
      </span>
    );
  // error status – allow capture without detection
  return null;
}

export function SelfieCamera({ onPhotoConfirmed, currentAvatarUrl, autoStart }: SelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const { status, detectInImage } = useFaceDetection(
    videoRef as React.RefObject<HTMLVideoElement>,
    cameraActive
  );

  const canCapture = status === 'one-face' || status === 'error';

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

  const confirmPhoto = async () => {
    if (!capturedImage) return;
    setValidating(true);
    const count = await detectInImage(capturedImage);
    setValidating(false);

    if (count === 0) {
      setCameraError('No face detected in the captured photo. Please retake your selfie.');
      return;
    }
    if (count > 1) {
      setCameraError('Multiple faces detected. Only one person should be in the photo.');
      return;
    }
    // count === 1 or -1 (error, allow through)
    setCameraError(null);
    setConfirmed(true);
    onPhotoConfirmed(capturedImage);
  };

  const previewSrc = capturedImage || currentAvatarUrl || '';

  return (
    <div className="flex flex-col items-center gap-3">
      {cameraActive ? (
        <>
          {/* Camera preview with circular guide overlay */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-40 w-40 rounded-full object-cover border-2 border-muted sm:h-48 sm:w-48"
            />
            {/* Guide ring */}
            <div className="pointer-events-none absolute inset-0 rounded-full border-4 border-dashed border-primary/40" />
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            Align your face inside the circle
          </p>

          <StatusBadge status={status} />

          <Button
            type="button"
            size="sm"
            onClick={capturePhoto}
            disabled={!canCapture}
          >
            <Camera className="mr-2 h-4 w-4" /> Capture Selfie
          </Button>
        </>
      ) : capturedImage ? (
        <>
          <img
            src={capturedImage}
            alt="Selfie preview"
            className="h-40 w-40 rounded-full object-cover border-2 border-primary sm:h-48 sm:w-48"
          />
          {cameraError && (
            <p className="text-sm text-destructive text-center max-w-xs">{cameraError}</p>
          )}
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
              <Button type="button" size="sm" onClick={confirmPhoto} disabled={validating}>
                {validating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" /> Confirm Photo</>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-muted sm:h-48 sm:w-48">
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
