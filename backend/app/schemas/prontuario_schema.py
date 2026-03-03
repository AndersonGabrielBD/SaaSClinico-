# filepath: backend/app/schemas/prontuario_schema.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class EvolucaoBase(BaseModel):
    descricao: str = Field(..., min_length=1, description="Descrição da evolução")
    titulo: Optional[str] = None


class EvolucaoCreate(EvolucaoBase):
    prontuario_id: str
    criado_por: str


class EvolucaoUpdate(BaseModel):
    descricao: Optional[str] = None
    titulo: Optional[str] = None


class EvolucaoResponse(EvolucaoBase):
    id: str
    prontuario_id: str
    criado_por: str
    data_criacao: datetime
    data_atualizacao: datetime
    imutavel: bool

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
