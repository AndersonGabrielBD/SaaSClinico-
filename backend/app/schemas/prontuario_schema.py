# filepath: backend/app/schemas/prontuario_schema.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class EvolucaoCreate(BaseModel):
    conteudo: str = Field(..., min_length=1, description="Texto principal da evolução")
    titulo_resumo: Optional[str] = None
    observacoes_confidenciais: Optional[str] = None
    observacoes: Optional[str] = None
    humor: Optional[str] = None
    comportamento: Optional[str] = None
    data_sessao: Optional[datetime] = None
    agendamento_id: Optional[str] = None


class EvolucaoUpdate(BaseModel):
    conteudo: Optional[str] = None
    titulo_resumo: Optional[str] = None
    observacoes_confidenciais: Optional[str] = None
    observacoes: Optional[str] = None
    humor: Optional[str] = None
    comportamento: Optional[str] = None
    data_sessao: Optional[datetime] = None
    agendamento_id: Optional[str] = None


class EvolucaoResponse(BaseModel):
    id: str
    clinica_id: str
    prontuario_id: str
    agendamento_id: Optional[str] = None
    conteudo: str
    titulo_resumo: Optional[str] = None
    observacoes_confidenciais: Optional[str] = None
    observacoes: Optional[str] = None
    humor: Optional[str] = None
    comportamento: Optional[str] = None
    data_sessao: Optional[datetime] = None
    imutavel: bool = False
    data_criacao: datetime
    data_atualizacao: datetime
    criado_por: str

    class Config:
        from_attributes = True


class AnexoBase(BaseModel):
    nome_arquivo: str
    tipo_arquivo: str
    tamanho_bytes: int


class AnexoResponse(AnexoBase):
    id: str
    prontuario_id: str
    evolucao_id: Optional[str] = None
    caminho_arquivo: str
    data_criacao: datetime

    class Config:
        from_attributes = True


class ProntuarioBase(BaseModel):
    paciente_id: str = Field(..., description="ID do paciente")
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    diagnostico_preliminar: Optional[str] = None
    notas: Optional[str] = None


class ProntuarioCreate(ProntuarioBase):
    pass


class ProntuarioUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    diagnostico_preliminar: Optional[str] = None
    notas: Optional[str] = None


class ProntuarioResponse(ProntuarioBase):
    id: str
    clinica_id: str
    criado_por: str
    data_criacao: datetime
    data_atualizacao: datetime
    ativo: bool

    class Config:
        from_attributes = True


class ProntuarioDetailResponse(ProntuarioResponse):
    evolucoes: List[EvolucaoResponse] = []
    anexos: List[AnexoResponse] = []
