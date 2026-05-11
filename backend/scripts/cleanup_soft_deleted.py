#!/usr/bin/env python3
"""
Job de limpeza: hard delete de registros com soft delete há mais de 90 dias.

Não remove prontuarios nem evolucoes (retenção CFM — 20 anos; fora do escopo deste job).

Uso (na pasta backend):
  python scripts/cleanup_soft_deleted.py
  python scripts/cleanup_soft_deleted.py --dry-run

Agendar mensalmente (cron / GitHub Actions) com variáveis Supabase configuradas.
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone, timedelta

# Raiz do pacote backend no path
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(_BACKEND_ROOT, '.env'))


def _audit_log(supabase, *, clinica_id, registro_id, tabela_afetada, dados_anteriores, dry_run: bool):
    if dry_run:
        return
    try:
        supabase.table('audit_logs').insert({
            'clinica_id': clinica_id,
            'usuario_id': None,
            'tabela_afetada': tabela_afetada,
            'registro_id': registro_id,
            'acao': 'HARD_DELETE_CLEANUP',
            'dados_anteriores': dados_anteriores,
            'dados_novos': {'origem': 'cleanup_soft_deleted', 'executado_em': datetime.now(timezone.utc).isoformat()},
        }).execute()
    except Exception as exc:
        print(f'[audit_logs] falha ao registrar limpeza {tabela_afetada}/{registro_id}: {exc}')


def run_cleanup(*, dry_run: bool, retention_days: int = 90) -> dict:
    from database.supabase_client import get_supabase_client

    supabase = get_supabase_client()
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    cutoff_iso = cutoff.isoformat()
    stats = {'relatorios': 0, 'lancamentos_financeiros': 0, 'dry_run': dry_run}

    bucket = 'relatorios'

    rel_resp = (
        supabase.table('relatorios')
        .select('id, clinica_id, arquivo_path, deletado_em')
        .not_.is_('deletado_em', 'null')
        .lt('deletado_em', cutoff_iso)
        .execute()
    )
    for row in rel_resp.data or []:
        rid = row['id']
        cid = row['clinica_id']
        path = row.get('arquivo_path')
        stats['relatorios'] += 1
        if dry_run:
            print(f'[dry-run] relatorio {rid} clinica={cid} deletado_em={row.get("deletado_em")}')
            continue
        if path:
            try:
                supabase.storage.from_(bucket).remove([path])
            except Exception as exc:
                print(f'[storage] falha ao remover {path}: {exc}')
        supabase.table('relatorios').delete().eq('id', rid).eq('clinica_id', cid).execute()
        _audit_log(supabase, clinica_id=cid, registro_id=rid, tabela_afetada='relatorios', dados_anteriores=row, dry_run=dry_run)

    lan_resp = (
        supabase.table('lancamentos_financeiros')
        .select('id, clinica_id, deletado_em')
        .not_.is_('deletado_em', 'null')
        .lt('deletado_em', cutoff_iso)
        .execute()
    )
    for row in lan_resp.data or []:
        rid = row['id']
        cid = row['clinica_id']
        stats['lancamentos_financeiros'] += 1
        if dry_run:
            print(f'[dry-run] lancamento {rid} clinica={cid}')
            continue
        supabase.table('lancamentos_financeiros').delete().eq('id', rid).eq('clinica_id', cid).execute()
        _audit_log(
            supabase,
            clinica_id=cid,
            registro_id=rid,
            tabela_afetada='lancamentos_financeiros',
            dados_anteriores=row,
            dry_run=dry_run,
        )

    return stats


def main():
    p = argparse.ArgumentParser(description='Hard delete de soft-deletes com mais de 90 dias (exceto prontuário/evolução).')
    p.add_argument('--dry-run', action='store_true', help='Somente listar o que seria removido')
    p.add_argument('--retention-days', type=int, default=90)
    args = p.parse_args()
    stats = run_cleanup(dry_run=args.dry_run, retention_days=args.retention_days)
    print(stats)


if __name__ == '__main__':
    main()
