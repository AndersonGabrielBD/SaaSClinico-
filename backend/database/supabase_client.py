"""
Cliente Supabase centralizado com reconexão automática
"""
from supabase import create_client, Client
from config import Config
import logging
import time

logger = logging.getLogger(__name__)

_supabase_client = None
_last_connection_time = None
_connection_timeout = 300  # 5 minutos


def reset_supabase_client():
    """Reseta o cliente Supabase forçando reconexão"""
    global _supabase_client, _last_connection_time
    logger.warning("🔄 [SUPABASE] Resetando cliente Supabase...")
    _supabase_client = None
    _last_connection_time = None


def get_supabase_client() -> Client:
    """
    Retorna uma instância singleton do cliente Supabase com reconexão automática.
    Usa service_role key se disponível (para backend, bypassa RLS), senão usa anon key.
    
    IMPORTANTE: Para operações de backend, sempre use SERVICE_ROLE key que bypassa RLS.
    As validações de permissão devem ser feitas no nível da aplicação, não no RLS.
    """
    global _supabase_client, _last_connection_time
    
    # Se cliente existe, verifica se precisa reconectar por timeout
    if _supabase_client is not None and _last_connection_time is not None:
        tempo_decorrido = time.time() - _last_connection_time
        if tempo_decorrido > _connection_timeout:
            logger.warning(f"⏰ [SUPABASE] Timeout de {tempo_decorrido:.0f}s excedido. Reconectando...")
            reset_supabase_client()
    
    if _supabase_client is None:
        # Priorizar service_role key para operações de backend (bypassa RLS)
        key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_KEY
        
        # Determinar qual key está sendo usada
        using_service_role = bool(Config.SUPABASE_SERVICE_ROLE_KEY)
        logger.info(f"🔑 Inicializando Supabase com {'SERVICE_ROLE' if using_service_role else 'ANON'} key")
        
        if not using_service_role:
            logger.warning("⚠️  SERVICE_ROLE key não configurada! Usando ANON key (com RLS ativo)")
        
        try:
            # Criar client
            _supabase_client = create_client(
                Config.SUPABASE_URL,
                key
            )
            _last_connection_time = time.time()
            logger.info("✅ [SUPABASE] Cliente conectado com sucesso")
        except Exception as e:
            logger.error(f"❌ [SUPABASE] Erro ao conectar: {str(e)}")
            raise
    
    return _supabase_client
