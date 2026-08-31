// src/components/briefflow/DraggableImage.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const positionCache = new Map<string, { x: number; y: number; scale: number }>();

export function DraggableImage({ src, type = "default", isExport = false }: { src?: string | null; type?: string; isExport?: boolean }) {
  const safeSrc = typeof src === "string" ? src : "";
  const cacheKey = useMemo(() => {
    const hash = safeSrc.length > 100 ? `${safeSrc.length}-${safeSrc.substring(safeSrc.length - 50)}` : safeSrc;
    return `${type}-v10-${hash}`;
  }, [safeSrc, type]);

  const cached = useMemo(() => positionCache.get(cacheKey) || { x: 0, y: 0, scale: 1 }, [cacheKey]);
  const [pos, setPos] = useState({ x: cached.x, y: cached.y });
  const [scale, setScale] = useState(cached.scale);
  const [isActive, setIsActive] = useState(false);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const startMousePos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const initialScale = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const isExternal =
    !!safeSrc &&
    safeSrc.startsWith("http") &&
    !safeSrc.includes("wsrv.nl") &&
    !safeSrc.includes("picsum.photos");

  const proxy1 = isExternal
    ? `https://wsrv.nl/?url=${encodeURIComponent(safeSrc)}&output=webp&w=1200&q=95`
    : safeSrc;
  const proxy2 = isExternal
    ? `https://api.allorigins.win/raw?url=${encodeURIComponent(safeSrc)}`
    : "";

  const [imgSrc, setImgSrc] = useState<string | undefined>(() => {
    return safeSrc.startsWith('blob:') ? undefined : proxy1;
  });
  
  const [proxyLevel, setProxyLevel] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (safeSrc.startsWith('blob:')) {
      fetch(safeSrc)
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (isMounted) setImgSrc(reader.result as string);
          };
          reader.readAsDataURL(blob);
        })
        .catch(err => {
          console.error("Failed to convert blob to base64", err);
          if (isMounted) setImgSrc(proxy1);
        });
    } else {
      if (isMounted) setImgSrc(proxy1);
    }
    setProxyLevel(0);
    setFailed(false);
    return () => { isMounted = false; };
  }, [safeSrc, proxy1]);

  useEffect(() => {
    const currentCache = positionCache.get(cacheKey);
    if (currentCache) {
      setPos({ x: currentCache.x, y: currentCache.y });
      setScale(currentCache.scale);
    }
  }, [cacheKey]);

  useEffect(() => {
    positionCache.set(cacheKey, { x: pos.x, y: pos.y, scale });
  }, [pos, scale, cacheKey]);

  useEffect(() => {
    if (isExport) {
       setIsActive(false);
       return;
    }
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current && !isResizing.current) return;
      const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

      if (isDragging.current) {
        const parent = containerRef.current?.closest('#banner-export-node, #email-export-node, #social-export-node') as HTMLElement;
        const pWidth = parent ? parent.clientWidth : window.innerWidth;
        const pHeight = parent ? parent.clientHeight : window.innerHeight;

        const deltaX = ((clientX - startMousePos.current.x) / pWidth) * 100;
        const deltaY = ((clientY - startMousePos.current.y) / pHeight) * 100;

        setPos({
          x: startPos.current.x + deltaX,
          y: startPos.current.y + deltaY,
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
  }, [isActive, isExport]);

  const onPointerDown = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    if (isExport) return;
    e.stopPropagation();
    if (failed) return;
    setIsActive(true);
    isDragging.current = true;
    let clientX = 0, clientY = 0;
    if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; } 
    else if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    
    startMousePos.current = { x: clientX, y: clientY };
    startPos.current = { ...pos };
  };

  const onResizeDown = (
    e: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    if (isExport) return;
    e.stopPropagation();
    setIsActive(true);
    isResizing.current = true;
    let clientX = 0, clientY = 0;
    if ("clientX" in e) { clientX = e.clientX; clientY = e.clientY; } 
    else if ("touches" in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    
    startMousePos.current = { x: clientX, y: clientY };
    initialScale.current = scale;
  };

  const handleImgError = () => {
    if (isExternal && proxyLevel === 0) {
      setProxyLevel(1);
      setImgSrc(proxy2);
    } else if (isExternal && proxyLevel === 1) {
      setProxyLevel(2);
      setImgSrc(safeSrc);
    } else {
      setFailed(true);
    }
  };

  const isSafeOrigin = imgSrc?.startsWith("data:") || imgSrc?.startsWith("blob:");

  if (failed && !isExport) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "absolute z-40 flex flex-col items-center justify-center gap-1.5 rounded-xl pointer-events-auto",
          "border-2 border-dashed border-[#cbd5e1] bg-[rgba(241,245,249,0.8)]",
          "text-[#94a3b8] shadow-lg cursor-grab active:cursor-grabbing",
        )}
        style={{ position: 'absolute', zIndex: 40, left: `${pos.x}%`, top: `${pos.y}%`, width: type === "banner" ? '20%' : '40%', aspectRatio: '1', transform: `scale(${scale})` }}
        onPointerDown={onPointerDown}
      >
        <ImageOff className="size-6" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-center">
          Indisponível
        </span>
      </div>
    );
  } else if (failed && isExport) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-40 transition-all duration-200 pointer-events-auto",
        !isExport && "cursor-grab active:cursor-grabbing",
        isActive && !isExport
          ? "ring-2 ring-dashed ring-brand shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          : (!isExport ? "drop-shadow-2xl hover:ring-2 hover:ring-dashed hover:ring-white/50" : "drop-shadow-2xl"),
      )}
      style={{
        position: 'absolute',
        zIndex: 40,
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        width: type === "banner" ? '20%' : '40%',
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
      onPointerDown={!isExport ? onPointerDown : undefined}
    >
      {imgSrc && (
        <img
          src={imgSrc}
          alt="Produto"
          crossOrigin={isSafeOrigin ? undefined : "anonymous"}
          loading="lazy"
          decoding="async"
          className="pointer-events-none w-full h-auto select-none rounded-xl bg-transparent object-contain"
          draggable={false}
          onError={handleImgError}
          style={{ imageRendering: "auto" }}
        />
      )}
      
      {isActive && !isExport && (
        <>
          <div onPointerDown={onResizeDown} className="absolute -left-2.5 -top-2.5 z-50 h-5 w-5 cursor-nwse-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform" />
          <div onPointerDown={onResizeDown} className="absolute -right-2.5 -top-2.5 z-50 h-5 w-5 cursor-nesw-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform" />
          <div onPointerDown={onResizeDown} className="absolute -bottom-2.5 -left-2.5 z-50 h-5 w-5 cursor-nesw-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform" />
          <div onPointerDown={onResizeDown} className="absolute -bottom-2.5 -right-2.5 z-50 h-5 w-5 cursor-nwse-resize rounded-full border-[3px] border-brand bg-white shadow-md hover:scale-125 transition-transform" />
        </>
      )}
    </div>
  );
}
