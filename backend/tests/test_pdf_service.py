"""Smoke tests para geração de PDF (ReportLab)."""
from unittest.mock import MagicMock, patch

from app.services.pdf_service import PdfService


def test_generate_agenda_pdf_empty():
    with patch("app.services.pdf_service.get_supabase_client", return_value=MagicMock()):
        svc = PdfService()
    svc._get_clinica_data = lambda _cid: {"nome_clinica": "Clínica Teste", "cores_primaria": "#2D6A4F"}
    buf = svc.generate_agenda_pdf([], {"data_inicio": "2025-01-01", "data_fim": "2025-01-31"})
    assert buf.getvalue()[:4] == b"%PDF"


def test_generate_frequencia_pdf_empty():
    with patch("app.services.pdf_service.get_supabase_client", return_value=MagicMock()):
        svc = PdfService()
    svc._get_clinica_data = lambda _cid: {"nome_clinica": "Clínica Teste"}
    buf = svc.generate_frequencia_pdf({"por_profissional": []}, None)
    assert buf.getvalue()[:4] == b"%PDF"


def test_generate_prontuario_pdf_minimal():
    with patch("app.services.pdf_service.get_supabase_client", return_value=MagicMock()):
        svc = PdfService()
    svc._get_clinica_data = lambda _cid: {"nome_clinica": "X"}
    buf = svc.generate_prontuario_pdf(
        {
            "clinica_id": "c1",
            "titulo": "T",
            "data_criacao": "2025-01-01",
            "paciente": {"nome_completo": "Paciente"},
            "evolucoes": [
                {
                    "data_criacao": "2025-01-02T10:00:00",
                    "conteudo": "Linha1\nLinha2 & <tag>",
                    "titulo_resumo": "Sessão",
                }
            ],
        }
    )
    assert buf.getvalue()[:4] == b"%PDF"
