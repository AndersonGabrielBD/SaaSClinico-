"""
Cliente Supabase centralizado
"""
from supabase import create_client, Client
from config import Config
import logging

logger = logging.getLogger(__name__)

_supabase_client = None

def get_supabase_client() -> Client:
    """
    Retorna uma instância singleton do cliente Supabase
    Usa service_role key se disponível (para backend), senão usa anon key
    """
    global _supabase_client
    
    if _supabase_client is None:
        # Priorizar service_role key para operações de backend (bypassa RLS)
        key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_KEY
        
        # Determinar qual key está sendo usada
        using_service_role = bool(Config.SUPABASE_SERVICE_ROLE_KEY)
        logger.info(f"🔑 Inicializando Supabase com {'SERVICE_ROLE' if using_service_role else 'ANON'} key")
        
        # Criar client com headers explícitos
        _supabase_client = create_client(
            Config.SUPABASE_URL,
            key,
            options={
                "headers": {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }
        )
    
    return _supabase_client
