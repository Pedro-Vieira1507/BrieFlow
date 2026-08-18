// src/lib/visual-search.ts
import { createServerFn } from "@tanstack/react-start";
import { Buffer } from "node:buffer";

export interface ProfessionalImageResult {
  imageUrl: string | null;
  found: boolean;
  error?: string;
}

export const visualSearchFn = createServerFn({ method: "POST" })
  .validator((payload: any) => {
    const query = payload?.query || payload?.data?.query;
    if (!query || typeof query !== "string") {
      throw new Error(`Termo de busca (SKU/Produto) obrigatório.`);
    }
    return { query: query.trim() };
  })
  .handler(async ({ data }): Promise<ProfessionalImageResult> => {
    try {
      const searchTerm = data.query;
      
      const rawKey = process.env.VITE_GOOGLE_SEARCH_API_KEY || import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || "";
      const rawCx = process.env.VITE_GOOGLE_SEARCH_CX || import.meta.env.VITE_GOOGLE_SEARCH_CX || "";
      const rawBgKey = process.env.VITE_REMOVEBG_API_KEY || import.meta.env.VITE_REMOVEBG_API_KEY || "";
      
      const googleApiKey = rawKey.replace(/['"]/g, '').trim();
      const googleCx = rawCx.replace(/['"]/g, '').trim();
      const removeBgKey = rawBgKey.replace(/['"]/g, '').trim();

      if (!googleApiKey || !googleCx) {
        return { imageUrl: null, found: false, error: "Chaves do Google Search não configuradas." };
      }

      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${googleCx}&q=${encodeURIComponent(searchTerm)}&searchType=image&num=1`;
      
      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        const errText = await searchResponse.text();
        console.error("\n=== GOOGLE 403/ERROR DEBUG ===");
        console.error("1. Chave usada começa com:", googleApiKey.substring(0, 8));
        console.error("2. CX usado começa com:", googleCx.substring(0, 8));
        console.error("3. Erro retornado pelo Google:", errText);
        console.error("================================\n");
        return { imageUrl: null, found: false, error: `O Google bloqueou a busca (Erro ${searchResponse.status}). Verifique o terminal para detalhes da chave.` };
      }
      
      const searchData = await searchResponse.json();
      const firstImageUrl = searchData.items?.[0]?.link;

      if (!firstImageUrl) {
        return { imageUrl: null, found: false, error: "O Google não encontrou nenhuma imagem para este produto." };
      }

      let imgResponse = await fetch(firstImageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      
      if (!imgResponse.ok) {
         imgResponse = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(firstImageUrl)}`);
      }

      if (!imgResponse.ok) {
        return { imageUrl: firstImageUrl, found: true, error: "O Google achou a imagem, mas o site de origem bloqueou a extração." };
      }
      
      const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
      const base64Source = imageBuffer.toString('base64');
      const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
      const originalDataUrl = `data:${contentType};base64,${base64Source}`;

      if (!removeBgKey) {
        return { imageUrl: originalDataUrl, found: true };
      }

      const formData = new URLSearchParams();
      formData.append("image_file_b64", base64Source);
      // UX/Qualidade: Trocado de 'preview' para 'auto' para garantir resolução HD na remoção de fundo
      formData.append("size", "auto"); 
      formData.append("format", "png");

      const bgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: {
          "X-Api-Key": removeBgKey,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString(),
      });

      if (!bgResponse.ok) {
        console.warn("Remove.bg falhou:", await bgResponse.text());
        return { imageUrl: originalDataUrl, found: true, error: "Aviso: Falha no recorte. Exibindo foto com fundo." };
      }

      const bgBuffer = Buffer.from(await bgResponse.arrayBuffer());

      return {
        imageUrl: `data:image/png;base64,${bgBuffer.toString("base64")}`,
        found: true,
      };
    } catch (error) {
      console.error("[Visual Search Server Error]:", error);
      return { imageUrl: null, found: false, error: String(error) };
    }
  });