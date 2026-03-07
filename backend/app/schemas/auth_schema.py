# filepath: backend/app/schemas/auth_schema.py
from pydantic import BaseModel, EmailStr
from typing import Optional

class ResetPasswordRequest(BaseModel):
    """Schema para solicitar código de reset de senha"""
    email: str  # CPF ou Email
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com"
            }
        }

class ResetPasswordWithCode(BaseModel):
    """Schema para resetar senha com código"""
    email: str  # CPF ou Email
    reset_code: str  # Código de 8 dígitos
    nova_senha: str  # Nova senha (mínimo 8 caracteres)
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "reset_code": "ABC123XY",
                "nova_senha": "novaSenha123"
            }
        }

class ResetCodeResponse(BaseModel):
    """Response ao solicitar código de reset"""
    sucesso: bool
    mensagem: str
    reset_code: Optional[str] = None  # Apenas em desenvolvimento/teste
    
    class Config:
        json_schema_extra = {
            "example": {
                "sucesso": True,
                "mensagem": "Código de reset gerado com sucesso. Código enviado para o email cadastrado."
            }
        }

class ResetPasswordResponse(BaseModel):
    """Response ao resetar senha"""
    sucesso: bool
    mensagem: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "sucesso": True,
                "mensagem": "Senha alterada com sucesso. Você pode fazer login agora."
            }
        }
