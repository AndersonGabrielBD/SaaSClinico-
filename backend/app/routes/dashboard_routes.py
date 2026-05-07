# filepath: backend/app/routes/dashboard_routes.py
from flask import Blueprint, jsonify, request
from app.utils.jwt_utils import require_auth, require_roles, get_current_user
from app.repositories.base_repository import BaseRepository
from app.services.mensalidade_service import MensalidadeService
from database.supabase_client import get_supabase_client
from datetime import date, timedelta
from collections import defaultdict

from app.utils.date_utils import today_brazil_str

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/stats', methods=['GET'])
@require_auth
@require_roles(['admin'])
def get_dashboard_stats():
    """Retorna estatísticas do dashboard com payload padronizado"""
    try:
        user = get_current_user()
        clinica_id = user['clinica_id']
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        stats = _build_dashboard_stats(clinica_id, data_inicio=data_inicio, data_fim=data_fim)
        return jsonify(stats), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _resolve_periodo(data_inicio=None, data_fim=None):
    if data_inicio and data_fim:
        return data_inicio, data_fim

    hoje = date.fromisoformat(today_brazil_str())
    inicio = hoje.replace(day=1)
    proximo_mes = inicio.replace(day=28) + timedelta(days=4)
    fim = proximo_mes.replace(day=1) - timedelta(days=1)
    return inicio.isoformat(), fim.isoformat()


def _build_dashboard_stats(clinica_id, data_inicio=None, data_fim=None):
    """
    Monta estatísticas do dashboard usando agregações SQL diretas.
    Sem carregar registros em memória — cada métrica usa uma query pontual com filtros no banco.
    """
    client = get_supabase_client()
    data_inicio, data_fim = _resolve_periodo(data_inicio, data_fim)
    hoje = today_brazil_str()

    # ── Total de pacientes ativos (COUNT no banco) ─────────────────────────
    total_pacientes = BaseRepository('pacientes', clinica_id).count(filters={'ativo': True})

    # ── Agendamentos do período: distribuição, totais e gráfico semanal (seg-sáb) ─────────
    agendamentos_periodo_result = client.table('agendamentos')\
        .select('data_agendamento, status')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', data_inicio)\
        .lte('data_agendamento', data_fim)\
        .execute()

    distribuicao_status = {
        'agendada': 0,
        'confirmada': 0,
        'concluida': 0,
        'cancelada': 0,
        'faltou': 0,
        'em_atendimento': 0,
    }
    consultas_periodo = 0
    ag_por_dia = defaultdict(int)
    conc_por_dia = defaultdict(int)
    comp_total = 0
    comp_concluidas = 0

    for row in (agendamentos_periodo_result.data or []):
        raw_d = row.get('data_agendamento')
        if not raw_d:
            continue
        ds = raw_d[:10] if isinstance(raw_d, str) else str(raw_d)[:10]
        try:
            d = date.fromisoformat(ds)
        except ValueError:
            continue
        st = (row.get('status') or '').lower()
        if st in distribuicao_status:
            distribuicao_status[st] += 1

        if st != 'cancelada':
            consultas_periodo += 1

        if st in ('concluida', 'faltou'):
            comp_total += 1
            if st == 'concluida':
                comp_concluidas += 1

        wd = d.weekday()
        if wd > 5:
            continue
        if st != 'cancelada':
            ag_por_dia[wd] += 1
        if st == 'concluida':
            conc_por_dia[wd] += 1

    consultas_semana = sum(conc_por_dia.values())
    dias_labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    semana_por_dia = [
        {
            'name': dias_labels[wd],
            'atendimentos': ag_por_dia[wd],
            'concluidos': conc_por_dia[wd],
        }
        for wd in range(6)
    ]

    # ── Taxa de comparecimento no período ────────────────────────────────────
    if comp_total > 0:
        taxa_comparecimento = round(comp_concluidas / comp_total * 100, 1)
    else:
        taxa_comparecimento = 0.0

    # ── Agendamentos do período (até 10 linhas com JOIN, ordenado no banco) ──
    proximos_result = client.table('agendamentos')\
        .select('id, data_agendamento, horario_inicio, horario_fim, status, tipo_atendimento, paciente_id, profissional_id, paciente:pacientes(id, nome_completo, telefone_principal), profissional:usuarios!profissional_id(id, nome_completo)')\
        .eq('clinica_id', clinica_id)\
        .gte('data_agendamento', data_inicio)\
        .lte('data_agendamento', data_fim)\
        .in_('status', ['agendada', 'confirmada'])\
        .order('data_agendamento', desc=False)\
        .order('horario_inicio', desc=False)\
        .limit(10)\
        .execute()
    proximos_agendamentos = proximos_result.data or []

    # ── Faturamento no período (mensalidades) ────────────────────────────────
    faturamento_mes = 0.0
    try:
        resumo = client.rpc('get_resumo_financeiro', {
            'p_clinica_id': clinica_id,
            'p_data_inicio': data_inicio,
            'p_data_fim': data_fim,
        }).execute()
        totais = (resumo.data or {}).get('totais', {})
        faturamento_mes = float(totais.get('pago', 0))
    except Exception:
        try:
            mensalidade_stats = MensalidadeService().obter_estatisticas(clinica_id)
            faturamento_mes = float(mensalidade_stats.get('valor_total_recebido_mes', 0))
        except Exception:
            faturamento_mes = 0.0

    return {
        'total_pacientes': total_pacientes,
        'pacientes_ativos': total_pacientes,
        'consultas_hoje': consultas_periodo,
        'consultas_semana': consultas_semana,
        'faturamento_mes': faturamento_mes,
        'taxa_comparecimento': taxa_comparecimento,
        'distribuicao_status': distribuicao_status,
        'proximos_agendamentos': proximos_agendamentos,
        'semana_por_dia': semana_por_dia,
        'periodo': {
            'inicio': data_inicio,
            'fim': data_fim,
            'referencia': hoje,
        },

        # Compatibilidade com payload antigo
        'agendamentos_hoje': consultas_periodo,
        'agendamentos_semana': consultas_semana,
        'agendamentos': {
            'total': consultas_periodo,
            'agendados': distribuicao_status.get('agendada', 0),
            'confirmados': distribuicao_status.get('confirmada', 0),
            'concluidos': distribuicao_status.get('concluida', 0),
            'cancelados': distribuicao_status.get('cancelada', 0)
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
