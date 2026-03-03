# filepath: backend/app/services/dashboard_service.py
from datetime import date, datetime, timedelta
from app.repositories.base_repository import BaseRepository
from app.schemas.dashboard_schema import DashboardStatsResponse, ProximaConsulta
from database.supabase_client import get_supabase_client


class DashboardService:
    """Service do dashboard"""
    
    def __init__(self):
        self.repo = BaseRepository("agendamentos")

    async def obter_estatisticas(self, clinica_id: str) -> DashboardStatsResponse:
        """Obtém estatísticas gerais do dashboard"""
        
        client = get_supabase_client()
        
        today = date.today().isoformat()
        start_of_week = (date.today() - timedelta(days=date.today().weekday())).isoformat()
        start_of_month = date.today().replace(day=1).isoformat()
        thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()

        # Total de pacientes ativos
        total_pacientes_result = client.table("pacientes")\
            .select("id", count="exact")\
            .eq("clinica_id", clinica_id)\
            .eq("ativo", True)\
            .execute()
        total_pacientes = total_pacientes_result.count or 0

        # Consultas de hoje
        consultas_hoje_result = client.table("agendamentos")\
            .select("id", count="exact")\
            .eq("clinica_id", clinica_id)\
            .eq("data_agendamento", today)\
            .execute()
        consultas_hoje = consultas_hoje_result.count or 0

        # Consultas da semana
        consultas_semana_result = client.table("agendamentos")\
            .select("id", count="exact")\
            .eq("clinica_id", clinica_id)\
            .gte("data_agendamento", start_of_week)\
            .execute()
        consultas_semana = consultas_semana_result.count or 0

        # Faturamento do mês (pagamentos de mensalidades)
        pagamentos_result = client.table("pagamentos_mensalidades")\
            .select("valor_pago")\
            .eq("clinica_id", clinica_id)\
            .eq("status", "pago")\
            .gte("mes_referencia", start_of_month)\
            .execute()

        faturamento_mes = sum(float(p["valor_pago"]) for p in pagamentos_result.data) if pagamentos_result.data else 0.0

        # Taxa de comparecimento (últimos 30 dias)
        agendamentos_passados = client.table("agendamentos")\
            .select("status")\
            .eq("clinica_id", clinica_id)\
            .gte("data_agendamento", thirty_days_ago)\
            .lte("data_agendamento", today)\
            .in_("status", ["concluida", "faltou"])\
            .execute()
        
        if agendamentos_passados.data:
            total = len(agendamentos_passados.data)
            concluidas = sum(1 for a in agendamentos_passados.data if a["status"] == "concluida")
            taxa_comparecimento = (concluidas / total * 100) if total > 0 else 0.0
        else:
            taxa_comparecimento = 0.0

        # Próximas consultas (hoje e próximos 7 dias)
        proximas_result = client.table("agendamentos")\
            .select("id, paciente_id, profissional_id, data_agendamento, horario_inicio, horario_fim, tipo_atendimento, status, pacientes(nome_completo), usuarios(nome_completo)")\
            .eq("clinica_id", clinica_id)\
            .gte("data_agendamento", today)\
            .in_("status", ["agendada", "confirmada"])\
            .order("data_agendamento")\
            .order("horario_inicio")\
            .limit(10)\
            .execute()

        proximas_consultas = []
        if proximas_result.data:
            for ag in proximas_result.data:
                proximas_consultas.append(ProximaConsulta(
                    id=ag["id"],
                    paciente_nome=ag["pacientes"]["nome_completo"] if ag.get("pacientes") else "N/A",
                    profissional_nome=ag["usuarios"]["nome_completo"] if ag.get("usuarios") else "N/A",
                    data_agendamento=ag["data_agendamento"],
                    horario_inicio=ag["horario_inicio"],
                    horario_fim=ag["horario_fim"],
                    tipo_atendimento=ag["tipo_atendimento"] or "Consulta",
                    status=ag["status"]
                ))

        return DashboardStatsResponse(
            total_pacientes=total_pacientes,
            pacientes_ativos=total_pacientes,
            consultas_hoje=consultas_hoje,
            consultas_semana=consultas_semana,
            faturamento_mes=faturamento_mes,
            taxa_comparecimento=taxa_comparecimento,
            proximas_consultas=proximas_consultas
        )
