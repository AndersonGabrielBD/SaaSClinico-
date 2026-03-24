"""
Decorator e utilitários para audit log (LGPD).

Registra acessos a dados sensíveis (prontuários, pacientes, relatórios).
"""
import logging
from functools import wraps
from flask import request

logger = logging.getLogger(__name__)


def log_access(resource_type: str, action: str = 'view', id_param: str = None):
    """
    Decorator que registra acesso a recurso sensível no audit_log.

    Args:
        resource_type: tipo do recurso (prontuario, paciente, relatorio)
        action: tipo de ação (view, create, update, delete, export, download)
        id_param: nome do parâmetro de URL que contém o resource_id
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            result = f(*args, **kwargs)

            try:
                from app.utils.jwt_utils import get_current_user
                user = get_current_user()
                if not user:
                    return result

                resource_id = kwargs.get(id_param) if id_param else None

                _write_audit_log(
                    clinica_id=user.get('clinica_id'),
                    user_id=user.get('id'),
                    user_role=user.get('role'),
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                )
            except Exception as e:
                logger.warning(f"[AUDIT] Falha ao registrar audit log: {e}")

            return result

        return decorated_function
    return decorator


def audit_log_entry(clinica_id, user_id, user_role, action, resource_type, resource_id=None, details=None):
    """Registra entrada no audit log diretamente (sem decorator)."""
    try:
        _write_audit_log(clinica_id, user_id, user_role, action, resource_type, resource_id, details)
    except Exception as e:
        logger.warning(f"[AUDIT] Falha ao registrar audit log: {e}")


def _write_audit_log(clinica_id, user_id, user_role, action, resource_type, resource_id=None, details=None):
    """Persiste entrada no banco."""
    from database.supabase_client import get_supabase_client

    ip_address = request.remote_addr if request else None
    user_agent = request.headers.get('User-Agent', '')[:500] if request else None

    data = {
        'clinica_id': clinica_id,
        'user_id': user_id,
        'user_role': user_role,
        'action': action,
        'resource_type': resource_type,
        'resource_id': resource_id,
        'details': details or {},
        'ip_address': ip_address,
        'user_agent': user_agent,
    }

    get_supabase_client().table('audit_log').insert(data).execute()
