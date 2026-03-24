import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional
from database.supabase_client import get_supabase_client
import time

logger = logging.getLogger(__name__)


_FINANCE_PATCH_KEYS = frozenset({
    'status', 'valor_pago', 'metodo_pagamento', 'valor_entrada',
    'metodo_pagamento_restante', 'data_prevista_pagamento_restante',
    'metodo_pagamento_complemento', 'data_pagamento', 'data_complemento',
})


class PacoteService:
    """Serviço para gerenciar tipos de profissional e pacotes de sessões."""

    def __init__(self):
        self.supabase = get_supabase_client()
        self.max_retries = 2
        self.retry_delay = 0.5

    def _get_client(self):
        return get_supabase_client()

    def _execute_with_retry(self, operation_name, operation_func):
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"[PACOTE] {operation_name} - Tentativa {attempt + 1}")
                self.supabase = self._get_client()
                return operation_func()
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                should_retry = any(k in error_msg for k in [
                    'connection', 'timeout', 'temporary', 'unavailable',
                    'network', '500', '502', '503'
                ])
                if should_retry and attempt < self.max_retries:
                    logger.warning(f"[PACOTE] {operation_name} - tentativa {attempt + 1}: {e}")
                    time.sleep(self.retry_delay)
                else:
                    logger.error(f"[PACOTE] {operation_name} - erro final: {e}")
                    break
        raise last_error if last_error else Exception(f"Erro desconhecido em {operation_name}")

    # =========================================================================
    # PROFISSIONAIS DISPONÍVEIS
    # =========================================================================

    def listar_profissionais(self, clinica_id: str) -> List[Dict]:
        def operation():
            resp = self.supabase.table('usuarios') \
                .select('id, nome_completo, role, ativo') \
                .eq('clinica_id', clinica_id) \
                .in_('role', ['profissional', 'fono', 'medico']) \
                .eq('ativo', True) \
                .order('nome_completo') \
                .execute()
            return resp.data or []
        return self._execute_with_retry(f"LISTAR_PROFISSIONAIS:{clinica_id}", operation)

    # =========================================================================
    # TIPOS DE PROFISSIONAL
    # =========================================================================

    def listar_tipos(self, clinica_id: str, ativo: Optional[bool] = None) -> List[Dict]:
        def operation():
            # Sem embed PostgREST (usuarios!profissional_id): em alguns ambientes o resource
            # embutido falha ou responde de forma inconsistente; pacotes ativos usam SQL/RPC.
            # Aqui: select simples em tipos_profissional + 1 batch em usuarios (mesmo padrão lógico da RPC).
            query = self.supabase.table('tipos_profissional') \
                .select('*') \
                .eq('clinica_id', clinica_id) \
                .order('nome')
            if ativo is not None:
                query = query.eq('ativo', ativo)
            response = query.execute()
            rows = list(response.data or [])
            prof_ids = list({r['profissional_id'] for r in rows if r.get('profissional_id')})
            id_to_name: Dict[str, str] = {}
            if prof_ids:
                uresp = self.supabase.table('usuarios') \
                    .select('id, nome_completo') \
                    .in_('id', prof_ids) \
                    .eq('clinica_id', clinica_id) \
                    .execute()
                for u in (uresp.data or []):
                    uid = u.get('id')
                    if uid:
                        id_to_name[uid] = u.get('nome_completo') or ''
            for row in rows:
                pid = row.get('profissional_id')
                row['profissional_nome'] = id_to_name.get(pid) if pid else None
            return rows
        return self._execute_with_retry(f"LISTAR_TIPOS:{clinica_id}", operation)

    def buscar_tipo(self, tipo_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('tipos_profissional') \
                .select('*') \
                .eq('id', tipo_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Tipo de profissional não encontrado')
            row = dict(response.data)
            pid = row.get('profissional_id')
            row['profissional_nome'] = None
            if pid:
                uresp = self.supabase.table('usuarios') \
                    .select('id, nome_completo') \
                    .eq('id', pid) \
                    .eq('clinica_id', clinica_id) \
                    .limit(1) \
                    .execute()
                ulist = uresp.data or []
                if ulist:
                    row['profissional_nome'] = ulist[0].get('nome_completo')
            return row
        return self._execute_with_retry(f"BUSCAR_TIPO:{tipo_id}", operation)

    def criar_tipo(self, clinica_id: str, nome: str, valor_sessao: Decimal,
                   profissional_id: Optional[str] = None) -> Dict:
        def operation():
            payload = {
                'clinica_id': clinica_id,
                'nome': nome.strip(),
                'valor_sessao': float(valor_sessao),
                'ativo': True,
            }
            if profissional_id:
                payload['profissional_id'] = profissional_id
            response = self.supabase.table('tipos_profissional').insert(payload).execute()
            if not response.data:
                raise Exception('Erro ao criar tipo de profissional')
            logger.info(f"Tipo criado: {nome} - R$ {valor_sessao}/sessão")
            return response.data[0]
        return self._execute_with_retry(f"CRIAR_TIPO:{clinica_id}", operation)

    def atualizar_tipo(self, tipo_id: str, clinica_id: str, dados: Dict) -> Dict:
        def operation():
            if 'valor_sessao' in dados:
                dados['valor_sessao'] = float(dados['valor_sessao'])
            response = self.supabase.table('tipos_profissional') \
                .update(dados) \
                .eq('id', tipo_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Tipo não encontrado ou sem permissão')
            return response.data[0]
        return self._execute_with_retry(f"ATUALIZAR_TIPO:{tipo_id}", operation)

    def excluir_tipo(self, tipo_id: str, clinica_id: str) -> Dict:
        def operation():
            vinculados = self.supabase.table('pacote_itens') \
                .select('id', count='exact') \
                .eq('tipo_profissional_id', tipo_id) \
                .execute()
            if vinculados.count and vinculados.count > 0:
                raise ValueError(
                    f'Não é possível excluir: este tipo está vinculado a {vinculados.count} '
                    f'item(ns) de pacote. Remova-o dos pacotes antes de excluir.'
                )
            response = self.supabase.table('tipos_profissional') \
                .delete() \
                .eq('id', tipo_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Tipo não encontrado ou sem permissão')
            logger.info(f"Tipo {tipo_id} excluído permanentemente")
            return response.data[0]
        return self._execute_with_retry(f"EXCLUIR_TIPO:{tipo_id}", operation)

    # =========================================================================
    # PACOTES
    # =========================================================================

    def _snapshot_valores_tipos(self, tipo_ids: List[str]) -> Dict[str, Decimal]:
        if not tipo_ids:
            return {}
        resp = self.supabase.table('tipos_profissional') \
            .select('id, valor_sessao') \
            .in_('id', tipo_ids) \
            .execute()
        return {row['id']: Decimal(str(row['valor_sessao'])) for row in (resp.data or [])}

    def listar_pacotes(self, clinica_id: str, ativo: Optional[bool] = None) -> List[Dict]:
        """Lista pacotes via RPC otimizada (única query com itens agregados)."""
        def operation():
            result = self.supabase.rpc('get_pacotes_lista', {
                'p_clinica_id': clinica_id,
                'p_ativo': ativo,
            }).execute()
            return result.data if result.data else []
        return self._execute_with_retry(f"LISTAR_PACOTES:{clinica_id}", operation)

    def buscar_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pacotes') \
                .select('*, pacientes(id, nome_completo), pacote_itens(*, tipos_profissional(id, nome), usuarios!profissional_id(id, nome_completo))') \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado')
            return self._enriquecer_pacote(response.data)
        return self._execute_with_retry(f"BUSCAR_PACOTE:{pacote_id}", operation)

    def _enriquecer_pacote(self, pacote: Dict) -> Dict:
        paciente = pacote.pop('pacientes', None)
        if paciente:
            pacote['paciente_nome'] = paciente.get('nome_completo')

        itens_raw = pacote.pop('pacote_itens', []) or []
        itens = []
        for item in itens_raw:
            tipo = item.pop('tipos_profissional', None) or {}
            prof = item.pop('usuarios', None)
            itens.append({
                'id': item.get('id'),
                'tipo_profissional_id': item.get('tipo_profissional_id'),
                'profissional_id': item.get('profissional_id'),
                'profissional_nome': prof.get('nome_completo') if prof else None,
                'tipo_nome': tipo.get('nome'),
                'quantidade_sessoes': item.get('quantidade_sessoes', 1),
                'valor_sessao': float(item.get('valor_sessao', 0)),
                'subtotal': float(item.get('subtotal', 0)),
            })
        pacote['itens'] = itens
        return pacote

    def criar_pacote(self, clinica_id: str, paciente_id: str, itens: List[Dict],
                     criado_por: str, observacoes: Optional[str] = None) -> Dict:
        def operation():
            tipo_ids = [it['tipo_profissional_id'] for it in itens]
            valores = self._snapshot_valores_tipos(tipo_ids)

            itens_payload = []
            valor_total = Decimal('0')
            for it in itens:
                vs = valores.get(it['tipo_profissional_id'], Decimal('0'))
                qt = int(it.get('quantidade_sessoes', 1))
                subtotal = vs * qt
                valor_total += subtotal
                item = {
                    'tipo_profissional_id': it['tipo_profissional_id'],
                    'quantidade_sessoes': qt,
                    'valor_sessao': float(vs),
                }
                if it.get('profissional_id'):
                    item['profissional_id'] = it['profissional_id']
                itens_payload.append(item)

            pacote_payload = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'valor_total': float(valor_total),
                'status': 'pendente',
                'ativo': True,
                'observacoes': observacoes,
                'criado_por': criado_por,
            }
            resp = self.supabase.table('pacotes').insert(pacote_payload).execute()
            if not resp.data:
                raise Exception('Erro ao criar pacote')
            pacote_id = resp.data[0]['id']

            for item in itens_payload:
                item['pacote_id'] = pacote_id
            self.supabase.table('pacote_itens').insert(itens_payload).execute()

            logger.info(f"Pacote criado: {pacote_id} para paciente {paciente_id}")
            return self.buscar_pacote(pacote_id, clinica_id)

        return self._execute_with_retry(f"CRIAR_PACOTE:{clinica_id}", operation)

    def atualizar_pacote(self, pacote_id: str, clinica_id: str, dados: Dict) -> Dict:
        def operation():
            finance_patch = {
                k: dados.pop(k)
                for k in list(dados.keys())
                if k in _FINANCE_PATCH_KEYS
            }

            itens = dados.pop('itens', None)

            if dados:
                self.supabase.table('pacotes') \
                    .update(dados) \
                    .eq('id', pacote_id) \
                    .eq('clinica_id', clinica_id) \
                    .execute()

            if itens is not None:
                self.supabase.table('pacote_itens') \
                    .delete() \
                    .eq('pacote_id', pacote_id) \
                    .execute()

                if itens:
                    tipo_ids = [it['tipo_profissional_id'] for it in itens]
                    valores = self._snapshot_valores_tipos(tipo_ids)

                    itens_payload = []
                    valor_total = Decimal('0')
                    for it in itens:
                        vs = valores.get(it['tipo_profissional_id'], Decimal('0'))
                        qt = int(it.get('quantidade_sessoes', 1))
                        valor_total += vs * qt
                        item = {
                            'pacote_id': pacote_id,
                            'tipo_profissional_id': it['tipo_profissional_id'],
                            'quantidade_sessoes': qt,
                            'valor_sessao': float(vs),
                        }
                        if it.get('profissional_id'):
                            item['profissional_id'] = it['profissional_id']
                        itens_payload.append(item)

                    self.supabase.table('pacote_itens').insert(itens_payload).execute()
                    self.supabase.table('pacotes') \
                        .update({'valor_total': float(valor_total)}) \
                        .eq('id', pacote_id) \
                        .execute()

            if finance_patch:
                self._aplicar_patch_financeiro(pacote_id, clinica_id, finance_patch)

            return self.buscar_pacote(pacote_id, clinica_id)

        return self._execute_with_retry(f"ATUALIZAR_PACOTE:{pacote_id}", operation)

    def _metodo_pgto_ok(self, m: Optional[str]) -> bool:
        return m in {'cartao', 'dinheiro', 'transferencia', 'pix', 'cheque'}

    def _ts_iso_ou_none(self, val) -> Optional[str]:
        if val is None or val == '':
            return None
        if isinstance(val, datetime):
            return val.isoformat()
        s = str(val).strip()
        if not s:
            return None
        if 'T' in s or ' ' in s:
            return s.replace(' ', 'T') if ' ' in s and 'T' not in s else s
        return f'{s[:10]}T12:00:00+00:00'

    def _date_pg_ou_none(self, val) -> Optional[str]:
        if val is None or val == '':
            return None
        if hasattr(val, 'isoformat'):
            return val.isoformat()[:10]
        s = str(val).strip()
        return s[:10] if s else None

    def _aplicar_patch_financeiro(self, pacote_id: str, clinica_id: str, patch: Dict) -> None:
        """Mescla patch com o registro atual e persiste, com validação por status."""
        if not patch:
            return

        cur = self.supabase.table('pacotes') \
            .select(
                'valor_total, status, valor_pago, metodo_pagamento, valor_entrada, '
                'metodo_pagamento_restante, data_prevista_pagamento_restante, '
                'metodo_pagamento_complemento, data_pagamento, data_complemento'
            ) \
            .eq('id', pacote_id) \
            .eq('clinica_id', clinica_id) \
            .single() \
            .execute()
        if not cur.data:
            raise ValueError('Pacote não encontrado')
        row = dict(cur.data)
        total = self._q2(Decimal(str(row.get('valor_total') or 0)))
        if total <= 0:
            raise ValueError('Valor total do pacote inválido para ajuste financeiro')

        keys = (
            'status', 'valor_pago', 'metodo_pagamento', 'valor_entrada',
            'metodo_pagamento_restante', 'data_prevista_pagamento_restante',
            'metodo_pagamento_complemento', 'data_pagamento', 'data_complemento',
        )
        merged = {}
        for k in keys:
            merged[k] = patch[k] if k in patch else row.get(k)

        st = (merged.get('status') or 'pendente')
        if st not in ('pendente', 'parcial', 'pago'):
            raise ValueError('Status financeiro inválido')

        if st == 'pendente':
            payload = {
                'status': 'pendente',
                'valor_pago': None,
                'metodo_pagamento': None,
                'data_pagamento': None,
                'valor_entrada': None,
                'metodo_pagamento_restante': None,
                'data_prevista_pagamento_restante': None,
                'data_complemento': None,
                'metodo_pagamento_complemento': None,
            }
        elif st == 'parcial':
            vp = self._q2(Decimal(str(merged.get('valor_pago') if merged.get('valor_pago') is not None else 0)))
            if vp <= 0 or vp >= total:
                raise ValueError('Parcial: valor pago deve ser maior que zero e menor que o total do pacote')
            m1 = merged.get('metodo_pagamento')
            if not self._metodo_pgto_ok(m1):
                raise ValueError('Informe a forma de pagamento da entrada')
            mr = merged.get('metodo_pagamento_restante')
            if not self._metodo_pgto_ok(mr):
                raise ValueError('Informe a forma prevista para o saldo restante')
            dprev = self._date_pg_ou_none(merged.get('data_prevista_pagamento_restante'))
            if not dprev:
                raise ValueError('Informe a data prevista para o saldo restante')
            ve_raw = merged.get('valor_entrada')
            if ve_raw is not None and str(ve_raw).strip() != '':
                ve = self._q2(Decimal(str(ve_raw)))
            else:
                ve = vp
            dpag = self._ts_iso_ou_none(merged.get('data_pagamento'))
            if not dpag:
                dpag = datetime.utcnow().isoformat()
            payload = {
                'status': 'parcial',
                'valor_pago': float(vp),
                'valor_entrada': float(ve),
                'metodo_pagamento': m1,
                'metodo_pagamento_restante': mr,
                'data_prevista_pagamento_restante': dprev,
                'data_pagamento': dpag,
                'data_complemento': None,
                'metodo_pagamento_complemento': None,
            }
        else:
            vp = self._q2(Decimal(str(merged.get('valor_pago') if merged.get('valor_pago') is not None else 0)))
            if vp != total:
                raise ValueError(
                    f'Quitado: valor pago deve ser igual ao total do pacote ({float(total):.2f})'
                )
            m1 = merged.get('metodo_pagamento')
            if not self._metodo_pgto_ok(m1):
                raise ValueError('Informe a forma de pagamento')
            ve_raw = merged.get('valor_entrada')
            ve = None
            if ve_raw is not None and str(ve_raw).strip() != '':
                ve = self._q2(Decimal(str(ve_raw)))
            dpag = self._ts_iso_ou_none(merged.get('data_pagamento'))
            if not dpag:
                dpag = datetime.utcnow().isoformat()
            dcomp = self._ts_iso_ou_none(merged.get('data_complemento'))
            mcomp = merged.get('metodo_pagamento_complemento')

            if ve is not None and 0 < ve < total:
                if not self._metodo_pgto_ok(mcomp):
                    raise ValueError('Pacote quitado em duas parcelas: informe o método da 2ª parcela')
                if not dcomp:
                    raise ValueError('Pacote quitado em duas parcelas: informe a data da 2ª parcela')
                payload = {
                    'status': 'pago',
                    'valor_pago': float(vp),
                    'valor_entrada': float(ve),
                    'metodo_pagamento': m1,
                    'metodo_pagamento_restante': None,
                    'data_prevista_pagamento_restante': None,
                    'data_pagamento': dpag,
                    'data_complemento': dcomp,
                    'metodo_pagamento_complemento': mcomp,
                }
            else:
                payload = {
                    'status': 'pago',
                    'valor_pago': float(vp),
                    'valor_entrada': None,
                    'metodo_pagamento': m1,
                    'metodo_pagamento_restante': None,
                    'data_prevista_pagamento_restante': None,
                    'data_pagamento': dpag,
                    'data_complemento': dcomp,
                    'metodo_pagamento_complemento': mcomp if self._metodo_pgto_ok(mcomp) else None,
                }

        resp = self.supabase.table('pacotes') \
            .update(payload) \
            .eq('id', pacote_id) \
            .eq('clinica_id', clinica_id) \
            .execute()
        if not resp.data:
            raise ValueError('Pacote não encontrado')
        logger.info(f"[PACOTE] patch financeiro aplicado {pacote_id} → {payload.get('status')}")

    def ativar_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pacotes') \
                .update({'ativo': True}) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            return response.data[0]
        return self._execute_with_retry(f"ATIVAR_PACOTE:{pacote_id}", operation)

    def desativar_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pacotes') \
                .update({'ativo': False}) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            return response.data[0]
        return self._execute_with_retry(f"DESATIVAR_PACOTE:{pacote_id}", operation)

    def excluir_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        """Exclui pacote permanentemente. Itens são removidos via CASCADE."""
        def operation():
            response = self.supabase.table('pacotes') \
                .delete() \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            logger.info(f"Pacote {pacote_id} excluído permanentemente")
            return response.data[0]
        return self._execute_with_retry(f"EXCLUIR_PACOTE:{pacote_id}", operation)

    # =========================================================================
    # PAGAMENTO (inline no pacote)
    # =========================================================================

    def _q2(self, d: Decimal) -> Decimal:
        return d.quantize(Decimal('0.01'))

    def marcar_pago(
        self,
        pacote_id: str,
        clinica_id: str,
        metodo_pagamento: str,
        valor_pago: Decimal,
        registrado_por: str,
        observacoes: Optional[str] = None,
        metodo_pagamento_restante: Optional[str] = None,
        data_prevista_pagamento_restante=None,
    ) -> Dict:
        def operation():
            cur = self.supabase.table('pacotes') \
                .select('id, status, valor_total, valor_pago, valor_entrada, data_pagamento') \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not cur.data:
                raise ValueError('Pacote não encontrado')
            row = cur.data
            st = row.get('status') or 'pendente'
            if st not in ('pendente', 'parcial'):
                raise ValueError('Somente pacotes pendentes ou parciais podem receber pagamento')
            total = self._q2(Decimal(str(row.get('valor_total') or 0)))
            if total <= 0:
                raise ValueError('Pacote sem valor total válido')

            now_iso = datetime.utcnow().isoformat()

            if st == 'parcial':
                atual = self._q2(Decimal(str(row.get('valor_pago') or 0)))
                add = self._q2(valor_pago)
                novo = self._q2(atual + add)
                restante_esperado = self._q2(total - atual)
                if add <= 0 or novo > total:
                    raise ValueError('Valor da quitação inválido para o saldo restante')
                if novo < total:
                    raise ValueError('Para pacote parcial, quite o saldo em uma única segunda parcela')
                if self._q2(add) != restante_esperado:
                    raise ValueError(
                        f'Valor deve ser exatamente o saldo restante ({float(restante_esperado):.2f})'
                    )
                payload = {
                    'status': 'pago',
                    'valor_pago': float(novo),
                    'metodo_pagamento_complemento': metodo_pagamento,
                    'data_complemento': now_iso,
                    'metodo_pagamento_restante': None,
                    'data_prevista_pagamento_restante': None,
                    'registrado_por': registrado_por,
                }
                if observacoes:
                    payload['observacoes'] = observacoes
            else:
                entrada = self._q2(valor_pago)
                if entrada <= 0 or entrada > total:
                    raise ValueError('Valor pago inválido')
                if entrada < total:
                    _metodos = {'cartao', 'dinheiro', 'transferencia', 'pix', 'cheque'}
                    if not metodo_pagamento_restante or metodo_pagamento_restante not in _metodos:
                        raise ValueError(
                            'Informe uma forma de pagamento válida para o saldo restante'
                        )
                    if data_prevista_pagamento_restante is None:
                        raise ValueError(
                            'Informe a data prevista para pagar o saldo restante'
                        )
                    payload = {
                        'status': 'parcial',
                        'metodo_pagamento': metodo_pagamento,
                        'valor_pago': float(entrada),
                        'valor_entrada': float(entrada),
                        'data_pagamento': now_iso,
                        'metodo_pagamento_restante': metodo_pagamento_restante,
                        'data_prevista_pagamento_restante': data_prevista_pagamento_restante.isoformat()
                        if hasattr(data_prevista_pagamento_restante, 'isoformat')
                        else str(data_prevista_pagamento_restante),
                        'data_complemento': None,
                        'metodo_pagamento_complemento': None,
                        'registrado_por': registrado_por,
                    }
                    if observacoes:
                        payload['observacoes'] = observacoes
                else:
                    payload = {
                        'status': 'pago',
                        'metodo_pagamento': metodo_pagamento,
                        'valor_pago': float(entrada),
                        'valor_entrada': None,
                        'data_pagamento': now_iso,
                        'metodo_pagamento_restante': None,
                        'data_prevista_pagamento_restante': None,
                        'data_complemento': None,
                        'metodo_pagamento_complemento': None,
                        'registrado_por': registrado_por,
                    }
                    if observacoes:
                        payload['observacoes'] = observacoes

            response = self.supabase.table('pacotes') \
                .update(payload) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado')
            logger.info(f"Pacote {pacote_id} pagamento atualizado → {payload.get('status')}")
            return response.data[0]
        return self._execute_with_retry(f"MARCAR_PAGO:{pacote_id}", operation)

    def marcar_pendente(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            payload = {
                'status': 'pendente',
                'metodo_pagamento': None,
                'valor_pago': None,
                'data_pagamento': None,
                'registrado_por': None,
                'valor_entrada': None,
                'metodo_pagamento_restante': None,
                'data_prevista_pagamento_restante': None,
                'data_complemento': None,
                'metodo_pagamento_complemento': None,
            }
            response = self.supabase.table('pacotes') \
                .update(payload) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado')
            logger.info(f"Pacote {pacote_id} marcado como pendente")
            return response.data[0]
        return self._execute_with_retry(f"MARCAR_PENDENTE:{pacote_id}", operation)

    # =========================================================================
    # PACOTE ATIVO POR PACIENTE + PROFISSIONAL
    # =========================================================================

    def buscar_pacote_ativo_por_profissional(
        self, clinica_id: str, paciente_id: str, profissional_id: str
    ) -> Optional[Dict]:
        """Retorna o pacote pago e ativo do paciente para o profissional dado,
        com sessoes_utilizadas e sessoes_restantes via RPC."""
        def operation():
            result = self.supabase.rpc(
                'get_pacote_ativo_por_paciente_profissional',
                {
                    'p_clinica_id': clinica_id,
                    'p_paciente_id': paciente_id,
                    'p_profissional_id': profissional_id,
                }
            ).execute()
            return result.data  # None se não encontrado
        return self._execute_with_retry(
            f"PACOTE_ATIVO:{paciente_id}:{profissional_id}", operation
        )

    # =========================================================================
    # ESTATÍSTICAS
    # =========================================================================

    def obter_estatisticas(self, clinica_id: str) -> Dict:
        def operation():
            result = self.supabase.rpc('get_estatisticas_pacotes', {
                'p_clinica_id': clinica_id,
            }).execute()
            stats = result.data or {}
            return {
                'total_pacotes_ativos':        int(stats.get('total_pacotes_ativos', 0)),
                'total_pagamentos_pendentes':  int(stats.get('total_pagamentos_pendentes', 0)),
                'total_pacotes_parcial':       int(stats.get('total_pacotes_parcial', 0)),
                'valor_total_pendente':        float(stats.get('valor_total_pendente', 0)),
                'valor_total_recebido':        float(stats.get('valor_total_recebido', 0)),
                'valor_saldo_aberto_parcial':  float(stats.get('valor_saldo_aberto_parcial', 0)),
            }
        return self._execute_with_retry(f"ESTATISTICAS_PACOTES:{clinica_id}", operation)

    def obter_resumo_financeiro_pacotes(
        self, clinica_id: str, data_inicio: str, data_fim: str
    ) -> Dict:
        def operation():
            result = self.supabase.rpc('get_resumo_financeiro_pacotes', {
                'p_clinica_id': clinica_id,
                'p_data_inicio': data_inicio,
                'p_data_fim': data_fim,
            }).execute()
            return result.data if isinstance(result.data, dict) else {}
        return self._execute_with_retry(
            f"RESUMO_FIN_PACOTES:{clinica_id}:{data_inicio}:{data_fim}", operation
        )
