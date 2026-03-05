# filepath: backend/app/services/mensalidade_service.py
import logging
from datetime import datetime, date
from decimal import Decimal
from typing import List, Dict, Optional
from database.supabase_client import get_supabase_client, reset_supabase_client
from app.utils.date_utils import today_brazil, start_of_month_brazil
import time

logger = logging.getLogger(__name__)


class MensalidadeService:
    """Serviço para gerenciar mensalidades e pagamentos com retry automático"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
        self.max_retries = 2
        self.retry_delay = 0.5
    
    def _execute_with_retry(self, operation_name, operation_func):
        """Executa operação com retry automático"""
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"🔄 [SERVICE] {operation_name} - Tentativa {attempt + 1}/{self.max_retries + 1}")
                
                if attempt > 0:
                    reset_supabase_client()
                    self.supabase = get_supabase_client()
                
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
    
    # ========================================================================
    # MENSALIDADES
    # ========================================================================
    
    def listar_mensalidades(self, clinica_id: str, ativo: Optional[bool] = None) -> List[Dict]:
        """Lista mensalidades da clínica com dados do paciente"""
        def operation():
            query = self.supabase.table('mensalidades_pacientes') \
                .select('*, pacientes(id, nome_completo, cpf)') \
                .eq('clinica_id', clinica_id) \
                .order('data_criacao', desc=True)
            
            if ativo is not None:
                query = query.eq('ativo', ativo)
            
            response = query.execute()
            
            # Formatar resposta
            mensalidades = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                mensalidades.append(item)
            
            logger.info(f"✅ Listadas {len(mensalidades)} mensalidades")
            return mensalidades
        
        return self._execute_with_retry(f"LISTAR_MENSALIDADES:{clinica_id}", operation)
    
    def buscar_mensalidade(self, mensalidade_id: str, clinica_id: str) -> Dict:
        """Busca uma mensalidade específica"""
        try:
            response = self.supabase.table('mensalidades_pacientes') \
                .select('*, pacientes(id, nome_completo, cpf, telefone_principal)') \
                .eq('id', mensalidade_id) \
                .eq('clinica_id', clinica_id) \
                .single() \
                .execute()
            
            mensalidade = response.data
            paciente = mensalidade.pop('pacientes', None)
            if paciente:
                mensalidade['paciente_nome'] = paciente.get('nome_completo')
                mensalidade['paciente_telefone'] = paciente.get('telefone_principal')
            
            logger.info(f"✅ Mensalidade {mensalidade_id} encontrada")
            return mensalidade
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar mensalidade: {str(e)}")
            raise
    
    def buscar_mensalidade_por_paciente(self, paciente_id: str, clinica_id: str) -> Optional[Dict]:
        """Busca mensalidade de um paciente específico"""
        try:
            response = self.supabase.table('mensalidades_pacientes') \
                .select('*') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .maybe_single() \
                .execute()

            if response is None:
                return None

            return getattr(response, 'data', None)
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar mensalidade do paciente: {str(e)}")
            raise
    
    def criar_mensalidade(self, clinica_id: str, paciente_id: str, 
                         valor_mensalidade: Decimal, dia_vencimento: int,
                         criado_por: str, observacoes: Optional[str] = None) -> Dict:
        """Cria uma nova mensalidade para um paciente"""
        try:
            # Verificar se já existe mensalidade ativa para o paciente
            existente = self.buscar_mensalidade_por_paciente(paciente_id, clinica_id)
            if existente:
                raise ValueError(f"Paciente já possui mensalidade ativa")
            
            dados = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'valor_mensalidade': float(valor_mensalidade),
                'dia_vencimento': dia_vencimento,
                'ativo': True,
                'observacoes': observacoes,
                'criado_por': criado_por
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
        """Lista pagamentos com filtros opcionais e retry automático"""
        def operation():
            query = self.supabase.table('pagamentos_mensalidades') \
                .select('''
                    *,
                    pacientes(id, nome_completo),
                    mensalidades_pacientes(valor_mensalidade),
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
                if registrador:
                    item['registrado_por_nome'] = registrador.get('nome_completo')
                
                pagamentos.append(item)
            
            logger.info(f"✅ Listados {len(pagamentos)} pagamentos")
            return pagamentos
        
        return self._execute_with_retry(f"LISTAR_PAGAMENTOS:{clinica_id}", operation)
    
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
        """Gera pagamentos do mês atual para todas as mensalidades ativas"""
        try:
            mensalidades = self.listar_mensalidades(clinica_id, ativo=True)
            contador = 0
            
            for mensalidade in mensalidades:
                try:
                    self.gerar_pagamento_individual(mensalidade['id'], clinica_id)
                    contador += 1
                except Exception as e:
                    logger.warning(f"⚠️ Erro ao gerar pagamento para {mensalidade['id']}: {str(e)}")
                    continue
            
            logger.info(f"✅ {contador} pagamentos gerados para o mês corrente")
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
        """Calcula estatísticas do sistema de mensalidades"""
        try:
            mes_atual = start_of_month_brazil()
            
            # Total mensalidades ativas
            total_ativas = len(self.listar_mensalidades(clinica_id, ativo=True))
            
            # Pagamentos do mês atual
            pagamentos_mes = self.listar_pagamentos(clinica_id, {
                'mes_referencia': mes_atual.isoformat()
            })
            
            total_pagamentos_mes = len(pagamentos_mes)
            pendentes = [p for p in pagamentos_mes if p['status'] == 'pendente']
            pagos = [p for p in pagamentos_mes if p['status'] == 'pago']
            
            valor_pendente = sum(Decimal(str(p.get('valor_pago', 0))) for p in pendentes)
            valor_recebido = sum(Decimal(str(p.get('valor_pago', 0))) for p in pagos)
            
            taxa_inadimplencia = (len(pendentes) / total_pagamentos_mes * 100) if total_pagamentos_mes > 0 else 0
            
            return {
                'total_mensalidades_ativas': total_ativas,
                'total_pagamentos_pendentes': len(pendentes),
                'total_pagamentos_mes_atual': total_pagamentos_mes,
                'valor_total_pendente': float(valor_pendente),
                'valor_total_recebido_mes': float(valor_recebido),
                'taxa_inadimplencia': round(taxa_inadimplencia, 2)
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao calcular estatísticas: {str(e)}")
            raise
