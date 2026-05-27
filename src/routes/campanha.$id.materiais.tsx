import { createFileRoute, Link } from "@tanstack/react-router";
import { useCampaign, MATERIAL_META, type MaterialKey, store } from "@/lib/store";
import { generateAllMaterials, generatePodcastAudio, type GenerationProgress } from "@/lib/generateMaterials";
import { generateSlidesWithAI, generatePptx } from "@/lib/generatePptx";
import { generateFolhetoData, renderFolhetoCanvas, downloadFolhetoPng } from "@/lib/generateFolheto";
import { generateFichaTecnicaData, generateFichaTecnicaPDF, downloadFichaTecnicaPDF } from "@/lib/generateFichaTecnica";
import { generateEmailSequencia, downloadEmailHtml } from "@/lib/generateEmail";
import type { EmailSequencia } from "@/lib/generateEmail";
import { generateLinkedInPosts, generateFacebookPosts, generateInstagramData, generateVideoRoteiro } from "@/lib/generateSocialPosts";
import type { LinkedInPost, FacebookPost, InstagramData, VideoRoteiro } from "@/lib/generateSocialPosts";
import { getActiveKey, loadAIConfig } from "@/lib/aiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Download, Sparkles, Loader2, Zap, Mic,
  Presentation, ImageIcon, FileText, Mail, Facebook,
  Instagram, Linkedin, Video, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanha/$id/materiais")({ component: Page });

// ─── Componentes de Preview ───────────────────────────────────────────────────

function EmailPreview({ emails, tipo, campanha }: { emails: EmailSequencia["emails"]; tipo: string; campanha: string }) {
  const [idx, setIdx] = useState(0);
  const cur = emails[idx];
  if (!cur) return null;
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
      <div className="bg-amber-50 dark:bg-amber-950/30 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            E-mail {idx + 1} de {emails.length} · {tipo === "revendedores" ? "Revendedores" : "Cliente Final"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          {emails.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${ i === idx ? "bg-amber-500 w-4" : "bg-amber-200" }`} />
          ))}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIdx(Math.min(emails.length - 1, idx + 1))} disabled={idx === emails.length - 1}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-amber-600" onClick={() => downloadEmailHtml(cur.html, idx, campanha, tipo)}>
            <Download className="h-3 w-3 mr-1" /> .html
          </Button>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 px-4 py-2 border-b border-amber-100 dark:border-amber-900">
        <p className="text-xs text-muted-foreground">Assunto:</p>
        <p className="text-sm font-semibold">{cur.assunto}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{cur.preheader}</p>
      </div>
      <div className="bg-gray-100 dark:bg-gray-900 p-3">
        <iframe
          srcDoc={cur.html}
          title={`E-mail ${idx + 1}`}
          className="w-full rounded border border-amber-100 dark:border-amber-900 bg-white"
          style={{ height: 480 }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

function LinkedInPreview({ posts }: { posts: LinkedInPost[] }) {
  const [idx, setIdx] = useState(0);
  const p = posts[idx];
  if (!p) return null;
  return (
    <div className="rounded-xl border border-sky-200 dark:border-sky-800 overflow-hidden">
      <div className="bg-sky-50 dark:bg-sky-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5 text-sky-600" />
          <span className="text-xs font-medium text-sky-700 dark:text-sky-300">Post {idx + 1} de {posts.length} · {p.tipo === "autoridade" ? "Autoridade" : "Oferta"}</span>
        </div>
        <div className="flex gap-1">
          {posts.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${ i === idx ? "bg-sky-500 w-6" : "bg-sky-200 w-2" }`} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 p-4">
        <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">B</div>
            <div>
              <p className="text-sm font-semibold">BriefFlow</p>
              <p className="text-xs text-muted-foreground">Empresa · Agora</p>
            </div>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-sm font-bold leading-snug">{p.titulo}</p>
            <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">{p.corpo}</p>
            <p className="text-sm font-medium text-sky-600">{p.cta}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {p.hashtags.map((h, i) => <span key={i} className="text-xs text-sky-500">#{h}</span>)}
            </div>
          </div>
          <div className="flex gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
            <span>👍 Curtir</span><span>💬 Comentar</span><span>🔁 Compartilhar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ posts }: { posts: FacebookPost[] }) {
  const [idx, setIdx] = useState(0);
  const p = posts[idx];
  if (!p) return null;
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
      <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Post {idx + 1} de {posts.length} · {p.tipo === "apresentacao" ? "Apresentação" : "Oferta"}</span>
        </div>
        <div className="flex gap-1">
          {posts.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${ i === idx ? "bg-blue-500 w-6" : "bg-blue-200 w-2" }`} />
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-900 p-4">
        <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">B</div>
            <div>
              <p className="text-sm font-semibold">BriefFlow</p>
              <p className="text-xs text-muted-foreground">🌐 Página · Agora</p>
            </div>
          </div>
          <div className="p-3">
            <p className="text-sm whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">{p.texto}</p>
            <p className="text-sm font-semibold text-blue-600 mt-2">{p.cta}</p>
          </div>
          <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 flex items-center justify-center">
            <div className="text-center">
              <span className="text-3xl">{p.emojis}</span>
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">Imagem do post</p>
            </div>
          </div>
          <div className="flex gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-muted-foreground">
            <span>👍 Curtir</span><span>💬 Comentar</span><span>🔄 Compartilhar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramPreview({ data }: { data: InstagramData }) {
  const [tab, setTab] = useState<"carrossel" | "reels">("carrossel");
  const [slideIdx, setSlideIdx] = useState(0);
  const slides = data.carrossel.slides;
  const cur = slides[slideIdx];

  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden">
      <div className="bg-rose-50 dark:bg-rose-950/30 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-3.5 w-3.5 text-rose-500" />
          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">Instagram Preview</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("carrossel")}
            className={`text-xs px-2 py-0.5 rounded-full transition-all ${ tab === "carrossel" ? "bg-rose-500 text-white" : "text-rose-400" }`}>Carrossel</button>
          <button onClick={() => setTab("reels")}
            className={`text-xs px-2 py-0.5 rounded-full transition-all ${ tab === "reels" ? "bg-rose-500 text-white" : "text-rose-400" }`}>Reels</button>
        </div>
      </div>

      {tab === "carrossel" && (
        <div className="bg-white dark:bg-slate-900 p-4">
          <div className="max-w-xs mx-auto">
            <div className="aspect-square rounded-lg flex flex-col items-center justify-center p-4 text-white relative overflow-hidden"
              style={{ background: cur?.cor ?? "#6C63FF" }}>
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 70% 30%, white 0%, transparent 60%)" }} />
              <p className="text-lg font-bold text-center leading-tight z-10">{cur?.texto}</p>
              <p className="text-xs mt-2 opacity-75 text-center z-10">{cur?.visual}</p>
            </div>
            <div className="flex justify-center gap-1 mt-2">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlideIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${ i === slideIdx ? "bg-rose-500 w-4" : "bg-gray-300 w-1.5" }`} />
              ))}
            </div>
            <div className="flex gap-1 justify-center mt-1">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSlideIdx(Math.max(0, slideIdx - 1))} disabled={slideIdx === 0}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground self-center">{slideIdx + 1}/{slides.length}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSlideIdx(Math.min(slides.length - 1, slideIdx + 1))} disabled={slideIdx === slides.length - 1}>
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-300">{data.carrossel.legenda}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.carrossel.hashtags.slice(0, 5).map((h, i) => (
                  <span key={i} className="text-xs text-rose-400">#{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "reels" && (
        <div className="bg-white dark:bg-slate-900 p-4">
          <div className="max-w-lg mx-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline" className="text-xs border-rose-300 text-rose-600">⏱ {data.reels.duracao}</Badge>
              <span className="text-xs text-muted-foreground">🎵 {data.reels.musica}</span>
            </div>
            {data.reels.cenas.map((cena, i) => (
              <div key={i} className="flex gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 border-l-4 border-rose-400">
                <div className="shrink-0 w-10 h-10 rounded bg-gradient-to-br from-rose-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">{cena.tempo}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{cena.visual}</p>
                  <p className="text-xs text-rose-600 font-semibold mt-0.5">"{cena.texto}"</p>
                  <p className="text-xs text-muted-foreground italic mt-0.5">{cena.locucao}</p>
                </div>
              </div>
            ))}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mt-2">
              <p className="text-xs text-gray-700 dark:text-gray-300">{data.reels.legenda}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {data.reels.hashtags.slice(0, 5).map((h, i) => (
                  <span key={i} className="text-xs text-rose-400">#{h}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoRoteiroPreview({ roteiro }: { roteiro: VideoRoteiro }) {
  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
      <div className="bg-orange-50 dark:bg-orange-950/30 px-4 py-2 flex items-center gap-2">
        <Video className="h-3.5 w-3.5 text-orange-600" />
        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
          {roteiro.titulo} · {roteiro.duracao} · {roteiro.formato}
        </span>
      </div>
      <div className="bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="relative">
          <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-orange-200 dark:bg-orange-800" />
          <div className="space-y-3">
            {roteiro.cenas.map((c