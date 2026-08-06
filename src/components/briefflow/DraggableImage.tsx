// src/components/briefflow/DraggableImage.tsx
import { useState, useRef, useEffect } from "react";

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

  const isExternal = src && src.startsWith("http") && !src.includes("wsrv.nl") && !src.includes("picsum.photos");
  
  const proxy1 = isExternal ? `https://wsrv.nl/?url=${encodeURIComponent(src)}&output=webp&w=600` : src;
  const proxy2 = isExternal ? `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}` : "";
  
  const [imgSrc, setImgSrc] = useState(proxy1);
  const [proxyLevel, setProxyLevel] = useState(0);

  useEffect(() => {
    setImgSrc(proxy1);
    setProxyLevel(0);
  }, [proxy1]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current && !isResizing.current) return;
      
      let clientX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
      let clientY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

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

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsActive(false);
      }
    };

    if (isActive) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("touchmove", handleMouseMove, { passive: false });
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchend", handleMouseUp);
      
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isActive]);

  const onPointerDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsActive(true);
    isDragging.current = true;
    
    let clientX = 0; let clientY = 0;
    if ('clientX' in e) { clientX = e.clientX; clientY = e.clientY; }
    else if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }

    startMousePos.current = { x: clientX, y: clientY };
    initialPos.current = { ...pos };
  };

  const onResizeDown = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsActive(true);
    isResizing.current = true;
    
    let clientX = 0; let clientY = 0;
    if ('clientX' in e) { clientX = e.clientX; clientY = e.clientY; }
    else if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }

    startMousePos.current = { x: clientX, y: clientY };
    initialScale.current = scale;
  };

  return (
    <div
      ref={containerRef}
      className={`absolute z-50 cursor-move transition-shadow ${isActive ? 'ring-2 ring-brand ring-dashed shadow-2xl' : 'hover:ring-2 hover:ring-white/50 hover:ring-dashed drop-shadow-2xl'}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transformOrigin: 'center' }}
      onPointerDown={onPointerDown}
    >
      <img 
        src={imgSrc} 
        alt="Produto" 
        className="max-h-[250px] w-auto object-contain pointer-events-none rounded-xl bg-transparent mix-blend-multiply select-none" 
        draggable={false} 
        onError={() => {
          if (isExternal && proxyLevel === 0) {
            setProxyLevel(1);
            setImgSrc(proxy2);
          } else if (isExternal && proxyLevel === 1) {
            setProxyLevel(2);
            setImgSrc(src);
          }
        }}
      />
      
      {isActive && (
        <>
          <div onPointerDown={onResizeDown} className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-[3px] border-brand rounded-full cursor-nwse-resize z-50 shadow-md" />
          <div onPointerDown={onResizeDown} className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-[3px] border-brand rounded-full cursor-nesw-resize z-50 shadow-md" />
          <div onPointerDown={onResizeDown} className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-[3px] border-brand rounded-full cursor-nesw-resize z-50 shadow-md" />
          <div onPointerDown={onResizeDown} className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-[3px] border-brand rounded-full cursor-nwse-resize z-50 shadow-md" />
        </>
      )}
    </div>
  );
}