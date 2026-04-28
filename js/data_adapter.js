/* =========================================================================
   data_adapter.js — Bracell Dashboard
   ========================================================================= */

const INTERNAL_BASE = 'data/internal/';

const INTERNAL_FILES = {
    kpis:           'KPIs_Procurement.json',
    saving:         'Saving.json',
    qtdDocs:        'qtd_documentos_compras.json',
    bu:             'Spend_Por_BusinessUnit.json',
    category:       'Spend_Por_Category.json',
    contractType:   'Spend_Por_ContractType.json',
    documentType:   'Spend_Por_DocumentType.json',
    materialType:   'Spend_Por_MaterialType.json',
    vendors:        'Spend_Top_Vendors.json',
    gasNatural:     'gas_natural.json',
    market:         'inteligencia_mercado.json',
    news:           'news_bracell.json'
};

const INDICATOR_SPECS = [
    { match: 'Petróleo - Brent',                label: 'Brent Crude Oil',         code: 'BRENT',   group: 'energy',     unit: 'USD/bbl',   page: 1 },
    { match: 'Natural Gas - Henry Hub',         label: 'Henry Hub Natural Gas',   code: 'NG-HH',   group: 'energy',     unit: 'USD/MMBtu', page: 1, sourceGasNatural: true },
    { match: 'USD/BRL',                         label: 'Dólar Comercial',         code: 'USD',     group: 'fx',         unit: 'BRL',       page: 1 },
    { match: 'EUR/BRL',                         label: 'Euro Comercial',          code: 'EUR',     group: 'fx',         unit: 'BRL',       page: 1 },
    { match: 'Petróleo - WTI',                  label: 'WTI Crude Oil',           code: 'WTI',     group: 'energy',     unit: 'USD/bbl',   page: 2 },
    { match: 'Diesel - Paulínia',               label: 'Diesel Paulínia',         code: 'DSL-PAU', group: 'fuel',       unit: 'R$/L',      page: 2 },
    { match: 'Diesel - Cubatão',                label: 'Diesel Cubatão',          code: 'DSL-CUB', group: 'fuel',       unit: 'R$/L',      page: 2 },
    { match: 'Diesel - São Francisco do Conde', label: 'Diesel SFC',              code: 'DSL-SFC', group: 'fuel',       unit: 'R$/L',      page: 2 },
    { match: 'Caustic Soda',                    label: 'Soda Cáustica',           code: 'NAOH',    group: 'chemicals',  unit: 'USD/Ton',   page: 3 },
    { match: 'Sulphur',                         label: 'Enxofre',                 code: 'SUL',     group: 'chemicals',  unit: 'USD/Ton',   page: 3 },
    { match: 'Energia elétrica - Sudeste',      label: 'Energia SE',              code: 'ELE-SE',  group: 'energy',     unit: 'R$/MWh',    page: 3 },
    { match: 'Energia elétrica - Nordeste',     label: 'Energia NE',              code: 'ELE-NE',  group: 'energy',     unit: 'R$/MWh',    page: 3 },
    { match: 'IPCA',                            label: 'IPCA Mensal',             code: 'IPCA',    group: 'macro',      unit: '%',         page: 4 },
    { match: 'IGP-M',                           label: 'IGP-M Mensal',            code: 'IGPM',    group: 'macro',      unit: '%',         page: 4 },
    { match: 'Selic',                           label: 'Selic Anualizada',        code: 'SELIC',   group: 'macro',      unit: '% a.a.',    page: 4 },
    { match: 'INCTL - dist 800',                label: 'INCTL Frete 800km',       code: 'FRT-800', group: 'logistics',  unit: '%',         page: 4 }
];

async function fetchJSONSanitized(path) {
    try {
        const response = await fetch(path + '?t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let raw = await response.text();
        raw = raw.replace(/:\s*NaN\s*([,}\]])/g, ': null$1');
        raw = raw.replace(/:\s*-Infinity\s*([,}\]])/g, ': null$1');
        raw = raw.replace(/:\s*Infinity\s*([,}\]])/g, ': null$1');
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[adapter] ${path}:`, err.message);
        return null;
    }
}

function parseLocaleNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    let s = value.trim();
    if (!s || s.toLowerCase() === 'nan') return null;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.');
    else if (hasComma) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
}

async function loadAllInternalData() {
    const promises = Object.entries(INTERNAL_FILES).map(async ([key, file]) => {
        const data = await fetchJSONSanitized(INTERNAL_BASE + file);
        return [key, data];
    });
    const results = await Promise.all(promises);
    const raw = Object.fromEntries(results);
    const failed = Object.entries(raw).filter(([k, v]) => v === null).map(([k]) => k);

    const gasNatural = transformGasNatural(raw.gasNatural);

    return {
        kpis:         transformKPIs(raw.kpis),
        saving:       transformSaving(raw.saving),
        qtdDocs:      transformQtdDocs(raw.qtdDocs),
        bu:           transformSpendBy(raw.bu, 'Business Unit'),
        category:     transformSpendBy(raw.category, 'Document Category'),
        contractType: transformSpendBy(raw.contractType, 'Contract Type'),
        documentType: transformSpendBy(raw.documentType, 'Document Type'),
        materialType: transformMaterialType(raw.materialType),
        vendors:      transformVendors(raw.vendors),
        gasNatural:   gasNatural,
        marketIntel:  transformMarketIntel(raw.market, gasNatural),
        news:         transformNews(raw.news),
        _failed:      failed,
        _loadedAt:    new Date().toISOString()
    };
}

function transformKPIs(raw) {
    if (!raw || !raw.Planilha1) return null;
    const byYear = {};
    raw.Planilha1.forEach(r => { byYear[r.Ano] = r; });
    const cur = byYear[2026] || {};
    const prev = byYear[2025] || {};
    const prev2 = byYear[2024] || {};
    return {
        currentYear: 2026, previousYear: 2025,
        spend: { ytd_2026: cur.Spend || 0, full_2025: prev.Spend || 0, full_2024: prev2.Spend || 0 },
        backlog: {
            current: cur.Backlog || 0,
            previous: prev.Backlog || 0,
            previous2: prev2.Backlog || 0,
            isAlert: prev.Backlog > 0 && (cur.Backlog / prev.Backlog) > 1.3
        },
        leadTime: {
            current: cur['Lead Time'] || 0,
            previous: prev['Lead Time'] || 0,
            delta: (cur['Lead Time'] || 0) - (prev['Lead Time'] || 0)
        },
        purchasingAutomation: {
            current: (cur['Purchasing Automation'] || 0) * 100,
            previous: (prev['Purchasing Automation'] || 0) * 100,
            delta: ((cur['Purchasing Automation'] || 0) - (prev['Purchasing Automation'] || 0)) * 100,
            target: 70
        },
        sourcing: {
            current: (cur.Sourcing || 0) * 100,
            previous: (prev.Sourcing || 0) * 100,
            delta: ((cur.Sourcing || 0) - (prev.Sourcing || 0)) * 100
        },
        sourcingOnTime: {
            current: (cur['Sourcing on Time'] || 0) * 100,
            previous: (prev['Sourcing on Time'] || 0) * 100,
            delta: ((cur['Sourcing on Time'] || 0) - (prev['Sourcing on Time'] || 0)) * 100,
            target: 90
        }
    };
}

function transformSaving(raw) {
    if (!raw || !raw.Planilha1) return null;
    const rows = raw.Planilha1;
    const total = rows.find(r => (r['Nome da Tarefa'] || '').toLowerCase().includes('total'));
    const bus = rows.filter(r => r !== total).map(r => ({
        name: r['Nome da Tarefa'] || '—',
        expectSaving: r['Expect Saving'] || 0,
        actualSaving: r['Actual Saving'] || 0,
        expectCostAvoidance: r['Expect Cost Avoidance'] || 0,
        actualCostAvoidance: r['Actual Cost Avoidance'] || 0,
        progresso: r['Progresso'] || '—',
        atraso: r['Atraso'] || '—'
    }));
    return {
        total: {
            expectSaving: total?.['Expect Saving'] || 0,
            actualSaving: total?.['Actual Saving'] || 0,
            expectCostAvoidance: total?.['Expect Cost Avoidance'] || 0,
            actualCostAvoidance: total?.['Actual Cost Avoidance'] || 0,
            progresso: total?.['Progresso'] || '—',
            atraso: total?.['Atraso'] || '—',
            pctConcluido: total?.['Expect Saving'] > 0 ? ((total['Actual Saving'] || 0) / total['Expect Saving']) * 100 : 0,
            gap: (total?.['Expect Saving'] || 0) - (total?.['Actual Saving'] || 0)
        },
        bus
    };
}

function transformQtdDocs(raw) {
    if (!raw || !raw.Planilha1) return null;
    const rows = raw.Planilha1.map(r => ({
        bu: (r['Business Unit'] || '').trim(),
        qtd2025: r['Qtd. Doc. 2025'] || 0,
        qtd2026: r['Qtd. Doc. 2026'] || 0,
        total: r['Total'] || 0
    }));
    const totalRow = rows.find(r => r.bu.toLowerCase() === 'total');
    return {
        total: totalRow,
        bus: rows.filter(r => r.bu.toLowerCase() !== 'total').sort((a, b) => b.total - a.total)
    };
}

function transformSpendBy(raw, dim) {
    if (!raw || !raw.Planilha1) return [];
    return raw.Planilha1.map(r => ({
        name: r[dim] || '—',
        spend2025: r['Spend 2025'] || 0,
        spend2026: r['Spend 2026'] || 0,
        spendTotal: r['Spend Total'] || 0,
        pct2025: (r['% 2025'] || 0) * 100,
        pct2026: (r['% 2026'] || 0) * 100,
        pctTotal: (r['% Total'] || 0) * 100,
        rank: r['Rank Total'] || 0
    })).sort((a, b) => a.rank - b.rank);
}

function transformMaterialType(raw) {
    if (!raw || !raw.Planilha1) return [];
    return raw.Planilha1.map(r => ({
        name: r['Material Type'] || '—',
        aplicacao: r['Aplicação'] || '—',
        spend2025: r['Spend 2025'] || 0,
        spend2026: r['Spend 2026'] || 0,
        spendTotal: r['Spend Total'] || 0
    })).sort((a, b) => b.spendTotal - a.spendTotal);
}

function transformVendors(raw) {
    if (!raw || !raw.Planilha1) return [];
    return raw.Planilha1.map(r => ({
        name: (r['Vendor Name'] || '—').trim(),
        spend2025: r['Spend 2025'] || 0,
        spend2026: r['Spend 2026'] || 0,
        spendTotal: r['Spend Total'] || 0,
        pct2025: (r['% 2025'] || 0) * 100,
        pct2026: (r['% 2026'] || 0) * 100,
        pctTotal: (r['% Total'] || 0) * 100,
        rankTotal: r['Rank Total'] || 0,
        rank2025: r['Rank 2025'] || 0,
        rank2026: r['Rank 2026'] || 0,
        rankDelta: (r['Rank 2025'] || 0) - (r['Rank 2026'] || 0)
    })).sort((a, b) => a.rankTotal - b.rankTotal);
}

function transformGasNatural(raw) {
    if (!raw || !raw.data) return null;
    const points = raw.data.map(p => ({
        date: p.Data,
        value: typeof p.Gas === 'number' ? p.Gas : parseLocaleNumber(p.Gas)
    })).filter(p => p.value !== null && p.date).sort((a, b) => a.date.localeCompare(b.date));
    if (points.length === 0) return null;

    const last = points[points.length - 1];
    const lastDate = new Date(last.date);
    const ago30d = new Date(lastDate); ago30d.setDate(ago30d.getDate() - 30);
    const ago1y = new Date(lastDate); ago1y.setFullYear(ago1y.getFullYear() - 1);

    const findClosest = (target) => points.reduce((best, p) =>
        Math.abs(new Date(p.date) - target) < Math.abs(new Date(best.date) - target) ? p : best
    );
    const p30 = findClosest(ago30d);
    const p1y = findClosest(ago1y);

    return {
        unit: raw.data[0]?.Unidade || 'USD/MMBtu',
        lastDate: last.date,
        lastValue: last.value,
        var30d: p30.value ? ((last.value - p30.value) / p30.value) * 100 : 0,
        varYoY: p1y.value ? ((last.value - p1y.value) / p1y.value) * 100 : 0,
        spark90d: points.slice(-90).map(p => p.value),
        spark90dDates: points.slice(-90).map(p => p.date),
        history: points,
        updatedAt: raw._meta?.updated_at,
        status: raw._meta?.status
    };
}

function transformMarketIntel(raw, gasNaturalDaily) {
    if (!raw || !raw['Inteligência de Mercado']) return [];
    const all = raw['Inteligência de Mercado'];
    const todayISO = new Date().toISOString().slice(0, 10);

    return INDICATOR_SPECS.map(spec => {
        if (spec.sourceGasNatural && gasNaturalDaily && gasNaturalDaily.spark90d.length > 0) {
            return {
                ...spec,
                lastDate: gasNaturalDaily.lastDate,
                lastValue: gasNaturalDaily.lastValue,
                varDay: null,
                varPeriod: gasNaturalDaily.var30d,
                varMonth: gasNaturalDaily.var30d,
                var12m: gasNaturalDaily.varYoY,
                spark: gasNaturalDaily.spark90d,
                sparkDates: gasNaturalDaily.spark90dDates,
                history: gasNaturalDaily.history,
                available: true
            };
        }

        let series = all
            .filter(r => r.Indicador && r.Indicador.includes(spec.match))
            .map(r => ({
                date: typeof r.Data === 'string' ? r.Data.slice(0, 10) : null,
                value: parseLocaleNumber(r['Valor Original']),
                varMonth: parseLocaleNumber(r['Variação Mensal %']),
                var12m: parseLocaleNumber(r['Últimos 12 meses'])
            }))
            .filter(p => p.date && p.value !== null);

        if (spec.group === 'macro' || spec.group === 'fx') {
            series = series.filter(p => p.date <= todayISO);
        }
        series.sort((a, b) => a.date.localeCompare(b.date));

        if (series.length === 0) {
            return { ...spec, lastValue: null, varDay: null, varPeriod: null, spark: [], available: false };
        }

        // Correção defensiva (IPCA/IGP-M extraídos com 100x)
        let scaleFactor = 1;
        if (spec.group === 'macro' && spec.unit === '%') {
            const lastVal = series[series.length - 1].value;
            if (lastVal > 500) scaleFactor = 100;
            else if (lastVal > 50 && lastVal < 500) scaleFactor = 10;
        }
        if (scaleFactor !== 1) series = series.map(p => ({ ...p, value: p.value / scaleFactor }));

        const last = series[series.length - 1];
        const last30 = series.slice(-30);
        const spark = last30.map(p => p.value);

        let varDay = null;
        if (series.length >= 2) {
            const prev = series[series.length - 2];
            if (prev.value) varDay = ((last.value - prev.value) / prev.value) * 100;
        }

        let varPeriod = null;
        if (spec.group === 'macro' || spec.group === 'fuel' || spec.group === 'chemicals' || spec.group === 'logistics') {
            varPeriod = last.var12m;
        } else if (last30.length >= 2) {
            const first = last30[0];
            if (first.value) varPeriod = ((last.value - first.value) / first.value) * 100;
        }

        return {
            ...spec,
            lastDate: last.date,
            lastValue: last.value,
            varDay, varPeriod,
            varMonth: last.varMonth,
            var12m: last.var12m,
            spark,
            sparkDates: last30.map(p => p.date),
            history: series,
            available: true
        };
    });
}

function transformNews(raw) {
    if (!raw) return { bracell: [], globais: [], updatedAt: null };
    return {
        bracell: Array.isArray(raw.bracell) ? raw.bracell : [],
        globais: Array.isArray(raw.globais) ? raw.globais : [],
        updatedAt: raw._meta?.updated_at || null
    };
}

window.DataAdapter = { loadAllInternalData, parseLocaleNumber, INDICATOR_SPECS };
