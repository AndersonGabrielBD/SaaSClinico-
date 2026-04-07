# filepath: backend/app/schemas/paciente_schema.py
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Any
from datetime import date, datetime

class PacienteBase(BaseModel):
    nome_completo: str
    cpf: Optional[str] = None

    @field_validator('cpf', mode='before')
    @classmethod
    def empty_cpf_to_none(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v
    data_nascimento: Optional[date] = None
    genero: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone_principal: Optional[str] = None
    telefone_secundario: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    responsavel_nome: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    responsavel_email: Optional[EmailStr] = None
    responsavel_relacao: Optional[str] = None
    observacoes: Optional[str] = None

class PacienteCreate(PacienteBase):
    pass

class PacienteUpdate(BaseModel):
    nome_completo: Optional[str] = None
    cpf: Optional[str] = None

    @field_validator('cpf', mode='before')
    @classmethod
    def empty_cpf_to_none(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s if s else None
        return v
    data_nascimento: Optional[date] = None
    genero: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone_principal: Optional[str] = None
    telefone_secundario: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    responsavel_nome: Optional[str] = None
    responsavel_telefone: Optional[str] = None
    responsavel_email: Optional[EmailStr] = None
    responsavel_relacao: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: Optional[bool] = None

class PacienteResponse(PacienteBase):
    id: str
    clinica_id: str
    ativo: bool
    data_criacao: datetime
    data_atualizacao: datetime
    criado_por: Optional[str]

    class Config:
        from_attributes = True
