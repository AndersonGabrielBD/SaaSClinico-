# filepath: backend/app/utils/jwt_utils.py
import jwt
import os
import logging
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


def _fetch_user_from_db(user_id: str) -> dict | None:
    """
    Fetches live clinica_id, role and ativo from the database.
    This ensures stale JWT claims never grant access to the wrong tenant or role.
    """
    from database.supabase_client import get_supabase_client
    res = (
        get_supabase_client()
        .table('usuarios')
        .select('id, clinica_id, role, nome_completo, ativo')
        .eq('id', user_id)
        .single()
        .execute()
    )
    return res.data if res.data else None


def require_auth(f):
    """
    Decorator that:
    1. Validates the JWT signature and expiry.
    2. Re-fetches clinica_id, role and ativo from the DB on every request —
       so any change to the user's record takes effect immediately without
       waiting for the token to expire.
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
