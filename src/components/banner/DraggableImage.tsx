import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, AlertCircle, Move } from 'lucide-react';
import type { BannerImageData, ObjectFit, Position } from './types';

export interface DraggableImageProps {
  image: BannerImageData | null;
  onChange: (image: BannerImageData | null) => void;
  onUpload: () => void;
  containerRef: React.RefObject<HTMLElement>;
  /** True when rendering for image export — disables all interactive UI */
  isExport?: boolean;
  /** True when this instance is the export clone — strips responsive classes */
  isExportClone?: boolean;
  /** CSS object-fit applied to the <img> — defaults to 'contain' */
  objectFit?: ObjectFit;
}

// Unified flag: any export-like render mode behaves identically
const useExportMode = (isExport?: boolean, isExportClone?: boolean) =>
  Boolean(isExport || isExportClone);

/**
 * DraggableImage
 * ---------------
 * Positions are stored as percentages (0–100) so the element scales correctly
 * whether the parent canvas is 350px (mobile preview) or 1200px (export clone).
 * Drag math always uses getBoundingClientRect() on the container — never
 * hardcoded pixel dimensions.
 */
export default function DraggableImage({
  image,
  onChange,
  onUpload,
  containerRef,
  isExport,
  isExportClone,
  objectFit = 'contain',
}: DraggableImageProps) {
  const isExportMode = useExportMode(isExport, isExportClone);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; pos: Position } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isExportMode || !image) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        pos: { ...image.pos },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isExportMode, image],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const start = dragStart.current;
      const container = containerRef.current;
      if (!start || !container || !image) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // delta in px, converted to % using the *actual* rendered size
      const deltaX = e.clientX - start.mouseX;
      const deltaY = e.clientY - start.mouseY;

      onChange({
        ...image,
        pos: {
          x: Math.min(100, Math.max(0, start.pos.x + (deltaX / rect.width) * 100)),
          y: Math.min(100, Math.max(0, start.pos.y + (deltaY / rect.height) * 100)),
        },
      });
    };

    const handleUp = () => {
      setDragging(false);
      dragStart.current = null;
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, image, onChange, containerRef]);

  // --- Empty state (no image yet) ---
  if (!image) {
    if (isExportMode) {
      // Export mode: render nothing — no dashed placeholders, no buttons
      return null;
    }
    return (
      <button
        type="button"
        onClick={onUpload}
        className="absolute left-1/2 top-1/2 z-10 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/40 bg-white/10 text-white/70 transition hover:bg-white/20 max-md:h-20 max-md:w-20"
      >
        <Upload className="mb-1 h-5 w-5 max-md:h-4 max-md:w-4" />
        <span className="text-[10px] font-medium max-md:text-[8px]">Add image</span>
      </button>
    );
  }

  return (
    <div
      ref={nodeRef}
      onPointerDown={handlePointerDown}
      // % positioning — scales from 350px preview to 1200px export
      style={{
        left: `${image.pos.x}%`,
        top: `${image.pos.y}%`,
        width: `${image.width}%`,
        height: `${image.height}%`,
        zIndex: image.zIndex,
        transform: `translate(-50%, -50%) rotate(${image.rotation}deg)`,
      }}
      className={[
        'absolute select-none',
        // Preview mode only: cursor + resize ring; export mode strips all
        isExportMode ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab',
        isExportMode ? '' : 'ring-2 ring-white/30 hover:ring-white/60',
      ].join(' ')}
    >
      <img
        src={image.src}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit,
          // High-quality rendering hint for all <img> inside the banner
          // 'high-quality' is valid CSS but TS types don't include it yet
          imageRendering: 'high-quality' as React.CSSProperties['imageRendering'],
          // WebKit fallback for Safari
          WebkitFilter: 'optimize-contrast' as never,
          pointerEvents: 'none',
          display: 'block',
        }}
      />
      {/* Drag handle badge — preview only */}
      {!isExportMode && (
        <div className="pointer-events-none absolute -left-2 -top-2 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
          <Move className="h-3 w-3" />
        </div>
      )}
      {/* Remove button — preview only */}
      {!isExportMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="absolute right-0 top-0 -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 p-1 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
          aria-label="Remove image"
        >
          <AlertCircle className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
