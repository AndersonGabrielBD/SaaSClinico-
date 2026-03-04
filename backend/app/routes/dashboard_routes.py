# filepath: backend/app/routes/dashboard_routes.py
from flask import Blueprint, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.services.mensalidade_service import MensalidadeService
from datetime import datetime, timedelta
from database.supabase_client import get_supabase_client
from app.utils.date_utils import today_brazil_str, start_of_week_brazil, days_ago_brazil

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_dashboard_stats():
    """Retorna estatísticas do dashboard com payload padronizado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        stats = _build_dashboard_stats(clinica_id)
        return jsonify(stats), 200

    except Exception as e:
        try:
            user = get_current_user()
            clinica_id = user['clinica_id']
            return jsonify(_build_dashboard_stats(clinica_id)), 200
        except:
            return jsonify({'error': str(e)}), 500

def _build_dashboard_stats(clinica_id):
    """Monta estatísticas do dashboard em formato único para o frontend"""
    pacientes_repo = BaseRepository('pacientes', clinica_id)

    # Total de pacientes ativos
    total_pacientes = pacientes_repo.count(filters={'ativo': True})

    # Agendamentos (query direta com JOIN para garantir estrutura estável)
    client = get_supabase_client()
    agendamentos_result = client.table('agendamentos')\
        .select('''
            *,
            paciente:pacientes(id, nome_completo, telefone_principal),
            profissional:usuarios!profissional_id(id, nome_completo, especialidade)
        ''')\
        .eq('clinica_id', clinica_id)\
        .execute()
    agendamentos = agendamentos_result.data or []

    # Agendamentos hoje (usando timezone do Brasil)
    hoje = today_brazil_str()
    agendamentos_hoje = [a for a in agendamentos if str(a.get('data_agendamento', '')).startswith(hoje)]

    # Agendamentos desta semana
    inicio_semana = start_of_week_brazil().isoformat()
    agendamentos_semana = [a for a in agendamentos if str(a.get('data_agendamento', '')) >= inicio_semana]

    # Distribuição por status (dia atual)
    distribuicao_status = {
        'agendada': len([a for a in agendamentos_hoje if a.get('status') == 'agendada']),
        'confirmada': len([a for a in agendamentos_hoje if a.get('status') == 'confirmada']),
        'concluida': len([a for a in agendamentos_hoje if a.get('status') == 'concluida']),
        'cancelada': len([a for a in agendamentos_hoje if a.get('status') == 'cancelada']),
        'faltou': len([a for a in agendamentos_hoje if a.get('status') == 'faltou'])
    }

    # Taxa de comparecimento (últimos 30 dias)
    trinta_dias_atras = days_ago_brazil(30).isoformat()
    agendamentos_30d = [
        a for a in agendamentos
        if trinta_dias_atras <= str(a.get('data_agendamento', '')) <= hoje
        and a.get('status') in ['concluida', 'faltou']
    ]
    if agendamentos_30d:
        concluidas = len([a for a in agendamentos_30d if a.get('status') == 'concluida'])
        taxa_comparecimento = round((concluidas / len(agendamentos_30d)) * 100, 1)
    else:
        taxa_comparecimento = 0.0

    # Próximos agendamentos
    proximos_agendamentos = [
        a for a in agendamentos
        if str(a.get('data_agendamento', '')) >= hoje
        and a.get('status') in ['agendada', 'confirmada']
    ]
    proximos_agendamentos = sorted(
        proximos_agendamentos,
        key=lambda a: (
            str(a.get('data_agendamento', '')),
            str(a.get('horario_inicio', ''))
        )
    )[:10]

    # Financeiro baseado em mensalidades/pagamentos
    faturamento_mes = 0.0
    try:
        mensalidade_stats = MensalidadeService().obter_estatisticas(clinica_id)
        faturamento_mes = float(mensalidade_stats.get('valor_total_recebido_mes', 0))
    except Exception:
        faturamento_mes = 0.0

    return {
        'total_pacientes': total_pacientes,
        'pacientes_ativos': total_pacientes,
        'consultas_hoje': len(agendamentos_hoje),
        'consultas_semana': len(agendamentos_semana),
        'faturamento_mes': faturamento_mes,
        'taxa_comparecimento': taxa_comparecimento,
        'distribuicao_status': distribuicao_status,
        'proximos_agendamentos': proximos_agendamentos,

        # Compatibilidade com payload antigo
        'agendamentos_hoje': len(agendamentos_hoje),
        'agendamentos_semana': len(agendamentos_semana),
        'agendamentos': {
            'total': len(agendamentos),
            'agendados': distribuicao_status['agendada'],
            'confirmados': distribuicao_status['confirmada'],
            'concluidos': distribuicao_status['concluida'],
            'cancelados': distribuicao_status['cancelada']
        }
    }


@dashboard_bp.route('/recent', methods=['GET'])
@require_auth
@require_roles(['admin', 'recepcao'])
def get_recent_activity():
    """Retorna atividades recentes"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        
        # Últimos agendamentos
        agendamentos_repo = BaseRepository('agendamentos', clinica_id)
        recent_agendamentos = agendamentos_repo.get_all(order_by='-data_criacao', limit=10)
        
        # Últimos pacientes
        pacientes_repo = BaseRepository('pacientes', clinica_id)
        recent_pacientes = pacientes_repo.get_all(order_by='-data_criacao', limit=5)
        
        return jsonify({
            'agendamentos': recent_agendamentos,
            'pacientes': recent_pacientes
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
