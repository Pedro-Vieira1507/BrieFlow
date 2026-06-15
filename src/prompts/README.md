# BriefFlow — Arquitetura de Prompts

## Visão Geral

O BriefFlow é um agente de geração de conteúdo de marketing **universal** — funciona para qualquer empresa, de qualquer setor, assumindo automaticamente a identidade visual da marca a partir do site fornecido.

---

## Fluxo de Execução

```
[INPUT: Link do produto / site da empresa]
        ↓
[FASE 1] brand_extractor_prompt.txt
  → Analisa o HTML do site
  → Extrai paleta de cores (HEX), fontes, tom de voz
  → Retorna BRAND PROFILE em JSON
        ↓
[FASE 2] system_prompt.txt
  → Recebe BRAND PROFILE + transcrição/contexto da campanha
  → Gera 8 materiais de marketing profissionais
  → Aplica identidade visual da empresa em TODO o conteúdo
        ↓
[OUTPUT: 8 materiais prontos para uso]
```

---

## Arquivos

### `brand_extractor_prompt.txt`
Responsável por **identificar a identidade visual** de qualquer empresa a partir de uma URL.

**O que extrai:**
- Paleta de cores HEX (primária, secundária, accent, fundo, texto)
- Tipografia (fonte + pesos + Google Fonts URL)
- Tom de voz (formalidade, nível técnico, exemplos reais de copy)
- Dados do produto (specs, diferenciais, foto, preço, SKU)
- Dados da empresa (setor, público-alvo, contatos, redes sociais)

**Retorno:** JSON estruturado com campo `BRAND_PROFILE_READY`

### `system_prompt.txt`
Responsável por **gerar os 8 materiais de marketing** usando o BRAND PROFILE.

**Regra absoluta:** NUNCA assume identidade visual. Toda cor, fonte e tom de voz vem do BRAND PROFILE.

**Se o BRAND PROFILE não estiver disponível:** o agente PARA e solicita a URL ao usuário.

---

## Os 8 Materiais Gerados

| # | Material | Formato | Uso |
|---|---|---|---|
| 1 | Ficha Técnica | HTML completo | Web, impressão, PDF |
| 2 | Carrossel LinkedIn | Copy + briefing visual | LinkedIn |
| 3 | Post Instagram Feed | Copy + briefing 1080×1080 | Instagram |
| 4 | Stories (3 sequenciais) | Copy + briefing 1080×1920 | Instagram Stories |
| 5 | E-mail Marketing | HTML responsivo | E-mail |
| 6 | Google Ads (3 RSA) | Headlines + descriptions | Google Ads |
| 7 | Roteiro Reels/TikTok | Roteiro cena a cena | Instagram/TikTok |
| 8 | One-Pager Comercial | Copy estruturado | WhatsApp/E-mail vendas |

---

## Como Adicionar uma Nova Empresa

1. Forneça a URL do site e/ou produto no input do pipeline
2. O `brand_extractor_prompt.txt` analisa e retorna o BRAND PROFILE
3. O BRAND PROFILE é automaticamente injetado no contexto do `system_prompt.txt`
4. Os 8 materiais são gerados com 100% da identidade da empresa

**Não é necessário editar nenhum prompt para trocar de empresa.**

---

## Variáveis de Template

No `system_prompt.txt`, as seguintes variáveis são substituídas pelo BRAND PROFILE:

```
{{NOME_EMPRESA}}    → Nome da empresa
{{SLOGAN}}          → Tagline/slogan
{{COR_PRIMARIA}}    → HEX da cor principal
{{COR_SECUNDARIA}}  → HEX da cor secundária
{{COR_ACCENT}}      → HEX da cor de destaque
{{FONTE}}           → Nome da fonte principal
{{PRODUTO}}         → Nome do produto em campanha
{{PUBLICO}}         → Descrição do público-alvo
{{TOM}}             → Tom de voz identificado
```

---

## Tratamento de Erros

| Situação | Comportamento do Agente |
|---|---|
| URL não acessível | Solicita nome da empresa + cores manualmente |
| Cores não identificadas no CSS | Infere das imagens/contexto + alerta usuário |
| Fonte não identificada | Sugere equivalente Google Fonts mais próximo |
| Produto sem specs técnicas | Solicita especificações via formulário |
| BRAND PROFILE incompleto | Lista campos faltantes e pergunta ao usuário |
