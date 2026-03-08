import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, AlertTriangle, Loader2, Eye, MoveHorizontal, MoveRight } from 'lucide-react';
import { useLivenessDetection, type LivenessStep } from '@/hooks/useLivenessDetection';

interface SelfieCameraProps {
  onPhotoConfirmed: (dataUrl: string) => void;
  currentAvatarUrl?: string | null;
  autoStart?: boolean;
}

const STEP_CONFIG: Record<LivenessStep, { label: string; instruction: string; icon: React.ReactNode; color: string; done: boolean }> = {
  loading: { label: 'Initializing…', instruction: 'Loading face detection model…', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, color: 'text-muted-foreground bg-muted', done: false },
  'no-face': { label: 'No Face', instruction: 'Position your face inside the circle', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10', done: false },
  'multiple-faces': { label: 'Multiple Faces', instruction: 'Only one person should be in the frame', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30', done: false },
  'face-detected': { label: 'Face Detected', instruction: 'Great! Hold still…', icon: <Check className="h-3.5 w-3.5" />, color: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30', done: false },
  blink: { label: 'Blink Check', instruction: 'Please blink your eyes to verify you are a real person', icon: <Eye className="h-3.5 w-3.5" />, color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', done: false },
  'turn-left': { label: 'Turn Left', instruction: 'Turn your head slightly to the left', icon: <MoveHorizontal className="h-3.5 w-3.5" />, color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', done: false },
  'turn-right': { label: 'Turn Right', instruction: 'Turn your head slightly to the right', icon: <MoveRight className="h-3.5 w-3.5" />, color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', done: false },
  'move-closer': { label: 'Move Closer', instruction: 'Move slightly closer to the camera', icon: <Camera className="h-3.5 w-3.5" />, color: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30', done: false },
  verified: { label: 'Verified', instruction: 'Verification successful! You can now capture your selfie.', icon: <Check className="h-3.5 w-3.5" />, color: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30', done: true },
  error: { label: 'Detection Error', instruction: 'Face verification could not start. Please refresh the page.', icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10', done: false },
};

const ORDERED_STEPS: LivenessStep[] = ['face-detected', 'blink', 'turn-left', 'turn-right', 'move-closer'];

function stepIndex(step: LivenessStep): number {
  const idx = ORDERED_STEPS.indexOf(step);
  if (step === 'verified') return ORDERED_STEPS.length;
  return idx >= 0 ? idx : -1;
}

function ProgressChecklist({ currentStep, faceLocked }: { currentStep: LivenessStep; faceLocked: boolean }) {
  const current = stepIndex(currentStep);
  const items = [
    { label: 'Face Detected', idx: 0 },
    { label: 'Blink Verified', idx: 1 },
    { label: 'Head Movement', idx: 2 },
    { label: 'Depth Check', idx: 4 },
    { label: 'Face Locked', idx: 5 }, // post-verification continuous monitoring
  ];

  return (
    <div className="flex flex-col gap-1 text-xs w-full max-w-[220px]">
      {items.map((item) => {
        const passIdx = item.label === 'Head Movement' ? 3 : item.idx;
        let done: boolean;
        let active: boolean;
        if (item.label === 'Face Locked') {
          done = faceLocked;
          active = currentStep === 'verified' && !faceLocked;
        } else {
          done = current > passIdx;
          active = !done && current >= item.idx && current <= (item.label === 'Head Movement' ? 3 : item.idx);
        }
        return (
          <div key={item.label} className={`flex items-center gap-2 rounded px-2 py-1 transition-colors ${done ? 'text-green-700 dark:text-green-400' : active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
            {done ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : active ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/40" />
            )}
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
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

  const { step, faceLocked, resetLiveness, validateCapturedImage } = useLivenessDetection(
    videoRef as React.RefObject<HTMLVideoElement>,
    cameraActive
  );

  const canCapture = step === 'verified' && faceLocked;
  const config = STEP_CONFIG[step];

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      resetLiveness();
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
  }, [resetLiveness]);

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

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    setConfirmed(false);
    setCameraError(null);
    stopCamera();

    // Auto-validate the captured frame
    setValidating(true);
    const result = await validateCapturedImage(dataUrl);
    setValidating(false);

    if (!result.valid) {
      setCameraError(result.error || 'Photo validation failed. Please retake.');
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setConfirmed(false);
    setCameraError(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (!capturedImage || cameraError || validating) return;
    setConfirmed(true);
    onPhotoConfirmed(capturedImage);
  };

  const previewSrc = capturedImage || currentAvatarUrl || '';

  return (
    <div className="flex flex-col items-center gap-3">
      {cameraActive ? (
        <>
          {/* Camera preview with guide overlay */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-40 w-40 rounded-full object-cover border-2 border-muted sm:h-48 sm:w-48"
            />
            <div className={`pointer-events-none absolute inset-0 rounded-full border-4 border-dashed transition-colors ${canCapture ? 'border-green-500' : 'border-primary/40'}`} />
          </div>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.color}`}>
            {config.icon} {config.instruction}
          </span>

          {/* Progress checklist */}
          <ProgressChecklist currentStep={step} faceLocked={faceLocked} />

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
            className={`h-40 w-40 rounded-full object-cover border-2 sm:h-48 sm:w-48 ${cameraError ? 'border-destructive' : confirmed ? 'border-primary' : 'border-muted'}`}
          />

          {validating && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying captured photo…
            </span>
          )}

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
          ) : !validating ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={retakePhoto}>
                <RotateCcw className="mr-2 h-4 w-4" /> Retake
              </Button>
              {!cameraError && (
                <Button type="button" size="sm" onClick={confirmPhoto}>
                  <Check className="mr-2 h-4 w-4" /> Confirm Photo
                </Button>
              )}
            </div>
          ) : null}
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
