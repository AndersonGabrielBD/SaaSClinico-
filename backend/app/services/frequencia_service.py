# filepath: backend/app/services/frequencia_service.py
import logging
from typing import List, Dict, Optional
from datetime import date
from database.supabase_client import get_supabase_client

logger = logging.getLogger(__name__)


class FrequenciaService:
    """Serviço para gerenciar frequência de atendimentos"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    def registrar_frequencia(self, clinica_id: str, paciente_id: str,
                            profissional_id: str, data_atendimento: date,
                            compareceu: bool, registrado_por: str,
                            agendamento_id: Optional[str] = None,
                            observacoes: Optional[str] = None) -> Dict:
        """Registra a frequência de um atendimento"""
        try:
            # Verificar se já existe registro para este agendamento
            if agendamento_id:
                existente = self.supabase.table('frequencia_atendimentos') \
                    .select('id') \
                    .eq('agendamento_id', agendamento_id) \
                    .maybe_single() \
                    .execute()
                
                if existente.data:
                    raise ValueError("Frequência já registrada para este agendamento")
            
            dados = {
                'clinica_id': clinica_id,
                'paciente_id': paciente_id,
                'profissional_id': profissional_id,
                'agendamento_id': agendamento_id,
                'data_atendimento': data_atendimento.isoformat(),
                'compareceu': compareceu,
                'observacoes': observacoes,
                'registrado_por': registrado_por
            }
            
            response = self.supabase.table('frequencia_atendimentos') \
                .insert(dados) \
                .execute()
            
            logger.info(f"✅ Frequência registrada: {response.data[0]['id']}")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao registrar frequência: {str(e)}")
            raise
    
    def listar_frequencia_paciente(self, paciente_id: str, clinica_id: str,
                                    profissional_id: Optional[str] = None) -> List[Dict]:
        """Lista frequência de um paciente, opcionalmente filtrado por profissional"""
        try:
            query = self.supabase.table('frequencia_atendimentos') \
                .select('*') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id)
            
            if profissional_id:
                query = query.eq('profissional_id', profissional_id)
            
            response = query.order('data_atendimento', desc=True).execute()
            
            # Buscar nomes de profissionais e registradores
            frequencias = []
            for item in response.data:
                # Buscar nome do profissional
                if item.get('profissional_id'):
                    prof_response = self.supabase.table('usuarios') \
                        .select('nome_completo') \
                        .eq('id', item['profissional_id']) \
                        .maybe_single() \
                        .execute()
                    if prof_response.data:
                        item['profissional_nome'] = prof_response.data.get('nome_completo')
                
                # Buscar nome de quem registrou
                if item.get('registrado_por'):
                    reg_response = self.supabase.table('usuarios') \
                        .select('nome_completo') \
                        .eq('id', item['registrado_por']) \
                        .maybe_single() \
                        .execute()
                    if reg_response.data:
                        item['registrado_por_nome'] = reg_response.data.get('nome_completo')
                
                frequencias.append(item)
            
            logger.info(f"✅ Listadas {len(frequencias)} frequências do paciente {paciente_id}")
            return frequencias
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar frequência: {str(e)}")
            raise
    
    def calcular_estatisticas_paciente(self, paciente_id: str, clinica_id: str,
                                       profissional_id: Optional[str] = None) -> Dict:
        """Calcula estatísticas de frequência de um paciente"""
        try:
            query = self.supabase.table('frequencia_atendimentos') \
                .select('compareceu') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id)
            
            if profissional_id:
                query = query.eq('profissional_id', profissional_id)
            
            response = query.execute()
            registros = response.data
            
            total = len(registros)
            comparecimentos = sum(1 for r in registros if r['compareceu'])
            faltas = total - comparecimentos
            percentual = (comparecimentos / total * 100) if total > 0 else 0
            
            return {
                'paciente_id': paciente_id,
                'profissional_id': profissional_id,
                'total_atendimentos': total,
                'total_comparecimentos': comparecimentos,
                'total_faltas': faltas,
                'percentual_presenca': round(percentual, 2)
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao calcular estatísticas: {str(e)}")
            raise
    
    def calcular_estatisticas_por_profissional(self, paciente_id: str,
                                               clinica_id: str) -> List[Dict]:
        """Calcula estatísticas de frequência agrupadas por profissional"""
        try:
            # Buscar todos os registros com informações do profissional
            response = self.supabase.table('frequencia_atendimentos') \
                .select('profissional_id, compareceu, usuarios!profissional_id(nome_completo)') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            # Agrupar por profissional
            stats_por_prof = {}
            for registro in response.data:
                prof_id = registro['profissional_id']
                
                if prof_id not in stats_por_prof:
                    profissional = registro.get('usuarios', {})
                    stats_por_prof[prof_id] = {
                        'profissional_id': prof_id,
                        'profissional_nome': profissional.get('nome_completo', 'Desconhecido'),
                        'total_atendimentos': 0,
                        'total_comparecimentos': 0,
                        'total_faltas': 0
                    }
                
                stats_por_prof[prof_id]['total_atendimentos'] += 1
                if registro['compareceu']:
                    stats_por_prof[prof_id]['total_comparecimentos'] += 1
                else:
                    stats_por_prof[prof_id]['total_faltas'] += 1
            
            # Calcular percentuais
            resultado = []
            for prof_id, stats in stats_por_prof.items():
                total = stats['total_atendimentos']
                percentual = (stats['total_comparecimentos'] / total * 100) if total > 0 else 0
                stats['percentual_presenca'] = round(percentual, 2)
                resultado.append(stats)
            
            logger.info(f"✅ Estatísticas calculadas para {len(resultado)} profissionais")
            return resultado
            
        except Exception as e:
            logger.error(f"❌ Erro ao calcular estatísticas por profissional: {str(e)}")
            raise
    
    def listar_frequencia_profissional(self, profissional_id: str,
                                       clinica_id: str) -> List[Dict]:
        """Lista frequência de todos os pacientes de um profissional"""
        try:
            response = self.supabase.table('frequencia_atendimentos') \
                .select('*, pacientes(nome_completo)') \
                .eq('profissional_id', profissional_id) \
                .eq('clinica_id', clinica_id) \
                .order('data_atendimento', desc=True) \
                .execute()
            
            # Formatar resposta
            frequencias = []
            for item in response.data:
                paciente = item.pop('pacientes', None)
                if paciente:
                    item['paciente_nome'] = paciente.get('nome_completo')
                frequencias.append(item)
            
            logger.info(f"✅ Listadas {len(frequencias)} frequências do profissional {profissional_id}")
            return frequencias
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar frequência do profissional: {str(e)}")
            raise
    
    def atualizar_frequencia(self, frequencia_id: str, clinica_id: str,
                            dados_atualizacao: Dict) -> Dict:
        """Atualiza um registro de frequência"""
        try:
            response = self.supabase.table('frequencia_atendimentos') \
                .update(dados_atualizacao) \
                .eq('id', frequencia_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Frequência {frequencia_id} atualizada")
            return response.data[0]
            
        except Exception as e:
            logger.error(f"❌ Erro ao atualizar frequência: {str(e)}")
            raise
    
    def deletar_frequencia(self, frequencia_id: str, clinica_id: str) -> bool:
        """Deleta um registro de frequência"""
        try:
            self.supabase.table('frequencia_atendimentos') \
                .delete() \
                .eq('id', frequencia_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            logger.info(f"✅ Frequência {frequencia_id} deletada")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao deletar frequência: {str(e)}")
            raise

    def listar_estatisticas_todos_pacientes(self, clinica_id: str) -> List[Dict]:
        """Lista estatísticas de frequência de todos os pacientes da clínica"""
        try:
            # Buscar todos os registros de frequência com dados do paciente
            response = self.supabase.table('frequencia_atendimentos') \
                .select('paciente_id, compareceu, pacientes(id, nome_completo, ativo)') \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            # Agrupar por paciente
            stats_por_paciente = {}
            for registro in response.data:
                paciente_id = registro['paciente_id']
                paciente_info = registro.get('pacientes', {})
                
                if paciente_id not in stats_por_paciente:
                    stats_por_paciente[paciente_id] = {
                        'paciente_id': paciente_id,
                        'paciente_nome': paciente_info.get('nome_completo', 'Desconhecido'),
                        'paciente_ativo': paciente_info.get('ativo', True),
                        'total_atendimentos': 0,
                        'total_comparecimentos': 0,
                        'total_faltas': 0
                    }
                
                stats_por_paciente[paciente_id]['total_atendimentos'] += 1
                if registro['compareceu']:
                    stats_por_paciente[paciente_id]['total_comparecimentos'] += 1
                else:
                    stats_por_paciente[paciente_id]['total_faltas'] += 1
            
            # Calcular percentuais e criar lista
            resultado = []
            for paciente_id, stats in stats_por_paciente.items():
                total = stats['total_atendimentos']
                percentual = (stats['total_comparecimentos'] / total * 100) if total > 0 else 0
                stats['percentual_presenca'] = round(percentual, 2)
                resultado.append(stats)
            
            # Ordenar por percentual de presença (menor primeiro para destacar problemas)
            resultado.sort(key=lambda x: x['percentual_presenca'])
            
            logger.info(f"✅ Estatísticas calculadas para {len(resultado)} pacientes")
            return resultado
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar estatísticas de todos os pacientes: {str(e)}")
            raise

    def listar_estatisticas_pacientes_profissional(self, clinica_id: str, profissional_id: str) -> List[Dict]:
        """Lista estatísticas de frequência apenas dos pacientes vinculados ao profissional"""
        try:
            # Primeiro, buscar pacientes vinculados ao profissional
            vinculos = self.supabase.table('pacientes_profissionais') \
                .select('paciente_id') \
                .eq('profissional_id', profissional_id) \
                .eq('clinica_id', clinica_id) \
                .eq('ativo', True) \
                .execute()
            
            paciente_ids = [v['paciente_id'] for v in vinculos.data] if vinculos.data else []
            
            if not paciente_ids:
                return []
            
            # Buscar registros de frequência desses pacientes
            response = self.supabase.table('frequencia_atendimentos') \
                .select('paciente_id, compareceu, pacientes(id, nome_completo, ativo)') \
                .eq('clinica_id', clinica_id) \
                .eq('profissional_id', profissional_id) \
                .in_('paciente_id', paciente_ids) \
                .execute()
            
            # Agrupar por paciente
            stats_por_paciente = {}
            for registro in response.data:
                paciente_id = registro['paciente_id']
                paciente_info = registro.get('pacientes', {})
                
                if paciente_id not in stats_por_paciente:
                    stats_por_paciente[paciente_id] = {
                        'paciente_id': paciente_id,
                        'paciente_nome': paciente_info.get('nome_completo', 'Desconhecido'),
                        'paciente_ativo': paciente_info.get('ativo', True),
                        'total_atendimentos': 0,
                        'total_comparecimentos': 0,
                        'total_faltas': 0
                    }
                
                stats_por_paciente[paciente_id]['total_atendimentos'] += 1
                if registro['compareceu']:
                    stats_por_paciente[paciente_id]['total_comparecimentos'] += 1
                else:
                    stats_por_paciente[paciente_id]['total_faltas'] += 1
            
            # Calcular percentuais e criar lista
            resultado = []
            for paciente_id, stats in stats_por_paciente.items():
                total = stats['total_atendimentos']
                percentual = (stats['total_comparecimentos'] / total * 100) if total > 0 else 0
                stats['percentual_presenca'] = round(percentual, 2)
                resultado.append(stats)
            
            # Ordenar por percentual de presença (menor primeiro)
            resultado.sort(key=lambda x: x['percentual_presenca'])
            
            logger.info(f"✅ Estatísticas calculadas para {len(resultado)} pacientes do profissional {profissional_id}")
            return resultado
            
        except Exception as e:
            logger.error(f"❌ Erro ao listar estatísticas dos pacientes do profissional: {str(e)}")
            raise

    def get_resumo_mensal(self, clinica_id: str, ano: str, mes: str, 
                         profissional_id: Optional[str] = None) -> Dict:
        """
        Retorna resumo mensal de consultas agrupado por profissional e por paciente.
        Usado para cálculo de pagamento dos profissionais.
        """
        try:
            # Definir período
            data_inicio = f"{ano}-{mes.zfill(2)}-01"
            # Último dia do mês
            if mes == '12':
                data_fim = f"{int(ano)+1}-01-01"
            else:
                data_fim = f"{ano}-{str(int(mes)+1).zfill(2)}-01"
            
            # Query base
            query = self.supabase.table('frequencia_atendimentos') \
                .select('*, pacientes(id, nome_completo), usuarios!profissional_id(id, nome_completo, especialidade)') \
                .eq('clinica_id', clinica_id) \
                .eq('compareceu', True) \
                .gte('data_atendimento', data_inicio) \
                .lt('data_atendimento', data_fim)
            
            # Se for profissional específico, filtra
            if profissional_id:
                query = query.eq('profissional_id', profissional_id)
            
            response = query.order('data_atendimento', desc=False).execute()
            registros = response.data or []
            
            # Agrupar POR PROFISSIONAL (para cálculo de pagamento)
            por_profissional = {}
            for reg in registros:
                prof_id = reg['profissional_id']
                prof_info = reg.get('usuarios', {}) or {}
                pac_info = reg.get('pacientes', {}) or {}
                
                if prof_id not in por_profissional:
                    por_profissional[prof_id] = {
                        'profissional_id': prof_id,
                        'profissional_nome': prof_info.get('nome_completo', 'Desconhecido'),
                        'especialidade': prof_info.get('especialidade', ''),
                        'total_consultas': 0,
                        'pacientes_dict': {}
                    }
                
                por_profissional[prof_id]['total_consultas'] += 1
                
                # Agrupar pacientes dentro do profissional
                pac_id = reg['paciente_id']
                if pac_id not in por_profissional[prof_id]['pacientes_dict']:
                    por_profissional[prof_id]['pacientes_dict'][pac_id] = {
                        'paciente_id': pac_id,
                        'paciente_nome': pac_info.get('nome_completo', 'Desconhecido'),
                        'quantidade': 0,
                        'datas': []
                    }
                
                por_profissional[prof_id]['pacientes_dict'][pac_id]['quantidade'] += 1
                por_profissional[prof_id]['pacientes_dict'][pac_id]['datas'].append(
                    reg['data_atendimento']
                )
            
            # Converter dict de pacientes para lista
            resultado_profissional = []
            for prof_id, prof_data in por_profissional.items():
                prof_data['pacientes'] = list(prof_data['pacientes_dict'].values())
                del prof_data['pacientes_dict']
                resultado_profissional.append(prof_data)
            
            # Ordenar por total de consultas (maior primeiro)
            resultado_profissional.sort(key=lambda x: x['total_consultas'], reverse=True)
            
            # Agrupar POR PACIENTE (visão alternativa)
            por_paciente = {}
            for reg in registros:
                pac_id = reg['paciente_id']
                pac_info = reg.get('pacientes', {}) or {}
                prof_info = reg.get('usuarios', {}) or {}
                
                if pac_id not in por_paciente:
                    por_paciente[pac_id] = {
                        'paciente_id': pac_id,
                        'paciente_nome': pac_info.get('nome_completo', 'Desconhecido'),
                        'total_consultas': 0,
                        'profissionais_dict': {}
                    }
                
                por_paciente[pac_id]['total_consultas'] += 1
                
                # Agrupar profissionais dentro do paciente
                prof_id = reg['profissional_id']
                if prof_id not in por_paciente[pac_id]['profissionais_dict']:
                    por_paciente[pac_id]['profissionais_dict'][prof_id] = {
                        'profissional_id': prof_id,
                        'profissional_nome': prof_info.get('nome_completo', 'Desconhecido'),
                        'especialidade': prof_info.get('especialidade', ''),
                        'quantidade': 0,
                        'datas': []
                    }
                
                por_paciente[pac_id]['profissionais_dict'][prof_id]['quantidade'] += 1
                por_paciente[pac_id]['profissionais_dict'][prof_id]['datas'].append(
                    reg['data_atendimento']
                )
            
            # Converter dict de profissionais para lista
            resultado_paciente = []
            for pac_id, pac_data in por_paciente.items():
                pac_data['profissionais'] = list(pac_data['profissionais_dict'].values())
                del pac_data['profissionais_dict']
                resultado_paciente.append(pac_data)
            
            # Ordenar por nome do paciente
            resultado_paciente.sort(key=lambda x: x['paciente_nome'])
            
            logger.info(f"✅ Resumo mensal: {len(resultado_profissional)} profissionais, {len(resultado_paciente)} pacientes")
            
            return {
                'periodo': {
                    'ano': ano,
                    'mes': mes,
                    'data_inicio': data_inicio,
                    'data_fim': data_fim
                },
                'por_profissional': resultado_profissional,
                'por_paciente': resultado_paciente,
                'total_consultas': len(registros)
            }
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar resumo mensal: {str(e)}")
            raise
