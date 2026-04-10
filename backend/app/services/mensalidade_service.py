# filepath: backend/app/services/mensalidade_service.py
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional
from database.supabase_client import get_supabase_client
from app.utils.date_utils import today_brazil, start_of_month_brazil
import time

logger = logging.getLogger(__name__)


class MensalidadeService:
    """Serviço para gerenciar mensalidades e pagamentos com retry automático"""
    
    def __init__(self):
        # Cria um cliente fresco na instanciação (cada route cria um serviço novo por request)
        self.supabase = get_supabase_client()
        self.max_retries = 2
        self.retry_delay = 0.5

    def _get_client(self):
        """Retorna um cliente Supabase fresco para cada operação."""
        return get_supabase_client()
    
    def _execute_with_retry(self, operation_name, operation_func):
        """Executa operação com retry automático"""
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"🔄 [SERVICE] {operation_name} - Tentativa {attempt + 1}/{self.max_retries + 1}")
                # Sempre cria cliente fresco para cada tentativa
                self.supabase = self._get_client()

                result = operation_func()
                
                if attempt > 0:
                    logger.info(f"✅ [SERVICE] {operation_name} - Sucesso após retry")
                
                return result
                
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                
                should_retry = any([
                    'connection' in error_msg,
                    'timeout' in error_msg,
                    'temporary' in error_msg,
                    'unavailable' in error_msg,
                    'network' in error_msg,
                    '500' in error_msg,
                    '502' in error_msg,
                    '503' in error_msg,
                ])
                
                if should_retry and attempt < self.max_retries:
                    logger.warning(f"⚠️ [SERVICE] {operation_name} - Erro (tentativa {attempt + 1}): {str(e)}")
                    time.sleep(self.retry_delay)
                else:
                    logger.error(f"❌ [SERVICE] {operation_name} - Erro final: {str(e)}")
                    break
        
        raise last_error if last_error else Exception(f"Erro desconhecido em {operation_name}")

    def _profissional_embed(self) -> str:
        """Nome do FK para embed PostgREST (usuarios.profissional_id)."""
        return 'profissional:usuarios!mensalidades_pacientes_profissional_id_fkey(nome_completo)'

    def _validar_profissional_clinica(self, profissional_id: Optional[str], clinica_id: str) -> None:
        """Garante que o profissional existe na clínica e tem papel adequado."""
        if not profissional_id:
            return
        response = self.supabase.table('usuarios') \
            .select('id, role') \
            .eq('id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .limit(1) \
            .execute()
        rows = response.data or []
        if not rows:
            raise ValueError('Profissional não encontrado ou inativo nesta clínica')
        row = rows[0]
        if row.get('role') not in ('fono', 'medico', 'profissional'):
            raise ValueError('Usuário selecionado não é um profissional válido')

    def _existe_mensalidade_ativa_duplicada(
        self,
        clinica_id: str,
        paciente_id: str,
        profissional_id: Optional[str],
        excluir_mensalidade_id: Optional[str] = None,
    ) -> bool:
        """Uma mensalidade ativa por (paciente, profissional); profissional None = legado (sem vínculo)."""
        response = self.supabase.table('mensalidades_pacientes') \
            .select('id, profissional_id') \
            .eq('clinica_id', clinica_id) \
            .eq('paciente_id', paciente_id) \
            .eq('ativo', True) \
            .execute()
        rows = response.data or []
        for r in rows:
            if excluir_mensalidade_id and r.get('id') == excluir_mensalidade_id:
                continue
            if profissional_id:
                if r.get('profissional_id') == profissional_id:
                    return True
            else:
                if r.get('profissional_id') == None or r.get('profissional_id') == '':
                    return True
        return False
    
    # ========================================================================
    # MENSALIDADES
    # ========================================================================
    
    def listar_mensalidades(self, clinica_id: str, ativo: Optional[bool] = None) -> List[Dict]:
        """Lista mensalidades da clínica com dados do paciente"""
        def operation():
            query = self.supabase.table('mensalidades_pacientes') \
                .select(f'*, pacientes(id, nome_completo, cpf), {self._profissional_embed()}') \
                .eq('clinica_id', clinica_id) \
                .order('data_criacao', desc=True)
            
            if ativo is not None:
                query = query.eq('ativo', ativo)
            
            response = query.execute()
            
            mensalidades = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                prof = item.pop('profissional', None)
                if prof and isinstance(prof, dict):
                    item['profissional_nome'] = prof.get('nome_completo')
                mensalidades.append(item)
            
            logger.info(f"✅ Listadas {len(mensalidades)} mensalidades (filtro ativo={ativo})")
            return mensalidades
        
        return self._execute_with_retry(f"LISTAR_MENSALIDADES:{clinica_id}", operation)
    
    def buscar_mensalidade(self, mensalidade_id: str, clinica_id: str) -> Dict:
        """Busca uma mensalidade específica"""
        try:
            response = self.supabase.table('mensalidades_pacientes') \
                .select(f'*, pacientes(id, nome_completo, cpf, telefone_principal), {self._profissional_embed()}') \
                .eq('id', mensalidade_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            
            mensalidade = response.data
            paciente = mensalidade.pop('pacientes', None)
            if paciente:
                mensalidade['paciente_nome'] = paciente.get('nome_completo')
                mensalidade['paciente_telefone'] = paciente.get('telefone_principal')
            prof = mensalidade.pop('profissional', None)
            if prof and isinstance(prof, dict):
                mensalidade['profissional_nome'] = prof.get('nome_completo')
            
            logger.info(f"✅ Mensalidade {mensalidade_id} encontrada")
            return mensalidade
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar mensalidade: {str(e)}")
            raise
    
    def listar_mensalidades_por_paciente(self, paciente_id: str, clinica_id: str) -> List[Dict]:
        """Lista mensalidades ativas e dados do paciente/profissional."""
        try:
            response = self.supabase.table('mensalidades_pacientes') \
                .select(f'*, pacientes(nome_completo), {self._profissional_embed()}') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .order('data_criacao', desc=True) \
                .execute()

            rows = []
            for item in response.data or []:
                paciente = item.pop('pacientes', None)
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                prof = item.pop('profissional', None)
                if prof and isinstance(prof, dict):
                    item['profissional_nome'] = prof.get('nome_completo')
                rows.append(item)
            return rows

        except Exception as e:
            logger.error(f"❌ Erro ao listar mensalidades do paciente: {str(e)}")
            raise
    
    def criar_mensalidade(self, clinica_id: str, paciente_id: str, 
                         valor_mensalidade: Decimal, dia_vencimento: int,
                         criado_por: str, observacoes: Optional[str] = None,
                         profissional_id: Optional[str] = None) -> Dict:
        """Cria uma nova mensalidade para um paciente (várias por paciente, distintas por profissional)."""
        try:
            self._validar_profissional_clinica(profissional_id, clinica_id)
            if self._existe_mensalidade_ativa_duplicada(clinica_id, paciente_id, profissional_id):
                if profissional_id:
                    raise ValueError('Já existe mensalidade ativa para este paciente e profissional')
                raise ValueError('Já existe mensalidade ativa sem profissional vinculado para este paciente')

            dados = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'valor_mensalidade': float(valor_mensalidade),
                'dia_vencimento': dia_vencimento,
                'ativo': True,
                'observacoes': observacoes,
                'criado_por': criado_por,
                'profissional_id': profissional_id,
            }
            
            response = self.supabase.table('mensalidades_pacientes') \
                .insert(dados) \
                .execute()

            if response is None or not getattr(response, 'data', None):
                raise RuntimeError("Falha ao criar mensalidade")

            mensalidade = response.data[0]
            logger.info(f"✅ Mensalidade criada: {mensalidade['id']}")
            
            # Gerar pagamento do mês atual
            self.gerar_pagamento_individual(mensalidade['id'], clinica_id)
            
            return mensalidade
            
        except Exception as e:
            logger.error(f"❌ Erro ao criar mensalidade: {str(e)}")
            raise
    
    def atualizar_mensalidade(self, mensalidade_id: str, clinica_id: str,
                             dados_atualizacao: Dict) -> Dict:
        """Atualiza uma mensalidade existente"""
        try:
            # Converter Decimal para float se existir
            if 'valor_mensalidade' in dados_atualizacao:
                dados_atualizacao['valor_mensalidade'] = float(dados_atualizacao['valor_mensalidade'])

            cur = self.supabase.table('mensalidades_pacientes') \
                .select('paciente_id, profissional_id, ativo') \
                .eq('id', mensalidade_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            atual = cur.data
            if not atual:
                raise ValueError('Mensalidade não encontrada')

            novo_prof = atual.get('profissional_id')
            if 'profissional_id' in dados_atualizacao:
                novo_prof = dados_atualizacao.get('profissional_id')
            ativo_final = dados_atualizacao['ativo'] if 'ativo' in dados_atualizacao else atual.get('ativo')

            if 'profissional_id' in dados_atualizacao:
                self._validar_profissional_clinica(novo_prof, clinica_id)

            if ativo_final and self._existe_mensalidade_ativa_duplicada(
                clinica_id,
                atual['paciente_id'],
                novo_prof,
                excluir_mensalidade_id=mensalidade_id,
            ):
                if novo_prof:
                    raise ValueError('Já existe outra mensalidade ativa para este paciente e profissional')
                raise ValueError('Já existe mensalidade ativa sem profissional vinculado para este paciente')
            
            response = self.supabase.table('mensalidades_pacientes') \
                .update(dados_atualizacao) \
                .eq('id', mensalidade_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Mensalidade {mensalidade_id} atualizada")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar mensalidade: {str(e)}")
            raise
    
    def desativar_mensalidade(self, mensalidade_id: str, clinica_id: str) -> Dict:
        """Desativa uma mensalidade (soft delete)"""
        return self.atualizar_mensalidade(mensalidade_id, clinica_id, {'ativo': False})
    
    # ========================================================================
    # PAGAMENTOS
    # ========================================================================
    
    def listar_pagamentos(self, clinica_id: str, filters: Optional[Dict] = None) -> List[Dict]:
        """Lista pagamentos com filtros opcionais e retry automático.
        
        Quando filtrado por mes_referencia e não houver resultado, verifica se há
        mensalidades ativas e auto-gera os pagamentos do mês antes de retornar.
        """
        def operation():
            query = self.supabase.table('pagamentos_mensalidades') \
                .select('''
                    *,
                    pacientes(id, nome_completo),
                    mensalidades_pacientes(valor_mensalidade, dia_vencimento),
                    registrador:usuarios!registrado_por(nome_completo)
                ''') \
                .eq('clinica_id', clinica_id)
            
            if filters:
                if 'status' in filters:
                    query = query.eq('status', filters['status'])
                if 'mes_referencia' in filters:
                    query = query.eq('mes_referencia', filters['mes_referencia'])
                if 'paciente_id' in filters:
                    query = query.eq('paciente_id', filters['paciente_id'])
                if 'data_inicio' in filters:
                    query = query.gte('data_vencimento', filters['data_inicio'])
                if 'data_fim' in filters:
                    query = query.lte('data_vencimento', filters['data_fim'])
            
            response = query.order('data_vencimento', desc=True).execute()
            
            # Formatar resposta
            pagamentos = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                mensalidade = item.pop('mensalidades_pacientes', None)
                registrador = item.pop('registrador', None)
                
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                if mensalidade:
                    item['valor_mensalidade'] = mensalidade.get('valor_mensalidade')
                    item['dia_vencimento'] = mensalidade.get('dia_vencimento')
                if registrador:
                    item['registrado_por_nome'] = registrador.get('nome_completo')
                
                pagamentos.append(item)
            
            logger.info(f"✅ Listados {len(pagamentos)} pagamentos (filtros={filters})")
            return pagamentos
        
        pagamentos = self._execute_with_retry(f"LISTAR_PAGAMENTOS:{clinica_id}", operation)

        # Auto-geração: se filtrou por mes_referencia e não encontrou nada,
        # verifica se há mensalidades ativas e gera os pagamentos do mês.
        mes_referencia_filtrado = filters.get('mes_referencia') if filters else None
        if not pagamentos and mes_referencia_filtrado:
            mes_atual = start_of_month_brazil().isoformat()
            if mes_referencia_filtrado == mes_atual:
                try:
                    conta = self.supabase.table('mensalidades_pacientes') \
                        .select('id', count='exact') \
                        .eq('clinica_id', clinica_id) \
                        .eq('ativo', True) \
                        .execute()
                    qtd_ativas = conta.count or 0
                    if qtd_ativas > 0:
                        logger.info(
                            f"🔄 Nenhum pagamento encontrado para {mes_referencia_filtrado} "
                            f"mas há {qtd_ativas} mensalidades ativas — gerando pagamentos do mês..."
                        )
                        self.gerar_pagamentos_mes_corrente(clinica_id)
                        # Re-executa a query agora que os pagamentos foram gerados
                        pagamentos = self._execute_with_retry(
                            f"LISTAR_PAGAMENTOS_RETRY:{clinica_id}", operation
                        )
                except Exception as e:
                    logger.warning(f"⚠️ Auto-geração de pagamentos ignorada: {e}")

        return pagamentos
    
    def buscar_pagamento(self, pagamento_id: str, clinica_id: str) -> Dict:
        """Busca um pagamento específico"""
        try:
            response = self.supabase.table('pagamentos_mensalidades') \
                .select('*, pacientes(nome_completo)') \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            
            pagamento = response.data
            paciente = pagamento.pop('pacientes', None)
            if paciente:
                pagamento['paciente_nome'] = paciente.get('nome_completo')
            
            return pagamento
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar pagamento: {str(e)}")
            raise
    
    def gerar_pagamento_individual(self, mensalidade_id: str, clinica_id: str) -> Dict:
        """Gera pagamento do mês atual para uma mensalidade específica"""
        try:
            # Buscar mensalidade
            mensalidade = self.supabase.table('mensalidades_pacientes') \
                .select('*') \
                .eq('id', mensalidade_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()

            if mensalidade is None or not getattr(mensalidade, 'data', None):
                raise ValueError("Mensalidade não encontrada")
            
            m = mensalidade.data
            mes_atual = start_of_month_brazil()
            
            # Verificar se já existe
            existente = self.supabase.table('pagamentos_mensalidades') \
                .select('id') \
                .eq('mensalidade_id', mensalidade_id) \
                .eq('mes_referencia', mes_atual.isoformat()) \
                .maybe_single() \
                .execute()

            if existente is not None and getattr(existente, 'data', None):
                logger.info(f"✅ Pagamento já existe para o mês {mes_atual}")
                return existente.data
            
            # Calcular data de vencimento
            dia_venc = min(m['dia_vencimento'], 28)  # Evitar problemas com fevereiro
            try:
                data_vencimento = mes_atual.replace(day=dia_venc)
            except ValueError:
                data_vencimento = mes_atual.replace(day=28)
            
            # Criar pagamento
            dados_pagamento = {
                'clinica_id': clinica_id,
                'mensalidade_id': mensalidade_id,
                'paciente_id': m['paciente_id'],
                'mes_referencia': mes_atual.isoformat(),
                'status': 'pendente',
                'data_vencimento': data_vencimento.isoformat(),
                'valor_pago': float(m['valor_mensalidade'])
            }
            
            response = self.supabase.table('pagamentos_mensalidades') \
                .insert(dados_pagamento) \
                .execute()

            if response is None or not getattr(response, 'data', None):
                raise RuntimeError("Falha ao gerar pagamento da mensalidade")
            
            logger.info(f"✅ Pagamento gerado para mensalidade {mensalidade_id}")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao gerar pagamento: {str(e)}")
            raise
    
    def gerar_pagamentos_mes_corrente(self, clinica_id: str) -> int:
        """Gera pagamentos do mês atual via RPC batch — INSERT ON CONFLICT DO NOTHING.
        
        Antes: 1 fetch + 2 queries por mensalidade ativa = 1 + 2N roundtrips.
        Depois: 1 chamada RPC fixa independente do número de mensalidades.
        """
        try:
            mes_atual = start_of_month_brazil()
            result = self.supabase.rpc('gerar_pagamentos_mes_corrente_batch', {
                'p_clinica_id': clinica_id,
                'p_mes_referencia': mes_atual.isoformat()
            }).execute()
            contador = result.data or 0
            logger.info(f"✅ {contador} pagamentos gerados para o mês corrente (batch RPC)")
            return contador
        except Exception as e:
            logger.error(f"❌ Erro ao gerar pagamentos do mês: {str(e)}")
            raise
    
    def marcar_pagamento_pago(self, pagamento_id: str, clinica_id: str,
                             metodo_pagamento: str, valor_pago: Decimal,
                             registrado_por: str, data_pagamento: Optional[datetime] = None,
                             observacoes: Optional[str] = None) -> Dict:
        """Marca um pagamento como pago"""
        try:
            dados = {
                'status': 'pago',
                'data_pagamento': (data_pagamento or datetime.now()).isoformat(),
                'valor_pago': float(valor_pago),
                'metodo_pagamento': metodo_pagamento,
                'registrado_por': registrado_por
            }
            
            if observacoes:
                dados['observacoes'] = observacoes
            
            response = self.supabase.table('pagamentos_mensalidades') \
                .update(dados) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Pagamento {pagamento_id} marcado como pago")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao marcar pagamento como pago: {str(e)}")
            raise

    def marcar_pagamento_pendente(self, pagamento_id: str, clinica_id: str) -> Dict:
        """Marca um pagamento como pendente"""
        try:
            dados = {
                'status': 'pendente',
                'data_pagamento': None,
                'metodo_pagamento': None,
                'registrado_por': None
            }

            response = self.supabase.table('pagamentos_mensalidades') \
                .update(dados) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()

            if response is None or not getattr(response, 'data', None):
                raise ValueError('Pagamento não encontrado para atualização')

            logger.info(f"✅ Pagamento {pagamento_id} marcado como pendente")
            return response.data[0]

        except Exception as e:
            logger.error(f"❌ Erro ao marcar pagamento como pendente: {str(e)}")
            raise
    
    def alterar_data_vencimento(self, pagamento_id: str, clinica_id: str,
                               nova_data: date) -> Dict:
        """Altera a data de vencimento de um pagamento"""
        try:
            response = self.supabase.table('pagamentos_mensalidades') \
                .update({'data_vencimento': nova_data.isoformat()}) \
                .eq('id', pagamento_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Data de vencimento alterada para {nova_data}")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao alterar data de vencimento: {str(e)}")
            raise
    
    def calcular_proximos_vencimentos(self, clinica_id: str, dias: int = 3) -> List[Dict]:
        """Retorna pagamentos pendentes com vencimento próximo (2-3 dias)"""
        try:
            from datetime import timedelta
            hoje = today_brazil()
            data_limite = hoje + timedelta(days=dias)
            
            response = self.supabase.table('pagamentos_mensalidades') \
                .select('*, pacientes(id, nome_completo, telefone_principal)') \
                .eq('clinica_id', clinica_id) \
                .eq('status', 'pendente') \
                .gte('data_vencimento', hoje.isoformat()) \
                .lte('data_vencimento', data_limite.isoformat()) \
                .order('data_vencimento') \
                .execute()
            
            # Formatar resposta
            vencimentos = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                
                dias_ate_vencimento = (
                    datetime.strptime(item['data_vencimento'], '%Y-%m-%d').date() - hoje
                ).days
                
                vencimentos.append({
                    'pagamento_id': item['id'],
                    'paciente_id': item['paciente_id'],
                    'paciente_nome': paciente.get('nome_completo') if paciente else '',
                    'paciente_telefone': paciente.get('telefone_principal') if paciente else '',
                    'valor_pago': item['valor_pago'],
                    'data_vencimento': item['data_vencimento'],
                    'dias_ate_vencimento': dias_ate_vencimento,
                    'status': item['status'],
                    'mes_referencia': item['mes_referencia']
                })
            
            logger.info(f"✅ {len(vencimentos)} pagamentos próximos do vencimento")
            return vencimentos
            
        except Exception as e:
            logger.error(f"❌ Erro ao calcular próximos vencimentos: {str(e)}")
            raise
    
    def obter_estatisticas(self, clinica_id: str) -> Dict:
        """Calcula estatísticas via RPC — COUNT/SUM feito no banco, sem fetches completos."""
        try:
            mes_atual = start_of_month_brazil()
            result = self.supabase.rpc('get_estatisticas_mensalidades', {
                'p_clinica_id': clinica_id,
                'p_mes_referencia': mes_atual.isoformat()
            }).execute()
            stats = result.data or {}
            # Garante tipos numéricos corretos
            return {
                'total_mensalidades_ativas':  int(stats.get('total_mensalidades_ativas', 0)),
                'total_pagamentos_pendentes': int(stats.get('total_pagamentos_pendentes', 0)),
                'total_pagamentos_mes_atual': int(stats.get('total_pagamentos_mes_atual', 0)),
                'valor_total_pendente':       float(stats.get('valor_total_pendente', 0)),
                'valor_total_recebido_mes':   float(stats.get('valor_total_recebido_mes', 0)),
                'taxa_inadimplencia':         float(stats.get('taxa_inadimplencia', 0)),
            }
        except Exception as e:
            logger.error(f"❌ Erro ao calcular estatísticas: {str(e)}")
            raise
