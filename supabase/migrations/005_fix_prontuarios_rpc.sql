-- ============================================================================
-- FIX: Corrigir função RPC get_prontuarios
-- A estrutura antiga não correspondia às colunas reais da tabela
-- ============================================================================

-- Dropar função antiga
DROP FUNCTION IF EXISTS get_prontuarios(UUID, UUID, INT, TEXT, BOOLEAN);

-- Criar função corrigida com as colunas corretas
CREATE OR REPLACE FUNCTION get_prontuarios(
    p_clinica_id UUID,
    p_paciente_id UUID DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'data_criacao',
    p_desc BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    paciente_id UUID,
    agendamento_id UUID,
    titulo VARCHAR,
    descricao TEXT,
    diagnostico_preliminar TEXT,
    historico_clinico TEXT,
    alergias TEXT,
    medicacoes TEXT,
    visivel_para_paciente BOOLEAN,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.clinica_id,
        p.paciente_id,
        p.agendamento_id,
        p.titulo,
        p.descricao,
        p.diagnostico_preliminar,
        p.historico_clinico,
        p.alergias,
        p.medicacoes,
        p.visivel_para_paciente,
        p.data_criacao,
        p.data_atualizacao,
        p.criado_por
    FROM prontuarios p
    WHERE p.clinica_id = p_clinica_id
    AND (p_paciente_id IS NULL OR p.paciente_id = p_paciente_id)
    ORDER BY
        CASE WHEN p_order_by = 'data_criacao' AND NOT p_desc THEN p.data_criacao END ASC,
        CASE WHEN p_order_by = 'data_criacao' AND p_desc THEN p.data_criacao END DESC,
        CASE WHEN p_order_by = 'titulo' AND NOT p_desc THEN p.titulo END ASC,
        CASE WHEN p_order_by = 'titulo' AND p_desc THEN p.titulo END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função get_by_id para prontuários
DROP FUNCTION IF EXISTS get_prontuario_by_id(UUID, UUID);

CREATE OR REPLACE FUNCTION get_prontuario_by_id(
    p_id UUID,
    p_clinica_id UUID
)
RETURNS SETOF prontuarios AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM prontuarios
    WHERE id = p_id AND clinica_id = p_clinica_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_prontuarios TO authenticated;
GRANT EXECUTE ON FUNCTION get_prontuario_by_id TO authenticated;

-- Comentários
COMMENT ON FUNCTION get_prontuarios IS 'Busca prontuários por clínica e/ou paciente (versão corrigida)';
COMMENT ON FUNCTION get_prontuario_by_id IS 'Busca prontuário por ID';
