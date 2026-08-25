import { useCallback, useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import type { BannerTextBlock, Position } from './types';

export interface DraggableBlockProps {
  block: BannerTextBlock;
  onChange: (block: BannerTextBlock) => void;
  containerRef: React.RefObject<HTMLElement>;
  isExport?: boolean;
  isExportClone?: boolean;
}

const useExportMode = (isExport?: boolean, isExportClone?: boolean) =>
  Boolean(isExport || isExportClone);

/**
 * DraggableBlock
 * --------------
 * Text block positioned via % so it works identically at 350px or 1200px.
 */
export default function DraggableBlock({
  block,
  onChange,
  containerRef,
  isExport,
  isExportClone,
}: DraggableBlockProps) {
  const isExportMode = useExportMode(isExport, isExportClone);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; pos: Position } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isExportMode) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, pos: { ...block.pos } };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isExportMode, block.pos],
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: PointerEvent) => {
      const start = dragStart.current;
      const container = containerRef.current;
      if (!start || !container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const deltaX = e.clientX - start.mouseX;
      const deltaY = e.clientY - start.mouseY;
      onChange({
        ...block,
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
  }, [dragging, block, onChange, containerRef]);

  // In export mode: no responsive font scaling, use the block's fixed pt size
  const fontSizeStyle = isExportMode
    ? { fontSize: `${block.fontSize}px` }
    : { fontSize: `clamp(${block.fontSize * 0.5}px, ${block.fontSize * 0.1}vw, ${block.fontSize}px)` };

  return (
    <div
      onPointerDown={handlePointerDown}
      style={{
        left: `${block.pos.x}%`,
        top: `${block.pos.y}%`,
        width: `${block.width}%`,
        zIndex: 5,
        transform: 'translate(-50%, -50%)',
        ...fontSizeStyle,
      }}
      className={[
        'absolute select-none',
        isExportMode ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab',
        isExportMode ? '' : 'hover:ring-2 hover:ring-white/40',
      ].join(' ')}
    >
      <p
        style={{
          fontWeight: block.fontWeight,
          color: block.color,
          textAlign: block.align,
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        {block.text}
      </p>
      {!isExportMode && (
        <div className="pointer-events-none absolute -left-1 -top-1 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
          <Move className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
