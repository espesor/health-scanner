import { useRef, useState } from "react";
import { extractIngredients, recognizeText } from "../lib/ocr";

interface Props {
  /** Called with the extracted ingredient text once OCR finishes. */
  onExtracted: (ingredients: string) => void;
  onCancel: () => void;
}

/**
 * Photograph an ingredients panel and OCR it on-device. Uses a file input with
 * `capture="environment"` so phones open the native camera and return a sharp,
 * high-resolution still (much better for OCR than a live video frame).
 */
export function LabelCapture({ onExtracted, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setProgress(0);
    setStatus("starting engine");
    try {
      const raw = await recognizeText(file, (fraction, s) => {
        setProgress(fraction);
        setStatus(s);
      });
      onExtracted(extractIngredients(raw));
    } catch {
      setError("Couldn't read the label. Try again in better light, or type the ingredients.");
      setProgress(null);
    }
  };

  const busy = progress !== null && !error;
  const pct = Math.round((progress ?? 0) * 100);

  return (
    <div className="label-capture">
      <h2>Photograph the ingredients</h2>
      <p className="label-capture-help">
        Fill the frame with just the <strong>ingredients list</strong> on the
        label. It's read on your device — the photo never leaves your phone.
      </p>

      {preview && (
        <div className="label-preview">
          <img src={preview} alt="captured label" />
          {busy && (
            <div className="label-progress-overlay">
              <div className="spinner" />
              <p>{status}… {pct}%</p>
            </div>
          )}
        </div>
      )}

      {error && <p className="label-error">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        hidden
      />

      {!busy && (
        <div className="label-capture-actions">
          <button className="primary" onClick={() => inputRef.current?.click()}>
            {preview ? "Retake photo" : "Take photo"}
          </button>
          <button className="secondary" onClick={onCancel}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
