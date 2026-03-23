"""
Middleware de autenticação via Supabase Auth.

ATENÇÃO: As rotas da aplicação usam `require_auth` de `app.utils.jwt_utils`
(JWT HS256 assinado pelo backend). Este módulo não é usado nas rotas atuais
e está mantido apenas para compatibilidade eventual com fluxos que precisem
validar tokens Supabase diretamente (ex.: webhooks, integrações futuras).
"""
import logging
from functools import wraps
from flask import request, jsonify
from database import get_supabase_client

logger = logging.getLogger(__name__)


def jwt_required(f):
    """
    Validates a Supabase Auth token (not the backend HS256 JWT).
    Injects `request.user`, `request.clinica_id` and `request.user_role`.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'Token não enviado'}), 401

        try:
            token = auth_header.split(' ')[1]
            supabase = get_supabase_client()
            user = supabase.auth.get_user(token)

            if not user or not user.user:
                return jsonify({'error': 'Token inválido'}), 401

            request.user = user.user

            try:
                usuario_data = (
                    supabase.table('usuarios')
                    .select('clinica_id, role')
                    .eq('id', user.user.id)
                    .single()
                    .execute()
                )

                if usuario_data.data:
                    request.clinica_id = usuario_data.data.get('clinica_id')
                    request.user_role = usuario_data.data.get('role')
                else:
                    return jsonify({'error': 'Usuário não encontrado no sistema'}), 401

            except Exception as e:
                logger.error(f"[MIDDLEWARE] Erro ao buscar clinica_id: {e}")
                return jsonify({'error': 'Erro ao validar usuário'}), 401

        except Exception:
            return jsonify({'error': 'Token inválido'}), 401

        return f(*args, **kwargs)

    return decorated
