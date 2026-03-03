-- ============================================================================
-- FonoFlow: Exemplos Práticos de Queries com RLS
-- ============================================================================

-- ============================================================================
-- 1. VALIDAÇÕES E CONFLITOS DE AGENDAMENTOS
-- ============================================================================

-- 1.1 Verificar conflito de horário (Mesmo profissional)
-- Execute ANTES de inserir novo agendamento
SELECT 
    COUNT(*) as conflito_count,
    ARRAY_AGG(id) as agendamentos_conflitantes
FROM public.agendamentos
WHERE clinica_id = $1  -- Injeta automaticamente via RLS
  AND profissional_id = $2
  AND data_agendamento = $3
  AND (horario_inicio, horario_fim) OVERLAPS ($4::TIME, $5::TIME)
  AND status IN ('agendada', 'confirmada')
  AND deleted_at IS NULL;

-- 1.2 Verificar conflito de sala
SELECT 
    COUNT(*) as conflito_count
FROM public.agendamentos
WHERE clinica_id = $1
  AND sala_id = $2
  AND data_agendamento = $3
  AND (horario_inicio, horario_fim) OVERLAPS ($4::TIME, $5::TIME)
  AND status IN ('agendada', 'confirmada');

-- 1.3 Listar agendamentos do profissional no dia
SELECT 
    a.id,
    a.data_agendamento,
    a.horario_inicio,
    a.horario_fim,
    p.nome_completo as paciente_nome,
    p.cpf,
    a.tipo_atendimento,
    a.status,
    s.nome as sala_nome
FROM public.agendamentos a
LEFT JOIN public.pacientes p ON a.paciente_id = p.id
LEFT JOIN public.salas s ON a.sala_id = s.id
WHERE clinica_id = $1  -- RLS automático
  AND a.profissional_id = $2
  AND a.data_agendamento = CURRENT_DATE
  AND a.status IN ('agendada', 'confirmada')
ORDER BY a.horario_inicio ASC;

-- 1.4 Agenda do dia da clínica (todos os profissionais)
SELECT 
    a.id,
    a.horario_inicio,
    a.horario_fim,
    p.nome_completo as paciente_nome,
    u.nome_completo as profissional_nome,
    a.status,
    s.nome as sala_nome
FROM public.agendamentos a
LEFT JOIN public.pacientes p ON a.paciente_id = p.id
LEFT JOIN public.usuarios u ON a.profissional_id = u.id
LEFT JOIN public.salas s ON a.sala_id = s.id
WHERE a.clinica_id = $1  -- RLS automático
  AND a.data_agendamento = CURRENT_DATE
  AND a.status IN ('agendada', 'confirmada')
ORDER BY a.horario_inicio ASC;

-- ============================================================================
-- 2. GESTÃO DE PACIENTES
-- ============================================================================

-- 2.1 Buscar paciente por CPF
SELECT 
    id,
    nome_completo,
    cpf,
    data_nascimento,
    genero,
    telefone_principal,
    ativo
FROM public.pacientes
WHERE clinica_id = $1  -- RLS automático
  AND cpf = $2
  AND ativo = true
LIMIT 1;

-- 2.2 Listar todos os pacientes ativos (com paginação)
SELECT 
    id,
    nome_completo,
    cpf,
    data_nascimento,
    genero,
    telefone_principal,
    email,
    created_at
FROM public.pacientes
WHERE clinica_id = $1  -- RLS automático
  AND ativo = true
ORDER BY nome_completo ASC
LIMIT $2 OFFSET $3;  -- $2 = limit, $3 = offset

-- 2.3 Histórico de agendamentos de um paciente
SELECT 
    a.id,
    a.data_agendamento,
    a.horario_inicio,
    a.horario_fim,
    u.nome_completo as profissional_nome,
    a.tipo_atendimento,
    a.status
FROM public.agendamentos a
LEFT JOIN public.usuarios u ON a.profissional_id = u.id
WHERE a.clinica_id = $1  -- RLS automático
  AND a.paciente_id = $2
ORDER BY a.data_agendamento DESC;

-- 2.4 Pacientes agendados no mês
SELECT 
    DISTINCT p.id,
    p.nome_completo,
    p.cpf,
    COUNT(a.id) as total_agendamentos
FROM public.pacientes p
LEFT JOIN public.agendamentos a ON p.id = a.paciente_id
WHERE p.clinica_id = $1  -- RLS automático
  AND DATE_TRUNC('month', a.data_agendamento) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.id
ORDER BY COUNT(a.id) DESC;

-- ============================================================================
-- 3. PRONTUÁRIOS E EVOLUÇÕES
-- ============================================================================

-- 3.1 Obter prontuário com últimas evoluções
SELECT 
    pr.id,
    pr.titulo,
    pr.descricao,
    pr.diagnostico_preliminar,
    pr.historico_clinico,
    pr.alergias,
    pr.medicacoes,
    COALESCE(json_agg(json_build_object(
        'id', ev.id,
        'titulo', ev.titulo_resumo,
        'conteudo', ev.conteudo,
        'data', ev.data_criacao,
        'criado_por', u.nome_completo,
        'imutavel', ev.imutavel
    ) ORDER BY ev.data_criacao DESC), '[]'::json) as evolucoes
FROM public.prontuarios pr
LEFT JOIN public.evolucoes ev ON pr.id = ev.prontuario_id
LEFT JOIN public.usuarios u ON ev.criado_por = u.id
WHERE pr.clinica_id = $1  -- RLS automático
  AND pr.paciente_id = $2
GROUP BY pr.id
ORDER BY pr.data_criacao DESC;

-- 3.2 Timeline de evolução de um paciente (cronológica)
SELECT 
    a.id as agendamento_id,
    a.data_agendamento,
    a.horario_inicio,
    u_prof.nome_completo as profissional,
    ev.id as evolucao_id,
    ev.titulo_resumo,
    ev.data_criacao,
    ev.imutavel
FROM public.agendamentos a
LEFT JOIN public.usuarios u_prof ON a.profissional_id = u_prof.id
LEFT JOIN public.evolucoes ev ON a.id = ev.agendamento_id
WHERE a.clinica_id = $1  -- RLS automático
  AND a.paciente_id = $2
ORDER BY a.data_agendamento DESC, ev.data_criacao DESC;

-- 3.3 Listar anexos de uma evolução
SELECT 
    id,
    nome_arquivo,
    tipo_arquivo,
    tamanho_bytes,
    descricao,
    data_criacao,
    criado_por
FROM public.anexos_prontuarios
WHERE clinica_id = $1  -- RLS automático
  AND evolucao_id = $2
ORDER BY data_criacao DESC;

-- 3.4 Evoluções por editar (não imutáveis, criadas por usuário)
SELECT 
    id,
    prontuario_id,
    titulo_resumo,
    data_criacao,
    imutavel
FROM public.evolucoes
WHERE clinica_id = $1  -- RLS automático
  AND criado_por = $2  -- User ID
  AND imutavel = false
ORDER BY data_criacao DESC;

-- ============================================================================
-- 4. GESTÃO FINANCEIRA
-- ============================================================================

-- 4.1 Resumo financeiro do dia
SELECT 
    COUNT(CASE WHEN status = 'pago' THEN 1 END) as total_pago,
    SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END)::DECIMAL(10,2) as valor_pago,
    COUNT(CASE WHEN status = 'pendente' THEN 1 END) as total_pendente,
    SUM(CASE WHEN status = 'pendente' THEN valor ELSE 0 END)::DECIMAL(10,2) as valor_pendente,
    COUNT(*) as total_lancamentos
FROM public.lancamentos_financeiros
WHERE clinica_id = $1  -- RLS automático
  AND DATE(data_criacao) = CURRENT_DATE;

-- 4.2 Faturamento por período
SELECT 
    DATE_TRUNC('day', data_pagamento)::DATE as data,
    COUNT(*) as total_transacoes,
    SUM(valor)::DECIMAL(10,2) as valor_total
FROM public.lancamentos_financeiros
WHERE clinica_id = $1  -- RLS automático
  AND status = 'pago'
  AND data_pagamento >= $2::DATE  -- Data início
  AND data_pagamento <= $3::DATE  -- Data fim
GROUP BY DATE_TRUNC('day', data_pagamento)
ORDER BY data ASC;

-- 4.3 Lançamentos pendentes por vencer
SELECT 
    id,
    descricao,
    valor,
    data_vencimento,
    paciente_id,
    p.nome_completo as paciente_nome,
    EXTRACT(DAY FROM (data_vencimento - CURRENT_DATE))::INT as dias_para_vencer
FROM public.lancamentos_financeiros lf
LEFT JOIN public.pacientes p ON lf.paciente_id = p.id
WHERE lf.clinica_id = $1  -- RLS automático
  AND lf.status = 'pendente'
  AND lf.data_vencimento <= CURRENT_DATE + INTERVAL '7 days'
ORDER BY lf.data_vencimento ASC;

-- 4.4 Receita por serviço/tipo de atendimento
SELECT 
    a.tipo_atendimento,
    COUNT(a.id) as total_atendimentos,
    COUNT(CASE WHEN lf.status = 'pago' THEN 1 END) as atendimentos_pagos,
    SUM(lf.valor) FILTER (WHERE lf.status = 'pago')::DECIMAL(10,2) as valor_recebido,
    AVG(lf.valor) FILTER (WHERE lf.status = 'pago')::DECIMAL(10,2) as valor_medio
FROM public.agendamentos a
LEFT JOIN public.lancamentos_financeiros lf ON a.id = lf.agendamento_id
WHERE a.clinica_id = $1  -- RLS automático
  AND a.status = 'concluida'
  AND a.data_agendamento >= $2::DATE
  AND a.data_agendamento <= $3::DATE
GROUP BY a.tipo_atendimento
ORDER BY SUM(lf.valor) DESC NULLS LAST;

-- ============================================================================
-- 5. DASHBOARD E ANÁLISES
-- ============================================================================

-- 5.1 KPIs do Dashboard Principal
SELECT 
    json_build_object(
        'total_pacientes', (
            SELECT COUNT(*) FROM public.pacientes p
            WHERE p.clinica_id = $1 AND p.ativo = true
        ),
        'agendamentos_hoje', (
            SELECT COUNT(*) FROM public.agendamentos a
            WHERE a.clinica_id = $1 
              AND a.data_agendamento = CURRENT_DATE
              AND a.status != 'cancelada'
        ),
        'agendamentos_semana', (
            SELECT COUNT(*) FROM public.agendamentos a
            WHERE a.clinica_id = $1 
              AND a.data_agendamento >= CURRENT_DATE
              AND a.data_agendamento < CURRENT_DATE + INTERVAL '7 days'
              AND a.status != 'cancelada'
        ),
        'faturamento_mes', (
            SELECT COALESCE(SUM(valor), 0)::DECIMAL(10,2) 
            FROM public.lancamentos_financeiros lf
            WHERE lf.clinica_id = $1 
              AND lf.status = 'pago'
              AND DATE_TRUNC('month', lf.data_pagamento) = DATE_TRUNC('month', CURRENT_DATE)
        ),
        'pendencias', (
            SELECT COUNT(*) FROM public.lancamentos_financeiros lf
            WHERE lf.clinica_id = $1 AND lf.status IN ('pendente', 'parcial')
        )
    ) as dashboard_kpis;

-- 5.2 Taxa de confirmação de agendamentos
SELECT 
    COUNT(CASE WHEN status = 'confirmada' THEN 1 END)::DECIMAL / 
    COUNT(*)::DECIMAL * 100 as taxa_confirmacao_pct,
    COUNT(CASE WHEN status = 'faltou' THEN 1 END) as total_faltas,
    COUNT(CASE WHEN status = 'cancelada' THEN 1 END) as total_cancelamentos
FROM public.agendamentos
WHERE clinica_id = $1  -- RLS automático
  AND data_agendamento >= CURRENT_DATE - INTERVAL '30 days';

-- 5.3 Profissionais mais solicitados
SELECT 
    u.id,
    u.nome_completo,
    COUNT(a.id) as total_agendamentos,
    COUNT(CASE WHEN a.status = 'concluida' THEN 1 END) as agendamentos_concluidos,
    AVG(EXTRACT(DAY FROM (a.data_atualizacao - a.data_criacao)))::DECIMAL as dias_medio_conclusao
FROM public.usuarios u
LEFT JOIN public.agendamentos a ON u.id = a.profissional_id
WHERE u.clinica_id = $1  -- RLS automático
  AND u.role IN ('fono', 'medico')
  AND u.ativo = true
  AND a.data_agendamento >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.id
ORDER BY COUNT(a.id) DESC;

-- ============================================================================
-- 6. AUDITORIA E COMPLIANCE LGPD
-- ============================================================================

-- 6.1 Histórico de modificações de um paciente
SELECT 
    id,
    usuario_id,
    acao,
    dados_anteriores,
    dados_novos,
    alteracoes_resumo,
    data_acao,
    endereco_ip
FROM public.audit_logs
WHERE clinica_id = $1  -- RLS automático
  AND tabela_afetada = 'pacientes'
  AND registro_id = $2
ORDER BY data_acao DESC;

-- 6.2 Quem acessou que dados (para trilha de auditoria)
SELECT 
    usuario_id,
    u.nome_completo,
    COUNT(*) as total_acessos,
    MIN(data_acao) as primeiro_acesso,
    MAX(data_acao) as ultimo_acesso
FROM public.audit_logs al
LEFT JOIN public.usuarios u ON al.usuario_id = u.id
WHERE al.clinica_id = $1  -- RLS automático
  AND al.acao = 'VIEW'
  AND al.data_acao >= $2::TIMESTAMP  -- Data de ago (últimos 30 dias)
GROUP BY usuario_id
ORDER BY COUNT(*) DESC;

-- 6.3 Relatório de mudanças em prontuário (para compliance)
SELECT 
    al.id,
    u.nome_completo,
    al.acao,
    al.alteracoes_resumo,
    al.data_acao
FROM public.audit_logs al
LEFT JOIN public.usuarios u ON al.usuario_id = u.id
WHERE al.clinica_id = $1  -- RLS automático
  AND al.tabela_afetada = 'evolucoes'
  AND al.data_acao >= $2::TIMESTAMP
  AND al.data_acao <= $3::TIMESTAMP
ORDER BY al.data_acao DESC;

-- 6.4 Dados sensíveis de um paciente (para direito ao esquecimento - LGPD)
SELECT 
    'pacientes'::TEXT as tabela,
    COUNT(*) as total_registros
FROM public.pacientes
WHERE clinica_id = $1 AND id = $2
UNION ALL
SELECT 'agendamentos', COUNT(*) FROM public.agendamentos WHERE clinica_id = $1 AND paciente_id = $2
UNION ALL
SELECT 'prontuarios', COUNT(*) FROM public.prontuarios WHERE clinica_id = $1 AND paciente_id = $2
UNION ALL
SELECT 'evolucoes', COUNT(*) FROM public.evolucoes WHERE clinica_id = $1 AND 
    prontuario_id IN (SELECT id FROM public.prontuarios WHERE paciente_id = $2)
UNION ALL
SELECT 'lancamentos_financeiros', COUNT(*) FROM public.lancamentos_financeiros 
    WHERE clinica_id = $1 AND paciente_id = $2;

-- ============================================================================
-- 7. OPERAÇÕES DE MANUTENÇÃO
-- ============================================================================

-- 7.1 Soft delete de paciente (direito ao esquecimento - será softdelete)
UPDATE public.pacientes
SET ativo = false, data_atualizacao = NOW()
WHERE clinica_id = $1  -- RLS garante que não deleta de outra clínica
  AND id = $2;

-- 7.2 Marcar evolução como imutável (após finalizar atendimento)
UPDATE public.evolucoes
SET imutavel = true, data_atualizacao = NOW()
WHERE clinica_id = $1  -- RLS automático
  AND id = $2
  AND criado_por = $3  -- Apenas criador pode fazer isto
  AND imutavel = false;

-- 7.3 Contabilidade de dados por clínica (para conhecer volume)
SELECT 
    clinica_id,
    (SELECT COUNT(*) FROM public.usuarios WHERE clinica_id = c.id) as total_usuarios,
    (SELECT COUNT(*) FROM public.pacientes WHERE clinica_id = c.id) as total_pacientes,
    (SELECT COUNT(*) FROM public.agendamentos WHERE clinica_id = c.id) as total_agendamentos,
    (SELECT COUNT(*) FROM public.prontuarios WHERE clinica_id = c.id) as total_prontuarios,
    (SELECT COUNT(*) FROM public.lancamentos_financeiros WHERE clinica_id = c.id) as total_lancamentos
FROM public.clinicas c
WHERE c.ativo = true;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- ✅ RLS é automático: Todas as queries acima terão clinica_id filtrado
--    automaticamente pelo Supabase Auth (via JWT claim).
--
-- ⚠️  CPF e Email precisam ser únicos POR CLÍNICA, não globais:
--    Para implementar isso no backend, fazer validation check.
--
-- 🔐 Sensitive Data: Nunca retorne senhas ou tokens em queries.
--
-- ⏱️  Performance: Use LIMIT/OFFSET para paginação em listas grandes.
--
-- 📊 Índices: As queries acima usam índices principais, verificar EXPLAIN PLAN periodicamente.
