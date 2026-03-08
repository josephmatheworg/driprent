import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export type FaceStatus = 'loading' | 'no-face' | 'one-face' | 'multiple-faces' | 'error';

export function useFaceDetection(videoRef: React.RefObject<HTMLVideoElement>, active: boolean) {
  const [status, setStatus] = useState<FaceStatus>('loading');
  const [faceCount, setFaceCount] = useState(0);
  const detectorRef = useRef<FaceDetector | null>(null);
  const rafRef = useRef<number>(0);

  // Initialize detector
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (cancelled) return;

        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        detectorRef.current = detector;
        setStatus('no-face');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [active]);

  // Detection loop
  useEffect(() => {
    if (!active || !detectorRef.current) return;

    let lastTime = -1;

    const detect = () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      // Run detection at ~5 fps to stay lightweight
      if (now - lastTime > 200) {
        lastTime = now;
        try {
          const result = detector.detectForVideo(video, now);
          const count = result.detections.length;
          setFaceCount(count);
          if (count === 0) setStatus('no-face');
          else if (count === 1) setStatus('one-face');
          else setStatus('multiple-faces');
        } catch {
          // Ignore transient errors during video playback
        }
      }
      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, videoRef, status]); // re-run when status changes from 'loading' → 'no-face' (detector ready)

  /** One-shot detection on a static image (canvas data URL) */
  const detectInImage = useCallback(async (dataUrl: string): Promise<number> => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const result = detector.detect(img);
      detector.close();
      return result.detections.length;
    } catch {
      return -1; // error → allow through
    }
  }, []);

  return { status, faceCount, detectInImage };
}
