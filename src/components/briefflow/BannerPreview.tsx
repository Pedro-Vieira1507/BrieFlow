// src/components/briefflow/BannerPreview.tsx
import { Editable } from "./Editable";
import { DraggableImage } from "./DraggableImage";
import type { BuilderState } from "@/types/builder";
import { Sparkles, Hexagon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRef } from "react";

interface Props {
  state: BuilderState;
  onChange: (patch: Partial<BuilderState>) => void;
}

export function BannerPreview({ state, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const themeColor = state.themeColor || "#2563EB";
  const secondaryColor = state.secondaryColor || "#FF5722";
  const rawCta = state.cta || "Saiba Mais";
  const cleanCta = rawCta.replace(/\[|\]|\*/g, '').replace(/nenhum/i, '').trim();

  const images = Array.from(new Set([
    ...(state.productImageUrl ? [state.productImageUrl] : []),
    ...(state.productImages || [])
  ]));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      onChange({ productImageUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const BrandHeader = ({ dark = false }: { dark?: boolean }) => (
    <div className={cn("absolute top-6 left-6 md:top-8 md:left-10 z-30 flex items-center gap-2", dark ? "text-slate-900" : "text-white")}>
      <div className={cn("size-8 rounded-lg flex items-center justify-center shadow-lg", dark ? "bg-slate-900 text-white" : "bg-white text-slate-900")}>
        <Hexagon className="size-5 fill-current" />
      </div>
      <span className="font-black tracking-widest uppercase text-sm drop-shadow-md">{state.brandName || "MARCA"}</span>
    </div>
  );

  const BackgroundLayer = () => (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-slate-50 z-0">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `radial-gradient(circle at 100% 0%, ${secondaryColor}, transparent 50%)` }} />
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(circle at 0% 100%, ${themeColor}, transparent 70%)` }} />
    </div>
  );

  const renderLayout = () => {
    return (
      <div className="relative flex aspect-[21/9] md:aspect-[2.5/1] min-h-[360px] w-full shrink-0 overflow-hidden rounded-[24px] shadow-2xl flex-row bg-[#f8fafc]">
        <BackgroundLayer />
        <BrandHeader dark />
        
        {/* Área de Texto Gerada pela IA */}
        <div className="relative z-20 flex h-full w-[50%] flex-col justify-center px-10 md:px-14 py-8" style={{ backgroundColor: themeColor }}>
          <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 backdrop-blur-md mt-6">
            <Sparkles className="size-3 text-white" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Lançamento</span>
          </div>
          <Editable as="h2" value={state.title ?? "Título"} onChange={(v) => onChange({ title: v })} className="text-white text-[28px] md:text-[40px] font-black leading-tight tracking-tight mb-4" />
          {state.subtitle && <Editable as="p" value={state.subtitle} onChange={(v) => onChange({ subtitle: v })} className="text-white/80 text-[14px] md:text-[15px] font-medium leading-relaxed mb-8" />}
          {state.cta && (
            <div className="w-fit px-8 py-3.5 bg-white rounded-md font-black uppercase tracking-widest shadow-xl transition-transform hover:scale-105" style={{ color: themeColor }}>
              <Editable as="span" value={cleanCta} onChange={(v) => onChange({ cta: v })} />
            </div>
          )}
        </div>

        {/* Área de Produtos Arrastáveis */}
        <div className="relative z-30 w-[50%] h-full flex items-center justify-center">
          {images.map((src, i) => (
             <DraggableImage key={i} src={src} />
          ))}
          {images.length === 0 && (
            <p className="text-slate-400 font-medium text-sm border-2 border-dashed border-slate-300 rounded-xl p-6">Nenhum produto importado</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full flex-col space-y-4">
      {renderLayout()}
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/50 p-3 shadow-sm">
        <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">
          Estúdio: <span style={{ color: themeColor }}>CANVAS INTERATIVO</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleFileChange} />
          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0 font-bold border-border-strong bg-surface-2" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 size-3.5" /> Upload Foto
          </Button>
        </div>
      </div>
    </div>
  );
}