# Referencia de Banner Aprovado — Forlab

## Banner: Refrigeradores Haier (aprovado pela equipe)

### Estrutura do layout
```
[FUNDO: gradiente cinza claro #F0F4F8 → branco]

LADO ESQUERDO (copy):
  Headline linha 1: cor #1A1A2E, Montserrat Black, ~52px
  Headline linha 2: cor #0099FF, Montserrat Black, ~52px
  (negrito intenso, sem fundo, texto direto)

CENTRO:
  Foto do produto em alta resolucao, sem fundo
  Sombra sutil embaixo do produto

LADO DIREITO (badge + CTA):
  Badge superior: fundo #003366, texto branco, borda arredondada
  Texto badge: "Nova geracao de refrigeradores Haier" + seta ↗
  
  CTA abaixo: "Fale com nosso time tecnico."
  Logo FORLAB: bold, cor #003366
  Seta ↗ ao lado do logo
  Tagline: "Acelerando a ciencia da vida" — pequena, muted

RODADE: nenhum — o logo fica no canto inferior direito
```

### O que fez esse banner funcionar
1. Headline começa pela DOR/BENEFICIO, nao pelo produto
2. Contraste entre azul escuro (solido, institucional) e azul eletrico (energico, destaque)
3. Produto centralizado em destaque total — o heroi visual
4. Badge de destaque sem poluir — posicionado no canto direito superior
5. CTA discreto mas presente — nao grita, mas orienta a acao
6. Fundo limpo que deixa o produto respirar

### HTML de referencia (estrutura)
```html
<div style="
  width:1200px; height:400px;
  background: linear-gradient(135deg, #F0F4F8 0%, #FFFFFF 100%);
  display:flex; align-items:center; justify-content:space-between;
  padding: 40px 60px; font-family: 'Montserrat', sans-serif;
  overflow:hidden;
">
  <!-- COPY ESQUERDO -->
  <div style="max-width:380px;">
    <h1 style="font-size:48px; font-weight:900; color:#1A1A2E; line-height:1.1; margin:0;">
      Sua pesquisa e<br>insubstituivel.
    </h1>
    <h2 style="font-size:48px; font-weight:900; color:#0099FF; line-height:1.1; margin:0;">
      Onde voce a<br>armazena tambem<br>deveria ser.
    </h2>
  </div>

  <!-- PRODUTO CENTRO -->
  <div style="flex:1; display:flex; justify-content:center; align-items:flex-end;">
    <img src="URL_DO_PRODUTO" style="max-height:360px; object-fit:contain; filter:drop-shadow(0 8px 24px rgba(0,0,0,0.12));" />
  </div>

  <!-- BADGE + CTA DIREITO -->
  <div style="max-width:240px; text-align:left;">
    <div style="
      background:#003366; color:#fff;
      padding:10px 14px; border-radius:6px;
      font-size:14px; font-weight:700; line-height:1.3;
      display:flex; align-items:center; gap:8px; margin-bottom:32px;
    ">
      Nova geracao de<br>refrigeradores Haier
      <span style="font-size:20px;">&#8599;</span>
    </div>
    <p style="font-size:15px; color:#1A1A2E; margin:0 0 8px;">Fale com nosso time tecnico.</p>
    <div style="font-size:28px; font-weight:900; color:#003366; letter-spacing:-0.5px;">
      FORLAB&#8599;
    </div>
    <p style="font-size:11px; color:#888; margin:4px 0 0;">Acelerando a ciencia da vida</p>
  </div>
</div>
```
