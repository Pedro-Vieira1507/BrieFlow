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
  background: [number, number, number],
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
): [number, number, number] | null {
  const samplePoints: Array<[number, number]> = [];
  const insetX = Math.max(1, Math.round(width * 0.025));
  const insetY = Math.max(1, Math.round(height * 0.025));
  const xValues = [insetX, Math.floor(width / 2), width - insetX - 1];
  const yValues = [insetY, Math.floor(height / 2), height - insetY - 1];

  for (const x of xValues) {
    samplePoints.push([x, insetY], [x, height - insetY - 1]);
  }
  for (const y of yValues) {
    samplePoints.push([insetX, y], [width - insetX - 1, y]);
  }

  const samples = samplePoints
    .map(([x, y]) => {
      const offset = (y * width + x) * 4;
      return [data[offset], data[offset + 1], data[offset + 2]] as const;
    })
    .filter(([r, g, b]) => luminance(r, g, b) > 180);

  if (samples.length < 8) return null;

  const average = samples.reduce(
    (sum, value) => [sum[0] + value[0], sum[1] + value[1], sum[2] + value[2]],
    [0, 0, 0] as [number, number, number],
  );
  const background: [number, number, number] = [
    average[0] / samples.length,
    average[1] / samples.length,
    average[2] / samples.length,
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

  const backgroundLuminance = luminance(...background);
  return backgroundLuminance >= 205 && maxDeviation <= 42 ? background : null;
}

/**
 * Removes only a light, nearly-uniform background connected to the image edge.
 * White details inside the product remain intact, so laboratory equipment and
 * other light-colored products do not get erased with the source background.
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
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    let removed = 0;

    const isBackgroundPixel = (index: number) => {
      const offset = index * 4;
      if (data[offset + 3] === 0) return true;
      const lightness = luminance(
        data[offset],
        data[offset + 1],
        data[offset + 2],
      );
      return lightness >= 178 && pixelDistance(data, offset, background) <= 52;
    };

    const enqueue = (index: number) => {
      if (index < 0 || index >= total || visited[index]) return;
      if (!isBackgroundPixel(index)) return;
      visited[index] = 1;
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
      removed += 1;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (y > 0) enqueue(index - width);
      if (y + 1 < height) enqueue(index + width);
    }

    if (removed / total < 0.12) {
      cleanedImageCache.set(src, src);
      return src;
    }

    for (let index = 0; index < total; index += 1) {
      if (!visited[index]) continue;
      data[index * 4 + 3] = 0;
    }

    context.putImageData(imageData, 0, 0);
    const cleaned = canvas.toDataURL("image/png", 1);
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

    // The interactive preview warms the cache. Export clones reuse the cleaned
    // result, keeping preview and exported files visually consistent.
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
