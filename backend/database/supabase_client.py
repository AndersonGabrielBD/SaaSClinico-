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
    Retorna uma instância singleton do cliente Supabase.
    Usa service_role key se disponível (para backend, bypassa RLS), senão usa anon key.
    
    IMPORTANTE: Para operações de backend, sempre use SERVICE_ROLE key que bypassa RLS.
    As validações de permissão devem ser feitas no nível da aplicação, não no RLS.
    """
    global _supabase_client
    
    if _supabase_client is None:
        # Priorizar service_role key para operações de backend (bypassa RLS)
        key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_KEY
        
        # Determinar qual key está sendo usada
        using_service_role = bool(Config.SUPABASE_SERVICE_ROLE_KEY)
        logger.info(f"🔑 Inicializando Supabase com {'SERVICE_ROLE' if using_service_role else 'ANON'} key")
        
        if not using_service_role:
            logger.warning("⚠️  SERVICE_ROLE key não configurada! Usando ANON key (com RLS ativo)")
        
        # Criar client
        _supabase_client = create_client(
            Config.SUPABASE_URL,
            key
        )
    
    return _supabase_client
