import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends ImgHTMLAttributes<HTMLImageElement> {
  aspect?: "square" | "video" | "banner" | "auto";
  rounded?: string;
}

const ASPECT: Record<NonNullable<Props["aspect"]>, string> = {
  square: "aspect-square",
  video: "aspect-video",
  banner: "aspect-[16/6]",
  auto: "",
};

/**
 * Imagem otimizada para Pollinations / assets remotos.
 * - Skeleton shimmer até carregar.
 * - Fade-in suave ao ficar pronta.
 * - loading="lazy", decoding="async", fetchPriority explícito quando fizer sentido.
 */
export function OptimizedImage({
  aspect = "auto",
  rounded = "rounded-xl",
  className,
  onLoad,
  onError,
  alt,
  ...rest
}: Props) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-surface-2",
        ASPECT[aspect],
        rounded,
      )}
    >
      {status === "loading" && (
        <div className={cn("absolute inset-0 skeleton", rounded)} aria-hidden />
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">
          Imagem indisponível
        </div>
      )}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        {...rest}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onLoad={(e) => {
          setStatus("loaded");
          onLoad?.(e);
        }}
        onError={(e) => {
          setStatus("error");
          onError?.(e);
        }}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          status === "loaded" ? "opacity-100" : "opacity-0",
          className,
        )}
      />
    </div>
  );
}
