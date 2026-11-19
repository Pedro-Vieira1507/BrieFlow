import type { BuilderState } from "../types/builder";
import { parseCatalogCsv } from "./productCatalog.ts";
import { formatPrice, type CatalogProduct } from "./skuReview.ts";

export const exampleCsv = [
  "sku;nome;preco;unidade;fonte;foto",
  "DEMO-CAFE;Café da Serra;39,90;250 g;Catálogo de demonstração;",
  "DEMO-CHA;Chá da Horta;24,50;40 g;Catálogo de demonstração;",
  "DEMO-MEL;Mel Silvestre;32,00;300 g;Catálogo de demonstração;",
  "DEMO-CACAU;Cacau em Pó;27,90;200 g;Catálogo de demonstração;",
  "DEMO-GELEIA;Geleia de Amora;18,90;180 g;Catálogo de demonstração;",
  "DEMO-AVEIA;Aveia em Flocos;12,90;400 g;Catálogo de demonstração;",
  "DEMO-AZEITE;Azeite da Colheita;69,90;500 ml;Catálogo de demonstração;",
  "DEMO-MASSA;Massa Artesanal;22,50;500 g;Catálogo de demonstração;",
  "DEMO-SUCO;Suco de Uva;17,90;1 L;Catálogo de demonstração;",
  "DEMO-ARROZ;Arroz Integral;11,90;1 kg;Catálogo de demonstração;",
].join("\r\n");
export const demoProducts = () => parseCatalogCsv(exampleCsv);

export function demoCampaign(product: CatalogProduct): BuilderState {
  const brandName = "Empório de demonstração";
  const price = formatPrice(product.priceCents);
  return {
    type: "campaign",
    brandName,
    skuLink: { approved: product },
    discoveryPlan: {
      brandName,
      detectedContext: "Campanha de exemplo para e-commerce.",
      missingInfo: "",
      proposedStrategy: "Apresentar o produto em três canais.",
      product: product.name,
      channels: ["whatsapp", "email", "banner"],
    },
    campaignAssets: [
      {
        id: "demo-whatsapp",
        type: "whatsapp",
        status: "approved",
        content: {
          type: "whatsapp",
          brandName,
          structuredContent: {
            format: "whatsapp",
            title: "Mensagem para clientes",
            sections: [
              {
                id: "mensagem",
                title: "Mensagem",
                body: product.name + " por " + price + ". Quer reservar o seu?",
              },
            ],
          },
        },
      },
      {
        id: "demo-email",
        type: "email",
        status: "approved",
        content: {
          type: "email",
          brandName,
          title: "Uma escolha para a sua semana",
          subtitle: product.name,
          preheader: "Conheça a seleção do empório.",
          body:
            "Selecionamos " +
            product.name +
            " para esta semana.\n\nCada embalagem de " +
            product.unit +
            " sai por " +
            price +
            ".",
          cta: "Conhecer o produto",
        },
      },
      {
        id: "demo-banner",
        type: "banner",
        status: "approved",
        content: {
          type: "banner",
          brandName,
          title: "Escolhas do empório",
          subtitle: "Confira a seleção da semana.",
          cta: "Descubra",
        },
      },
    ],
  };
}
