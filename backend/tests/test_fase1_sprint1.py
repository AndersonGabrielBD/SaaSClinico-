"""
Fase 1 — Sprint 1: conflito de agenda, whitelist prontuário, validação de profissional.
"""
import json
from unittest.mock import MagicMock, patch

from tests.conftest import (
    auth_header,
    ADMIN_A_ID,
    RECEPCAO_A_ID,
    PROF_A_ID,
    CLINICA_A_ID,
    PACIENTE_A1_ID,
    PRONTUARIO_A1_ID,
)


def test_create_agendamento_conflict_returns_409(client):
    with patch('app.routes.agendamento_routes._validate_profissional_para_agenda', return_value=None):
        with patch('app.routes.agendamento_routes.BaseRepository') as BR:
            inst = MagicMock()
            inst.check_agendamento_conflict = MagicMock(return_value=True)
            BR.return_value = inst
            resp = client.post(
                '/agendamentos',
                headers={**auth_header(RECEPCAO_A_ID), 'Content-Type': 'application/json'},
                data=json.dumps({
                    'paciente_id': PACIENTE_A1_ID,
                    'profissional_id': PROF_A_ID,
                    'data_agendamento': '2099-06-15',
                    'horario_inicio': '09:00',
                    'horario_fim': '10:00',
                }),
            )
    assert resp.status_code == 409
    body = resp.get_json()
    assert 'conflito' in (body.get('error') or '').lower()


def _prof_error_response():
    from flask import jsonify
    return jsonify({'error': 'Profissional inválido ou não pertence a esta clínica'}), 400


def test_create_agendamento_invalid_profissional_returns_400(client):
    with patch(
        'app.routes.agendamento_routes._validate_profissional_para_agenda',
        side_effect=lambda *a, **k: _prof_error_response(),
    ):
        with patch('app.routes.agendamento_routes.BaseRepository') as BR:
            inst = MagicMock()
            inst.check_agendamento_conflict = MagicMock(return_value=False)
            BR.return_value = inst
            resp = client.post(
                '/agendamentos',
                headers={**auth_header(RECEPCAO_A_ID), 'Content-Type': 'application/json'},
                data=json.dumps({
                    'paciente_id': PACIENTE_A1_ID,
                    'profissional_id': '00000000-0000-0000-0000-000000000099',
                    'data_agendamento': '2099-06-15',
                    'horario_inicio': '09:00',
                    'horario_fim': '10:00',
                }),
            )
    assert resp.status_code == 400


def test_update_prontuario_whitelist_ignores_criado_por(client):
    existing = {
        'id': PRONTUARIO_A1_ID,
        'paciente_id': PACIENTE_A1_ID,
        'deletado_em': None,
    }
    captured = {}

    def _update(pid, payload):
        captured['payload'] = payload
        return {**existing, **payload}

    with patch('app.routes.prontuario_routes.BaseRepository') as BR:
        inst = MagicMock()
        inst.client = MagicMock()
        inst.get_by_id = MagicMock(return_value=existing)
        inst.update = MagicMock(side_effect=_update)
        BR.return_value = inst

        resp = client.put(
            f'/prontuarios/{PRONTUARIO_A1_ID}',
            headers={**auth_header(ADMIN_A_ID), 'Content-Type': 'application/json'},
            data=json.dumps({
                'titulo': 'Atualizado',
                'criado_por': '00000000-0000-0000-0000-000000000099',
                'clinica_id': str(CLINICA_A_ID),
                'id': 'hacked',
                'data_criacao': '2099-01-01',
            }),
        )
    assert resp.status_code == 200
    assert 'criado_por' not in captured['payload']
    assert 'clinica_id' not in captured['payload']
    assert 'id' not in captured['payload']
    assert 'data_criacao' not in captured['payload']
    assert captured['payload'].get('titulo') == 'Atualizado'
