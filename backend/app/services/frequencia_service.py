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
                .select('*, usuarios!profissional_id(nome)') \
                .eq('paciente_id', paciente_id) \
                .eq('clinica_id', clinica_id)
            
            if profissional_id:
                query = query.eq('profissional_id', profissional_id)
            
            response = query.order('data_atendimento', desc=True).execute()
            
            # Formatar resposta
            frequencias = []
            for item in response.data:
                profissional = item.pop('usuarios', None)
                if profissional:
                    item['profissional_nome'] = profissional.get('nome')
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
                .select('profissional_id, compareceu, usuarios!profissional_id(nome)') \
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
                        'profissional_nome': profissional.get('nome', 'Desconhecido'),
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
