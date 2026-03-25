# filepath: backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = True) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() not in ('false', '0', 'no', 'off')


class Config:
    """Configuração centralizada da aplicação"""

    # Flask — SECRET_KEY não tem fallback intencional: ausência é detectada em validate()
    SECRET_KEY = os.getenv('SECRET_KEY')
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'production')
    
    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')
    
    # CORS — sem default permissivo; deve ser configurado explicitamente
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000')
    
    # Frontend
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Email (Resend)
    RESEND_API_KEY = os.getenv('RESEND_API_KEY')
    FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@clinflow.com')
    FROM_NAME = os.getenv('FROM_NAME', 'ClinFlow')
    
    # Files
    ALLOWED_FILE_TYPES = os.getenv('ALLOWED_FILE_TYPES', 'pdf,png,jpg,jpeg,doc,docx').split(',')
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

    # Signup: em produção use ALLOW_PUBLIC_SIGNUP=false e/ou SIGNUP_INVITE_CODE
    ALLOW_PUBLIC_SIGNUP = _env_bool('ALLOW_PUBLIC_SIGNUP', True)
    SIGNUP_INVITE_CODE = (os.getenv('SIGNUP_INVITE_CODE') or '').strip()

    @classmethod
    def validate(cls):
        """Valida se as variáveis obrigatórias estão configuradas para o backend."""
        required = [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',  # Backend usa só esta key (bypassa RLS)
            'SECRET_KEY'
        ]
        missing = [var for var in required if not getattr(cls, var)]
        if missing:
            raise ValueError(
                f'Variáveis de ambiente faltando: {", ".join(missing)}. '
                'SUPABASE_SERVICE_ROLE_KEY: Supabase → Settings → API → service_role.'
            )
