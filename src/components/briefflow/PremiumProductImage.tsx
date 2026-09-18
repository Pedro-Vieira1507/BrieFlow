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
const cleanedImageCache = new Map<string, string>();
const cleanupFailureCache = new Set<string>();
const MAX_PROCESSING_SIDE = 1800;

function proxiedSource(src: string): string {
  if (!/^https?:\/\//i.test(src)) return src;
  if (src.includes("wsrv.nl")) return src;
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=png&w=${MAX_PROCESSING_SIDE}&q=98`;
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function estimateEdgeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Rgb | null {
  const samples: Rgb[] = [];
  const steps = 18;
  const insetX = Math.max(1, Math.round(width * 0.01));
  const insetY = Math.max(1, Math.round(height * 0.01));

  const read = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const alpha = data[offset + 3];
    const rgb: Rgb = [data[offset], data[offset + 1], data[offset + 2]];
    if (alpha > 235 && luminance(...rgb) > 218) samples.push(rgb);
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

  if (samples.length < 24) return null;

  // Median is deliberately used instead of the mean so a photographed object
  // touching one edge cannot pull the sampled background toward the product.
  const background: Rgb = [
    median(samples.map((value) => value[0])),
    median(samples.map((value) => value[1])),
    median(samples.map((value) => value[2])),
  ];

  const deviations = samples
    .map(([r, g, b]) =>
      Math.sqrt(
        (r - background[0]) ** 2 +
          (g - background[1]) ** 2 +
          (b - background[2]) ** 2,
      ),
    )
    .sort((a, b) => a - b);
  const p90 = deviations[Math.floor((deviations.length - 1) * 0.9)] ?? Infinity;

  // Only remove a genuinely bright, uniform catalogue background. White
  // laboratory products are common, so ambiguous sources stay untouched.
  return luminance(...background) >= 238 && p90 <= 20
    ? background
    : null;
}

function touchesRemovedPixel(
  removed: Uint8Array,
  index: number,
  width: number,
  height: number,
): boolean {
  const x = index % width;
  const y = Math.floor(index / width);
  return (
    (x > 0 && removed[index - 1] === 1) ||
    (x + 1 < width && removed[index + 1] === 1) ||
    (y > 0 && removed[index - width] === 1) ||
    (y + 1 < height && removed[index + width] === 1)
  );
}

function bestInteriorNeighbor(
  data: Uint8ClampedArray,
  removed: Uint8Array,
  index: number,
  width: number,
  height: number,
  background: Rgb,
): number | null {
  const x = index % width;
  const y = Math.floor(index / width);
  const candidates: number[] = [];
  if (x > 0) candidates.push(index - 1);
  if (x + 1 < width) candidates.push(index + 1);
  if (y > 0) candidates.push(index - width);
  if (y + 1 < height) candidates.push(index + width);

  let best: number | null = null;
  let bestDistance = -1;
  for (const candidate of candidates) {
    if (removed[candidate]) continue;
    const offset = candidate * 4;
    if (data[offset + 3] <= 32) continue;
    const distance = pixelDistance(data, offset, background);
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

function refineCutoutEdge(
  data: Uint8ClampedArray,
  removed: Uint8Array,
  width: number,
  height: number,
  background: Rgb,
): { edgePixels: number; riskyPixels: number } {
  const total = width * height;
  let edgePixels = 0;
  let riskyPixels = 0;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    if (removed[index] || data[offset + 3] <= 32) continue;
    if (!touchesRemovedPixel(removed, index, width, height)) continue;

    edgePixels += 1;
    const lightness = luminance(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    const distance = pixelDistance(data, offset, background);

    if (lightness > 232 && distance < 36) riskyPixels += 1;

    // Feather only the one-pixel antialiasing fringe. Never reduce alpha
    // enough to create the visibly "eaten" white-plastic edges.
    if (lightness > 214 && distance >= 22 && distance < 42) {
      const t = (distance - 22) / 20;
      const alpha = Math.round(210 + Math.max(0, Math.min(1, t)) * 45);
      data[offset + 3] = Math.min(data[offset + 3], alpha);
    }

    // Reduce white matte contamination by borrowing a little colour from the
    // nearest interior foreground pixel instead of deleting more pixels.
    if (lightness > 205 && distance < 58) {
      const interior = bestInteriorNeighbor(
        data,
        removed,
        index,
        width,
        height,
        background,
      );
      if (interior !== null) {
        const interiorOffset = interior * 4;
        const interiorLightness = luminance(
          data[interiorOffset],
          data[interiorOffset + 1],
          data[interiorOffset + 2],
        );
        const matteBias = Math.max(
          0,
          Math.min(0.28, (lightness - interiorLightness) / 180),
        );
        if (matteBias > 0.04) {
          for (let channel = 0; channel < 3; channel += 1) {
            data[offset + channel] = Math.round(
              data[offset + channel] * (1 - matteBias) +
                data[interiorOffset + channel] * matteBias,
            );
          }
        }
      }
    }
  }

  return { edgePixels, riskyPixels };
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
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";
  outputContext.drawImage(source, sx, sy, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

/**
 * Conservative catalogue-image cleanup. It removes only a bright, uniform
 * edge-connected background and preserves every object that was actually
 * photographed. When confidence is low it falls back to the untouched source.
 * This is intentionally safer than aggressive chroma-keying for white
 * laboratory equipment and other light products.
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
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

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
        lightness >= Math.max(222, backgroundLuminance - 24) &&
        pixelDistance(data, offset, background) <= 24
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
    if (removedRatio < 0.08 || removedRatio > 0.86) {
      cleanedImageCache.set(src, src);
      return src;
    }

    for (let index = 0; index < total; index += 1) {
      if (removed[index]) data[index * 4 + 3] = 0;
    }
const { edgePixels, riskyPixels } = refineCutoutEdge(
      data,
      removed,
      width,
      height,
      background,
    );

    // If most surviving edge pixels remain practically indistinguishable from
    // the white background, segmentation is too ambiguous to trust. Falling
    // back to the untouched photo is preferable to a damaged product.
    if (edgePixels > 24 && riskyPixels / edgePixels > 0.72) {
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
