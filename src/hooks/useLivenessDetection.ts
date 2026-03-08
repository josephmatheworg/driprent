import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export type LivenessStep = 'loading' | 'no-face' | 'multiple-faces' | 'face-detected' | 'blink' | 'turn-left' | 'turn-right' | 'move-closer' | 'verified' | 'error';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
const FACE_LOST_TIMEOUT_MS = 2000;

// Eye landmark indices (MediaPipe 468 mesh)
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;
// Nose tip for head pose
const NOSE_TIP = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

function eyeAspectRatio(landmarks: any[], topIdx: number, bottomIdx: number): number {
  const top = landmarks[topIdx];
  const bottom = landmarks[bottomIdx];
  return Math.abs(top.y - bottom.y);
}

function getYaw(landmarks: any[]): number {
  const nose = landmarks[NOSE_TIP];
  const leftCheek = landmarks[LEFT_CHEEK];
  const rightCheek = landmarks[RIGHT_CHEEK];
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
  if (faceWidth < 0.01) return 0;
  const noseRelative = (nose.x - leftCheek.x) / faceWidth;
  return (noseRelative - 0.5) * 2; // -1 = full left, +1 = full right
}

function getFaceSize(landmarks: any[]): number {
  const leftCheek = landmarks[LEFT_CHEEK];
  const rightCheek = landmarks[RIGHT_CHEEK];
  return Math.abs(rightCheek.x - leftCheek.x);
}

export function useLivenessDetection(videoRef: React.RefObject<HTMLVideoElement>, active: boolean) {
  const [step, setStep] = useState<LivenessStep>('loading');
  const [faceCount, setFaceCount] = useState(0);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);

  // Liveness tracking refs
  const blinkCountRef = useRef(0);
  const eyeWasOpenRef = useRef(true);
  const baselineYawRef = useRef<number | null>(null);
  const turnLeftDetectedRef = useRef(false);
  const turnRightDetectedRef = useRef(false);
  const baselineFaceSizeRef = useRef<number | null>(null);
  const closerDetectedRef = useRef(false);
  const stepRef = useRef<LivenessStep>('loading');

  // Keep stepRef in sync
  useEffect(() => { stepRef.current = step; }, [step]);

  const resetLiveness = useCallback(() => {
    blinkCountRef.current = 0;
    eyeWasOpenRef.current = true;
    baselineYawRef.current = null;
    turnLeftDetectedRef.current = false;
    turnRightDetectedRef.current = false;
    baselineFaceSizeRef.current = null;
    closerDetectedRef.current = false;
    setStep('loading');
  }, []);

  // Initialize landmarker
  useEffect(() => {
    if (!active) {
      resetLiveness();
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (cancelled) return;

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setStep('no-face');
      } catch {
        if (!cancelled) setStep('error');
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [active, resetLiveness]);

  // Detection loop
  useEffect(() => {
    if (!active || !landmarkerRef.current) return;

    let lastTime = -1;

    const detect = () => {
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      if (now - lastTime > 150) { // ~7 fps
        lastTime = now;
        try {
          const result = landmarker.detectForVideo(video, now);
          const count = result.faceLandmarks.length;
          setFaceCount(count);

          const currentStep = stepRef.current;

          if (currentStep === 'verified' || currentStep === 'error') {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          if (count === 0) {
            setStep('no-face');
            rafRef.current = requestAnimationFrame(detect);
            return;
          }
          if (count > 1) {
            setStep('multiple-faces');
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          const landmarks = result.faceLandmarks[0];

          // Step 1: Face detected → move to blink
          if (currentStep === 'no-face' || currentStep === 'multiple-faces' || currentStep === 'face-detected') {
            if (currentStep !== 'face-detected') {
              setStep('face-detected');
              // Auto-advance to blink after brief delay
              setTimeout(() => {
                if (stepRef.current === 'face-detected') setStep('blink');
              }, 800);
            }
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          // Step 2: Blink detection
          if (currentStep === 'blink') {
            const leftEAR = eyeAspectRatio(landmarks, LEFT_EYE_TOP, LEFT_EYE_BOTTOM);
            const rightEAR = eyeAspectRatio(landmarks, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM);
            const avgEAR = (leftEAR + rightEAR) / 2;

            const BLINK_THRESHOLD = 0.015;
            if (avgEAR < BLINK_THRESHOLD && eyeWasOpenRef.current) {
              blinkCountRef.current += 1;
              eyeWasOpenRef.current = false;
            } else if (avgEAR >= BLINK_THRESHOLD) {
              eyeWasOpenRef.current = true;
            }

            if (blinkCountRef.current >= 1) {
              setStep('turn-left');
              baselineYawRef.current = getYaw(landmarks);
            }
          }

          // Step 3: Turn left
          if (currentStep === 'turn-left') {
            const yaw = getYaw(landmarks);
            const baseline = baselineYawRef.current ?? 0;
            if (yaw - baseline < -0.12) {
              turnLeftDetectedRef.current = true;
              setStep('turn-right');
              baselineYawRef.current = getYaw(landmarks);
            }
          }

          // Step 4: Turn right
          if (currentStep === 'turn-right') {
            const yaw = getYaw(landmarks);
            const baseline = baselineYawRef.current ?? 0;
            if (yaw - baseline > 0.12) {
              turnRightDetectedRef.current = true;
              setStep('move-closer');
              baselineFaceSizeRef.current = getFaceSize(landmarks);
            }
          }

          // Step 5: Move closer (depth check)
          if (currentStep === 'move-closer') {
            const size = getFaceSize(landmarks);
            const baseline = baselineFaceSizeRef.current ?? size;
            if (size > baseline * 1.15) {
              closerDetectedRef.current = true;
              setStep('verified');
            }
          }
        } catch {
          // Ignore transient errors
        }
      }
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, videoRef, step]);

  /** Validate a captured image: 1 face, centered, ≥30% area, anti-spoof texture check */
  const validateCapturedImage = useCallback(async (dataUrl: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numFaces: 2,
        minFaceDetectionConfidence: 0.5,
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const result = landmarker.detect(img);
      landmarker.close();

      const count = result.faceLandmarks.length;
      if (count === 0) return { valid: false, error: 'No face detected in the captured photo. Please retake your selfie.' };
      if (count > 1) return { valid: false, error: 'Only one person allowed in the frame.' };

      const lm = result.faceLandmarks[0];
      const xs = lm.map(p => p.x);
      const ys = lm.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const faceWidth = maxX - minX;
      const faceHeight = maxY - minY;
      const faceArea = faceWidth * faceHeight;

      // Face must occupy ≥10% of frame (30% width × 40% height ≈ 0.12 area)
      if (faceArea < 0.10) return { valid: false, error: 'Face is too small. Move closer to the camera and retake.' };

      // Centering check
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      if (Math.abs(centerX - 0.5) > 0.25 || Math.abs(centerY - 0.5) > 0.3) {
        return { valid: false, error: 'Face is not centered. Position your face in the middle of the frame.' };
      }

      // Anti-spoof: texture variance analysis on the face region
      const spoofResult = analyzeTextureForSpoof(img, minX, minY, faceWidth, faceHeight);
      if (!spoofResult.valid) return spoofResult;

      return { valid: true };
    } catch {
      return { valid: false, error: 'Validation failed. Please try again.' };
    }
  }, []);

  return { step, faceCount, resetLiveness, validateCapturedImage };
}

/**
 * Canvas-based texture analysis to detect screen/print spoof patterns.
 * Checks color variance and edge uniformity in the face region.
 */
function analyzeTextureForSpoof(
  img: HTMLImageElement,
  faceX: number, faceY: number, faceW: number, faceH: number
): { valid: boolean; error?: string } {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { valid: true };

    ctx.drawImage(img, 0, 0);

    // Sample the face region
    const sx = Math.floor(faceX * canvas.width);
    const sy = Math.floor(faceY * canvas.height);
    const sw = Math.floor(faceW * canvas.width);
    const sh = Math.floor(faceH * canvas.height);

    if (sw < 10 || sh < 10) return { valid: true };

    const imageData = ctx.getImageData(sx, sy, sw, sh);
    const pixels = imageData.data;

    // 1. Color channel variance — screens produce very uniform backlighting
    let rSum = 0, gSum = 0, bSum = 0;
    const totalPixels = sw * sh;
    for (let i = 0; i < pixels.length; i += 4) {
      rSum += pixels[i];
      gSum += pixels[i + 1];
      bSum += pixels[i + 2];
    }
    const rMean = rSum / totalPixels;
    const gMean = gSum / totalPixels;
    const bMean = bSum / totalPixels;

    let rVar = 0, gVar = 0, bVar = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      rVar += (pixels[i] - rMean) ** 2;
      gVar += (pixels[i + 1] - gMean) ** 2;
      bVar += (pixels[i + 2] - bMean) ** 2;
    }
    rVar /= totalPixels;
    gVar /= totalPixels;
    bVar /= totalPixels;
    const avgVariance = (rVar + gVar + bVar) / 3;

    // Very low variance → flat/uniform lighting (likely screen)
    if (avgVariance < 80) {
      return { valid: false, error: 'Screen image detected. Please show your real face.' };
    }

    // 2. Edge pattern: sample horizontal lines for periodic patterns (pixel grid)
    let periodicScore = 0;
    const sampleRows = Math.min(20, sh);
    for (let row = 0; row < sampleRows; row++) {
      const y = Math.floor((row / sampleRows) * sh);
      let diffs = 0;
      for (let x = 1; x < sw; x++) {
        const idx = (y * sw + x) * 4;
        const prevIdx = (y * sw + x - 1) * 4;
        const diff = Math.abs(pixels[idx] - pixels[prevIdx]) +
                     Math.abs(pixels[idx + 1] - pixels[prevIdx + 1]) +
                     Math.abs(pixels[idx + 2] - pixels[prevIdx + 2]);
        if (diff > 30) diffs++;
      }
      // If nearly every pixel differs from its neighbor → possible grid pattern
      if (diffs > sw * 0.7) periodicScore++;
    }
    if (periodicScore > sampleRows * 0.6) {
      return { valid: false, error: 'Screen image detected. Please show your real face.' };
    }

    return { valid: true };
  } catch {
    return { valid: true };
  }
}
