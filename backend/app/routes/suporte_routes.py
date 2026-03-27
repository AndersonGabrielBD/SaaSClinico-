# filepath: backend/app/routes/suporte_routes.py
from flask import Blueprint, request, jsonify

from app.extensions import limiter
from app.services.email_service import EmailService
from app.utils.jwt_utils import get_current_user, require_auth, require_roles

suporte_bp = Blueprint("suporte", __name__)


@suporte_bp.route("/report", methods=["POST"])
@require_auth
@require_roles(["admin", "recepcao", "fono", "medico", "profissional"])
@limiter.limit("10 per minute")
def report_bug():
    """Recebe descrição do problema e envia ao inbox de suporte por e-mail."""
    data = request.get_json() or {}
    assunto = (data.get("assunto") or "").strip()
    descricao = (data.get("descricao") or "").strip()

    if len(descricao) < 10:
        return jsonify(
            {
                "error": "Descrição muito curta",
                "message": "Descreva o problema com pelo menos 10 caracteres.",
            }
        ), 400
    if len(descricao) > 8000:
        return jsonify(
            {
                "error": "Descrição muito longa",
                "message": "Reduza o texto (máximo 8000 caracteres).",
            }
        ), 400

    user = get_current_user() or {}
    result = EmailService.send_bug_report(
        assunto=assunto or "Report de problema",
        descricao=descricao,
        reporter_email=user.get("email") or "",
        reporter_nome=user.get("nome_completo") or "",
        reporter_role=user.get("role") or "",
        clinica_id=str(user.get("clinica_id") or ""),
    )

    if result.get("sucesso"):
        return jsonify(
            {
                "message": "Relatório enviado com sucesso. Analisaremos o mais rápido possível.",
            }
        ), 200

    return jsonify(
        {
            "message": result.get("mensagem")
            or "Não foi possível enviar o relatório. Verifique se o e-mail está configurado no servidor ou use «Abrir no meu e-mail».",
        }
    ), 502
