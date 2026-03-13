# filepath: backend/app/services/pacote_service.py
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional
from database.supabase_client import get_supabase_client
from app.utils.date_utils import today_brazil, start_of_month_brazil
import time
import calendar

logger = logging.getLogger(__name__)


class PacoteService:
    """Serviço para gerenciar tipos de profissional, pacotes e seus pagamentos"""

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
                    logger.info(f"🔄 [PACOTE] {operation_name} - Tentativa {attempt + 1}")
                self.supabase = self._get_client()
                result = operation_func()
                return result
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                should_retry = any(k in error_msg for k in [
                    'connection', 'timeout', 'temporary', 'unavailable', 'network',
                    '500', '502', '503'
                ])
                if should_retry and attempt < self.max_retries:
                    logger.warning(f"⚠️ [PACOTE] {operation_name} - tentativa {attempt + 1}: {e}")
                    time.sleep(self.retry_delay)
                else:
                    logger.error(f"❌ [PACOTE] {operation_name} - erro final: {e}")
                    break
        raise last_error if last_error else Exception(f"Erro desconhecido em {operation_name}")

    # =========================================================================
    # PROFISSIONAIS DISPONÍVEIS
    # =========================================================================

    def listar_profissionais(self, clinica_id: str) -> List[Dict]:
        """Lista usuários com papel de profissional na clínica (para vincular a tipos/pacotes)."""
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
                .select('*, usuarios!profissional_id(id, nome_completo)') \
                .eq('clinica_id', clinica_id) \
                .order('nome')
            if ativo is not None:
                query = query.eq('ativo', ativo)
            response = query.execute()
            result = []
            for row in (response.data or []):
                profissional = row.pop('usuarios', None)
                if profissional:
                    row['profissional_nome'] = profissional.get('nome_completo')
                else:
                    row['profissional_nome'] = None
                # Normaliza campo de valor
                if row.get('valor_sessao') is None and row.get('valor_mensal') is not None:
                    row['valor_sessao'] = row['valor_mensal']
                result.append(row)
            return result
        return self._execute_with_retry(f"LISTAR_TIPOS:{clinica_id}", operation)

    def buscar_tipo(self, tipo_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('tipos_profissional') \
                .select('*, usuarios!profissional_id(id, nome_completo)') \
                .eq('id', tipo_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Tipo de profissional não encontrado')
            row = response.data
            profissional = row.pop('usuarios', None)
            row['profissional_nome'] = profissional.get('nome_completo') if profissional else None
            if row.get('valor_sessao') is None and row.get('valor_mensal') is not None:
                row['valor_sessao'] = row['valor_mensal']
            return row
        return self._execute_with_retry(f"BUSCAR_TIPO:{tipo_id}", operation)

    def criar_tipo(self, clinica_id: str, nome: str, valor_sessao: Decimal,
                   profissional_id: Optional[str] = None) -> Dict:
        def operation():
            payload = {
                'clinica_id': clinica_id,
                'nome': nome.strip(),
                'valor_sessao': float(valor_sessao),
                'valor_mensal': float(valor_sessao),  # backward compat
                'ativo': True,
            }
            if profissional_id:
                payload['profissional_id'] = profissional_id
            response = self.supabase.table('tipos_profissional').insert(payload).execute()
            if not response.data:
                raise Exception('Erro ao criar tipo de profissional')
            logger.info(f"✅ Tipo criado: {nome} - R$ {valor_sessao}/sessão")
            return response.data[0]
        return self._execute_with_retry(f"CRIAR_TIPO:{clinica_id}", operation)

    def atualizar_tipo(self, tipo_id: str, clinica_id: str, dados: Dict) -> Dict:
        def operation():
            if 'valor_sessao' in dados:
                dados['valor_sessao'] = float(dados['valor_sessao'])
                dados['valor_mensal'] = dados['valor_sessao']  # backward compat
            if 'valor_mensal' in dados and 'valor_sessao' not in dados:
                dados['valor_sessao'] = float(dados['valor_mensal'])
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
            vinculados = self.supabase.table('pacotes_pacientes_itens') \
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
            logger.info(f"🗑️ Tipo {tipo_id} excluído permanentemente")
            return response.data[0]
        return self._execute_with_retry(f"EXCLUIR_TIPO:{tipo_id}", operation)

    # =========================================================================
    # PACOTES POR PACIENTE
    # =========================================================================

    def _calcular_valor_total(self, itens: List[Dict]) -> Decimal:
        total = Decimal('0')
        for item in itens:
            vs = Decimal(str(item.get('valor_sessao') or item.get('valor_mensal') or 0))
            qt = int(item.get('quantidade_sessoes') or item.get('quantidade') or 1)
            total += vs * qt
        return total

    def _snapshot_valores_tipos(self, tipo_ids: List[str]) -> Dict[str, Decimal]:
        """Busca os valores atuais dos tipos e retorna {id: valor_sessao}."""
        if not tipo_ids:
            return {}
        resp = self.supabase.table('tipos_profissional') \
            .select('id, valor_sessao, valor_mensal') \
            .in_('id', tipo_ids) \
            .execute()
        result = {}
        for row in (resp.data or []):
            vs = row.get('valor_sessao') or row.get('valor_mensal') or 0
            result[row['id']] = Decimal(str(vs))
        return result

    def _enriquecer_pacote(self, pacote: Dict) -> Dict:
        """Adiciona paciente_nome, itens enriquecidos e valor_total ao pacote."""
        paciente_data = pacote.pop('pacientes', None)
        if paciente_data:
            pacote['paciente_nome'] = paciente_data.get('nome_completo')

        itens_raw = pacote.pop('pacotes_pacientes_itens', []) or []
        itens = []
        for item in itens_raw:
            tipo = item.pop('tipos_profissional', None) or {}
            profissional = item.pop('usuarios', None)

            qt = int(item.get('quantidade_sessoes') or item.get('quantidade') or 1)

            # Valor da sessão: snapshot armazenado → fallback valor atual do tipo
            stored_vs = item.get('valor_sessao') or item.get('valor_mensal')
            vs = Decimal(str(stored_vs)) if stored_vs is not None \
                else Decimal(str(tipo.get('valor_sessao') or tipo.get('valor_mensal') or 0))

            profissional_nome = None
            if profissional:
                profissional_nome = profissional.get('nome_completo')
            elif item.get('profissional_id'):
                # fallback — nome não disponível aqui
                profissional_nome = None

            itens.append({
                'id': item.get('id'),
                'tipo_profissional_id': item.get('tipo_profissional_id'),
                'profissional_id': item.get('profissional_id'),
                'profissional_nome': profissional_nome,
                'quantidade_sessoes': qt,
                'tipo_nome': tipo.get('nome'),
                'valor_sessao': float(vs),
                'subtotal': float(vs * qt),
                # backward compat
                'quantidade': qt,
                'valor_mensal': float(vs),
            })
        pacote['itens'] = itens
        pacote['valor_total'] = float(self._calcular_valor_total(
            [{'valor_sessao': i['valor_sessao'], 'quantidade_sessoes': i['quantidade_sessoes']} for i in itens]
        ))
        return pacote

    _PACOTE_SELECT = (
        '*, '
        'pacientes(id, nome_completo), '
        'pacotes_pacientes_itens('
        '  id, tipo_profissional_id, profissional_id, quantidade_sessoes, quantidade, '
        '  valor_sessao, valor_mensal, '
        '  tipos_profissional(id, nome), '
        '  usuarios!profissional_id(id, nome_completo)'
        ')'
    )

    def listar_pacotes(self, clinica_id: str, ativo: Optional[bool] = None) -> List[Dict]:
        def operation():
            query = self.supabase.table('pacotes_pacientes') \
                .select(self._PACOTE_SELECT) \
                .eq('clinica_id', clinica_id) \
                .order('data_criacao', desc=True)
            if ativo is not None:
                query = query.eq('ativo', ativo)
            response = query.execute()
            return [self._enriquecer_pacote(p) for p in (response.data or [])]
        return self._execute_with_retry(f"LISTAR_PACOTES:{clinica_id}", operation)

    def buscar_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pacotes_pacientes') \
                .select(self._PACOTE_SELECT) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado')
            return self._enriquecer_pacote(response.data)
        return self._execute_with_retry(f"BUSCAR_PACOTE:{pacote_id}", operation)

    def buscar_pacote_por_paciente(self, paciente_id: str, clinica_id: str) -> Optional[Dict]:
        def operation():
            response = self.supabase.table('pacotes_pacientes') \
                .select(self._PACOTE_SELECT) \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id) \
                .limit(1) \
                .execute()
            if not response.data:
                return None
            return self._enriquecer_pacote(response.data[0])
        return self._execute_with_retry(f"BUSCAR_PACOTE_PACIENTE:{paciente_id}", operation)

    def _montar_itens_com_snapshot(self, pacote_id: str, itens: List[Dict]) -> List[Dict]:
        """Monta itens incluindo snapshot do valor_sessao atual do tipo."""
        tipo_ids = [it['tipo_profissional_id'] for it in itens]
        valores = self._snapshot_valores_tipos(tipo_ids)
        result = []
        for it in itens:
            vs = float(valores.get(it['tipo_profissional_id'], Decimal('0')))
            qt = int(it.get('quantidade_sessoes') or it.get('quantidade') or 1)
            item = {
                'pacote_id': pacote_id,
                'tipo_profissional_id': it['tipo_profissional_id'],
                'quantidade_sessoes': qt,
                'quantidade': qt,  # backward compat
                'valor_sessao': vs,
                'valor_mensal': vs,  # backward compat
            }
            if it.get('profissional_id'):
                item['profissional_id'] = it['profissional_id']
            result.append(item)
        return result

    def criar_pacote(
        self,
        clinica_id: str,
        paciente_id: str,
        itens: List[Dict],
        criado_por: str,
        dia_vencimento: Optional[int] = None,
        observacoes: Optional[str] = None,
    ) -> Dict:
        def operation():
            pacote_payload = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'ativo': True,
                'observacoes': observacoes,
                'criado_por': criado_por,
            }
            if dia_vencimento:
                pacote_payload['dia_vencimento'] = dia_vencimento

            resp = self.supabase.table('pacotes_pacientes').insert(pacote_payload).execute()
            if not resp.data:
                raise Exception('Erro ao criar pacote')
            pacote_id = resp.data[0]['id']

            itens_payload = self._montar_itens_com_snapshot(pacote_id, itens)
            self.supabase.table('pacotes_pacientes_itens').insert(itens_payload).execute()

            # Cria registro de pagamento pendente automaticamente
            total = float(self._calcular_valor_total([
                {'valor_sessao': it['valor_sessao'], 'quantidade_sessoes': it['quantidade_sessoes']}
                for it in itens_payload
            ]))
            hoje = today_brazil()
            pag_payload = {
                'clinica_id': clinica_id,
                'pacote_id': pacote_id,
                'paciente_id': paciente_id,
                'status': 'pendente',
                'data_vencimento': hoje.isoformat(),
                'valor_pago': total,
            }
            self.supabase.table('pagamentos_pacotes').insert(pag_payload).execute()

            logger.info(f"✅ Pacote criado: {pacote_id} para paciente {paciente_id}")
            return self.buscar_pacote(pacote_id, clinica_id)

        return self._execute_with_retry(f"CRIAR_PACOTE:{clinica_id}", operation)

    def atualizar_pacote(self, pacote_id: str, clinica_id: str, dados: Dict) -> Dict:
        def operation():
            itens = dados.pop('itens', None)
            if dados:
                self.supabase.table('pacotes_pacientes') \
                    .update(dados) \
                    .eq('id', pacote_id) \
                    .eq('clinica_id', clinica_id) \
                    .execute()

            if itens is not None:
                self.supabase.table('pacotes_pacientes_itens') \
                    .delete() \
                    .eq('pacote_id', pacote_id) \
                    .execute()
                if itens:
                    novos = self._montar_itens_com_snapshot(pacote_id, itens)
                    self.supabase.table('pacotes_pacientes_itens').insert(novos).execute()

                    # Atualiza o pagamento pendente com novo valor total
                    novo_total = float(self._calcular_valor_total([
                        {'valor_sessao': it['valor_sessao'], 'quantidade_sessoes': it['quantidade_sessoes']}
                        for it in novos
                    ]))
                    pag_pendente = self.supabase.table('pagamentos_pacotes') \
                        .select('id') \
                        .eq('pacote_id', pacote_id) \
                        .eq('status', 'pendente') \
                        .execute()
                    if pag_pendente.data:
                        self.supabase.table('pagamentos_pacotes') \
                            .update({'valor_pago': novo_total}) \
                            .eq('id', pag_pendente.data[0]['id']) \
                            .execute()

            return self.buscar_pacote(pacote_id, clinica_id)

        return self._execute_with_retry(f"ATUALIZAR_PACOTE:{pacote_id}", operation)

    def desativar_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pacotes_pacientes') \
                .update({'ativo': False}) \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            return response.data[0]
        return self._execute_with_retry(f"DESATIVAR_PACOTE:{pacote_id}", operation)

    def excluir_pacote(self, pacote_id: str, clinica_id: str) -> Dict:
        """Exclui permanentemente o pacote e registros relacionados (pagamentos, itens)."""
        def operation():
            # Garante que o pacote pertence à clínica
            pacote = self.supabase.table('pacotes_pacientes') \
                .select('id') \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not pacote.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            # Remove pagamentos do pacote
            self.supabase.table('pagamentos_pacotes') \
                .delete() \
                .eq('pacote_id', pacote_id) \
                .execute()
            # Remove itens do pacote
            self.supabase.table('pacotes_pacientes_itens') \
                .delete() \
                .eq('pacote_id', pacote_id) \
                .execute()
            # Remove o pacote
            response = self.supabase.table('pacotes_pacientes') \
                .delete() \
                .eq('id', pacote_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pacote não encontrado ou sem permissão')
            logger.info(f"🗑️ Pacote {pacote_id} excluído permanentemente")
            return response.data[0]
        return self._execute_with_retry(f"EXCLUIR_PACOTE:{pacote_id}", operation)

    # =========================================================================
    # PAGAMENTOS DE PACOTES
    # =========================================================================

    def _calcular_valor_pacote_db(self, pacote_id: str) -> Decimal:
        resp = self.supabase.table('pacotes_pacientes_itens') \
            .select('quantidade_sessoes, quantidade, valor_sessao, valor_mensal') \
            .eq('pacote_id', pacote_id) \
            .execute()
        total = Decimal('0')
        for item in (resp.data or []):
            vs = Decimal(str(item.get('valor_sessao') or item.get('valor_mensal') or 0))
            qt = int(item.get('quantidade_sessoes') or item.get('quantidade') or 1)
            total += vs * qt
        return total

    def gerar_pagamentos_mes_corrente(self, clinica_id: str) -> int:
        """Mantido para compatibilidade — não usado na nova lógica de sessões."""
        def operation():
            hoje = today_brazil()
            mes_ref = date(hoje.year, hoje.month, 1)

            pacotes = self.supabase.table('pacotes_pacientes') \
                .select('id, paciente_id, dia_vencimento') \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .not_.is_('dia_vencimento', 'null') \
                .execute()

            ultimo_dia = 31
            import calendar as cal
            ultimo_dia = cal.monthrange(hoje.year, hoje.month)[1]

            criados = 0
            for p in (pacotes.data or []):
                pacote_id = p['id']
                paciente_id = p['paciente_id']
                dia_ven = min(int(p['dia_vencimento']), ultimo_dia)
                data_ven = date(hoje.year, hoje.month, dia_ven)
                valor = float(self._calcular_valor_pacote_db(pacote_id))

                existe = self.supabase.table('pagamentos_pacotes') \
                    .select('id') \
                    .eq('pacote_id', pacote_id) \
                    .eq('mes_referencia', mes_ref.isoformat()) \
                    .execute()

                if not existe.data:
                    payload = {
                        'clinica_id': clinica_id,
                        'pacote_id': pacote_id,
                        'paciente_id': paciente_id,
                        'mes_referencia': mes_ref.isoformat(),
                        'status': 'pendente',
                        'data_vencimento': data_ven.isoformat(),
                        'valor_pago': valor,
                    }
                    self.supabase.table('pagamentos_pacotes').insert(payload).execute()
                    criados += 1

            logger.info(f"✅ {criados} pagamentos de pacotes gerados para {clinica_id}")
            return criados

        return self._execute_with_retry(f"GERAR_PAGAMENTOS_PACOTES:{clinica_id}", operation)

    def listar_pagamentos(self, clinica_id: str, filters: Dict) -> List[Dict]:
        def operation():
            query = self.supabase.table('pagamentos_pacotes') \
                .select('*, pacientes(id, nome_completo)') \
                .eq('clinica_id', clinica_id) \
                .order('data_vencimento')

            if filters.get('status'):
                query = query.eq('status', filters['status'])
            if filters.get('mes_referencia'):
                query = query.eq('mes_referencia', filters['mes_referencia'])
            if filters.get('paciente_id'):
                query = query.eq('paciente_id', filters['paciente_id'])
            if filters.get('pacote_id'):
                query = query.eq('pacote_id', filters['pacote_id'])

            response = query.execute()
            result = []
            for item in (response.data or []):
                paciente = item.pop('pacientes', None)
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                result.append(item)
            return result

        return self._execute_with_retry(f"LISTAR_PAG_PACOTES:{clinica_id}", operation)

    def buscar_pagamento(self, pagamento_id: str, clinica_id: str) -> Dict:
        def operation():
            response = self.supabase.table('pagamentos_pacotes') \
                .select('*, pacientes(id, nome_completo)') \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            if not response.data:
                raise ValueError('Pagamento não encontrado')
            item = response.data
            paciente = item.pop('pacientes', None)
            if paciente:
                item['paciente_nome'] = paciente.get('nome_completo')
            return item
        return self._execute_with_retry(f"BUSCAR_PAG_PACOTE:{pagamento_id}", operation)

    def marcar_pagamento_pago(
        self,
        pagamento_id: str,
        clinica_id: str,
        metodo_pagamento: str,
        valor_pago: Decimal,
        registrado_por: str,
        data_pagamento: Optional[datetime] = None,
        observacoes: Optional[str] = None,
    ) -> Dict:
        def operation():
            dp = data_pagamento or datetime.utcnow()
            payload = {
                'status': 'pago',
                'metodo_pagamento': metodo_pagamento,
                'valor_pago': float(valor_pago),
                'data_pagamento': dp.isoformat(),
                'registrado_por': registrado_por,
            }
            if observacoes:
                payload['observacoes'] = observacoes
            response = self.supabase.table('pagamentos_pacotes') \
                .update(payload) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pagamento não encontrado')
            return response.data[0]
        return self._execute_with_retry(f"MARCAR_PAGO_PACOTE:{pagamento_id}", operation)

    def marcar_pagamento_pendente(self, pagamento_id: str, clinica_id: str) -> Dict:
        def operation():
            payload = {
                'status': 'pendente',
                'metodo_pagamento': None,
                'data_pagamento': None,
                'registrado_por': None,
            }
            response = self.supabase.table('pagamentos_pacotes') \
                .update(payload) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pagamento não encontrado')
            return response.data[0]
        return self._execute_with_retry(f"MARCAR_PENDENTE_PACOTE:{pagamento_id}", operation)

    def alterar_data_vencimento(self, pagamento_id: str, clinica_id: str, nova_data: date) -> Dict:
        def operation():
            response = self.supabase.table('pagamentos_pacotes') \
                .update({'data_vencimento': nova_data.isoformat()}) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            if not response.data:
                raise ValueError('Pagamento não encontrado')
            return response.data[0]
        return self._execute_with_retry(f"ALTERAR_VENC_PACOTE:{pagamento_id}", operation)

    def obter_estatisticas(self, clinica_id: str) -> Dict:
        def operation():
            pacotes_ativos = self.supabase.table('pacotes_pacientes') \
                .select('id', count='exact') \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()

            pags = self.supabase.table('pagamentos_pacotes') \
                .select('status, valor_pago') \
                .eq('clinica_id', clinica_id) \
                .execute()

            total_pendente = Decimal('0')
            total_recebido = Decimal('0')
            total_pag = len(pags.data or [])
            pendentes = 0
            for p in (pags.data or []):
                vp = Decimal(str(p.get('valor_pago') or 0))
                if p.get('status') == 'pago':
                    total_recebido += vp
                else:
                    total_pendente += vp
                    pendentes += 1

            return {
                'total_pacotes_ativos': pacotes_ativos.count or 0,
                'total_pagamentos_pendentes': pendentes,
                'total_pagamentos_mes_atual': total_pag,
                'valor_total_pendente': float(total_pendente),
                'valor_total_recebido_mes': float(total_recebido),
            }

        return self._execute_with_retry(f"ESTATISTICAS_PACOTES:{clinica_id}", operation)
