# filepath: backend/app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from database.supabase_client import get_supabase_client
from app.utils.jwt_utils import create_token

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login com email e senha via Supabase Auth"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email e senha são obrigatórios'}), 400
        
        # Autentica via Supabase
        supabase = get_supabase_client()
        response = supabase.auth.sign_in_with_password({
            'email': email,
            'password': password
        })
        
        # Busca dados do usuário
        user_data = response.user
        
        # Busca clinica_id do perfil do usuário
        try:
            profile_response = supabase.table('usuarios')\
                .select('clinica_id, role, nome_completo')\
                .eq('id', user_data.id)\
                .execute()
            
            # Verifica se encontrou perfil
            if profile_response.data and len(profile_response.data) > 0:
                profile = profile_response.data[0]
            else:
                # Perfil não encontrado - cria um padrão
                # Primeiro, verifica se já existe uma clínica
                clinicas = supabase.table('clinicas').select('id, nome_clinica').limit(1).execute()
                
                if clinicas.data and len(clinicas.data) > 0:
                    # Use a primeira clínica encontrada
                    clinica_id = clinicas.data[0]['id']
                else:
                    # Cria uma clínica padrão
                    clinica_response = supabase.table('clinicas').insert({
                        'nome_clinica': 'Clínica Padrão',
                        'email': email
                    }).execute()
                    clinica_id = clinica_response.data[0]['id']
                
                # Cria perfil do usuário
                profile_create = supabase.table('usuarios').insert({
                    'id': user_data.id,
                    'clinica_id': clinica_id,
                    'nome_completo': email.split('@')[0],
                    'email': email,
                    'role': 'fono'
                }).execute()
                
                profile = profile_create.data[0] if profile_create.data else {
                    'clinica_id': clinica_id,
                    'role': 'fono',
                    'nome_completo': email.split('@')[0]
                }
        except Exception as profile_error:
            print(f"Erro ao buscar/criar perfil: {str(profile_error)}")
            # Se falhar, usa dados mínimos do Auth
            profile = {
                'clinica_id': None,
                'role': 'fono',
                'nome_completo': email.split('@')[0]
            }
        
        # Verifica se tem clinica_id
        if not profile.get('clinica_id'):
            return jsonify({
                'error': 'Usuário sem clínica associada. Por favor, faça o registro novamente.'
            }), 401
        
        # Cria token customizado
        token_data = {
            'id': user_data.id,
            'email': user_data.email,
            'clinica_id': profile.get('clinica_id'),
            'role': profile.get('role', 'fono'),
            'nome_completo': profile.get('nome_completo', email.split('@')[0])
        }
        
        token = create_token(token_data)
        
        return jsonify({
            'token': token,
            'user': {
                'id': user_data.id,
                'email': user_data.email,
                'clinica_id': profile.get('clinica_id'),
                'role': profile.get('role'),
                'nome_completo': profile.get('nome_completo')
            }
        }), 200
        
    except Exception as e:
        print(f"Erro no login: {str(e)}")
        return jsonify({'error': f'Erro no login: {str(e)}'}), 401


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Registro de novo usuário"""
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        nome = data.get('nome')
        clinica_nome = data.get('clinica_nome')
        
        if not all([email, password, nome, clinica_nome]):
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
        
        supabase = get_supabase_client()
        
        # Cria usuário no Supabase Auth
        auth_response = supabase.auth.sign_up({
            'email': email,
            'password': password
        })
        
        user = auth_response.user
        
        # Cria clínica
        clinica_response = supabase.table('clinicas').insert({
            'nome_clinica': clinica_nome,
            'email': email
        }).execute()
        
        clinica = clinica_response.data[0]
        
        # Cria perfil do usuário
        supabase.table('usuarios').insert({
            'id': user.id,
            'clinica_id': clinica['id'],
            'nome_completo': nome,
            'email': email,
            'role': 'admin'
        }).execute()
        
        # Cria token
        token_data = {
            'id': user.id,
            'email': email,
            'clinica_id': clinica['id'],
            'role': 'admin',
            'nome_completo': nome
        }
        
        token = create_token(token_data)
        
        return jsonify({
            'token': token,
            'user': {
                'id': user.id,
                'email': email,
                'clinica_id': clinica['id'],
                'role': 'admin',
                'nome_completo': nome
            },
            'clinica': clinica
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Erro no registro: {str(e)}'}), 400


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Retorna dados do usuário autenticado"""
    from app.utils.jwt_utils import require_auth, get_current_user
    
    @require_auth
    def _get_user():
        user = get_current_user()
        return jsonify({'user': user}), 200
    
    return _get_user()
