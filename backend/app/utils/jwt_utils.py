# filepath: backend/app/utils/jwt_utils.py
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

def create_token(user_data):
    """Cria um JWT token"""
    payload = {
        'sub': user_data['id'],  # 'sub' é necessário para RLS do Supabase
        'user_id': user_data['id'],
        'email': user_data['email'],
        'clinica_id': user_data.get('clinica_id'),
        'role': user_data.get('role', 'fono'),
        'exp': datetime.utcnow() + timedelta(days=7),
        'iat': datetime.utcnow()
    }
    
    secret = os.getenv('SECRET_KEY', 'dev-secret-key')
    return jwt.encode(payload, secret, algorithm='HS256')

def decode_token(token):
    """Decodifica um JWT token"""
    try:
        # Remove "Bearer " se existir
        if token.startswith("Bearer "):
            token = token[7:]
        
        secret = os.getenv('SECRET_KEY', 'dev-secret-key')
        return jwt.decode(token, secret, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        raise ValueError('Token expirado')
    except jwt.InvalidTokenError:
        raise ValueError('Token inválido')

def get_token_from_header():
    """Extrai o token do header Authorization"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.replace('Bearer ', '')
    return None

def get_access_token():
    """
    Retorna o token JWT completo do header (incluindo 'Bearer')
    Para uso com Supabase client
    """
    return request.headers.get('Authorization', '')

def require_auth(f):
    """Decorator para proteger rotas autenticadas"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({'error': 'Token não fornecido'}), 401
        try:
            payload = decode_token(token)
            request.user = payload
            return f(*args, **kwargs)
        except ValueError as e:
            import logging
            logging.getLogger(__name__).warning(f"[AUTH] Token inválido: {e}")
            return jsonify({'error': str(e)}), 401
    return decorated_function

def get_current_user():
    """Retorna o usuário atual da requisição"""
    user = getattr(request, 'user', None)
    if user and 'user_id' in user and 'id' not in user:
        user['id'] = user['user_id']
    return user


def require_roles(allowed_roles):
    """
    Decorator para restringir acesso baseado em roles.
    
    Uso:
        @require_roles(['admin', 'recepcao'])
        def minha_rota():
            ...
    
    Args:
        allowed_roles: Lista de roles permitidas (ex: ['admin', 'recepcao'])
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Autenticação necessária'}), 401
            user_role = user.get('role', '').lower()
            allowed_roles_lower = [role.lower() for role in allowed_roles]
            if user_role not in allowed_roles_lower:
                return jsonify({
                    'error': 'Acesso negado',
                    'message': f'Esta ação requer uma das seguintes permissões: {", ".join(allowed_roles)}'
                }), 403
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

