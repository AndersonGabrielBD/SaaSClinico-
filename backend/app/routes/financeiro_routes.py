# filepath: backend/app/routes/financeiro_routes.py
from flask import Blueprint, request, jsonify
from app.utils.jwt_utils import require_auth, get_current_user
from app.repositories.base_repository import BaseRepository
from app.services.mensalidade_service import MensalidadeService
from datetime import datetime, timedelta

financeiro_bp = Blueprint('financeiro', __name__)

@financeiro_bp.route('/lancamentos', methods=['GET'])
@require_auth
def get_lancamentos():
    """Lista todos os lançamentos financeiros da clínica"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Query params
        status = request.args.get('status')
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        paciente_id = request.args.get('paciente_id')
        
        # Filtros
        filters = {}
        if status:
            filters['status'] = status
        if paciente_id:
            filters['paciente_id'] = paciente_id
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        lancamentos = repo.get_all(filters=filters, order_by='-data_criacao')
        
        # Filtro de data
        if data_inicio or data_fim:
            lancamentos_filtrados = []
            for lanc in lancamentos:
                data_criacao = lanc.get('data_criacao', '')
                if data_criacao:
                    if isinstance(data_criacao, str):
                        data_criacao = data_criacao[:10]  # YYYY-MM-DD
                    else:
                        data_criacao = data_criacao.strftime('%Y-%m-%d')
                    
                    if data_inicio and data_criacao < data_inicio:
                        continue
                    if data_fim and data_criacao > data_fim:
                        continue
                    lancamentos_filtrados.append(lanc)
            lancamentos = lancamentos_filtrados
        
        return jsonify(lancamentos), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['GET'])
@require_auth
def get_lancamento(lancamento_id):
    """Busca lançamento por ID"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        lancamento = repo.get_by_id(lancamento_id)
        
        if not lancamento:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        return jsonify(lancamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos', methods=['POST'])
@require_auth
def create_lancamento():
    """Cria novo lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        user_id = user['id']
        
        data = request.get_json()
        
        # Validações básicas
        if not data.get('descricao'):
            return jsonify({'error': 'Campo descricao é obrigatório'}), 400
        if not data.get('valor'):
            return jsonify({'error': 'Campo valor é obrigatório'}), 400
        
        # Limpar campos de data vazios
        if data.get('data_vencimento') == '':
            data['data_vencimento'] = None
        if data.get('data_pagamento') == '':
            data['data_pagamento'] = None
        
        # Limpar campos string vazios opcionais
        if data.get('metodo_pagamento') == '':
            data['metodo_pagamento'] = None
        if data.get('observacoes') == '':
            data['observacoes'] = None
        if data.get('paciente_id') == '':
            data['paciente_id'] = None
        
        # Set padrões
        data['status'] = data.get('status', 'pendente')
        data['tipo_valor'] = data.get('tipo_valor', 'credito')
        data['criado_por'] = user_id
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        lancamento = repo.create(data)
        
        return jsonify(lancamento), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['PUT'])
@require_auth
def update_lancamento(lancamento_id):
    """Atualiza lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        data = request.get_json()
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(lancamento_id)
        if not existing:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        # Limpar campos de data vazios
        if data.get('data_vencimento') == '':
            data['data_vencimento'] = None
        if data.get('data_pagamento') == '':
            data['data_pagamento'] = None
        
        # Limpar campos string vazios opcionais
        if data.get('metodo_pagamento') == '':
            data['metodo_pagamento'] = None
        if data.get('observacoes') == '':
            data['observacoes'] = None
        if data.get('paciente_id') == '':
            data['paciente_id'] = None
        
        # Se estiver marcando como pago, adiciona data de pagamento
        if data.get('status') == 'pago' and not data.get('data_pagamento'):
            data['data_pagamento'] = datetime.now().isoformat()
        
        lancamento = repo.update(lancamento_id, data)
        
        return jsonify(lancamento), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/lancamentos/<lancamento_id>', methods=['DELETE'])
@require_auth
def delete_lancamento(lancamento_id):
    """Deleta lançamento financeiro"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        repo = BaseRepository('lancamentos_financeiros', clinica_id)
        
        # Verifica se existe
        existing = repo.get_by_id(lancamento_id)
        if not existing:
            return jsonify({'error': 'Lançamento não encontrado'}), 404
        
        repo.delete(lancamento_id)
        
        return jsonify({'message': 'Lançamento deletado com sucesso'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/relatorio/resumo', methods=['GET'])
@require_auth
def get_resumo_financeiro():
    """Retorna resumo financeiro do período"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Query params
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        
        # Se não fornecido, usa mês atual
        if not data_inicio:
            data_inicio = datetime.now().replace(day=1).strftime('%Y-%m-%d')
        if not data_fim:
            # Último dia do mês atual
            proximo_mes = datetime.now().replace(day=28) + timedelta(days=4)
            data_fim = (proximo_mes - timedelta(days=proximo_mes.day)).strftime('%Y-%m-%d')
        
        service = MensalidadeService()
        pagamentos = service.listar_pagamentos(clinica_id, {
            'data_inicio': data_inicio,
            'data_fim': data_fim
        })

        # Calcular totais
        total_pago = sum(float(p.get('valor_pago', 0)) for p in pagamentos if p.get('status') == 'pago')
        total_pendente = sum(float(p.get('valor_pago', 0)) for p in pagamentos if p.get('status') == 'pendente')
        total_parcial = sum(float(p.get('valor_pago', 0)) for p in pagamentos if p.get('status') == 'parcial')
        total_cancelado = sum(float(p.get('valor_pago', 0)) for p in pagamentos if p.get('status') == 'cancelado')

        # Contar por status
        count_pago = len([p for p in pagamentos if p.get('status') == 'pago'])
        count_pendente = len([p for p in pagamentos if p.get('status') == 'pendente'])
        count_parcial = len([p for p in pagamentos if p.get('status') == 'parcial'])
        count_cancelado = len([p for p in pagamentos if p.get('status') == 'cancelado'])

        # Por método de pagamento
        metodos = {}
        for pagamento in pagamentos:
            if pagamento.get('status') == 'pago':
                metodo = pagamento.get('metodo_pagamento', 'Não informado') or 'Não informado'
                if metodo not in metodos:
                    metodos[metodo] = {'total': 0, 'count': 0}
                metodos[metodo]['total'] += float(pagamento.get('valor_pago', 0))
                metodos[metodo]['count'] += 1
        
        # Faturamento por dia (últimos 30 dias para gráfico)
        hoje = datetime.now()
        faturamento_diario = {}
        for i in range(30):
            data = (hoje - timedelta(days=i)).strftime('%Y-%m-%d')
            faturamento_diario[data] = 0
        
        for pagamento in pagamentos:
            if pagamento.get('status') == 'pago' and pagamento.get('data_pagamento'):
                data_pag = pagamento.get('data_pagamento', '')
                if isinstance(data_pag, str):
                    data_pag = data_pag[:10]
                else:
                    data_pag = data_pag.strftime('%Y-%m-%d')
                
                if data_pag in faturamento_diario:
                    faturamento_diario[data_pag] += float(pagamento.get('valor_pago', 0))
        
        # Converter para array ordenado
        faturamento_diario_array = [
            {'data': data, 'valor': valor}
            for data, valor in sorted(faturamento_diario.items())
        ]
        
        return jsonify({
            'periodo': {
                'inicio': data_inicio,
                'fim': data_fim
            },
            'totais': {
                'pago': round(total_pago, 2),
                'pendente': round(total_pendente, 2),
                'parcial': round(total_parcial, 2),
                'cancelado': round(total_cancelado, 2),
                'total': round(total_pago + total_pendente + total_parcial, 2)
            },
            'contadores': {
                'pago': count_pago,
                'pendente': count_pendente,
                'parcial': count_parcial,
                'cancelado': count_cancelado,
                'total': len(pagamentos)
            },
            'por_metodo': metodos,
            'faturamento_diario': faturamento_diario_array
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@financeiro_bp.route('/pendencias', methods=['GET'])
@require_auth
def get_pendencias():
    """Retorna pagamentos de mensalidades pendentes (a vencer e vencidos)"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        service = MensalidadeService()
        pagamentos = service.listar_pagamentos(clinica_id, {'status': 'pendente'})
        
        hoje = datetime.now().date()
        
        vencidos = []
        a_vencer = []
        
        for pagamento in pagamentos:
            data_venc = pagamento.get('data_vencimento')
            if data_venc:
                if isinstance(data_venc, str):
                    data_venc = datetime.fromisoformat(data_venc.replace('Z', '+00:00')).date()
                
                if data_venc < hoje:
                    vencidos.append(pagamento)
                else:
                    a_vencer.append(pagamento)
        
        return jsonify({
            'vencidos': vencidos,
            'a_vencer': a_vencer,
            'total_vencidos': len(vencidos),
            'total_a_vencer': len(a_vencer),
            'valor_vencido': sum(float(p.get('valor_pago', 0)) for p in vencidos),
            'valor_a_vencer': sum(float(p.get('valor_pago', 0)) for p in a_vencer)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
