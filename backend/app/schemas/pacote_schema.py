# filepath: backend/app/schemas/pacote_schema.py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# =============================================================================
# TIPOS DE PROFISSIONAL
# =============================================================================

class TipoProfissionalCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    valor_mensal: Decimal = Field(..., gt=0)

    @validator('valor_mensal')
    def validar_valor(cls, v):
        return round(v, 2)

    @validator('nome')
    def validar_nome(cls, v):
        return v.strip()


class TipoProfissionalUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=100)
    valor_mensal: Optional[Decimal] = Field(None, gt=0)
    ativo: Optional[bool] = None

    @validator('valor_mensal')
    def validar_valor(cls, v):
        return round(v, 2) if v is not None else v

    @validator('nome')
    def validar_nome(cls, v):
        return v.strip() if v is not None else v


class TipoProfissionalResponse(BaseModel):
    id: str
    clinica_id: str
    nome: str
    valor_mensal: Decimal
    ativo: bool
    data_criacao: datetime
    data_atualizacao: datetime

    class Config:
        from_attributes = True


# =============================================================================
# ITENS DO PACOTE
# =============================================================================

class PacoteItemInput(BaseModel):
    tipo_profissional_id: str = Field(..., description="UUID do tipo de profissional")
    quantidade: int = Field(1, ge=1)


class PacoteItemResponse(BaseModel):
    id: str
    tipo_profissional_id: str
    quantidade: int
    tipo_nome: Optional[str] = None
    valor_mensal: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None

    class Config:
        from_attributes = True


# =============================================================================
# PACOTES POR PACIENTE
# =============================================================================

class PacoteCreate(BaseModel):
    paciente_id: str = Field(..., description="UUID do paciente")
    dia_vencimento: int = Field(..., ge=1, le=31)
    observacoes: Optional[str] = None
    itens: List[PacoteItemInput] = Field(..., min_items=1)


class PacoteUpdate(BaseModel):
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    ativo: Optional[bool] = None
    observacoes: Optional[str] = None
    itens: Optional[List[PacoteItemInput]] = None


class PacoteResponse(BaseModel):
    id: str
    clinica_id: str
    paciente_id: str
    dia_vencimento: int
    ativo: bool
    observacoes: Optional[str]
    criado_por: Optional[str]
    data_criacao: datetime
    data_atualizacao: datetime
    paciente_nome: Optional[str] = None
    itens: List[PacoteItemResponse] = []
    valor_total: Decimal = Decimal('0.00')

    class Config:
        from_attributes = True


# =============================================================================
# PAGAMENTOS DE PACOTES
# =============================================================================

class MarcarPagoPacoteRequest(BaseModel):
    metodo_pagamento: str = Field(..., pattern='^(cartao|dinheiro|transferencia|pix|cheque)$')
    valor_pago: Decimal = Field(..., gt=0)
    data_pagamento: Optional[datetime] = None
    observacoes: Optional[str] = None


class AlterarVencimentoPacoteRequest(BaseModel):
    nova_data_vencimento: date = Field(..., description="Nova data de vencimento YYYY-MM-DD")

    @validator('nova_data_vencimento', pre=True)
    def normalizar_data(cls, v):
        if isinstance(v, date):
            return v
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, str):
            val = v.strip()
            if '/' in val:
                try:
                    from datetime import datetime as dt
                    return dt.strptime(val, '%d/%m/%Y').date()
                except ValueError:
                    pass
            if len(val) >= 10:
                try:
                    from datetime import datetime as dt
                    return dt.strptime(val[:10], '%Y-%m-%d').date()
                except ValueError:
                    pass
        raise ValueError('nova_data_vencimento deve estar no formato YYYY-MM-DD ou DD/MM/YYYY')


class PagamentoPacoteResponse(BaseModel):
    id: str
    clinica_id: str
    pacote_id: str
    paciente_id: str
    mes_referencia: date
    status: str
    data_vencimento: date
    data_pagamento: Optional[datetime]
    valor_pago: Optional[Decimal]
    metodo_pagamento: Optional[str]
    observacoes: Optional[str]
    registrado_por: Optional[str]
    data_criacao: datetime
    data_atualizacao: datetime
    paciente_nome: Optional[str] = None
    valor_total_pacote: Optional[Decimal] = None

    class Config:
        from_attributes = True
