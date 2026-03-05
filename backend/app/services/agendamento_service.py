# filepath: backend/app/services/agendamento_service.py
from typing import List, Dict, Optional
from app.repositories.base_repository import BaseRepository
from app.schemas.agendamento_schema import AgendamentoCreate, AgendamentoUpdate
from app.utils.exceptions import (
    ConflictAgendamentoException,
    AgendamentoNaoEncontradoException,
    ValidationException,
)


class AgendamentoService:
    """Service de agendamentos - Implementa toda lógica de negócio"""
    
    def __init__(self):
        self.repository = BaseRepository("agendamentos")
    
    async def validar_conflito(
        self,
        clinica_id: str,
        profissional_id: str,
        sala_id: Optional[str],
        data_agendamento: str,
        horario_inicio: str,
        horario_fim: str,
        agendamento_id: Optional[str] = None,
    ) -> bool:
        """Valida se há conflito de horário"""
        from database.supabase_client import get_supabase_client
        
        # Validar formato dos horários
        try:
            h_inicio_parts = horario_inicio.split(":")
            h_fim_parts = horario_fim.split(":")
            h_inicio_min = int(h_inicio_parts[0]) * 60 + int(h_inicio_parts[1])
            h_fim_min = int(h_fim_parts[0]) * 60 + int(h_fim_parts[1])
            
            if h_inicio_min >= h_fim_min:
                raise ValidationException("Horário início deve ser antes do horário fim")
        except (ValueError, IndexError):
            raise ValidationException("Formato de horário inválido (use HH:MM)")
        
        # Query para verificar conflito
        try:
            client = get_supabase_client()
            repo = client.table("agendamentos")
            
            # Buscar agendamentos no mesmo dia para o profissional
            query = (
                repo
                .select("*")
                .eq("clinica_id", clinica_id)
                .eq("profissional_id", profissional_id)
                .eq("data_agendamento", data_agendamento)
                .neq("status", "cancelada")  # Ignorar cancelados
            )
            
            if agendamento_id:
                query = query.neq("id", agendamento_id)  # Se updating, excluir este ID
            
            response = query.execute()
            agendamentos = response.data or []
            
            # Verificar sobreposição
            for ag in agendamentos:
                ag_inicio_parts = ag["horario_inicio"].split(":")
                ag_fim_parts = ag["horario_fim"].split(":")
                ag_inicio_min = int(ag_inicio_parts[0]) * 60 + int(ag_inicio_parts[1])
                ag_fim_min = int(ag_fim_parts[0]) * 60 + int(ag_fim_parts[1])
                
                # Há sobreposição se: novo_inicio < ag_fim E novo_fim > ag_inicio
                if h_inicio_min < ag_fim_min and h_fim_min > ag_inicio_min:
                    return True  # Há conflito
            
            return False  # Sem conflito
            
        except Exception as e:
            raise Exception(f"Erro ao validar conflito: {str(e)}")
    
    async def criar_agendamento(
        self,
        clinica_id: str,
        user_id: str,
        data: AgendamentoCreate,
    ) -> Dict:
        """Cria novo agendamento com validação"""
        # Validar conflito
        tem_conflito = await self.validar_conflito(
            clinica_id=clinica_id,
            profissional_id=data.profissional_id,
            sala_id=data.sala_id,
            data_agendamento=data.data_agendamento,
            horario_inicio=data.horario_inicio,
            horario_fim=data.horario_fim,
        )
        
        if tem_conflito:
            raise ConflictAgendamentoException()
        
        # Preparar dados
        agendamento_data = {
            "clinica_id": clinica_id,
            "paciente_id": data.paciente_id,
            "profissional_id": data.profissional_id,
            "sala_id": data.sala_id,
            "data_agendamento": data.data_agendamento,
            "horario_inicio": data.horario_inicio,
            "horario_fim": data.horario_fim,
            "tipo_atendimento": data.tipo_atendimento,
            "observacoes": data.observacoes,
            "status": "agendada",
        }
        
        # Criar
        agendamento = await self.repository.create(agendamento_data)
        return agendamento
    
    async def listar_agendamentos(
        self,
        clinica_id: str,
        filtros: Optional[Dict] = None,
    ) -> List[Dict]:
        """Lista agendamentos da clínica com filtros opcionais"""
        agendamentos = await self.repository.get_all(clinica_id, filtros)
        return agendamentos
    
    async def atualizar_status(
        self,
        agendamento_id: str,
        novo_status: str,
    ) -> Dict:
        """Atualiza status do agendamento com validação de transições"""
        agendamento = await self.repository.get_by_id(agendamento_id)
        if not agendamento:
            raise AgendamentoNaoEncontradoException()
        
        # Validar transição
        status_atual = agendamento.get("status")
        transicoes_permitidas = {
            "agendada": ["confirmada", "cancelada", "faltou"],
            "confirmada": ["concluida", "cancelada", "faltou"],
            "concluida": [],  # Final
            "cancelada": [],  # Final
            "faltou": [],  # Final
        }
        
        if novo_status not in transicoes_permitidas.get(status_atual, []):
            raise ValidationException(
                f"Transição inválida: {status_atual} → {novo_status}"
            )
        
        # Atualizar
        update_data = {"status": novo_status}
        agendamento_atualizado = await self.repository.update(
            agendamento_id,
            update_data,
        )
        
        return agendamento_atualizado
    
    async def deletar_agendamento(
        self,
        agendamento_id: str,
    ) -> bool:
        """Deleta agendamento (soft delete)"""
        agendamento = await self.repository.get_by_id(agendamento_id)
        if not agendamento:
            raise AgendamentoNaoEncontradoException()
        
        # Usar update para soft delete
        await self.repository.update(
            agendamento_id,
            {"status": "cancelada"},
        )
        return True
