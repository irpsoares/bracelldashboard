"""
========================================================================
data_engine.py — Bracell Dashboard Data Engine
========================================================================
Loop contínuo refresh 30min. Atualiza:
  - inteligencia_mercado.json (Brent + WTI + NG via Alpha Vantage,
                               IPCA/IGP-M/Selic via BCB SGS,
                               USD/EUR via BCB Olinda PTAX)
  - gas_natural.json (série diária Henry Hub via Alpha Vantage)
  - news_bracell.json (Bracell + Google News + microlink fallback)

Não toca em arquivos manuais (Saving, KPIs, Spend_*).
========================================================================
"""

import argparse
import json
import logging
import sys
import time
import traceback
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent
INTERNAL_DIR = BASE_DIR / "data" / "internal"
BACKUP_DIR = INTERNAL_DIR / ".backup"
LOG_DIR = BASE_DIR / "logs"

for p in [INTERNAL_DIR, BACKUP_DIR, LOG_DIR]:
    p.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(BASE_DIR))

REFRESH_INTERVAL_SEC = 30 * 60

LOG_FILE = LOG_DIR / f"engine_{datetime.now():%Y%m%d}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("engine")


def backup_file(filename: str):
    src = INTERNAL_DIR / filename
    if not src.exists():
        return
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = BACKUP_DIR / f"{filename.replace('.json', '')}_{timestamp}.json"
    try:
        dst.write_bytes(src.read_bytes())
        prefix = filename.replace('.json', '')
        backups = sorted([f for f in BACKUP_DIR.glob(f"{prefix}_*.json")])
        for old in backups[:-10]:
            old.unlink()
    except Exception as e:
        log.warning(f"Backup falhou {filename}: {e}")


def save_json(filename: str, data: dict):
    backup_file(filename)
    target = INTERNAL_DIR / filename
    tmp = target.with_suffix(".json.tmp")

    def encoder(o):
        if isinstance(o, float) and (o != o):
            return None
        if hasattr(o, 'isoformat'):
            return o.isoformat()
        raise TypeError(f"Object {type(o)} not serializable")

    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=encoder, allow_nan=False)
        tmp.replace(target)
        log.info(f"  ✓ Salvo: {filename}")
        return True
    except Exception as e:
        log.error(f"  ✗ Falha {filename}: {e}")
        if tmp.exists():
            tmp.unlink()
        return False


def load_json(filename: str) -> dict:
    target = INTERNAL_DIR / filename
    if not target.exists():
        return {}
    try:
        with open(target, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        log.warning(f"Load falhou {filename}: {e}")
        return {}


def run_market_intel():
    log.info("► Atualizando Market Intelligence (Alpha Vantage + BCB)")
    try:
        from collectors.market_collector import collect_market_indicators
        existing = load_json("inteligencia_mercado.json")
        merged = collect_market_indicators(existing)
        if merged:
            save_json("inteligencia_mercado.json", merged)
            count = len(merged.get('Inteligência de Mercado', []))
            auto = merged.get('_meta', {}).get('automated_count', 0)
            manual = merged.get('_meta', {}).get('manual_count', 0)
            log.info(f"  → {count} registros ({auto} auto + {manual} manual)")
            return True
        return False
    except Exception as e:
        log.error(f"  → Erro: {e}")
        log.debug(traceback.format_exc())
        return False


def run_gas_natural():
    log.info("► Atualizando Gás Natural diário (Alpha Vantage NATURAL_GAS)")
    try:
        from collectors.eia_collector import collect_henry_hub
        data = collect_henry_hub()
        if data and data.get('data'):
            save_json("gas_natural.json", data)
            log.info(f"  → {len(data['data'])} pontos diários · último: {data['data'][-1]['Data']}")
            return True
        return False
    except Exception as e:
        log.error(f"  → Erro: {e}")
        log.debug(traceback.format_exc())
        return False


def run_news():
    log.info("► Atualizando Notícias (Bracell + Google News)")
    try:
        from collectors.news_collector import collect_all_news
        data = collect_all_news()
        if data:
            save_json("news_bracell.json", data)
            log.info(f"  → Bracell: {len(data.get('bracell', []))} · Globais: {len(data.get('globais', []))}")
            return True
        return False
    except Exception as e:
        log.error(f"  → Erro: {e}")
        log.debug(traceback.format_exc())
        return False


def run_cycle(args):
    cycle_start = datetime.now()
    log.info("=" * 60)
    log.info(f"CICLO INICIADO · {cycle_start:%Y-%m-%d %H:%M:%S}")
    log.info("=" * 60)

    results = {}
    if args.market or args.all:
        results['market'] = run_market_intel()
    if args.gas or args.all:
        results['gas'] = run_gas_natural()
    if args.news or args.all:
        results['news'] = run_news()

    duration = (datetime.now() - cycle_start).total_seconds()
    succeeded = sum(1 for v in results.values() if v)
    log.info("=" * 60)
    log.info(f"CICLO FINALIZADO · {succeeded}/{len(results)} OK · {duration:.1f}s")
    log.info("=" * 60)
    return results


def main():
    parser = argparse.ArgumentParser(description="Bracell Data Engine")
    parser.add_argument("--once",   action="store_true", help="Roda 1 ciclo e sai")
    parser.add_argument("--gas",    action="store_true", help="Só gás natural")
    parser.add_argument("--market", action="store_true", help="Só mercado/macro")
    parser.add_argument("--news",   action="store_true", help="Só notícias")
    parser.add_argument("--interval", type=int, default=REFRESH_INTERVAL_SEC,
                        help=f"Intervalo em segundos (default {REFRESH_INTERVAL_SEC})")
    args = parser.parse_args()
    args.all = not (args.gas or args.market or args.news)

    log.info("╔" + "═" * 58 + "╗")
    log.info("║  BRACELL DATA ENGINE v4                                  ║")
    log.info(f"║  Refresh: {args.interval // 60} min                                            ║")
    log.info("╚" + "═" * 58 + "╝")
    log.info(f"Diretório: {BASE_DIR}")
    log.info(f"Log: {LOG_FILE}")
    log.info("Ctrl+C para parar")
    log.info("")

    try:
        while True:
            run_cycle(args)
            if args.once:
                log.info("Modo --once: encerrando.")
                break
            log.info(f"Aguardando {args.interval // 60} min...")
            log.info("")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        log.info("\nInterrompido pelo usuário.")
    except Exception as e:
        log.error(f"Erro fatal: {e}")
        log.error(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
