# filepath: backend/app/services/email_service.py
import html as html_module
import logging
import os
from typing import Optional
import requests
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailService:
    """Serviço de envio de emails via Resend"""
    
    RESEND_API_KEY = os.getenv('RESEND_API_KEY')
    RESEND_API_URL = 'https://api.resend.com/emails'
    FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@clinnext.com')
    FROM_NAME = os.getenv('FROM_NAME', 'clinnext')
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    SUPPORT_INBOX = os.getenv('SUPPORT_EMAIL', 'clinicasaas655@gmail.com')

    @staticmethod
    def send_bug_report(
        *,
        assunto: str,
        descricao: str,
        reporter_email: str,
        reporter_nome: str,
        reporter_role: str,
        clinica_id: str,
    ) -> dict:
        """Envia relatório de bug ao inbox de suporte via Resend."""
        try:
            if not EmailService.RESEND_API_KEY:
                logger.warning("[EMAIL] RESEND_API_KEY não configurada — bug report não enviado.")
                return {
                    "sucesso": False,
                    "mensagem": "Serviço de email não configurado",
                    "email_id": None,
                }

            to_addr = EmailService.SUPPORT_INBOX
            safe_desc = html_module.escape(descricao).replace("\n", "<br/>")
            safe_nome = html_module.escape(reporter_nome or "")
            safe_email = html_module.escape(reporter_email or "")
            safe_role = html_module.escape((reporter_role or "").strip())
            safe_clinica = html_module.escape(str(clinica_id or ""))

            html_content = f"""
            <!DOCTYPE html>
            <html lang="pt-BR"><head><meta charset="UTF-8"></head>
            <body style="font-family:system-ui,sans-serif;line-height:1.5;color:#333;">
              <h2 style="color:#1b4332;">Novo relatório — clinnext</h2>
              <p><strong>Usuário:</strong> {safe_nome}<br/>
              <strong>E-mail:</strong> {safe_email}<br/>
              <strong>Perfil:</strong> {safe_role}<br/>
              <strong>Clínica (ID):</strong> {safe_clinica}</p>
              <hr style="border:none;border-top:1px solid #e9ecef;"/>
              <div style="margin-top:12px;">{safe_desc}</div>
            </body></html>
            """

            subj = assunto.strip() if assunto else "Report de problema"
            if not subj.lower().startswith("[clinnext]"):
                subj = f"[clinnext] {subj}"

            payload = {
                "from": f"{EmailService.FROM_NAME} <{EmailService.FROM_EMAIL}>",
                "to": to_addr,
                "subject": subj[:200],
                "html": html_content,
                "reply_to": reporter_email if reporter_email else EmailService.FROM_EMAIL,
            }

            headers = {
                "Authorization": f"Bearer {EmailService.RESEND_API_KEY}",
                "Content-Type": "application/json",
            }

            response = requests.post(
                EmailService.RESEND_API_URL,
                json=payload,
                headers=headers,
                timeout=15,
            )

            if response.status_code in [200, 201]:
                email_id = response.json().get("id")
                logger.info(f"[EMAIL] Bug report enviado para {to_addr} (id={email_id})")
                return {"sucesso": True, "mensagem": "Enviado", "email_id": email_id}

            error_msg = response.json().get("message", "Erro desconhecido")
            logger.error(f"[EMAIL] Falha bug report: {error_msg}")
            return {"sucesso": False, "mensagem": f"Erro ao enviar: {error_msg}", "email_id": None}

        except requests.exceptions.Timeout:
            logger.error("[EMAIL] Timeout ao conectar com Resend (bug report)")
            return {"sucesso": False, "mensagem": "Timeout ao enviar email", "email_id": None}
        except Exception as e:
            logger.error(f"[EMAIL] Erro bug report: {e}")
            return {"sucesso": False, "mensagem": f"Erro ao enviar email: {str(e)}", "email_id": None}

    @staticmethod
    def send_reset_password_email(
        email: str,
        reset_code: str,
        nome_usuario: Optional[str] = None
    ) -> dict:
        """
        Envia email com código de reset de senha via Resend
        
        Args:
            email: Email do usuário
            reset_code: Código gerado para reset
            nome_usuario: Nome do usuário (opcional)
            
        Returns:
            {"sucesso": bool, "mensagem": str, "email_id": str}
        """
        try:
            if not EmailService.RESEND_API_KEY:
                logger.warning("[EMAIL] RESEND_API_KEY não configurada — email não enviado.")
                return {
                    "sucesso": False,
                    "mensagem": "Serviço de email não configurado",
                    "email_id": None
                }
            
            # Template HTML do email
            html_content = EmailService._get_reset_password_template(
                reset_code=reset_code,
                nome_usuario=nome_usuario or email.split('@')[0]
            )
            
            # Payload para Resend
            payload = {
                "from": f"{EmailService.FROM_NAME} <{EmailService.FROM_EMAIL}>",
                "to": email,
                "subject": "🔐 Código de Recuperação de Senha - clinnext",
                "html": html_content,
                "reply_to": "suporte@clinnext.com"
            }
            
            # Fazer requisição para Resend
            headers = {
                "Authorization": f"Bearer {EmailService.RESEND_API_KEY}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(
                EmailService.RESEND_API_URL,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                email_id = response.json().get('id')
                logger.info(f"[EMAIL] Email enviado para {email} (id={email_id})")
                return {
                    "sucesso": True,
                    "mensagem": f"Código de reset enviado para {email}",
                    "email_id": email_id,
                }
            else:
                error_msg = response.json().get('message', 'Erro desconhecido')
                logger.error(f"[EMAIL] Falha ao enviar email para {email}: {error_msg}")
                return {
                    "sucesso": False,
                    "mensagem": f"Erro ao enviar email: {error_msg}",
                    "email_id": None,
                }

        except requests.exceptions.Timeout:
            logger.error("[EMAIL] Timeout ao conectar com Resend")
            return {"sucesso": False, "mensagem": "Timeout ao enviar email", "email_id": None}
        except Exception as e:
            logger.error(f"[EMAIL] Erro inesperado ao enviar email: {e}")
            return {"sucesso": False, "mensagem": f"Erro ao enviar email: {str(e)}", "email_id": None}
    
    @staticmethod
    def _get_reset_password_template(reset_code: str, nome_usuario: str) -> str:
        """
        Gera o template HTML do email de reset de senha
        
        Args:
            reset_code: Código de reset
            nome_usuario: Nome do usuário
            
        Returns:
            HTML do email
        """
        reset_link = f"{EmailService.FRONTEND_URL}/forgot-password"
        ano_atual = datetime.now().year
        
        return f"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Código de Reset de Senha</title>
            <style>
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    padding: 20px;
                }}
                .container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }}
                .header {{
                    background: linear-gradient(135deg, #2D6A4F 0%, #1b4332 100%);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    font-size: 28px;
                    margin-bottom: 5px;
                }}
                .header p {{
                    font-size: 14px;
                    opacity: 0.9;
                }}
                .content {{
                    padding: 40px 30px;
                }}
                .greeting {{
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 20px;
                    line-height: 1.6;
                }}
                .code-box {{
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border: 2px solid #2D6A4F;
                    border-radius: 8px;
                    padding: 25px;
                    text-align: center;
                    margin: 30px 0;
                }}
                .code {{
                    font-size: 32px;
                    letter-spacing: 4px;
                    color: #2D6A4F;
                    font-weight: bold;
                    font-family: 'Courier New', monospace;
                    padding: 10px 0;
                }}
                .code-label {{
                    font-size: 12px;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 10px;
                }}
                .expiry {{
                    background: #fff3cd;
                    border-left: 4px solid #ffc107;
                    color: #856404;
                    padding: 12px 15px;
                    border-radius: 4px;
                    font-size: 14px;
                    margin: 20px 0;
                }}
                .button {{
                    display: inline-block;
                    background: linear-gradient(135deg, #2D6A4F 0%, #1b4332 100%);
                    color: white;
                    padding: 12px 30px;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    text-align: center;
                    margin: 20px 0;
                    transition: transform 0.2s, box-shadow 0.2s;
                }}
                .button:hover {{
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(45, 106, 79, 0.4);
                }}
                .footer {{
                    background: #f8f9fa;
                    color: #666;
                    padding: 20px 30px;
                    font-size: 12px;
                    border-top: 1px solid #e9ecef;
                    text-align: center;
                }}
                .divider {{
                    color: #ddd;
                    margin: 20px 0;
                }}
                .security-note {{
                    background: #f0f8ff;
                    border-left: 4px solid #0066cc;
                    color: #003366;
                    padding: 12px 15px;
                    border-radius: 4px;
                    font-size: 13px;
                    margin: 20px 0;
                    line-height: 1.5;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <h1>🔐 Recuperar Senha</h1>
                    <p>Solicitação de Recuperação de Acesso</p>
                </div>
                
                <!-- Content -->
                <div class="content">
                    <div class="greeting">
                        Olá, <strong>{nome_usuario}</strong>!
                    </div>
                    
                    <p style="color: #555; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                        Recebemos uma solicitação para recuperar sua senha. Use o código abaixo para resetar sua senha:
                    </p>
                    
                    <!-- Code Box -->
                    <div class="code-box">
                        <div class="code-label">Seu Código de Reset</div>
                        <div class="code">{reset_code}</div>
                    </div>
                    
                    <!-- Expiry Warning -->
                    <div class="expiry">
                        ⏰ Este código é válido por <strong>24 horas</strong>. Após esse período, você precisará solicitar um novo código.
                    </div>
                    
                    <!-- Instructions -->
                    <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 20px 0;">
                        <strong>Como usar:</strong>
                    </p>
                    <ol style="color: #555; font-size: 14px; line-height: 1.8; margin-left: 20px; margin-bottom: 20px;">
                        <li>Acesse a página de recuperação de senha do clinnext</li>
                        <li>Cole o código acima: <strong>{reset_code}</strong></li>
                        <li>Defina uma nova senha forte</li>
                        <li>Faça login com sua nova senha</li>
                    </ol>
                    
                    <!-- Button -->
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">Ir para Recuperação de Senha</a>
                    </div>
                    
                    <!-- Security Note -->
                    <div class="security-note">
                        <strong>🛡️ Segurança:</strong> Se você não solicitou uma recuperação de senha, 
                        ignore este email. Sua conta permanece segura. Nunca compartilhe este código com ninguém.
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <p>
                        © {ano_atual} clinnext - Software para Clínicas de Fonoaudiologia<br>
                        <a href="https://clinnext.com" style="color: #2D6A4F; text-decoration: none;">clinnext.com</a> | 
                        <a href="mailto:suporte@clinnext.com" style="color: #2D6A4F; text-decoration: none;">suporte@clinnext.com</a>
                    </p>
                    <p style="margin-top: 10px; color: #999;">
                        Este é um email automático. Não responda diretamente nesta caixa.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
