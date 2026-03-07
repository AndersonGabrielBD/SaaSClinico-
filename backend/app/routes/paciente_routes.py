# filepath: backend/app/routes/paciente_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.utils.exceptions import NotFoundException, ValidationException

paciente_bp = Blueprint('pacientes', __name__)

@paciente_bp.route('', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_pacientes():
    """Lista pacientes da clínica com filtros no banco (sem carregamento total)."""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']

        search = request.args.get('search')
        ativo = request.args.get('ativo')

        from database.supabase_client import get_supabase_client
        client = get_supabase_client()

        query = client.table('pacientes')\
            .select('id, nome_completo, cpf, telefone_principal, data_nascimento, email, ativo, data_criacao')\
            .eq('clinica_id', clinica_id)\
            .order('nome_completo', desc=False)

        if ativo is not None:
            query = query.eq('ativo', ativo.lower() == 'true')

        if search:
            # Busca por nome via ilike (índice gin/trigram no banco)
            query = query.ilike('nome_completo', f'%{search}%')

        response = query.execute()
        return jsonify(response.data or []), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao', 'fono', 'medico', 'profissional'])
def get_paciente(paciente_id):
    """Busca paciente por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('pacientes', clinica_id)
        paciente = repo.get_by_id(paciente_id)
        
        if not paciente:
            return jsonify({'error': 'Paciente não encontrado'}), 404
        
        return jsonify(paciente), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def create_paciente():
    """Cria novo paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        # Validações básicas
        if not data.get('nome_completo'):
            return jsonify({'error': 'Campo nome_completo é obrigatório'}), 400
        
        # Verifica CPF duplicado (se fornecido) usando RPC
        repo = BaseRepository('pacientes', clinica_id)
        if data.get('cpf'):
            if repo.check_cpf_exists(data['cpf']):
                return jsonify({'error': 'CPF já cadastrado nesta clínica'}), 409
        
        # Set padrões
        data['ativo'] = data.get('ativo', True)
        
        paciente = repo.create(data)
        
        return jsonify(paciente), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def update_paciente(paciente_id):
    """Atualiza paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        repo = BaseRepository('pacientes', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(paciente_id)
        if not existing:
            return jsonify({'error': 'Paciente não encontrado'}), 404
        
        paciente = repo.update(paciente_id, data)
        
        return jsonify(paciente), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def delete_paciente(paciente_id):
    """Soft delete - desativa paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('pacientes', clinica_id)
        
        # Soft delete
        repo.update(paciente_id, {'ativo': False})
        
        return jsonify({'message': 'Paciente desativado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Rotas para Relacionamento Paciente-Profissional (Muitos-para-Muitos)
# ============================================================================

@paciente_bp.route('/<paciente_id>/profissionais', methods=['GET'])
@require_auth
def get_paciente_profissionais(paciente_id):
    """Lista todos os profissionais vinculados a um paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos = repo.client.table('pacientes_profissionais') \
            .select('*, usuarios!profissional_id(id, nome_completo, role, especialidade)') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .eq('ativo', True) \
            .execute()
        
        # Formatar resposta
        profissionais = []
        for vinculo in vinculos.data:
            if vinculo.get('usuarios'):
                prof = vinculo['usuarios']
                prof['data_vinculo'] = vinculo.get('data_vinculo')
                prof['observacoes'] = vinculo.get('observacoes')
                profissionais.append(prof)
        
        return jsonify(profissionais), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>/profissionais', methods=['POST'])
@require_auth
@require_roles(['admin', 'recepcao'])
def add_profissional_to_paciente(paciente_id):
    """Vincula um ou mais profissionais ao paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        profissional_ids = data.get('profissional_ids', [])
        
        if not profissional_ids:
            return jsonify({'error': 'profissional_ids é obrigatório'}), 400
        
        # Garantir que é uma lista
        if not isinstance(profissional_ids, list):
            profissional_ids = [profissional_ids]
        
        repo = BaseRepository('pacientes_profissionais', clinica_id)
        vinculos_criados = []
        
        for prof_id in profissional_ids:
            # Verificar se já existe vínculo
            existing = repo.client.table('pacientes_profissionais') \
                .select('id') \
                .eq('paciente_id', paciente_id) \
                .eq('profissional_id', prof_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
            
            if not existing.data:
                # Criar novo vínculo
                vinculo_data = {
                    'paciente_id': paciente_id,
                    'profissional_id': prof_id,
                    'clinica_id': clinica_id,
                    'ativo': True
                }
                
                result = repo.create(vinculo_data)
                vinculos_criados.append(result)
            else:
                # Reativar se existir mas estiver inativo
                repo.client.table('pacientes_profissionais') \
                    .update({'ativo': True}) \
                    .eq('id', existing.data[0]['id']) \
                    .execute()
        
        return jsonify({
            'message': f'{len(vinculos_criados)} profissional(is) vinculado(s) com sucesso',
            'vinculos': vinculos_criados
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>/profissionais/<profissional_id>', methods=['DELETE'])
@require_auth
@require_roles(['admin', 'recepcao'])
def remove_profissional_from_paciente(paciente_id, profissional_id):
    """Remove vínculo entre paciente e profissional"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('pacientes_profissionais', clinica_id)
        
        # Soft delete do vínculo
        repo.client.table('pacientes_profissionais') \
            .update({'ativo': False}) \
            .eq('paciente_id', paciente_id) \
            .eq('profissional_id', profissional_id) \
            .eq('clinica_id', clinica_id) \
            .execute()
        
        return jsonify({'message': 'Profissional desvinculado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@paciente_bp.route('/<paciente_id>/profissionais/sync', methods=['PUT'])
@require_auth
@require_roles(['admin', 'recepcao'])
def sync_paciente_profissionais(paciente_id):
    """Sincroniza lista completa de profissionais do paciente"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        profissional_ids = data.get('profissional_ids', [])
        
        repo = BaseRepository('pacientes_profissionais', clinica_id)
        
        # Buscar vínculos atuais
        vinculos_atuais = repo.client.table('pacientes_profissionais') \
            .select('id, profissional_id') \
            .eq('paciente_id', paciente_id) \
            .eq('clinica_id', clinica_id) \
            .execute()
        
        ids_atuais = [v['profissional_id'] for v in vinculos_atuais.data]
        
        # Determinar operações
        ids_para_adicionar = [pid for pid in profissional_ids if pid not in ids_atuais]
        ids_para_manter = [pid for pid in profissional_ids if pid in ids_atuais]
        ids_para_remover = [pid for pid in ids_atuais if pid not in profissional_ids]
        
        # Adicionar novos
        for prof_id in ids_para_adicionar:
            repo.create({
                'paciente_id': paciente_id,
                'profissional_id': prof_id,
                'clinica_id': clinica_id,
                'ativo': True
            })
        
        # Desativar removidos
        for prof_id in ids_para_remover:
            repo.client.table('pacientes_profissionais') \
                .update({'ativo': False}) \
                .eq('paciente_id', paciente_id) \
                .eq('profissional_id', prof_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
        
        # Reativar mantidos
        for prof_id in ids_para_manter:
            repo.client.table('pacientes_profissionais') \
                .update({'ativo': True}) \
                .eq('paciente_id', paciente_id) \
                .eq('profissional_id', prof_id) \
                .eq('clinica_id', clinica_id) \
                .execute()
        
        return jsonify({
            'message': 'Profissionais sincronizados com sucesso',
            'adicionados': len(ids_para_adicionar),
            'mantidos': len(ids_para_manter),
            'removidos': len(ids_para_remover)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
