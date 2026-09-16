# Planos e capacidades

O catálogo existe no frontend para UX e em `plan_catalog` para autorização. O banco é a fonte de verdade; alterar somente a interface não libera uma função.

| Plano      | Créditos/dia | Formatos                                  | Biblioteca | Membros |
| ---------- | -----------: | ----------------------------------------- | ---------: | ------: |
| Gratuito   |            8 | Banner, e-mail, social                    |         20 |       1 |
| Básico     |           60 | Gratuito + WhatsApp, blog, ficha técnica  |        250 |       1 |
| Pro        |          250 | Básico + Reel e slides; vídeo em stand by |      2.000 |       5 |
| Agência    |          800 | Todos, incluindo podcast                  |     10.000 |      25 |
| Enterprise |       10.000 | Todos                                     |    100.000 |     250 |

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

Os créditos são compartilhados pelo workspace e voltam ao limite do plano todos os dias às 00:00 no fuso `America/Sao_Paulo`. O ciclo de cobrança do Stripe continua mensal e não é alterado pela reposição diária.

O plano Gratuito possui também um teto líquido de 120 créditos por mês-calendário, aplicado no servidor para limitar abuso automatizado. Os valores desta tabela precisam permanecer idênticos ao catálogo `plan_catalog`; o frontend é apenas uma representação de UX.

Os limites de membros já são garantidos pelo banco, mas convite, remoção e troca de função ainda não possuem fluxo administrativo no produto. Até essa gestão ser entregue e validada com SMTP próprio, comercialize cada workspace com um único operador e não anuncie assentos adicionais.
