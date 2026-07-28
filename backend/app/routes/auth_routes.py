# filepath: backend/app/routes/auth_routes.py
import hmac
import logging

from flask import Blueprint, request, jsonify

from config import Config
from database.supabase_client import get_supabase_client
from app.extensions import limiter
from app.utils.jwt_utils import create_token, require_auth, get_current_user, fetch_usuario_row
from app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


def _signup_invite_ok(provided: str, expected: str) -> bool:
    if not expected:
        return True
    p = provided or ''
    if len(p) != len(expected):
        return False
    return hmac.compare_digest(p, expected)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit('15 per minute')
def login():
    """Login via Supabase Auth. Returns a signed JWT and the user profile."""
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email e senha são obrigatórios'}), 400

    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_in_with_password({
            'email': email,
            'password': password,
        })
    except Exception as e:
        logger.warning(f"[AUTH] Falha no login para {email}: {e}")
        return jsonify({'error': 'Credenciais inválidas'}), 401

    user_data = auth_response.user
    if not user_data:
        return jsonify({'error': 'Credenciais inválidas'}), 401

    # Fetch the clinic profile — never auto-create or guess a clinic
    try:
        profile = fetch_usuario_row(user_data.id, 'clinica_id, role, nome_completo, ativo')
    except Exception as e:
        logger.error(f"[AUTH] Erro ao buscar perfil do usuário {user_data.id}: {e}")
        return jsonify({'error': 'Erro ao carregar perfil do usuário'}), 500

    if not profile:
        logger.warning(f"[AUTH] Usuário {user_data.id} autenticado no Auth mas sem perfil em 'usuarios'")
        return jsonify({
            'error': (
                'Perfil de usuário não encontrado. '
                'Entre em contato com o administrador da clínica para que seu acesso seja configurado.'
            )
        }), 401

    if not profile.get('clinica_id'):
        logger.error(f"[AUTH] Usuário {user_data.id} sem clinica_id no perfil")
        return jsonify({'error': 'Usuário sem clínica associada. Contate o suporte.'}), 401

    if not profile.get('ativo', True):
        return jsonify({'error': 'Usuário inativo. Contate o administrador da clínica.'}), 401

    token = create_token({'id': user_data.id, 'email': user_data.email})

    return jsonify({
        'token': token,
        'user': {
            'id': user_data.id,
            'email': user_data.email,
            'clinica_id': profile['clinica_id'],
            'role': profile['role'],
            'nome_completo': profile.get('nome_completo', ''),
        },
    }), 200


@auth_bp.route('/signup', methods=['POST'])
@limiter.limit('5 per minute')
def signup():
    """
    Self-registration: creates a Supabase Auth user, a clinic record and an
    admin profile in a single flow. For additional users, the clinic admin
    should invite them via the user management screen.
    """
    if not Config.ALLOW_PUBLIC_SIGNUP:
        return jsonify({'error': 'Cadastro público não está disponível.'}), 403

    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip()
    password = data.get('password', '')
    nome = data.get('nome', '').strip()
    clinica_nome = data.get('clinica_nome', '').strip()

    if not all([email, password, nome, clinica_nome]):
        return jsonify({'error': 'Todos os campos são obrigatórios'}), 400

    if Config.SIGNUP_INVITE_CODE and not _signup_invite_ok(
        data.get('invite_code', ''), Config.SIGNUP_INVITE_CODE
    ):
        return jsonify({'error': 'Código de convite inválido.'}), 400

    supabase = get_supabase_client()

    try:
        auth_response = supabase.auth.sign_up({'email': email, 'password': password})
        user = auth_response.user
        if not user:
            return jsonify({'error': 'Erro ao criar conta. Tente novamente.'}), 400
    except Exception as e:
        logger.warning(f"[AUTH] Falha no signup para {email}: {e}")
        return jsonify({
            'error': 'Não foi possível concluir o cadastro. Tente novamente ou contate o suporte.',
        }), 400

    try:
        clinica_res = supabase.table('clinicas').insert({
            'nome_clinica': clinica_nome,
            'email': email,
        }).execute()
        clinica = clinica_res.data[0]

        supabase.table('usuarios').insert({
            'id': user.id,
            'clinica_id': clinica['id'],
            'nome_completo': nome,
            'email': email,
            'role': 'admin',
        }).execute()
    except Exception as e:
        logger.error(f"[AUTH] Erro ao criar clínica/perfil para {user.id}: {e}")
        return jsonify({'error': 'Erro ao configurar conta. Contate o suporte.'}), 500

    token = create_token({'id': user.id, 'email': email})

    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'email': email,
            'clinica_id': clinica['id'],
            'role': 'admin',
            'nome_completo': nome,
        },
        'clinica': clinica,
    }), 201


@auth_bp.route('/me', methods=['GET'])
@require_auth
def get_me():
    """Returns live profile data for the authenticated user."""
    user = get_current_user()

    try:
        data = fetch_usuario_row(
            user['id'],
            'id, email, clinica_id, role, nome_completo, foto_perfil_url, especialidade, numero_registro, primeiro_acesso',
        )
    except Exception as e:
        logger.error(f"[AUTH] /me falhou para {user.get('id')}: {e}")
        return jsonify({'error': 'Erro ao carregar perfil'}), 500

    if not data:
        return jsonify({'error': 'Perfil não encontrado'}), 404

    return jsonify({'user': data}), 200


@auth_bp.route('/reset-password-request', methods=['POST'])
@limiter.limit('5 per minute')
def reset_password_request():
    """Requests a password reset code sent by email."""
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip()

    if not email:
        return jsonify({'error': 'Email ou CPF é obrigatório'}), 400

    result = AuthService.generate_reset_code_for_user(email)
    return jsonify(result), 200 if result.get('sucesso') else 400


@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit('10 per minute')
def reset_password():
    """Validates a reset code and changes the user's password."""
    data = request.get_json(silent=True) or {}
    email = data.get('email', '').strip()
    reset_code = data.get('reset_code', '').strip()
    nova_senha = data.get('nova_senha', '')

    if not all([email, reset_code, nova_senha]):
        return jsonify({'error': 'Email, código e nova senha são obrigatórios'}), 400

    result = AuthService.validate_and_reset_password(email, reset_code, nova_senha)
    return jsonify(result), 200 if result.get('sucesso') else 400
