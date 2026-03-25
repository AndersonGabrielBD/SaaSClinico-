"""
Consultas multi-tenant centralizadas (id + clinica_id).

O backend usa service_role; RLS não aplica. Sempre filtrar por clinica_id
nas leituras por ID reduz risco de vazamento entre clínicas.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class TenantResourceNotFound(LookupError):
    """Recurso inexistente ou não pertence ao tenant (uso em serviços/rotas)."""


def fetch_row_for_tenant(
    client: Any,
    table: str,
    row_id: str,
    clinica_id: str,
    *,
    select: str = '*',
) -> Optional[dict]:
    """
    Busca uma linha por id garantindo clinica_id.

    Retorna None se não houver resultado (sem lançar por ausência de linha).
    """
    try:
        res = (
            client.table(table)
            .select(select)
            .eq('id', row_id)
            .eq('clinica_id', clinica_id)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return None
        if len(rows) > 1:
            logger.warning(
                '[TENANT] Múltiplas linhas para id=%s table=%s clinica_id=%s',
                row_id,
                table,
                clinica_id,
            )
        return rows[0]
    except Exception as e:
        logger.error('[TENANT] fetch_row_for_tenant falhou table=%s: %s', table, e)
        raise
