# Layout & Customization Guide

Como ajustar **cores, durações, ordem de páginas e tamanhos** sem quebrar o dashboard.

---

## Cores (paleta Bracell)

Edite `css/style.css` linhas 7–25 (bloco `:root`):

```css
--bracell-blue:       #1E6BFF;   /* azul principal */
--bracell-blue-dark:  #1E4CCF;   /* hover/borders */
--bracell-green:      #16A34A;   /* sucesso/positivo */
--alert:              #FF6B00;   /* atenção (amarelo escuro) */
--negative:           #DC2626;   /* crítico */
```

Toda a paleta usa CSS Variables — basta trocar nestes pontos e o dashboard inteiro herda.

---

## Tempo de cada página

Edite `js/app.js` array `PAGES` (linhas 8–25). Cada item tem `duration` em milissegundos:

```javascript
{ id: 'page-saving', name: 'Saving Tracker', duration: 30_000 }   // 30 segundos
```

**Regra prática:**
- Páginas com tabela densa (Saving, Spend) → 25-30s
- Páginas de bar chart → 20-22s
- Notícias → 22s (suficiente para ler 1-2 cards)
- Indicadores → 22s

Total atual do ciclo: **~6 minutos** com 16 páginas.

---

## Reordenar páginas

No mesmo array `PAGES`, mude a ordem dos objetos. A primeira página exibida é o índice 0.

Exemplo — começar por Spend Overview:

```javascript
const PAGES = [
    { id: 'page-spend-overview',  name: 'Spend Overview', duration: 24_000 },
    { id: 'page-saving',          name: 'Saving Tracker', duration: 30_000 },
    // ... resto
];
```

**Importante:** os IDs (`page-*`) precisam corresponder aos `<section id="...">` do `index.html`. Não invente novos IDs sem criar a seção HTML.

---

## Adicionar/remover indicadores

Em `js/data_adapter.js` linha 17 (`INDICATOR_SPECS`):

```javascript
{
    match: 'Petróleo - Brent',     // string que vai bater com Indicador no JSON
    label: 'Brent Crude Oil',      // texto exibido no card
    code: 'BRENT',                 // chip do canto superior esquerdo
    group: 'energy',               // tema da cor: energy/fuel/chemicals/macro/fx/logistics
    unit: 'USD/bbl',               // formatação ($, R$, %)
    page: 1                        // qual das 4 páginas de indicadores (1-4)
}
```

**Cada página suporta exatamente 4 indicadores** (grid 2x2). Se precisar mais que 16, crie a 5ª página em `index.html` e na array `PAGES`.

---

## Tamanho dos textos (TVs grandes)

Para TVs 4K (>2400px), o CSS já tem media query no fim de `css/style.css`:

```css
@media (min-width: 2400px) {
    --header-h: 96px;
    --footer-h: 70px;
    .saving-hero-value { font-size: 72px; }
    .indicator-big-value { font-size: 56px; }
    /* ... */
}
```

Para TVs 8K ou displays muito grandes, duplique este bloco com `min-width: 3800px` e aumente os tamanhos proporcionalmente.

---

## Adicionar novo card no Spend Overview

Em `js/app.js` função `renderSpendOverview()`, dentro do bloco `<div class="so-hero-row">` ou `<div class="so-mini-row">`:

```javascript
<div class="so-mini">
    <div class="so-mini-head">
        <div class="so-mini-icon">⚡</div>
        <div class="so-mini-title">Meu KPI</div>
    </div>
    <div class="so-mini-value">${valor}</div>
    <div class="so-mini-unit">descrição</div>
</div>
```

**Ajuste o grid** em `css/style.css`:

```css
.so-mini-row { grid-template-columns: repeat(5, 1fr); }  /* era 4, virou 5 */
```

---

## Rules dos Insights do Saving Tracker

`js/app.js` função `renderSaving()` — array `insights`:

- **Vermelho** (`cls: 'red'`): pior workspace abaixo de 30%
- **Verde** (`cls: 'green'`): primeiro workspace que ultrapassou meta (≥100%)
- **Amarelo** (`cls: 'yellow'`): KPI de Cost Avoidance acumulado
- **Laranja** (`cls: 'warn'`): contagem de áreas críticas

Para adicionar novas regras (ex: "Forestry concentra 75% do gap"):

```javascript
const forestry = rows.find(r => r.name === 'Forestry');
if (forestry && forestry.gap > totalGap * 0.5) {
    insights.push({
        cls: 'red',
        html: `<strong>${forestry.name}</strong> concentra <strong>${((forestry.gap/totalGap)*100).toFixed(0)}%</strong> do gap total.`
    });
}
```

---

## Tópicos de notícias globais

`collectors/news_collector.py` constante `URLS_GLOBAIS`:

```python
URLS_GLOBAIS = {
    "Petróleo": "https://news.google.com/rss/search?q=...",
    "MeuTopico": "https://news.google.com/rss/search?q=meu+termo+when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419"
}
```

**Operadores Google News:**
- `when:7d` — últimos 7 dias (ou 14d, 30d)
- `hl=pt-BR&gl=BR` — interface em português, geo Brasil
- `+termo` ou `"frase exata"` — refinamento

Cada tópico produz 2 notícias. 12 tópicos = 24 notícias globais distribuídas em 4 páginas (6 por página, exibe 4).

---

## Trocar logo

Substitua `img/bracell-logo.png` ou edite o `<img src>` no `index.html` linha 18 — atualmente puxa do site oficial:

```html
<img src="https://www.bracell.com/wp-content/uploads/2019/04/bracell_logo_FA.png"
     onerror="this.onerror=null; this.src='img/bracell-logo.png';">
```

Se site da Bracell sair do ar, o `onerror` cai no arquivo local.

---

## Modo desenvolvimento

Para debugar, abra console do browser (F12) e verifique:
- `state.internal` — todos os dados carregados
- `state.internal._failed` — arrays que falharam ao carregar
- `state.internal.marketIntel` — indicadores parseados

---

## Performance

- Loading inicial: ~1-2s (12 fetches paralelos)
- Recarga (botão R ou auto 5min): ~500ms
- Transição entre páginas: 500ms (CSS transition)
- Memory footprint: ~30MB no Chrome
