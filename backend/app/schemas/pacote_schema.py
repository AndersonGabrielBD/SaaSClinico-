from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# =============================================================================
# TIPOS DE PROFISSIONAL
# =============================================================================

class TipoProfissionalCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    profissional_id: Optional[str] = None
    valor_sessao: Decimal = Field(..., gt=0)

    @validator('valor_sessao')
    def validar_valor(cls, v):
        return round(v, 2)

    @validator('nome')
    def validar_nome(cls, v):
        return v.strip()


class TipoProfissionalUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    profissional_id: Optional[str] = None
    valor_sessao: Optional[Decimal] = Field(None, gt=0)
    ativo: Optional[bool] = None

    @validator('valor_sessao')
    def validar_valor(cls, v):
        return round(v, 2) if v is not None else v

    @validator('nome')
    def validar_nome(cls, v):
        return v.strip() if v is not None else v


# =============================================================================
# ITENS DO PACOTE
# =============================================================================

class PacoteItemInput(BaseModel):
    tipo_profissional_id: str
    profissional_id: Optional[str] = None
    quantidade_sessoes: int = Field(1, ge=1)


# =============================================================================
# PACOTES
# =============================================================================

class PacoteCreate(BaseModel):
    paciente_id: str
    itens: List[PacoteItemInput] = Field(..., min_items=1)
    observacoes: Optional[str] = None


class PacoteUpdate(BaseModel):
    ativo: Optional[bool] = None
    observacoes: Optional[str] = None
    itens: Optional[List[PacoteItemInput]] = None


# =============================================================================
# PAGAMENTO DO PACOTE
# =============================================================================

class MarcarPagoPacoteRequest(BaseModel):
    metodo_pagamento: str = Field(..., pattern='^(cartao|dinheiro|transferencia|pix|cheque)$')
    valor_pago: Decimal = Field(..., gt=0)
    observacoes: Optional[str] = None

    @validator('valor_pago')
    def validar_valor(cls, v):
        return round(v, 2)
