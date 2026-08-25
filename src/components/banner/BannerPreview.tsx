import { useRef } from 'react';
import { Upload, ImageIcon } from 'lucide-react';
import type { BannerContent, BannerImageData, BannerTextBlock } from './types';
import DraggableImage from './DraggableImage';
import DraggableBlock from './DraggableBlock';

export interface BannerPreviewProps {
  content: BannerContent;
  onContentChange: (content: BannerContent) => void;
  onBackgroundUpload?: () => void;
  onProductImageUpload?: () => void;
  textBlocks?: BannerTextBlock[];
  onTextBlockChange?: (block: BannerTextBlock) => void;
  /** When true this instance is a clone created solely for image export */
  isExportClone?: boolean;
  /** Wrapper class for export container — forces export mode if present */
  exportWrapperClass?: string;
  /** General export flag — same effect as isExportClone */
  isExport?: boolean;
}

// Unified export-mode flag: either explicit prop or wrapper-class presence
const isExportRender = (isExport?: boolean, isExportClone?: boolean, wrapper?: string) =>
  Boolean(isExport || isExportClone || wrapper);

/**
 * BannerPreview
 * =============
 * Dual-mode banner component:
 *
 * 1. Responsive preview (default): flex-row on desktop, flex-col on mobile via
 *    max-md: classes. Aspect ratio 2/1 on desktop, 4/5 on mobile.
 *
 * 2. Pixel-perfect export clone (isExportClone / isExport / exportWrapperClass):
 *    Ignores ALL responsive breakpoints, locks to 1200×600 desktop layout using
 *    inline styles. No force-mobile influence, no cursors, no upload buttons.
 */
export default function BannerPreview({
  content,
  onContentChange,
  onBackgroundUpload,
  onProductImageUpload,
  textBlocks = [],
  onTextBlockChange,
  isExportClone,
  exportWrapperClass,
  isExport,
}: BannerPreviewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportMode = isExportRender(isExport, isExportClone, exportWrapperClass);

  const handleImageChange = (image: BannerImageData | null) =>
    onContentChange({ ...content, productImage: image });

  // ── Container classes ──────────────────────────────────────────────
  // Preview: responsive aspect + max-md layout. Export: locked inline dims.
  const containerStyle = exportMode
    ? { width: '1200px', height: '600px' }
    : undefined;

  const containerClass = exportMode
    ? 'relative overflow-hidden flex flex-row'
    : 'relative flex w-full flex-row overflow-hidden aspect-[2/1] max-md:flex-col max-md:aspect-[4/5]';

  // ── Text panel classes ─────────────────────────────────────────────
  // Preview scales fonts with max-md: breakpoints. Export uses fixed sizes.
  const textPanelClass = exportMode
    ? 'flex flex-col justify-center gap-4 p-16 w-1/2 shrink-0'
    : 'flex flex-col justify-center gap-4 p-8 md:p-12 w-1/2 shrink-0 max-md:w-full max-md:p-6 max-md:gap-2';

  const headingClass = exportMode
    ? 'font-bold leading-[1.2] text-balance'
    : 'font-bold leading-[1.2] text-2xl md:text-4xl text-balance max-md:text-xl max-md:text-balance';

  const subheadingClass = exportMode
    ? 'leading-[1.5] text-balance'
    : 'text-sm md:text-lg leading-[1.5] text-balance max-md:text-xs';

  const ctaClass = exportMode
    ? 'inline-flex items-center justify-center rounded-full font-semibold'
    : 'inline-flex items-center justify-center rounded-full text-sm md:text-base font-semibold max-md:text-xs';

  // ── Image panel classes ────────────────────────────────────────────
  const imagePanelClass = exportMode
    ? 'relative flex items-center justify-center w-1/2 shrink-0'
    : 'relative flex items-center justify-center w-1/2 shrink-0 max-md:w-full max-md:min-h-[40%]';

  return (
    <div
      ref={canvasRef}
      data-export-node="banner"
      className={[containerClass, exportWrapperClass ?? ''].filter(Boolean).join(' ')}
      style={{
        ...containerStyle,
        background: content.backgroundColor,
      }}
    >
      {/* ── Decorative background shape ──────────────────────────────── */}
      {/* Sits behind everything; overflow-hidden on container clips it */}
      <BackgroundShape
        shape={content.backgroundShape}
        accentColor={content.accentColor}
        exportMode={exportMode}
      />

      {/* ── Text panel ──────────────────────────────────────────────── */}
      <div className={textPanelClass} style={{ position: 'relative', zIndex: 2 }}>
        <h2 className={headingClass} style={{ color: content.textColor }}>
          {content.heading}
        </h2>
        {content.subheading && (
          <p className={subheadingClass} style={{ color: content.textColor, opacity: 0.85 }}>
            {content.subheading}
          </p>
        )}
        {content.ctaText && (
          <span
            className={ctaClass}
            style={{
              background: content.accentColor,
              color: content.backgroundColor,
              padding: exportMode ? '12px 32px' : '8px 20px md:10px 28px max-md:6px 16px',
              alignSelf: 'flex-start',
            }}
          >
            {content.ctaText}
          </span>
        )}
      </div>

      {/* ── Image panel ──────────────────────────────────────────────── */}
      <div className={imagePanelClass}>
        <DraggableImage
          image={content.productImage}
          onChange={handleImageChange}
          onUpload={() => onProductImageUpload?.()}
          containerRef={canvasRef}
          isExport={exportMode}
          isExportClone={isExportClone}
          objectFit={content.productImage?.objectFit ?? 'contain'}
        />
        {/* Upload trigger — preview only */}
        {!exportMode && !content.productImage && (
          <div className="flex flex-col items-center gap-2 text-white/50">
            <ImageIcon className="h-10 w-10 max-md:h-7 max-md:w-7" />
            <span className="text-xs max-md:text-[10px]">Product image area</span>
          </div>
        )}
      </div>

      {/* ── Text blocks (draggable overlays) ────────────────────────── */}
      {textBlocks.map((block) => (
        <DraggableBlock
          key={block.id}
          block={block}
          onChange={(b) => onTextBlockChange?.(b)}
          containerRef={canvasRef}
          isExport={exportMode}
          isExportClone={isExportClone}
        />
      ))}

      {/* ── Background upload button — preview only ──────────────────── */}
      {!exportMode && onBackgroundUpload && (
        <button
          type="button"
          onClick={onBackgroundUpload}
          className="absolute bottom-3 right-3 z-20 rounded-lg bg-black/40 p-2 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/60 group-hover:opacity-100"
          aria-label="Change background"
        >
          <Upload className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── Background shapes ──────────────────────────────────────────────────

interface BackgroundShapeProps {
  shape: BannerContent['backgroundShape'];
  accentColor: string;
  exportMode: boolean;
}

function BackgroundShape({ shape, accentColor, exportMode }: BackgroundShapeProps) {
  // Export: no responsive sizing, use fixed 1200×600-aware SVG
  // Preview: SVG viewBox scales fluidly, parent overflow-hidden clips edges
  const svgProps = exportMode
    ? { width: '1200', height: '600', viewBox: '0 0 1200 600' }
    : { width: '100%', height: '100%', viewBox: '0 0 1200 600', preserveAspectRatio: 'none' as const };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{ overflow: 'hidden' }}
    >
      {shape === 'blob' && (
        <svg {...svgProps} style={{ position: 'absolute', top: 0, left: 0 }}>
          <path
            d="M 800,150 C 950,100 1100,200 1050,350 C 1000,500 850,550 700,480 C 550,410 500,250 600,180 C 680,130 750,180 800,150 Z"
            fill={accentColor}
            opacity={0.15}
          />
        </svg>
      )}
      {shape === 'diagonal' && (
        <svg {...svgProps} style={{ position: 'absolute', top: 0, left: 0 }}>
          <polygon points="1200,0 1200,600 700,600 900,0" fill={accentColor} opacity={0.15} />
        </svg>
      )}
      {shape === 'curve' && (
        <svg {...svgProps} style={{ position: 'absolute', top: 0, left: 0 }}>
          <path
            d="M 1200,0 L 1200,600 L 0,600 Q 400,400 600,300 Q 800,200 1200,0 Z"
            fill={accentColor}
            opacity={0.15}
          />
        </svg>
      )}
      {shape === 'solid' && (
        <div className="absolute inset-0" style={{ background: accentColor, opacity: 0.05 }} />
      )}
    </div>
  );
}
