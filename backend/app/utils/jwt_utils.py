# filepath: backend/app/utils/jwt_utils.py
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify

def create_token(user_data):
    """Cria um JWT token"""
    payload = {
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

def require_auth(f):
    """Decorator para proteger rotas autenticadas"""
    import logging
    logger = logging.getLogger(__name__)
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_token_from_header()
        logger.info(f"🔐 [AUTH] Token presente: {bool(token)}")
        
        if not token:
            logger.error("❌ [AUTH] Token não fornecido")
            return jsonify({'error': 'Token não fornecido'}), 401
        
        try:
            payload = decode_token(token)
            logger.info(f"🔐 [AUTH] Token decodificado: {payload}")
            request.user = payload  # Adiciona dados do usuário ao request
            return f(*args, **kwargs)
        except ValueError as e:
            logger.error(f"❌ [AUTH] Erro ao decodificar token: {str(e)}")
            return jsonify({'error': str(e)}), 401
    
    return decorated_function

def get_current_user():
    """Retorna o usuário atual da requisição"""
    import logging
    logger = logging.getLogger(__name__)
    
    user = getattr(request, 'user', None)
    logger.info(f"👤 [GET_USER] User do request: {user}")
    
    if user:
        # Garantir que 'id' esteja presente
        if 'user_id' in user and 'id' not in user:
            user['id'] = user['user_id']
            logger.info(f"👤 [GET_USER] Adicionado 'id' a partir de 'user_id': {user['id']}")
    
    logger.info(f"👤 [GET_USER] User final retornado: {user}")
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
            import logging
            logger = logging.getLogger(__name__)
            
            # Primeiro verifica se está autenticado
            user = get_current_user()
            if not user:
                logger.error("❌ [ROLES] Usuário não autenticado")
                return jsonify({'error': 'Autenticação necessária'}), 401
            
            # Verifica se o usuário tem permissão
            user_role = user.get('role', '').lower()
            allowed_roles_lower = [role.lower() for role in allowed_roles]
            
            logger.info(f"🔐 [ROLES] User role: {user_role}, Permitidas: {allowed_roles_lower}")
            
            if user_role not in allowed_roles_lower:
                logger.error(f"❌ [ROLES] Acesso negado. Role '{user_role}' não autorizada")
                return jsonify({
                    'error': 'Acesso negado',
                    'message': f'Esta ação requer uma das seguintes permissões: {", ".join(allowed_roles)}'
                }), 403
            
            logger.info(f"✅ [ROLES] Acesso autorizado para role '{user_role}'")
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator

