# filepath: backend/app/services/auth_service.py
import secrets
import string
from datetime import datetime, timedelta
from database.supabase_client import get_supabase_client
from app.services.email_service import EmailService

class AuthService:
    """Serviço de autenticação incluindo reset de senha"""
    
    @staticmethod
    def generate_reset_code(length: int = 8) -> str:
        """
        Gera código aleatório de reset de senha
        Formato: 8 caracteres (letras maiúsculas + números)
        """
        characters = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(characters) for _ in range(length))
    
    @staticmethod
    def generate_reset_code_for_user(email: str) -> dict:
        """
        Gera e armazena código de reset para um usuário
        
        Args:
            email: Email ou CPF do usuário
            
        Returns:
            {
                "sucesso": bool,
                "mensagem": str,
                "reset_code": str (apenas em dev),
                "user_id": str
            }
        """
        try:
            supabase = get_supabase_client()
            
            # Buscar usuário por email primeiro
            user_response = supabase.table('usuarios').select('id, email, cpf, nome_completo').eq('email', email).execute()
            
            # Se não encontrou por email, tentar por CPF
            if not user_response.data or len(user_response.data) == 0:
                user_response = supabase.table('usuarios').select('id, email, cpf, nome_completo').eq('cpf', email).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                # Não revelar se usuário existe ou não (segurança)
                return {
                    "sucesso": True,
                    "mensagem": "Se o usuário existir, receberá um código de reset",
                    "user_id": None
                }
            
            user = user_response.data[0]
            user_id = user['id']
            
            # Gerar código aleatório
            reset_code = AuthService.generate_reset_code()
            print(f"Código de reset gerado para {email}: {reset_code}")  # Log para desenvolvimento (remover em produção)
            # Definir expiração em 24 horas
            expires_at = datetime.utcnow() + timedelta(hours=24)
            
            # Armazenar código no banco de dados
            update_response = supabase.table('usuarios').update({
                'reset_code': reset_code,
                'reset_code_expires': expires_at.isoformat(),
                'reset_code_attempts': 0,
                'ultimo_reset_code_gerado': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
            
            if not update_response.data:
                return {
                    "sucesso": False,
                    "mensagem": "Erro ao gerar código de reset",
                    "user_id": None
                }
            
            # Enviar código por email via Resend
            nome_usuario = user.get('nome_completo') or email.split('@')[0]
            email_result = EmailService.send_reset_password_email(
                email=user['email'],
                reset_code=reset_code,
                nome_usuario=nome_usuario
            )
            
            # Retornar sucesso se email foi enviado, mesmo que com aviso
            return {
                "sucesso": True,
                "mensagem": email_result.get('mensagem', 'Código gerado com sucesso'),
                "user_id": user_id
            }
            
        except Exception as e:
            print(f"Erro ao gerar código de reset: {str(e)}")
            return {
                "sucesso": False,
                "mensagem": "Erro ao processar solicitação",
                "user_id": None
            }
    
    @staticmethod
    def validate_and_reset_password(email: str, reset_code: str, nova_senha: str) -> dict:
        """
        Valida código de reset e altera a senha do usuário
        
        Args:
            email: Email ou CPF do usuário
            reset_code: Código fornecido pelo usuário
            nova_senha: Nova senha
            
        Returns:
            {"sucesso": bool, "mensagem": str}
        """
        try:
            # Validar senha
            if len(nova_senha) < 8:
                return {
                    "sucesso": False,
                    "mensagem": "Senha deve ter no mínimo 8 caracteres"
                }
            
            supabase = get_supabase_client()
            
            # Buscar usuário por email primeiro
            user_response = supabase.table('usuarios').select('id, reset_code, reset_code_expires, reset_code_attempts').eq('email', email).execute()
            
            # Se não encontrou por email, tentar por CPF
            if not user_response.data or len(user_response.data) == 0:
                user_response = supabase.table('usuarios').select('id, reset_code, reset_code_expires, reset_code_attempts').eq('cpf', email).execute()
            
            if not user_response.data or len(user_response.data) == 0:
                return {
                    "sucesso": False,
                    "mensagem": "Usuário não encontrado"
                }
            
            user = user_response.data[0]
            user_id = user['id']
            
            # Validar código usando função RPC do banco
            validation_response = supabase.rpc('validate_reset_code', {
                'p_user_id': user_id,
                'p_reset_code': reset_code
            }).execute()
            
            if not validation_response.data or not validation_response.data[0]['is_valid']:
                mensagem = "Código inválido ou expirado"
                if validation_response.data:
                    mensagem = validation_response.data[0]['message']
                
                return {
                    "sucesso": False,
                    "mensagem": mensagem
                }
            
            # Código válido - alterar senha no Supabase Auth
            auth_update = supabase.auth.admin.update_user_by_id(
                user_id,
                {"password": nova_senha}
            )
            
            # Consumir o código (limpá-lo)
            supabase.rpc('consume_reset_code', {
                'p_user_id': user_id
            }).execute()
            
            return {
                "sucesso": True,
                "mensagem": "Senha alterada com sucesso. Você pode fazer login agora."
            }
            
        except Exception as e:
            print(f"Erro ao resetar senha: {str(e)}")
            return {
                "sucesso": False,
                "mensagem": f"Erro ao alterar senha: {str(e)}"
            }
