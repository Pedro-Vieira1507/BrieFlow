// src/components/briefflow/OptimizedImage.tsx
import { useState, useEffect, type ImgHTMLAttributes } from "react";
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

export function OptimizedImage({
  aspect = "auto",
  rounded = "rounded-xl",
  className,
  onLoad,
  onError,
  alt,
  src,
  ...rest
}: Props) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  const isExternal = src && src.startsWith("http") && !src.includes("wsrv.nl") && !src.includes("picsum.photos");
  
  const proxy1 = isExternal ? `https://wsrv.nl/?url=${encodeURIComponent(src!)}&output=webp&w=400` : (src || "");
  const proxy2 = isExternal ? `https://api.allorigins.win/raw?url=${encodeURIComponent(src!)}` : "";
  
  const [imgSrc, setImgSrc] = useState(proxy1);
  const [proxyLevel, setProxyLevel] = useState(0);

  useEffect(() => {
    setImgSrc(proxy1);
    setProxyLevel(0);
    setStatus("loading");
  }, [proxy1]);

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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-2 text-fg-muted p-2 text-center">
          <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Sem Imagem</span>
        </div>
      )}
      {imgSrc && (
        <img
          {...rest}
          src={imgSrc}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            setStatus("loaded");
            onLoad?.(e);
          }}
          onError={(e) => {
            if (isExternal && proxyLevel === 0) {
              setProxyLevel(1);
              setImgSrc(proxy2);
            } else if (isExternal && proxyLevel === 1) {
              setProxyLevel(2);
              setImgSrc(src!);
            } else {
              setStatus("error");
              onError?.(e);
            }
          }}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500",
            status === "loaded" ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      )}
    </div>
  );
}