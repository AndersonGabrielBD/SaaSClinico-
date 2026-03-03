"""
Middleware de autenticação JWT
"""
from functools import wraps
from flask import request, jsonify
from database import get_supabase_client

def jwt_required(f):
    """
    Decorador para proteger rotas que requerem autenticação
    Injeta request.user com os dados do usuário autenticado
    Também injeta request.clinica_id para RLS multi-tenant
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "Token não enviado"}), 401

        try:
            token = auth_header.split(" ")[1]
            supabase = get_supabase_client()
            user = supabase.auth.get_user(token)

            if not user or not user.user:
                return jsonify({"error": "Token inválido"}), 401

            request.user = user.user  # Injeta usuário na request
            
            # Buscar clinica_id do usuário na tabela usuarios
            try:
                usuario_data = supabase.table("usuarios")\
                    .select("clinica_id, role")\
                    .eq("id", user.user.id)\
                    .single()\
                    .execute()
                
                if usuario_data.data:
                    request.clinica_id = usuario_data.data.get("clinica_id")
                    request.user_role = usuario_data.data.get("role")
                else:
                    return jsonify({"error": "Usuário não encontrado no sistema"}), 401
            except Exception as e:
                print(f"Erro ao buscar clinica_id: {e}")
                return jsonify({"error": "Erro ao validar usuário"}), 401

        except Exception:
            return jsonify({"error": "Token inválido"}), 401

        return f(*args, **kwargs)

    return decorated
