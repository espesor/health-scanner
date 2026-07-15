import { useRef, useState } from "react";
import type { HistoryEntry } from "../lib/history";

interface Props {
  entries: HistoryEntry[];
  onOpen: (h: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

/** Drag left past this many pixels to delete a row. */
const DELETE_THRESHOLD = 100;

export function HistoryList({ entries, onOpen, onDelete, onClearAll }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <section className="history">
      <div className="history-head">
        <h3>Recent scans</h3>
        {confirmClear ? (
          <span className="history-clear-confirm">
            Clear all?
            <button className="danger-link" onClick={onClearAll}>
              Yes
            </button>
            <button className="link-button" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button className="link-button" onClick={() => setConfirmClear(true)}>
            Clear all
          </button>
        )}
      </div>
      <p className="history-hint">Swipe a scan left to delete it.</p>
      <ul>
        {entries.map((h) => (
          <HistoryRow key={h.id} h={h} onOpen={onOpen} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}

function HistoryRow({
  h,
  onOpen,
  onDelete,
}: {
  h: HistoryEntry;
  onOpen: (h: HistoryEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    // Only allow leftward drag.
    setDx(Math.min(0, delta));
  };

  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dx <= -DELETE_THRESHOLD) {
      setRemoving(true);
      // let the slide-out animation play, then drop it
      setTimeout(() => onDelete(h.id), 180);
    } else {
      setDx(0);
    }
  };

  const revealed = Math.min(1, Math.abs(dx) / DELETE_THRESHOLD);

  return (
    <li className="history-item">
      <div className="history-delete-bg" style={{ opacity: revealed }} aria-hidden>
        Delete
      </div>
      <div
        className={`history-row${dragging.current ? "" : " animate"}`}
        style={{ transform: `translateX(${removing ? -400 : dx}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <button
          onClick={() => {
            if (!moved.current) onOpen(h);
          }}
        >
          {h.imageUrl ? <img src={h.imageUrl} alt="" /> : <span className="thumb-placeholder" />}
          <span className="history-name">
            {h.name}
            {h.brand ? <small> · {h.brand}</small> : null}
          </span>
          <span className={`history-score band-${h.band}`}>{h.score}</span>
        </button>
      </div>
    </li>
  );
}
