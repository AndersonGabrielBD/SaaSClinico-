# filepath: backend/app/routes/senha_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, get_current_user
from database.supabase_client import get_supabase_client

senha_bp = Blueprint('senha', __name__)

@senha_bp.route('/change-password', methods=['POST'])
@require_auth
def change_password():
    """Trocar senha do usuário autenticado"""
    try:
        user = get_current_user()
        user_id = user['id']
        
        data = request.get_json()
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        confirm_password = data.get('confirm_password')
        
        # Validações
        if not all([old_password, new_password, confirm_password]):
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'Senha deve ter no mínimo 6 caracteres'}), 400
        
        if new_password != confirm_password:
            return jsonify({'error': 'As senhas não coincidem'}), 400
        
        if old_password == new_password:
            return jsonify({'error': 'Nova senha não pode ser igual à senha antiga'}), 400
        
        supabase = get_supabase_client()
        
        # Primeiro, verifica se a senha antiga está correcta
        # Tenta fazer login com email e senha antiga
        try:
            user_email = user['email']
            auth_response = supabase.auth.sign_in_with_password({
                'email': user_email,
                'password': old_password
            })
        except Exception as auth_error:
            return jsonify({'error': 'Senha antiga incorreta'}), 401
        
        # Se chegou aqui, a senha antiga está correta
        # Agora atualiza a senha
        try:
            supabase.auth.admin.update_user_by_id(
                user_id,
                {'password': new_password}
            )
            
            return jsonify({
                'message': 'Senha alterada com sucesso',
                'success': True
            }), 200
            
        except Exception as update_error:
            return jsonify({'error': f'Erro ao atualizar senha: {str(update_error)}'}), 500
        
    except Exception as e:
        return jsonify({'error': f'Erro ao trocar senha: {str(e)}'}), 500
