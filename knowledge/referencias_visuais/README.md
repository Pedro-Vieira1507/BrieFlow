# Referências visuais no Obsidian

O BriefFlow agora suporta salvar **imagens de referência** dentro do vault `knowledge/referencias_visuais/` para melhorar banners, posts e outros layouts.

## Como funciona

1. Você envia uma imagem de referência para o pipeline.
2. Um modelo multimodal (Gemini, Claude ou OpenAI) analisa a composição visual.
3. O sistema salva no vault:
   - a imagem original;
   - um `.json` com metadados estruturados;
   - um `.md` com descrição e notas de layout.
4. Em novas gerações, o BriefFlow recupera as referências mais relevantes e injeta tanto as notas quanto as imagens no prompt.

## Estrutura criada

```text
knowledge/
└── referencias_visuais/
    ├── banner_forlab_haier.jpg
    ├── banner_forlab_haier.json
    └── banner_forlab_haier.md
```

## Metadados salvos

- `title`
- `material_type`
- `description`
- `tags`
- `layout_notes`

## Requisitos

Para análise visual automática, configure pelo menos uma destas variáveis no `.env`:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Sem provider multimodal, o sistema ainda pode salvar manualmente a referência, mas não fará análise automática da imagem.
