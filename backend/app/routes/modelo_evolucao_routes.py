import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from app.schemas.modelo_evolucao_schema import ModeloEvolucaoCreate, ModeloEvolucaoUpdate
from app.utils.jwt_utils import get_current_user, require_auth, require_roles

logger = logging.getLogger(__name__)


def _db():
    from database.supabase_client import get_supabase_client

    return get_supabase_client()

modelo_evolucao_bp = Blueprint("modelos_evolucao", __name__)


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@modelo_evolucao_bp.route("", methods=["GET"])
@require_auth
@require_roles(["admin", "fono", "medico", "profissional"])
def list_modelos():
    user = get_current_user()
    clinica_id = user["clinica_id"]
    uid = user["id"]
    try:
        client = _db()
        res = (
            client.table("modelos_evolucao")
            .select("*")
            .eq("clinica_id", clinica_id)
            .eq("usuario_id", uid)
            .order("ordem")
            .execute()
        )
        rows = res.data or []
        rows.sort(key=lambda r: (r.get("ordem") or 0, (r.get("nome") or "").lower()))
        return jsonify(rows), 200
    except Exception as e:
        logger.error("list_modelos: %s", e)
        return jsonify({"error": str(e)}), 500


@modelo_evolucao_bp.route("", methods=["POST"])
@require_auth
@require_roles(["admin", "fono", "medico", "profissional"])
def create_modelo():
    user = get_current_user()
    clinica_id = user["clinica_id"]
    uid = user["id"]
    try:
        body = ModeloEvolucaoCreate.model_validate(request.get_json(force=True, silent=True) or {})
    except Exception as e:
        return jsonify({"error": "Dados inválidos", "detail": str(e)}), 400

    row = {
        "clinica_id": clinica_id,
        "usuario_id": uid,
        "nome": body.nome.strip(),
        "valores_padrao": dict(body.valores_padrao),
        "ordem": body.ordem,
        "data_atualizacao": _now_iso(),
    }
    try:
        client = _db()
        res = client.table("modelos_evolucao").insert(row).execute()
        if not res.data:
            return jsonify({"error": "Falha ao criar modelo"}), 500
        return jsonify(res.data[0]), 201
    except Exception as e:
        logger.error("create_modelo: %s", e)
        return jsonify({"error": str(e)}), 500


@modelo_evolucao_bp.route("/<modelo_id>", methods=["PUT"])
@require_auth
@require_roles(["admin", "fono", "medico", "profissional"])
def update_modelo(modelo_id):
    user = get_current_user()
    clinica_id = user["clinica_id"]
    uid = user["id"]
    try:
        body = ModeloEvolucaoUpdate.model_validate(request.get_json(force=True, silent=True) or {})
    except Exception as e:
        return jsonify({"error": "Dados inválidos", "detail": str(e)}), 400

    updates = {"data_atualizacao": _now_iso()}
    if body.nome is not None:
        updates["nome"] = body.nome.strip()
    if body.valores_padrao is not None:
        updates["valores_padrao"] = dict(body.valores_padrao)
    if body.ordem is not None:
        updates["ordem"] = body.ordem

    if len(updates) <= 1:
        return jsonify({"error": "Nenhum campo para atualizar"}), 400

    try:
        client = _db()
        res = (
            client.table("modelos_evolucao")
            .update(updates)
            .eq("id", modelo_id)
            .eq("clinica_id", clinica_id)
            .eq("usuario_id", uid)
            .execute()
        )
        if not res.data:
            return jsonify({"error": "Modelo não encontrado"}), 404
        return jsonify(res.data[0]), 200
    except Exception as e:
        logger.error("update_modelo: %s", e)
        return jsonify({"error": str(e)}), 500


@modelo_evolucao_bp.route("/<modelo_id>", methods=["DELETE"])
@require_auth
@require_roles(["admin", "fono", "medico", "profissional"])
def delete_modelo(modelo_id):
    user = get_current_user()
    clinica_id = user["clinica_id"]
    uid = user["id"]
    try:
        client = _db()
        res = (
            client.table("modelos_evolucao")
            .delete()
            .eq("id", modelo_id)
            .eq("clinica_id", clinica_id)
            .eq("usuario_id", uid)
            .execute()
        )
        if not res.data:
            return jsonify({"error": "Modelo não encontrado"}), 404
        return jsonify({"ok": True}), 200
    except Exception as e:
        logger.error("delete_modelo: %s", e)
        return jsonify({"error": str(e)}), 500
