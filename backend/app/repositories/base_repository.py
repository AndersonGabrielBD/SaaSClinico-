# filepath: backend/app/repositories/base_repository.py
from database.supabase_client import get_supabase_client


class BaseRepository:
    """
    Repository base com filtro automático de clinica_id (multi-tenant)
    
    Usa RPC Functions do Supabase para queries otimizadas quando disponíveis
    """
    
    def __init__(self, table_name, clinica_id):
        self.client = get_supabase_client()
        self.table_name = table_name
        self.clinica_id = clinica_id
        
        # Mapear table_name para function_name de RPC
        self.function_map = {
            'pacientes': 'get_pacientes',
            'agendamentos': 'get_agendamentos',  # Desabilitado - RPC desatualizada
            'prontuarios': 'get_prontuarios',  # Desabilitado - RPC desatualizada
            'usuarios': 'get_usuarios',
            'salas': 'get_salas'
        }
    
    def create(self, data):
        """Cria novo registro (com clinica_id automático)"""
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Força clinica_id para garantir isolamento
            data['clinica_id'] = self.clinica_id
            
            logger.info(f"💾 [REPO] Criando registro em {self.table_name}")
            logger.info(f"💾 [REPO] Dados: {data}")
            
            response = self.client.table(self.table_name).insert(data).execute()
            
            logger.info(f"💾 [REPO] Resposta do Supabase: {response}")
            logger.info(f"💾 [REPO] Response.data: {response.data}")
            
            if response.data:
                logger.info(f"✅ [REPO] Registro criado com sucesso em {self.table_name}")
                return response.data[0]
            else:
                logger.warning(f"⚠️ [REPO] Resposta vazia do Supabase para {self.table_name}")
                return data
                
        except Exception as e:
            logger.error(f"❌ [REPO] Erro ao criar em {self.table_name}: {str(e)}")
            logger.error(f"❌ [REPO] Tipo do erro: {type(e).__name__}")
            if hasattr(e, 'message'):
                logger.error(f"❌ [REPO] Mensagem do erro: {e.message}")
            if hasattr(e, 'details'):
                logger.error(f"❌ [REPO] Detalhes do erro: {e.details}")
            raise Exception(f"Erro ao criar {self.table_name}: {str(e)}")
    
    def get_by_id(self, id):
        """Busca registro por ID usando RPC Function otimizada"""
        try:
            # Tenta usar função RPC específica
            function_name = f"get_{self.table_name[:-1]}_by_id"  # Remove 's' do plural
            
            response = self.client.rpc(
                function_name,
                {
                    'p_id': id,
                    'p_clinica_id': self.clinica_id
                }
            ).execute()
            
            # RPC retorna lista, pegar primeiro elemento
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
    
    def get_all(self, filters=None, order_by=None, limit=None):
        """
        Lista todos registros usando RPC Function otimizada quando disponível
        
        Args:
            filters: dict com filtros adicionais
            order_by: string com campo para ordenar (ex: 'created_at' ou '-created_at' para desc)
            limit: limite de registros
        """
        try:
            # Verifica se tem função RPC para esta tabela
            function_name = self.function_map.get(self.table_name)
            
            if function_name:
                # Usa RPC Function
                params = {'p_clinica_id': self.clinica_id}
                
                # Adiciona filtros como parâmetros
                if filters:
                    for key, value in filters.items():
                        # Converte booleanos para string lowercase
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
            else:
                # Fallback para query direta
                return self._get_all_fallback(filters, order_by, limit)
                
        except:
            # Se RPC falhar, usa fallback
            return self._get_all_fallback(filters, order_by, limit)
    
    def _get_all_fallback(self, filters=None, order_by=None, limit=None):
        """Fallback para query direta quando RPC não está disponível"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔄 [REPO FALLBACK] Usando query direta para {self.table_name}")
        
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
                    # Converter booleanos Python para lowercase
                    if isinstance(value, bool):
                        value = str(value).lower()
                    query = query.eq(field, value)
        
        # Ordenação - mapear nomes de colunas
        if order_by:
            descending = order_by.startswith('-')
            column = order_by[1:] if descending else order_by
            
            # Mapear created_at para data_criacao (padrão brasileiro)
            column_map = {
                'created_at': 'data_criacao',
                'updated_at': 'data_atualizacao'
            }
            column = column_map.get(column, column)
            
            logger.info(f"📊 [REPO FALLBACK] Ordenando por: {column} (desc={descending})")
            query = query.order(column, desc=descending)
        
        # Limite
        if limit:
            query = query.limit(limit)
        
        try:
            response = query.execute()
            logger.info(f"✅ [REPO FALLBACK] Retornando {len(response.data or [])} registros")
            return response.data or []
        except Exception as e:
            logger.error(f"❌ [REPO FALLBACK] Erro: {str(e)}")
            raise
    
    def _get_agendamentos_com_joins(self, filters=None, order_by=None, limit=None):
        """Query especial para agendamentos com dados relacionados"""
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info("🔗 [REPO] Buscando agendamentos com JOINs")
        
        # Usar select com relacionamentos
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
            logger.error(f"❌ [REPO] Erro ao buscar com JOINs: {str(e)}")
            # Fallback para query simples se JOIN falhar
            return self._get_agendamentos_simples(filters, order_by, limit)
    
    def _get_agendamentos_simples(self, filters=None, order_by=None, limit=None):
        """Fallback sem JOINs se der erro"""
        import logging
        logger = logging.getLogger(__name__)
        
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
        """Atualiza registro (verificando clinica_id)"""
        try:
            # Remove clinica_id dos dados (não pode ser alterado)
            data.pop('clinica_id', None)
            
            response = self.client.table(self.table_name)\
                .update(data)\
                .eq("id", id)\
                .eq("clinica_id", self.clinica_id)\
                .execute()
            return response.data[0] if response.data else data
        except Exception as e:
            raise Exception(f"Erro ao atualizar {self.table_name}: {str(e)}")
    
    def delete(self, id):
        """Deleta registro (verificando clinica_id)"""
        try:
            self.client.table(self.table_name)\
                .delete()\
                .eq("id", id)\
                .eq("clinica_id", self.clinica_id)\
                .execute()
            return True
        except Exception as e:
            raise Exception(f"Erro ao deletar {self.table_name}: {str(e)}")
    
    def count(self, filters=None):
        """Conta registros da clínica"""
        try:
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
        except Exception as e:
            raise Exception(f"Erro ao contar {self.table_name}: {str(e)}")
    
    # ========================================================================
    # MÉTODOS HELPER USANDO RPC FUNCTIONS ESPECIALIZADAS
    # ========================================================================
    
    def check_cpf_exists(self, cpf, exclude_id=None):
        """Verifica se CPF já existe (apenas para pacientes)"""
        if self.table_name != 'pacientes':
            return False
        
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
            # Fallback para query direta
            filters = {'cpf': cpf}
            existing = self._get_all_fallback(filters=filters)
            if exclude_id:
                existing = [p for p in existing if p['id'] != exclude_id]
            return len(existing) > 0
    
    def check_agendamento_conflict(self, profissional_id, data_agendamento, 
                                   horario_inicio, horario_fim, sala_id=None, exclude_id=None):
        """Verifica conflito de agendamento"""
        if self.table_name != 'agendamentos':
            return False
        
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
            return False
    
    def get_dashboard_stats(self):
        """Busca estatísticas do dashboard em uma única query RPC"""
        try:
            response = self.client.rpc(
                'get_dashboard_stats',
                {'p_clinica_id': self.clinica_id}
            ).execute()
            
            # A função RPC retorna um JSON, pode vir como string ou objeto
            if response.data:
                import json
                # Se é string JSON, fazer parse
                if isinstance(response.data, str):
                    return json.loads(response.data)
                # Se é lista com um elemento
                elif isinstance(response.data, list) and len(response.data) > 0:
                    return response.data[0]
                # Se já é objeto
                return response.data
            return {}
        except Exception as e:
            print(f"Erro ao buscar estatísticas via RPC: {str(e)}")
            raise Exception(f"Erro ao buscar estatísticas: {str(e)}")
    
    def get_profissionais(self, ativo=True):
        """Busca apenas profissionais (fono, medico)"""
        try:
            response = self.client.rpc(
                'get_profissionais',
                {
                    'p_clinica_id': self.clinica_id,
                    'p_ativo': ativo
                }
            ).execute()
            return response.data or []
        except:
            # Fallback para query direta
            filters = {'ativo': ativo}
            usuarios = self._get_all_fallback(filters=filters)
            return [u for u in usuarios if u.get('role') in ['fono', 'medico']]
