"""
Cliente Supabase - cria uma nova instância por request para evitar conexões stale.
O backend usa SOMENTE a Service Role Key para que todas as operações (incl. RLS)
funcionem em produção; a autorização é feita no Flask (@require_roles, etc.).
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
    Retorna uma nova instância do cliente Supabase usando SOMENTE a Service Role Key.
    Necessária para o backend funcionar com RLS ativo (tipos_profissional, pacotes, etc.).
    """
    key = Config.SUPABASE_SERVICE_ROLE_KEY
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY é obrigatória no .env do backend. "
            "Obtenha em: Supabase Dashboard → Settings → API → service_role (secret). "
            "Sem ela, operações em banco falham com RLS (erro 42501)."
        )
    try:
        client = create_client(Config.SUPABASE_URL, key)
        return client
    except Exception as e:
        logger.error(f"❌ [SUPABASE] Erro ao criar cliente: {str(e)}")
        raise
