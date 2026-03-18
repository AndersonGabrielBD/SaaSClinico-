import logging
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Optional
from database.supabase_client import get_supabase_client
import time

logger = logging.getLogger(__name__)


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
            query = self.supabase.table('tipos_profissional') \
                .select('*') \
                .eq('clinica_id', clinica_id) \
                .order('nome')
            if ativo is not None:
                query = query.eq('ativo', ativo)
            response = query.execute()
            result = []
            for row in (response.data or []):
                prof = row.pop('usuarios', None)
                row['profissional_nome'] = prof.get('nome_completo') if prof else None
                result.append(row)
            return result
        return self._execute_with_retry(f"LISTAR_TIPOS:{clinica_id}", operation)

    def buscar_tipo(self, tipo_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('tipos_profissional') \
                .select('*, usuarios(id, nome_completo)') \
                .eq('id', tipo_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Tipo de profissional não encontrado')
            row = response.data
            prof = row.pop('usuarios', None)
            row['profissional_nome'] = prof.get('nome_completo') if prof else None
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

            return self.buscar_pacote(pacote_id, clinica_id)

        return self._execute_with_retry(f"ATUALIZAR_PACOTE:{pacote_id}", operation)

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

    def marcar_pago(self, pacote_id: str, clinica_id: str,
                    metodo_pagamento: str, valor_pago: Decimal,
                    registrado_por: str, observacoes: Optional[str] = None) -> Dict:
        def operation():
            payload = {
                'status': 'pago',
                'metodo_pagamento': metodo_pagamento,
                'valor_pago': float(valor_pago),
                'data_pagamento': datetime.utcnow().isoformat(),
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
            logger.info(f"Pacote {pacote_id} marcado como pago")
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
                'total_pacotes_ativos':       int(stats.get('total_pacotes_ativos', 0)),
                'total_pagamentos_pendentes': int(stats.get('total_pagamentos_pendentes', 0)),
                'valor_total_pendente':       float(stats.get('valor_total_pendente', 0)),
                'valor_total_recebido':       float(stats.get('valor_total_recebido', 0)),
            }
        return self._execute_with_retry(f"ESTATISTICAS_PACOTES:{clinica_id}", operation)
