# filepath: backend/app/routes/dashboard_routes.py
from flask import Blueprint, jsonify
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.services.mensalidade_service import MensalidadeService
from database.supabase_client import get_supabase_client
from datetime import date, timedelta
from collections import defaultdict

from app.utils.date_utils import today_brazil_str, start_of_week_brazil, days_ago_brazil

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
@require_auth
@require_roles(['admin'])
def get_dashboard_stats():
    """Retorna estatísticas do dashboard com payload padronizado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        stats = _build_dashboard_stats(clinica_id)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _build_dashboard_stats(clinica_id):
    """
    Monta estatísticas do dashboard usando agregações SQL diretas.
    Sem carregar registros em memória — cada métrica usa uma query pontual com filtros no banco.
    """
    client = get_supabase_client()
    hoje = today_brazil_str()
    segunda_feira = start_of_week_brazil()
    domingo_semana = segunda_feira + timedelta(days=6)
    inicio_semana = segunda_feira.isoformat()
    fim_semana = domingo_semana.isoformat()
    trinta_dias_atras = days_ago_brazil(30).isoformat()

    # ── Total de pacientes ativos (COUNT no banco) ─────────────────────────
    total_pacientes = BaseRepository('pacientes', clinica_id).count(filters={'ativo': True})

    # ── Agendamentos de hoje por status (GROUP BY no banco via RPC) ─────────
    dist_result = client.rpc('get_distribuicao_status_agendamentos', {
        'p_clinica_id': clinica_id,
        'p_data': hoje
    }).execute()
    distribuicao_status = dist_result.data or {
        'agendada': 0, 'confirmada': 0, 'concluida': 0, 'cancelada': 0, 'faltou': 0
    }
    consultas_hoje = sum(distribuicao_status.values())

    # ── COUNT da semana (seg → dom desta semana; antes: só .gte, somava o futuro inteiro) ──
    semana_result = client.table('agendamentos')\
        .select('id', count='exact')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', inicio_semana)\
        .lte('data_agendamento', fim_semana)\
        .execute()
    consultas_semana = semana_result.count or 0

    # ── Semana corrente (seg → sáb): agendados vs concluídos por dia (gráfico) ──
    fim_sab = segunda_feira + timedelta(days=5)
    inicio_seg_str = inicio_semana
    fim_sab_str = fim_sab.isoformat()
    por_dia_result = client.table('agendamentos')\
        .select('data_agendamento, status')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', inicio_seg_str)\
        .lte('data_agendamento', fim_sab_str)\
        .execute()
    ag_por_dia = defaultdict(int)
    conc_por_dia = defaultdict(int)
    for row in (por_dia_result.data or []):
        raw_d = row.get('data_agendamento')
        if not raw_d:
            continue
        ds = raw_d[:10] if isinstance(raw_d, str) else str(raw_d)[:10]
        try:
            d = date.fromisoformat(ds)
        except ValueError:
            continue
        wd = d.weekday()
        if wd > 5:
            continue
        st = (row.get('status') or '').lower()
        if st != 'cancelada':
            ag_por_dia[wd] += 1
        if st == 'concluida':
            conc_por_dia[wd] += 1
    dias_labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    semana_por_dia = [
        {
            'name': dias_labels[wd],
            'atendimentos': ag_por_dia[wd],
            'concluidos': conc_por_dia[wd],
        }
        for wd in range(6)
    ]

    # ── Taxa de comparecimento — só status, filtro no banco ─────────────────
    comp_result = client.table('agendamentos')\
        .select('status')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', trinta_dias_atras)\
        .lte('data_agendamento', hoje)\
        .in_('status', ['concluida', 'faltou'])\
        .execute()
    comp_rows = comp_result.data or []
    if comp_rows:
        concluidas = sum(1 for r in comp_rows if r['status'] == 'concluida')
        taxa_comparecimento = round(concluidas / len(comp_rows) * 100, 1)
    else:
        taxa_comparecimento = 0.0

    # ── Próximos agendamentos — apenas 10 linhas com JOIN, ordenado no banco ──
    proximos_result = client.table('agendamentos')\
        .select('id, data_agendamento, horario_inicio, horario_fim, status, tipo_atendimento, paciente_id, profissional_id, paciente:pacientes(id, nome_completo, telefone_principal), profissional:usuarios!profissional_id(id, nome_completo)')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', hoje)\
        .in_('status', ['agendada', 'confirmada'])\
        .order('data_agendamento', desc=False)\
        .order('horario_inicio', desc=False)\
        .limit(10)\
        .execute()
    proximos_agendamentos = proximos_result.data or []

    # ── Faturamento do mês (mensalidades) ───────────────────────────────────
    faturamento_mes = 0.0
    try:
        mensalidade_stats = MensalidadeService().obter_estatisticas(clinica_id)
        faturamento_mes = float(mensalidade_stats.get('valor_total_recebido_mes', 0))
    except Exception:
        faturamento_mes = 0.0

    return {
        'total_pacientes': total_pacientes,
        'pacientes_ativos': total_pacientes,
        'consultas_hoje': consultas_hoje,
        'consultas_semana': consultas_semana,
        'faturamento_mes': faturamento_mes,
        'taxa_comparecimento': taxa_comparecimento,
        'distribuicao_status': distribuicao_status,
        'proximos_agendamentos': proximos_agendamentos,
        'semana_por_dia': semana_por_dia,

        # Compatibilidade com payload antigo
        'agendamentos_hoje': consultas_hoje,
        'agendamentos_semana': consultas_semana,
        'agendamentos': {
            'total': consultas_hoje,
            'agendados': distribuicao_status['agendada'],
            'confirmados': distribuicao_status['confirmada'],
            'concluidos': distribuicao_status['concluida'],
            'cancelados': distribuicao_status['cancelada']
        }
    }


@dashboard_bp.route('/recent', methods=['GET'])
@require_auth
@require_roles(['admin'])
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
