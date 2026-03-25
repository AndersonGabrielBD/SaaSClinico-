"""Rotas de modelos de evolução (auth + role)."""
import json

from tests.conftest import auth_header, CLINICA_A_ID, PROF_A_ID, RECEPCAO_A_ID


def test_modelos_list_requires_auth(client):
    r = client.get("/modelos-evolucao")
    assert r.status_code == 401


def test_modelos_list_recepcao_forbidden(client):
    r = client.get("/modelos-evolucao", headers=auth_header(RECEPCAO_A_ID))
    assert r.status_code == 403


def test_modelos_list_prof_ok(client, fake_supabase):
    fake_supabase._table_data["modelos_evolucao"] = [
        {
            "id": "m1",
            "clinica_id": CLINICA_A_ID,
            "usuario_id": PROF_A_ID,
            "nome": "Modelo A",
            "valores_padrao": {"conteudo": "x"},
            "ordem": 0,
            "data_criacao": "2025-01-01T00:00:00Z",
            "data_atualizacao": "2025-01-01T00:00:00Z",
        }
    ]
    r = client.get("/modelos-evolucao", headers=auth_header(PROF_A_ID))
    assert r.status_code == 200
    data = r.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
