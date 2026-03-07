# filepath: backend/app/utils/date_utils.py
"""
Utilitários de data com timezone do Brasil.
Todas as funções retornam datas/horários no timezone de São Paulo.
"""
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

# Timezone do Brasil (São Paulo)
BRAZIL_TZ = ZoneInfo('America/Sao_Paulo')


def now_brazil() -> datetime:
    """Retorna datetime atual no timezone do Brasil"""
    return datetime.now(BRAZIL_TZ)


def today_brazil() -> date:
    """Retorna date de hoje no timezone do Brasil"""
    return datetime.now(BRAZIL_TZ).date()


def today_brazil_str() -> str:
    """Retorna string ISO de hoje no Brasil (YYYY-MM-DD)"""
    return today_brazil().isoformat()


def start_of_week_brazil() -> date:
    """Retorna primeiro dia da semana atual (segunda-feira)"""
    today = today_brazil()
    return today - timedelta(days=today.weekday())


def start_of_month_brazil() -> date:
    """Retorna primeiro dia do mês atual"""
    today = today_brazil()
    return today.replace(day=1)


def days_ago_brazil(days: int) -> date:
    """Retorna data de X dias atrás"""
    return today_brazil() - timedelta(days=days)
