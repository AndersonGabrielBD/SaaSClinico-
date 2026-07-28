# filepath: backend/app/utils/jwt_utils.py
import jwt
import os
import logging
import time
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

logger = logging.getLogger(__name__)

_SECRET_KEY_CACHE = None


def _get_secret() -> str:
    """Returns SECRET_KEY, raising at startup if not configured."""
    global _SECRET_KEY_CACHE
    if _SECRET_KEY_CACHE is None:
        key = os.getenv('SECRET_KEY')
        if not key:
            raise RuntimeError(
                "SECRET_KEY não está definida. Configure a variável de ambiente SECRET_KEY "
                "com um valor aleatório seguro (ex: openssl rand -hex 32)."
            )
        _SECRET_KEY_CACHE = key
    return _SECRET_KEY_CACHE


def create_token(user_data: dict) -> str:
    """Creates a signed JWT. Expiry is 8 hours — short enough to limit staleness."""
    payload = {
        'sub': user_data['id'],
        'user_id': user_data['id'],
        'email': user_data['email'],
        'exp': datetime.utcnow() + timedelta(hours=8),
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, _get_secret(), algorithm='HS256')


def decode_token(token: str) -> dict:
    """Decodes and verifies a JWT. Raises ValueError on any failure."""
    try:
        if token.startswith("Bearer "):
            token = token[7:]
        return jwt.decode(token, _get_secret(), algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise ValueError('Token expirado')
    except jwt.InvalidTokenError:
        raise ValueError('Token inválido')


def get_token_from_header() -> str | None:
    """Extracts the raw token from the Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]
    return None


def get_access_token() -> str:
    """Returns the full Authorization header value (Bearer <token>)."""
    return request.headers.get('Authorization', '')


FETCH_USUARIO_RETRY_DELAYS = (0.3, 0.6)


def fetch_usuario_row(user_id: str, select_fields: str) -> dict | None:
    """
    Looks up a single row in 'usuarios' by id, retrying on an empty result.

    Uses limit(1) instead of maybe_single() — maybe_single() returns HTTP 406 on
    0 rows with some supabase-py versions, which breaks auth on every request.

    Exceptions (network hiccups, Supabase timeouts, etc.) are intentionally
    NOT caught here — callers should let them propagate to a 500, never treat
    an infra error as "usuário não encontrado" (401) and force a spurious logout.

    Retries on an empty result: when a page fires several authenticated
    requests in parallel (e.g. right after login), the burst of concurrent
    lookups against Supabase/PostgREST has been observed to intermittently
    return 0 rows for a user that unquestionably exists (confirmed moments
    earlier by the login query itself). Production timing showed the flaky
    window can outlast a single 150ms retry — failing requests measured
    ~450-550ms total, consistent with two back-to-back empty attempts 150ms
    apart. Backing off further (300ms, then 600ms) gives the condition more
    room to clear. A user that's genuinely gone still fails every attempt.
    """
    from database.supabase_client import get_supabase_client

    def _query():
        res = (
            get_supabase_client()
            .table('usuarios')
            .select(select_fields)
            .eq('id', user_id)
            .limit(1)
            .execute()
        )
        rows = res.data if res and res.data else []
        return rows[0] if rows else None

    row = _query()
    if row is None:
        for attempt, delay in enumerate(FETCH_USUARIO_RETRY_DELAYS, start=2):
            time.sleep(delay)
            row = _query()
            if row is not None:
                logger.warning(f"[AUTH] Usuário {user_id} veio vazio, apareceu na tentativa {attempt}")
                break
    return row


_USER_VALIDATION_TTL = 30  # segundos — trade-off aceito: revogar acesso leva até 30s pra valer
_user_validation_cache: dict[str, tuple[float, dict]] = {}


def _fetch_user_from_db(user_id: str) -> dict | None:
    """
    Fetches live clinica_id, role and ativo from the database.
    This ensures stale JWT claims never grant access to the wrong tenant or role.

    Cacheado por processo por até _USER_VALIDATION_TTL segundos: sob rajada de
    requisições paralelas do mesmo usuário (ex: uma página que dispara várias
    chamadas autenticadas ao mesmo tempo), evita repetir a mesma consulta várias
    vezes em sequência — reduz tanto a carga no Supabase quanto a chance de bater
    na instabilidade que motivou o retry em fetch_usuario_row. Resultados vazios
    (usuário não encontrado) não são cacheados, para não travar um falso-negativo
    transitório pela janela toda — esse caso já é coberto pelo retry.
    """
    cached = _user_validation_cache.get(user_id)
    if cached and cached[0] > time.time():
        return cached[1]

    row = fetch_usuario_row(user_id, 'id, clinica_id, role, nome_completo, ativo')
    if row is not None:
        _user_validation_cache[user_id] = (time.time() + _USER_VALIDATION_TTL, row)
    return row


def require_auth(f):
    """
    Decorator that:
    1. Validates the JWT signature and expiry.
    2. Re-checks clinica_id, role and ativo (cached up to _USER_VALIDATION_TTL
       seconds — see _fetch_user_from_db) — so a change to the user's record
       takes effect within that window, without waiting for the token to expire.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401

        try:
            payload = decode_token(token)
        except ValueError as e:
            logger.warning(f"[AUTH] Token inválido: {e}")
            return jsonify({'error': str(e)}), 401

        user_id = payload.get('user_id') or payload.get('sub')
        if not user_id:
            return jsonify({'error': 'Token malformado'}), 401

        try:
            db_user = _fetch_user_from_db(user_id)
        except Exception as e:
            logger.error(f"[AUTH] Falha ao validar usuário no banco: {e}")
            return jsonify({'error': 'Erro interno de autenticação'}), 500

        if not db_user:
            return jsonify({'error': 'Usuário não encontrado'}), 401

        if not db_user.get('ativo', True):
            return jsonify({'error': 'Usuário inativo'}), 401

        # Merge DB data into the payload so routes always see live values
        payload['id'] = db_user['id']
        payload['clinica_id'] = db_user['clinica_id']
        payload['role'] = db_user['role']
        payload['nome_completo'] = db_user.get('nome_completo', '')

        request.user = payload
        return f(*args, **kwargs)

    return decorated_function


def get_current_user() -> dict | None:
    """Returns the current request user (populated by require_auth)."""
    user = getattr(request, 'user', None)
    if user and 'user_id' in user and 'id' not in user:
        user['id'] = user['user_id']
    return user


def require_roles(allowed_roles: list[str]):
    """
    Decorator that restricts access to users with specific roles.
    Must be used after @require_auth.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Autenticação necessária'}), 401

            user_role = user.get('role', '').lower()
            allowed_lower = [r.lower() for r in allowed_roles]

            if user_role not in allowed_lower:
                return jsonify({
                    'error': 'Acesso negado',
                    'message': f'Esta ação requer uma das seguintes permissões: {", ".join(allowed_roles)}'
                }), 403

            return f(*args, **kwargs)

        return decorated_function
    return decorator
