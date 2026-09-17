import { useEffect, useMemo, useState } from "react";

import { DraggableImage } from "./DraggableImage";

interface ProductImagePosition {
  x: number;
  y: number;
  scale?: number;
}

interface Props {
  src: string;
  isExport?: boolean;
  defaultPosition: ProductImagePosition;
  baseWidth: number;
}

type Rgb = [number, number, number];
type Component = {
  id: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const cleanedImageCache = new Map<string, string>();
const cleanupFailureCache = new Set<string>();
const MAX_PROCESSING_SIDE = 1400;

function proxiedSource(src: string): string {
  if (!/^https?:\/\//i.test(src)) return src;
  if (src.includes("wsrv.nl")) return src;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=png&w=${MAX_PROCESSING_SIDE}&q=96`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("product_image_load_failed"));
    image.src = src;
  });
}

function pixelDistance(
  data: Uint8ClampedArray,
  offset: number,
  background: Rgb,
): number {
  const dr = data[offset] - background[0];
  const dg = data[offset + 1] - background[1];
  const db = data[offset + 2] - background[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function estimateEdgeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb | null {
  const samples: Rgb[] = [];
  const steps = 12;
  const insetX = Math.max(1, Math.round(width * 0.012));
  const insetY = Math.max(1, Math.round(height * 0.012));

  const read = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3];
    const rgb: Rgb = [data[offset], data[offset + 1], data[offset + 2]];
    if (alpha > 220 && luminance(...rgb) > 205) samples.push(rgb);
  };

  for (let step = 0; step <= steps; step += 1) {
    const x = Math.min(
      width - insetX - 1,
      Math.max(insetX, Math.round((step / steps) * (width - 1))),
    );
    const y = Math.min(
      height - insetY - 1,
      Math.max(insetY, Math.round((step / steps) * (height - 1))),
    );
    read(x, insetY);
    read(x, height - insetY - 1);
    read(insetX, y);
    read(width - insetX - 1, y);
  }

  if (samples.length < 18) return null;

  const sum = samples.reduce<Rgb>(
    (acc, value) => [acc[0] + value[0], acc[1] + value[1], acc[2] + value[2]],
    [0, 0, 0],
  );
  const background: Rgb = [
    sum[0] / samples.length,
    sum[1] / samples.length,
    sum[2] / samples.length,
  ];
  const maxDeviation = Math.max(
    ...samples.map(([r, g, b]) =>
      Math.sqrt(
        (r - background[0]) ** 2 +
          (g - background[1]) ** 2 +
          (b - background[2]) ** 2,
      ),
    ),
  );

  // Only attempt automatic removal on a genuinely bright, uniform catalogue
  // background. Anything ambiguous stays untouched rather than producing a
  // damaged cutout.
  return luminance(...background) >= 232 && maxDeviation <= 28
    ? background
    : null;
}

function findForegroundComponents(
  data: Uint8ClampedArray,
  removed: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; components: Component[]; foregroundArea: number } {
  const total = width * height;
  const labels = new Int32Array(total);
  labels.fill(-1);
  const queue = new Int32Array(total);
  const components: Component[] = [];
  let foregroundArea = 0;

  const isForeground = (index: number) =>
    !removed[index] && data[index * 4 + 3] > 16;

  for (let start = 0; start < total; start += 1) {
    if (!isForeground(start) || labels[start] !== -1) continue;

    const id = components.length;
    let head = 0;
    let tail = 0;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    labels[start] = id;
    queue[tail++] = start;

    while (head < tail) {
      const index = queue[head++];
      area += 1;
      foregroundArea += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const visit = (next: number) => {
        if (
          next < 0 ||
          next >= total ||
          labels[next] !== -1 ||
          !isForeground(next)
        ) {
          return;
        }
        labels[next] = id;
        queue[tail++] = next;
      };

      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }

    components.push({ id, area, minX, minY, maxX, maxY });
  }

  return { labels, components, foregroundArea };
}

function boxesNear(
  candidate: Component,
  hero: Component,
  width: number,
  height: number,
): boolean {
  const padX = width * 0.075;
  const padY = height * 0.075;
  return !(
    candidate.maxX < hero.minX - padX ||
    candidate.minX > hero.maxX + padX ||
    candidate.maxY < hero.minY - padY ||
    candidate.minY > hero.maxY + padY
  );
}

function isolatePrimaryObject(
  data: Uint8ClampedArray,
  removed: Uint8Array,
  width: number,
  height: number,
): void {
  const { labels, components, foregroundArea } = findForegroundComponents(
    data,
    removed,
    width,
    height,
  );
  if (!foregroundArea || components.length < 2) return;

  const sorted = [...components].sort((a, b) => b.area - a.area);
  const hero = sorted[0];
  const second = sorted[1];
  const heroCenterX = (hero.minX + hero.maxX) / 2;
  const heroCenterY = (hero.minY + hero.maxY) / 2;
  const secondCenterX = (second.minX + second.maxX) / 2;
  const secondCenterY = (second.minY + second.maxY) / 2;
  const centerDistance = Math.hypot(
    heroCenterX - secondCenterX,
    heroCenterY - secondCenterY,
  );

  const hasMultipleLargeObjects =
    hero.area >= foregroundArea * 0.18 &&
    second.area >= foregroundArea * 0.12 &&
    second.area >= hero.area * 0.24 &&
    centerDistance >= Math.min(width, height) * 0.18;

  if (!hasMultipleLargeObjects) return;

  // Product-page images frequently contain a contact sheet with several views.
  // Keep the dominant view and nearby detached details/shadows; discard remote
  // variants so the banner still has one commercial hero object.
  const keepIds = new Set<number>([hero.id]);
  for (const component of components) {
    if (
      component.id !== hero.id &&
      component.area >= foregroundArea * 0.004 &&
      boxesNear(component, hero, width, height)
    ) {
      keepIds.add(component.id);
    }
  }

  for (let index = 0; index < labels.length; index += 1) {
    const id = labels[index];
    if (id >= 0 && !keepIds.has(id)) data[index * 4 + 3] = 0;
  }
}

function cropTransparentMargins(
  source: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = source;
  const data = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return null;
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = Math.max(8, Math.round(Math.max(contentWidth, contentHeight) * 0.035));
  const sx = Math.max(0, minX - padding);
  const sy = Math.max(0, minY - padding);
  const ex = Math.min(width, maxX + padding + 1);
  const ey = Math.min(height, maxY + padding + 1);

  const output = document.createElement("canvas");
  output.width = Math.max(1, ex - sx);
  output.height = Math.max(1, ey - sy);
  const outputContext = output.getContext("2d");
  if (!outputContext) return null;
  outputContext.drawImage(source, sx, sy, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

/**
 * Conservative catalogue-image cleanup. It only removes a bright, uniform
 * edge-connected background, isolates the dominant object when the source is a
 * multi-view contact sheet, and falls back to the untouched source whenever
 * confidence is low. This is intentionally safer than aggressive chroma-keying
 * for white laboratory equipment and other light products.
 */
async function cleanupProductImage(src: string): Promise<string> {
  if (cleanedImageCache.has(src)) return cleanedImageCache.get(src)!;
  if (cleanupFailureCache.has(src)) return src;

  try {
    const image = await loadImage(proxiedSource(src));
    const naturalWidth = Math.max(1, image.naturalWidth || image.width);
    const naturalHeight = Math.max(1, image.naturalHeight || image.height);
    const ratio = Math.min(
      1,
      MAX_PROCESSING_SIDE / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.max(1, Math.round(naturalWidth * ratio));
    const height = Math.max(1, Math.round(naturalHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("canvas_context_unavailable");

    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const { data } = imageData;
    const background = estimateEdgeBackground(data, width, height);
    if (!background) {
      cleanedImageCache.set(src, src);
      return src;
    }

    const total = width * height;
    const removed = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    const backgroundLuminance = luminance(...background);
    const isBackgroundPixel = (index: number) => {
      const offset = index * 4;
      if (data[offset + 3] === 0) return true;
      const lightness = luminance(data[offset], data[offset + 1], data[offset + 2]);
      return (
        lightness >= Math.max(198, backgroundLuminance - 42) &&
        pixelDistance(data, offset, background) <= 38
      );
    };

    const enqueue = (index: number) => {
      if (index < 0 || index >= total || removed[index]) return;
      if (!isBackgroundPixel(index)) return;
      removed[index] = 1;
      queue[tail++] = index;
    };

    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y + 1 < height) enqueue(index + width);
    }

    const removedRatio = tail / total;
    if (removedRatio < 0.1 || removedRatio > 0.84) {
      cleanedImageCache.set(src, src);
      return src;
    }

    for (let index = 0; index < total; index += 1) {
      if (removed[index]) data[index * 4 + 3] = 0;
    }

    isolatePrimaryObject(data, removed, width, height);

    // Soften only bright pixels immediately touching removed background. This
    // reduces white halos without erasing internal white product surfaces.
    let riskyEdgePixels = 0;
    let edgePixels = 0;
    for (let index = 0; index < total; index += 1) {
      const offset = index * 4;
      if (data[offset + 3] <= 16) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      const touchesRemoved =
        (x > 0 && removed[index - 1]) ||
        (x + 1 < width && removed[index + 1]) ||
        (y > 0 && removed[index - width]) ||
        (y + 1 < height && removed[index + width]);
      if (!touchesRemoved) continue;
      edgePixels += 1;
      const lightness = luminance(data[offset], data[offset + 1], data[offset + 2]);
      if (lightness > 238) riskyEdgePixels += 1;
      const distance = pixelDistance(data, offset, background);
      if (lightness > 205 && distance < 58) {
        const alpha = Math.round(Math.max(120, Math.min(255, ((distance - 28) / 30) * 255)));
        data[offset + 3] = Math.min(data[offset + 3], alpha);
      }
    }

    // A mostly white foreground touching a white background is ambiguous. In
    // that case the original is safer than a visibly chewed-up cutout.
    if (edgePixels > 0 && riskyEdgePixels / edgePixels > 0.58) {
      cleanedImageCache.set(src, src);
      return src;
    }

    context.putImageData(imageData, 0, 0);
    const cropped = cropTransparentMargins(canvas);
    if (!cropped || cropped.width < 80 || cropped.height < 80) {
      cleanedImageCache.set(src, src);
      return src;
    }

    const cleaned = cropped.toDataURL("image/png", 1);
    cleanedImageCache.set(src, cleaned);
    return cleaned;
  } catch {
    cleanupFailureCache.add(src);
    return src;
  }
}

export function PremiumProductImage({
  src,
  isExport = false,
  defaultPosition,
  baseWidth,
}: Props) {
  const cached = cleanedImageCache.get(src);
  const [displaySrc, setDisplaySrc] = useState(cached ?? src);
  const stablePosition = useMemo(
    () => ({
      x: defaultPosition.x,
      y: defaultPosition.y,
      scale: defaultPosition.scale ?? 1,
    }),
    [defaultPosition.scale, defaultPosition.x, defaultPosition.y],
  );

  useEffect(() => {
    let active = true;
    const existing = cleanedImageCache.get(src);
    if (existing) {
      setDisplaySrc(existing);
      return () => {
        active = false;
      };
    }

    void cleanupProductImage(src).then((nextSrc) => {
      if (active) setDisplaySrc(nextSrc);
    });

    return () => {
      active = false;
    };
  }, [src]);

  return (
    <DraggableImage
      src={displaySrc}
      type="banner"
      isExport={isExport}
      defaultPosition={stablePosition}
      baseWidth={baseWidth}
    />
  );
}
