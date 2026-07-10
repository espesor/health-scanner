import { useEffect, useRef, useState } from "react";
import { createDetector } from "../lib/barcode";

interface Props {
  onDetected: (barcode: string) => void;
  paused: boolean;
}

function cameraErrorMessage(e: unknown): string {
  const name = (e as DOMException)?.name;
  if (name === "NotAllowedError")
    return "Camera access was denied. Allow camera access in your browser settings, or enter a barcode below.";
  if (name === "NotFoundError")
    return "No camera found on this device. Enter a barcode below instead.";
  if (!window.isSecureContext)
    return "The camera needs HTTPS. Run `npm run dev:phone` and open the https:// URL, or enter a barcode below.";
  return "Couldn't start the camera. Enter a barcode below instead.";
}

export function Scanner({ onDetected, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    const video = videoRef.current;
    if (!video) return;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) return;
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        if (cancelled) return;
        setEngine(detector.engine);
        setError(null);

        const tick = async () => {
          if (cancelled) return;
          try {
            const code = await detector.detect(video);
            if (code && !cancelled) {
              onDetected(code);
              return;
            }
          } catch {
            // ignore single-frame decode errors
          }
          timer = window.setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
  }, [paused, onDetected]);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="scanner-overlay">
        <div className="viewfinder" />
        <p className="scanner-hint">
          {error ?? "Point the camera at a product barcode"}
        </p>
        {engine && !error && (
          <p className="scanner-engine">scanning with {engine} decoder</p>
        )}
      </div>
    </div>
  );
}
