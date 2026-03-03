# filepath: backend/app/schemas/dashboard_schema.py
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProximaConsulta(BaseModel):
    id: str
    paciente_nome: str
    profissional_nome: str
    data_agendamento: str
    horario_inicio: str
    horario_fim: str
    tipo_atendimento: str
    status: str

class DashboardStatsResponse(BaseModel):
    total_pacientes: int
    pacientes_ativos: int
    consultas_hoje: int
    consultas_semana: int
    faturamento_mes: float
    taxa_comparecimento: float
    proximas_consultas: List[ProximaConsulta]

    class Config:
        from_attributes = True
