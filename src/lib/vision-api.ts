// src/lib/vision-api.ts

export interface VisionAnalysisResult {
  primaryBrandColor?: string;
  secondaryBrandColor?: string;
  labels?: string[];
  error?: string;
}

// Utilitário para converter RGB em HEX
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, c || 0))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Utilitário para escurecer a cor primária e criar um tom secundário elegante para o fundo
function shadeColor(color: string, percent: number) {
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = Math.floor((R * (100 + percent)) / 100);
  G = Math.floor((G * (100 + percent)) / 100);
  B = Math.floor((B * (100 + percent)) / 100);

  R = Math.max(0, Math.min(255, R));
  G = Math.max(0, Math.min(255, G));
  B = Math.max(0, Math.min(255, B));

  return rgbToHex(R, G, B);
}

// Função nativa (Client-side) que substitui a API paga do Google/Azure
// Ela intercepta a assinatura antiga para não quebrar nenhum outro arquivo do projeto
export const analyzeImageWithVisionFn = async (payload: {
  data: { imageUrl?: string; imageBase64?: string };
}): Promise<VisionAnalysisResult> => {
  return new Promise((resolve) => {
    try {
      const { imageBase64, imageUrl } = payload.data;
      const source = imageBase64 || imageUrl;

      if (!source) {
        resolve({ error: "Nenhuma imagem fornecida." });
        return;
      }

      // Garante que o base64 tem o prefixo correto para leitura no Canvas
      const finalSource =
        source.startsWith("data:image") || source.startsWith("http")
          ? source
          : `data:image/jpeg;base64,${source}`;

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = finalSource;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve({ error: "Navegador não suporta processamento de Canvas." });
          return;
        }

        // Reduzimos a imagem para um pequeno grid 50x50 para processamento hiper rápido
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const pr = imageData[i];
          const pg = imageData[i + 1];
          const pb = imageData[i + 2];
          const alpha = imageData[i + 3];

          // 1. Pula pixels transparentes
          if (alpha < 255) continue;

          // 2. Filtra fundo branco / quase branco do Remove.bg
          if (pr > 240 && pg > 240 && pb > 240) continue;

          // 3. Filtra fundo preto esmagador
          if (pr < 20 && pg < 20 && pb < 20) continue;

          // 4. Filtra tons de cinza puros (onde as 3 cores são idênticas)
          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          if (max - min < 15) continue;

          r += pr;
          g += pg;
          b += pb;
          count++;
        }

        // Fallback elegante caso a foto seja literalmente preta/branca/transparente
        if (count === 0) {
          resolve({
            primaryBrandColor: "#ec4899",
            secondaryBrandColor: "#831843",
            labels: ["Produto"],
          });
          return;
        }

        // Calcula a média das cores vibrantes do produto
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        const primaryHex = rgbToHex(r, g, b);
        // Gera um tom 50% mais escuro para o fundo (Contrast ratio bonito)
        const secondaryHex = shadeColor(primaryHex, -50); 

        resolve({
          primaryBrandColor: primaryHex,
          secondaryBrandColor: secondaryHex,
          labels: ["Extração Local Automática"], // Mantemos as tags estruturais pro TypeScript não reclamar
        });
      };

      img.onerror = () => {
        resolve({ error: "Erro ao ler os pixels da imagem no navegador." });
      };
    } catch (error) {
      resolve({ error: String(error) });
    }
  });
};