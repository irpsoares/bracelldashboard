/* =========================================================================
   app.js — Bracell Executive Control Tower
   16 páginas: Saving Tracker + Spend Overview + Spend BU/Cat + Doc/Material +
   Vendors + Contract Mix + 4 Indicadores + 4 Notícias
   ========================================================================= */

const PAGES = [
    { id: 'page-saving',          name: 'Saving Tracker',                   duration: 30_000 },
    { id: 'page-spend-overview',  name: 'Spend Overview',                   duration: 24_000 },
    { id: 'page-news-bracell-1',  name: 'Notícias Bracell · Parte 1',       duration: 22_000, type: 'news', dataset: 'bracell', slice: [0, 4] },
    { id: 'page-spend-breakdown', name: 'Spend · BU + Categoria',           duration: 22_000 },
    { id: 'page-news-market-1',   name: 'Mercado · Parte 1',                duration: 22_000, type: 'news', dataset: 'globais', slice: [0, 4] },
    { id: 'page-spend-types',     name: 'Spend · Doc + Material',           duration: 22_000 },
    { id: 'page-news-bracell-2',  name: 'Notícias Bracell · Parte 2',       duration: 22_000, type: 'news', dataset: 'bracell', slice: [4, 8] },
    { id: 'page-vendors',         name: 'Top Vendors',                      duration: 22_000 },
    { id: 'page-news-market-2',   name: 'Mercado · Parte 2',                duration: 22_000, type: 'news', dataset: 'globais', slice: [4, 8] },
    { id: 'page-contract-mix',    name: 'Contract Mix',                     duration: 18_000 },
    { id: 'page-indicators-1',    name: 'Indicadores · Energia & Câmbio',   duration: 22_000, type: 'indicators', pageNum: 1 },
    { id: 'page-indicators-2',    name: 'Indicadores · Combustíveis',       duration: 22_000, type: 'indicators', pageNum: 2 },
    { id: 'page-news-market-3',   name: 'Mercado · Parte 3',                duration: 22_000, type: 'news', dataset: 'globais', slice: [8, 12] },
    { id: 'page-indicators-3',    name: 'Indicadores · Químicos & Energia', duration: 22_000, type: 'indicators', pageNum: 3 },
    { id: 'page-indicators-4',    name: 'Indicadores · Macro',              duration: 22_000, type: 'indicators', pageNum: 4 },
    { id: 'page-news-market-4',   name: 'Mercado · Parte 4',                duration: 22_000, type: 'news', dataset: 'globais', slice: [12, 16] }
];

const state = {
    internal: null,
    currentPage: 0,
    paused: false,
    pageTimer: null,
    progressTimer: null,
    progressStart: 0,
    progressDuration: 0
};

// =====================================================================
// FORMATTERS
// =====================================================================

function fmtNum(v, dec = 2) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
}
function fmtInt(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return new Intl.NumberFormat('pt-BR').format(Math.round(v));
}
function fmtBig(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (Math.abs(v) >= 1e9) return `R$ ${fmtNum(v / 1e9, 2)} bi`;
    if (Math.abs(v) >= 1e6) return `R$ ${fmtNum(v / 1e6, 1)} MM`;
    if (Math.abs(v) >= 1e3) return `R$ ${fmtNum(v / 1e3, 1)} mil`;
    return `R$ ${fmtNum(v, 0)}`;
}
function fmtPct(v, dec = 1) { if (v === null || v === undefined || isNaN(v)) return '—'; return fmtNum(v, dec) + '%'; }
function fmtDelta(v, dec = 2, suf = '%') {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const sign = v >= 0 ? '+' : '';
    return `${sign}${fmtNum(v, dec)}${suf}`;
}
function deltaClass(v) {
    if (v === null || v === undefined || isNaN(v)) return 'flat';
    if (Math.abs(v) < 0.01) return 'flat';
    return v > 0 ? 'up' : 'down';
}
function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtDateNews(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) +
           ' • ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function fmtDayMon(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(5, 10).replace('-', '/');
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
}
function fmtFullDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// =====================================================================
// SPARKLINE SVG
// =====================================================================

function sparklineFull(values, opts = {}) {
    const color = opts.color || '#1E6BFF';
    const fillColor = opts.fillColor || '#DBEAFE';
    if (!values || values.length < 2) return '<svg viewBox="0 0 100 30"></svg>';
    const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
    if (valid.length < 2) return '<svg viewBox="0 0 100 30"></svg>';

    const w = 100, h = 30, pad = 1;
    const min = Math.min(...valid), max = Math.max(...valid);
    const amp = max === min ? 1 : max - min;
    const n = values.length;

    const points = values.map((v, i) => {
        const cx = pad + (i / (n - 1)) * (w - pad * 2);
        const yVal = (v === null || v === undefined || isNaN(v)) ? min : v;
        const cy = h - pad - ((yVal - min) / amp) * (h - pad * 2);
        return `${cx.toFixed(2)},${cy.toFixed(2)}`;
    });
    const line = points.join(' ');
    const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
    const lastP = points[points.length - 1].split(',');

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style="width:100%;height:100%;display:block">
        <polygon points="${area}" fill="${fillColor}" opacity="0.55"/>
        <polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <circle cx="${lastP[0]}" cy="${lastP[1]}" r="1.5" fill="#FFFFFF" stroke="${color}" stroke-width="0.8" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

function updateClock() {
    const now = new Date();
    document.getElementById('header-clock').textContent =
        now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('header-date').textContent =
        now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

// =====================================================================
// PÁGINA 1 — SAVING TRACKER (estilo Print 1)
// =====================================================================

function renderSaving() {
    const sav = state.internal?.saving;
    if (!sav) return;

    const totalActual = sav.total.actualSaving;
    const totalExpect = sav.total.expectSaving;
    const pctTarget = sav.total.pctConcluido;
    const gap = sav.total.gap;
    const totalCostAvoidance = sav.total.actualCostAvoidance;
    const expectCostAvoidance = sav.total.expectCostAvoidance;
    const pctCostAvoid = expectCostAvoidance > 0 ? (totalCostAvoidance / expectCostAvoidance) * 100 : 0;

    document.getElementById('saving-status').textContent =
        sav.total.atraso === 'On Time' ? '🟢 On Time · ' + sav.total.progresso : '⚠️ ' + sav.total.atraso;

    // Compute per-BU rows
    const rows = sav.bus
        .filter(b => b.expectSaving > 0 || b.actualSaving > 0)
        .map(b => {
            const pct = b.expectSaving > 0 ? (b.actualSaving / b.expectSaving) * 100 : 0;
            const gap = b.expectSaving - b.actualSaving;
            const impact = totalExpect > 0 ? (b.actualSaving / totalExpect) * 100 : 0;
            let progressColor = 'green';
            let status = '✓';
            let statusTitle = 'OK';
            if (pct < 30) { progressColor = 'danger'; status = '🚨'; statusTitle = 'Crítico'; }
            else if (pct < 60) { progressColor = 'warning'; status = '⚠️'; statusTitle = 'Atenção'; }
            else if (pct >= 100) { progressColor = 'green'; status = '✓'; statusTitle = 'Concluído'; }
            return { ...b, pct, gap, impact, progressColor, status, statusTitle };
        })
        .sort((a, b) => b.expectSaving - a.expectSaving);

    // Insights
    const worst = rows.filter(r => r.pct < 30).sort((a, b) => b.expectSaving - a.expectSaving)[0];
    const best = rows.filter(r => r.pct >= 100)[0];
    const warning = rows.filter(r => r.pct >= 30 && r.pct < 60).sort((a, b) => b.expectSaving - a.expectSaving)[0];

    const insights = [];
    if (worst) {
        insights.push({
            cls: 'red',
            html: `Maiores riscos concentrados em <strong>${escapeHtml(worst.name)}</strong>, com apenas <strong>${worst.pct.toFixed(0)}%</strong> de execução e gap de <strong>${fmtBig(worst.gap)}</strong>.`
        });
    }
    if (best) {
        insights.push({
            cls: 'green',
            html: `Destaque positivo para <strong>${escapeHtml(best.name)}</strong>, já superando a meta estabelecida (${best.pct.toFixed(0)}%).`
        });
    }
    if (totalCostAvoidance > 0) {
        insights.push({
            cls: 'yellow',
            html: `O programa acumula <strong>${fmtBig(totalCostAvoidance)}</strong> em Cost Avoidance, equivalente a <strong>${pctCostAvoid.toFixed(0)}%</strong> do potencial identificado.`
        });
    }
    const criticosBaixo30 = rows.filter(r => r.pct < 30).length;
    if (criticosBaixo30 > 0) {
        insights.push({
            cls: 'warn',
            html: `Existe concentração de risco em <strong>${criticosBaixo30}</strong> ${criticosBaixo30 === 1 ? 'área' : 'áreas'} abaixo de 30%, indicando necessidade de ação imediata.`
        });
    }

    document.getElementById('saving-body').innerHTML = `
        <div class="saving-hero">
            <div class="saving-hero-value">${fmtInt(totalActual)}</div>
            <div class="saving-hero-meta">
                <span><span class="saving-hero-meta-target">${pctTarget.toFixed(0)}%</span> do target</span>
                <span class="saving-hero-meta-divider">|</span>
                <span>Gap: <span class="saving-hero-meta-gap">${fmtInt(gap)}</span></span>
                <span class="saving-hero-meta-divider">|</span>
                <span>Target: <strong>${fmtInt(totalExpect)}</strong></span>
            </div>
        </div>

        <div class="saving-table-card">
            <table class="saving-table">
                <thead>
                    <tr>
                        <th>Workspace</th>
                        <th class="center">%</th>
                        <th>Progress</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Gap</th>
                        <th>Impact</th>
                        <th class="center">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr>
                            <td>${escapeHtml(r.name)}</td>
                            <td class="center pct">${r.pct.toFixed(0)}%</td>
                            <td class="saving-progress-cell">
                                <div class="saving-progress-bar-bg">
                                    <div class="saving-progress-bar-fill ${r.progressColor}" style="width:${Math.min(r.pct, 100).toFixed(1)}%"></div>
                                </div>
                            </td>
                            <td>${fmtInt(r.expectSaving)}</td>
                            <td>${fmtInt(r.actualSaving)}</td>
                            <td class="${r.gap > 0 ? 'gap-red' : 'gap-green'}">${r.gap > 0 ? fmtInt(r.gap) : 'OK'}</td>
                            <td>${r.impact.toFixed(0)}%</td>
                            <td class="saving-status-cell" title="${r.statusTitle}"><span class="saving-status-icon">${r.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        ${insights.length > 0 ? `
        <div class="exec-insights">
            <div class="exec-insights-title">Executive Insights</div>
            <div class="exec-insights-list">
                ${insights.map(i => `
                    <div class="exec-insight-row">
                        <div class="exec-insight-bullet ${i.cls}">●</div>
                        <div>${i.html}</div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;
}

// =====================================================================
// PÁGINA 2 — SPEND OVERVIEW
// =====================================================================

function renderSpendOverview() {
    const k = state.internal?.kpis;
    const qd = state.internal?.qtdDocs;
    if (!k) return;

    const spendYTD = k.spend.ytd_2026;
    const spendPrev = k.spend.full_2025;
    const yoy = spendPrev > 0 ? ((spendYTD - spendPrev) / spendPrev) * 100 : 0;

    const totalDocs2026 = qd?.total?.qtd2026 || 0;
    const totalDocs2025 = qd?.total?.qtd2025 || 0;

    document.getElementById('spend-overview-total').textContent = fmtBig(spendYTD);

    const backlogChange = k.backlog.previous > 0 ? (k.backlog.current / k.backlog.previous - 1) * 100 : 0;

    document.getElementById('spend-overview-body').innerHTML = `
        <div class="so-hero-row">
            <div class="so-card">
                <div class="so-card-label">Spend YTD ${k.currentYear}</div>
                <div class="so-card-value">${fmtBig(spendYTD)}</div>
                <div class="so-card-unit">consolidado · ${qd?.bus?.length || 0} BUs</div>
                <div class="so-card-delta ${yoy < 0 ? 'down' : 'up'}">
                    <span>${yoy >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(yoy))}</span>
                    <span class="so-card-delta-label">vs ${k.previousYear}</span>
                </div>
                <div class="so-card-meta">
                    <div>
                        <div class="so-card-meta-label">${k.previousYear}</div>
                        <div class="so-card-meta-value">${fmtBig(spendPrev)}</div>
                    </div>
                    <div>
                        <div class="so-card-meta-label">${k.previousYear - 1}</div>
                        <div class="so-card-meta-value">${fmtBig(k.spend.full_2024)}</div>
                    </div>
                </div>
            </div>

            <div class="so-card green-top">
                <div class="so-card-label">Documentos YTD</div>
                <div class="so-card-value">${fmtInt(totalDocs2026)}</div>
                <div class="so-card-unit">documentos processados</div>
                <div class="so-card-meta">
                    <div>
                        <div class="so-card-meta-label">${k.previousYear}</div>
                        <div class="so-card-meta-value">${fmtInt(totalDocs2025)}</div>
                    </div>
                    <div>
                        <div class="so-card-meta-label">Total</div>
                        <div class="so-card-meta-value">${fmtInt(qd?.total?.total || 0)}</div>
                    </div>
                </div>
            </div>

            <div class="so-card ${k.backlog.isAlert ? 'alert-top' : ''}">
                <div class="so-card-label">Backlog Atual</div>
                <div class="so-card-value">${fmtInt(k.backlog.current)}</div>
                <div class="so-card-unit">linhas em aberto</div>
                <div class="so-card-delta ${backlogChange > 0 ? 'up' : 'down'}">
                    <span>${backlogChange >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(backlogChange))}</span>
                    <span class="so-card-delta-label">vs ${k.previousYear}</span>
                </div>
                <div class="so-card-meta">
                    <div>
                        <div class="so-card-meta-label">${k.previousYear}</div>
                        <div class="so-card-meta-value">${fmtInt(k.backlog.previous)}</div>
                    </div>
                    <div>
                        <div class="so-card-meta-label">${k.previousYear - 1}</div>
                        <div class="so-card-meta-value">${fmtInt(k.backlog.previous2)}</div>
                    </div>
                </div>
            </div>

            <div class="so-card green-top">
                <div class="so-card-label">Lead Time Médio</div>
                <div class="so-card-value">${k.leadTime.current}<span style="font-size:18px;color:var(--gray-500);font-weight:600;margin-left:6px">dias</span></div>
                <div class="so-card-unit">média YTD ${k.currentYear}</div>
                <div class="so-card-delta ${k.leadTime.delta > 0 ? 'up' : 'down'}">
                    <span>${k.leadTime.delta >= 0 ? '▲' : '▼'} ${Math.abs(k.leadTime.delta)} dias</span>
                    <span class="so-card-delta-label">vs ${k.previousYear}</span>
                </div>
            </div>
        </div>

        <div class="so-mini-row">
            <div class="so-mini">
                <div class="so-mini-head">
                    <div class="so-mini-icon">⚙</div>
                    <div class="so-mini-title">Purchasing Automation</div>
                </div>
                <div class="so-mini-value">${k.purchasingAutomation.current.toFixed(1)}<span style="font-size:18px;color:var(--gray-500);font-weight:600;margin-left:4px">%</span></div>
                <div class="so-mini-unit">automatizado</div>
                <div class="so-mini-delta ${k.purchasingAutomation.delta > 0 ? 'down' : 'up'}">
                    <span>${k.purchasingAutomation.delta >= 0 ? '▲' : '▼'} ${Math.abs(k.purchasingAutomation.delta).toFixed(1)} p.p.</span>
                    <span class="so-mini-delta-label">vs ${k.previousYear}</span>
                </div>
                <div class="so-mini-progress">
                    <div class="so-mini-progress-bar"><div class="so-mini-progress-fill" style="width:${Math.min(k.purchasingAutomation.current, 100)}%"></div></div>
                    <div class="so-mini-progress-foot"><span>0%</span><span>Meta: ${k.purchasingAutomation.target}%</span><span>100%</span></div>
                </div>
            </div>

            <div class="so-mini">
                <div class="so-mini-head">
                    <div class="so-mini-icon">🎯</div>
                    <div class="so-mini-title">Sourcing on Time</div>
                </div>
                <div class="so-mini-value">${k.sourcingOnTime.current.toFixed(1)}<span style="font-size:18px;color:var(--gray-500);font-weight:600;margin-left:4px">%</span></div>
                <div class="so-mini-unit">no prazo</div>
                <div class="so-mini-delta ${k.sourcingOnTime.delta < 0 ? 'up' : 'down'}">
                    <span>${k.sourcingOnTime.delta >= 0 ? '▲' : '▼'} ${Math.abs(k.sourcingOnTime.delta).toFixed(1)} p.p.</span>
                    <span class="so-mini-delta-label">vs ${k.previousYear}</span>
                </div>
                <div class="so-mini-progress">
                    <div class="so-mini-progress-bar"><div class="so-mini-progress-fill" style="width:${Math.min(k.sourcingOnTime.current, 100)}%"></div></div>
                    <div class="so-mini-progress-foot"><span>0%</span><span>Meta: ${k.sourcingOnTime.target}%</span><span>100%</span></div>
                </div>
            </div>

            <div class="so-mini">
                <div class="so-mini-head">
                    <div class="so-mini-icon">📊</div>
                    <div class="so-mini-title">Sourcing Coverage</div>
                </div>
                <div class="so-mini-value">${k.sourcing.current.toFixed(1)}<span style="font-size:18px;color:var(--gray-500);font-weight:600;margin-left:4px">%</span></div>
                <div class="so-mini-unit">cobertura sourcing</div>
                <div class="so-mini-delta ${k.sourcing.delta < 0 ? 'up' : 'down'}">
                    <span>${k.sourcing.delta >= 0 ? '▲' : '▼'} ${Math.abs(k.sourcing.delta).toFixed(1)} p.p.</span>
                    <span class="so-mini-delta-label">vs ${k.previousYear}</span>
                </div>
                <div class="so-mini-progress">
                    <div class="so-mini-progress-bar"><div class="so-mini-progress-fill" style="width:${Math.min(k.sourcing.current, 100)}%"></div></div>
                    <div class="so-mini-progress-foot"><span>0%</span><span>Meta: 80%</span><span>100%</span></div>
                </div>
            </div>

            <div class="so-mini">
                <div class="so-mini-head">
                    <div class="so-mini-icon">📦</div>
                    <div class="so-mini-title">Vendors Monitorados</div>
                </div>
                <div class="so-mini-value">${state.internal.vendors?.length || 0}</div>
                <div class="so-mini-unit">fornecedores ativos</div>
                <div class="so-mini-delta down">
                    <span>${(state.internal.vendors?.slice(0,5).reduce((s,v) => s+v.pctTotal, 0) || 0).toFixed(1)}%</span>
                    <span class="so-mini-delta-label">concentração Top 5</span>
                </div>
            </div>
        </div>
    `;
}

// =====================================================================
// SPEND BREAKDOWN
// =====================================================================

function renderBarList(items, opts = {}) {
    const valueField = opts.valueField || 'spendTotal';
    const pctField = opts.pctField || 'pctTotal';
    const max = Math.max(...items.map(i => i[valueField] || 0)) || 1;
    return items.map((it, idx) => `
        <div class="bar-row ${opts.showRank ? 'with-rank' : ''}">
            ${opts.showRank ? `<div class="bar-row-rank">#${idx + 1}</div>` : ''}
            <div class="bar-row-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
            <div class="bar-row-bar">
                <div class="bar-row-bar-fill ${opts.color || ''}" style="width:${((it[valueField] / max) * 100).toFixed(1)}%"></div>
            </div>
            <div class="bar-row-value">${fmtBig(it[valueField])}</div>
            <div class="bar-row-pct">${fmtPct(it[pctField], 1)}</div>
        </div>
    `).join('');
}

function renderSpendBreakdown() {
    if (!state.internal) return;
    const total = state.internal.bu.reduce((s, b) => s + (b.spendTotal || 0), 0);
    document.getElementById('spend-breakdown-total').textContent = fmtBig(total);
    document.getElementById('bu-count').textContent = `${state.internal.bu.length} BUs`;
    document.getElementById('cat-count').textContent = `${state.internal.category.length} categorias`;
    document.getElementById('bu-list').innerHTML = renderBarList(state.internal.bu, { showRank: true });
    document.getElementById('category-list').innerHTML = renderBarList(state.internal.category.slice(0, 10), { showRank: true, color: 'green' });
}

function renderSpendTypes() {
    if (!state.internal) return;
    const docs = state.internal.documentType.filter(d => d.spendTotal > 0).slice(0, 12);
    const matls = state.internal.materialType.filter(m => m.spendTotal > 0).slice(0, 12);
    const matlTotal = matls.reduce((s, m) => s + m.spendTotal, 0);
    matls.forEach(m => { m.pctTotal = (m.spendTotal / matlTotal) * 100; });
    document.getElementById('doctype-count').textContent = `${state.internal.documentType.length} tipos`;
    document.getElementById('matltype-count').textContent = `${state.internal.materialType.length} tipos`;
    document.getElementById('doctype-list').innerHTML = renderBarList(docs, { showRank: true });
    document.getElementById('matltype-list').innerHTML = renderBarList(matls, { showRank: true, color: 'green' });
}

function renderVendors() {
    if (!state.internal?.vendors) return;
    const vs = state.internal.vendors;
    const top12 = vs.slice(0, 12);
    const top5Pct = vs.slice(0, 5).reduce((s, v) => s + (v.pctTotal || 0), 0);
    document.getElementById('vendor-top5-pct').textContent = fmtPct(top5Pct, 1);
    document.getElementById('vendors-top-list').innerHTML = renderBarList(top12, { showRank: true });

    const movers = [...vs]
        .filter(v => v.rank2025 > 0 && v.rank2026 > 0)
        .sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta))
        .slice(0, 12);
    document.getElementById('vendors-rank-list').innerHTML = movers.map(v => {
        const cls = v.rankDelta > 0 ? 'up' : (v.rankDelta < 0 ? 'down' : '');
        const icon = v.rankDelta > 0 ? '▲' : (v.rankDelta < 0 ? '▼' : '—');
        return `
            <div class="bar-row with-rank">
                <div class="bar-row-rank-delta ${cls}">${icon}${Math.abs(v.rankDelta)}</div>
                <div class="bar-row-name" title="${escapeHtml(v.name)}">${escapeHtml(v.name)}</div>
                <div class="bar-row-bar">
                    <div class="bar-row-bar-fill" style="width:${Math.min((v.pctTotal / 10) * 100, 100).toFixed(1)}%"></div>
                </div>
                <div class="bar-row-value">${v.rank2025} → ${v.rank2026}</div>
                <div class="bar-row-pct">${fmtPct(v.pctTotal, 1)}</div>
            </div>
        `;
    }).join('');
}

function renderContractMix() {
    if (!state.internal?.contractType) return;
    const ct = state.internal.contractType;
    const consumption = ct.find(c => c.name === 'Consumption Contract');
    const spot = ct.find(c => c.name === 'Spot');
    if (!consumption || !spot) return;
    document.getElementById('spot-pct-2026').textContent = fmtPct(spot.pct2026, 1);

    document.getElementById('contract-mix-body').innerHTML = `
        <div class="grid grid-2" style="flex:1; min-height:0;">
            <div class="cm-card">
                <div style="font-size:14px; color:var(--gray-700); font-weight:700; margin-bottom:4px;">Consumption Contract</div>
                <div style="font-size:11px; color:var(--gray-500); margin-bottom:14px;">Contratos firmes — governança</div>
                <div class="cm-big-pct blue">${fmtPct(consumption.pctTotal, 1)}</div>
                <div class="cm-sub">do spend total · ${fmtBig(consumption.spendTotal)}</div>
                <div class="cm-yoy">
                    <div class="cm-yoy-block">
                        <div class="cm-yoy-label">2025</div>
                        <div class="cm-yoy-value">${fmtPct(consumption.pct2025, 1)}</div>
                        <div class="cm-yoy-spend">${fmtBig(consumption.spend2025)}</div>
                    </div>
                    <div class="cm-yoy-block">
                        <div class="cm-yoy-label">2026 YTD</div>
                        <div class="cm-yoy-value">${fmtPct(consumption.pct2026, 1)}</div>
                        <div class="cm-yoy-spend">${fmtBig(consumption.spend2026)}</div>
                    </div>
                </div>
            </div>
            <div class="cm-card">
                <div style="font-size:14px; color:var(--gray-700); font-weight:700; margin-bottom:4px;">Spot</div>
                <div style="font-size:11px; color:var(--gray-500); margin-bottom:14px;">Compras pontuais — exposição</div>
                <div class="cm-big-pct orange">${fmtPct(spot.pctTotal, 1)}</div>
                <div class="cm-sub">do spend total · ${fmtBig(spot.spendTotal)}</div>
                <div class="cm-yoy">
                    <div class="cm-yoy-block">
                        <div class="cm-yoy-label">2025</div>
                        <div class="cm-yoy-value">${fmtPct(spot.pct2025, 1)}</div>
                        <div class="cm-yoy-spend">${fmtBig(spot.spend2025)}</div>
                    </div>
                    <div class="cm-yoy-block">
                        <div class="cm-yoy-label">2026 YTD</div>
                        <div class="cm-yoy-value">${fmtPct(spot.pct2026, 1)}</div>
                        <div class="cm-yoy-spend">${fmtBig(spot.spend2026)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// =====================================================================
// INDICADORES 2x2
// =====================================================================

function formatIndicatorValue(ind) {
    const v = ind.lastValue;
    if (ind.unit === 'USD/bbl' || ind.unit === 'USD/MMBtu' || ind.unit === 'USD/Ton') return `$ ${fmtNum(v, 2)}`;
    if (ind.unit === 'BRL') return `R$ ${fmtNum(v, 4)}`;
    if (ind.unit === 'R$/L') return `R$ ${fmtNum(v, 3)}`;
    if (ind.unit === 'R$/MWh') return `R$ ${fmtNum(v, 2)}`;
    if (ind.unit === '%' || ind.unit === '% a.a.') return `${fmtNum(v, 2)}%`;
    return fmtNum(v, 2);
}
function groupColor(group) {
    return ({ energy:'#FF6B00', fuel:'#C62828', chemicals:'#6A1B9A', macro:'#1E6BFF', fx:'#16A34A', logistics:'#0891B2' })[group] || '#1E6BFF';
}

function renderIndicatorBigCard(ind) {
    if (!ind.available) {
        return `<div class="indicator-big-card ${ind.group}" style="opacity:0.5;">
            <div class="indicator-big-head">
                <div class="indicator-big-icon" style="background:${groupColor(ind.group)}">${escapeHtml(ind.code)}</div>
                <div class="indicator-big-tag">Sem dados</div>
            </div>
            <div class="indicator-big-value-row">
                <div class="indicator-big-value-block">
                    <div class="indicator-big-value">—</div>
                    <div class="indicator-big-label">${escapeHtml(ind.label)}</div>
                </div>
            </div>
        </div>`;
    }

    const dayClass = deltaClass(ind.varDay);
    const dayArrow = ind.varDay > 0 ? '▲' : (ind.varDay < 0 ? '▼' : '●');
    const periodClass = deltaClass(ind.varPeriod);
    const periodSign = ind.varPeriod !== null && ind.varPeriod >= 0 ? '+' : '';
    const periodLabel = (ind.group === 'macro' || ind.group === 'fuel' || ind.group === 'chemicals' || ind.group === 'logistics') ? 'em 12m' : 'no período';

    const dataAtual = ind.lastDate ? fmtDayMon(ind.lastDate) : '';
    const dataInicial = ind.sparkDates && ind.sparkDates.length > 0 ? fmtDayMon(ind.sparkDates[0]) : '';
    const sparkColor = groupColor(ind.group);

    return `<div class="indicator-big-card ${ind.group}">
        <div class="indicator-big-head">
            <div class="indicator-big-icon" style="background:${groupColor(ind.group)}">${escapeHtml(ind.code)}</div>
            <div class="indicator-big-tag">Ao vivo</div>
        </div>
        <div class="indicator-big-value-row">
            <div class="indicator-big-value-block">
                <div class="indicator-big-value">${formatIndicatorValue(ind)}</div>
                <div class="indicator-big-label">${escapeHtml(ind.label)}</div>
            </div>
            ${ind.varDay !== null ? `<div class="indicator-big-delta ${dayClass}">${dayArrow}${fmtNum(Math.abs(ind.varDay), 2)}%</div>` : ''}
        </div>
        <div class="indicator-big-spark">${sparklineFull(ind.spark, { color: sparkColor })}</div>
        <div class="indicator-big-foot">
            <span class="indicator-big-period">${dataInicial} — ${dataAtual}</span>
            ${ind.varPeriod !== null
                ? `<span class="indicator-big-period-delta ${periodClass}">${periodSign}${fmtNum(ind.varPeriod, 2)}% ${periodLabel}</span>`
                : ''}
        </div>
    </div>`;
}

function renderIndicatorsPage(pageNum) {
    if (!state.internal?.marketIntel) return;
    const inds = state.internal.marketIntel.filter(i => i.page === pageNum);
    const grid = document.getElementById(`indicators-${pageNum}-grid`);
    if (!grid) return;
    grid.innerHTML = inds.map(renderIndicatorBigCard).join('');
    const updated = state.internal.gasNatural?.updatedAt;
    const updatedEl = document.getElementById(`indicators-${pageNum}-updated`);
    if (updatedEl) updatedEl.textContent = updated ? fmtFullDate(updated) : '—';
}

// =====================================================================
// NOTÍCIAS — Cards horizontais (Print 2 estilo)
// =====================================================================

function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
}

function renderNewsCard(item) {
    const hasImg = item.image && (item.image.startsWith('http') || item.image.startsWith('//'));
    const imgStyle = hasImg ? `background-image:url('${escapeHtml(item.image)}');` : '';
    const fallbackChar = (item.source || 'B').charAt(0).toUpperCase();
    const dataFmt = fmtDateNews(item.published_at);
    const tag = item.topic || item.source || 'Notícia';

    return `<a class="news-card" href="${escapeHtml(item.url || '#')}" target="_blank" rel="noopener noreferrer">
        <div class="news-img" style="${imgStyle}">
            ${!hasImg ? `<div class="news-img-fallback">${escapeHtml(fallbackChar)}</div>` : ''}
        </div>
        <div class="news-body">
            <div class="news-tag ${item.alert ? 'alert' : ''}">${escapeHtml(tag)}</div>
            <div class="news-title">${escapeHtml(item.title || 'Sem título')}</div>
            <div class="news-summary">${escapeHtml(item.summary || 'Clique para abrir a matéria completa.')}</div>
            <div class="news-meta">
                <div class="news-meta-icon">${escapeHtml((item.source || 'B').charAt(0).toUpperCase())}</div>
                <span class="news-meta-source">${escapeHtml(item.source || 'Fonte')}</span>
                <span class="news-meta-date">${dataFmt}</span>
            </div>
        </div>
    </a>`;
}

function renderNewsPage(pageId, dataset, slice) {
    const news = state.internal?.news;
    const gridId = pageId.replace('page-', '') + '-grid';
    const grid = document.getElementById(gridId);
    if (!grid) { console.warn('[news] Grid não encontrado:', gridId); return; }

    const items = (news?.[dataset] || []).slice(slice[0], slice[1]);
    const updatedEl = document.getElementById(pageId.replace('page-', '') + '-updated');
    if (updatedEl && news?.updatedAt) updatedEl.textContent = fmtDateNews(news.updatedAt);

    if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; padding:60px; text-align:center; color:var(--gray-600);">
            Sem notícias carregadas nesta seção.<br><br>
            <small style="color:var(--gray-500);">Execute: <code>python data_engine.py --news --once</code></small>
        </div>`;
        return;
    }
    grid.innerHTML = items.map(renderNewsCard).join('');
}

// =====================================================================
// NAVIGATION
// =====================================================================

function showPage(idx) {
    state.currentPage = (idx + PAGES.length) % PAGES.length;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.page-dot').forEach(d => d.classList.remove('active'));

    const page = PAGES[state.currentPage];
    document.getElementById(page.id).classList.add('active');
    document.querySelectorAll('.page-dot')[state.currentPage].classList.add('active');
    document.getElementById('footer-page-name').textContent = page.name;

    if (page.type === 'news') renderNewsPage(page.id, page.dataset, page.slice);
    else if (page.type === 'indicators') renderIndicatorsPage(page.pageNum);

    if (state.pageTimer) clearTimeout(state.pageTimer);
    if (state.progressTimer) clearInterval(state.progressTimer);

    if (!state.paused) {
        state.progressStart = Date.now();
        state.progressDuration = page.duration;
        updateProgressBar();
        state.progressTimer = setInterval(updateProgressBar, 100);
        state.pageTimer = setTimeout(() => showPage(state.currentPage + 1), page.duration);
    } else {
        document.getElementById('footer-progress-bar').style.width = '0%';
    }
}

function updateProgressBar() {
    const elapsed = Date.now() - state.progressStart;
    const pct = Math.min((elapsed / state.progressDuration) * 100, 100);
    document.getElementById('footer-progress-bar').style.width = pct + '%';
}
function nextPage() { showPage(state.currentPage + 1); }
function prevPage() { showPage(state.currentPage - 1); }
function togglePause() {
    state.paused = !state.paused;
    const btn = document.getElementById('btn-pause');
    if (state.paused) {
        if (state.pageTimer) clearTimeout(state.pageTimer);
        if (state.progressTimer) clearInterval(state.progressTimer);
        btn.textContent = '▶';
    } else {
        btn.textContent = 'II';
        showPage(state.currentPage);
    }
}
function setupPageDots() {
    const c = document.getElementById('page-dots');
    c.innerHTML = PAGES.map((p, i) => `<button class="page-dot" data-idx="${i}" title="${escapeHtml(p.name)}"></button>`).join('');
    c.querySelectorAll('.page-dot').forEach(dot => {
        dot.addEventListener('click', () => showPage(parseInt(dot.dataset.idx)));
    });
}

// =====================================================================
// LOAD
// =====================================================================

async function loadData() {
    document.getElementById('loading-overlay').classList.remove('hidden');
    try {
        state.internal = await window.DataAdapter.loadAllInternalData();

        renderSaving();
        renderSpendOverview();
        renderSpendBreakdown();
        renderSpendTypes();
        renderVendors();
        renderContractMix();
        [1, 2, 3, 4].forEach(p => renderIndicatorsPage(p));
        PAGES.filter(p => p.type === 'news').forEach(p => renderNewsPage(p.id, p.dataset, p.slice));

        const failed = state.internal._failed || [];
        const critical = failed.filter(f => f !== 'news');
        if (critical.length > 0) {
            document.getElementById('header-status-dot').classList.add('offline');
            document.getElementById('header-status-text').textContent = `${critical.length} erro(s)`;
        } else if (failed.includes('news')) {
            document.getElementById('header-status-text').textContent = 'Sem notícias';
        } else {
            document.getElementById('header-status-dot').classList.remove('offline');
            document.getElementById('header-status-text').textContent = 'Ao vivo';
        }
    } catch (err) {
        console.error('[app] loadData err:', err);
        document.getElementById('header-status-dot').classList.add('offline');
        document.getElementById('header-status-text').textContent = 'Erro';
    }
    document.getElementById('loading-overlay').classList.add('hidden');
}

async function init() {
    setupPageDots();
    updateClock();
    setInterval(updateClock, 1000);

    document.getElementById('btn-prev').addEventListener('click', prevPage);
    document.getElementById('btn-next').addEventListener('click', nextPage);
    document.getElementById('btn-pause').addEventListener('click', togglePause);
    document.getElementById('btn-refresh').addEventListener('click', loadData);
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') prevPage();
        else if (e.key === 'ArrowRight') nextPage();
        else if (e.key === ' ') { e.preventDefault(); togglePause(); }
        else if (e.key === 'r' || e.key === 'R') loadData();
    });

    await loadData();
    showPage(0);
    setInterval(loadData, 5 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
