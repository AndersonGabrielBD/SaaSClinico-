# filepath: backend/app/schemas/mensalidade_schema.py
from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class MensalidadeCreate(BaseModel):
    """Schema para criação de mensalidade"""
    paciente_id: str = Field(..., description="UUID do paciente")
    valor_mensalidade: Decimal = Field(..., gt=0, description="Valor da mensalidade")
    dia_vencimento: int = Field(..., ge=1, le=31, description="Dia do mês para vencimento")
    observacoes: Optional[str] = None

    @validator('valor_mensalidade')
    def validar_valor(cls, v):
        if v <= 0:
            raise ValueError('Valor deve ser positivo')
        return round(v, 2)


class MensalidadeUpdate(BaseModel):
    """Schema para atualização de mensalidade"""
    valor_mensalidade: Optional[Decimal] = Field(None, gt=0)
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    ativo: Optional[bool] = None
    observacoes: Optional[str] = None

    @validator('valor_mensalidade')
    def validar_valor(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Valor deve ser positivo')
        return round(v, 2) if v else v


class MensalidadeResponse(BaseModel):
    """Schema de resposta de mensalidade"""
    id: str
    clinica_id: str
    paciente_id: str
    valor_mensalidade: Decimal
    dia_vencimento: int
    ativo: bool
    observacoes: Optional[str]
    criado_por: str
    data_criacao: datetime
    data_atualizacao: datetime
    
    # Dados do paciente (opcional, via join)
    paciente_nome: Optional[str] = None
    
    class Config:
        from_attributes = True


class PagamentoCreate(BaseModel):
    """Schema para criação de pagamento mensal"""
    mensalidade_id: str = Field(..., description="UUID da mensalidade")
    paciente_id: str = Field(..., description="UUID do paciente")
    mes_referencia: date = Field(..., description="Primeiro dia do mês de referência")
    data_vencimento: date = Field(..., description="Data de vencimento")
    valor_pago: Optional[Decimal] = Field(None, gt=0)

    @validator('mes_referencia')
    def validar_mes_referencia(cls, v):
        """Garantir que é o primeiro dia do mês"""
        if v.day != 1:
            raise ValueError('mes_referencia deve ser o primeiro dia do mês')
        return v


class PagamentoUpdate(BaseModel):
    """Schema para atualização de pagamento"""
    status: Optional[str] = Field(None, pattern='^(pendente|pago|parcial|cancelado)$')
    data_pagamento: Optional[datetime] = None
    valor_pago: Optional[Decimal] = Field(None, gt=0)
    metodo_pagamento: Optional[str] = Field(None, pattern='^(cartao|dinheiro|transferencia|pix|cheque)$')
    observacoes: Optional[str] = None


class MarcarPagoRequest(BaseModel):
    """Schema para marcar pagamento como pago"""
    metodo_pagamento: str = Field(..., pattern='^(cartao|dinheiro|transferencia|pix|cheque)$')
    valor_pago: Decimal = Field(..., gt=0)
    data_pagamento: Optional[datetime] = None
    observacoes: Optional[str] = None


class AlterarDataVencimentoRequest(BaseModel):
    """Schema para alterar data de vencimento"""
    nova_data_vencimento: date = Field(..., description="Nova data de vencimento")

    @validator('nova_data_vencimento', pre=True)
    def normalizar_data_vencimento(cls, v):
        if isinstance(v, date):
            return v

        if isinstance(v, datetime):
            return v.date()

        if isinstance(v, str):
            valor = v.strip()

            # Formato brasileiro DD/MM/YYYY
            if '/' in valor:
                try:
                    return datetime.strptime(valor, '%d/%m/%Y').date()
                except ValueError:
                    pass

            # ISO datetime/date -> usar apenas YYYY-MM-DD
            if len(valor) >= 10:
                try:
                    return datetime.strptime(valor[:10], '%Y-%m-%d').date()
                except ValueError:
                    pass

        raise ValueError('nova_data_vencimento deve estar no formato YYYY-MM-DD ou DD/MM/YYYY')


class PagamentoResponse(BaseModel):
    """Schema de resposta de pagamento"""
    id: str
    clinica_id: str
    mensalidade_id: str
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
    
    # Dados adicionais via join
    paciente_nome: Optional[str] = None
    valor_mensalidade: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class ProximoVencimentoResponse(BaseModel):
    """Schema para pagamentos com vencimento próximo"""
    pagamento_id: str
    paciente_id: str
    paciente_nome: str
    valor_pago: Decimal
    data_vencimento: date
    dias_ate_vencimento: int
    status: str
    mes_referencia: date
    
    class Config:
        from_attributes = True


class EstatisticasMensalidadesResponse(BaseModel):
    """Schema para estatísticas do sistema de mensalidades"""
    total_mensalidades_ativas: int
    total_pagamentos_pendentes: int
    total_pagamentos_mes_atual: int
    valor_total_pendente: Decimal
    valor_total_recebido_mes: Decimal
    taxa_inadimplencia: float
    
    class Config:
        from_attributes = True
