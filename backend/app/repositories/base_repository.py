from database.supabase_client import get_supabase_client, reset_supabase_client
import logging
import time

logger = logging.getLogger(__name__)


class BaseRepository:
    """
    Repository base com filtro automático de clinica_id (multi-tenant)
    
    Usa RPC Functions do Supabase para queries otimizadas quando disponíveis
    Com retry automático em caso de falhas de conexão
    """
    
    def __init__(self, table_name, clinica_id):
        self.client = get_supabase_client()
        self.table_name = table_name
        self.clinica_id = clinica_id
        self.max_retries = 2  # Tentar até 2 vezes em caso de erro
        self.retry_delay = 0.5  # Aguardar 500ms antes de retry
        
        # Mapear table_name para function_name de RPC
        self.function_map = {
            'pacientes': 'get_pacientes',
            'prontuarios': 'get_prontuarios',
            'usuarios': 'get_usuarios',
            'salas': 'get_salas'
        }
    
    def _execute_with_retry(self, operation_name, operation_func):
        """
        Executa operação com retry automático em caso de falha de conexão.
        
        Args:
            operation_name: nome da operação (para logging)
            operation_func: função que executa a operação
        
        Returns:
            Resultado da operação
        """
        last_error = None
        
        for attempt in range(self.max_retries + 1):
            try:
                if attempt > 0:
                    logger.info(f"🔄 [REPO] {operation_name} - Tentativa {attempt + 1}/{self.max_retries + 1}")
                
                # Refresh cliente antes de tentar
                if attempt > 0:
                    reset_supabase_client()
                    self.client = get_supabase_client()
                
                result = operation_func()
                
                if attempt > 0:
                    logger.info(f"✅ [REPO] {operation_name} - Sucesso após retry")
                
                return result
                
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                
                # Erros de conexão que justificam retry
                should_retry = any([
                    'connection' in error_msg,
                    'timeout' in error_msg,
                    'temporary' in error_msg,
                    'unavailable' in error_msg,
                    'failed to fetch' in error_msg,
                    'network' in error_msg,
                    '500' in error_msg,
                    '502' in error_msg,
                    '503' in error_msg,
                    'service unavailable' in error_msg,
                    'database is unavailable' in error_msg,
                ])
                
                if should_retry and attempt < self.max_retries:
                    logger.warning(f"⚠️ [REPO] {operation_name} - Erro (tentativa {attempt + 1}): {str(e)}")
                    logger.info(f"⏳ [REPO] {operation_name} - Aguardando {self.retry_delay}s antes de retry...")
                    time.sleep(self.retry_delay)
                else:
                    # Último erro ou erro que não justifica retry
                    logger.error(f"❌ [REPO] {operation_name} - Erro final: {str(e)}")
                    break
        
        # Se chegou aqui, todas as tentativas falharam
        raise last_error if last_error else Exception(f"Erro desconhecido em {operation_name}")
    
    def create(self, data):
        """Cria novo registro (com clinica_id automático)"""
        def operation():
            data['clinica_id'] = self.clinica_id
            logger.info(f"💾 [REPO] Criando registro em {self.table_name}")
            
            response = self.client.table(self.table_name).insert(data).execute()
            
            if response.data:
                logger.info(f"✅ [REPO] Registro criado com sucesso em {self.table_name}")
                return response.data[0]
            else:
                logger.warning(f"⚠️ [REPO] Resposta vazia - retornando dados enviados")
                return data
        
        return self._execute_with_retry(f"CREATE:{self.table_name}", operation)
    
    def get_by_id(self, id):
        """Busca registro por ID com retry automático"""
        def operation():
            try:
                # Tenta usar função RPC específica
                function_name = f"get_{self.table_name[:-1]}_by_id"
                
                response = self.client.rpc(
                    function_name,
                    {
                        'p_id': id,
                        'p_clinica_id': self.clinica_id
                    }
                ).execute()
                
                if response.data and isinstance(response.data, list) and len(response.data) > 0:
                    return response.data[0]
                return response.data if response.data else None
            except:
                # Fallback para query direta
                response = self.client.table(self.table_name)\
                    .select("*")\
                    .eq("id", id)\
                    .eq("clinica_id", self.clinica_id)\
                    .execute()
                return response.data[0] if response.data else None
        
        return self._execute_with_retry(f"GET_BY_ID:{self.table_name}:{id}", operation)
    
    def get_all(self, filters=None, order_by=None, limit=None):
        """
        Lista todos registros com retry automático
        
        Args:
            filters: dict com filtros adicionais
            order_by: string com campo para ordenar (ex: 'created_at' ou '-created_at' para desc)
            limit: limite de registros
        """
        def operation():
            # Verifica se tem função RPC para esta tabela
            function_name = self.function_map.get(self.table_name)
            
            if function_name:
                try:
                    # Usa RPC Function
                    params = {'p_clinica_id': self.clinica_id}
                    
                    # Adiciona filtros como parâmetros
                    if filters:
                        for key, value in filters.items():
                            if isinstance(value, bool):
                                value = str(value).lower()
                            params[f'p_{key}'] = value
                    
                    response = self.client.rpc(function_name, params).execute()
                    
                    # Aplica ordenação e limite no Python se necessário
                    data = response.data or []
                    
                    if order_by:
                        descending = order_by.startswith('-')
                        column = order_by[1:] if descending else order_by
                        data = sorted(data, key=lambda x: x.get(column, ''), reverse=descending)
                    
                    if limit:
                        data = data[:limit]
                    
                    return data
                except:
                    # Fallback para query direta se RPC falhar
                    return self._get_all_fallback(filters, order_by, limit)
            else:
                # Fallback para query direta
                return self._get_all_fallback(filters, order_by, limit)
        
        return self._execute_with_retry(f"GET_ALL:{self.table_name}", operation)
    
    def _get_all_fallback(self, filters=None, order_by=None, limit=None):
        """Fallback para query direta quando RPC não está disponível"""
        logger.info(f"🔄 [REPO FALLBACK] Query direta para {self.table_name}")
        
        # Query especial para agendamentos com JOIN
        if self.table_name == 'agendamentos':
            return self._get_agendamentos_com_joins(filters, order_by, limit)
        
        query = self.client.table(self.table_name)\
            .select("*")\
            .eq("clinica_id", self.clinica_id)
        
        # Aplica filtros adicionais
        if filters:
            for field, value in filters.items():
                if value is not None:
                    if isinstance(value, bool):
                        value = str(value).lower()
                    query = query.eq(field, value)
        
        # Ordenação
        if order_by:
            descending = order_by.startswith('-')
            column = order_by[1:] if descending else order_by
            
            column_map = {
                'created_at': 'data_criacao',
                'updated_at': 'data_atualizacao'
            }
            column = column_map.get(column, column)
            
            query = query.order(column, desc=descending)
        
        # Limite
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        logger.info(f"✅ [REPO FALLBACK] {len(response.data or [])} registros")
        return response.data or []
    
    def _get_agendamentos_com_joins(self, filters=None, order_by=None, limit=None):
        """Query especial para agendamentos com dados relacionados"""
        logger.info("🔗 [REPO] Buscando agendamentos com JOINs")
        
        query = self.client.table('agendamentos')\
            .select("""
                *,
                paciente:pacientes(id, nome_completo, telefone_principal),
                profissional:usuarios!profissional_id(id, nome_completo, especialidade),
                sala:salas(id, nome)
            """)\
            .eq("clinica_id", self.clinica_id)
        
        # Aplica filtros
        if filters:
            for field, value in filters.items():
                if value is not None:
                    if isinstance(value, bool):
                        value = str(value).lower()
                    query = query.eq(field, value)
        
        # Ordenação
        if order_by:
            descending = order_by.startswith('-')
            column = order_by[1:] if descending else order_by
            query = query.order(column, desc=descending)
        
        # Limite
        if limit:
            query = query.limit(limit)
        
        try:
            response = query.execute()
            logger.info(f"✅ [REPO] Agendamentos com JOINs: {len(response.data or [])} registros")
            return response.data or []
        except Exception as e:
            logger.error(f"❌ [REPO] Erro no JOIN: {str(e)}")
            return self._get_agendamentos_simples(filters, order_by, limit)
    
    def _get_agendamentos_simples(self, filters=None, order_by=None, limit=None):
        """Fallback sem JOINs"""
        logger.warning("⚠️ [REPO] Usando query simples sem JOINs")
        
        query = self.client.table('agendamentos')\
            .select("*")\
            .eq("clinica_id", self.clinica_id)
        
        if filters:
            for field, value in filters.items():
                if value is not None:
                    if isinstance(value, bool):
                        value = str(value).lower()
                    query = query.eq(field, value)
        
        if order_by:
            descending = order_by.startswith('-')
            column = order_by[1:] if descending else order_by
            query = query.order(column, desc=descending)
        
        if limit:
            query = query.limit(limit)
        
        response = query.execute()
        return response.data or []
    
    def update(self, id, data):
        """Atualiza registro com retry automático"""
        def operation():
            data.pop('clinica_id', None)
            
            response = self.client.table(self.table_name)\
                .update(data)\
                .eq("id", id)\
                .eq("clinica_id", self.clinica_id)\
                .execute()
            return response.data[0] if response.data else data
        
        return self._execute_with_retry(f"UPDATE:{self.table_name}:{id}", operation)
    
    def delete(self, id):
        """Deleta registro com retry automático"""
        def operation():
            self.client.table(self.table_name)\
                .delete()\
                .eq("id", id)\
                .eq("clinica_id", self.clinica_id)\
                .execute()
            return True
        
        return self._execute_with_retry(f"DELETE:{self.table_name}:{id}", operation)
    
    def count(self, filters=None):
        """Conta registros com retry automático"""
        def operation():
            query = self.client.table(self.table_name)\
                .select("id", count="exact")\
                .eq("clinica_id", self.clinica_id)
            
            if filters:
                for field, value in filters.items():
                    if value is not None:
                        if isinstance(value, bool):
                            value = str(value).lower()
                        query = query.eq(field, value)
            
            response = query.execute()
            return response.count or 0
        
        return self._execute_with_retry(f"COUNT:{self.table_name}", operation)
    
    # ========================================================================
    # MÉTODOS HELPER USANDO RPC FUNCTIONS ESPECIALIZADAS
    # ========================================================================
    
    def check_cpf_exists(self, cpf, exclude_id=None):
        """Verifica se CPF já existe"""
        if self.table_name != 'pacientes':
            return False
        
        def operation():
            try:
                response = self.client.rpc(
                    'check_cpf_exists',
                    {
                        'p_cpf': cpf,
                        'p_clinica_id': self.clinica_id,
                        'p_exclude_id': exclude_id
                    }
                ).execute()
                return response.data if response.data is not None else False
            except:
                # Fallback
                filters = {'cpf': cpf}
                existing = self._get_all_fallback(filters=filters)
                if exclude_id:
                    existing = [p for p in existing if p['id'] != exclude_id]
                return len(existing) > 0
        
        return self._execute_with_retry(f"CHECK_CPF:{cpf}", operation)
    
    def check_agendamento_conflict(self, profissional_id, data_agendamento, 
                                   horario_inicio, horario_fim, sala_id=None, exclude_id=None):
        """Verifica conflito de agendamento"""
        if self.table_name != 'agendamentos':
            return False
        
        def operation():
            try:
                response = self.client.rpc(
                    'check_agendamento_conflict',
                    {
                        'p_clinica_id': self.clinica_id,
                        'p_profissional_id': profissional_id,
                        'p_sala_id': sala_id,
                        'p_data_agendamento': data_agendamento,
                        'p_horario_inicio': horario_inicio,
                        'p_horario_fim': horario_fim,
                        'p_exclude_id': exclude_id
                    }
                ).execute()
                
                return response.data if response.data is not None else False
            except:
                # Fallback
                agendamentos = self._get_all_fallback(
                    filters={
                        'profissional_id': profissional_id,
                        'data_agendamento': data_agendamento
                    }
                )
                
                for ag in agendamentos:
                    if exclude_id and ag['id'] == exclude_id:
                        continue
                    if ag.get('status') in ['cancelado']:
                        continue
                    
                    h_inicio = ag.get('horario_inicio', '')
                    h_fim = ag.get('horario_fim', '')
                    
                    if horario_fim > h_inicio and horario_inicio < h_fim:
                        return True
                
                return False
        
        return self._execute_with_retry(f"CHECK_AGENDA_CONFLICT", operation)
