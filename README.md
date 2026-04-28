# Bracell Executive Control Tower v4

Dashboard executivo full-screen para apresentação ao **CEO Global da Bracell**, exibindo Saving Tracker, Spend Analytics, Top Vendors, Contract Mix e Inteligência de Mercado em tempo real.

---

## Arquitetura

```
HTML/CSS/JS estático (Live Server)  ←  data/internal/*.json  ←  Python Engine (loop 30 min)
                                                                  ↓
                                              BCB SGS · Olinda PTAX · Alpha Vantage · Google News
```

- Dashboard 100% estático (zero servidor para o browser)
- Engine Python desacoplado roda em background
- 16 páginas em rotação automática (~6 minutos por ciclo)

---

## Instalação rápida

### 1) Pré-requisitos

- Python 3.9+ ([python.org](https://www.python.org/downloads/) — marcar "Add Python to PATH")
- VSCode com extensão **Live Server**
- Conexão de internet

### 2) Setup (uma vez)

1. Extraia o ZIP em `C:\Bracell_Dashboard\` (evite OneDrive — file lock no engine)
2. Execute `INSTALAR.bat` (instala requests, beautifulsoup4, lxml)
3. Execute `ATUALIZAR_AGORA.bat` (popula JSONs auto pela primeira vez — 60-90s)
4. Abra `index.html` no Live Server (botão "Go Live" do VSCode)
5. F11 para tela cheia

### 3) Uso contínuo

- `INICIAR_ENGINE.bat` — manter aberto durante apresentação (refresh 30min)
- O dashboard recarrega os dados do disco a cada 5 minutos automaticamente

---

## Estrutura de páginas (16 total)

| # | Página | Conteúdo | Duração |
|---|--------|----------|---------|
| 1 | Saving Tracker | Hero + tabela executiva por workspace + insights | 30s |
| 2 | Spend Overview | 4 KPI hero + 4 mini KPIs com progresso vs meta | 24s |
| 3 | Notícias Bracell #1 | 4 cards horizontais com imagem | 22s |
| 4 | Spend BU + Categoria | Bar charts duplos por BU e Category | 22s |
| 5 | Mercado #1 | 4 notícias Petróleo/Câmbio/Celulose/Energia | 22s |
| 6 | Spend Doc + Material | Top 12 Document Types + Material Types | 22s |
| 7 | Notícias Bracell #2 | 4 cards horizontais com imagem | 22s |
| 8 | Top Vendors | Top 12 + maiores movimentos de ranking 2025→2026 | 22s |
| 9 | Mercado #2 | 4 notícias Inflação/Macro/Diesel/Frete | 22s |
| 10 | Contract Mix | Spot vs Consumption — % e YoY | 18s |
| 11 | Indicadores #1 | Brent · Henry Hub · Dólar · Euro (2x2) | 22s |
| 12 | Indicadores #2 | WTI · Diesel Paulínia/Cubatão/SFC (2x2) | 22s |
| 13 | Mercado #3 | 4 notícias Commodities/Indústria | 22s |
| 14 | Indicadores #3 | Soda Cáustica · Enxofre · Energia SE/NE (2x2) | 22s |
| 15 | Indicadores #4 | IPCA · IGP-M · Selic · INCTL Frete (2x2) | 22s |
| 16 | Mercado #4 | 4 notícias Mercado/Sustentabilidade | 22s |

---

## Fontes de dados

| Dado | Fonte | Atualização |
|------|-------|-------------|
| Saving Tracker | `Saving.json` | **Manual** (atualize antes da apresentação) |
| KPIs Procurement | `KPIs_Procurement.json` | **Manual** |
| Quantidade Documentos | `qtd_documentos_compras.json` | **Manual** |
| Spend (BU/Cat/Doc/Mat/Vendor/Contract) | `Spend_*.json` | **Manual** |
| IPCA / IGP-M / Selic | BCB SGS séries 433/189/4189 | Auto 30min |
| USD/BRL · EUR/BRL | BCB Olinda PTAX | Auto 30min |
| Brent · WTI · Natural Gas | Alpha Vantage (API embutida) | Auto 30min |
| Henry Hub diário (sparkline) | Alpha Vantage NATURAL_GAS daily | Auto 30min |
| Notícias Bracell | Scraping bracell.com | Auto 30min |
| Notícias Globais | Google News RSS (12 tópicos) | Auto 30min |
| Soda Cáustica · Enxofre · Diesel ANP · Energia · Frete | Mantém valores manuais existentes | Manual |

---

## Atualizar JSONs manuais

Substitua os arquivos em `data/internal/`:

- `Saving.json` — workspaces com Expect/Actual Saving e Cost Avoidance
- `KPIs_Procurement.json` — backlog, lead time, automation, sourcing
- `qtd_documentos_compras.json` — quantidade de documentos por BU
- `Spend_Por_BusinessUnit.json` · `Spend_Por_Category.json` · `Spend_Por_ContractType.json` · `Spend_Por_DocumentType.json` · `Spend_Por_MaterialType.json` · `Spend_Top_Vendors.json`
- `inteligencia_mercado.json` — soda, enxofre, diesel ANP, energia (linhas que **não** começam com IPCA/IGP-M/Selic/USD/EUR/Petróleo/Natural Gas)

O engine **preserva** as linhas manuais de mercado e **substitui** apenas as automatizadas.

---

## Atalhos do dashboard

| Tecla | Ação |
|-------|------|
| `←` `→` | Página anterior/próxima |
| `espaço` | Pausar/retomar rotação |
| `R` | Recarregar dados do disco |
| `F11` | Tela cheia |
| Click nos pontos do rodapé | Ir direto para uma página |

---

## Comandos avançados (Python)

```bash
python data_engine.py --once         # 1 ciclo completo e sai
python data_engine.py --market --once  # só mercado/macro
python data_engine.py --gas --once     # só gás natural
python data_engine.py --news --once    # só notícias
python data_engine.py --interval 900   # loop a cada 15 min
```

---

## Troubleshooting

### "Notícia sem imagem"
O collector tenta og:image → twitter:image → primeira imagem grande do article. Em último caso usa **microlink.io** (screenshot do site). Se ainda assim falhar, mostra fallback colorido com inicial.

### Alpha Vantage rate-limited
Free tier: 25 requisições/dia, 5/min. O engine espera 13s entre chamadas. Se exceder, os indicadores existentes em `inteligencia_mercado.json` permanecem (sem perda).

### BCB timeout
Rede corporativa frequentemente bloqueia. Configure proxy via variáveis de ambiente:
```
set HTTP_PROXY=http://proxy.bracell.local:8080
set HTTPS_PROXY=http://proxy.bracell.local:8080
```

### Engine "file in use" ao salvar
**Não rode dentro do OneDrive** — a sincronização causa file lock. Mova para `C:\Bracell_Dashboard\`.

### Dashboard mostra "Sem dados"
Verifique:
1. `data/internal/` contém os 12 JSONs (11 manuais + `news_bracell.json` gerado)
2. Console do browser (F12) — mostra erros de fetch
3. Status no header — indica `ao vivo` (verde) ou `erro` (vermelho)

---

## Checklist pré-apresentação CEO

- [ ] JSONs manuais atualizados com dados do mês
- [ ] `INSTALAR.bat` executado (1ª vez apenas)
- [ ] `ATUALIZAR_AGORA.bat` rodado <2h antes
- [ ] `INICIAR_ENGINE.bat` rodando em background
- [ ] Dashboard aberto no Live Server, F11 ativo
- [ ] Status header "Ao vivo" (bolinha verde pulsando)
- [ ] Teste navegação ←/→ e F5 funcionam
- [ ] TV/projetor em 1920x1080 ou superior

---

**Versão:** 4.0 · **Build:** 2026-04 · **Owner:** CoE Sistemas e Inovação — Suprimentos
