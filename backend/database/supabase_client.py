"""
Cliente Supabase - cria uma nova instância por request para evitar conexões stale.
O cliente Supabase é stateless (HTTP/REST), portanto criar uma instância por request
é seguro e elimina o problema de conexões keepalive que ficam stale silenciosamente.
"""
from supabase import create_client, Client
from config import Config
import logging

logger = logging.getLogger(__name__)


def reset_supabase_client():
    """Mantido por compatibilidade com código existente (no-op)."""
    pass


def get_supabase_client() -> Client:
    """
    Retorna uma nova instância do cliente Supabase a cada chamada.
    Usa service_role key se disponível (bypassa RLS), senão usa anon key.

    Não usa singleton para evitar conexões HTTP keepalive stale que retornam
    dados vazios silenciosamente sem lançar exceção.
    """
    key = Config.SUPABASE_SERVICE_ROLE_KEY or Config.SUPABASE_KEY

    if not Config.SUPABASE_SERVICE_ROLE_KEY:
        logger.warning("⚠️  SERVICE_ROLE key não configurada! Usando ANON key (com RLS ativo)")

    try:
        client = create_client(Config.SUPABASE_URL, key)
        return client
    except Exception as e:
        logger.error(f"❌ [SUPABASE] Erro ao criar cliente: {str(e)}")
        raise
