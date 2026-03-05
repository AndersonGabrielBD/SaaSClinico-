# filepath: backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuração centralizada da aplicação"""
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')
    
    # Supabase
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    
    # Frontend
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    
    # Email (Resend)
    RESEND_API_KEY = os.getenv('RESEND_API_KEY')
    FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@clinflow.com')
    FROM_NAME = os.getenv('FROM_NAME', 'ClinFlow')
    
    # Files
    ALLOWED_FILE_TYPES = os.getenv('ALLOWED_FILE_TYPES', 'pdf,png,jpg,jpeg,doc,docx').split(',')
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    
    @classmethod
    def validate(cls):
        """Valida se as variáveis obrigatórias estão configuradas"""
        required = [
            'SUPABASE_URL',
            'SUPABASE_KEY',
            'SECRET_KEY'
        ]
        missing = [var for var in required if not getattr(cls, var)]
        if missing:
            raise ValueError(f'Variáveis de ambiente faltando: {", ".join(missing)}')
