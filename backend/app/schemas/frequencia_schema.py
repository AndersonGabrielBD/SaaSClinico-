# filepath: backend/app/schemas/frequencia_schema.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class FrequenciaCreate(BaseModel):
    """Schema para registro de frequência"""
    paciente_id: str = Field(..., description="UUID do paciente")
    profissional_id: str = Field(..., description="UUID do profissional")
    agendamento_id: Optional[str] = Field(None, description="UUID do agendamento relacionado")
    data_atendimento: date = Field(..., description="Data do atendimento")
    compareceu: bool = Field(..., description="Paciente compareceu ao atendimento?")
    observacoes: Optional[str] = None

    class Config:
        from_attributes = True


class FrequenciaResponse(BaseModel):
    """Schema de resposta de frequência"""
    id: str
    clinica_id: str
    paciente_id: str
    profissional_id: str
    agendamento_id: Optional[str]
    data_atendimento: date
    compareceu: bool
    observacoes: Optional[str]
    registrado_por: str
    data_criacao: datetime
    
    # Dados adicionais via join
    paciente_nome: Optional[str] = None
    profissional_nome: Optional[str] = None
    
    class Config:
        from_attributes = True


class EstatisticasFrequenciaResponse(BaseModel):
    """Schema para estatísticas de frequência"""
    paciente_id: str
    profissional_id: str
    total_atendimentos: int
    total_comparecimentos: int
    total_faltas: int
    percentual_presenca: float
    
    # Dados adicionais
    paciente_nome: Optional[str] = None
    profissional_nome: Optional[str] = None
    
    class Config:
        from_attributes = True


class FrequenciaPorProfissional(BaseModel):
    """Schema para frequência agrupada por profissional"""
    profissional_id: str
    profissional_nome: str
    total_atendimentos: int
    total_comparecimentos: int
    total_faltas: int
    percentual_presenca: float
    
    class Config:
        from_attributes = True
