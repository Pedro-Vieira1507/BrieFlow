// src/components/briefflow/DraggableImage.tsx
import { useState, useRef, useEffect } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function DraggableImage({ src }: { src: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });
  const initialScale = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isExternal =
    !!src &&
    src.startsWith("http") &&
    !src.includes("wsrv.nl") &&
    !src.includes("picsum.photos");
    
  // Qualidade: Proxy com largura aumentada (1200px) e qualidade máxima (q=95)
  const proxy1 = isExternal
    ? `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=1200&q=95`
    : src;
    
  const proxy2 = isExternal
    ? `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`
    : "";

  const [imgSrc, setImgSrc] = useState(proxy1);
  const [proxyLevel, setProxyLevel] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgSrc(proxy1);
    setProxyLevel(0);
    setFailed(false);
  }, [proxy1]);

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current && !isResizing.current) return;
      const clientX =
        e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const clientY =
        e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

      if (isDragging.current) {
        setPos({
          x: initialPos.current.x + (clientX - startMousePos.current.x),
          y: initialPos.current.y + (clientY - startMousePos.current.y),
        });
      } else if (isResizing.current) {
        const delta = (clientX - startMousePos.current.x) * 0.005;
        setScale(Math.max(0.2, Math.min(initialScale.current + delta, 5)));
      }
    };

    const handleUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsActive(false);
      }
    };

    if (isActive) {
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("touchmove", handleMove, { passive: false });
      window.addEventListener("mouseup", handleUp);
      window.addEventListener("touchend", handleUp);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isActive]);

  const onPointerDown = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    if (failed) return;
    setIsActive(true);
    isDragging.current = true;
    let clientX = 0;
    let clientY = 0;
    if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    startMousePos.current = { x: clientX, y: clientY };
    initialPos.current = { ...pos };
  };

  const onResizeDown = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    e.stopPropagation();
    setIsActive(true);
    isResizing.current = true;
    let clientX = 0;
    let clientY = 0;
    if ("clientX" in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    startMousePos.current = { x: clientX, y: clientY };
    initialScale.current = scale;
  };

  const handleImgError = () => {
    if (isExternal && proxyLevel === 0) {
      setProxyLevel(1);
      setImgSrc(proxy2);
    } else if (isExternal && proxyLevel === 1) {
      setProxyLevel(2);
      setImgSrc(src);
    } else {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <div
        ref={containerRef}
        data-testid="draggable-image-fallback"
        className={cn(
          "absolute z-40 flex h-[180px] w-[180px] flex-col items-center justify-center gap-1.5 rounded-xl",
          "border-2 border-dashed border-[#cbd5e1] bg-[rgba(241,245,249,0.8)] backdrop-blur-sm",
          "text-[#94a3b8] shadow-lg cursor-grab active:cursor-grabbing",
        )}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
        onPointerDown={onPointerDown}
      >
        <ImageOff className="size-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-center">
          Imagem indisponível
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="draggable-image"
      className={cn(
        "absolute z-40 cursor-grab active:cursor-grabbing transition-all duration-200",
        isActive
          ? "ring-2 ring-dashed ring-brand shadow-[0_20px_50px_rgba(0,0,0,0.5)] scale-105"
          : "drop-shadow-2xl hover:ring-2 hover:ring-dashed hover:ring-white/50",
      )}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
        transformOrigin: "center",
      }}
      onPointerDown={onPointerDown}
    >
      <img
        src={imgSrc}
        alt="Produto"
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        className="pointer-events-none max-h-[250px] w-auto select-none rounded-xl bg-transparent object-contain mix-blend-multiply"
        draggable={false}
        onError={handleImgError}
        style={{ imageRendering: "high-quality" }} // Força o anti-aliasing do navegador
      />
      {isActive && (
        <>
          <div
            onPointerDown={onResizeDown}
            className="absolute -left-2.5 -top-2.5 z-50 h-5 w-5 cursor-nwse-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={onResizeDown}
            className="absolute -right-2.5 -top-2.5 z-50 h-5 w-5 cursor-nesw-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={onResizeDown}
            className="absolute -bottom-2.5 -left-2.5 z-50 h-5 w-5 cursor-nesw-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform"
          />
          <div
            onPointerDown={onResizeDown}
            className="absolute -bottom-2.5 -right-2.5 z-50 h-5 w-5 cursor-nwse-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform"
          />
        </>
      )}
    </div>
  );
}