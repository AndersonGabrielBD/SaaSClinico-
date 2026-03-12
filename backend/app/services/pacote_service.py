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
            return response.data or []
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
            return response.data
        return self._execute_with_retry(f"BUSCAR_TIPO:{tipo_id}", operation)

    def criar_tipo(self, clinica_id: str, nome: str, valor_mensal: Decimal) -> Dict:
        def operation():
            payload = {
                'clinica_id': clinica_id,
                'nome': nome.strip(),
                'valor_mensal': float(valor_mensal),
                'ativo': True,
            }
            response = self.supabase.table('tipos_profissional').insert(payload).execute()
            if not response.data:
                raise Exception('Erro ao criar tipo de profissional')
            logger.info(f"✅ Tipo criado: {nome} - R$ {valor_mensal}")
            return response.data[0]
        return self._execute_with_retry(f"CRIAR_TIPO:{clinica_id}", operation)

    def atualizar_tipo(self, tipo_id: str, clinica_id: str, dados: Dict) -> Dict:
        def operation():
            if 'valor_mensal' in dados:
                dados['valor_mensal'] = float(dados['valor_mensal'])
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
        """Exclui permanentemente um tipo de profissional.
        Retorna erro se houver pacotes vinculados (integridade referencial).
        """
        def operation():
            # Verifica vínculos antes de excluir
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
            vm = Decimal(str(item.get('valor_mensal', 0)))
            qt = int(item.get('quantidade', 1))
            total += vm * qt
        return total

    def _snapshot_valores_tipos(self, tipo_ids: List[str]) -> Dict[str, Decimal]:
        """Busca os valores atuais dos tipos em uma única query e retorna um mapa {id: valor_mensal}."""
        if not tipo_ids:
            return {}
        resp = self.supabase.table('tipos_profissional') \
            .select('id, valor_mensal') \
            .in_('id', tipo_ids) \
            .execute()
        return {row['id']: Decimal(str(row['valor_mensal'])) for row in (resp.data or [])}

    def _enriquecer_pacote(self, pacote: Dict) -> Dict:
        """Adiciona paciente_nome, itens com tipo e valor_total ao pacote.
        Usa valor_mensal armazenado no item (snapshot do momento da criação/edição),
        não o valor atual do tipo.
        """
        paciente_data = pacote.pop('pacientes', None)
        if paciente_data:
            pacote['paciente_nome'] = paciente_data.get('nome_completo')

        itens_raw = pacote.pop('pacotes_pacientes_itens', []) or []
        itens = []
        for item in itens_raw:
            tipo = item.pop('tipos_profissional', None) or {}
            qt = int(item.get('quantidade', 1))
            # Prioridade: valor_mensal salvo no item (snapshot histórico)
            # Fallback para o valor atual do tipo (itens antigos sem snapshot)
            stored_vm = item.get('valor_mensal')
            vm = Decimal(str(stored_vm)) if stored_vm is not None else Decimal(str(tipo.get('valor_mensal', 0)))
            itens.append({
                'id': item.get('id'),
                'tipo_profissional_id': item.get('tipo_profissional_id'),
                'quantidade': qt,
                'tipo_nome': tipo.get('nome'),
                'valor_mensal': float(vm),
                'subtotal': float(vm * qt),
            })
        pacote['itens'] = itens
        pacote['valor_total'] = float(self._calcular_valor_total(
            [{'valor_mensal': i['valor_mensal'], 'quantidade': i['quantidade']} for i in itens]
        ))
        return pacote

    # Select que inclui valor_mensal armazenado no item (snapshot histórico) e nome do tipo
    _PACOTE_SELECT = (
        '*, '
        'pacientes(id, nome_completo), '
        'pacotes_pacientes_itens(id, tipo_profissional_id, quantidade, valor_mensal, '
        'tipos_profissional(id, nome))'
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
        """Monta a lista de itens incluindo o snapshot do valor_mensal atual do tipo."""
        tipo_ids = [it['tipo_profissional_id'] for it in itens]
        valores = self._snapshot_valores_tipos(tipo_ids)
        return [
            {
                'pacote_id': pacote_id,
                'tipo_profissional_id': it['tipo_profissional_id'],
                'quantidade': it.get('quantidade', 1),
                'valor_mensal': float(valores.get(it['tipo_profissional_id'], Decimal('0'))),
            }
            for it in itens
        ]

    def criar_pacote(
        self,
        clinica_id: str,
        paciente_id: str,
        dia_vencimento: int,
        itens: List[Dict],
        criado_por: str,
        observacoes: Optional[str] = None,
    ) -> Dict:
        def operation():
            pacote_payload = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'dia_vencimento': dia_vencimento,
                'ativo': True,
                'observacoes': observacoes,
                'criado_por': criado_por,
            }
            resp = self.supabase.table('pacotes_pacientes').insert(pacote_payload).execute()
            if not resp.data:
                raise Exception('Erro ao criar pacote')
            pacote_id = resp.data[0]['id']

            # Inserir itens com snapshot do valor_mensal vigente
            itens_payload = self._montar_itens_com_snapshot(pacote_id, itens)
            self.supabase.table('pacotes_pacientes_itens').insert(itens_payload).execute()

            logger.info(f"✅ Pacote criado: {pacote_id} para paciente {paciente_id} (preços fixados no momento da criação)")
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
                # Substituir itens: deletar antigos e inserir novos com snapshot atual
                self.supabase.table('pacotes_pacientes_itens') \
                    .delete() \
                    .eq('pacote_id', pacote_id) \
                    .execute()
                if itens:
                    novos = self._montar_itens_com_snapshot(pacote_id, itens)
                    self.supabase.table('pacotes_pacientes_itens').insert(novos).execute()

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

    # =========================================================================
    # PAGAMENTOS DE PACOTES
    # =========================================================================

    def _calcular_valor_pacote_db(self, pacote_id: str) -> Decimal:
        """Calcula valor total do pacote usando o valor_mensal fixado no item (snapshot histórico)."""
        resp = self.supabase.table('pacotes_pacientes_itens') \
            .select('quantidade, valor_mensal') \
            .eq('pacote_id', pacote_id) \
            .execute()
        total = Decimal('0')
        for item in (resp.data or []):
            vm = Decimal(str(item.get('valor_mensal') or 0))
            qt = int(item.get('quantidade', 1))
            total += vm * qt
        return total

    def gerar_pagamentos_mes_corrente(self, clinica_id: str) -> int:
        """Gera registros de pagamento do mês atual para todos os pacotes ativos."""
        def operation():
            hoje = today_brazil()
            mes_ref = date(hoje.year, hoje.month, 1)
            ultimo_dia = calendar.monthrange(hoje.year, hoje.month)[1]

            pacotes = self.supabase.table('pacotes_pacientes') \
                .select('id, paciente_id, dia_vencimento') \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()

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
            hoje = today_brazil()
            mes_ref = date(hoje.year, hoje.month, 1).isoformat()

            pacotes_ativos = self.supabase.table('pacotes_pacientes') \
                .select('id', count='exact') \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()

            pags_mes = self.supabase.table('pagamentos_pacotes') \
                .select('status, valor_pago') \
                .eq('clinica_id', clinica_id) \
                .eq('mes_referencia', mes_ref) \
                .execute()

            total_pendente = Decimal('0')
            total_recebido = Decimal('0')
            total_pag = len(pags_mes.data or [])
            pendentes = 0
            for p in (pags_mes.data or []):
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
