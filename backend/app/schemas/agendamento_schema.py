# filepath: backend/app/schemas/agendamento_schema.py
from pydantic import BaseModel, Field
from datetime import datetime, time
from typing import Optional


class AgendamentoBase(BaseModel):
    """Schema base de agendamento"""
    paciente_id: str = Field(..., description="ID do paciente")
    profissional_id: str = Field(..., description="ID do profissional")
    sala_id: Optional[str] = Field(None, description="ID da sala (opcional)")
    data_agendamento: str = Field(..., description="Data (YYYY-MM-DD)")
    horario_inicio: str = Field(..., description="Horário início (HH:MM)")
    horario_fim: str = Field(..., description="Horário fim (HH:MM)")
    tipo_atendimento: str = Field(default="Avaliação", description="Tipo de atendimento")
    observacoes: Optional[str] = Field(None, description="Observações")


class AgendamentoCreate(AgendamentoBase):
    """Schema para criar agendamento"""
    pass


class AgendamentoUpdate(BaseModel):
    """Schema para atualizar agendamento"""
    status: Optional[str] = Field(None, description="Status do agendamento")
    observacoes: Optional[str] = None
    horario_inicio: Optional[str] = None
    horario_fim: Optional[str] = None


class AgendamentoResponse(AgendamentoBase):
    """Schema para resposta de agendamento"""
    id: str
    clinica_id: str
    status: str
    data_criacao: datetime
    data_atualizacao: datetime
    
    class Config:
        from_attributes = True


class AgendamentoConflictCheck(BaseModel):
    """Schema para verificar conflitos"""
    profissional_id: str
    sala_id: Optional[str] = None
    data_agendamento: str
    horario_inicio: str
    horario_fim: str
    agendamento_id: Optional[str] = None  # Se updating, excluir este ID


class ListaAgendamentosResponse(BaseModel):
    """Schema para listar agendamentos"""
    total: int
    data: list[AgendamentoResponse]
    filtros: Optional[dict] = None
