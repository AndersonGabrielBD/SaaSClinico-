from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, model_validator

_VALORES_KEYS = frozenset(
    {"titulo_resumo", "conteudo", "observacoes", "humor", "comportamento"}
)


def normalize_valores_padrao(raw: Any) -> Dict[str, str]:
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        return {}
    out: Dict[str, str] = {}
    for k in _VALORES_KEYS:
        if k not in raw or raw[k] is None:
            continue
        out[k] = str(raw[k])
    return out


class ModeloEvolucaoCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    valores_padrao: Dict[str, str] = Field(default_factory=dict)
    ordem: int = 0

    @model_validator(mode="before")
    @classmethod
    def _normalize_valores(cls, data: Any):
        if isinstance(data, dict) and "valores_padrao" in data:
            data = dict(data)
            data["valores_padrao"] = normalize_valores_padrao(data.get("valores_padrao"))
        return data


class ModeloEvolucaoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    valores_padrao: Optional[Dict[str, str]] = None
    ordem: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_valores(cls, data: Any):
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "valores_padrao" in data and data["valores_padrao"] is not None:
            data["valores_padrao"] = normalize_valores_padrao(data["valores_padrao"])
        return data


class ModeloEvolucaoResponse(BaseModel):
    id: str
    clinica_id: str
    usuario_id: str
    nome: str
    valores_padrao: Dict[str, str]
    ordem: int
    data_criacao: datetime
    data_atualizacao: datetime

    class Config:
        from_attributes = True
