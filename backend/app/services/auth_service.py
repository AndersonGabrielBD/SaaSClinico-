# filepath: backend/app/services/auth_service.py
import logging
import secrets
import string
from datetime import datetime, timedelta
from database.supabase_client import get_supabase_client
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class AuthService:
    """Authentication service including password reset."""

    @staticmethod
    def generate_reset_code(length: int = 8) -> str:
        characters = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(characters) for _ in range(length))

    @staticmethod
    def generate_reset_code_for_user(email: str) -> dict:
        """
        Generates and persists a reset code for the given email or CPF.
        Never reveals whether the account exists.
        """
        try:
            supabase = get_supabase_client()

            user_response = (
                supabase.table('usuarios')
                .select('id, email, cpf, nome_completo')
                .eq('email', email)
                .execute()
            )

            if not user_response.data:
                user_response = (
                    supabase.table('usuarios')
                    .select('id, email, cpf, nome_completo')
                    .eq('cpf', email)
                    .execute()
                )

            if not user_response.data:
                # Do not disclose whether the account exists
                return {
                    'sucesso': True,
                    'mensagem': 'Se o usuário existir, receberá um código de reset',
                }

            user = user_response.data[0]
            user_id = user['id']
            reset_code = AuthService.generate_reset_code()
            expires_at = datetime.utcnow() + timedelta(hours=24)

            update_res = (
                supabase.table('usuarios')
                .update({
                    'reset_code': reset_code,
                    'reset_code_expires': expires_at.isoformat(),
                    'reset_code_attempts': 0,
                    'ultimo_reset_code_gerado': datetime.utcnow().isoformat(),
                })
                .eq('id', user_id)
                .execute()
            )

            if not update_res.data:
                logger.error(f"[AUTH] Falha ao persistir código de reset para {user_id}")
                return {'sucesso': False, 'mensagem': 'Erro ao gerar código de reset'}

            nome_usuario = user.get('nome_completo') or email.split('@')[0]
            email_result = EmailService.send_reset_password_email(
                email=user['email'],
                reset_code=reset_code,
                nome_usuario=nome_usuario,
            )

            return {
                'sucesso': True,
                'mensagem': email_result.get('mensagem', 'Código gerado com sucesso'),
            }

        except Exception as e:
            logger.error(f"[AUTH] Erro ao gerar código de reset: {e}")
            return {'sucesso': False, 'mensagem': 'Erro ao processar solicitação'}

    @staticmethod
    def validate_and_reset_password(email: str, reset_code: str, nova_senha: str) -> dict:
        """Validates the reset code and updates the password."""
        if len(nova_senha) < 8:
            return {'sucesso': False, 'mensagem': 'Senha deve ter no mínimo 8 caracteres'}

        try:
            supabase = get_supabase_client()

            user_response = (
                supabase.table('usuarios')
                .select('id, reset_code, reset_code_expires, reset_code_attempts')
                .eq('email', email)
                .execute()
            )

            if not user_response.data:
                user_response = (
                    supabase.table('usuarios')
                    .select('id, reset_code, reset_code_expires, reset_code_attempts')
                    .eq('cpf', email)
                    .execute()
                )

            if not user_response.data:
                return {'sucesso': False, 'mensagem': 'Usuário não encontrado'}

            user_id = user_response.data[0]['id']

            validation_res = supabase.rpc('validate_reset_code', {
                'p_user_id': user_id,
                'p_reset_code': reset_code,
            }).execute()

            if not validation_res.data or not validation_res.data[0]['is_valid']:
                mensagem = 'Código inválido ou expirado'
                if validation_res.data:
                    mensagem = validation_res.data[0].get('message', mensagem)
                return {'sucesso': False, 'mensagem': mensagem}

            supabase.auth.admin.update_user_by_id(user_id, {'password': nova_senha})
            supabase.rpc('consume_reset_code', {'p_user_id': user_id}).execute()

            return {'sucesso': True, 'mensagem': 'Senha alterada com sucesso. Você pode fazer login agora.'}

        except Exception as e:
            logger.error(f"[AUTH] Erro ao resetar senha: {e}")
            return {'sucesso': False, 'mensagem': 'Erro ao alterar senha'}
