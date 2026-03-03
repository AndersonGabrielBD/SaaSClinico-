-- ============================================================================
-- FIX: Corrigir função RPC get_agendamentos
-- A estrutura antiga não correspondia às colunas reais da tabela
-- ============================================================================

-- Dropar função antiga
DROP FUNCTION IF EXISTS get_agendamentos(UUID, UUID, UUID, UUID, DATE, DATE, DATE, VARCHAR, INT, TEXT, BOOLEAN);

-- Criar função corrigida com as colunas corretas
CREATE OR REPLACE FUNCTION get_agendamentos(
    p_clinica_id UUID,
    p_paciente_id UUID DEFAULT NULL,
    p_profissional_id UUID DEFAULT NULL,
    p_sala_id UUID DEFAULT NULL,
    p_data_agendamento DATE DEFAULT NULL,
    p_data_inicio DATE DEFAULT NULL,
    p_data_fim DATE DEFAULT NULL,
    p_status VARCHAR DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'data_agendamento',
    p_desc BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    paciente_id UUID,
    profissional_id UUID,
    sala_id UUID,
    data_agendamento DATE,
    horario_inicio TIME,
    horario_fim TIME,
    tipo_atendimento VARCHAR,
    status appointment_status,
    observacoes TEXT,
    confirmacao_via_sms BOOLEAN,
    confirmacao_data TIMESTAMP WITH TIME ZONE,
    confirmado_por UUID,
    cancelado_em TIMESTAMP WITH TIME ZONE,
    cancelado_por UUID,
    motivo_cancelamento VARCHAR,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.clinica_id,
        a.paciente_id,
        a.profissional_id,
        a.sala_id,
        a.data_agendamento,
        a.horario_inicio,
        a.horario_fim,
        a.tipo_atendimento,
        a.status,
        a.observacoes,
        a.confirmacao_via_sms,
        a.confirmacao_data,
        a.confirmado_por,
        a.cancelado_em,
        a.cancelado_por,
        a.motivo_cancelamento,
        a.data_criacao,
        a.data_atualizacao,
        a.criado_por
    FROM agendamentos a
    WHERE a.clinica_id = p_clinica_id
    AND (p_paciente_id IS NULL OR a.paciente_id = p_paciente_id)
    AND (p_profissional_id IS NULL OR a.profissional_id = p_profissional_id)
    AND (p_sala_id IS NULL OR a.sala_id = p_sala_id)
    AND (p_data_agendamento IS NULL OR a.data_agendamento = p_data_agendamento)
    AND (p_data_inicio IS NULL OR a.data_agendamento >= p_data_inicio)
    AND (p_data_fim IS NULL OR a.data_agendamento <= p_data_fim)
    AND (p_status IS NULL OR a.status::TEXT = p_status)
    ORDER BY
        CASE WHEN p_order_by = 'data_agendamento' AND NOT p_desc THEN a.data_agendamento END ASC,
        CASE WHEN p_order_by = 'data_agendamento' AND p_desc THEN a.data_agendamento END DESC,
        CASE WHEN p_order_by = 'data_criacao' AND NOT p_desc THEN a.data_criacao END ASC,
        CASE WHEN p_order_by = 'data_criacao' AND p_desc THEN a.data_criacao END DESC,
        a.horario_inicio ASC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função get_by_id para agendamentos
DROP FUNCTION IF EXISTS get_agendamento_by_id(UUID, UUID);

CREATE OR REPLACE FUNCTION get_agendamento_by_id(
    p_id UUID,
    p_clinica_id UUID
)
RETURNS SETOF agendamentos AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM agendamentos
    WHERE id = p_id AND clinica_id = p_clinica_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_agendamentos TO authenticated;
GRANT EXECUTE ON FUNCTION get_agendamento_by_id TO authenticated;

-- Comentários
COMMENT ON FUNCTION get_agendamentos IS 'Busca agendamentos com múltiplos filtros (versão corrigida)';
COMMENT ON FUNCTION get_agendamento_by_id IS 'Busca agendamento por ID';
