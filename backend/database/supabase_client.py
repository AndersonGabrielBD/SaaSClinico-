"""
Cliente Supabase. O backend usa SOMENTE a Service Role Key para que todas as
operações (incl. RLS) funcionem em produção; a autorização é feita no Flask
(@require_roles, etc.).
"""
from supabase import create_client, Client
from config import Config
import logging

logger = logging.getLogger(__name__)

_shared_client: Client | None = None


def _create_client(key: str) -> Client:
    try:
        return create_client(Config.SUPABASE_URL, key)
    except Exception as e:
        logger.error(f"❌ [SUPABASE] Erro ao criar cliente: {str(e)}")
        raise


def _require_service_role_key() -> str:
    key = Config.SUPABASE_SERVICE_ROLE_KEY
    if not key:
        raise RuntimeError(
            "SUPABASE_SERVICE_ROLE_KEY é obrigatória no .env do backend. "
            "Obtenha em: Supabase Dashboard → Settings → API → service_role (secret). "
            "Sem ela, operações em banco falham com RLS (erro 42501)."
        )
    return key


def get_supabase_client() -> Client:
    """
    Cliente Supabase compartilhado (singleton por processo), usando SOMENTE a
    Service Role Key. Reaproveitado entre chamadas — elimina abrir uma conexão
    HTTP nova a cada query. Seguro para table()/rpc() (chamadas stateless, com
    a mesma service role key sempre).

    NÃO use esta função para .auth.sign_in_with_password / .auth.sign_up /
    .auth.admin.* — essas mutam estado de sessão no objeto cliente
    (token/sessão em memória), o que vazaria entre requisições concorrentes se
    o cliente for compartilhado. Use get_auth_client() para essas.
    """
    global _shared_client
    if _shared_client is None:
        _shared_client = _create_client(_require_service_role_key())
    return _shared_client


def get_auth_client() -> Client:
    """
    Cliente descartável, criado do zero a cada chamada — nunca reaproveitado.
    Use SOMENTE para operações que mutam sessão no client
    (.auth.sign_in_with_password, .auth.sign_up, .auth.admin.*).
    """
    return _create_client(_require_service_role_key())


def reset_supabase_client():
    """Força a recriação do singleton (útil em testes/depuração)."""
    global _shared_client
    _shared_client = None
