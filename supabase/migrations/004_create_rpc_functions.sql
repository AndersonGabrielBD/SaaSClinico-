-- ============================================================================
-- RPC FUNCTIONS PARA OTIMIZAÇÃO DE CONSULTAS
-- Substitui queries diretas por funções no banco
-- ============================================================================

-- ============================================================================
-- 1. FUNÇÃO GENÉRICA GET_ALL
-- ============================================================================

-- Pacientes
CREATE OR REPLACE FUNCTION get_pacientes(
    p_clinica_id UUID,
    p_ativo BOOLEAN DEFAULT NULL,
    p_search TEXT DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'created_at',
    p_desc BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    nome_completo VARCHAR,
    cpf VARCHAR,
    data_nascimento DATE,
    genero gender_type,
    email VARCHAR,
    telefone_principal VARCHAR,
    telefone_secundario VARCHAR,
    endereco TEXT,
    numero VARCHAR,
    complemento VARCHAR,
    cidade VARCHAR,
    estado VARCHAR,
    cep VARCHAR,
    responsavel_nome VARCHAR,
    responsavel_telefone VARCHAR,
    responsavel_email VARCHAR,
    responsavel_relacao VARCHAR,
    ativo BOOLEAN,
    observacoes TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.*
    FROM pacientes p
    WHERE p.clinica_id = p_clinica_id
    AND (p_ativo IS NULL OR p.ativo = p_ativo)
    AND (p_search IS NULL OR 
         p.nome_completo ILIKE '%' || p_search || '%' OR
         p.cpf ILIKE '%' || p_search || '%' OR
         p.telefone_principal ILIKE '%' || p_search || '%')
    ORDER BY
        CASE WHEN p_order_by = 'nome_completo' AND NOT p_desc THEN p.nome_completo END ASC,
        CASE WHEN p_order_by = 'nome_completo' AND p_desc THEN p.nome_completo END DESC,
        CASE WHEN p_order_by = 'created_at' AND NOT p_desc THEN p.data_criacao END ASC,
        CASE WHEN p_order_by = 'created_at' AND p_desc THEN p.data_criacao END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Agendamentos
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
    compareceu BOOLEAN,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.*
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
        CASE WHEN p_order_by = 'created_at' AND NOT p_desc THEN a.data_criacao END ASC,
        CASE WHEN p_order_by = 'created_at' AND p_desc THEN a.data_criacao END DESC,
        a.horario_inicio ASC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Prontuários
CREATE OR REPLACE FUNCTION get_prontuarios(
    p_clinica_id UUID,
    p_paciente_id UUID DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'created_at',
    p_desc BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    paciente_id UUID,
    tipo_prontuario VARCHAR,
    titulo VARCHAR,
    conteudo TEXT,
    template_id UUID,
    data_atendimento DATE,
    profissional_id UUID,
    status VARCHAR,
    tags TEXT[],
    anexos JSONB,
    assinado BOOLEAN,
    data_assinatura TIMESTAMP WITH TIME ZONE,
    hash_assinatura TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    criado_por UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT p.*
    FROM prontuarios p
    WHERE p.clinica_id = p_clinica_id
    AND (p_paciente_id IS NULL OR p.paciente_id = p_paciente_id)
    ORDER BY
        CASE WHEN p_order_by = 'created_at' AND NOT p_desc THEN p.data_criacao END ASC,
        CASE WHEN p_order_by = 'created_at' AND p_desc THEN p.data_criacao END DESC,
        CASE WHEN p_order_by = 'data_atendimento' AND NOT p_desc THEN p.data_atendimento END ASC,
        CASE WHEN p_order_by = 'data_atendimento' AND p_desc THEN p.data_atendimento END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Usuários
CREATE OR REPLACE FUNCTION get_usuarios(
    p_clinica_id UUID,
    p_ativo BOOLEAN DEFAULT NULL,
    p_role VARCHAR DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'nome_completo',
    p_desc BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    nome_completo VARCHAR,
    email VARCHAR,
    role user_role,
    especialidade VARCHAR,
    registro_profissional VARCHAR,
    telefone VARCHAR,
    ativo BOOLEAN,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE,
    ultimo_acesso TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.clinica_id, u.nome_completo, u.email, u.role, 
           u.especialidade, u.registro_profissional, u.telefone, u.ativo,
           u.data_criacao, u.data_atualizacao, u.ultimo_acesso
    FROM usuarios u
    WHERE u.clinica_id = p_clinica_id
    AND (p_ativo IS NULL OR u.ativo = p_ativo)
    AND (p_role IS NULL OR u.role::TEXT = p_role)
    ORDER BY
        CASE WHEN p_order_by = 'nome_completo' AND NOT p_desc THEN u.nome_completo END ASC,
        CASE WHEN p_order_by = 'nome_completo' AND p_desc THEN u.nome_completo END DESC,
        CASE WHEN p_order_by = 'created_at' AND NOT p_desc THEN u.data_criacao END ASC,
        CASE WHEN p_order_by = 'created_at' AND p_desc THEN u.data_criacao END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função especial para buscar profissionais (fono, medico)
CREATE OR REPLACE FUNCTION get_profissionais(
    p_clinica_id UUID,
    p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    id UUID,
    nome_completo VARCHAR,
    email VARCHAR,
    role user_role,
    especialidade VARCHAR,
    registro_profissional VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.nome_completo, u.email, u.role, u.especialidade, u.registro_profissional
    FROM usuarios u
    WHERE u.clinica_id = p_clinica_id
    AND u.ativo = p_ativo
    AND u.role IN ('fono', 'medico')
    ORDER BY u.nome_completo ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Salas
CREATE OR REPLACE FUNCTION get_salas(
    p_clinica_id UUID,
    p_ativo BOOLEAN DEFAULT NULL,
    p_limit INT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'nome',
    p_desc BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    clinica_id UUID,
    nome VARCHAR,
    descricao TEXT,
    capacidade INT,
    equipamentos TEXT[],
    ativo BOOLEAN,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_atualizacao TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.*
    FROM salas s
    WHERE s.clinica_id = p_clinica_id
    AND (p_ativo IS NULL OR s.ativo = p_ativo)
    ORDER BY
        CASE WHEN p_order_by = 'nome' AND NOT p_desc THEN s.nome END ASC,
        CASE WHEN p_order_by = 'nome' AND p_desc THEN s.nome END DESC
    LIMIT COALESCE(p_limit, 10000);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. FUNÇÃO GET_BY_ID GENÉRICA
-- ============================================================================

CREATE OR REPLACE FUNCTION get_paciente_by_id(
    p_id UUID,
    p_clinica_id UUID
)
RETURNS SETOF pacientes AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM pacientes
    WHERE id = p_id AND clinica_id = p_clinica_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- ============================================================================
-- 3. DASHBOARD STATS (Otimizada em uma única função)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_clinica_id UUID
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_pacientes', (
            SELECT COUNT(*) FROM pacientes WHERE clinica_id = p_clinica_id AND ativo = true
        ),
        'total_pacientes_inativos', (
            SELECT COUNT(*) FROM pacientes WHERE clinica_id = p_clinica_id AND ativo = false
        ),
        'total_agendamentos', (
            SELECT COUNT(*) FROM agendamentos WHERE clinica_id = p_clinica_id
        ),
        'agendamentos_hoje', (
            SELECT COUNT(*) FROM agendamentos 
            WHERE clinica_id = p_clinica_id AND data_agendamento = CURRENT_DATE
        ),
        'agendamentos_semana', (
            SELECT COUNT(*) FROM agendamentos 
            WHERE clinica_id = p_clinica_id 
            AND data_agendamento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        ),
        'agendamentos_por_status', (
            SELECT json_object_agg(status::TEXT, count)
            FROM (
                SELECT status, COUNT(*) as count
                FROM agendamentos
                WHERE clinica_id = p_clinica_id
                AND data_agendamento >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY status
            ) as stats
        ),
        'total_prontuarios', (
            SELECT COUNT(*) FROM prontuarios WHERE clinica_id = p_clinica_id
        ),
        'prontuarios_mes', (
            SELECT COUNT(*) FROM prontuarios 
            WHERE clinica_id = p_clinica_id 
            AND data_criacao >= DATE_TRUNC('month', CURRENT_DATE)
        ),
        'total_usuarios', (
            SELECT COUNT(*) FROM usuarios WHERE clinica_id = p_clinica_id AND ativo = true
        ),
        'total_salas', (
            SELECT COUNT(*) FROM salas WHERE clinica_id = p_clinica_id AND ativo = true
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. VERIFICAÇÕES E VALIDAÇÕES
-- ============================================================================

-- Verifica se CPF já existe
CREATE OR REPLACE FUNCTION check_cpf_exists(
    p_cpf VARCHAR,
    p_clinica_id UUID,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM pacientes
        WHERE cpf = p_cpf
        AND clinica_id = p_clinica_id
        AND (p_exclude_id IS NULL OR id != p_exclude_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica conflito de agendamento
CREATE OR REPLACE FUNCTION check_agendamento_conflict(
    p_clinica_id UUID,
    p_profissional_id UUID,
    p_sala_id UUID,
    p_data_agendamento DATE,
    p_horario_inicio TIME,
    p_horario_fim TIME,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM agendamentos
        WHERE clinica_id = p_clinica_id
        AND (profissional_id = p_profissional_id OR (sala_id IS NOT NULL AND sala_id = p_sala_id))
        AND data_agendamento = p_data_agendamento
        AND (p_horario_inicio, p_horario_fim) OVERLAPS (horario_inicio, horario_fim)
        AND status NOT IN ('cancelada')
        AND (p_exclude_id IS NULL OR id != p_exclude_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

-- Conceder permissões para authenticated users
GRANT EXECUTE ON FUNCTION get_pacientes TO authenticated;
GRANT EXECUTE ON FUNCTION get_agendamentos TO authenticated;
GRANT EXECUTE ON FUNCTION get_prontuarios TO authenticated;
GRANT EXECUTE ON FUNCTION get_usuarios TO authenticated;
GRANT EXECUTE ON FUNCTION get_profissionais TO authenticated;
GRANT EXECUTE ON FUNCTION get_salas TO authenticated;
GRANT EXECUTE ON FUNCTION get_paciente_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_agendamento_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_prontuario_by_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION check_cpf_exists TO authenticated;
GRANT EXECUTE ON FUNCTION check_agendamento_conflict TO authenticated;

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================

COMMENT ON FUNCTION get_pacientes IS 'Busca pacientes com filtros e paginação';
COMMENT ON FUNCTION get_agendamentos IS 'Busca agendamentos com múltiplos filtros';
COMMENT ON FUNCTION get_prontuarios IS 'Busca prontuários por clínica e/ou paciente';
COMMENT ON FUNCTION get_usuarios IS 'Busca usuários com filtros de role e status';
COMMENT ON FUNCTION get_profissionais IS 'Busca apenas profissionais (fono/medico) ativos';
COMMENT ON FUNCTION get_salas IS 'Busca salas da clínica';
COMMENT ON FUNCTION get_dashboard_stats IS 'Retorna todas estatísticas do dashboard em uma única consulta';
COMMENT ON FUNCTION check_cpf_exists IS 'Verifica se CPF já está cadastrado na clínica';
COMMENT ON FUNCTION check_agendamento_conflict IS 'Verifica conflito de horário em agendamentos';
