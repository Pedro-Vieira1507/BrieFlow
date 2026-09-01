# Planos e capacidades

O catálogo existe no frontend para UX e em `plan_catalog` para autorização. O banco é a fonte de verdade; alterar somente a interface não libera uma função.

| Plano      | Créditos/mês | Formatos                                 | Biblioteca | Membros |
| ---------- | -----------: | ---------------------------------------- | ---------: | ------: |
| Gratuito   |           20 | Banner, e-mail, social                   |         20 |       1 |
| Básico     |          150 | Gratuito + WhatsApp, blog, ficha técnica |        250 |       1 |
| Pro        |          600 | Básico + Reel, vídeo, slides             |      2.000 |       5 |
| Agência    |        2.500 | Todos, incluindo podcast                 |     10.000 |      25 |
| Enterprise |       10.000 | Todos                                    |    100.000 |     250 |

## Custo por geração

| Formato                                        | Créditos |
| ---------------------------------------------- | -------: |
| Social / WhatsApp                              |        2 |
| Banner / e-mail                                |        3 |
| Blog / ficha técnica                           |        4 |
| Reel                                           |        6 |
| Slides                                         |        8 |
| Vídeo                                          |       10 |
| Podcast                                        |       12 |
| Descoberta, análise de site ou busca de imagem |        1 |

Os valores são configuráveis no banco. Mantenha `src/lib/plans.ts` sincronizado para que a previsão na interface continue correta; a cobrança final sempre vem do servidor.
